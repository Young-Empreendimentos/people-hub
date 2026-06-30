-- Restringe a leitura de dados sensíveis de RH.
--
-- Contexto: a migration inicial criou políticas "rh_read_all" com
--   FOR SELECT TO authenticated USING (true)
-- ou seja, QUALQUER usuário autenticado (inclusive colaborador pendente,
-- e qualquer conta Google que faça login) consegue ler folha, salários,
-- avaliações, advertências, etc. Apenas rh_funcionarios e rh_km_lancamentos
-- haviam sido restringidos.
--
-- Esta migration aplica, nas tabelas sensíveis, o mesmo escopo já usado em
-- rh_funcionarios_select_scoped:
--   staff (admin/coordenador/usuario) vê tudo; colaborador vê só o próprio
--   funcionario_id. Tabelas de referência de baixo risco (equipes, empresas,
--   trilhas, tipos de aditivo, grupos/atividades) são deixadas abertas de
--   propósito, pois são lidas por telas de colaborador/auditor e não contêm
--   dados pessoais/financeiros.
--
-- IMPORTANTE (Postgres): políticas permissivas são combinadas com OR. Por isso
-- cada política de SELECT antiga é REMOVIDA antes de criar a nova escopada —
-- senão a tabela continuaria aberta.

-- ---------------------------------------------------------------------------
-- 1) Helper: usuário atual é staff (admin/coordenador/usuario)?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_is_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.rh_has_role(auth.uid(), 'admin'::rh_app_role)
      OR public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
      OR public.rh_has_role(auth.uid(), 'usuario'::rh_app_role);
$$;

GRANT EXECUTE ON FUNCTION public.rh_is_staff() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Tabelas com funcionario_id direto: staff vê tudo, colaborador vê o seu
-- ---------------------------------------------------------------------------

-- rh_folha_mensal (salários, comissões, PLR, descontos)
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_folha_mensal;
DROP POLICY IF EXISTS rh_folha_mensal_select_scoped ON public.rh_folha_mensal;
CREATE POLICY rh_folha_mensal_select_scoped ON public.rh_folha_mensal
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_avaliacoes
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_avaliacoes;
DROP POLICY IF EXISTS rh_avaliacoes_select_scoped ON public.rh_avaliacoes;
CREATE POLICY rh_avaliacoes_select_scoped ON public.rh_avaliacoes
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_advertencias
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_advertencias;
DROP POLICY IF EXISTS rh_advertencias_select_scoped ON public.rh_advertencias;
CREATE POLICY rh_advertencias_select_scoped ON public.rh_advertencias
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_adiantamentos
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_adiantamentos;
DROP POLICY IF EXISTS rh_adiantamentos_select_scoped ON public.rh_adiantamentos;
CREATE POLICY rh_adiantamentos_select_scoped ON public.rh_adiantamentos
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_aditivos
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_aditivos;
DROP POLICY IF EXISTS rh_aditivos_select_scoped ON public.rh_aditivos;
CREATE POLICY rh_aditivos_select_scoped ON public.rh_aditivos
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_admissoes_desligamentos
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_admissoes_desligamentos;
DROP POLICY IF EXISTS rh_admissoes_desligamentos_select_scoped ON public.rh_admissoes_desligamentos;
CREATE POLICY rh_admissoes_desligamentos_select_scoped ON public.rh_admissoes_desligamentos
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_funcionario_anexos (referências de documentos)
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_funcionario_anexos;
DROP POLICY IF EXISTS rh_funcionario_anexos_select_scoped ON public.rh_funcionario_anexos;
CREATE POLICY rh_funcionario_anexos_select_scoped ON public.rh_funcionario_anexos
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_funcionario_beneficios_moradia
DROP POLICY IF EXISTS "Authenticated read beneficios moradia" ON public.rh_funcionario_beneficios_moradia;
DROP POLICY IF EXISTS rh_beneficios_moradia_select_scoped ON public.rh_funcionario_beneficios_moradia;
CREATE POLICY rh_beneficios_moradia_select_scoped ON public.rh_funcionario_beneficios_moradia
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_absenteismo
DROP POLICY IF EXISTS "Authenticated read absenteismo" ON public.rh_absenteismo;
DROP POLICY IF EXISTS rh_absenteismo_select_scoped ON public.rh_absenteismo;
CREATE POLICY rh_absenteismo_select_scoped ON public.rh_absenteismo
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_plano_saude
DROP POLICY IF EXISTS "Authenticated read plano_saude" ON public.rh_plano_saude;
DROP POLICY IF EXISTS rh_plano_saude_select_scoped ON public.rh_plano_saude;
CREATE POLICY rh_plano_saude_select_scoped ON public.rh_plano_saude
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_uniformes_encomendas (funcionario_id pode ser nulo -> só staff vê os sem dono)
DROP POLICY IF EXISTS rh_unif_enc_read ON public.rh_uniformes_encomendas;
DROP POLICY IF EXISTS rh_uniformes_encomendas_select_scoped ON public.rh_uniformes_encomendas;
CREATE POLICY rh_uniformes_encomendas_select_scoped ON public.rh_uniformes_encomendas
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- rh_uniformes_entregas
DROP POLICY IF EXISTS rh_unif_ent_read ON public.rh_uniformes_entregas;
DROP POLICY IF EXISTS rh_uniformes_entregas_select_scoped ON public.rh_uniformes_entregas;
CREATE POLICY rh_uniformes_entregas_select_scoped ON public.rh_uniformes_entregas
  FOR SELECT TO authenticated
  USING (public.rh_is_staff() OR funcionario_id = public.rh_current_funcionario_id());

