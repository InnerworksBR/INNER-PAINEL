// src/routes/admin/noc-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

export default async function adminNocRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get('/stats', async (_request, reply) => {
    try {
      // Fetch companies with their integrations
      const companiesRes = await supabaseAdmin
        .from('companies')
        .select('id, name, status')
        .order('name');

      const companies = companiesRes.data || [];

      // Create company map for lookups
      const companyMap = new Map(companies.map(c => [c.id, c.name]));
      const companyNameToId = new Map(companies.map(c => [c.name.toLowerCase(), c.id]));

      // Fetch integrations for all companies
      const integrationsRes = await supabaseAdmin
        .from('company_integrations')
        .select('company_id, zabbix_last_sync_at, zabbix_last_sync_error, ms365_last_sync_at, ms365_last_sync_error, glpi_last_sync_at, glpi_last_sync_error');

      const integrations = integrationsRes.data || [];

      // Fetch recent tickets (GLPI) - with company_id
      const ticketsRes = await supabaseAdmin
        .from('glpi_tickets')
        .select('id, company_id, name, status, urgency, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch recent alerts/monitoring events
      const alertsRes = await supabaseAdmin
        .from('monitoring_events')
        .select('company_id, message, severity, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      // Calculate company statuses based on integrations and events
      const companiesWithStatus = companies.map((company: any) => {
        const companyIntegrations = integrations.filter(
          (i: any) => i.company_id === company.id
        );
        const integration = companyIntegrations[0];

        // Count open/critical tickets for this company
        const companyTickets = (ticketsRes.data || []).filter(
          (t: any) => t.company_id === company.id
        );
        const openTickets = companyTickets.filter(
          (t: any) => ['open', 'pending', 'in_progress', 'new'].includes(String(t.status).toLowerCase())
        );
        const criticalTickets = companyTickets.filter(
          (t: any) => t.urgency === 'critical' || t.urgency === 'high'
        );

        // Get last alert for this company
        const companyAlerts = (alertsRes.data || []).filter(
          (a: any) => a.company_id === company.id
        );
        const lastAlert = companyAlerts[0] || null;

        // Determine status based on errors, sync status, and critical events
        let status: 'online' | 'warning' | 'critical' | 'offline' = 'online';

        // Check for sync errors
        const hasErrors = integration && (
          integration.zabbix_last_sync_error ||
          integration.ms365_last_sync_error ||
          integration.glpi_last_sync_error
        );

        // Check for critical events
        const hasCriticalEvent = companyAlerts.some(
          (a: any) => a.severity === 'critical'
        );

        // Check for warning events
        const hasWarningEvent = companyAlerts.some(
          (a: any) => a.severity === 'warning'
        );

        // Determine status
        if (hasCriticalEvent || criticalTickets.length > 0) {
          status = 'critical';
        } else if (hasErrors || hasWarningEvent || openTickets.length > 3) {
          status = 'warning';
        } else if (String(company.status || '').toLowerCase() !== 'ativo') {
          status = 'offline';
        }

        // Calculate SLA compliance (simplified - based on ticket resolution)
        const totalTickets = companyTickets.length;
        const resolvedTickets = companyTickets.filter(
          (t: any) => ['closed', 'resolved'].includes(String(t.status).toLowerCase())
        ).length;
        const slaCompliance = totalTickets > 0
          ? Math.round((resolvedTickets / totalTickets) * 100)
          : 100;

        return {
          id: company.id,
          name: company.name,
          status,
          ticketCount: {
            open: openTickets.length,
            critical: criticalTickets.length,
          },
          lastAlert: lastAlert ? {
            message: lastAlert.message,
            severity: lastAlert.severity,
            timestamp: lastAlert.created_at,
          } : null,
          slaCompliance,
        };
      });

      // Count by status
      const statusCounts = {
        online: companiesWithStatus.filter((c: any) => c.status === 'online').length,
        warning: companiesWithStatus.filter((c: any) => c.status === 'warning').length,
        critical: companiesWithStatus.filter((c: any) => c.status === 'critical').length,
        offline: companiesWithStatus.filter((c: any) => c.status === 'offline').length,
      };

      // Format recent tickets - resolve company name from company_id
      const recentTickets = (ticketsRes.data || []).map((ticket: any) => ({
        id: ticket.id,
        companyId: ticket.company_id,
        companyName: companyMap.get(ticket.company_id) || 'N/A',
        title: ticket.name,
        status: ticket.status,
        urgency: ticket.urgency,
        createdAt: ticket.created_at,
      }));

      // Format recent alerts
      const recentAlerts = (alertsRes.data || []).map((alert: any) => ({
        companyId: alert.company_id,
        companyName: companyMap.get(alert.company_id) || 'N/A',
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.created_at,
      }));

      return {
        timestamp: new Date().toISOString(),
        totalCompanies: companies.length,
        statusCounts,
        companies: companiesWithStatus,
        recentTickets,
        recentAlerts,
      };
    } catch (err: any) {
      fastify.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });
}
