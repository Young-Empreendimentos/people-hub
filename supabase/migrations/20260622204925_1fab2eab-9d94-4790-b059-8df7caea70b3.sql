
-- 1) Tighten SELECT on rh_funcionarios
DROP POLICY IF EXISTS rh_read_all ON public.rh_funcionarios;
CREATE POLICY rh_funcionarios_select_scoped
  ON public.rh_funcionarios FOR SELECT
  TO authenticated
  USING (
    public.rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR public.rh_has_role(auth.uid(), 'usuario'::rh_app_role)
    OR id = public.rh_current_funcionario_id()
  );

-- 2) Safe list for primeiro-acesso (any authenticated user, but masked CPF, minimal fields)
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
  ORDER BY f.nome_completo;
$$;

GRANT EXECUTE ON FUNCTION public.rh_list_funcionarios_para_vinculo() TO authenticated;
