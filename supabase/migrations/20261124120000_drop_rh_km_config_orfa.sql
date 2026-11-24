-- rh_km_config (linha-única: retroativo_ate) controlava a liberação manual de
-- lançamento retroativo de KM. Com o Meus KMs aceitando qualquer data passada e a
-- importação puxando todo aprovado não-lançado, a tabela ficou órfã: sem referências
-- no front, sem FK, sem função, sem view de compat. Removendo.
drop table if exists rh.rh_km_config;
