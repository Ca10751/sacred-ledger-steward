# Especificação de implementação — melhorias contábeis e módulo igreja

Este documento orienta as alterações que dependem de banco de dados e devem ser executadas pelo Lovable, conforme `AGENTS.md`. Não criar nem editar migrations/Drizzle manualmente.

## Regras gerais
- Todas as tabelas novas devem ter `org_id`, políticas RLS e validação de associação à organização.
- Respeitar o isolamento multi-tenant existente (`is_member`, `can_write`, `is_org_admin`).
- Lançamentos contabilizados são imutáveis: não permitir exclusão física nem edição retroativa sem trilha de auditoria.
- Operações contábeis compostas devem ocorrer em RPC transacional no Supabase.
- Não presumir que o campo `organizations.document` seja necessariamente CNPJ; criar campos explícitos e opcionais.

## 1. Cadastro de membros da igreja
Criar tabela `church_members`:
- `id uuid primary key`, `org_id uuid not null`, `registration_number text`, `full_name text not null`, `cpf text`, `birth_date date`, `phone text`, `email text`, `address text`, `joined_at date`, `status text` (ativo/inativo), `notes text`, `created_at`, `updated_at`.
- Índices por `org_id`, nome e matrícula; unicidade de matrícula por organização quando preenchida.
- CRUD restrito a admin/contador; leitura conforme permissões da organização.
- Validar CPF no frontend e no backend; CPF opcional e não usar como identificador primário.

## 2. Vincular dízimos e ofertas aos membros
- Adicionar `member_id uuid null references church_members(id)` em `contributions`.
- Preservar `contributor` para contribuições sem membro identificado e compatibilidade histórica.
- No formulário, permitir buscar e selecionar membro por nome ou matrícula; salvar `member_id` e preencher o nome de exibição.
- Na listagem e nos relatórios, mostrar nome/matrícula quando houver vínculo.
- Garantir que o membro selecionado pertença à mesma `org_id` da contribuição, inclusive no backend/RPC.

## 3. Dados oficiais da organização
Adicionar campos opcionais em `organizations`:
- `legal_name`, `cnpj`, `address_street`, `address_number`, `address_complement`, `address_district`, `address_city`, `address_state`, `address_postal_code`, `legal_representative_name`, `accountant_name`, `accountant_crc`.
- Tela de configurações com validação de CNPJ/UF/CEP e permissões de edição para admin.
- Não preencher ou inferir dados oficiais automaticamente.

## 4. Carteirinha de membro
- Criar visualização de impressão com dimensões físicas de 85,6 × 54 mm (padrão cartão ID-1), frente e verso.
- Frente: nome da igreja, logomarca se cadastrada, nome do membro, matrícula e foto opcional.
- Verso: CNPJ/endereço da igreja, data de emissão, campos de contato e observações úteis.
- CSS de impressão com `@page`, dimensões exatas, margens controladas e quebra entre frente/verso.
- Permitir imprimir uma carteirinha individual e uma seleção em lote; não incluir CPF completo na face do cartão por padrão.

## 5. Cabeçalho e assinaturas nos relatórios
- Reutilizar os campos oficiais de `organizations` no cabeçalho dos relatórios.
- Exibir nome legal/fantasia, CNPJ, endereço e período/data-base conforme o relatório.
- Blocos de assinatura para representante legal e contador, com nome e CRC quando cadastrados.
- Não apresentar assinatura digital nem certificação inexistente; são campos para assinatura manual.

## 6. Estorno contábil rastreável
Criar tabela `journal_entry_reversals`:
- `id`, `org_id`, `original_entry_id`, `reversal_entry_id`, `reason`, `created_by`, `created_at`.
- Impor no máximo um estorno integral por lançamento original, salvo fluxo formal de estorno parcial aprovado.
- Criar RPC transacional `reverse_journal_entry(_org, _entry_id, _reason)` que:
  1. valide permissão de escrita e pertencimento do lançamento à organização;
  2. rejeite lançamento já estornado;
  3. crie novo lançamento com débitos e créditos invertidos, preservando referência, histórico e documento;
  4. registre motivo, usuário e data na tabela de auditoria;
  5. retorne o ID do lançamento de estorno.
