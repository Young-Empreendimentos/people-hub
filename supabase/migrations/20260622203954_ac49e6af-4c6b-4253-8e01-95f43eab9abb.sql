
ALTER TABLE public.rh_user_roles
  ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.rh_funcionarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rh_user_roles_status_chk') THEN
    ALTER TABLE public.rh_user_roles ADD CONSTRAINT rh_user_roles_status_chk CHECK (status IN ('pendente','ativo','rejeitado'));
  END IF;
END $$;

UPDATE public.rh_user_roles SET status = 'ativo' WHERE status = 'pendente' AND role::text <> 'colaborador';

ALTER TABLE public.rh_funcionarios
  ADD COLUMN IF NOT EXISTS valor_km numeric(10,4) NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS rh_user_roles_self_insert_pending ON public.rh_user_roles;
CREATE POLICY rh_user_roles_self_insert_pending
  ON public.rh_user_roles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role::text = 'colaborador'
    AND status = 'pendente'
  );

CREATE OR REPLACE FUNCTION public.rh_current_funcionario_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT funcionario_id FROM public.rh_user_roles
  WHERE user_id = auth.uid() AND status = 'ativo' LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS public.rh_km_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  data date NOT NULL,
  km numeric(10,2) NOT NULL CHECK (km > 0),
  valor_km_snapshot numeric(10,4) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  descricao text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','pago')),
  motivo_rejeicao text,
  criado_por uuid,
  aprovado_por uuid,
  aprovado_em timestamptz,
  folha_reembolso_id uuid REFERENCES public.rh_folha_reembolsos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rh_km_lanc_func_idx ON public.rh_km_lancamentos(funcionario_id, data);
CREATE INDEX IF NOT EXISTS rh_km_lanc_status_idx ON public.rh_km_lancamentos(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_km_lancamentos TO authenticated;
GRANT ALL ON public.rh_km_lancamentos TO service_role;

ALTER TABLE public.rh_km_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_km_select_all ON public.rh_km_lancamentos;
CREATE POLICY rh_km_select_all ON public.rh_km_lancamentos FOR SELECT TO authenticated
  USING (
    public.rh_has_role(auth.uid(),'admin'::rh_app_role)
    OR public.rh_has_role(auth.uid(),'coordenador'::rh_app_role)
    OR public.rh_has_role(auth.uid(),'usuario'::rh_app_role)
    OR funcionario_id = public.rh_current_funcionario_id()
  );

DROP POLICY IF EXISTS rh_km_insert_colab ON public.rh_km_lancamentos;
CREATE POLICY rh_km_insert_colab ON public.rh_km_lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    funcionario_id = public.rh_current_funcionario_id()
    AND status = 'pendente'
  );

DROP POLICY IF EXISTS rh_km_insert_staff ON public.rh_km_lancamentos;
CREATE POLICY rh_km_insert_staff ON public.rh_km_lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.rh_has_role(auth.uid(),'admin'::rh_app_role)
    OR public.rh_has_role(auth.uid(),'coordenador'::rh_app_role)
    OR public.rh_has_role(auth.uid(),'usuario'::rh_app_role)
  );

DROP POLICY IF EXISTS rh_km_update_colab ON public.rh_km_lancamentos;
CREATE POLICY rh_km_update_colab ON public.rh_km_lancamentos FOR UPDATE TO authenticated
  USING (funcionario_id = public.rh_current_funcionario_id() AND status = 'pendente')
  WITH CHECK (funcionario_id = public.rh_current_funcionario_id() AND status = 'pendente');

DROP POLICY IF EXISTS rh_km_update_staff ON public.rh_km_lancamentos;
CREATE POLICY rh_km_update_staff ON public.rh_km_lancamentos FOR UPDATE TO authenticated
  USING (
    (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
     OR public.rh_has_role(auth.uid(),'coordenador'::rh_app_role)
     OR public.rh_has_role(auth.uid(),'usuario'::rh_app_role))
    AND status <> 'pago'
  )
  WITH CHECK (
    public.rh_has_role(auth.uid(),'admin'::rh_app_role)
    OR public.rh_has_role(auth.uid(),'coordenador'::rh_app_role)
    OR public.rh_has_role(auth.uid(),'usuario'::rh_app_role)
  );

DROP POLICY IF EXISTS rh_km_delete_colab ON public.rh_km_lancamentos;
CREATE POLICY rh_km_delete_colab ON public.rh_km_lancamentos FOR DELETE TO authenticated
  USING (funcionario_id = public.rh_current_funcionario_id() AND status = 'pendente');

DROP POLICY IF EXISTS rh_km_delete_staff ON public.rh_km_lancamentos;
CREATE POLICY rh_km_delete_staff ON public.rh_km_lancamentos FOR DELETE TO authenticated
  USING (
    (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
     OR public.rh_has_role(auth.uid(),'coordenador'::rh_app_role))
    AND status <> 'pago'
  );

CREATE OR REPLACE FUNCTION public.rh_km_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_rh_km_updated_at ON public.rh_km_lancamentos;
CREATE TRIGGER trg_rh_km_updated_at
  BEFORE UPDATE ON public.rh_km_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.rh_km_set_updated_at();
