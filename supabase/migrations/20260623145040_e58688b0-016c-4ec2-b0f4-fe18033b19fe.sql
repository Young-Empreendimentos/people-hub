
CREATE OR REPLACE FUNCTION public.rh_get_all_users_with_roles()
 RETURNS TABLE(id uuid, email text, role rh_app_role, created_at timestamp with time zone, nome text, status text, funcionario_id uuid, funcionario_nome text, is_auditor boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.rh_has_role(auth.uid(), 'admin') OR public.rh_has_role(auth.uid(), 'coordenador')) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  WITH primary_role AS (
    SELECT DISTINCT ON (ur.user_id)
      ur.user_id, ur.role, ur.status, ur.funcionario_id
    FROM public.rh_user_roles ur
    WHERE ur.role <> 'auditor'
    ORDER BY ur.user_id,
      CASE ur.role
        WHEN 'admin' THEN 1 WHEN 'coordenador' THEN 2
        WHEN 'usuario' THEN 3 WHEN 'colaborador' THEN 4 ELSE 5
      END
  ),
  auditor_flag AS (
    SELECT ur.user_id, true AS is_auditor, ur.status AS auditor_status
    FROM public.rh_user_roles ur WHERE ur.role = 'auditor'
  )
  SELECT
    au.id, au.email::text, pr.role, au.created_at,
    COALESCE(up.nome, '') AS nome,
    COALESCE(pr.status, af.auditor_status, 'pendente') AS status,
    pr.funcionario_id,
    f.nome_completo AS funcionario_nome,
    COALESCE(af.is_auditor, false) AS is_auditor
  FROM auth.users au
  LEFT JOIN primary_role pr ON pr.user_id = au.id
  LEFT JOIN auditor_flag af ON af.user_id = au.id
  LEFT JOIN public.rh_user_profiles up ON up.user_id = au.id
  LEFT JOIN public.rh_funcionarios f ON f.id = pr.funcionario_id
  ORDER BY au.created_at DESC;
END;
$function$;
