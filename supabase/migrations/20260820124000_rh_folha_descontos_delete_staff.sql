-- O salvamento da folha apaga-e-recria a lista de descontos a cada save.
-- A trava de 30 dias no DELETE (rh_folha_descontos_delete_regra_30d) bloqueava,
-- em silêncio, o DELETE por um usuário em folhas com mais de 30 dias, e o INSERT
-- (with_check = true) recriava → descontos DUPLICADOS. Como INSERT/UPDATE/SELECT
-- já são abertos, a trava protegia pouco. Alinhando o DELETE ao staff (quem edita
-- folha): admin/coord/usuario. Colaborador não deleta descontos.
drop policy if exists "rh_folha_descontos_delete_regra_30d" on rh.rh_folha_descontos;
create policy "rh_folha_descontos_delete_staff" on rh.rh_folha_descontos
  for delete to authenticated
  using ( rh_is_staff() );
