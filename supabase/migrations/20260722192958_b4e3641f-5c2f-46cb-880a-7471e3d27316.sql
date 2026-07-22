CREATE OR REPLACE FUNCTION public.rh_duplicar_grupo_atividades_auditoria(_grupo_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _novo_grupo_id uuid;
  _nova_ordem integer;
BEGIN
  IF NOT public.rh_has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem duplicar grupos de atividades.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(MAX(ordem), 0) + 1
    INTO _nova_ordem
  FROM public.rh_grupos_atividades_auditoria;

  INSERT INTO public.rh_grupos_atividades_auditoria (nome, equipe_id, peso, ordem, ativo)
  SELECT nome, equipe_id, peso, _nova_ordem, true
  FROM public.rh_grupos_atividades_auditoria
  WHERE id = _grupo_id
  RETURNING id INTO _novo_grupo_id;

  IF _novo_grupo_id IS NULL THEN
    RAISE EXCEPTION 'Grupo de atividades não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.rh_atividades_auditoria (
    grupo_id,
    nome,
    peso,
    responsavel_funcionario_id,
    normas,
    manuais,
    indicadores,
    metodo_auditoria,
    ordem,
    ativo
  )
  SELECT
    _novo_grupo_id,
    nome,
    peso,
    responsavel_funcionario_id,
    normas,
    manuais,
    indicadores,
    metodo_auditoria,
    ordem,
    true
  FROM public.rh_atividades_auditoria
  WHERE grupo_id = _grupo_id
    AND ativo = true
  ORDER BY ordem, nome;

  RETURN _novo_grupo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rh_duplicar_grupo_atividades_auditoria(uuid) TO authenticated;