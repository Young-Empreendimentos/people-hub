-- Reforçar: usuario pode atualizar funcionários, mas NÃO pode alterar cargo_id
DROP POLICY IF EXISTS rh_update_usuario ON public.rh_funcionarios;

CREATE POLICY rh_update_usuario
ON public.rh_funcionarios
FOR UPDATE
TO authenticated
USING (rh_has_role(auth.uid(), 'usuario'::rh_app_role))
WITH CHECK (
  rh_has_role(auth.uid(), 'usuario'::rh_app_role)
  AND cargo_id IS NOT DISTINCT FROM (
    SELECT cargo_id FROM public.rh_funcionarios WHERE id = rh_funcionarios.id
  )
);