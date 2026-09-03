-- Planos de sucessão (Pilares)
--
-- Estrutura: um plano por CARGO, com N candidatos. Os itens (linhas) pertencem ao
-- plano; as avaliações são as células do cruzamento item × candidato. Isso mantém
-- os candidatos comparáveis e evita duplicar a lista de itens por pessoa.
--
-- Escala de proficiência (0..4) em vez de binário Realizada/Não Realizada:
--   0 Não avaliado | 1 Não atende | 2 Em desenvolvimento | 3 Atende | 4 Referência
-- "Pronto" = nivel >= 3. O nível 4 (ensina) sinaliza se o plano é auto-sustentável.
--
-- Acesso: SOMENTE admin (rh_app_role 'admin'), em todas as tabelas. O candidato
-- não vê o plano — a coluna ciencia_candidato registra se a pessoa já foi informada,
-- para evitar divulgação acidental.

-- ---------------------------------------------------------------------------
-- 1. Critério de proficiência na atividade (global, reutilizável)
-- ---------------------------------------------------------------------------
-- Diferente de metodo_auditoria (restrito, é COMO se verifica sem a pessoa saber):
-- o critério é a régua declarada ao colaborador — "está pronto quando ...".
alter table rh.rh_atividades_auditoria
  add column if not exists criterio_proficiencia text;

comment on column rh.rh_atividades_auditoria.criterio_proficiencia is
  'Régua para considerar alguém plenamente capacitado nesta atividade. Visível ao colaborador (ao contrário de metodo_auditoria).';

-- ---------------------------------------------------------------------------
-- 2. Planos
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_sucessao_planos (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid not null references rh.rh_cargos(id) on delete restrict,
  titular_funcionario_id uuid references rh.rh_funcionarios(id) on delete set null,
  titulo text not null,
  situacao text not null default 'rascunho'
    check (situacao in ('rascunho','ativo','concluido','arquivado')),
  impacto_vacancia text not null default 'medio'
    check (impacto_vacancia in ('alto','medio','baixo')),
  risco_saida text not null default 'medio'
    check (risco_saida in ('alto','medio','baixo')),
  data_proxima_revisao date,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rh_sucessao_planos_cargo on rh.rh_sucessao_planos(cargo_id);
create index if not exists idx_rh_sucessao_planos_situacao on rh.rh_sucessao_planos(situacao);

-- ---------------------------------------------------------------------------
-- 3. Itens do plano (as LINHAS da planilha)
-- ---------------------------------------------------------------------------
-- Um item é (a) uma atividade do catálogo de auditoria, ou (b) um requisito de
-- texto livre (característica / experiência / disponibilidade) que não é atividade.
create table if not exists rh.rh_sucessao_itens (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references rh.rh_sucessao_planos(id) on delete cascade,
  categoria text not null default 'atividade'
    check (categoria in ('atividade','caracteristica','experiencia','disponibilidade')),
  atividade_id uuid references rh.rh_atividades_auditoria(id) on delete set null,
  titulo text,
  criterio_override text,
  avaliador_id uuid references rh.rh_funcionarios(id) on delete set null,
  peso numeric not null default 1,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- categoria 'atividade' exige atividade_id; as outras exigem titulo próprio
  constraint rh_sucessao_itens_origem_ck check (
    (categoria = 'atividade' and atividade_id is not null)
    or (categoria <> 'atividade' and titulo is not null and length(btrim(titulo)) > 0)
  )
);

create index if not exists idx_rh_sucessao_itens_plano on rh.rh_sucessao_itens(plano_id);
-- a mesma atividade não entra duas vezes no mesmo plano
create unique index if not exists uq_rh_sucessao_itens_plano_atividade
  on rh.rh_sucessao_itens(plano_id, atividade_id) where atividade_id is not null;

comment on column rh.rh_sucessao_itens.criterio_override is
  'Preencher só quando este cargo exige régua diferente da do catálogo. Nulo = herda rh_atividades_auditoria.criterio_proficiencia.';

-- ---------------------------------------------------------------------------
-- 4. Candidatos (as COLUNAS da planilha)
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_sucessao_candidatos (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references rh.rh_sucessao_planos(id) on delete cascade,
  funcionario_id uuid not null references rh.rh_funcionarios(id) on delete cascade,
  horizonte text not null default '1_2_anos'
    check (horizonte in ('emergencial','1_2_anos','3_mais_anos')),
  situacao text not null default 'ativo'
    check (situacao in ('ativo','pausado','descartado')),
  ciencia_candidato boolean not null default false,
  observacoes text,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plano_id, funcionario_id)
);

