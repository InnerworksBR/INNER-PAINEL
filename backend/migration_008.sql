-- migration_008.sql
-- Mantém a base GLPI local consistente após correções de escopo/sincronização.
-- Esta migration não altera estrutura; serve como marco operacional para nova sincronização limpa.

COMMENT ON TABLE glpi_tickets IS
  'Espelho atual dos chamados sincronizados do GLPI por empresa; chamados ausentes em nova sincronização são removidos.';
