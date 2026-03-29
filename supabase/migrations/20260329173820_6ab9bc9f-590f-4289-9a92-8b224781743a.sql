
CREATE OR REPLACE FUNCTION public.rh_get_all_users_with_roles()
RETURNS TABLE(id uuid, email text, role rh_app_role, created_at timestamptz, nome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.rh_has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado. Apenas administradores.';
  END IF;

  RETURN QUERY
  SELECT 
    au.id,
    au.email::text,
    ur.role,
    au.created_at,
    COALESCE(up.nome, '') as nome
  FROM auth.users au
  LEFT JOIN public.rh_user_roles ur ON ur.user_id = au.id
  LEFT JOIN public.rh_user_profiles up ON up.user_id = au.id
  ORDER BY au.created_at DESC;
END;
$$;
