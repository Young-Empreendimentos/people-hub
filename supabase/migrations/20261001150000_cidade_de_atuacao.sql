-- Cidade da empresa e cidade de atuação do funcionário (código IBGE)
--
-- O mapa de sucessão passa a considerar posição = função + equipe + cidade: 6
-- Consultores Comerciais em 4 cidades são 4 posições, cada uma com seu
-- mapeamento. O Pilares não tinha a cidade de trabalho — só o endereço
-- residencial, que não serve (há gente da Matriz morando em Alegrete).
--
-- Cidade da empresa: definida pela maioria dos endereços dos funcionários e
-- confirmada pelo usuário em 01/10/2026 (Avenida do Parque, SAY e Rocket:
-- Santo Antônio da Patrulha; SLY: Sant'Ana do Livramento).
-- Cidade de atuação: pré-preenchida com a da empresa; o admin revisa no painel
-- de configuração do mapa. Passa a ser obrigatória no cadastro, como o cargo.

alter table rh.rh_empresas
  add column if not exists cidade_ibge integer references rh.rh_municipios(codigo_ibge);
alter table rh.rh_funcionarios
  add column if not exists cidade_ibge integer references rh.rh_municipios(codigo_ibge);

comment on column rh.rh_empresas.cidade_ibge is 'Cidade da empresa (IBGE). Valor inicial da cidade de atuação dos funcionários dela.';
comment on column rh.rh_funcionarios.cidade_ibge is 'Cidade de atuação (onde trabalha, não onde mora). Compõe a posição do mapa de sucessão.';

-- Empresas → cidade
with alvo(prefixo, cidade, uf) as (values
  ('Young Incorporações e Construções LTDA - Matriz', 'Santo Antônio da Patrulha', 'RS'),
  ('Avenida do Parque', 'Santo Antônio da Patrulha', 'RS'),
  ('SAY ', 'Santo Antônio da Patrulha', 'RS'),
  ('Rocket', 'Santo Antônio da Patrulha', 'RS'),
  ('BAY ', 'Bagé', 'RS'),
  ('CAY ', 'Cruz Alta', 'RS'),
  ('SLY ', 'Sant''Ana do Livramento', 'RS'),
  ('SBY ', 'São Borja', 'RS'),
  ('SBY2 ', 'São Borja', 'RS'),
  ('ITY ', 'Itaqui', 'RS')
)
update rh.rh_empresas e
   set cidade_ibge = m.codigo_ibge
  from alvo a
  join rh.rh_municipios m on m.nome = a.cidade and m.uf = a.uf
 where e.nome like a.prefixo || '%' and e.cidade_ibge is null;

-- Funcionários → cidade da empresa (só onde ainda não há cidade)
update rh.rh_funcionarios fu
   set cidade_ibge = e.cidade_ibge
  from rh.rh_empresas e
 where e.id = fu.empresa_id and fu.cidade_ibge is null and e.cidade_ibge is not null;

-- Cargo e cidade obrigatórios no cadastro; nenhum dos dois pode ser apagado.
-- Cadastros antigos sem eles seguem editáveis.
create or replace function rh.rh_funcionarios_exige_cargo()
returns trigger
language plpgsql
set search_path = rh, public
as $$
begin
  if new.cargo_id is null and (tg_op = 'INSERT' or old.cargo_id is not null) then
    raise exception 'Informe o cargo do funcionário.' using errcode = '23502';
  end if;
  if new.cidade_ibge is null and (tg_op = 'INSERT' or old.cidade_ibge is not null) then
    raise exception 'Informe a cidade de atuação do funcionário.' using errcode = '23502';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rh_funcionarios_exige_cargo on rh.rh_funcionarios;
create trigger trg_rh_funcionarios_exige_cargo
  before insert or update of cargo_id, cidade_ibge on rh.rh_funcionarios
  for each row execute function rh.rh_funcionarios_exige_cargo();
