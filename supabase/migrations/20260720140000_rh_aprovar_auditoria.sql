-- Aprovação/rejeição de auditoria (só admin). Move uma auditoria 'finalizada'
-- (aguardando aprovação) para 'aprovada' ou 'rejeitada', registrando quem e quando.
create or replace function public.rh_aprovar_auditoria(
  p_auditoria_id uuid,
  p_aprovar boolean,
  p_motivo text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_status rh_auditoria_status;
begin
  if not public.rh_has_role(auth.uid(), 'admin'::rh_app_role) then
    raise exception 'Somente administradores podem aprovar ou rejeitar auditorias.';
  end if;

  select status into v_status from public.rh_auditorias where id = p_auditoria_id;
  if v_status is null then
    raise exception 'Auditoria não encontrada.';
  end if;
  if v_status <> 'finalizada'::rh_auditoria_status then
    raise exception 'Só é possível aprovar/rejeitar auditorias que estão aguardando aprovação.';
  end if;

  update public.rh_auditorias
     set status = case when p_aprovar then 'aprovada'::rh_auditoria_status
                       else 'rejeitada'::rh_auditoria_status end,
         aprovado_por = auth.uid(),
         aprovado_em = now(),
         rejeitado_motivo = case when p_aprovar then null else nullif(btrim(coalesce(p_motivo,'')), '') end,
         updated_at = now()
   where id = p_auditoria_id;
end $$;

grant execute on function public.rh_aprovar_auditoria(uuid, boolean, text) to authenticated;
