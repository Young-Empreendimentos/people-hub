
DROP POLICY IF EXISTS rh_folha_descontos_delete_admin_coord ON public.rh_folha_descontos;
CREATE POLICY rh_folha_descontos_delete_auth
  ON public.rh_folha_descontos
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

DELETE FROM public.rh_folha_descontos a
USING public.rh_folha_descontos b
WHERE a.folha_id = b.folha_id
  AND a.tipo = b.tipo
  AND a.valor = b.valor
  AND COALESCE(a.origem,'') = COALESCE(b.origem,'')
  AND (a.created_at < b.created_at
       OR (a.created_at = b.created_at AND a.id < b.id));
