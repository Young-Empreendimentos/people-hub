-- 1) Comentário do RH/admin por atividade (fica ABAIXO do comentário do auditor,
--    sem sobrescrevê-lo). Também no snapshot, para o registro congelado ficar completo.
alter table public.rh_auditoria_itens add column if not exists comentario_admin text;
alter table public.rh_auditoria_resultado_snapshot add column if not exists comentario_admin text;

-- 2) rh_fechar_auditoria passa a copiar comentario_admin para o snapshot.
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

  SELECT COUNT(*) INTO v_pendentes FROM public.rh_auditoria_itens
   WHERE auditoria_id = p_auditoria_id AND status = 'pendente';
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
  WHERE i.auditoria_id = p_auditoria_id;

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

-- 3) Reabrir auditoria para edição (só admin): volta para em_andamento e limpa a
--    aprovação. O admin edita e finaliza de novo (recalcula o %).
create or replace function public.rh_reabrir_auditoria(p_auditoria_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_status rh_auditoria_status;
begin
  if not public.rh_has_role(auth.uid(), 'admin'::rh_app_role) then
    raise exception 'Somente administradores podem reabrir auditorias.';
  end if;
  select status into v_status from public.rh_auditorias where id = p_auditoria_id;
  if v_status is null then
    raise exception 'Auditoria não encontrada.';
  end if;
  if v_status = 'em_andamento'::rh_auditoria_status then
    return;
  end if;
  update public.rh_auditorias
     set status = 'em_andamento'::rh_auditoria_status,
         aprovado_por = null, aprovado_em = null, rejeitado_motivo = null,
         updated_at = now()
   where id = p_auditoria_id;
end $$;

grant execute on function public.rh_reabrir_auditoria(uuid) to authenticated;
