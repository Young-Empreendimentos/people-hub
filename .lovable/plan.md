## Objetivo

Permitir que funcionários da empresa entrem no Pilares via Google, lancem seus próprios km/data e, após aprovação do RH, esses valores virem reembolso na folha do mês vigente (período de competência: dia 20 do mês anterior → dia 19 do mês atual).

---

## Mudanças no banco (migration)

1. **Enum `app_role`**: adicionar valor `'colaborador'`.
2. **Tabela `rh_user_roles`** — adicionar colunas:
   - `funcionario_id uuid` (FK → `rh_funcionarios`, nullable) — qual funcionário esse usuário representa.
   - `status text` default `'pendente'` — `pendente` | `ativo` | `rejeitado`.
3. **Tabela `rh_funcionarios`** — adicionar:
   - `valor_km numeric(10,4)` default `0` — R$ por km do funcionário.
4. **Nova tabela `rh_km_lancamentos`**:
   - `funcionario_id`, `data` (date do trajeto), `km numeric`, `valor_km_snapshot` (R$/km no momento do lançamento), `valor_total` (km × snapshot), `descricao` text, `status` (`pendente`/`aprovado`/`rejeitado`/`pago`), `criado_por`, `aprovado_por`, `aprovado_em`, `motivo_rejeicao`, `folha_reembolso_id` (preenchido quando virar linha de folha), timestamps.
   - GRANT + RLS:
     - `colaborador` lê/cria/edita/deleta apenas lançamentos **com status `pendente`** vinculados ao seu próprio `funcionario_id` (via `rh_user_roles`).
     - `admin`/`coordenador`/`usuario` leem tudo; aprovam/rejeitam/editam.
5. **RLS de `rh_user_roles`**: colaborador pode criar a **própria linha** com `role='colaborador'` e `status='pendente'` (autocadastro). Admin atualiza para `ativo`.

## Frontend

### Auth (`useAuth.tsx`)
- `RhRole` passa a incluir `"colaborador"`.
- Expor `funcionarioId`, `roleStatus`, `isColaborador`.
- Helpers `canDelete/canConfig/...` continuam falsos para colaborador.

### Roteamento (`App.tsx`)
- Nova rota `/meus-kms` (tela do colaborador).
- Nova rota `/primeiro-acesso` (seleção do próprio cadastro).
- Em `Reembolsos`, nova aba/seção "Aprovações de KM" para admin/coordenador/usuario.

### `AppLayout.tsx`
- Se logado **sem role**: redirecionar para `/primeiro-acesso` (em vez da tela "acesso pendente").
- Se role = `colaborador` + status `pendente`: tela "aguardando aprovação do RH".
- Se role = `colaborador` + status `ativo`: layout reduzido (sem sidebar completo) — só link "Meus KMs" e Sair. Qualquer rota fora de `/meus-kms` redireciona pra lá.
- Demais roles: comportamento atual.

### Páginas novas
- **`PrimeiroAcesso.tsx`**: combobox com funcionários ativos (nome + cpf mascarado), botão "Confirmar". Cria registro em `rh_user_roles` (role `colaborador`, status `pendente`, funcionario_id selecionado, nome = nome do funcionário). Mostra confirmação "aguarde aprovação".
- **`MeusKms.tsx`**: 
  - Form: data (date), km (number), descrição (opcional) → INSERT com `valor_km_snapshot` lido de `rh_funcionarios.valor_km`.
  - Lista dos próprios lançamentos com status colorido (pendente/aprovado/rejeitado/pago) e motivo de rejeição quando houver.
  - Editar/excluir só se status `pendente`.
  - Resumo do período vigente (20→19) com total de km e R$ previsto.

### Aprovações (admin/coordenador/usuario)
- Em `src/pages/Reembolsos.tsx`, adicionar card/aba **"KM a aprovar"** com lista agrupada por funcionário, filtros por status e período. Ações: aprovar, rejeitar (com motivo), editar km/valor.

### Configurações
- Em `src/pages/Configuracoes.tsx` → seção Usuários: mostrar pedidos pendentes (`rh_user_roles.status='pendente'`) com botão Aprovar / Rejeitar / Alterar role. Mostrar funcionário vinculado.
- Em cadastro de funcionário (`FuncionarioDetalhes`): novo campo `valor_km` editável por admin/coord.

### Folha mensal
- Em `FolhaMensal.tsx`, ao gerar/abrir a folha de um mês, somar `rh_km_lancamentos` **aprovados** com `data` entre `dia 20 do mês anterior` e `dia 19 do mês de referência`, e inserir/atualizar uma linha em `rh_folha_reembolsos` (tipo `KM`, origem `lancamento_colaborador`) com o total. Marcar os lançamentos com `folha_reembolso_id` e `status='pago'` quando a folha for fechada.

## Pontos técnicos

- Período de competência calculado por helper `getPeriodoKm(mesReferencia: Date) → { inicio: Date, fim: Date }` que retorna `[ano-mês-anterior-20, ano-mês-19]`.
- Lock: lançamentos com status `pago` não podem ser editados nem por admin.
- Snapshot do valor_km evita que mudanças posteriores no cadastro alterem reembolsos já aprovados.

## Fora de escopo
- Anexo de comprovante / foto do hodômetro (pode entrar depois).
- Notificação por email ao colaborador quando aprovado/rejeitado.
