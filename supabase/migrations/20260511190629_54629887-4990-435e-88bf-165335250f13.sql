
CREATE TABLE public.rh_plano_saude (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id uuid NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  valor_saude numeric NOT NULL DEFAULT 0,
  valor_odonto numeric NOT NULL DEFAULT 0,
  uso_plano numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, mes_referencia)
);

ALTER TABLE public.rh_plano_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read plano_saude"
ON public.rh_plano_saude FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/coord/user insert plano_saude"
ON public.rh_plano_saude FOR INSERT TO authenticated
WITH CHECK (
  rh_has_role(auth.uid(), 'admin'::rh_app_role)
  OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
  OR rh_has_role(auth.uid(), 'usuario'::rh_app_role)
);

CREATE POLICY "Admin/coord/user update plano_saude"
ON public.rh_plano_saude FOR UPDATE TO authenticated
USING (
  rh_has_role(auth.uid(), 'admin'::rh_app_role)
  OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
  OR rh_has_role(auth.uid(), 'usuario'::rh_app_role)
);

CREATE POLICY "Admin delete plano_saude"
ON public.rh_plano_saude FOR DELETE TO authenticated
USING (rh_has_role(auth.uid(), 'admin'::rh_app_role));

CREATE TRIGGER trg_rh_plano_saude_updated_at
BEFORE UPDATE ON public.rh_plano_saude
FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();
