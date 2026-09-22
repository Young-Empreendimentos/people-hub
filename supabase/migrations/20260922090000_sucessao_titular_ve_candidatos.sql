-- Titular pode ver o progresso dos candidatos, por opção do admin
--
-- Até aqui, todo destinatário via apenas a própria coluna. Para o titular do
-- cargo isso produzia uma tela enganosa: sem linha de candidato, todos os itens
-- apareciam como "Não avaliado" — mesmo com o candidato 84% pronto.
--
-- Agora o admin decide por plano, via publicacao_campos.titular_ve_candidatos.
-- A permissão é dupla: só vale para quem É o titular do plano E só quando o
-- próprio campo "nivel" está publicado — senão os níveis entrariam por uma porta
-- lateral, sem o admin ter liberado níveis.
--
-- Candidatos continuam vendo só a si: a exceção é exclusiva do titular.

create or replace function public.rh_sucessao_plano_publicado(
  p_plano_id uuid,
  p_como_funcionario uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = rh, public
as $fn$
declare
  v_func          uuid;
  v_preview       boolean := p_como_funcionario is not null;
  v_plano         rh.rh_sucessao_planos;
  v_campos        jsonb;
  v_cand          rh.rh_sucessao_candidatos;
  v_itens         jsonb;
  v_prontidao     int;
  v_ve_candidatos boolean;
  v_candidatos    jsonb;
begin
  select * into v_plano from rh.rh_sucessao_planos where id = p_plano_id;
  if not found then
    raise exception 'Plano não encontrado';
  end if;

  if v_preview then
    if not public.rh_has_role(auth.uid(), 'admin'::rh_app_role) then
      raise exception 'Somente admin pode pré-visualizar a publicação';
    end if;
    v_func := p_como_funcionario;
  else
    v_func := public.rh_current_funcionario_id();
    if v_func is null then
      raise exception 'Usuário sem funcionário vinculado';
    end if;
    if not v_plano.publicado then
      raise exception 'Plano não está publicado';
    end if;
    if not exists (
      select 1 from rh.rh_sucessao_publicacao_destinatarios d
      where d.plano_id = p_plano_id and d.funcionario_id = v_func
    ) then
      raise exception 'Plano não disponibilizado para este usuário';
    end if;
  end if;

  v_campos := coalesce(v_plano.publicacao_campos, '{}'::jsonb);

  select * into v_cand
  from rh.rh_sucessao_candidatos c
  where c.plano_id = p_plano_id
    and c.funcionario_id = v_func
    and c.situacao <> 'descartado'
  limit 1;

  -- Dupla trava: precisa ser o titular E os níveis precisam estar publicados.
  v_ve_candidatos :=
        coalesce((v_campos->>'titular_ve_candidatos')::boolean, false)
    and coalesce((v_campos->>'nivel')::boolean, false)
    and v_plano.titular_funcionario_id is not distinct from v_func;

  if v_ve_candidatos then
    select coalesce(jsonb_agg(
             jsonb_build_object(
               'id', c.id,
               'nome', f.nome_completo,
               'horizonte', c.horizonte,
               'prontidao', (
                 select case when sum(i2.peso) > 0
                   then round(100.0 * sum(case when coalesce(av3.nivel,0) >= 3 then i2.peso else 0 end) / sum(i2.peso))
                   else 0 end
                 from rh.rh_sucessao_itens i2
                 left join rh.rh_sucessao_avaliacoes av3
                   on av3.item_id = i2.id and av3.candidato_id = c.id
                 where i2.plano_id = p_plano_id and i2.ativo
               )
             ) order by c.ordem
           ), '[]'::jsonb)
      into v_candidatos
    from rh.rh_sucessao_candidatos c
    join rh.rh_funcionarios f on f.id = c.funcionario_id
    where c.plano_id = p_plano_id and c.situacao <> 'descartado';
  end if;

  select coalesce(jsonb_agg(t.obj order by t.ordem), '[]'::jsonb) into v_itens
  from (
    select
      i.ordem,
      (
        jsonb_build_object(
          'id', i.id,
          'categoria', i.categoria,
          'titulo', case when i.categoria = 'atividade'
                         then coalesce(a.nome, '(atividade removida)')
                         else i.titulo end,
          'grupo', case when i.categoria = 'atividade' then g.nome else null end,
          'criterio', coalesce(nullif(btrim(i.criterio_override), ''), a.criterio_proficiencia),
          'plano_treinamento', i.plano_treinamento,
          'peso', i.peso,
          'nivel', av.nivel,
          'data_alvo', av.data_alvo,
          'evidencia', av.evidencia,
          'niveis', case when v_ve_candidatos then (
            select coalesce(jsonb_object_agg(c2.id::text, av2.nivel), '{}'::jsonb)
            from rh.rh_sucessao_candidatos c2
            left join rh.rh_sucessao_avaliacoes av2
              on av2.candidato_id = c2.id and av2.item_id = i.id
            where c2.plano_id = p_plano_id and c2.situacao <> 'descartado'
          ) else null end
        )
        - (case when coalesce((v_campos->>'grupo')::boolean, false)       then '' else 'grupo' end)
        - (case when coalesce((v_campos->>'criterio')::boolean, false)    then '' else 'criterio' end)
        - (case when coalesce((v_campos->>'treinamento')::boolean, false) then '' else 'plano_treinamento' end)
        - (case when coalesce((v_campos->>'peso')::boolean, false)        then '' else 'peso' end)
        - (case when coalesce((v_campos->>'nivel')::boolean, false)       then '' else 'nivel' end)
        - (case when coalesce((v_campos->>'data_alvo')::boolean, false)   then '' else 'data_alvo' end)
        - (case when coalesce((v_campos->>'evidencia')::boolean, false)   then '' else 'evidencia' end)
        - (case when v_ve_candidatos then '' else 'niveis' end)
      ) as obj
    from rh.rh_sucessao_itens i
    left join rh.rh_atividades_auditoria a on a.id = i.atividade_id
    left join rh.rh_grupos_atividades_auditoria g on g.id = a.grupo_id
    left join rh.rh_sucessao_avaliacoes av
      on av.item_id = i.id and av.candidato_id = v_cand.id
    where i.plano_id = p_plano_id and i.ativo
  ) t;

  if coalesce((v_campos->>'prontidao')::boolean, false) and v_cand.id is not null then
    select case when sum(i.peso) > 0
                then round(100.0 * sum(case when coalesce(av.nivel,0) >= 3 then i.peso else 0 end) / sum(i.peso))
                else 0 end
      into v_prontidao
    from rh.rh_sucessao_itens i
    left join rh.rh_sucessao_avaliacoes av
      on av.item_id = i.id and av.candidato_id = v_cand.id
    where i.plano_id = p_plano_id and i.ativo;
  end if;

  -- Segue sem impacto_vacancia, risco_saida e observacoes.
  return jsonb_build_object(
    'plano', jsonb_build_object(
      'id', v_plano.id,
      'titulo', v_plano.titulo,
      'cargo', (select c.nome from rh.rh_cargos c where c.id = v_plano.cargo_id),
      'titular', (select f.nome_completo from rh.rh_funcionarios f where f.id = v_plano.titular_funcionario_id),
      'publicado', v_plano.publicado,
      'publicado_em', v_plano.publicado_em
    ),
    'campos', v_campos,
    'eu', jsonb_build_object(
      'funcionario_id', v_func,
      'nome', (select f.nome_completo from rh.rh_funcionarios f where f.id = v_func),
      'e_candidato', v_cand.id is not null,
      'e_titular', v_plano.titular_funcionario_id is not distinct from v_func
    ),
    'prontidao', v_prontidao,
    'preview', v_preview,
    'candidatos', v_candidatos,
    'itens', v_itens
  );
end;
$fn$;
