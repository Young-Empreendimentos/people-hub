-- Funções: o nível acima de cargo + nível
--
-- Em rh_cargos, cada registro é cargo + nível + pacote de remuneração (salário e
-- adicionais) — o Comercial I nível 1 tem três registros, um por pacote. Isso
-- está certo para funcionários e aditivos, que são pagos num pacote específico.
--
-- O que não existia era a FUNÇÃO em si: "Coordenador Administrativo" era só um
-- nome repetido em sete registros, um por nível. Sucessão e Mapeamento pensam em
-- função, não em pacote salarial, então passam a apontar para cá.
--
-- Mudança aditiva: nenhum registro de rh_cargos é renomeado e nenhuma referência
-- existente a rh_cargos (funcionários, aditivos) muda.
--
-- Modelo adotado como oficial: trilha = ÁREA (Administrativo, Comercial,
-- Engenharia…); função = o papel dentro da área; cargo = função + nível + pacote.

-- ---------------------------------------------------------------------------
-- 1. Tabela de funções
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_funcoes (
  id uuid primary key default gen_random_uuid(),
  trilha_id uuid not null references rh.rh_trilhas_cargo(id) on delete restrict,
  nome text not null check (length(btrim(nome)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- alvo da FK composta de rh_cargos, que garante função e cargo na mesma trilha
  constraint uq_rh_funcoes_id_trilha unique (id, trilha_id)
);

create unique index if not exists uq_rh_funcoes_trilha_nome
  on rh.rh_funcoes (trilha_id, lower(btrim(nome)));

comment on table rh.rh_funcoes is
  'Função (papel) dentro de uma trilha/área, independente de nível e de pacote salarial. Ex.: Coordenador Administrativo, na trilha Administrativo.';

drop trigger if exists trg_rh_funcoes_updated on rh.rh_funcoes;
create trigger trg_rh_funcoes_updated before update on rh.rh_funcoes
  for each row execute function public.rh_update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Preenche a partir dos nomes distintos do catálogo
-- ---------------------------------------------------------------------------
-- Comercial I a VII são níveis de uma só função: o nível está repetido no nome e
-- na coluna nivel (Comercial II = nível 2). Viram a função "Comercial".
insert into rh.rh_funcoes (trilha_id, nome)
select distinct c.trilha_id,
       case when t.nome = 'Comercial' and btrim(c.nome) ~ '^Comercial [IVX]+$'
            then 'Comercial'
            else btrim(c.nome) end
from rh.rh_cargos c
join rh.rh_trilhas_cargo t on t.id = c.trilha_id;

-- ---------------------------------------------------------------------------
-- 3. Cada cargo aponta para a sua função
-- ---------------------------------------------------------------------------
alter table rh.rh_cargos add column if not exists funcao_id uuid;

update rh.rh_cargos c
set funcao_id = f.id
from rh.rh_trilhas_cargo t, rh.rh_funcoes f
where t.id = c.trilha_id
  and f.trilha_id = c.trilha_id
  and lower(btrim(f.nome)) = lower(btrim(
        case when t.nome = 'Comercial' and btrim(c.nome) ~ '^Comercial [IVX]+$'
             then 'Comercial' else c.nome end));

alter table rh.rh_cargos alter column funcao_id set not null;

-- FK composta: a função do cargo tem de ser da mesma trilha do cargo.
alter table rh.rh_cargos
  drop constraint if exists fk_rh_cargos_funcao_trilha;
alter table rh.rh_cargos
  add constraint fk_rh_cargos_funcao_trilha
  foreign key (funcao_id, trilha_id) references rh.rh_funcoes (id, trilha_id)
  on delete restrict;

create index if not exists idx_rh_cargos_funcao on rh.rh_cargos(funcao_id);

-- ---------------------------------------------------------------------------
-- 4. Rede de segurança para quem grava sem informar a função
-- ---------------------------------------------------------------------------
-- A tela de Cargos nova informa a função. Esta rede cobre quem não informa — a
-- versão antiga da tela durante o deploy, ou um insert manual: acha a função da
-- mesma trilha com o mesmo nome, ou cria uma. Roda com os privilégios de quem
-- grava, que já precisa poder criar cargo (admin/coordenador) — os mesmos que
-- podem criar função.
create or replace function rh.rh_cargos_garante_funcao()
returns trigger
language plpgsql
set search_path = rh, public
as $$
begin
  if new.funcao_id is null then
    select f.id into new.funcao_id
    from rh.rh_funcoes f
    where f.trilha_id = new.trilha_id
      and lower(btrim(f.nome)) = lower(btrim(new.nome));

    if new.funcao_id is null then
      insert into rh.rh_funcoes (trilha_id, nome)
      values (new.trilha_id, btrim(new.nome))
      returning id into new.funcao_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rh_cargos_garante_funcao on rh.rh_cargos;
create trigger trg_rh_cargos_garante_funcao
  before insert or update of funcao_id on rh.rh_cargos
  for each row execute function rh.rh_cargos_garante_funcao();

revoke execute on function rh.rh_cargos_garante_funcao() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS e grants — mesmo desenho de rh_cargos
-- ---------------------------------------------------------------------------
alter table rh.rh_funcoes enable row level security;

drop policy if exists rh_funcoes_select_staff on rh.rh_funcoes;
create policy rh_funcoes_select_staff on rh.rh_funcoes
  for select to authenticated using (public.rh_is_staff());

drop policy if exists rh_funcoes_insert_admin_coord on rh.rh_funcoes;
create policy rh_funcoes_insert_admin_coord on rh.rh_funcoes
  for insert to authenticated
  with check (public.rh_has_role(auth.uid(), 'admin'::rh_app_role)
           or public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role));

drop policy if exists rh_funcoes_update_admin_coord on rh.rh_funcoes;
create policy rh_funcoes_update_admin_coord on rh.rh_funcoes
  for update to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role)
      or public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role));

drop policy if exists rh_funcoes_delete_admin_coord on rh.rh_funcoes;
create policy rh_funcoes_delete_admin_coord on rh.rh_funcoes
  for delete to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role)
      or public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role));

revoke all on rh.rh_funcoes from anon, authenticated;
grant select, insert, update, delete on rh.rh_funcoes to authenticated;