create index if not exists idx_rh_sucessao_candidatos_plano on rh.rh_sucessao_candidatos(plano_id);
create index if not exists idx_rh_sucessao_candidatos_func on rh.rh_sucessao_candidatos(funcionario_id);

comment on column rh.rh_sucessao_candidatos.ciencia_candidato is
  'A pessoa já foi informada de que é candidata? Guarda-corpo contra divulgação acidental em exports/conversas.';
comment on column rh.rh_sucessao_candidatos.horizonte is
  'emergencial = cobre a vaga amanhã (replacement); 1_2_anos / 3_mais_anos = sucessão desenvolvida.';

-- ---------------------------------------------------------------------------
-- 5. Avaliações (as CÉLULAS) — estado atual
-- ---------------------------------------------------------------------------
create table if not exists rh.rh_sucessao_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references rh.rh_sucessao_candidatos(id) on delete cascade,
  item_id uuid not null references rh.rh_sucessao_itens(id) on delete cascade,
  nivel smallint not null default 0 check (nivel between 0 and 4),
  data_alvo date,
  data_avaliacao date,
  avaliado_por uuid references rh.rh_funcionarios(id) on delete set null,
  evidencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidato_id, item_id)
);

create index if not exists idx_rh_sucessao_aval_candidato on rh.rh_sucessao_avaliacoes(candidato_id);
create index if not exists idx_rh_sucessao_aval_item on rh.rh_sucessao_avaliacoes(item_id);

comment on column rh.rh_sucessao_avaliacoes.nivel is
  '0 Não avaliado | 1 Não atende | 2 Em desenvolvimento | 3 Atende (pronto) | 4 Referência (ensina). Pronto = >= 3.';

-- ---------------------------------------------------------------------------
-- 6. Histórico de evolução
-- ---------------------------------------------------------------------------
-- Append-only: uma linha por mudança de nível, para desenhar a curva de prontidão
-- ao longo dos meses. Sobrevive à exclusão do item/candidato (mantém o registro
-- histórico), por isso guarda também os rótulos desnormalizados.
create table if not exists rh.rh_sucessao_avaliacoes_hist (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid references rh.rh_sucessao_planos(id) on delete cascade,
  candidato_id uuid,
  item_id uuid,
  funcionario_id uuid,
  item_titulo text,
  nivel_anterior smallint,
  nivel_novo smallint not null,
  alterado_por uuid references auth.users(id) on delete set null,
  alterado_em timestamptz not null default now()
);

create index if not exists idx_rh_sucessao_hist_plano on rh.rh_sucessao_avaliacoes_hist(plano_id, alterado_em);
create index if not exists idx_rh_sucessao_hist_candidato on rh.rh_sucessao_avaliacoes_hist(candidato_id, alterado_em);

-- Trigger: registra toda mudança de nível (inclusive a primeira avaliação)
create or replace function rh.rh_sucessao_log_nivel()
returns trigger
language plpgsql
security definer
set search_path = rh, public
as $$
declare
  v_plano_id uuid;
  v_funcionario_id uuid;
  v_titulo text;
begin
  if tg_op = 'UPDATE' and old.nivel = new.nivel then
    return new;
  end if;

  select c.plano_id, c.funcionario_id into v_plano_id, v_funcionario_id
  from rh.rh_sucessao_candidatos c where c.id = new.candidato_id;

  select coalesce(i.titulo, a.nome) into v_titulo
  from rh.rh_sucessao_itens i
  left join rh.rh_atividades_auditoria a on a.id = i.atividade_id
  where i.id = new.item_id;

  insert into rh.rh_sucessao_avaliacoes_hist
    (plano_id, candidato_id, item_id, funcionario_id, item_titulo,
     nivel_anterior, nivel_novo, alterado_por)
  values
    (v_plano_id, new.candidato_id, new.item_id, v_funcionario_id, v_titulo,
     case when tg_op = 'UPDATE' then old.nivel else null end, new.nivel, auth.uid());

  return new;
