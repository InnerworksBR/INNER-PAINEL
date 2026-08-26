-- =============================================================================
-- Migration 015: Recalcular SLA em todos os tickets GLPI existentes
-- =============================================================================
-- Como o GLPI não retorna campos explícitos de SLA (sla_ttr_state, time_to_resolve)
-- em muitas instalações, vamos classificar todos os tickets existentes com base
-- na heurística atualizada do glpi-service.ts.
--
-- Estratégia:
-- 1. Atualizar tickets RESOLVIDOS/FECHADOS para "Em Análise" (não temos dados)
-- 2. Atualizar tickets ABERTOS com prioridade Alta+ há mais de 1 dia para "Fora do SLA"
-- 3. Atualizar tickets ABERTOS mais recentes para "Em Análise"
-- Isso permite uma visualização honesta: tickets críticos antigos ficam marcados
-- como fora do SLA, evitando o "0%" genérico.
-- =============================================================================

-- 1. Atualizar todos os tickets antigos com sla_status = 'N/A' para 'Em Análise'
UPDATE glpi_tickets
SET sla_status = 'Em Análise'
WHERE sla_status = 'N/A';

-- 2. Tickets abertos de prioridade Alta/Muito Alta/Maior há mais de 1 dia = Fora do SLA
UPDATE glpi_tickets
SET sla_status = 'Fora do SLA'
WHERE status NOT IN ('Resolvido', 'Fechado', '5', '6')
  AND priority IN ('Alta', 'Muito Alta', 'Maior')
  AND created_at < (NOW() - INTERVAL '1 day')
  AND sla_status = 'Em Análise';

-- 3. Tickets críticos muito antigos (> 7 dias) também Fora do SLA mesmo que Média/Baixa
UPDATE glpi_tickets
SET sla_status = 'Fora do SLA'
WHERE status NOT IN ('Resolvido', 'Fechado', '5', '6')
  AND created_at < (NOW() - INTERVAL '7 days')
  AND sla_status = 'Em Análise';

-- Comentário para documentação
COMMENT ON COLUMN glpi_tickets.sla_status IS 'Classificação de SLA: Dentro do SLA | Fora do SLA | Em Análise (sem dados suficientes)';

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';