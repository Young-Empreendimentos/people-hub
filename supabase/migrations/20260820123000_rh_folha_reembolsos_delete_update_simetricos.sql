-- Complemento da correção do salvamento da folha após a ida das tabelas para o
-- schema `rh` (RLS agora aplicada de fato). Além do INSERT (migração anterior),
-- o salvamento também APAGA-e-RECRIA os reembolsos automáticos (km/moradia) e
-- ATUALIZA reembolsos manuais. Sem estas policies, para um usuário comum:
--   * o DELETE dos reembolsos de moradia era bloqueado em silêncio (RLS filtra
--     sem erro) e o INSERT recriava → reembolso de moradia DUPLICADO a cada save;
--   * o UPDATE de um reembolso manual era ignorado em silêncio.
-- Correção: DELETE simétrico ao INSERT (staff mexe nos automáticos não-manuais;
-- usuário no próprio manual pendente) e UPDATE liberado ao usuário só no próprio
-- manual pendente — o with_check impede virar 'aprovado' (sem auto-aprovação).

-- DELETE
drop policy if exists "Delete folha reembolsos" on rh.rh_folha_reembolsos;
create policy "Delete folha reembolsos" on rh.rh_folha_reembolsos
  for delete to authenticated
  using (
    rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR (rh_is_staff() AND origem <> 'manual')
    OR (rh_has_role(auth.uid(), 'usuario'::rh_app_role) AND status = 'pendente' AND criado_por = auth.uid())
  );

-- UPDATE
drop policy if exists "Admin/coord update folha reembolsos" on rh.rh_folha_reembolsos;
drop policy if exists "Update folha reembolsos" on rh.rh_folha_reembolsos;
create policy "Update folha reembolsos" on rh.rh_folha_reembolsos
  for update to authenticated
  using (
    rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR (rh_has_role(auth.uid(), 'usuario'::rh_app_role) AND status = 'pendente' AND criado_por = auth.uid())
  )
  with check (
    rh_has_role(auth.uid(), 'admin'::rh_app_role)
    OR rh_has_role(auth.uid(), 'coordenador'::rh_app_role)
    OR (rh_has_role(auth.uid(), 'usuario'::rh_app_role) AND status = 'pendente' AND criado_por = auth.uid())
  );
