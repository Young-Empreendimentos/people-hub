-- Publicação de plano de sucessão para o titular/candidatos
--
-- A migration original registrava "o candidato não vê o plano". Isso passa a ser
-- possível, mas de forma controlada e explícita: o admin escolhe QUEM vê e QUAIS
-- campos aparecem.
--
-- Decisão de arquitetura: o destinatário NÃO recebe acesso às tabelas. RLS filtra
-- linha, não coluna — liberar a linha do plano deixaria risco_saida e
-- impacto_vacancia legíveis pela API REST mesmo com a tela escondendo. Então todo
-- o acesso do não-admin passa por função security definer que devolve só os campos
-- liberados. Risco e impacto nunca são retornados, em nenhuma hipótese.
--
-- Cada destinatário vê apenas a PRÓPRIA coluna: não descobre que existem outros
-- candidatos, nem a prontidão deles.

-- ---------------------------------------------------------------------------
-- 1. Estado da publicação no plano
-- ---------------------------------------------------------------------------
alter table rh.rh_sucessao_planos
  add column if not exists publicado boolean not null default false,
  add column if not exists publicado_em timestamptz,
  add column if not exists publicado_por uuid references auth.users(id) on delete set null,
  add column if not exists publicacao_campos jsonb not null default
    '{"grupo":true,"nivel":true,"criterio":true,"treinamento":true,"data_alvo":false,"evidencia":false,"peso":false,"prontidao":false}'::jsonb;

comment on column rh.rh_sucessao_planos.publicado is
  'Plano disponibilizado aos destinatários em rh_sucessao_publicacao_destinatarios. Desligar corta o acesso na hora.';
comment on column rh.rh_sucessao_planos.publicacao_campos is
  'Quais campos o destinatário vê. Chaves ausentes ou false não são retornadas pela função de leitura. risco_saida e impacto_vacancia nunca são publicáveis.';

-- ---------------------------------------------------------------------------
-- 2. Quem pode ver
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_sucessao_publicacao_destinatarios (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references rh.rh_sucessao_planos(id) on delete cascade,
  funcionario_id uuid not null references rh.rh_funcionarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (plano_id, funcionario_id)
);

create index if not exists idx_rh_sucessao_dest_plano
  on rh.rh_sucessao_publicacao_destinatarios(plano_id);
create index if not exists idx_rh_sucessao_dest_func
  on rh.rh_sucessao_publicacao_destinatarios(funcionario_id);

alter table rh.rh_sucessao_publicacao_destinatarios enable row level security;

drop policy if exists "Admin gerencia destinatarios sucessao"
  on rh.rh_sucessao_publicacao_destinatarios;
create policy "Admin gerencia destinatarios sucessao"
  on rh.rh_sucessao_publicacao_destinatarios
  for all to authenticated
  using (rh_has_role(auth.uid(), 'admin'::rh_app_role))
  with check (rh_has_role(auth.uid(), 'admin'::rh_app_role));

revoke all on rh.rh_sucessao_publicacao_destinatarios from anon;
grant select, insert, update, delete
  on rh.rh_sucessao_publicacao_destinatarios to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Leitura do plano publicado (a única porta do não-admin)
