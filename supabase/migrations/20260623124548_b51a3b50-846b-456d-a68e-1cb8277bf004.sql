
ALTER TABLE public.rh_funcionarios
  ADD COLUMN IF NOT EXISTS tem_plano_saude boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tem_desconto_parque boolean NOT NULL DEFAULT false;
