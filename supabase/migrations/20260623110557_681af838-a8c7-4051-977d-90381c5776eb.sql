
CREATE TYPE public.rh_auditoria_status AS ENUM ('em_andamento','finalizada','aprovada','rejeitada');
CREATE TYPE public.rh_auditoria_item_status AS ENUM ('pendente','positivo','inconformidade','nao_aplica');

CREATE TABLE public.rh_auditor_equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  equipe_id uuid NOT NULL REFERENCES public.rh_equipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, equipe_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_auditor_equipes TO authenticated;
GRANT ALL ON public.rh_auditor_equipes TO service_role;
ALTER TABLE public.rh_auditor_equipes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rh_is_auditor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rh_user_roles WHERE user_id=_uid AND role='auditor');
$$;
CREATE OR REPLACE FUNCTION public.rh_auditor_em_equipe(_uid uuid, _equipe_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rh_auditor_equipes WHERE user_id=_uid AND equipe_id=_equipe_id);
$$;

CREATE POLICY "admin gerencia auditor_equipes" ON public.rh_auditor_equipes FOR ALL TO authenticated
  USING (rh_has_role(auth.uid(),'admin')) WITH CHECK (rh_has_role(auth.uid(),'admin'));
CREATE POLICY "ver próprio vínculo de equipe" ON public.rh_auditor_equipes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR rh_has_role(auth.uid(),'admin'));

CREATE TABLE public.rh_grupos_atividades_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  equipe_id uuid REFERENCES public.rh_equipes(id) ON DELETE SET NULL,
  peso numeric(10,2) NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_grupos_atividades_auditoria TO authenticated;
GRANT ALL ON public.rh_grupos_atividades_auditoria TO service_role;
ALTER TABLE public.rh_grupos_atividades_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos veem grupos auditoria" ON public.rh_grupos_atividades_auditoria FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin gerencia grupos auditoria" ON public.rh_grupos_atividades_auditoria FOR ALL TO authenticated
  USING (rh_has_role(auth.uid(),'admin')) WITH CHECK (rh_has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rh_grupos_auditoria_updated BEFORE UPDATE ON public.rh_grupos_atividades_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();

CREATE TABLE public.rh_atividades_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.rh_grupos_atividades_auditoria(id) ON DELETE CASCADE,
  nome text NOT NULL,
  peso numeric(10,2) NOT NULL DEFAULT 1,
  responsavel_funcionario_id uuid REFERENCES public.rh_funcionarios(id) ON DELETE SET NULL,
  normas text,
  manuais text,
  indicadores text,
  metodo_auditoria text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_atividades_auditoria TO authenticated;
GRANT ALL ON public.rh_atividades_auditoria TO service_role;
ALTER TABLE public.rh_atividades_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin tudo atividades auditoria" ON public.rh_atividades_auditoria FOR ALL TO authenticated
  USING (rh_has_role(auth.uid(),'admin')) WITH CHECK (rh_has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rh_atividades_auditoria_updated BEFORE UPDATE ON public.rh_atividades_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();

CREATE OR REPLACE FUNCTION public.rh_listar_atividades_auditoria()
RETURNS TABLE (
  id uuid, grupo_id uuid, nome text, peso numeric, responsavel_funcionario_id uuid,
  normas text, manuais text, indicadores text, metodo_auditoria text,
  ordem int, ativo boolean, created_at timestamptz, updated_at timestamptz,
  equipe_id uuid, grupo_nome text, grupo_peso numeric, grupo_ordem int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    a.id, a.grupo_id, a.nome, a.peso, a.responsavel_funcionario_id,
    a.normas, a.manuais, a.indicadores,
    CASE
      WHEN public.rh_has_role(auth.uid(),'admin') THEN a.metodo_auditoria
      WHEN public.rh_is_auditor(auth.uid()) AND g.equipe_id IS NOT NULL
           AND public.rh_auditor_em_equipe(auth.uid(), g.equipe_id) THEN a.metodo_auditoria
      ELSE NULL
    END AS metodo_auditoria,
    a.ordem, a.ativo, a.created_at, a.updated_at,
    g.equipe_id, g.nome AS grupo_nome, g.peso AS grupo_peso, g.ordem AS grupo_ordem
  FROM public.rh_atividades_auditoria a
  JOIN public.rh_grupos_atividades_auditoria g ON g.id = a.grupo_id
  WHERE auth.uid() IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.rh_listar_atividades_auditoria() TO authenticated;

CREATE TABLE public.rh_auditorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  equipe_id uuid REFERENCES public.rh_equipes(id) ON DELETE SET NULL,
  auditor_user_id uuid NOT NULL,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  status public.rh_auditoria_status NOT NULL DEFAULT 'em_andamento',
  observacao_geral text,
  percentual_final numeric(7,4),
  aprovado_por uuid,
  aprovado_em timestamptz,
  rejeitado_motivo text,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_auditorias TO authenticated;
GRANT ALL ON public.rh_auditorias TO service_role;
ALTER TABLE public.rh_auditorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin tudo auditorias" ON public.rh_auditorias FOR ALL TO authenticated
  USING (rh_has_role(auth.uid(),'admin')) WITH CHECK (rh_has_role(auth.uid(),'admin'));
CREATE POLICY "auditor cria auditorias" ON public.rh_auditorias FOR INSERT TO authenticated
  WITH CHECK (rh_is_auditor(auth.uid()) AND auditor_user_id = auth.uid());
CREATE POLICY "auditor vê suas auditorias" ON public.rh_auditorias FOR SELECT TO authenticated
  USING (auditor_user_id = auth.uid() OR status IN ('aprovada','finalizada','rejeitada'));
CREATE POLICY "auditor edita suas auditorias em andamento" ON public.rh_auditorias FOR UPDATE TO authenticated
  USING (auditor_user_id = auth.uid() AND status = 'em_andamento')
  WITH CHECK (auditor_user_id = auth.uid());
CREATE TRIGGER trg_rh_auditorias_updated BEFORE UPDATE ON public.rh_auditorias
  FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();

CREATE TABLE public.rh_auditoria_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.rh_auditorias(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.rh_atividades_auditoria(id) ON DELETE RESTRICT,
  status public.rh_auditoria_item_status NOT NULL DEFAULT 'pendente',
  comentario text,
  evidencia_url text,
  avaliado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auditoria_id, atividade_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_auditoria_itens TO authenticated;
GRANT ALL ON public.rh_auditoria_itens TO service_role;
ALTER TABLE public.rh_auditoria_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin tudo itens auditoria" ON public.rh_auditoria_itens FOR ALL TO authenticated
  USING (rh_has_role(auth.uid(),'admin')) WITH CHECK (rh_has_role(auth.uid(),'admin'));
CREATE POLICY "ver itens conforme auditoria" ON public.rh_auditoria_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rh_auditorias a WHERE a.id = auditoria_id
                 AND (a.auditor_user_id = auth.uid() OR a.status IN ('aprovada','finalizada','rejeitada'))));
CREATE POLICY "auditor edita itens em_andamento" ON public.rh_auditoria_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rh_auditorias a WHERE a.id = auditoria_id
                 AND a.auditor_user_id = auth.uid() AND a.status = 'em_andamento'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.rh_auditorias a WHERE a.id = auditoria_id
                 AND a.auditor_user_id = auth.uid() AND a.status = 'em_andamento'));
