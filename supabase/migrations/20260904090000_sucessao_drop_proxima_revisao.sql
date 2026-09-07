-- Fecha o expand/contract iniciado em 20260903120000.
--
-- A coluna foi substituída por data_aprovacao (aprovação com validade de 6
-- meses). O drop ficou para esta migration porque, enquanto o bundle antigo
-- estava em produção, ele ainda enviava data_proxima_revisao no insert de
-- plano — removê-la antes do deploy quebraria a criação de planos.
--
-- Pré-requisito, já satisfeito: o frontend que não referencia mais a coluna
-- está publicado. Os valores tinham sido zerados na migration anterior.

alter table rh.rh_sucessao_planos
  drop column if exists data_proxima_revisao;
