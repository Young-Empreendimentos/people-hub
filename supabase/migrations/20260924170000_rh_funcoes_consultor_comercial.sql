-- A função criada como "Comercial" (que agrupa os cargos Comercial I a VII) é a
-- de Consultor Comercial — a das consultoras Carolini e Helen Cardoso, entre
-- outras 15 pessoas.
--
-- Só o nome da função muda. Os cargos continuam "Comercial I" a "Comercial VII",
-- que é como aparecem na folha, nos aditivos e no cadastro dos funcionários.

update rh.rh_funcoes f
set nome = 'Consultor Comercial'
from rh.rh_trilhas_cargo t
where t.id = f.trilha_id
  and t.nome = 'Comercial'
  and f.nome = 'Comercial';
