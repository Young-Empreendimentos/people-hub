CREATE OR REPLACE FUNCTION public.rh_soft_delete_atividade_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rh_atividades_auditoria
  SET ativo = false,
      updated_at = now()
  WHERE id = OLD.id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rh_soft_delete_atividade_auditoria ON public.rh_atividades_auditoria;

CREATE TRIGGER trg_rh_soft_delete_atividade_auditoria
BEFORE DELETE ON public.rh_atividades_auditoria
FOR EACH ROW
EXECUTE FUNCTION public.rh_soft_delete_atividade_auditoria();

CREATE OR REPLACE FUNCTION public.rh_soft_delete_grupo_atividades_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rh_grupos_atividades_auditoria
  SET ativo = false,
      updated_at = now()
  WHERE id = OLD.id;

  UPDATE public.rh_atividades_auditoria
  SET ativo = false,
      updated_at = now()
  WHERE grupo_id = OLD.id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rh_soft_delete_grupo_atividades_auditoria ON public.rh_grupos_atividades_auditoria;

CREATE TRIGGER trg_rh_soft_delete_grupo_atividades_auditoria
BEFORE DELETE ON public.rh_grupos_atividades_auditoria
FOR EACH ROW
EXECUTE FUNCTION public.rh_soft_delete_grupo_atividades_auditoria();