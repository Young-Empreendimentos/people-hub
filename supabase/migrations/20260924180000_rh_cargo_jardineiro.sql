-- "Outros I" é o cargo de jardineiro, com o nome errado.
--
-- Foi criado em 29/03/2026 pela tela de Cargos antiga, que não deixava digitar o
-- nome e o gerava como "trilha + romano do nível" — trilha Outros, nível 1. Os
-- dois ocupantes (Cheikhou Ka e Vilmar de Souza Krech) são da equipe Jardinagem.
--
-- Renomeia o cargo e a função. Funcionários e aditivos continuam apontando para o
-- mesmo registro; só o nome exibido muda.

update rh.rh_cargos c
set nome = 'Jardineiro'
from rh.rh_trilhas_cargo t
where t.id = c.trilha_id and t.nome = 'Outros' and c.nome = 'Outros I';

update rh.rh_funcoes f
set nome = 'Jardineiro'
from rh.rh_trilhas_cargo t
where t.id = f.trilha_id and t.nome = 'Outros' and f.nome = 'Outros I';
