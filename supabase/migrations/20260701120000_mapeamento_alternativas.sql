-- Mapeamento de Alternativas (sucessão / substituição de cargos estratégicos).
-- Mudança 100% aditiva: cria apenas objetos novos, nenhuma tabela existente é alterada.

-- 1) Cargos escolhidos para mapear
create table if not exists public.rh_mapeamento_cargos (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid not null references public.rh_cargos(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (cargo_id)
);

-- 2) Candidatos (alternativas) por cargo
create table if not exists public.rh_mapeamento_alternativas (
  id uuid primary key default gen_random_uuid(),
  mapeamento_cargo_id uuid not null references public.rh_mapeamento_cargos(id) on delete cascade,
  origem text not null check (origem in ('manual','talents')),
  talents_candidate_id uuid,
  talents_mapping_id uuid,
  nome text not null,
  cargo_atual text,
  observacoes text,
  aderencia text not null default 'possibilidade' check (aderencia in ('pleno','parcial','possibilidade')),
  aprovado_em timestamptz,
  aprovado_por uuid,
  aprovado_por_nome text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists idx_rh_map_alt_cargo
  on public.rh_mapeamento_alternativas(mapeamento_cargo_id);

-- 3) RLS
alter table public.rh_mapeamento_cargos enable row level security;
alter table public.rh_mapeamento_alternativas enable row level security;

-- SELECT: apenas staff (admin/coordenador/usuario). Colaborador não vê.
create policy rh_map_cargos_select_staff on public.rh_mapeamento_cargos
  for select to authenticated using (public.rh_is_staff());
create policy rh_map_alt_select_staff on public.rh_mapeamento_alternativas
  for select to authenticated using (public.rh_is_staff());

-- INSERT/UPDATE/DELETE: admin ou coordenador
create policy rh_map_cargos_insert on public.rh_mapeamento_cargos
  for insert to authenticated
  with check (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
           or public.rh_has_role(auth.uid(),'coordenador'::rh_app_role));
create policy rh_map_cargos_update on public.rh_mapeamento_cargos
  for update to authenticated
  using (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
      or public.rh_has_role(auth.uid(),'coordenador'::rh_app_role));
create policy rh_map_cargos_delete on public.rh_mapeamento_cargos
  for delete to authenticated
  using (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
      or public.rh_has_role(auth.uid(),'coordenador'::rh_app_role));

create policy rh_map_alt_insert on public.rh_mapeamento_alternativas
  for insert to authenticated
  with check (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
           or public.rh_has_role(auth.uid(),'coordenador'::rh_app_role));
create policy rh_map_alt_update on public.rh_mapeamento_alternativas
  for update to authenticated
  using (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
      or public.rh_has_role(auth.uid(),'coordenador'::rh_app_role));
create policy rh_map_alt_delete on public.rh_mapeamento_alternativas
  for delete to authenticated
  using (public.rh_has_role(auth.uid(),'admin'::rh_app_role)
      or public.rh_has_role(auth.uid(),'coordenador'::rh_app_role));

-- 4) Trava: só admin pode alterar os campos de aprovação (defesa mesmo se coordenador
--    tentar UPDATE direto contornando a RPC).
create or replace function public.rh_mapeamento_alt_approval_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.aprovado_em      is distinct from old.aprovado_em
      or new.aprovado_por     is distinct from old.aprovado_por
      or new.aprovado_por_nome is distinct from old.aprovado_por_nome)
     and not public.rh_has_role(auth.uid(),'admin'::rh_app_role) then
    raise exception 'Somente administradores podem alterar a aprovacao.';
  end if;
  return new;
end;
$$;

drop trigger if exists rh_map_alt_approval_guard on public.rh_mapeamento_alternativas;
create trigger rh_map_alt_approval_guard
  before update on public.rh_mapeamento_alternativas
  for each row execute function public.rh_mapeamento_alt_approval_guard();

-- 5) Aprovar / revalidar (admin) — carimba data + quem aprovou
create or replace function public.rh_aprovar_alternativa(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if not public.rh_has_role(auth.uid(),'admin'::rh_app_role) then
    raise exception 'Somente administradores podem aprovar.';
  end if;
  select nome into v_nome
    from public.rh_user_roles
    where user_id = auth.uid() and nome is not null
    limit 1;
  update public.rh_mapeamento_alternativas
    set aprovado_em = now(), aprovado_por = auth.uid(), aprovado_por_nome = v_nome
    where id = p_id;
end;
$$;

-- 6) Revogar aprovação (admin) — volta para pendente
create or replace function public.rh_revogar_alternativa(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.rh_has_role(auth.uid(),'admin'::rh_app_role) then
    raise exception 'Somente administradores podem revogar aprovacao.';
  end if;
  update public.rh_mapeamento_alternativas
    set aprovado_em = null, aprovado_por = null, aprovado_por_nome = null
    where id = p_id;
end;
$$;

grant execute on function public.rh_aprovar_alternativa(uuid) to authenticated;
grant execute on function public.rh_revogar_alternativa(uuid) to authenticated;
