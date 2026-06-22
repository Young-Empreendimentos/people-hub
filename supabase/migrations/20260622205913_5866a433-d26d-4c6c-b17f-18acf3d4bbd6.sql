CREATE OR REPLACE FUNCTION public.rh_set_my_funcionario(p_funcionario_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF p_funcionario_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rh_user_roles
    WHERE funcionario_id = p_funcionario_id AND user_id <> v_uid AND status <> 'rejeitado'
  ) THEN
    RAISE EXCEPTION 'Este funcionário já está vinculado a outro usuário';
  END IF;
  UPDATE public.rh_user_roles
  SET funcionario_id = p_funcionario_id,
      status = CASE WHEN status IS NULL OR status = 'pendente' THEN 'ativo' ELSE status END
  WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rh_set_my_funcionario(uuid) TO authenticated;