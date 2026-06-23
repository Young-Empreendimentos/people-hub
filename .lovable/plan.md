
## Avaliação da sua proposta

Sua proposta original já está **bem desenhada** — segui ela quase inteira. Pontos que sugiro ajustar:

1. **Versionamento de pesos**: em vez de "salvar memória de cálculo no fechamento", crio a tabela `rh_auditoria_resultado_itens` que copia peso do grupo + peso da atividade + status no momento do fechamento. Resultado fica imutável e auditável. Mais simples e robusto.
2. **Pesos de grupo no tempo**: além disso, deixo o peso do grupo e da atividade editáveis a qualquer momento — só novas auditorias usam o novo peso; auditorias finalizadas mantêm o que foi congelado.
3. **Print/screenshot**: bucket Supabase Storage `auditoria-evidencias` privado, com link assinado.
4. **Aprovação**: qualquer admin pode aprovar (sua escolha).
5. **E-mails**: Resend (você precisará criar a conta + verificar o domínio; eu peço a API key na hora certa).
6. **Auditor por equipe**: tabela de vínculo `rh_auditor_equipes`. Métodos só aparecem para auditor cuja equipe bate com a equipe do grupo.

---

## FASE 1 — Cadastros + Execução da auditoria

### 1.1 Banco (uma migração)

Tabelas novas:
- `rh_grupos_atividades_auditoria` — nome, equipe_id (FK rh_equipes), peso, ativo. *Distinta da `rh_grupos_atividades` atual, que é de outro contexto.*
- `rh_atividades_auditoria` — grupo_id, nome, peso, responsavel_funcionario_id (FK), normas (text), manuais (text), indicadores (text), metodo_auditoria (text — restrito), ordem.
- `rh_auditor_equipes` — user_id, equipe_id (vincula auditor às equipes).
- `rh_auditorias` — titulo, equipe_id, auditor_user_id, data_referencia, status (`em_andamento` | `finalizada` | `aprovada` | `rejeitada`), observacao_geral, aprovado_por, aprovado_em, criado_por, percentual_final (preenchido no fechamento).
- `rh_auditoria_itens` — auditoria_id, atividade_id, status (`positivo` | `inconformidade` | `nao_aplica` | `pendente`), comentario, evidencia_url, avaliado_em.
- `rh_auditoria_resultado_snapshot` — auditoria_id, atividade_id, nome_atividade, nome_grupo, peso_grupo, peso_atividade, status. Preenchido **no fechamento** (memória de cálculo congelada).

Functions/policies:
- `rh_is_auditor(uid)` — checa role `auditor` ativa.
- `rh_auditor_em_equipe(uid, equipe_id)` — checa vínculo em `rh_auditor_equipes`.
- RLS:
  - `rh_grupos_atividades_auditoria` + `rh_atividades_auditoria`: SELECT para todo usuário autenticado (todos veem as atividades). INSERT/UPDATE/DELETE: admin.
  - Campo `metodo_auditoria` (`rh_atividades_auditoria`): SELECT só admin **ou** auditor com vínculo na equipe do grupo. Implementado por **view** `rh_atividades_auditoria_visiveis` que omite `metodo_auditoria` para quem não tem direito; UI consome a view. (Postgres não tem column-level RLS prático aqui.)
  - `rh_auditor_equipes`: admin gerencia, usuário vê o próprio vínculo.
  - `rh_auditorias`: admin tudo; auditor lê/edita só as suas e enquanto `em_andamento`; demais leem após aprovada.
  - `rh_auditoria_itens`: idem.
  - `rh_auditoria_resultado_snapshot`: leitura para todos autenticados; escrita só via função `rh_fechar_auditoria(p_id)`.
- Bucket `auditoria-evidencias` (privado), com policy: auditor pode upload/leitura nos arquivos das suas auditorias; admin tudo.

### 1.2 Frontend (Fase 1)

