
-- Aprovação de reembolsos lançados na folha mensal
ALTER TABLE public.rh_folha_reembolsos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

ALTER TABLE public.rh_folha_reembolsos
  DROP CONSTRAINT IF EXISTS rh_folha_reembolsos_status_check;
ALTER TABLE public.rh_folha_reembolsos
  ADD CONSTRAINT rh_folha_reembolsos_status_check
  CHECK (status IN ('pendente','aprovado'));

CREATE INDEX IF NOT EXISTS rh_folha_reembolsos_status_idx
  ON public.rh_folha_reembolsos(status);

-- Permitir que 'usuario' insira reembolsos (sempre como pendente, criados por ele)
DROP POLICY IF EXISTS "Admin/coord insert folha reembolsos" ON public.rh_folha_reembolsos;
CREATE POLICY "Insert folha reembolsos"
  ON public.rh_folha_reembolsos FOR INSERT TO authenticated
  WITH CHECK (
    rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR (
      rh_has_role(auth.uid(), 'usuario'::rh_app_role)
      AND status = 'pendente'
      AND criado_por = auth.uid()
    )
  );

-- Permitir que 'usuario' apague seus próprios reembolsos pendentes (necessário para o resync no save)
DROP POLICY IF EXISTS "Admin delete folha reembolsos" ON public.rh_folha_reembolsos;
CREATE POLICY "Delete folha reembolsos"
  ON public.rh_folha_reembolsos FOR DELETE TO authenticated
  USING (
    rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR (
      rh_has_role(auth.uid(), 'usuario'::rh_app_role)
      AND status = 'pendente'
      AND criado_por = auth.uid()
    )
  );
