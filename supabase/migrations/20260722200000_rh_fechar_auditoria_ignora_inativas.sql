-- Finalizar auditoria passa a considerar SÓ as atividades ativas (as que aparecem
-- na tela). Contexto: se uma atividade é desativada DEPOIS que a auditoria foi
-- criada, o item dela some da tela (a listagem filtra ativo=true) mas continuava
-- sendo contado como "pendente" no fechamento -> travava a finalização com
-- "Existem N atividades pendentes" sem o auditor conseguir responder.
-- Agora tanto a checagem de pendência quanto o resultado congelado ignoram itens
-- de atividades/grupos desativados, ficando consistentes com a tela.
create or replace function public.rh_fechar_auditoria(p_auditoria_id uuid)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_aud RECORD;
  v_pendentes int;
  v_pct numeric;
BEGIN
  SELECT * INTO v_aud FROM public.rh_auditorias WHERE id = p_auditoria_id;
  IF v_aud IS NULL THEN RAISE EXCEPTION 'Auditoria não encontrada'; END IF;
  IF NOT (rh_has_role(v_uid,'admin') OR v_aud.auditor_user_id = v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para finalizar esta auditoria';
  END IF;
  IF v_aud.status <> 'em_andamento' THEN
    RAISE EXCEPTION 'Auditoria não está em andamento';
  END IF;

  -- Só cobra atividades ATIVAS (as que aparecem na tela).
  SELECT COUNT(*) INTO v_pendentes
  FROM public.rh_auditoria_itens i
  JOIN public.rh_atividades_auditoria a ON a.id = i.atividade_id
  JOIN public.rh_grupos_atividades_auditoria g ON g.id = a.grupo_id
  WHERE i.auditoria_id = p_auditoria_id
    AND i.status = 'pendente'
    AND a.ativo = true AND COALESCE(g.ativo, true) = true;
  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'Existem % atividades pendentes', v_pendentes;
  END IF;

  DELETE FROM public.rh_auditoria_resultado_snapshot WHERE auditoria_id = p_auditoria_id;
  INSERT INTO public.rh_auditoria_resultado_snapshot
    (auditoria_id, atividade_id, grupo_id, nome_grupo, nome_atividade,
     peso_grupo, peso_atividade, status, comentario, comentario_admin, evidencia_url)
  SELECT
    i.auditoria_id, i.atividade_id, g.id, g.nome, a.nome,
    g.peso, a.peso, i.status, i.comentario, i.comentario_admin, i.evidencia_url
  FROM public.rh_auditoria_itens i
  JOIN public.rh_atividades_auditoria a ON a.id = i.atividade_id
  JOIN public.rh_grupos_atividades_auditoria g ON g.id = a.grupo_id
  WHERE i.auditoria_id = p_auditoria_id
    AND a.ativo = true AND COALESCE(g.ativo, true) = true;

  WITH por_grupo AS (
    SELECT grupo_id, peso_grupo,
           SUM(CASE status WHEN 'positivo' THEN peso_atividade ELSE 0 END)
             / NULLIF(SUM(CASE WHEN status IN ('positivo','inconformidade') THEN peso_atividade ELSE 0 END),0) AS res
    FROM public.rh_auditoria_resultado_snapshot
    WHERE auditoria_id = p_auditoria_id
    GROUP BY grupo_id, peso_grupo
  )
  SELECT SUM(peso_grupo * COALESCE(res,0)) / NULLIF(SUM(CASE WHEN res IS NOT NULL THEN peso_grupo ELSE 0 END),0)
    INTO v_pct FROM por_grupo;

  UPDATE public.rh_auditorias
     SET status='finalizada', percentual_final = COALESCE(v_pct,0), updated_at = now()
   WHERE id = p_auditoria_id;

  RETURN COALESCE(v_pct,0);
END $function$;