- A interface deve trocar “Excluir” por “Estornar”, exigir motivo, exibir vínculo entre original e estorno e manter ambos no livro diário.
- Nunca apagar fisicamente lançamentos contabilizados.

## 7. Fechamento anual e apuração do resultado
Criar tabela `fiscal_year_closings`:
- `id`, `org_id`, `fiscal_year`, `closing_entry_id`, `profit_loss_account_id`, `closed_by`, `closed_at`, `notes`.
- Unicidade por `org_id + fiscal_year`.
- Criar RPC transacional `close_fiscal_year(_org, _year, _profit_loss_account_id, _notes)`:
  1. validar permissão, período e conta de destinação do patrimônio líquido;
  2. apurar saldos das contas de receita e despesa no exercício;
  3. gerar partidas de encerramento que zerem as contas de resultado;
  4. transferir o resultado líquido para a conta de patrimônio líquido informada;
  5. registrar o fechamento e impedir execução duplicada;
  6. rejeitar fechamento se houver lançamentos desbalanceados ou período já encerrado.
- Interface com prévia da apuração, resultado, conta de destinação e confirmação explícita. Exibir trilha de auditoria e permitir consulta, não sobrescrita, do fechamento.
- Não criar fechamento automático ao apenas abrir o Balanço Patrimonial.

## Critérios de aceite
- Testes de RLS comprovam que usuários de uma organização não leem nem alteram dados de outra.
- Testes de RPC cobrem sucesso, falta de permissão, IDs de outra organização, duplicidade e rollback.
- Testes contábeis demonstram partidas dobradas, estorno inverso exato e fechamento com resultado correto.
- Carteirinhas medem 85,6 × 54 mm na impressão física.
- Relatórios mantêm valores e filtros atuais e exibem dados oficiais apenas quando cadastrados.


## 8. Planejamento anual de gastos (orçamento)
Criar módulo próprio "Planejamento anual" para empresas e igrejas, isolado por organização:
- Tabela `annual_budget_plans`: id, org_id, fiscal_year, status (draft/approved/closed), notes, created_by, approved_by, approved_at, created_at, updated_at; unicidade org_id + fiscal_year.
- Tabela `annual_budget_items`: id, org_id, budget_id, account_id (conta analítica de despesa), cost_center_id opcional, congregation_id opcional, description opcional, monthly_values JSONB com 12 valores numéricos não negativos, created_at, updated_at.
- Chaves estrangeiras compostas/validação garantem que plano, conta, centro de custo e congregação pertençam à mesma organização. RLS em todas as tabelas com is_member/can_write/is_org_admin.
- Permitir criar planejamento por exercício, incluir diversas contas/categorias, centro de custo e congregação, preencher orçamento mês a mês, editar enquanto rascunho e aprovar com confirmação.
- Exibir orçamento anual e mensal, realizado calculado a partir de journal_lines + journal_entries por conta/categoria e período, saldo disponível e variação (realizado menos previsto). Não gravar "realizado" manualmente: o realizado vem do razão contábil para evitar divergência.
- Exibir comparação previsto x realizado por mês e por categoria; destacar estouro orçamentário; permitir exportar CSV e imprimir.
- Planejamento não cria lançamento contábil. A aprovação congela a estrutura; alterações posteriores exigem reabertura autorizada com auditoria. Não permitir exclusão de orçamento aprovado com execução vinculada.

## 9. Patrimônio permanente, materiais e almoxarifado
Criar módulos e tabelas organizacionais:
- `fixed_assets`: org_id, asset_code, description, category, acquisition_date, acquisition_value, useful_life_months opcional, residual_value, location, congregation_id, responsible_member_id opcional, serial_number, condition, status, notes.
- `inventory_items`: org_id, sku, description, category, unit, min_quantity, active.
- `inventory_movements`: org_id, item_id, movement_type (entrada/saida/transferencia/ajuste), quantity positiva, unit_cost opcional, movement_date, from_congregation_id, to_congregation_id, responsible, document, notes, created_by. Movimentações imutáveis; correção por movimento compensatório.
- `physical_inventory_sessions` e `physical_inventory_counts` para contagem, divergência e aprovação de ajustes.
- RLS e validações de pertencimento à organização em todas as referências. Transferência entre congregações registra saída e entrada vinculadas, sem alterar o total consolidado. Separar bem permanente do material de consumo; não contabilizar automaticamente sem regra de integração aprovada.

