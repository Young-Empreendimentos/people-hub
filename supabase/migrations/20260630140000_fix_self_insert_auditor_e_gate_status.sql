-- Corrige o auto-cadastro de auditor no Primeiro Acesso e impede escalonamento.

-- 1) Permite que o próprio usuário solicite também o papel 'auditor' (pendente).
--    Antes só 'colaborador' era aceito no self-insert, então marcar "auditor"
--    no Primeiro Acesso fazia o insert (de 2 linhas) inteiro falhar.
DROP POLICY IF EXISTS rh_user_roles_self_insert_pending ON public.rh_user_roles;
CREATE POLICY rh_user_roles_self_insert_pending
  ON public.rh_user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role::text IN ('colaborador','auditor')
    AND status = 'pendente'
  );

-- 2) Auditor só vale quando aprovado (status='ativo'). Sem isso, um auditor
--    pendente recém-cadastrado já teria poderes de auditor, pois rh_is_auditor
--    não checava o status. Todos os auditores atuais já são 'ativo'.
CREATE OR REPLACE FUNCTION public.rh_is_auditor(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rh_user_roles
    WHERE user_id = _uid AND role = 'auditor' AND status = 'ativo'
  );
$$;