end;
$$;

drop trigger if exists trg_rh_sucessao_log_nivel on rh.rh_sucessao_avaliacoes;
create trigger trg_rh_sucessao_log_nivel
  after insert or update of nivel on rh.rh_sucessao_avaliacoes
  for each row execute function rh.rh_sucessao_log_nivel();

-- updated_at
drop trigger if exists trg_rh_sucessao_planos_updated on rh.rh_sucessao_planos;
create trigger trg_rh_sucessao_planos_updated before update on rh.rh_sucessao_planos
  for each row execute function public.rh_update_updated_at();

drop trigger if exists trg_rh_sucessao_itens_updated on rh.rh_sucessao_itens;
create trigger trg_rh_sucessao_itens_updated before update on rh.rh_sucessao_itens
  for each row execute function public.rh_update_updated_at();

drop trigger if exists trg_rh_sucessao_candidatos_updated on rh.rh_sucessao_candidatos;
create trigger trg_rh_sucessao_candidatos_updated before update on rh.rh_sucessao_candidatos
  for each row execute function public.rh_update_updated_at();

drop trigger if exists trg_rh_sucessao_avaliacoes_updated on rh.rh_sucessao_avaliacoes;
create trigger trg_rh_sucessao_avaliacoes_updated before update on rh.rh_sucessao_avaliacoes
  for each row execute function public.rh_update_updated_at();

-- ---------------------------------------------------------------------------
-- 7. RLS — somente admin
-- ---------------------------------------------------------------------------
alter table rh.rh_sucessao_planos            enable row level security;
alter table rh.rh_sucessao_itens             enable row level security;
alter table rh.rh_sucessao_candidatos        enable row level security;
alter table rh.rh_sucessao_avaliacoes        enable row level security;
alter table rh.rh_sucessao_avaliacoes_hist   enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'rh_sucessao_planos','rh_sucessao_itens','rh_sucessao_candidatos','rh_sucessao_avaliacoes'
  ] loop
    execute format('drop policy if exists "Admin gerencia %1$s" on rh.%1$I', t);
    execute format($p$
      create policy "Admin gerencia %1$s" on rh.%1$I
        for all to authenticated
        using (rh_has_role(auth.uid(), 'admin'::rh_app_role))
        with check (rh_has_role(auth.uid(), 'admin'::rh_app_role))
    $p$, t);
  end loop;
end $$;

-- Histórico é append-only: admin lê; a escrita é só pelo trigger (security definer).
drop policy if exists "Admin le historico sucessao" on rh.rh_sucessao_avaliacoes_hist;
create policy "Admin le historico sucessao" on rh.rh_sucessao_avaliacoes_hist
  for select to authenticated
  using (rh_has_role(auth.uid(), 'admin'::rh_app_role));

-- ---------------------------------------------------------------------------
-- 8. Grants — dado sensível: nada para anon
-- ---------------------------------------------------------------------------
revoke all on rh.rh_sucessao_planos            from anon;
revoke all on rh.rh_sucessao_itens             from anon;
revoke all on rh.rh_sucessao_candidatos        from anon;
revoke all on rh.rh_sucessao_avaliacoes        from anon;
revoke all on rh.rh_sucessao_avaliacoes_hist   from anon;

grant select, insert, update, delete on rh.rh_sucessao_planos          to authenticated;
grant select, insert, update, delete on rh.rh_sucessao_itens           to authenticated;
grant select, insert, update, delete on rh.rh_sucessao_candidatos      to authenticated;
grant select, insert, update, delete on rh.rh_sucessao_avaliacoes      to authenticated;
grant select                          on rh.rh_sucessao_avaliacoes_hist to authenticated;

-- ---------------------------------------------------------------------------
-- 9. A função de trigger não deve ser chamável como RPC
-- ---------------------------------------------------------------------------
-- Por privilégio default ela ficaria executável por anon/authenticated via
-- /rest/v1/rpc/. Trigger não precisa de EXECUTE para disparar (a checagem é no
-- CREATE TRIGGER), então revogamos.
revoke execute on function rh.rh_sucessao_log_nivel() from public;
revoke execute on function rh.rh_sucessao_log_nivel() from anon;
revoke execute on function rh.rh_sucessao_log_nivel() from authenticated;
