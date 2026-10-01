-- Mapa de sucessão: cobertura por POSIÇÃO (função + equipe), com série histórica
--
-- Posição = função + equipe com pelo menos um funcionário ativo. Não é
-- cadastrada: nasce e some com o quadro. Ex.: 4 Assistentes Administrativos em
-- 4 equipes são 4 posições; 6 Consultores Comerciais no Comercial são 1.
--
-- Mapeamento simplificado (decisões de 01/10/2026):
--   - sucessores INTERNOS indicados por posição, com cobertura total ou parcial
--     (rh_mapa_sucessores);
--   - EXTERNOS vêm do Talents: mapeamento ativo da função (da mesma equipe ou
--     "qualquer equipe") no nível Forte — ou marcado como alternativa externa —
--     conta como parcial. "Interessante" aparece, mas não conta;
--   - cobertura da posição: total se há interno total; parcial se há interno
--     parcial ou externo; senão descoberta.
--
-- Visibilidade: o mapa é visto por admin e coordenador; só admin edita. Os
-- planos de sucessão completos seguem só de admin e NÃO entram na cobertura
-- daqui — se entrassem, a cor da posição revelaria a um coordenador o que há nos
-- planos. Pelo mesmo motivo, o marcador de alternativa externa só sai para admin.
--
-- Série histórica: foto diária por posição (rh_mapa_cobertura_historico), às
-- 23h55 de Brasília, via pg_cron. Os indicadores são calculados sobre a foto.

-- ---------------------------------------------------------------------------
-- 0. Cadastros que deixavam gente fora do mapa (sem cargo)
-- ---------------------------------------------------------------------------
-- Augusto: Coordenador de Novos Negócios. Gabrielle: Estágio Administrativo —
-- no cadastro atual (Financeiro, admitida em 03/08/2026); o anterior está
-- desligado. Só preenche quem está sem cargo.
update rh.rh_funcionarios fu
   set cargo_id = (select c.id from rh.rh_cargos c join rh.rh_funcoes f on f.id = c.funcao_id
                    where f.nome = 'Coordenador de Novos Negócios' order by c.nivel limit 1)
 where fu.nome_completo = 'AUGUSTO DE OLIVEIRA MESSAGI' and fu.cargo_id is null;

update rh.rh_funcionarios fu
   set cargo_id = (select c.id from rh.rh_cargos c join rh.rh_funcoes f on f.id = c.funcao_id
                    where f.nome = 'Estágio Administrativo' order by c.nivel limit 1)
 where fu.nome_completo = 'GABRIELLE DIEDRICH DE SOUZA' and fu.cargo_id is null
   and fu.equipe_id = (select id from rh.rh_equipes where nome = 'Financeiro');

-- ---------------------------------------------------------------------------
-- 1. Sucessores internos indicados
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_mapa_sucessores (
  id uuid primary key default gen_random_uuid(),
  funcao_id uuid not null references rh.rh_funcoes(id) on delete cascade,
  equipe_id uuid not null references rh.rh_equipes(id) on delete cascade,
  funcionario_id uuid not null references rh.rh_funcionarios(id) on delete cascade,
  cobertura text not null check (cobertura in ('total', 'parcial')),
  observacoes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funcao_id, equipe_id, funcionario_id)
);

comment on table rh.rh_mapa_sucessores is
  'Mapeamento de sucessão simplificado: funcionário indicado para cobrir uma posição (função + equipe), total ou parcialmente. Visto por admin e coordenador; editado por admin.';

drop trigger if exists trg_rh_mapa_sucessores_updated on rh.rh_mapa_sucessores;
create trigger trg_rh_mapa_sucessores_updated before update on rh.rh_mapa_sucessores
  for each row execute function public.rh_update_updated_at();

alter table rh.rh_mapa_sucessores enable row level security;

drop policy if exists "Admin e coordenador leem rh_mapa_sucessores" on rh.rh_mapa_sucessores;
create policy "Admin e coordenador leem rh_mapa_sucessores" on rh.rh_mapa_sucessores
  for select to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role) or public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role));

drop policy if exists "Admin edita rh_mapa_sucessores" on rh.rh_mapa_sucessores;
create policy "Admin edita rh_mapa_sucessores" on rh.rh_mapa_sucessores
  for all to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role))
  with check (public.rh_has_role(auth.uid(), 'admin'::rh_app_role));

