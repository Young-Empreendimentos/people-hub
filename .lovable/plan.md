

# Plano: Sistema de Gestão de RH — Young Empreendimentos

## Visão Geral
Sistema completo de gestão de RH com autenticação, controle de funcionários, equipes, cargos, avaliações, folha mensal e mais. Visual limpo e corporativo, fontes Space Grotesk e Be Vietnam Pro.

## Fase 1 — Fundação (Database + Auth + Layout)

### 1.1 Banco de Dados
Criar todas as tabelas prefixadas com `rh_` via migrations:

```text
rh_equipes (id, nome, created_at)
rh_empresas (id, nome, created_at)
rh_trilhas_cargo (id, nome, created_at)
rh_cargos (id, trilha_id→rh_trilhas_cargo, nome, nivel, remuneracao, created_at)
rh_tipos_aditivo (id, nome, created_at)  -- cadastrável nas configs

rh_funcionarios (id, nome_completo, rg, cpf, endereco, aniversario, 
  empresa_id→rh_empresas, equipe_id→rh_equipes, cargo_id→rh_cargos,
  data_contrato_vigente, created_at, updated_at)

rh_funcionario_anexos (id, funcionario_id, tipo[documento|comprovante|contrato], 
  file_path, file_name, created_at)

rh_admissoes_desligamentos (id, funcionario_id, tipo[admissao|desligamento], 
  data, observacoes, anexo_path, anexo_name, created_at)

rh_aditivos (id, funcionario_id, tipo_aditivo_id→rh_tipos_aditivo, 
  empresa_final_id→rh_empresas, cargo_final_id→rh_cargos, 
  equipe_final_id→rh_equipes, data, anexo_path, anexo_name, 
  observacoes, created_at)

rh_adiantamentos (id, funcionario_id, data, valor, 
  datas_pagamento_pretendidas text[], observacoes, created_at)

rh_avaliacoes (id, funcionario_id, avaliador_id→rh_funcionarios, 
  data_avaliacao, pontuacao_resultados int[1-5], pontuacao_valores int[1-5],
  pontuacao_metas numeric[0-100], pontuacao_auditorias numeric[0-100],
  anexo_path, anexo_name, observacoes, created_at)

rh_folha_mensal (id, funcionario_id, mes_referencia date, 
  horas_atraso_faltas numeric, horas_extra numeric, 
  plano_saude bool, desconto_titulo_parque bool, auxilio_educacional bool,
  descontos_adiantamentos numeric, valor_comissoes numeric, 
  valor_plr numeric, anexo_holerite_path, observacoes, created_at)

rh_grupos_atividades (id, nome, responsavel_id→rh_funcionarios, created_at)
rh_atividades (id, grupo_id→rh_grupos_atividades, descricao, 
  manual_link, metodos_auditoria, responsavel_id→rh_funcionarios, created_at)

rh_user_roles (id, user_id→auth.users, role enum[admin|coordenador|usuario], 
  unique(user_id, role))
rh_user_profiles (id, user_id→auth.users, nome, created_at)
```

Storage bucket: `rh-anexos` (privado) para todos os anexos do sistema.

RLS policies usando função `rh_has_role()` security definer para verificar permissões.

### 1.2 Autenticação
- Página de login com email/senha
- Proteção de rotas (redirecionar para login se não autenticado)
- Context de auth com hook `useAuth`

### 1.3 Layout Base
- Sidebar com navegação (menu lateral colapsável)
- Fontes: Google Fonts Space Grotesk + Be Vietnam Pro
- Paleta corporativa limpa (ajustar CSS variables)
- Componente Combobox reutilizável para todos os selects/filtros

## Fase 2 — Módulos CRUD

Cada módulo segue o padrão: listagem com filtros (combobox) + formulário de criação/edição + visualização de detalhes.

### Módulos (ordem de implementação):
1. **Equipes** — CRUD simples
2. **Empresas** — CRUD simples
3. **Trilhas e Cargos** — Trilhas > Cargos com níveis e remuneração
4. **Tipos de Aditivo** — Configurações (admin only)
5. **Funcionários** — CRUD completo com anexos (upload para `rh-anexos`)
6. **Status do Funcionário** — View derivada de admissões/desligamentos/aditivos
7. **Admissões e Desligamentos** — Com upload de anexo
8. **Aditivos** — Com upload e campos empresa/cargo/equipe final
9. **Adiantamentos** — Data, valor, datas de pagamento
10. **Avaliações de Desempenho** — Com upload e scoring
11. **Folha Mensal** — Todos os campos + upload holerite
12. **Grupos de Atividades e Atividades** — Com vínculo a funcionários

## Fase 3 — Permissões e Refinamentos

- Aplicar restrições por nível de usuário na UI
- Admin: acesso a tudo incluindo Configurações
- Coordenador: tudo exceto Configurações
- Usuário: tudo exceto Configurações e exclusão de registros
- Tela de gerenciamento de usuários (admin only)

## Rotas Planejadas

```text
/login
/                     → Dashboard/Home
/funcionarios         → Lista de funcionários
/funcionarios/:id     → Detalhes do funcionário (status, anexos, histórico)
/equipes              → Gestão de equipes
/cargos               → Trilhas e cargos
/admissoes            → Admissões e desligamentos
/aditivos             → Aditivos contratuais
/adiantamentos        → Adiantamentos
/avaliacoes           → Avaliações de desempenho
/folha                → Fechamento de folha mensal
/atividades           → Grupos e atividades
/configuracoes        → Tipos de aditivo, usuários (admin)
```

## Detalhes Técnicos

- **Prefixo de tabelas**: `rh_` para evitar conflito com tabelas existentes no Supabase
- **Combobox**: Usar componente baseado em cmdk (já existe `command.tsx`) para todos os selects
- **Uploads**: Supabase Storage bucket `rh-anexos`, RLS para acesso autenticado
- **Status do funcionário**: Calculado via query na última admissão/desligamento
- **Fontes**: Importar Space Grotesk e Be Vietnam Pro via Google Fonts no `index.html`

## Ordem de Execução

A implementação será feita incrementalmente. Começaremos pela **Fase 1** completa (banco, auth, layout), depois avançaremos módulo a módulo na **Fase 2**.