## 10. Contas bancárias e conciliação
Criar:
- `bank_accounts`: org_id, account_id (conta contábil analítica do tipo ativo), bank_name, branch, account_number_masked, account_label, opening_balance, opening_date, active.
- `bank_statements`: org_id, bank_account_id, statement_date, opening_balance, closing_balance, import_source, status.
- `bank_statement_lines`: org_id, statement_id, transaction_date, description, document, amount, direction, external_id, matched_journal_line_id opcional, reconciliation_status, notes.
- Importação CSV com mapeamento de colunas, prevenção de duplicidade por identificador/hash, conciliação manual e sugestão por data/valor/descrição; diferença entre saldo bancário e contábil sempre explícita.
- Não criar lançamentos automaticamente durante importação. Ao confirmar uma correspondência ou gerar lançamento, usar RPC contábil existente e manter vínculo auditável.

## 11. Dados institucionais, membros e carteirinhas — requisitos de implementação
Além do esquema já descrito, separar cadastro de membros da tabela organization_members (que representa usuários do sistema). Não renomear nem reaproveitar a rota de usuários e permissões. Carteirinhas ID-1 devem usar impressão frente/verso em lote e respeitar privacidade de CPF.

## 12. Critérios adicionais de aceite
- Planejamento anual: valores mensais somam exatamente o total anual; realizado vem do razão; orçamento aprovado não pode ser alterado silenciosamente.
- Estoque: saldo é soma de movimentos; transferências não alteram saldo consolidado; inventário registra diferenças e autorizações.
- Bancos: importação idempotente; conciliação não altera lançamentos originais; diferença não conciliada permanece visível.
- Toda operação sensível registra usuário, data, organização e motivo quando aplicável.

## 13. RPCs transacionais e controles obrigatórios para integração das telas

### 13.1 Registro de contribuição com lançamento atômico
Criar RPC create_contribution(_org uuid, _date date, _kind contribution_kind, _member_id uuid, _contributor text, _amount numeric, _congregation_id uuid, _cash_account_id uuid, _revenue_account_id uuid) RETURNS uuid:
- Exigir can_write(_org), valor maior que zero, contas analíticas pertencentes à organização e tipos compatíveis (ativo para caixa/banco; receita para contrapartida).
- Se _member_id não for nulo, validar que o membro pertence à mesma organização e está ativo.
- Validar congregação da mesma organização.
- Criar o lançamento e inserir a linha em contributions com entry_id e member_id dentro da mesma transação.
- Retornar o ID do registro contributions. Qualquer falha deve reverter lançamento e contribuição juntos.
- A tela não deve chamar create_journal_entry e depois fazer INSERT separado.

### 13.2 Estorno integral e proteção do livro diário
- Revogar DELETE de journal_entries e journal_lines para authenticated; remover políticas RLS de exclusão física dessas tabelas.
- Proteger também UPDATE direto de journal_entries e journal_lines; alterações em lançamento contabilizado devem ocorrer por fluxo formal auditado.
- RPC reverse_journal_entry(_org uuid, _entry_id uuid, _reason text) RETURNS uuid deve bloquear a linha original (FOR UPDATE), validar que não foi estornada, criar lançamento inverso com todas as dimensões e valores invertidos e registrar journal_entry_reversals.
- O lançamento de estorno deve referenciar o original no histórico e preservar data/memo/documento de origem; usar data permitida pelo período contábil e exigir justificativa não vazia (mínimo 8 caracteres).
- Criar FK/índices e unicidade para impedir dois estornos integrais do mesmo original.
- contributions ligadas ao lançamento original não devem ser apagadas. Relatórios devem considerar original e estorno, resultando em efeito líquido zero.
- Bloquear estorno de lançamento já estornado, de estorno de estorno e de lançamento pertencente a outra organização.