-- ---------------------------------------------------------------------------
-- p_como_funcionario preenchido = modo pré-visualização, exclusivo de admin:
-- devolve exatamente o que aquela pessoa veria, inclusive antes de publicar.
create or replace function public.rh_sucessao_plano_publicado(
  p_plano_id uuid,
  p_como_funcionario uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = rh, public
as $$
declare
  v_func      uuid;
  v_preview   boolean := p_como_funcionario is not null;
  v_plano     rh.rh_sucessao_planos;
  v_campos    jsonb;
  v_cand      rh.rh_sucessao_candidatos;
  v_itens     jsonb;
  v_prontidao int;
begin
  select * into v_plano from rh.rh_sucessao_planos where id = p_plano_id;
  if not found then
    raise exception 'Plano não encontrado';
  end if;

  if v_preview then
    if not public.rh_has_role(auth.uid(), 'admin'::rh_app_role) then
      raise exception 'Somente admin pode pré-visualizar a publicação';
    end if;
    v_func := p_como_funcionario;
  else
    v_func := public.rh_current_funcionario_id();
    if v_func is null then
      raise exception 'Usuário sem funcionário vinculado';
    end if;
    if not v_plano.publicado then
      raise exception 'Plano não está publicado';
    end if;
    if not exists (
      select 1 from rh.rh_sucessao_publicacao_destinatarios d
      where d.plano_id = p_plano_id and d.funcionario_id = v_func
    ) then
      raise exception 'Plano não disponibilizado para este usuário';
    end if;
  end if;

  v_campos := coalesce(v_plano.publicacao_campos, '{}'::jsonb);

  -- A "própria coluna": a linha de candidato do destinatário, se ele for candidato.
  select * into v_cand
  from rh.rh_sucessao_candidatos c
  where c.plano_id = p_plano_id
    and c.funcionario_id = v_func
    and c.situacao <> 'descartado'
  limit 1;

  select coalesce(jsonb_agg(t.obj order by t.ordem), '[]'::jsonb) into v_itens
  from (
    select
      i.ordem,
      (
        jsonb_build_object(
          'id', i.id,
          'categoria', i.categoria,
          'titulo', case when i.categoria = 'atividade'
                         then coalesce(a.nome, '(atividade removida)')
                         else i.titulo end,
          'grupo', case when i.categoria = 'atividade' then g.nome else null end,
          'criterio', coalesce(nullif(btrim(i.criterio_override), ''), a.criterio_proficiencia),
          'plano_treinamento', i.plano_treinamento,
          'peso', i.peso,
          'nivel', av.nivel,
          'data_alvo', av.data_alvo,
          'evidencia', av.evidencia
        )
        -- Remove o que não foi liberado: a chave nem chega ao cliente.
        - (case when coalesce((v_campos->>'grupo')::boolean, false)       then '' else 'grupo' end)
        - (case when coalesce((v_campos->>'criterio')::boolean, false)    then '' else 'criterio' end)
        - (case when coalesce((v_campos->>'treinamento')::boolean, false) then '' else 'plano_treinamento' end)
        - (case when coalesce((v_campos->>'peso')::boolean, false)        then '' else 'peso' end)
        - (case when coalesce((v_campos->>'nivel')::boolean, false)       then '' else 'nivel' end)
        - (case when coalesce((v_campos->>'data_alvo')::boolean, false)   then '' else 'data_alvo' end)
        - (case when coalesce((v_campos->>'evidencia')::boolean, false)   then '' else 'evidencia' end)
      ) as obj
    from rh.rh_sucessao_itens i
    left join rh.rh_atividades_auditoria a on a.id = i.atividade_id
    left join rh.rh_grupos_atividades_auditoria g on g.id = a.grupo_id
    left join rh.rh_sucessao_avaliacoes av
      on av.item_id = i.id and av.candidato_id = v_cand.id
    where i.plano_id = p_plano_id and i.ativo
  ) t;

  if coalesce((v_campos->>'prontidao')::boolean, false) and v_cand.id is not null then
    select case when sum(i.peso) > 0
                then round(100.0 * sum(case when coalesce(av.nivel,0) >= 3 then i.peso else 0 end) / sum(i.peso))
                else 0 end
      into v_prontidao
    from rh.rh_sucessao_itens i
    left join rh.rh_sucessao_avaliacoes av
      on av.item_id = i.id and av.candidato_id = v_cand.id
    where i.plano_id = p_plano_id and i.ativo;
  end if;

  -- Note o que NÃO está aqui: impacto_vacancia, risco_saida, observacoes,
  -- outros candidatos e a prontidão deles.
  return jsonb_build_object(
    'plano', jsonb_build_object(
      'id', v_plano.id,
      'titulo', v_plano.titulo,
      'cargo', (select c.nome from rh.rh_cargos c where c.id = v_plano.cargo_id),
      'titular', (select f.nome_completo from rh.rh_funcionarios f where f.id = v_plano.titular_funcionario_id),
      'publicado', v_plano.publicado,
      'publicado_em', v_plano.publicado_em
    ),
    'campos', v_campos,
    'eu', jsonb_build_object(
      'funcionario_id', v_func,
      'nome', (select f.nome_completo from rh.rh_funcionarios f where f.id = v_func),
      'e_candidato', v_cand.id is not null,
      'e_titular', v_plano.titular_funcionario_id = v_func
    ),
    'prontidao', v_prontidao,
    'preview', v_preview,
    'itens', v_itens
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Lista dos planos publicados para mim
-- ---------------------------------------------------------------------------
create or replace function public.rh_sucessao_meus_planos_publicados()
returns table (
  plano_id uuid,
  titulo text,
  cargo text,
  titular text,
  publicado_em timestamptz
)
language sql
stable
security definer
set search_path = rh, public
as $$
  select p.id, p.titulo,
         (select c.nome from rh.rh_cargos c where c.id = p.cargo_id),
         (select f.nome_completo from rh.rh_funcionarios f where f.id = p.titular_funcionario_id),
         p.publicado_em
  from rh.rh_sucessao_planos p
  join rh.rh_sucessao_publicacao_destinatarios d on d.plano_id = p.id
  where p.publicado
    and d.funcionario_id = public.rh_current_funcionario_id()
  order by p.publicado_em desc nulls last;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants — nada para anon
-- ---------------------------------------------------------------------------
revoke execute on function public.rh_sucessao_plano_publicado(uuid, uuid) from public;
revoke execute on function public.rh_sucessao_plano_publicado(uuid, uuid) from anon;
grant  execute on function public.rh_sucessao_plano_publicado(uuid, uuid) to authenticated;

revoke execute on function public.rh_sucessao_meus_planos_publicados() from public;
revoke execute on function public.rh_sucessao_meus_planos_publicados() from anon;
grant  execute on function public.rh_sucessao_meus_planos_publicados() to authenticated;
