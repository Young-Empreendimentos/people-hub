-- Storage: acesso a anexos de RH restrito a staff (admin/coordenador/usuario).
-- Antes: qualquer autenticado lia/subia qualquer arquivo de rh-anexos, e o bucket
-- rh-uniformes-recibos estava totalmente aberto (inclusive update/delete).
-- Usa o helper public.rh_is_staff() criado na migration anterior.

-- rh-anexos: leitura só staff
DROP POLICY IF EXISTS rh_storage_read ON storage.objects;
CREATE POLICY rh_storage_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rh-anexos' AND public.rh_is_staff());

-- rh-anexos: upload só staff
DROP POLICY IF EXISTS rh_storage_insert ON storage.objects;
CREATE POLICY rh_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rh-anexos' AND public.rh_is_staff());

-- (DELETE de rh-anexos permanece admin/coordenador, como já estava.)

-- rh-uniformes-recibos: todas as operacoes só staff
DROP POLICY IF EXISTS rh_unif_recibos_read ON storage.objects;
CREATE POLICY rh_unif_recibos_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'rh-uniformes-recibos' AND public.rh_is_staff());

DROP POLICY IF EXISTS rh_unif_recibos_insert ON storage.objects;
CREATE POLICY rh_unif_recibos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rh-uniformes-recibos' AND public.rh_is_staff());

DROP POLICY IF EXISTS rh_unif_recibos_update ON storage.objects;
CREATE POLICY rh_unif_recibos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'rh-uniformes-recibos' AND public.rh_is_staff())
  WITH CHECK (bucket_id = 'rh-uniformes-recibos' AND public.rh_is_staff());

DROP POLICY IF EXISTS rh_unif_recibos_delete ON storage.objects;
CREATE POLICY rh_unif_recibos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rh-uniformes-recibos' AND public.rh_is_staff());
