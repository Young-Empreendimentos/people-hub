
DROP POLICY IF EXISTS rh_folha_descontos_delete_auth ON public.rh_folha_descontos;

CREATE POLICY rh_folha_descontos_delete_regra_30d
  ON public.rh_folha_descontos
  FOR DELETE
  USING (
    rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR EXISTS (
      SELECT 1 FROM public.rh_folha_mensal fm
      WHERE fm.id = rh_folha_descontos.folha_id
        AND fm.created_at >= now() - interval '30 days'
    )
  );
