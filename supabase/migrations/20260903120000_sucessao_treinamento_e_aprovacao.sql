-- Ajustes nos planos de sucessão
--
-- 1. Plano de treinamento por item: o que será feito para deixar a pessoa apta.
--    Fica no item (linha da matriz), não na célula, porque o roteiro de
--    capacitação é da atividade — vale para qualquer candidato do plano.
--
-- 2. Aprovação com validade em vez de "próxima revisão" digitada à mão.
--    Grava-se a data em que o plano foi aprovado/revisado e o vencimento é
--    derivado (6 meses). Uma data de aprovação é um fato; uma data futura
--    digitada à mão envelhece e vira alarme falso.

-- ---------------------------------------------------------------------------
-- 1. Plano de treinamento (por item)
-- ---------------------------------------------------------------------------
alter table rh.rh_sucessao_itens
  add column if not exists plano_treinamento text;

comment on column rh.rh_sucessao_itens.plano_treinamento is
  'O que será feito para deixar a pessoa apta neste item: ação, data e local. Ex.: "Levantar uma área e fornecer um planialtimétrico em 10/2026, no loteamento X." Diferente do critério, que é a régua de aptidão — este é o caminho até ela.';

-- ---------------------------------------------------------------------------
-- 2. Data da aprovação/revisão do plano
-- ---------------------------------------------------------------------------
alter table rh.rh_sucessao_planos
  add column if not exists data_aprovacao date;

comment on column rh.rh_sucessao_planos.data_aprovacao is
  'Quando o plano foi aprovado/revisado. A aprovação vence após MESES_VALIDADE_APROVACAO (6, em src/lib/sucessao.ts), quando o plano precisa ser reavaliado. Nulo = nunca aprovado formalmente.';

-- ---------------------------------------------------------------------------
-- 3. Aposenta a "previsão de conclusão"
-- ---------------------------------------------------------------------------
-- A frase foi escrita pela importação das planilhas; o dado original segue nelas.
update rh.rh_sucessao_planos
set observacoes = nullif(
      btrim(regexp_replace(observacoes, '\s*Previsão de conclusão:[^.]*\.', '', 'g')),
      '')
where observacoes like '%Previsão de conclusão%';

-- Zera as datas importadas (eram previsão de conclusão, não aprovação).
update rh.rh_sucessao_planos
set data_proxima_revisao = null
where data_proxima_revisao is not null;

-- NÃO removemos data_proxima_revisao aqui, de propósito: enquanto o bundle
-- antigo estiver em produção ele ainda envia essa coluna no insert de plano, e
-- dropá-la agora quebraria a criação de planos até o deploy do frontend novo.
-- A remoção fica para uma migration seguinte, depois que este código estiver no ar
-- (expand/contract). A coluna fica nula e sem uso no código novo.