revoke all on rh.rh_mapa_sucessores from anon, authenticated;
grant select, insert, update, delete on rh.rh_mapa_sucessores to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cálculo da cobertura (uma regra só: tela e foto diária usam a mesma)
-- ---------------------------------------------------------------------------
-- Interna: sem checagem de papel (o pg_cron roda sem usuário). Não pode ser
-- chamada pela API — execute revogado de todos.
-- "Ativo" segue o mesmo critério do app (useActiveEmployees): o último evento
-- de admissão/desligamento não é desligamento.
create or replace function rh.rh_mapa_cobertura_calc()
returns table (
  funcao_id uuid, funcao text, trilha text, equipe_id uuid, equipe text,
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
    select fu.id, fu.nome_completo, fu.equipe_id, c.funcao_id
      from rh.rh_funcionarios fu
      join rh.rh_cargos c on c.id = fu.cargo_id
      left join ult on ult.funcionario_id = fu.id
     where coalesce(ult.tipo, 'admissao') <> 'desligamento'
       and fu.equipe_id is not null and c.funcao_id is not null
  ), pos as (
    select a.funcao_id, a.equipe_id,
           jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome_completo) order by a.nome_completo) as ocupantes
      from ativos a group by 1, 2
  ), suc as (
    select s.funcao_id, s.equipe_id,
           jsonb_agg(jsonb_build_object(
             'id', s.id, 'funcionario_id', s.funcionario_id, 'nome', fu.nome_completo,
             'cobertura', s.cobertura, 'observacoes', s.observacoes, 'ativo', at.id is not null
           ) order by s.cobertura desc, fu.nome_completo) as lista,
           count(*) filter (where at.id is not null and s.cobertura = 'total')::int as n_total,
           count(*) filter (where at.id is not null and s.cobertura = 'parcial')::int as n_parcial
      from rh.rh_mapa_sucessores s
      join rh.rh_funcionarios fu on fu.id = s.funcionario_id
      left join ativos at on at.id = s.funcionario_id
     group by 1, 2
  ), ext as (
    select p.funcao_id, p.equipe_id,
           jsonb_agg(jsonb_build_object(
             'mapping_id', m.id, 'candidate_id', m.candidate_id, 'nome', tc.full_name,
             'nivel', m.nivel, 'generico', m.equipe_id is null, 'especificacao', m.especificacao,
             'alternativa', x.id is not null,
             'conta', (m.nivel = 'forte' or x.id is not null)
           ) order by (m.nivel = 'forte' or x.id is not null) desc, tc.full_name) as lista,
           count(*) filter (where m.nivel = 'forte' or x.id is not null)::int as n
      from pos p
      join rh.talents_mappings m
        on m.funcao_id = p.funcao_id and (m.equipe_id = p.equipe_id or m.equipe_id is null)
      join rh.talents_candidates tc on tc.id = m.candidate_id and tc.deleted_at is null
      left join rh.rh_sucessao_externos x on x.talents_mapping_id = m.id
     where m.status = 'Ativo'
     group by 1, 2
  )
  select p.funcao_id, f.nome, t.nome, p.equipe_id, e.nome,
         p.ocupantes, coalesce(s.lista, '[]'::jsonb), coalesce(x.lista, '[]'::jsonb),
         coalesce(s.n_total, 0), coalesce(s.n_parcial, 0), coalesce(x.n, 0),
         case when coalesce(s.n_total, 0) > 0 then 'total'
              when coalesce(s.n_parcial, 0) + coalesce(x.n, 0) > 0 then 'parcial'
              else 'descoberta' end
    from pos p
    join rh.rh_funcoes f on f.id = p.funcao_id
    left join rh.rh_trilhas_cargo t on t.id = f.trilha_id
    join rh.rh_equipes e on e.id = p.equipe_id
    left join suc s on s.funcao_id = p.funcao_id and s.equipe_id = p.equipe_id
    left join ext x on x.funcao_id = p.funcao_id and x.equipe_id = p.equipe_id
   order by e.nome, f.nome;
$$;

revoke execute on function rh.rh_mapa_cobertura_calc() from public, anon, authenticated;

-- Pública: admin e coordenador. Para quem não é admin, tira o marcador de
-- alternativa externa (só admin do Pilares sabe quem é alternativa).
create or replace function public.rh_mapa_cobertura()
returns table (
  funcao_id uuid, funcao text, trilha text, equipe_id uuid, equipe text,
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
    select c.funcao_id, c.funcao, c.trilha, c.equipe_id, c.equipe, c.ocupantes, c.sucessores,
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
-- 3. Série histórica
-- ---------------------------------------------------------------------------
-- Uma linha por posição por dia. Sem FK de propósito: a história sobrevive à
-- função ou equipe ser renomeada/apagada (por isso os nomes vão junto).
create table if not exists rh.rh_mapa_cobertura_historico (
  data date not null,
  funcao_id uuid not null,
  equipe_id uuid not null,
  funcao text not null,
  equipe text not null,
  headcount int not null,
  n_total int not null,
  n_parcial int not null,
  n_externos int not null,
  cobertura text not null check (cobertura in ('total', 'parcial', 'descoberta')),
  registrado_em timestamptz not null default now(),
  primary key (data, funcao_id, equipe_id)
);

comment on table rh.rh_mapa_cobertura_historico is
  'Foto diária da cobertura de cada posição (função + equipe). Base da série histórica dos indicadores do mapa de sucessão.';

alter table rh.rh_mapa_cobertura_historico enable row level security;

drop policy if exists "Admin e coordenador leem historico do mapa" on rh.rh_mapa_cobertura_historico;
create policy "Admin e coordenador leem historico do mapa" on rh.rh_mapa_cobertura_historico
  for select to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role) or public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role));

revoke all on rh.rh_mapa_cobertura_historico from anon, authenticated;
grant select on rh.rh_mapa_cobertura_historico to authenticated;

-- Regrava a foto do dia (rodar de novo no mesmo dia substitui).
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
    (data, funcao_id, equipe_id, funcao, equipe, headcount, n_total, n_parcial, n_externos, cobertura)
  select p_data, c.funcao_id, c.equipe_id, c.funcao, c.equipe, jsonb_array_length(c.ocupantes),
         c.n_total, c.n_parcial, c.n_externos, c.cobertura
    from rh.rh_mapa_cobertura_calc() c;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function rh.rh_mapa_registrar_foto(date) from public, anon, authenticated;

-- 23h55 de Brasília = 02h55 UTC.
select cron.unschedule(jobid) from cron.job where jobname = 'rh-mapa-cobertura-diario';
select cron.schedule('rh-mapa-cobertura-diario', '55 2 * * *', $$select rh.rh_mapa_registrar_foto()$$);

-- Primeira foto: a série começa hoje.
select rh.rh_mapa_registrar_foto();
