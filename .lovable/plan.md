## Objetivo

1. **Benefícios de Moradia** no funcionário (reembolso aluguel + auxílio moradia 25% do salário do cargo), com histórico versionado.
2. Aplicar automaticamente na **Folha Mensal** quando o funcionário tiver benefício vigente (valores não editáveis na folha).
3. **Reembolsos** (gratificações e demais reembolsos) lançados dentro da folha mensal, com página de visualização em **Financeiro → Reembolsos**.

---

## 1. Banco de dados (migração)

### `rh_funcionario_beneficios_moradia` (histórico)
Campos: `funcionario_id`, `data_inicio`, `data_fim` (nullable = vigente), `valor_reembolso_aluguel` (numeric), `percentual_auxilio_moradia` (numeric, default 25), `observacao`, `created_at`, `created_by`.

- Vigente = `data_fim IS NULL` OU `data_fim >= mes_referência`.
- Apenas um registro vigente por funcionário (validar no app; índice parcial opcional).
- RLS: leitura para autenticados; insert/update/delete conforme `rh_has_role` (admin/coordenador), delete só admin — alinhado ao restante do sistema.

### `rh_folha_reembolsos` (itens de provento dentro da folha)
Campos: `folha_id` (FK `rh_folha_mensal`, cascade), `tipo` (text — ex.: "Gratificação", "Reembolso de Aluguel", "Auxílio Moradia", "Outro"), `valor` (numeric), `observacao`, `origem` (text — `manual` | `beneficio_moradia`), `created_at`.

- RLS análogo ao `rh_folha_descontos` existente.

---

## 2. Funcionário — aba "Benefícios de Moradia"

Em `FuncionarioDetalhes.tsx`, adicionar nova aba ao lado das existentes:

- **Lista histórica** (tabela): período, valor reembolso aluguel, % auxílio moradia, valor calculado (com base na remuneração atual do cargo, apenas referência visual), observação.
- **Botão "Novo benefício"**: ao criar, encerra o anterior vigente (preenche `data_fim`) e abre um novo a partir de `data_inicio`.
- **Editar/Excluir** registros (respeitando permissões).
- Campos do form: `data_inicio` (obrig.), `valor_reembolso_aluguel`, `percentual_auxilio_moradia` (default 25), `observacao`.

---

## 3. Folha Mensal — aplicação automática

No diálogo de nova folha, ao selecionar funcionário + mês de referência:

1. Buscar benefício vigente na data do mês (`data_inicio <= último dia do mês AND (data_fim IS NULL OR data_fim >= primeiro dia do mês)`).
2. Se existir, calcular:
   - `valor_aluguel = beneficio.valor_reembolso_aluguel`
   - `valor_auxilio = remuneracao_cargo * (percentual_auxilio_moradia/100)` — usar `rh_cargos.remuneracao` do funcionário no momento.
3. Renderizar uma seção **Benefícios de Moradia (automático)** com os dois valores em modo **somente leitura** (com aviso "Para alterar, edite no cadastro do funcionário").
4. Ao salvar a folha, gravar dois registros em `rh_folha_reembolsos` com `origem='beneficio_moradia'`. Se a folha já tem esses itens (edição), regravar (delete + insert, igual descontos).

---

## 4. Folha Mensal — lista de Reembolsos (manual)

Espelhar a UX da lista de descontos:

- Seção **Reembolsos** com Combobox de tipo (Gratificação, Reembolso de Aluguel, Auxílio Moradia, Outro), valor, observação, botão adicionar, lista com remover.
- Itens manuais salvam com `origem='manual'`.
- Itens automáticos (moradia) aparecem na lista travados (sem botão remover) e marcados com badge "automático".

---

## 5. Financeiro → Reembolsos

Card novo em `Financeiro.tsx`: "Reembolsos" (ícone `HandCoins`), rota `/reembolsos`.

- **`src/pages/Reembolsos.tsx`** — lista agregada por mês (igual `Descontos.tsx`): mês, total, qtd lançamentos. Link para detalhe.
- **`src/pages/ReembolsosDetalhes.tsx`** — rota `/reembolsos/:mes`. Tabela com funcionário, empresa, tipo, valor, origem, observação. Filtros (Combobox): mês, funcionário, tipo, empresa.

---

## 6. Arquivos afetados

**Criar**
- `src/pages/Reembolsos.tsx`
- `src/pages/ReembolsosDetalhes.tsx`
- Componente da aba moradia (ex.: `src/components/funcionario/BeneficiosMoradiaTab.tsx`) ou inline em `FuncionarioDetalhes.tsx`.

**Editar**
- `src/App.tsx` — rotas `/reembolsos` e `/reembolsos/:mes`.
- `src/pages/Financeiro.tsx` — card Reembolsos.
- `src/pages/FuncionarioDetalhes.tsx` — nova aba.
- `src/pages/FolhaMensal.tsx` — busca benefício vigente, seção automática read-only, lista de reembolsos manuais, persistência em `rh_folha_reembolsos`.

**Migração**
- Criar tabelas `rh_funcionario_beneficios_moradia` e `rh_folha_reembolsos` + RLS + índices.

---

## 7. Pontos de atenção

- **Histórico preservado**: nunca sobrescrever benefícios antigos — sempre encerrar (`data_fim`) e criar novo.
- **Auxílio moradia depende do cargo vigente**: o valor é calculado no momento de criar a folha. Se o cargo mudar depois (aditivo), folhas já criadas mantêm o valor que foi gravado — o histórico fica em `rh_folha_reembolsos`.
- **Mudança de empresa (aditivo)**: o benefício segue o `funcionario_id`, independente da empresa, então continua aplicado normalmente.
- **Permissões**: seguir padrão admin/coordenador editam, usuario só visualiza; delete só admin.