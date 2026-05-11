-- Tabela de histórico de benefícios de moradia por funcionário
CREATE TABLE public.rh_funcionario_beneficios_moradia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  valor_reembolso_aluguel NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentual_auxilio_moradia NUMERIC(5,2) NOT NULL DEFAULT 25,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_beneficios_moradia_func ON public.rh_funcionario_beneficios_moradia(funcionario_id);
CREATE INDEX idx_rh_beneficios_moradia_vigente ON public.rh_funcionario_beneficios_moradia(funcionario_id) WHERE data_fim IS NULL;

ALTER TABLE public.rh_funcionario_beneficios_moradia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read beneficios moradia"
  ON public.rh_funcionario_beneficios_moradia FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/coord insert beneficios moradia"
  ON public.rh_funcionario_beneficios_moradia FOR INSERT
  TO authenticated WITH CHECK (
    public.rh_has_role(auth.uid(), 'admin') OR public.rh_has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admin/coord update beneficios moradia"
  ON public.rh_funcionario_beneficios_moradia FOR UPDATE
  TO authenticated USING (
    public.rh_has_role(auth.uid(), 'admin') OR public.rh_has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admin delete beneficios moradia"
  ON public.rh_funcionario_beneficios_moradia FOR DELETE
  TO authenticated USING (public.rh_has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rh_beneficios_moradia_updated_at
  BEFORE UPDATE ON public.rh_funcionario_beneficios_moradia
  FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();

-- Tabela de reembolsos lançados na folha mensal
CREATE TABLE public.rh_folha_reembolsos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folha_id UUID NOT NULL REFERENCES public.rh_folha_mensal(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_folha_reembolsos_folha ON public.rh_folha_reembolsos(folha_id);

ALTER TABLE public.rh_folha_reembolsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read folha reembolsos"
  ON public.rh_folha_reembolsos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/coord insert folha reembolsos"
  ON public.rh_folha_reembolsos FOR INSERT
  TO authenticated WITH CHECK (
    public.rh_has_role(auth.uid(), 'admin') OR public.rh_has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admin/coord update folha reembolsos"
  ON public.rh_folha_reembolsos FOR UPDATE
  TO authenticated USING (
    public.rh_has_role(auth.uid(), 'admin') OR public.rh_has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admin delete folha reembolsos"
  ON public.rh_folha_reembolsos FOR DELETE
  TO authenticated USING (public.rh_has_role(auth.uid(), 'admin'));