Novas páginas/sidebar:
- **Atividades** (`/atividades-auditoria`)
  - 3 visões via Tabs: por **Grupo**, por **Responsável**, por **Equipe**.
  - Combobox de filtro (padrão do projeto). Coluna "Método" só aparece para quem tem direito.
  - Admin: botões CRUD para grupos e atividades (peso, responsável, normas, manuais, indicadores, método).
- **Auditorias** (`/auditorias`)
  - Listagem com status, equipe, auditor, data, % final.
  - Botão "Nova auditoria" (admin ou auditor): escolhe equipe → cria registro `em_andamento` com itens auto-gerados a partir das atividades ativas daquela equipe (status inicial `pendente`).
  - Página de execução `/auditorias/:id`:
    - Lista por grupo, cada atividade com botões Positivo / Inconformidade / N/A, campo de comentário, upload de print (drag-drop ou colar Ctrl+V — uso `onPaste` capturando image/png), preview do print salvo.
    - Botão "Finalizar" desabilitado se houver `pendente`. Ao finalizar: chama `rh_fechar_auditoria` (gera snapshot + calcula `percentual_final` com pesos atuais) e muda status para `finalizada`.

### 1.3 Cálculo
- Por grupo: `Σ(peso_atividade × valor_status) / Σ(peso_atividade)`, onde `positivo=1`, `inconformidade=0`, `nao_aplica` é excluído.
- Total: `Σ(peso_grupo × resultado_grupo) / Σ(peso_grupo)`. Usado tanto na tela ao vivo (com pesos atuais) quanto no fechamento (sobre o snapshot).

---

## FASE 2 — Aprovação, e-mails, relatórios

### 2.1 Banco
- Migração menor: triggers/condições adicionais se necessário; tabela `rh_auditoria_anexos_relatorio` opcional.

### 2.2 Fluxo de aprovação
- Status `finalizada` → admins veem na fila "Aguardando aprovação".
- Botões "Aprovar" / "Rejeitar com motivo".
- Ao aprovar: status = `aprovada`, dispara edge function `enviar-relatorio-auditoria`.

### 2.3 E-mails (Resend)
- Edge function `notificar-auditoria-finalizada`: dispara ao finalizar → e-mail para todos admins.
- Edge function `enviar-relatorio-auditoria`: dispara ao aprovar → e-mail para o auditor e para cada responsável das atividades auditadas, com o relatório (HTML) + link da auditoria.
- Secret `RESEND_API_KEY` será solicitada no início da Fase 2; domínio remetente verificado pelo usuário.

### 2.4 Relatórios / dashboard
- **`/auditorias/:id/relatorio`**: relatório com cabeçalho, resultado por grupo, atividades positivas/inconformidades, prints, comentários, % final — pronto para impressão.
- **`/auditorias-resultados`**: dashboard (semelhante ao "Dashboard" da sua planilha) com filtros por auditor/equipe/período, evolução do % final no tempo (linha), última auditoria de cada equipe, ranking de inconformidades mais frequentes.

---

## Considerações técnicas

- **Snapshot vs recálculo dinâmico**: snapshot é a fonte da verdade do `percentual_final` aprovado. Mexer em pesos depois nunca altera relatório fechado.
- **`metodo_auditoria` confidencial**: implementado por view porque RLS por coluna é frágil; qualquer query direta na tabela fica restrita a admin via RLS.
- **Colar print (Ctrl+V)**: handler `onPaste` no card da atividade — converte blob → `supabase.storage.upload`.
- **Sidebar**: "Atividades" visível para todos; "Auditorias" visível para admin + auditor; "Resultados de Auditoria" para todos após Fase 2.
- Tabela `rh_grupos_atividades` atual permanece intocada (é outro contexto). Por isso uso o sufixo `_auditoria`.

## Fora de escopo desta entrega
- Importar a planilha histórica (posso fazer depois, sob demanda).
- App mobile nativo (a UI será responsiva).
- Assinatura digital do relatório.
