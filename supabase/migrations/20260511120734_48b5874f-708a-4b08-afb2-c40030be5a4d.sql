-- Add tipo_contrato to rh_funcionarios
ALTER TABLE public.rh_funcionarios
ADD COLUMN IF NOT EXISTS tipo_contrato text;

ALTER TABLE public.rh_funcionarios
DROP CONSTRAINT IF EXISTS rh_funcionarios_tipo_contrato_check;

ALTER TABLE public.rh_funcionarios
ADD CONSTRAINT rh_funcionarios_tipo_contrato_check
CHECK (tipo_contrato IS NULL OR tipo_contrato IN ('CLT', 'PJ', 'Estágio', 'Menor aprendiz', 'S/ DOC'));

-- Add VR fields to rh_folha_mensal
ALTER TABLE public.rh_folha_mensal
ADD COLUMN IF NOT EXISTS valor_vr numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS vr_desconsiderado boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vr_justificativa text;