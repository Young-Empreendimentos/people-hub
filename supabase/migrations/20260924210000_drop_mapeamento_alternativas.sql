-- Remove o Mapeamento de Alternativas antigo
--
-- Os candidatos externos passaram a viver no plano de sucessão da função
-- (rh.rh_sucessao_externos, migration 20260924200000), e a tela antiga saiu do
-- front. Conferido antes: as duas tabelas estavam vazias e nada fora do próprio
-- módulo dependia delas (nenhuma view, nenhuma função além das de aprovação).

drop function if exists public.rh_aprovar_alternativa(uuid);
drop function if exists public.rh_revogar_alternativa(uuid);

drop table if exists rh.rh_mapeamento_alternativas;  -- leva o trigger de aprovação
drop table if exists rh.rh_mapeamento_cargos;

drop function if exists public.rh_mapeamento_alt_approval_guard();
