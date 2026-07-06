-- Permite que o próprio usuário (re)solicite acesso como colaborador (+ auditor),
-- inclusive após ter sido recusado. SECURITY DEFINER porque o RLS de rh_user_roles
-- não permite ao usuário apagar/atualizar a própria linha (só inserir 'pendente'),
-- e há UNIQUE(user_id, role) que impediria um novo INSERT sobre a linha recusada.
-- Segurança: sempre amarrado a auth.uid() e limitado a colaborador/auditor 'pendente';
-- nunca cria/edita papel de staff.
create or replace function public.rh_solicitar_acesso(p_funcionario_id uuid, p_is_auditor boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select nome_completo into v_nome from public.rh_funcionarios where id = p_funcionario_id;

  -- limpa apenas pedidos/papéis self-service anteriores DESTE usuário
  delete from public.rh_user_roles
    where user_id = auth.uid() and role in ('colaborador'::rh_app_role, 'auditor'::rh_app_role);

  insert into public.rh_user_roles (user_id, role, status, funcionario_id, nome)
    values (auth.uid(), 'colaborador'::rh_app_role, 'pendente', p_funcionario_id, v_nome);

  if p_is_auditor then
    insert into public.rh_user_roles (user_id, role, status, nome)
      values (auth.uid(), 'auditor'::rh_app_role, 'pendente', v_nome);
  end if;
end $$;

grant execute on function public.rh_solicitar_acesso(uuid, boolean) to authenticated;
