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
- Criar RPC transacional `close_fiscal_year(_org, _year, _profit_loss_account_id)`:
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
