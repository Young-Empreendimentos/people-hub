-- Critério de aptidão passa a ser visível só para admin
--
-- rh_listar_atividades_auditoria (security definer) devolvia o critério a
-- qualquer usuário logado. Esconder a coluna na tela não bastaria: o texto
-- continuaria acessível pela API. Passa a ser mascarado no banco, do mesmo jeito
-- que o método de auditoria já é — admin recebe o valor, os demais recebem NULL.
--
-- Os outros caminhos até o critério já eram restritos:
--   - leitura direta de rh_atividades_auditoria: RLS só admin;
--   - rh_sucessao_plano_publicado: só destinatários de plano publicado, e só
--     quando o admin marca "Critério de aptidão" na publicação.
--
-- Troca cirúrgica, com trava: se o trecho não estiver no corpo da função, a
-- migration falha em vez de passar sem efeito.

do $$
declare
  v_def  text := pg_get_functiondef('public.rh_listar_atividades_auditoria()'::regprocedure);
  v_de   text := 'a.criterio_proficiencia,';
  v_para text := 'CASE WHEN public.rh_has_role(auth.uid(),''admin'') THEN a.criterio_proficiencia ELSE NULL END AS criterio_proficiencia,';
begin
  if position(v_de in v_def) = 0 then
    raise exception 'rh_listar_atividades_auditoria: trecho esperado não encontrado';
  end if;
  execute replace(v_def, v_de, v_para);
end $$;

comment on column rh.rh_atividades_auditoria.criterio_proficiencia is
  'Régua para considerar alguém plenamente capacitado nesta atividade. Visível só para admin; chega a um colaborador apenas via plano de sucessão publicado, quando o admin marca o critério na publicação.';
