# Plano mestre — Inner Monitoring

**Data da análise:** 2026-08-26  
**Decisão de convergência atual:** reprovado para conclusão funcional  
**Marco prioritário:** servidores Windows monitorados por agente visíveis no portal do cliente

## Resultado esperado

Ao concluir as implementações `001` a `005`, cada servidor Windows com o Agente Inner instalado deverá:

1. registrar-se uma única vez na empresa correta;
2. coletar e armazenar dados offline quando necessário;
3. enviar batches e heartbeats com renovação automática de credenciais;
4. ser transformado pelo Worker em um único asset de servidor com métricas atuais e históricas;
5. aparecer em **Portal do cliente → Servidores**, com status, CPU, memória, discos e horário da última coleta;
6. aparecer no resumo administrativo da empresa, com quantidade, online/offline, última sincronização e versão;
7. permanecer operável após reinício, atualização, indisponibilidade temporária e rollback.

## Estado comprovado em 2026-08-26

| Achado | Severidade | Evidência | Consequência |
|---|---|---|---|
| O Worker não possui container em execução no EasyPanel | critical | `getDockerContainers(innerworks_monitoring-worker) = []` | Batches não são transformados em assets/métricas |
| O processamento do Worker é simulado | critical | `BatchProcessingWorker.ProcessBatchAsync` apenas aguarda 10 ms e retorna sucesso | Mesmo implantado, pode marcar lote processado sem gravar dados |
| A listagem de assets sempre resolve empresa como `null` | high | `AssetQueryService.GetCompanyIdFromQuery()` retorna `null` | `GET /assets` retorna lista vazia |
| O portal consulta o Supabase, não o PostgreSQL do Monitoring | high | `backend/src/routes/client/metrics-routes.ts` consulta `servers` | Dados recebidos pela API não aparecem na tela |
| O status administrativo do agente é estático | high | `empresasAdmin.jsx` usa `lastSync: null` e `count: null` | O portal mostra `Nunca/0` independentemente do estado real |
| Cliente TypeScript existe, mas não está conectado e falha no typecheck | high | `monitoring-api-client.ts`; `npx tsc --noEmit` falha em 3 pontos | Não há BFF funcional para o portal |
| Testes de integração do Monitoring são placeholder | high | `UnitTest1` é o único teste do projeto de integração | Não há prova automatizada do fluxo agente → portal |
| Loop do agente não fecha configuração, comandos e retry completo | medium | chamadas não conectadas; outbox sem backoff/attempts | Operação degrada em falhas reais |
| Documentação diverge do runtime e dos endpoints | medium | docs citam .NET 10, Redis/Kubernetes e rotas diferentes; projetos usam .NET 8/EasyPanel | Runbooks e suporte podem executar procedimentos errados |
| A linha de base do web não está verde | medium | 3 testes falhando e 7 erros de lint | Release não possui gate confiável |

## Implementações e ordem

| ID | Implementação | Prioridade | Dependências | Marco |
|---|---|---:|---|---|
| [001](./001-pipeline-real/) | Pipeline real de batches, assets e métricas | P0 | nenhuma | Servidores Windows |
| [002](./002-api-consulta-monitoring/) | API de consulta tenant-safe e contratos do portal | P0 | 001 | Servidores Windows |
| [003](./003-integracao-portal-monitoring/) | BFF Fastify e telas do portal | P0 | 002 | Servidores Windows |
| [004](./004-agente-frota-windows/) | Confiabilidade, instalação e gestão da frota Windows | P0 | 001; integra com 002 | Servidores Windows |
| [005](./005-release-producao-monitoring/) | Testes, observabilidade, deploy e aceite em produção | P0 | 001–004 | Servidores Windows |
| [006](./006-rede-hyperv/) | Edge Collector SNMP, Hyper-V e ativos derivados | P1 | 001, 002, 004 | Expansão funcional |
| [007](./007-operacao-avancada/) | Rollups, retenção, alertas, comandos e updates | P1 | 001, 002, 005 | Maturidade operacional |

## Caminho crítico para finalizar rápido

`001 pipeline real` → `002 API de consulta` → `003 portal` → `005 rollout`, enquanto `004 agente` pode avançar em paralelo após o contrato de identidade de assets ser fechado.

## Gates obrigatórios

- Aprovação explícita dos `spec.md` antes de alterar código.
- Migration aditiva, backup verificado e rollback antes de produção.
- Revisão independente de segurança para autenticação, isolamento por empresa e tokens.
- Testes unitários, integração PostgreSQL, contrato, frontend e E2E reais.
- Aprovação específica imediatamente antes de cada deploy no EasyPanel.
- Aceite final somente com um agente piloto visível no portal e um segundo endpoint validando separação por empresa.

## Fora do marco prioritário, mas não perdido

SNMP, Hyper-V, rollups, retenção, alertas, comandos remotos e atualização assinada estão rastreados em `006` e `007`. Eles não bloqueiam a primeira entrega útil de servidores Windows, mas não podem ser declarados concluídos com o código atual.
