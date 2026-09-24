-- Alternativas externas passam a fazer parte do plano de sucessão
--
-- O Mapeamento de Alternativas e o Plano de Sucessão respondiam a mesma
-- pergunta — "se o titular sair, quem cobre esta função?" — um olhando para
-- fora, outro para dentro. Viviam em módulos separados e com regras que se
-- contradiziam: o plano era só de admin, mas o mapeamento era visível a todo o
-- staff, então um coordenador via os candidatos externos mapeados para
-- substituí-lo. Agora os externos são parte do plano da função e seguem a regra
-- dele: só admin.
--
-- Externos e internos são avaliados de forma diferente, e por isso ficam em
-- tabelas diferentes: o interno passa pela matriz item × nível (dá para observá-
-- lo fazendo cada atividade); o externo recebe um juízo geral de aderência.
--
-- Cobertura: externo com aprovação válida cobre a função PARCIALMENTE. A regra
-- fica em src/lib/sucessao.ts; aqui só há os dados.
--
-- O Mapeamento estava vazio (0 cargos, 0 alternativas): não há o que migrar.

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_sucessao_externos (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references rh.rh_sucessao_planos(id) on delete cascade,
  origem text not null check (origem in ('manual', 'talents')),
  talents_candidate_id uuid,
  talents_mapping_id uuid,
  nome text not null check (length(btrim(nome)) > 0),
  cargo_atual text,
  observacoes text,
  aderencia text not null default 'possibilidade'
    check (aderencia in ('pleno', 'parcial', 'possibilidade')),
  aprovado_em timestamptz,
  aprovado_por uuid references auth.users(id) on delete set null,
  aprovado_por_nome text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rh_sucessao_externos_plano on rh.rh_sucessao_externos(plano_id);

-- A mesma pessoa do Talents não entra duas vezes no mesmo plano.
create unique index if not exists uq_rh_sucessao_externos_talents
  on rh.rh_sucessao_externos(plano_id, talents_candidate_id)
  where talents_candidate_id is not null;

comment on table rh.rh_sucessao_externos is
  'Candidatos externos (manuais ou vindos do Talents) a uma função, dentro do plano de sucessão dela. Só admin. Com aprovação válida (6 meses), cobrem a função parcialmente.';

drop trigger if exists trg_rh_sucessao_externos_updated on rh.rh_sucessao_externos;
create trigger trg_rh_sucessao_externos_updated before update on rh.rh_sucessao_externos
  for each row execute function public.rh_update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. RLS e grants — igual às demais tabelas de sucessão: só admin
-- ---------------------------------------------------------------------------
alter table rh.rh_sucessao_externos enable row level security;

drop policy if exists "Admin gerencia rh_sucessao_externos" on rh.rh_sucessao_externos;
create policy "Admin gerencia rh_sucessao_externos" on rh.rh_sucessao_externos
  for all to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role))
  with check (public.rh_has_role(auth.uid(), 'admin'::rh_app_role));

revoke all on rh.rh_sucessao_externos from anon, authenticated;
grant select, insert, update, delete on rh.rh_sucessao_externos to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Aprovar (e revalidar): o banco carimba data e autor
-- ---------------------------------------------------------------------------
-- Poderia ser um update direto, já que só admin grava; a função existe para o
-- carimbo não depender do cliente — data e nome de quem aprovou vêm do servidor.
create or replace function public.rh_sucessao_aprovar_externo(p_id uuid)
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
  select nome into v_nome
    from rh.rh_user_roles
   where user_id = auth.uid() and nome is not null
   limit 1;
  update rh.rh_sucessao_externos
     set aprovado_em = now(), aprovado_por = auth.uid(), aprovado_por_nome = v_nome
   where id = p_id;
end;
$$;

revoke execute on function public.rh_sucessao_aprovar_externo(uuid) from public, anon;
grant  execute on function public.rh_sucessao_aprovar_externo(uuid) to authenticated;
