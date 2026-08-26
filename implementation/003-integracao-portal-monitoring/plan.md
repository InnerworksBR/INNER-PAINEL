# Plano

## Estratégia

Introduzir rotas BFF e adaptadores mantendo os URLs que a tela já usa quando isso reduzir risco. Ativar o Monitoring por feature flag, validar piloto, migrar dashboard/admin e remover o fallback apenas após aceite.

## Arquivos previstos

- `backend/src/services/monitoring-api-client.ts`
- novo helper de bridge auth e rotas client/admin monitoring
- `backend/src/routes/client/metrics-routes.ts`, dashboard routes e `app.ts`
- `web/src/pages/paginasClient/Servidores/servidores.jsx`
- `web/src/pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx`
- dashboard, hooks e testes correspondentes.

## Sequência reversível

- Registrar BFF sem alterar UI.
- Adicionar feature flag `MONITORING_READ_SOURCE`.
- Migrar Servidores, depois admin e dashboard.
- Manter fallback somente durante piloto e remover em tarefa explícita.

## Testes e validações

- Backend com Monitoring API mockada e testes de tenant.
- Componentes React com empty/error/loading/data.
- E2E cliente e admin em viewport desktop/mobile.
- Comparação de contagens entre API, portal e banco.

## Rollback

- Voltar feature flag para `supabase` sem migration/redeploy do agente.
- Preservar rotas antigas durante a janela de estabilização.

## Aprovações necessárias

- Aprovação do comportamento visual e dos estados.
- Aprovação específica para deploy de backend/web e mudança da feature flag em produção.
