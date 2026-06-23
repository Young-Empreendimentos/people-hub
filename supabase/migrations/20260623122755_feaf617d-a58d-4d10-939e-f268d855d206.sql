
-- Estoque
CREATE TABLE public.rh_uniformes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('polo','social')),
  genero text NOT NULL CHECK (genero IN ('feminino','masculino')),
  tamanho text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tipo, genero, tamanho)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_uniformes_estoque TO authenticated;
GRANT ALL ON public.rh_uniformes_estoque TO service_role;
ALTER TABLE public.rh_uniformes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_unif_est_read ON public.rh_uniformes_estoque FOR SELECT USING (true);
CREATE POLICY rh_unif_est_insert ON public.rh_uniformes_estoque FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY rh_unif_est_update ON public.rh_uniformes_estoque FOR UPDATE TO authenticated USING (true);
CREATE POLICY rh_unif_est_delete ON public.rh_uniformes_estoque FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin'::rh_app_role));

-- Encomendas
CREATE TABLE public.rh_uniformes_encomendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid REFERENCES public.rh_funcionarios(id) ON DELETE SET NULL,
  empreendimento text,
  tamanho text,
  genero text CHECK (genero IN ('feminino','masculino')),
  qtd_camisa_social integer NOT NULL DEFAULT 0,
  qtd_camisa_polo integer NOT NULL DEFAULT 0,
  entregue_funcionario boolean NOT NULL DEFAULT false,
  pago boolean NOT NULL DEFAULT false,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_uniformes_encomendas TO authenticated;
GRANT ALL ON public.rh_uniformes_encomendas TO service_role;
ALTER TABLE public.rh_uniformes_encomendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_unif_enc_read ON public.rh_uniformes_encomendas FOR SELECT USING (true);
CREATE POLICY rh_unif_enc_insert ON public.rh_uniformes_encomendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY rh_unif_enc_update ON public.rh_uniformes_encomendas FOR UPDATE TO authenticated USING (true);
CREATE POLICY rh_unif_enc_delete ON public.rh_uniformes_encomendas FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin'::rh_app_role));

-- Entregas
CREATE TABLE public.rh_uniformes_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('polo','social')),
  genero text NOT NULL CHECK (genero IN ('feminino','masculino')),
  tamanho text NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  data_entrega date NOT NULL,
  recibo_path text NOT NULL,
  devolvido boolean NOT NULL DEFAULT false,
  data_devolucao date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_uniformes_entregas TO authenticated;
GRANT ALL ON public.rh_uniformes_entregas TO service_role;
ALTER TABLE public.rh_uniformes_entregas ENABLE ROW LEVEL SECURITY;
CREATE POLICY rh_unif_ent_read ON public.rh_uniformes_entregas FOR SELECT USING (true);
CREATE POLICY rh_unif_ent_insert ON public.rh_uniformes_entregas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY rh_unif_ent_update ON public.rh_uniformes_entregas FOR UPDATE TO authenticated USING (true);
CREATE POLICY rh_unif_ent_delete ON public.rh_uniformes_entregas FOR DELETE TO authenticated USING (rh_has_role(auth.uid(), 'admin'::rh_app_role));

CREATE TRIGGER trg_rh_unif_est_updated BEFORE UPDATE ON public.rh_uniformes_estoque FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rh_unif_enc_updated BEFORE UPDATE ON public.rh_uniformes_encomendas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rh_unif_ent_updated BEFORE UPDATE ON public.rh_uniformes_entregas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.rh_uniformes_estoque (tipo, genero, tamanho, quantidade)
SELECT tipo, genero, tamanho, 0
FROM (VALUES ('polo'),('social')) AS t(tipo)
CROSS JOIN (VALUES ('feminino'),('masculino')) AS g(genero)
CROSS JOIN (VALUES ('P'),('M'),('G'),('GG'),('XGG'),('G1'),('G2'),('G3')) AS s(tamanho);
