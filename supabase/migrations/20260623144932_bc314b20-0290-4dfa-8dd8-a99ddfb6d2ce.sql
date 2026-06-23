
DROP POLICY IF EXISTS rh_read_own_role ON public.rh_user_roles;
CREATE POLICY rh_read_own_role ON public.rh_user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR rh_has_role(auth.uid(),'admin'::rh_app_role)
  OR rh_has_role(auth.uid(),'coordenador'::rh_app_role)
);

DROP POLICY IF EXISTS rh_insert_admin ON public.rh_user_roles;
CREATE POLICY rh_insert_admin ON public.rh_user_roles FOR INSERT TO authenticated
WITH CHECK (
  rh_has_role(auth.uid(),'admin'::rh_app_role)
  OR (
    rh_has_role(auth.uid(),'coordenador'::rh_app_role)
    AND role <> 'admin'::rh_app_role
  )
);

DROP POLICY IF EXISTS rh_update_admin ON public.rh_user_roles;
CREATE POLICY rh_update_admin ON public.rh_user_roles FOR UPDATE TO authenticated
USING (
  rh_has_role(auth.uid(),'admin'::rh_app_role)
  OR (
    rh_has_role(auth.uid(),'coordenador'::rh_app_role)
    AND role <> 'admin'::rh_app_role
  )
)
WITH CHECK (
  rh_has_role(auth.uid(),'admin'::rh_app_role)
  OR (
    rh_has_role(auth.uid(),'coordenador'::rh_app_role)
    AND role <> 'admin'::rh_app_role
  )
);

DROP POLICY IF EXISTS rh_delete_admin ON public.rh_user_roles;
CREATE POLICY rh_delete_admin ON public.rh_user_roles FOR DELETE TO authenticated
USING (
  rh_has_role(auth.uid(),'admin'::rh_app_role)
  OR (
    rh_has_role(auth.uid(),'coordenador'::rh_app_role)
    AND role <> 'admin'::rh_app_role
  )
);