-- ---------------------------------------------------------------------------
-- 3) Tabelas sem funcionario_id direto
-- ---------------------------------------------------------------------------

-- rh_cargos: contém remuneração (faixas salariais). Nenhuma tela de
-- colaborador/auditor lê esta tabela -> somente staff.
DROP POLICY IF EXISTS "rh_read_all" ON public.rh_cargos;
DROP POLICY IF EXISTS rh_cargos_select_staff ON public.rh_cargos;
CREATE POLICY rh_cargos_select_staff ON public.rh_cargos
  FOR SELECT TO authenticated
  USING (public.rh_is_staff());

-- rh_folha_reembolsos: ligada a rh_folha_mensal via folha_id.
-- staff vê tudo; colaborador vê os reembolsos das próprias folhas.
DROP POLICY IF EXISTS "Authenticated read folha reembolsos" ON public.rh_folha_reembolsos;
DROP POLICY IF EXISTS rh_folha_reembolsos_select_scoped ON public.rh_folha_reembolsos;
CREATE POLICY rh_folha_reembolsos_select_scoped ON public.rh_folha_reembolsos
  FOR SELECT TO authenticated
  USING (
    public.rh_is_staff()
    OR folha_id IN (
      SELECT fm.id FROM public.rh_folha_mensal fm
      WHERE fm.funcionario_id = public.rh_current_funcionario_id()
    )
  );

-- rh_uniformes_estoque: apenas níveis de estoque (sem dado pessoal), mas não
-- precisa ser visível a colaborador -> somente staff.
DROP POLICY IF EXISTS rh_unif_est_read ON public.rh_uniformes_estoque;
DROP POLICY IF EXISTS rh_uniformes_estoque_select_staff ON public.rh_uniformes_estoque;
CREATE POLICY rh_uniformes_estoque_select_staff ON public.rh_uniformes_estoque
  FOR SELECT TO authenticated
  USING (public.rh_is_staff());

-- ---------------------------------------------------------------------------
-- 4) Move o filtro de "desligados" para dentro da RPC de vínculo.
--    Como rh_admissoes_desligamentos deixou de ser legível por todos, o
--    seletor de primeiro acesso/MeusKms (usuário ainda sem vínculo) não
--    conseguiria mais esconder os desligados no cliente. A RPC é SECURITY
--    DEFINER, então passa a aplicar esse filtro de forma confiável.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_list_funcionarios_para_vinculo()
RETURNS TABLE(id uuid, nome_completo text, cpf_masked text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    f.id,
    f.nome_completo,
    CASE
      WHEN f.cpf IS NULL OR length(regexp_replace(f.cpf, '\D', '', 'g')) < 11 THEN NULL
      ELSE '***.' || substring(regexp_replace(f.cpf, '\D', '', 'g') FROM 4 FOR 3)
           || '.' || substring(regexp_replace(f.cpf, '\D', '', 'g') FROM 7 FOR 3)
           || '-**'
    END AS cpf_masked
  FROM public.rh_funcionarios f
  WHERE NOT EXISTS (
    -- esconde funcionários já vinculados a outro user (evita duplicação)
    SELECT 1 FROM public.rh_user_roles ur
    WHERE ur.funcionario_id = f.id AND ur.user_id <> auth.uid() AND ur.status <> 'rejeitado'
  )
  AND COALESCE((
    -- esconde quem teve "desligamento" como evento mais recente
    SELECT ad.tipo
    FROM public.rh_admissoes_desligamentos ad
    WHERE ad.funcionario_id = f.id
    ORDER BY ad.data DESC, ad.created_at DESC
    LIMIT 1
  ), 'admissao') <> 'desligamento'
  ORDER BY f.nome_completo;
$$;

GRANT EXECUTE ON FUNCTION public.rh_list_funcionarios_para_vinculo() TO authenticated;
