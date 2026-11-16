# Prompt único de implantação no Lovable Cloud

Copie o texto abaixo no Agent do projeto Sapucaí Tropicalis no Lovable. O repositório já contém as telas e a especificação em docs/LOVABLE_IMPLEMENTATION_SPEC.md. Execute primeiro uma auditoria do banco atual e depois implemente as alterações sem apagar dados.

---

Você está trabalhando no projeto Sapucaí Tropicalis conectado ao Lovable Cloud. Leia integralmente AGENTS.md e docs/LOVABLE_IMPLEMENTATION_SPEC.md, inspecione o schema real do banco, RLS, funções RPC, relacionamentos, tipos gerados e todas as rotas já existentes antes de alterar qualquer coisa.

OBJETIVO: concluir a integração backend das telas de gestão contábil, financeira, patrimonial e administrativa para igrejas.

REGRAS INEGOCIÁVEIS
1. Não crie outro projeto Supabase. Use o banco existente do Lovable Cloud.
2. Não duplique tabelas que já existam. Compare nomes, colunas, constraints, índices, FKs, policies e funções antes de criar/alterar.
3. Não apague, trunque, renomeie nem recrie tabelas existentes. Preserve todos os registros.
4. Não altere manualmente arquivos em drizzle/ nem migrations gerenciadas pelo Lovable. Faça as mudanças pelo fluxo de banco/migrations do próprio Lovable.
5. Toda tabela multiempresa deve ter org_id, FKs compostas ou validação equivalente de pertencimento à organização, RLS e índices.
6. Não confie apenas na interface para autorização. Regras críticas devem estar no banco/RPC.
7. Não exponha chaves ou segredos no frontend.
8. Não faça deploy de produção nem mescle PR sem autorização do proprietário.
9. Mantenha compatibilidade com os dados atuais e ofereça backfill seguro quando necessário.
10. Nunca exclua lançamentos contábeis contabilizados. O histórico original deve permanecer.

FASE A — AUDITORIA E PLANO
- Liste o schema existente e compare com cada requisito da especificação.
- Identifique quais objetos já existem e quais precisam ser criados ou alterados.
- Antes de executar, apresente um resumo objetivo das alterações e confirme que nenhuma operação destrutiva será necessária.
- Não interrompa para perguntar sobre detalhes que já estejam definidos na especificação; use campos opcionais e defaults seguros.

FASE B — BANCO, SEGURANÇA E RPCs
Implemente integralmente os schemas e contratos descritos nas seções 1 a 14 de docs/LOVABLE_IMPLEMENTATION_SPEC.md, incluindo:
- church_members, member_id em contributions e validação de membro pertencente à mesma organização;
- campos oficiais de organizations;
- annual_budget_plans e annual_budget_items;
- fixed_assets, inventory_items, inventory_movements, physical_inventory_sessions e physical_inventory_counts;
- bank_accounts, bank_statements e bank_statement_lines;
- journal_entry_reversals e fiscal_year_closings;
- RPCs create_contribution, reverse_journal_entry, close_fiscal_year, import_bank_statement, approve_physical_inventory, approve_annual_budget, record_inventory_movement, submit_physical_inventory e reconcile_bank_statement_line;
- políticas RLS, constraints, índices, validações de referências cruzadas e auditoria.

Para tabelas existentes, adicione colunas de forma compatível e nullable quando necessário. Backfill apenas quando o valor puder ser determinado com segurança. Não invente CNPJ, endereço, nome de membro, saldos ou dados históricos.

PROTEÇÃO CONTÁBIL:
- Revogue exclusão física de journal_entries e journal_lines para usuários autenticados e remova as policies que permitam DELETE.
- Bloqueie UPDATE direto em lançamentos contabilizados.
- Crie estorno integral atômico, com motivo obrigatório, usuário, data, vínculo original/estorno e unicidade para impedir estorno duplicado.
- Faça o estorno gerar partidas inversas exatas, mantendo dimensões, centro de custo e congregação.
- Contribuições e documentos relacionados ao original permanecem preservados.
- Crie fechamento anual transacional, zerando receitas e despesas e transferindo o superávit/déficit para a conta patrimonial indicada. Bloqueie lançamentos em exercício fechado, salvo reabertura administrativa auditada.
- Crie registro de contribuição em transação única: journal entry e contribution devem ser confirmados ou revertidos juntos.
- Importação de extratos deve ser idempotente e nunca gerar lançamento contábil automaticamente.
- Movimentos de estoque devem ser imutáveis; transferências entre congregações precisam registrar origem e destino e manter saldo consolidado correto.

FASE C — INTEGRAÇÃO DO FRONTEND
- Integre as rotas existentes e recém-adicionadas: cadastro-membros, igreja, orçamento, patrimônio, bancos, institucional, encerramento, lançamentos e relatórios.
- Garanta que a rota de membros da igreja seja separada da rota de usuários/permissões do sistema.
- Atualize/regere os tipos do banco e a árvore de rotas gerada pelo TanStack Router usando o processo normal do projeto. Não edite arquivos gerados manualmente.
- Corrija todos os erros de TypeScript, imports, nomes de colunas, relacionamentos e contratos de RPC.
- A página de lançamentos deve oferecer apenas estorno com justificativa, nunca excluir.
- Relatórios devem usar razão contábil como fonte de verdade e exibir dados institucionais e campos de assinatura manual quando cadastrados.
- Carteirinhas devem imprimir frente e verso em tamanho físico ID-1 de 85,6 × 54 mm, individualmente e em lote, sem expor CPF completo.

FASE D — TESTES OBRIGATÓRIOS
Execute e corrija:
- build de produção, TypeScript, lint e testes automatizados;
- RLS com dois usuários em organizações distintas, comprovando isolamento de leitura e escrita;
- CRUD de membros, inativação, vínculo de contribuição e tentativa de associar membro de outra organização;
- partidas dobradas, estorno inverso exato, estorno duplicado, motivo vazio e tentativa de exclusão física;
- fechamento anual com superávit e déficit, duplicidade e exercício já fechado;
- orçamento aprovado e tentativa de alteração indevida;
- movimentos de estoque, transferência entre congregações, inventário físico e ajuste aprovado;
- importação CSV repetida, duplicidade, conciliação e diferença entre saldo bancário e contábil;
- relatórios BP, DRE/superávit ou déficit, balancete, razonetes e CSV.

Não declare teste como aprovado se não tiver executado. Se algum teste não puder ser executado no ambiente, registre exatamente a limitação.

FASE E — ENTREGA
Ao terminar, informe:
1. tabelas e colunas criadas/alteradas;
2. RPCs e policies criadas/alteradas;
3. telas integradas;
4. testes executados com resultado real;
5. pendências, riscos e qualquer ação manual necessária;
6. confirmação de que dados existentes foram preservados.
Não faça deploy nem merge sem autorização explícita.


## Identidade visual e nome do produto
- O nome exibido do produto é **Sapucaí Tropicalis**.
- Preserve o símbolo, a marca gráfica, ícones, cores, tipografia e layout já existentes. Não redesenhe nem substitua a logo; altere apenas os textos de marca.
- Não altere o identificador técnico do projeto Lovable, URLs, IDs, nome de repositório, tabelas, schemas ou dados de usuários como parte da mudança de marca.
