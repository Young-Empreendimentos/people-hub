-- O formulário de admissão/funcionário oferece "Temporário", mas o check
-- constraint não incluía esse valor, quebrando a admissão de vaga temporária
-- (erro: new row violates check constraint "rh_funcionarios_tipo_contrato_check").
-- Alinha o banco com as opções da tela (CLT, PJ, Temporário, Estágio,
-- Menor aprendiz, S/ DOC).
alter table rh.rh_funcionarios drop constraint rh_funcionarios_tipo_contrato_check;
alter table rh.rh_funcionarios add constraint rh_funcionarios_tipo_contrato_check
  check (
    tipo_contrato is null
    or tipo_contrato = any (array['CLT','PJ','Temporário','Estágio','Menor aprendiz','S/ DOC'])
  );
