-- Config de KM (linha única). Guarda a data-limite de liberação de lançamento
-- retroativo: enquanto hoje <= retroativo_ate, o "Meus KMs" também aceita o
-- período anterior. Passada a data, fecha sozinho.
create table if not exists public.rh_km_config (
  id integer primary key default 1,
  retroativo_ate date,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint rh_km_config_singleton check (id = 1)
);

insert into public.rh_km_config (id) values (1) on conflict (id) do nothing;

alter table public.rh_km_config enable row level security;

-- Leitura por qualquer autenticado (o colaborador precisa saber se está liberado).
-- Só expõe uma data — sem dado sensível.
drop policy if exists rh_km_config_read on public.rh_km_config;
create policy rh_km_config_read on public.rh_km_config
  for select to authenticated using (true);

-- Só admin/coordenador altera a liberação.
drop policy if exists rh_km_config_update on public.rh_km_config;
create policy rh_km_config_update on public.rh_km_config
  for update to authenticated
  using (rh_has_role(auth.uid(),'admin'::rh_app_role) or rh_has_role(auth.uid(),'coordenador'::rh_app_role))
  with check (rh_has_role(auth.uid(),'admin'::rh_app_role) or rh_has_role(auth.uid(),'coordenador'::rh_app_role));
