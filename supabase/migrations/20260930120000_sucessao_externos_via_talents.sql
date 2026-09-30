-- Alternativas externas passam a ser mapeamentos do Talents
--
-- Antes: o botão "Do Talents" COPIAVA nome e observações para
-- rh_sucessao_externos, e daí em diante os sistemas não se falavam — se o Talents
-- descartasse ou contratasse a pessoa, o plano seguia contando com ela.
--
-- Agora todo externo existe no Talents (decisão de 30/09/2026) e a alternativa é
-- um MARCADOR sobre o mapeamento: "este mapeamento é alternativa externa para a
-- função dele". Nome, cidade, função e status são lidos ao vivo do Talents; aqui
-- ficam só o juízo da sucessão — aderência e aprovação (6 meses).
--
-- Por que um marcador em tabela própria, e não um nível em talents_mappings:
-- talents_mappings é lida por todo o staff do Talents, e entre os admins do
-- Talents há titulares de planos de sucessão. Esta tabela segue a regra do plano
-- de sucessão: só admin do Pilares. Para o resto do Talents, a pessoa aparece
-- como "forte" (o trigger abaixo garante).
--
-- O plano é por função; o externo entra no plano da função do mapeamento. Por
-- isso não há plano_id: arquivar um plano e abrir outro para a mesma função não
-- perde as alternativas.
--
-- Depende da migration 055 do Talents (talents_mappings.funcao_id / nivel).
-- A tabela anterior estava vazia (conferido na hora de aplicar).

do $$
begin
  if exists (select 1 from rh.rh_sucessao_externos) then
    raise exception 'rh_sucessao_externos tem dados: migrar em vez de recriar';
  end if;
end $$;

drop table rh.rh_sucessao_externos;

create table rh.rh_sucessao_externos (
  id uuid primary key default gen_random_uuid(),
  talents_mapping_id uuid not null unique references rh.talents_mappings(id) on delete cascade,
  aderencia text not null default 'possibilidade'
    check (aderencia in ('pleno', 'parcial', 'possibilidade')),
  aprovado_em timestamptz,
  aprovado_por uuid references auth.users(id) on delete set null,
  aprovado_por_nome text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table rh.rh_sucessao_externos is
  'Marca um mapeamento do Talents como alternativa externa para a função dele, com aderência e aprovação (6 meses). Só admin do Pilares. Com aprovação válida e mapeamento ativo, cobre a função parcialmente.';

drop trigger if exists trg_rh_sucessao_externos_updated on rh.rh_sucessao_externos;
create trigger trg_rh_sucessao_externos_updated before update on rh.rh_sucessao_externos
  for each row execute function public.rh_update_updated_at();

alter table rh.rh_sucessao_externos enable row level security;

drop policy if exists "Admin gerencia rh_sucessao_externos" on rh.rh_sucessao_externos;
create policy "Admin gerencia rh_sucessao_externos" on rh.rh_sucessao_externos
  for all to authenticated
  using (public.rh_has_role(auth.uid(), 'admin'::rh_app_role))
  with check (public.rh_has_role(auth.uid(), 'admin'::rh_app_role));

revoke all on rh.rh_sucessao_externos from anon, authenticated;
grant select, insert, update, delete on rh.rh_sucessao_externos to authenticated;

-- ---------------------------------------------------------------------------
-- Marcar exige função; e quem é alternativa aparece como "forte" no Talents
-- ---------------------------------------------------------------------------
create or replace function rh.rh_sucessao_externos_ao_marcar()
returns trigger
language plpgsql
security definer
set search_path = rh, public
as $$
begin
  if not exists (select 1 from rh.talents_mappings m
                  where m.id = new.talents_mapping_id and m.funcao_id is not null) then
    raise exception 'Defina a função do mapeamento antes de marcá-lo como alternativa externa.';
  end if;
  update rh.talents_mappings set nivel = 'forte', updated_at = now()
   where id = new.talents_mapping_id and nivel <> 'forte';
  return new;
end;
$$;

drop trigger if exists trg_rh_sucessao_externos_ao_marcar on rh.rh_sucessao_externos;
create trigger trg_rh_sucessao_externos_ao_marcar
  before insert or update of talents_mapping_id on rh.rh_sucessao_externos
  for each row execute function rh.rh_sucessao_externos_ao_marcar();

-- ---------------------------------------------------------------------------
-- Mudou a função do mapeamento → a aprovação era para outra função
-- ---------------------------------------------------------------------------
-- Quem muda a função pode ser qualquer editor do Talents, que não enxerga esta
-- tabela: por isso security definer. Sem função, deixa de ser alternativa; com
-- outra função, continua indicado, mas volta a pedir aprovação.
create or replace function rh.talents_mappings_funcao_mudou()
returns trigger
language plpgsql
security definer
set search_path = rh, public
as $$
begin
  if new.funcao_id is null then
    delete from rh.rh_sucessao_externos where talents_mapping_id = new.id;
  else
    update rh.rh_sucessao_externos
       set aprovado_em = null, aprovado_por = null, aprovado_por_nome = null
     where talents_mapping_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_talents_mappings_funcao_mudou on rh.talents_mappings;
create trigger trg_talents_mappings_funcao_mudou
  after update of funcao_id on rh.talents_mappings
  for each row
  when (new.funcao_id is distinct from old.funcao_id)
  execute function rh.talents_mappings_funcao_mudou();

-- rh_sucessao_aprovar_externo(p_id) segue valendo: carimba pelo id do marcador.