### 13.3 Fechamento de exercício
- close_fiscal_year(_org uuid, _year integer, _profit_loss_account_id uuid, _notes text) deve ser atômica, validar permissão, ano encerrado/duplicidade, conta de patrimônio da mesma organização e equilíbrio dos lançamentos.
- Apurar receitas e despesas por natureza contábil, zerar saldos das contas de resultado e transferir superávit/déficit para conta patrimonial informada.
- Registrar closing_entry_id, usuário, data, ano, conta de destinação e notas. Bloquear novos lançamentos no exercício encerrado, salvo fluxo administrativo explícito de reabertura auditada.
- Não aceitar fechamento do exercício corrente ou futuro pela interface padrão.

### 13.4 Importação idempotente de extratos
Criar RPC import_bank_statement(_org uuid, _bank_account_id uuid, _statement_date date, _opening_balance numeric, _closing_balance numeric, _import_source text, _rows jsonb) RETURNS uuid:
- Validar conta bancária da organização e can_write.
- Criar cabeçalho do extrato e linhas em transação.
- Normalizar identificador externo/hash com data, valor, descrição e documento; evitar duplicação em reimportação.
- Validar datas, valores e direção; nunca criar lançamentos contábeis automaticamente.
- Retornar o ID do extrato e disponibilizar contagens de linhas importadas/ignoradas.
- Conciliação deve vincular bank_statement_lines a journal_lines da mesma organização e impedir vínculo duplicado indevido.

### 13.5 Inventário físico
- physical_inventory_sessions: org_id, reference_date, congregation_id opcional, status (draft/submitted/approved), notes, created_by, approved_by, approved_at.
- physical_inventory_counts: org_id, session_id, item_id, expected_quantity, counted_quantity, variance, notes.
- Criar tela para iniciar contagem, informar quantidades físicas, visualizar divergências e submeter para aprovação administrativa.
- Somente aprovação autorizada pode gerar movimentos ajuste; nunca editar/apagar movimentos anteriores.
- Validar referências de sessão, item e congregação dentro da mesma organização.


- Criar RPC approve_physical_inventory(_org uuid, _session_id uuid) RETURNS void:
  - exigir is_org_admin(_org), sessão da mesma organização e status submitted;
  - bloquear sessão e contagens para evitar aprovação concorrente;
  - validar expected_quantity/count e divergência;
  - gerar movimentos compensatórios de ajuste para cada item divergente, com data de referência, usuário aprovador e referência à sessão no documento/notes;
  - marcar sessão approved, approved_by e approved_at na mesma transação;
  - rejeitar segunda aprovação, sessão de outra organização e sessão ainda em draft.
- physical_inventory_counts deve ter unicidade (session_id, item_id), e edição somente enquanto sessão estiver draft.

## 14. Contrato de integração das telas adicionadas
As rotas adicionadas nesta branch dependem das tabelas e contratos acima:
- /o/:orgId/cadastro-membros → church_members, leitura e CRUD com inativação (sem exclusão física).
- /o/:orgId/patrimonio → fixed_assets, inventory_items, inventory_movements e inventário físico.
- /o/:orgId/bancos → bank_accounts, bank_statements, bank_statement_lines, import_bank_statement.
- /o/:orgId/institucional → campos institucionais de organizations.
- /o/:orgId/encerramento → fiscal_year_closings, close_fiscal_year.
- /o/:orgId/igreja → create_contribution e contributions.member_id.
- /o/:orgId/lancamentos → reverse_journal_entry; nenhuma exclusão física de lançamento.
- /o/:orgId/orcamento → annual_budget_plans e annual_budget_items.

Regra de implantação: antes de habilitar as rotas em produção, Lovable deve aplicar o schema e as RPCs, regenerar os tipos do banco se o projeto usar tipos gerados, executar build/typecheck/testes e corrigir quaisquer incompatibilidades. Não editar manualmente drizzle/ nem migrations gerenciadas pelo Lovable.
