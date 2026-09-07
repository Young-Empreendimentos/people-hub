-- Conclusão de plano = "há candidato apto", com validade de 6 meses
--
-- Concluir um plano não o encerra: significa que existe candidato apto para o
-- cargo. O cargo segue coberto (e o plano segue no dashboard), mas a aptidão
-- precisa ser reconfirmada a cada 6 meses. Só arquivar ou excluir tira a
-- cobertura — aí o cargo volta a aparecer como em aberto.
--
-- Para medir os 6 meses é preciso saber QUANDO foi concluído, daí esta coluna.

alter table rh.rh_sucessao_planos
  add column if not exists data_conclusao date;

comment on column rh.rh_sucessao_planos.data_conclusao is
  'Quando o plano foi concluído, isto é, quando um candidato foi declarado apto. A aptidão vale MESES_VALIDADE_APTIDAO (6, em src/lib/sucessao.ts). Preenchida/limpa automaticamente pelo trigger conforme a situação.';

-- Mantém data_conclusao coerente com situacao sem depender do cliente:
--   entra em 'concluido'  -> estampa a data (respeitando uma data informada)
--   sai   de 'concluido'  -> limpa, porque não há mais aptidão declarada
-- Reconcluir depois de sair reinicia os 6 meses, que é o comportamento desejado:
-- é uma nova confirmação de aptidão.
create or replace function rh.rh_sucessao_sync_data_conclusao()
returns trigger
language plpgsql
as $$
begin
  if new.situacao = 'concluido' then
    if tg_op = 'INSERT' or old.situacao is distinct from 'concluido' then
      new.data_conclusao := coalesce(new.data_conclusao, current_date);
    end if;
  else
    new.data_conclusao := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rh_sucessao_data_conclusao on rh.rh_sucessao_planos;
create trigger trg_rh_sucessao_data_conclusao
  before insert or update of situacao, data_conclusao on rh.rh_sucessao_planos
  for each row execute function rh.rh_sucessao_sync_data_conclusao();

-- Planos já concluídos antes desta migration não têm data; usa-se a última
-- atualização como melhor aproximação disponível.
update rh.rh_sucessao_planos
set data_conclusao = updated_at::date
where situacao = 'concluido' and data_conclusao is null;

-- Trigger não precisa de EXECUTE para disparar, e não deve ser chamável como RPC.
revoke execute on function rh.rh_sucessao_sync_data_conclusao() from public;
revoke execute on function rh.rh_sucessao_sync_data_conclusao() from anon;
revoke execute on function rh.rh_sucessao_sync_data_conclusao() from authenticated;