CREATE TRIGGER trg_rh_auditoria_itens_updated BEFORE UPDATE ON public.rh_auditoria_itens
  FOR EACH ROW EXECUTE FUNCTION public.rh_update_updated_at();

CREATE TABLE public.rh_auditoria_resultado_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid NOT NULL REFERENCES public.rh_auditorias(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL,
  grupo_id uuid NOT NULL,
  nome_grupo text NOT NULL,
  nome_atividade text NOT NULL,
  peso_grupo numeric(10,2) NOT NULL,
  peso_atividade numeric(10,2) NOT NULL,
  status public.rh_auditoria_item_status NOT NULL,
  comentario text,
  evidencia_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rh_auditoria_resultado_snapshot TO authenticated;
GRANT ALL ON public.rh_auditoria_resultado_snapshot TO service_role;
ALTER TABLE public.rh_auditoria_resultado_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos leem snapshots" ON public.rh_auditoria_resultado_snapshot FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.rh_criar_auditoria(p_titulo text, p_equipe_id uuid, p_data_referencia date DEFAULT CURRENT_DATE)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (rh_has_role(v_uid,'admin') OR rh_is_auditor(v_uid)) THEN
    RAISE EXCEPTION 'Sem permissão para criar auditoria';
  END IF;
  IF rh_is_auditor(v_uid) AND NOT rh_has_role(v_uid,'admin')
     AND p_equipe_id IS NOT NULL AND NOT rh_auditor_em_equipe(v_uid, p_equipe_id) THEN
    RAISE EXCEPTION 'Auditor não vinculado a esta equipe';
  END IF;
  INSERT INTO public.rh_auditorias (titulo, equipe_id, auditor_user_id, data_referencia, criado_por)
  VALUES (p_titulo, p_equipe_id, v_uid, p_data_referencia, v_uid)
  RETURNING id INTO v_id;

  INSERT INTO public.rh_auditoria_itens (auditoria_id, atividade_id, status)
  SELECT v_id, a.id, 'pendente'
  FROM public.rh_atividades_auditoria a
  JOIN public.rh_grupos_atividades_auditoria g ON g.id = a.grupo_id
  WHERE a.ativo AND g.ativo
    AND (p_equipe_id IS NULL OR g.equipe_id = p_equipe_id OR g.equipe_id IS NULL);

  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.rh_criar_auditoria(text, uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.rh_fechar_auditoria(p_auditoria_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
     peso_grupo, peso_atividade, status, comentario, evidencia_url)
  SELECT
    i.auditoria_id, i.atividade_id, g.id, g.nome, a.nome,
    g.peso, a.peso, i.status, i.comentario, i.evidencia_url
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
END $$;
GRANT EXECUTE ON FUNCTION public.rh_fechar_auditoria(uuid) TO authenticated;

CREATE POLICY "auditoria evidencias select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'auditoria-evidencias' AND (
    public.rh_has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.rh_auditorias a
            WHERE a.id::text = split_part(name,'/',1)
              AND (a.auditor_user_id = auth.uid() OR a.status IN ('aprovada','finalizada','rejeitada')))
  )
);
CREATE POLICY "auditoria evidencias insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'auditoria-evidencias' AND (
    public.rh_has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.rh_auditorias a
            WHERE a.id::text = split_part(name,'/',1)
              AND a.auditor_user_id = auth.uid() AND a.status='em_andamento')
  )
);
CREATE POLICY "auditoria evidencias update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'auditoria-evidencias' AND (
    public.rh_has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.rh_auditorias a
            WHERE a.id::text = split_part(name,'/',1)
              AND a.auditor_user_id = auth.uid() AND a.status='em_andamento')
  )
);
CREATE POLICY "auditoria evidencias delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'auditoria-evidencias' AND (
    public.rh_has_role(auth.uid(),'admin') OR
    EXISTS (SELECT 1 FROM public.rh_auditorias a
            WHERE a.id::text = split_part(name,'/',1)
              AND a.auditor_user_id = auth.uid() AND a.status='em_andamento')
  )
);
