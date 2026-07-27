-- Rede de segurança: se um reembolso de KM for excluído (por qualquer caminho —
-- edição de folha, exclusão de folha, etc.), os lançamentos de KM voltam para
-- "aprovado" (re-importáveis) em vez de ficarem órfãos presos como "pago".
create or replace function public.rh_km_reverter_ao_excluir_reembolso()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.rh_km_lancamentos
     set status = 'aprovado', folha_reembolso_id = null, updated_at = now()
   where folha_reembolso_id = old.id;
  return old;
end $$;

drop trigger if exists trg_km_reverter_ao_excluir_reembolso on public.rh_folha_reembolsos;
create trigger trg_km_reverter_ao_excluir_reembolso
  before delete on public.rh_folha_reembolsos
  for each row execute function public.rh_km_reverter_ao_excluir_reembolso();
