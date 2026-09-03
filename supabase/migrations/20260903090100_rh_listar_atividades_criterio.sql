-- Expõe criterio_proficiencia na listagem de atividades de auditoria.
--
-- Ao contrário de metodo_auditoria (mascarado para quem não é admin/auditor da
-- equipe, porque é COMO se verifica sem a pessoa saber), o critério de
-- proficiência é a régua declarada — visível a qualquer usuário autenticado.
--
-- RETURNS TABLE muda, então precisa DROP + CREATE (CREATE OR REPLACE não altera
-- o tipo de retorno).

drop function if exists public.rh_listar_atividades_auditoria();

create or replace function public.rh_listar_atividades_auditoria()
returns table(
  id uuid, grupo_id uuid, nome text, peso numeric,
  responsavel_funcionario_id uuid,
  normas text, manuais text, indicadores text,
  criterio_proficiencia text,
  metodo_auditoria text,
  ordem integer, ativo boolean,
  created_at timestamptz, updated_at timestamptz,
  equipe_id uuid, grupo_nome text, grupo_peso numeric, grupo_ordem integer
)
language sql
stable
security definer
set search_path to 'rh', 'public'
as $function$
  SELECT
    a.id, a.grupo_id, a.nome, a.peso, a.responsavel_funcionario_id,
    a.normas, a.manuais, a.indicadores,
    a.criterio_proficiencia,
    CASE
      WHEN public.rh_has_role(auth.uid(),'admin') THEN a.metodo_auditoria
      WHEN public.rh_is_auditor(auth.uid()) AND g.equipe_id IS NOT NULL
           AND public.rh_auditor_em_equipe(auth.uid(), g.equipe_id) THEN a.metodo_auditoria
      ELSE NULL
    END AS metodo_auditoria,
    a.ordem, a.ativo, a.created_at, a.updated_at,
    g.equipe_id, g.nome AS grupo_nome, g.peso AS grupo_peso, g.ordem AS grupo_ordem
  FROM rh.rh_atividades_auditoria a
  JOIN rh.rh_grupos_atividades_auditoria g ON g.id = a.grupo_id
  WHERE auth.uid() IS NOT NULL AND a.ativo = true AND COALESCE(g.ativo, true) = true;
$function$;

grant execute on function public.rh_listar_atividades_auditoria() to authenticated;
