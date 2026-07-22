ALTER TABLE public.rh_auditoria_itens DROP CONSTRAINT IF EXISTS rh_auditoria_itens_atividade_id_fkey;
ALTER TABLE public.rh_auditoria_itens ADD CONSTRAINT rh_auditoria_itens_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES public.rh_atividades_auditoria(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.rh_listar_atividades_auditoria()
 RETURNS TABLE(id uuid, grupo_id uuid, nome text, peso numeric, responsavel_funcionario_id uuid, normas text, manuais text, indicadores text, metodo_auditoria text, ordem integer, ativo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, equipe_id uuid, grupo_nome text, grupo_peso numeric, grupo_ordem integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    a.id, a.grupo_id, a.nome, a.peso, a.responsavel_funcionario_id,
    a.normas, a.manuais, a.indicadores,
    CASE
      WHEN public.rh_has_role(auth.uid(),'admin') THEN a.metodo_auditoria
      WHEN public.rh_is_auditor(auth.uid()) AND g.equipe_id IS NOT NULL
           AND public.rh_auditor_em_equipe(auth.uid(), g.equipe_id) THEN a.metodo_auditoria
      ELSE NULL
    END AS metodo_auditoria,
    a.ordem, a.ativo, a.created_at, a.updated_at,
    g.equipe_id, g.nome AS grupo_nome, g.peso AS grupo_peso, g.ordem AS grupo_ordem
  FROM public.rh_atividades_auditoria a
  JOIN public.rh_grupos_atividades_auditoria g ON g.id = a.grupo_id
  WHERE auth.uid() IS NOT NULL AND a.ativo = true AND COALESCE(g.ativo, true) = true;
$function$;