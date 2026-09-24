-- Mapeamento de Alternativas: remove privilégios desnecessários
--
-- As duas tabelas nasceram com os privilégios padrão do Supabase, que dão ao
-- `anon` tudo — inclusive TRUNCATE, que não passa por RLS. Não era uma brecha
-- ativa (o RLS bloqueia leitura e escrita de quem não está logado, e a API não
-- expõe TRUNCATE), mas não há motivo para `anon` ter qualquer privilégio aqui:
-- são candidatos externos a cargos estratégicos, dado sensível.
--
-- O `authenticated` fica só com o que a tela usa. O RLS continua decidindo
-- quem vê (staff) e quem edita (admin/coordenador).
--
-- rh.talents_mappings fica de fora de propósito: é tabela do sistema Talents.

revoke all on rh.rh_mapeamento_cargos       from anon, authenticated;
revoke all on rh.rh_mapeamento_alternativas from anon, authenticated;

grant select, insert, update, delete on rh.rh_mapeamento_cargos       to authenticated;
grant select, insert, update, delete on rh.rh_mapeamento_alternativas to authenticated;
