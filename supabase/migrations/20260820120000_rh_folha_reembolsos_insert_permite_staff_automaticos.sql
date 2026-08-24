-- Ao salvar a folha, os reembolsos AUTOMÁTICOS (origem 'km' e 'beneficio_moradia')
-- entram como 'aprovado' independente do papel — mas a policy antiga só deixava
-- 'usuario' inserir reembolso 'manual'/'pendente'. Isso quebrava o salvamento da
-- folha por um usuário comum (erro RLS "new row violates row-level security policy
-- for table rh_folha_reembolsos" ao importar KM). Antes da migração de schema o erro
-- não aparecia porque as views de compat em `public` furavam a RLS.
-- Correção: qualquer staff pode inserir reembolso NÃO-manual (km/moradia);
-- o manual segue exigindo status 'pendente' + criado_por para 'usuario'.
drop policy if exists "Insert folha reembolsos" on rh.rh_folha_reembolsos;
create policy "Insert folha reembolsos" on rh.rh_folha_reembolsos
  for insert to authenticated
  with check (
    rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR (rh_is_staff() AND origem <> 'manual')
    OR (rh_has_role(auth.uid(), 'usuario'::rh_app_role) AND status = 'pendente' AND criado_por = auth.uid())
  );
