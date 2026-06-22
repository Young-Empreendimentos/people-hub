CREATE OR REPLACE FUNCTION public.rh_list_funcionarios_para_vinculo()
RETURNS TABLE(id uuid, nome_completo text, cpf_masked text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH dedup AS (
    SELECT DISTINCT ON (
      lower(btrim(f.nome_completo)),
      regexp_replace(coalesce(f.cpf,''), '\D', '', 'g')
    )
      f.id, f.nome_completo, f.cpf, f.created_at
    FROM public.rh_funcionarios f
    WHERE NOT EXISTS (
      SELECT 1 FROM public.rh_user_roles ur
      WHERE ur.funcionario_id = f.id
        AND ur.user_id <> auth.uid()
        AND ur.status <> 'rejeitado'
    )
    ORDER BY
      lower(btrim(f.nome_completo)),
      regexp_replace(coalesce(f.cpf,''), '\D', '', 'g'),
      f.created_at DESC NULLS LAST,
      f.id
  )
  SELECT
    d.id,
    d.nome_completo,
    CASE
      WHEN d.cpf IS NULL OR length(regexp_replace(d.cpf,'\D','','g')) < 11 THEN NULL
      ELSE '***.' || substring(regexp_replace(d.cpf,'\D','','g') FROM 4 FOR 3)
           || '.' || substring(regexp_replace(d.cpf,'\D','','g') FROM 7 FOR 3)
           || '-**'
    END AS cpf_masked
  FROM dedup d
  ORDER BY d.nome_completo;
$$;