-- Mapa de sucessão v2: posição = função + equipe + CIDADE, configurável pelo admin
--
-- Antes a posição era função + equipe, e 6 Consultores Comerciais em 4 cidades
-- viravam uma posição só — um sucessor em Bagé "cobria" Cruz Alta. Agora a
-- cidade de atuação (rh_funcionarios.cidade_ibge) entra na posição.
--
-- Configuração do admin (decisões de 01/10/2026):
--   rh_mapa_individuais      pessoa que exige mapeamento PRÓPRIO: sai da posição
--                            compartilhada e vira uma posição só dela;
--   rh_mapa_exclusoes        posição que NÃO exige mapeamento: sai do mapa e do
--                            índice (por padrão todas exigem);
--   rh_mapa_posicoes_manuais posição sem ocupante (vaga), incluída à mão; entra
--                            no índice, marcada como vaga.
--
-- Externos do Talents: contam se função bate, equipe bate (ou vazia) e cidade
-- bate (ou vazia = qualquer cidade). Interessante continua sem contar.

-- ---------------------------------------------------------------------------
-- 1. Configuração (só admin)
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_mapa_individuais (
  funcionario_id uuid primary key references rh.rh_funcionarios(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists rh.rh_mapa_exclusoes (
  id uuid primary key default gen_random_uuid(),
  funcao_id uuid not null references rh.rh_funcoes(id) on delete cascade,
  equipe_id uuid not null references rh.rh_equipes(id) on delete cascade,
  cidade_ibge integer references rh.rh_municipios(codigo_ibge),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_rh_mapa_exclusoes
  on rh.rh_mapa_exclusoes (funcao_id, equipe_id, coalesce(cidade_ibge, 0));

create table if not exists rh.rh_mapa_posicoes_manuais (
  id uuid primary key default gen_random_uuid(),
  funcao_id uuid not null references rh.rh_funcoes(id) on delete cascade,
  equipe_id uuid not null references rh.rh_equipes(id) on delete cascade,
  cidade_ibge integer references rh.rh_municipios(codigo_ibge),
  observacoes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_rh_mapa_posicoes_manuais
  on rh.rh_mapa_posicoes_manuais (funcao_id, equipe_id, coalesce(cidade_ibge, 0));

comment on table rh.rh_mapa_individuais is 'Funcionário que exige mapeamento próprio no mapa de sucessão (posição individual).';
comment on table rh.rh_mapa_exclusoes is 'Posição (função + equipe + cidade) que não exige mapeamento: fora do mapa e do índice.';
comment on table rh.rh_mapa_posicoes_manuais is 'Posição sem ocupante incluída à mão no mapa de sucessão (vaga).';

do $$
declare t text;
begin
  foreach t in array array['rh_mapa_individuais', 'rh_mapa_exclusoes', 'rh_mapa_posicoes_manuais'] loop
    execute format('alter table rh.%I enable row level security', t);
    execute format('drop policy if exists "Admin gerencia %s" on rh.%I', t, t);
    execute format('create policy "Admin gerencia %s" on rh.%I for all to authenticated
                    using (public.rh_has_role(auth.uid(), ''admin''::rh_app_role))
                    with check (public.rh_has_role(auth.uid(), ''admin''::rh_app_role))', t, t);
    execute format('revoke all on rh.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on rh.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Sucessores passam a apontar para a posição completa
-- ---------------------------------------------------------------------------
alter table rh.rh_mapa_sucessores
  add column if not exists cidade_ibge integer references rh.rh_municipios(codigo_ibge),
  add column if not exists titular_funcionario_id uuid references rh.rh_funcionarios(id) on delete cascade;

comment on column rh.rh_mapa_sucessores.titular_funcionario_id is
  'Preenchido quando a posição é individual (rh_mapa_individuais): o sucessor é desta pessoa.';

alter table rh.rh_mapa_sucessores drop constraint if exists rh_mapa_sucessores_funcao_id_equipe_id_funcionario_id_key;
create unique index if not exists uq_rh_mapa_sucessores_posicao on rh.rh_mapa_sucessores (
  funcao_id, equipe_id, coalesce(cidade_ibge, 0),
  coalesce(titular_funcionario_id, '00000000-0000-0000-0000-000000000000'::uuid), funcionario_id
);

-- ---------------------------------------------------------------------------
-- 2b. Indicação por coordenador, aprovação do admin (6 meses)
-- ---------------------------------------------------------------------------
-- Coordenador indica; a indicação nasce pendente e só conta no indicador
-- depois de aprovada por admin, enquanto a aprovação estiver na validade (6
-- meses, mesma régua das demais aprovações da sucessão). Indicação feita por
-- admin já nasce aprovada — é a mesma pessoa que aprovaria.
alter table rh.rh_mapa_sucessores
  add column if not exists indicado_por_nome text,
  add column if not exists aprovado_em timestamptz,
  add column if not exists aprovado_por uuid references auth.users(id) on delete set null,
  add column if not exists aprovado_por_nome text;

create or replace function rh.rh_mapa_sucessores_ao_indicar()
returns trigger
language plpgsql
security definer
set search_path = rh, public
as $$
declare v_nome text;
begin
  select nome into v_nome from rh.rh_user_roles where user_id = auth.uid() and nome is not null limit 1;
  new.created_by := auth.uid();
  new.indicado_por_nome := v_nome;
  if public.rh_has_role(auth.uid(), 'admin'::rh_app_role) then
    new.aprovado_em := now(); new.aprovado_por := auth.uid(); new.aprovado_por_nome := v_nome;
  else
    new.aprovado_em := null; new.aprovado_por := null; new.aprovado_por_nome := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rh_mapa_sucessores_ao_indicar on rh.rh_mapa_sucessores;
create trigger trg_rh_mapa_sucessores_ao_indicar before insert on rh.rh_mapa_sucessores
  for each row execute function rh.rh_mapa_sucessores_ao_indicar();

-- Coordenador: indica e retira a própria indicação enquanto pendente. Não
-- edita nem aprova (admin segue com a política "Admin edita").
drop policy if exists "Coordenador indica sucessor" on rh.rh_mapa_sucessores;
create policy "Coordenador indica sucessor" on rh.rh_mapa_sucessores
  for insert to authenticated
  with check (public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role));

drop policy if exists "Coordenador retira indicacao pendente" on rh.rh_mapa_sucessores;
create policy "Coordenador retira indicacao pendente" on rh.rh_mapa_sucessores
  for delete to authenticated
  using (public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
         and created_by = auth.uid() and aprovado_em is null);

-- Aprovar e revalidar: o banco carimba data e autor.
create or replace function public.rh_mapa_aprovar_sucessor(p_id uuid)
returns void
language plpgsql
security definer
set search_path = rh, public
as $$
declare v_nome text;
begin
  if not public.rh_has_role(auth.uid(), 'admin'::rh_app_role) then
    raise exception 'Somente administradores podem aprovar.';
  end if;
  select nome into v_nome from rh.rh_user_roles where user_id = auth.uid() and nome is not null limit 1;
  update rh.rh_mapa_sucessores
     set aprovado_em = now(), aprovado_por = auth.uid(), aprovado_por_nome = v_nome
   where id = p_id;
end;
$$;

revoke execute on function public.rh_mapa_aprovar_sucessor(uuid) from public, anon;
grant  execute on function public.rh_mapa_aprovar_sucessor(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cálculo (o tipo de retorno muda: recria)
-- ---------------------------------------------------------------------------
drop function if exists public.rh_mapa_cobertura();
drop function if exists rh.rh_mapa_cobertura_calc();

create function rh.rh_mapa_cobertura_calc()
returns table (
  posicao text, funcao_id uuid, funcao text, trilha text, equipe_id uuid, equipe text,
  cidade_ibge integer, cidade text, titular_id uuid, titular text, vaga boolean, exige boolean,
  ocupantes jsonb, sucessores jsonb, externos jsonb,
  n_total int, n_parcial int, n_externos int, cobertura text
)
language sql
stable
security definer
set search_path = rh, public
as $$
  with ult as (
    select distinct on (a.funcionario_id) a.funcionario_id, a.tipo
      from rh.rh_admissoes_desligamentos a
     order by a.funcionario_id, a.data desc
  ), ativos as (
    select fu.id, fu.nome_completo, fu.equipe_id, c.funcao_id, fu.cidade_ibge,
           (i.funcionario_id is not null) as individual
      from rh.rh_funcionarios fu
      join rh.rh_cargos c on c.id = fu.cargo_id
      left join ult on ult.funcionario_id = fu.id
      left join rh.rh_mapa_individuais i on i.funcionario_id = fu.id
     where coalesce(ult.tipo, 'admissao') <> 'desligamento'
       and fu.equipe_id is not null and c.funcao_id is not null
  ), ocup as (
    select a.funcao_id, a.equipe_id, a.cidade_ibge,
           case when a.individual then a.id end as titular_id,
           jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome_completo, 'individual', a.individual)
                     order by a.nome_completo) as ocupantes,
           false as vaga
      from ativos a group by 1, 2, 3, 4
  ), manuais as (
    select m.funcao_id, m.equipe_id, m.cidade_ibge, null::uuid as titular_id,
           '[]'::jsonb as ocupantes, true as vaga
      from rh.rh_mapa_posicoes_manuais m
     where not exists (select 1 from ocup o
                        where o.funcao_id = m.funcao_id and o.equipe_id = m.equipe_id
                          and o.cidade_ibge is not distinct from m.cidade_ibge and o.titular_id is null)
  ), pos as (
    select * from ocup union all select * from manuais
  ), ativos_ids as (
    select id from ativos
  ), suc0 as (
    -- Conta só quem está ativo E tem aprovação válida (6 meses).
    select s.*, fu.nome_completo, ai.id is not null as ativo,
           case when s.aprovado_em is null then 'pendente'
                when s.aprovado_em + interval '6 months' < now() then 'vencida'
                else 'aprovada' end as aprovacao
      from rh.rh_mapa_sucessores s
      join rh.rh_funcionarios fu on fu.id = s.funcionario_id
      left join ativos_ids ai on ai.id = s.funcionario_id
  ), suc as (
    select s.funcao_id, s.equipe_id, s.cidade_ibge, s.titular_funcionario_id,
           jsonb_agg(jsonb_build_object(
             'id', s.id, 'funcionario_id', s.funcionario_id, 'nome', s.nome_completo,
             'cobertura', s.cobertura, 'observacoes', s.observacoes, 'ativo', s.ativo,
             'aprovacao', s.aprovacao, 'aprovado_em', s.aprovado_em, 'aprovado_por_nome', s.aprovado_por_nome,
             'indicado_por_nome', s.indicado_por_nome, 'indicado_por', s.created_by,
             'conta', s.ativo and s.aprovacao = 'aprovada'
           ) order by s.cobertura desc, s.nome_completo) as lista,
           count(*) filter (where s.ativo and s.aprovacao = 'aprovada' and s.cobertura = 'total')::int as n_total,
           count(*) filter (where s.ativo and s.aprovacao = 'aprovada' and s.cobertura = 'parcial')::int as n_parcial
      from suc0 s
     group by 1, 2, 3, 4
  ), ext as (
    select p.funcao_id, p.equipe_id, p.cidade_ibge, p.titular_id,
           jsonb_agg(jsonb_build_object(
             'mapping_id', m.id, 'candidate_id', m.candidate_id, 'nome', tc.full_name,
             'nivel', m.nivel, 'generico', m.equipe_id is null, 'qualquer_cidade', m.cidade_ibge is null,
             'especificacao', m.especificacao,
             'alternativa', x.id is not null,
             'conta', (m.nivel = 'forte' or x.id is not null)
           ) order by (m.nivel = 'forte' or x.id is not null) desc, tc.full_name) as lista,
           count(*) filter (where m.nivel = 'forte' or x.id is not null)::int as n
      from pos p
      join rh.talents_mappings m
        on m.funcao_id = p.funcao_id
       and (m.equipe_id = p.equipe_id or m.equipe_id is null)
       and (m.cidade_ibge = p.cidade_ibge or m.cidade_ibge is null)
      join rh.talents_candidates tc on tc.id = m.candidate_id and tc.deleted_at is null
      left join rh.rh_sucessao_externos x on x.talents_mapping_id = m.id
     where m.status = 'Ativo'
     group by 1, 2, 3, 4
  )
  select p.funcao_id::text || '|' || p.equipe_id::text || '|' || coalesce(p.cidade_ibge::text, '') || '|' || coalesce(p.titular_id::text, ''),
         p.funcao_id, f.nome, t.nome, p.equipe_id, e.nome,
         p.cidade_ibge, case when mu.codigo_ibge is not null then mu.nome || '/' || mu.uf end,
         p.titular_id, tf.nome_completo, p.vaga,
         not exists (select 1 from rh.rh_mapa_exclusoes xe
                      where xe.funcao_id = p.funcao_id and xe.equipe_id = p.equipe_id
                        and xe.cidade_ibge is not distinct from p.cidade_ibge),
         p.ocupantes, coalesce(s.lista, '[]'::jsonb), coalesce(x.lista, '[]'::jsonb),
         coalesce(s.n_total, 0), coalesce(s.n_parcial, 0), coalesce(x.n, 0),
         case when coalesce(s.n_total, 0) > 0 then 'total'
              when coalesce(s.n_parcial, 0) + coalesce(x.n, 0) > 0 then 'parcial'
              else 'descoberta' end
    from pos p
    join rh.rh_funcoes f on f.id = p.funcao_id
    left join rh.rh_trilhas_cargo t on t.id = f.trilha_id
    join rh.rh_equipes e on e.id = p.equipe_id
    left join rh.rh_municipios mu on mu.codigo_ibge = p.cidade_ibge
    left join rh.rh_funcionarios tf on tf.id = p.titular_id
    left join suc s on s.funcao_id = p.funcao_id and s.equipe_id = p.equipe_id
                   and s.cidade_ibge is not distinct from p.cidade_ibge
                   and s.titular_funcionario_id is not distinct from p.titular_id
    left join ext x on x.funcao_id = p.funcao_id and x.equipe_id = p.equipe_id
                   and x.cidade_ibge is not distinct from p.cidade_ibge
                   and x.titular_id is not distinct from p.titular_id
   order by e.nome, f.nome, mu.nome nulls first, tf.nome_completo nulls first;
$$;

revoke execute on function rh.rh_mapa_cobertura_calc() from public, anon, authenticated;

create function public.rh_mapa_cobertura()
returns table (
  posicao text, funcao_id uuid, funcao text, trilha text, equipe_id uuid, equipe text,
  cidade_ibge integer, cidade text, titular_id uuid, titular text, vaga boolean, exige boolean,
  ocupantes jsonb, sucessores jsonb, externos jsonb,
  n_total int, n_parcial int, n_externos int, cobertura text
)
language plpgsql
stable
security definer
set search_path = rh, public
as $$
declare v_admin boolean := public.rh_has_role(auth.uid(), 'admin'::rh_app_role);
begin
  if not (v_admin or public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role)) then
    raise exception 'Sem acesso ao mapa de sucessão.';
  end if;
  return query
    select c.posicao, c.funcao_id, c.funcao, c.trilha, c.equipe_id, c.equipe,
           c.cidade_ibge, c.cidade, c.titular_id, c.titular, c.vaga, c.exige,
           c.ocupantes, c.sucessores,
           case when v_admin then c.externos
                else coalesce((select jsonb_agg(el - 'alternativa') from jsonb_array_elements(c.externos) el), '[]'::jsonb)
           end,
           c.n_total, c.n_parcial, c.n_externos, c.cobertura
      from rh.rh_mapa_cobertura_calc() c;
end;
$$;

revoke execute on function public.rh_mapa_cobertura() from public, anon;
grant  execute on function public.rh_mapa_cobertura() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Histórico: chave por posição completa; só posições que exigem mapeamento
-- ---------------------------------------------------------------------------
alter table rh.rh_mapa_cobertura_historico
  add column if not exists posicao text,
  add column if not exists cidade_ibge integer,
  add column if not exists cidade text,
  add column if not exists titular_funcionario_id uuid,
  add column if not exists titular text,
  add column if not exists vaga boolean not null default false;

update rh.rh_mapa_cobertura_historico
   set posicao = funcao_id::text || '|' || equipe_id::text || '||'
 where posicao is null;

alter table rh.rh_mapa_cobertura_historico alter column posicao set not null;
alter table rh.rh_mapa_cobertura_historico drop constraint if exists rh_mapa_cobertura_historico_pkey;
alter table rh.rh_mapa_cobertura_historico add primary key (data, posicao);

create or replace function rh.rh_mapa_registrar_foto(p_data date default (now() at time zone 'America/Sao_Paulo')::date)
returns int
language plpgsql
security definer
set search_path = rh, public
as $$
declare v_n int;
begin
  delete from rh.rh_mapa_cobertura_historico where data = p_data;
  insert into rh.rh_mapa_cobertura_historico
    (data, posicao, funcao_id, equipe_id, funcao, equipe, cidade_ibge, cidade,
     titular_funcionario_id, titular, vaga, headcount, n_total, n_parcial, n_externos, cobertura)
  select p_data, c.posicao, c.funcao_id, c.equipe_id, c.funcao, c.equipe, c.cidade_ibge, c.cidade,
         c.titular_id, c.titular, c.vaga, jsonb_array_length(c.ocupantes),
         c.n_total, c.n_parcial, c.n_externos, c.cobertura
    from rh.rh_mapa_cobertura_calc() c
   where c.exige;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function rh.rh_mapa_registrar_foto(date) from public, anon, authenticated;

-- A foto de hoje passa a ser por cidade.
select rh.rh_mapa_registrar_foto();
