-- Funcionário não pode ser cadastrado sem cargo
--
-- Sem cargo, a pessoa some do mapa de sucessão (a posição é função + equipe, e
-- a função vem do cargo) e dos relatórios por cargo. Em 01/10/2026 havia dois
-- ativos nessa situação, corrigidos na migration do mapa.
--
-- A regra vale para cadastro novo e impede APAGAR o cargo de quem já tem. Os 79
-- cadastros antigos sem cargo (quase todos de desligados) continuam editáveis —
-- uma constraint NOT NULL travaria qualquer edição deles.
--
-- Roda depois de rh_funcionarios_block_cargo_change_trg (ordem alfabética), que
-- desfaz troca de cargo feita por quem tem papel "usuario".

create or replace function rh.rh_funcionarios_exige_cargo()
returns trigger
language plpgsql
set search_path = rh, public
as $$
begin
  if new.cargo_id is null and (tg_op = 'INSERT' or old.cargo_id is not null) then
    raise exception 'Informe o cargo do funcionário.' using errcode = '23502';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rh_funcionarios_exige_cargo on rh.rh_funcionarios;
create trigger trg_rh_funcionarios_exige_cargo
  before insert or update of cargo_id on rh.rh_funcionarios
  for each row execute function rh.rh_funcionarios_exige_cargo();
