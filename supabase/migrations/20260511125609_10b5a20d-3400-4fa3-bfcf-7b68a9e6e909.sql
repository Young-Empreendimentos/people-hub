
CREATE TABLE public.rh_advertencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE NOT NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Verbal','Formal')),
  motivo TEXT NOT NULL CHECK (char_length(motivo) <= 250),
  arquivo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_advertencias_func ON public.rh_advertencias(funcionario_id);
CREATE INDEX idx_rh_advertencias_data ON public.rh_advertencias(data);

ALTER TABLE public.rh_advertencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_read_all" ON public.rh_advertencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_insert_admin_coord" ON public.rh_advertencias FOR INSERT TO authenticated WITH CHECK (rh_has_role(auth.uid(),'admin') OR rh_has_role(auth.uid(),'coordenador'));
CREATE POLICY "rh_update_admin_coord" ON public.rh_advertencias FOR UPDATE TO authenticated USING (rh_has_role(auth.uid(),'admin') OR rh_has_role(auth.uid(),'coordenador'));
CREATE POLICY "rh_delete_admin_coord" ON public.rh_advertencias FOR DELETE TO authenticated USING (rh_has_role(auth.uid(),'admin') OR rh_has_role(auth.uid(),'coordenador'));

CREATE TRIGGER rh_advertencias_updated_at BEFORE UPDATE ON public.rh_advertencias
FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();
