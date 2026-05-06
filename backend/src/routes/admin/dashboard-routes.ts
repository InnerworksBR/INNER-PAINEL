// src/routes/admin/dashboard-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

export default async function adminDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get('/stats', async (_request, reply) => {
    try {
      const [
        companiesRes,
        profilesRes,
        documentsRes,
        integrationsRes,
        criticalEventsRes,
        auditLogsRes,
      ] = await Promise.all([
        supabaseAdmin.from('companies').select('id, status'),
        supabaseAdmin.from('profiles').select('id, role, status'),
        supabaseAdmin.from('documents').select('id, file_url'),
        supabaseAdmin.from('company_integrations').select('*'),
        supabaseAdmin
          .from('monitoring_events')
          .select('*')
          .eq('severity', 'critical')
          .order('created_at', { ascending: false })
          .limit(5),
        supabaseAdmin
          .from('admin_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const companies = companiesRes.data || [];
      const profiles = profilesRes.data || [];
      const documents = documentsRes.data || [];
      const integrations = integrationsRes.data || [];

      const documentsStored = documents.filter((doc: any) => doc.file_url && doc.file_url !== 'storage_pendente').length;
      const integrationsWithError = integrations.filter(hasAnySyncError).length;
      const integrationsWithoutSync = integrations.filter(hasNoSync).length;
      const configuredIntegrations = integrations.filter(hasAnyConfiguredIntegration).length;

      return {
        companies: {
          total: companies.length,
          active: companies.filter((c: any) => String(c.status || '').toLowerCase() === 'ativo').length,
        },
        users: {
          total: profiles.length,
          admins: profiles.filter((p: any) => p.role === 'admin').length,
          clients: profiles.filter((p: any) => p.role === 'client').length,
          active: profiles.filter((p: any) => (p.status || 'active') === 'active').length,
          blocked: profiles.filter((p: any) => p.status === 'blocked').length,
        },
        documents: {
          total: documents.length,
          stored: documentsStored,
          pending: documents.length - documentsStored,
        },
        integrations: {
          total: integrations.length,
          configured: configuredIntegrations,
          withError: integrationsWithError,
          withoutSync: integrationsWithoutSync,
        },
        recentCriticalEvents: criticalEventsRes.data || [],
        recentAuditLogs: auditLogsRes.data || [],
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}

function hasAnySyncError(integration: any): boolean {
  return Boolean(
    integration.ms365_last_sync_error ||
    integration.zabbix_last_sync_error ||
    integration.zabbix_network_last_sync_error ||
    integration.glpi_last_sync_error
  );
}

function hasNoSync(integration: any): boolean {
  return !integration.ms365_last_sync_at &&
    !integration.zabbix_last_sync_at &&
    !integration.zabbix_network_last_sync_at &&
    !integration.glpi_last_sync_at;
}

function hasAnyConfiguredIntegration(integration: any): boolean {
  return Boolean(
    integration.zabbix_api_url ||
    integration.ms_graph_tenant_id ||
    integration.glpi_api_url
  );
}
