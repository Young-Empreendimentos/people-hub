-- Fecha o expand/contract iniciado em 20260924150000.
--
-- Mapeamento de Alternativas e Sucessão passaram a apontar para rh_funcoes. A
-- coluna cargo_id ficou anulável e derivada em função por gatilho só para a
-- versão antiga das telas continuar funcionando durante o deploy. O frontend que
-- grava funcao_id já está publicado, então cargo_id e a derivação saem.

drop trigger if exists trg_rh_map_cargos_deriva_funcao on rh.rh_mapeamento_cargos;
drop trigger if exists trg_rh_sucessao_planos_deriva_funcao on rh.rh_sucessao_planos;
drop function if exists rh.rh_deriva_funcao_do_cargo();

alter table rh.rh_mapeamento_cargos drop column if exists cargo_id;

drop index if exists rh.idx_rh_sucessao_planos_cargo;
alter table rh.rh_sucessao_planos drop column if exists cargo_id;
