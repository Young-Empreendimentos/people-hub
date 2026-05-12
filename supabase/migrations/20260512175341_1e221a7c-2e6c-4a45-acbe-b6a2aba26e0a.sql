-- Corrigir policy de update do usuario - subquery anterior estava bugada
DROP POLICY IF EXISTS rh_update_usuario ON public.rh_funcionarios;

CREATE POLICY rh_update_usuario
ON public.rh_funcionarios
FOR UPDATE
TO authenticated
USING (rh_has_role(auth.uid(), 'usuario'::rh_app_role))
WITH CHECK (rh_has_role(auth.uid(), 'usuario'::rh_app_role));

-- Trigger para impedir usuario de alterar cargo_id (regra de negocio no DB)
CREATE OR REPLACE FUNCTION public.rh_funcionarios_block_cargo_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF rh_has_role(auth.uid(), 'usuario'::rh_app_role)
     AND NOT (rh_has_role(auth.uid(), 'admin'::rh_app_role) OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role))
     AND NEW.cargo_id IS DISTINCT FROM OLD.cargo_id THEN
    NEW.cargo_id := OLD.cargo_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rh_funcionarios_block_cargo_change_trg ON public.rh_funcionarios;
CREATE TRIGGER rh_funcionarios_block_cargo_change_trg
BEFORE UPDATE ON public.rh_funcionarios
FOR EACH ROW
EXECUTE FUNCTION public.rh_funcionarios_block_cargo_change();