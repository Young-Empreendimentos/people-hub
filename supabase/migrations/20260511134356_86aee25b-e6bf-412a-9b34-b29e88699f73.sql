CREATE TABLE public.rh_folha_descontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folha_id uuid NOT NULL REFERENCES public.rh_folha_mensal(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_folha_descontos_folha ON public.rh_folha_descontos(folha_id);
CREATE INDEX idx_rh_folha_descontos_tipo ON public.rh_folha_descontos(tipo);

ALTER TABLE public.rh_folha_descontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_folha_descontos_select_auth" ON public.rh_folha_descontos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rh_folha_descontos_insert_auth" ON public.rh_folha_descontos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "rh_folha_descontos_update_auth" ON public.rh_folha_descontos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "rh_folha_descontos_delete_admin_coord" ON public.rh_folha_descontos
  FOR DELETE TO authenticated USING (
    public.rh_has_role(auth.uid(), 'admin') OR public.rh_has_role(auth.uid(), 'coordenador')
  );