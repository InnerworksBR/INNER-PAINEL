# Relatórios mensais GLPI — plano de implementação

**Objetivo:** produzir, consultar e enviar relatórios mensais por empresa com análise da OpenAI.

**Arquitetura:** apuração por período diretamente no GLPI; persistência e concessão atômica no Supabase; geração pela Responses API; entregas individuais via SMTP; configuração administrativa e histórico no portal.

**Stack:** Fastify/TypeScript, Supabase/PostgreSQL, node-cron, React, OpenAI Responses API e SMTP.

**Especificação:** `docs/superpowers/specs/2026-11-05-relatorios-mensais-glpi-design.md`.

## Etapas

1. Criar testes de período, cálculo de indicadores, validação de destinatários e isolamento; implementar funções puras e coleta paginada do GLPI, mantendo a sincronização existente.
2. Criar migração aditiva para configurações, relatórios, entregas e concessões atômicas; implementar geração com OpenAI e processamento recuperável, com tratamento explícito de falhas e estado de entrega incerto.
3. Adicionar endpoints autenticados para administração e consulta por empresa; testar a autorização e os contratos.
4. Acrescentar configuração administrativa para empresas existentes e histórico na tela de chamados, com estados de carregamento e erro.
5. Documentar implantação e variáveis, executar testes pertinentes e builds e revisar o diff e a aderência à especificação.

Cada etapa começa por testes de comportamento quando aplicável. A coleta incompleta impede a publicação; a IA recebe apenas agregados; nenhuma credencial ou texto de chamado é enviado à IA. Não executar envios reais durante a validação.
