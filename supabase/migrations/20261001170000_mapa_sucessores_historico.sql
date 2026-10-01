-- Histórico das indicações do mapa de sucessão
--
-- A aprovação vencida já aparecia (a indicação fica, marcada "vencida", e só
-- deixa de contar). Mas duas coisas se perdiam:
--   - revalidar sobrescrevia aprovado_em: a aprovação anterior sumia;
--   - remover a indicação apagava tudo: se a pessoa fosse indicada de novo,
--     ninguém saberia que ela já tinha sido aprovada (e por quem, e quando).
--
-- Cada evento vira uma linha aqui, gravada por trigger (o usuário não escreve):
--   indicado | aprovado | revalidado | cobertura | removido
-- Sem FK para rh_mapa_sucessores de propósito: o histórico sobrevive à remoção.
-- Os nomes vão junto pelo mesmo motivo.

create table if not exists rh.rh_mapa_sucessores_hist (
  id uuid primary key default gen_random_uuid(),
  sucessor_id uuid not null,
  funcao_id uuid not null,
  equipe_id uuid not null,
  cidade_ibge integer,
  titular_funcionario_id uuid,
  funcionario_id uuid not null,
  funcionario_nome text,
  evento text not null check (evento in ('indicado', 'aprovado', 'revalidado', 'cobertura', 'removido')),
  cobertura text,
  detalhe text,
  por uuid,
  por_nome text,
  em timestamptz not null default now()
);

create index if not exists idx_rh_mapa_sucessores_hist_posicao
  on rh.rh_mapa_sucessores_hist (funcao_id, equipe_id, cidade_ibge, em desc);

comment on table rh.rh_mapa_sucessores_hist is
  'Eventos das indicações do mapa de sucessão (indicação, aprovação, revalidação, mudança de cobertura, remoção). Gravado por trigger; sobrevive à remoção da indicação.';

alter table rh.rh_mapa_sucessores_hist enable row level security;
drop policy if exists "Admin e coordenador leem historico de indicacoes" on rh.rh_mapa_sucessores_hist;
create policy "Admin e coordenador leem historico de indicacoes" on rh.rh_mapa_sucessores_hist
  for select to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role) or public.rh_has_role(auth.uid(), 'coordenador'::rh_app_role));
revoke all on rh.rh_mapa_sucessores_hist from anon, authenticated;
grant select on rh.rh_mapa_sucessores_hist to authenticated;

create or replace function rh.rh_mapa_sucessores_registrar()
returns trigger
language plpgsql
security definer
set search_path = rh, public
as $$
declare
  v_nome text;
  r rh.rh_mapa_sucessores;
  v_func text;
  v_situacao text;
begin
  select nome into v_nome from rh.rh_user_roles where user_id = auth.uid() and nome is not null limit 1;
  r := case when tg_op = 'DELETE' then old else new end;
  select nome_completo into v_func from rh.rh_funcionarios where id = r.funcionario_id;

  if tg_op = 'INSERT' then
    insert into rh.rh_mapa_sucessores_hist (sucessor_id, funcao_id, equipe_id, cidade_ibge, titular_funcionario_id,
      funcionario_id, funcionario_nome, evento, cobertura, detalhe, por, por_nome)
    values (r.id, r.funcao_id, r.equipe_id, r.cidade_ibge, r.titular_funcionario_id, r.funcionario_id, v_func,
      'indicado', r.cobertura, r.observacoes, auth.uid(), v_nome);
    if r.aprovado_em is not null then
      insert into rh.rh_mapa_sucessores_hist (sucessor_id, funcao_id, equipe_id, cidade_ibge, titular_funcionario_id,
        funcionario_id, funcionario_nome, evento, cobertura, detalhe, por, por_nome, em)
      values (r.id, r.funcao_id, r.equipe_id, r.cidade_ibge, r.titular_funcionario_id, r.funcionario_id, v_func,
        'aprovado', r.cobertura, 'indicado por admin', r.aprovado_por, r.aprovado_por_nome, r.aprovado_em);
    end if;

  elsif tg_op = 'UPDATE' then
    if new.aprovado_em is distinct from old.aprovado_em and new.aprovado_em is not null then
      insert into rh.rh_mapa_sucessores_hist (sucessor_id, funcao_id, equipe_id, cidade_ibge, titular_funcionario_id,
        funcionario_id, funcionario_nome, evento, cobertura, detalhe, por, por_nome, em)
      values (r.id, r.funcao_id, r.equipe_id, r.cidade_ibge, r.titular_funcionario_id, r.funcionario_id, v_func,
        case when old.aprovado_em is null then 'aprovado' else 'revalidado' end, new.cobertura,
        case when old.aprovado_em is not null
             then 'aprovação anterior: ' || to_char(old.aprovado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
                  || case when old.aprovado_em + interval '6 months' < now() then ' (vencida)' else '' end
        end,
        new.aprovado_por, new.aprovado_por_nome, new.aprovado_em);
    end if;
    if new.cobertura is distinct from old.cobertura then
      insert into rh.rh_mapa_sucessores_hist (sucessor_id, funcao_id, equipe_id, cidade_ibge, titular_funcionario_id,
        funcionario_id, funcionario_nome, evento, cobertura, detalhe, por, por_nome)
      values (r.id, r.funcao_id, r.equipe_id, r.cidade_ibge, r.titular_funcionario_id, r.funcionario_id, v_func,
        'cobertura', new.cobertura, old.cobertura || ' → ' || new.cobertura, auth.uid(), v_nome);
    end if;

  else -- DELETE
    v_situacao := case when old.aprovado_em is null then 'pendente'
                       when old.aprovado_em + interval '6 months' < now() then 'aprovação vencida'
                       else 'aprovada' end;
    insert into rh.rh_mapa_sucessores_hist (sucessor_id, funcao_id, equipe_id, cidade_ibge, titular_funcionario_id,
      funcionario_id, funcionario_nome, evento, cobertura, detalhe, por, por_nome)
    values (r.id, r.funcao_id, r.equipe_id, r.cidade_ibge, r.titular_funcionario_id, r.funcionario_id, v_func,
      'removido', old.cobertura,
      'estava ' || v_situacao
        || case when old.aprovado_em is not null
                then ' (aprovada em ' || to_char(old.aprovado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ')' else '' end,
      auth.uid(), v_nome);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_rh_mapa_sucessores_registrar on rh.rh_mapa_sucessores;
create trigger trg_rh_mapa_sucessores_registrar
  after insert or update or delete on rh.rh_mapa_sucessores
  for each row execute function rh.rh_mapa_sucessores_registrar();

revoke execute on function rh.rh_mapa_sucessores_registrar() from public, anon, authenticated;
