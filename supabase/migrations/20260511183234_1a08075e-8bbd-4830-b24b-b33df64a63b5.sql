CREATE TABLE public.rh_absenteismo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  dias_trabalhados integer NOT NULL DEFAULT 0,
  dias_faltas integer NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, mes_referencia)
);

ALTER TABLE public.rh_absenteismo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read absenteismo"
ON public.rh_absenteismo FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/coord/user insert absenteismo"
ON public.rh_absenteismo FOR INSERT TO authenticated
WITH CHECK (
  rh_has_role(auth.uid(), 'admin'::rh_app_role)
  OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
  OR rh_has_role(auth.uid(), 'usuario'::rh_app_role)
);

CREATE POLICY "Admin/coord/user update absenteismo"
ON public.rh_absenteismo FOR UPDATE TO authenticated
USING (
  rh_has_role(auth.uid(), 'admin'::rh_app_role)
  OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
  OR rh_has_role(auth.uid(), 'usuario'::rh_app_role)
);

CREATE POLICY "Admin delete absenteismo"
ON public.rh_absenteismo FOR DELETE TO authenticated
USING (rh_has_role(auth.uid(), 'admin'::rh_app_role));

CREATE TRIGGER rh_absenteismo_updated_at
BEFORE UPDATE ON public.rh_absenteismo
FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();