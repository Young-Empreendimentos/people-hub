-- Mapeamento de Alternativas e Sucessão passam a ser por FUNÇÃO
--
-- Os dois apontavam para um registro de rh_cargos, que é cargo + nível + pacote
-- salarial. Um plano de sucessão para "Coordenador Administrativo nível 5"
-- deixava os outros níveis da mesma função como "sem plano"; e o mapeamento
-- listava cada cargo repetido em até sete níveis. Agora apontam para rh_funcoes.
--
-- Expand/contract: cargo_id fica anulável e é derivado em função por gatilho,
-- porque a versão antiga das telas ainda grava cargo_id durante o deploy. A
-- coluna antiga sai numa migration seguinte, depois que o frontend novo estiver
-- no ar.

-- ---------------------------------------------------------------------------
-- 1. Derivação cargo -> função (para quem ainda grava cargo_id)
-- ---------------------------------------------------------------------------
create or replace function rh.rh_deriva_funcao_do_cargo()
returns trigger
language plpgsql
set search_path = rh, public
as $$
begin
  if new.funcao_id is null and new.cargo_id is not null then
    select c.funcao_id into new.funcao_id from rh.rh_cargos c where c.id = new.cargo_id;
  end if;
  return new;
end;
$$;

revoke execute on function rh.rh_deriva_funcao_do_cargo() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Mapeamento de Alternativas (tabela vazia: nada a migrar)
-- ---------------------------------------------------------------------------
alter table rh.rh_mapeamento_cargos
  add column if not exists funcao_id uuid references rh.rh_funcoes(id) on delete cascade;

alter table rh.rh_mapeamento_cargos alter column cargo_id drop not null;
alter table rh.rh_mapeamento_cargos drop constraint if exists rh_mapeamento_cargos_cargo_id_key;

drop trigger if exists trg_rh_map_cargos_deriva_funcao on rh.rh_mapeamento_cargos;
create trigger trg_rh_map_cargos_deriva_funcao
  before insert or update of cargo_id, funcao_id on rh.rh_mapeamento_cargos
  for each row execute function rh.rh_deriva_funcao_do_cargo();

alter table rh.rh_mapeamento_cargos alter column funcao_id set not null;

-- Uma função só entra uma vez no mapeamento.
create unique index if not exists uq_rh_mapeamento_cargos_funcao
  on rh.rh_mapeamento_cargos(funcao_id);

-- ---------------------------------------------------------------------------
-- 3. Planos de sucessão
-- ---------------------------------------------------------------------------
alter table rh.rh_sucessao_planos
  add column if not exists funcao_id uuid references rh.rh_funcoes(id) on delete restrict;

update rh.rh_sucessao_planos p
set funcao_id = c.funcao_id
from rh.rh_cargos c
where c.id = p.cargo_id and p.funcao_id is null;

alter table rh.rh_sucessao_planos alter column cargo_id drop not null;

drop trigger if exists trg_rh_sucessao_planos_deriva_funcao on rh.rh_sucessao_planos;
create trigger trg_rh_sucessao_planos_deriva_funcao
  before insert or update of cargo_id, funcao_id on rh.rh_sucessao_planos
  for each row execute function rh.rh_deriva_funcao_do_cargo();

alter table rh.rh_sucessao_planos alter column funcao_id set not null;

create index if not exists idx_rh_sucessao_planos_funcao on rh.rh_sucessao_planos(funcao_id);

-- ---------------------------------------------------------------------------
-- 4. As funções da sucessão publicada devolvem o nome da FUNÇÃO
-- ---------------------------------------------------------------------------
-- Troca cirúrgica: cada função tem uma única ocorrência de cargo_id, na busca
-- do nome. Se o trecho não estiver lá (o corpo mudou por outro caminho), a
-- migration falha em vez de passar sem efeito.
do $$
declare
  v_def text;
  v_de  text;
  v_para text;
begin
  -- rh_sucessao_plano_publicado
  v_def  := pg_get_functiondef('public.rh_sucessao_plano_publicado(uuid, uuid)'::regprocedure);
  v_de   := '(select c.nome from rh.rh_cargos c where c.id = v_plano.cargo_id)';
  v_para := '(select f.nome from rh.rh_funcoes f where f.id = v_plano.funcao_id)';
  if position(v_de in v_def) = 0 then
    raise exception 'rh_sucessao_plano_publicado: trecho esperado não encontrado';
  end if;
  execute replace(v_def, v_de, v_para);

  -- rh_sucessao_meus_planos_publicados
  v_def  := pg_get_functiondef('public.rh_sucessao_meus_planos_publicados()'::regprocedure);
  v_de   := '(select c.nome from rh.rh_cargos c where c.id = p.cargo_id)';
  v_para := '(select f.nome from rh.rh_funcoes f where f.id = p.funcao_id)';
  if position(v_de in v_def) = 0 then
    raise exception 'rh_sucessao_meus_planos_publicados: trecho esperado não encontrado';
  end if;
  execute replace(v_def, v_de, v_para);
end $$;
