// src/routes/admin/noc-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

import { isResolvedTicket } from '../../services/ticket-status';

export default async function adminNocRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get('/stats', async (_request, reply) => {
    try {
      // Fetch companies for the NOC overview.
      const companiesRes = await supabaseAdmin
        .from('companies')
        .select('id, name')
        .order('name');

      const companies = companiesRes.data || [];

      // Create company map for lookups
      const companyMap = new Map(companies.map(c => [c.id, c.name]));

      // Company health comes only from network device availability.
      const networkDevices: any[] = [];
      const devicePageSize = 500;
      for (let offset = 0; ; offset += devicePageSize) {
        const { data, error } = await supabaseAdmin
          .from('network_devices')
          .select('company_id, status')
          .order('company_id')
          .order('id')
          .range(offset, offset + devicePageSize - 1);

        if (error) throw error;
        const page = data || [];
        networkDevices.push(...page);
        if (page.length < devicePageSize) break;
      }

      // Fetch all tickets for company aggregates; keep only the latest 20 for the recent list.
      const tickets: any[] = [];
      const ticketPageSize = 500;
      for (let offset = 0; ; offset += ticketPageSize) {
        const { data, error } = await supabaseAdmin
          .from('glpi_tickets')
          .select('id, company_id, glpi_id, title, status, sla_status, priority, created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + ticketPageSize - 1);

        if (error) throw error;
        const page = data || [];
        tickets.push(...page);
        if (page.length < ticketPageSize) break;
      }

      // Fetch recent alerts/monitoring events
      const alertsRes = await supabaseAdmin
        .from('monitoring_events')
        .select('company_id, message, severity, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      // Calculate company statuses from network devices only. Tickets and alerts stay as separate data.
      const companiesWithStatus = companies.map((company: any) => {
        const companyNetworkDevices = networkDevices.filter(
          (device: any) => device.company_id === company.id
        );
        const offlineNetworkDevices = companyNetworkDevices.filter(
          (device: any) => String(device.status || '').trim().toLowerCase() !== 'online'
        );

        // Count open/critical tickets for this company
        const companyTickets = tickets.filter(
          (t: any) => t.company_id === company.id
        );
        const openTickets = companyTickets.filter(
          (t: any) => !isResolvedTicket(t.status)
        );
        const criticalTickets = companyTickets.filter(
          (t: any) => t.sla_status === 'Fora do SLA' || t.priority === 'Alta' || t.priority === 'Muito Alta'
        );

        // Get last alert for this company
        const companyAlerts = (alertsRes.data || []).filter(
          (a: any) => a.company_id === company.id
        );
        const lastAlert = companyAlerts[0] || null;

        let status: 'online' | 'warning' | 'critical' | 'offline' = 'online';
        if (offlineNetworkDevices.length > 0 && offlineNetworkDevices.length === companyNetworkDevices.length) {
          status = 'offline';
        } else if (offlineNetworkDevices.length > 0) {
          status = 'critical';
        }

        // Measure actual SLA classifications; unresolved tickets can still be within SLA.
        const ticketsWithKnownSla = companyTickets.filter(
          (t: any) => t.sla_status === 'Dentro do SLA' || t.sla_status === 'Fora do SLA'
        );
        const ticketsWithinSla = ticketsWithKnownSla.filter(
          (t: any) => t.sla_status === 'Dentro do SLA'
        ).length;
        let slaCompliance: number | null = null;
        if (ticketsWithKnownSla.length > 0) {
          slaCompliance = Math.round((ticketsWithinSla / ticketsWithKnownSla.length) * 100);
        }

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
      const recentTickets = tickets.slice(0, 20).map((ticket: any) => ({
        id: ticket.glpi_id || ticket.id,
        companyId: ticket.company_id,
        companyName: companyMap.get(ticket.company_id) || 'N/A',
        title: ticket.title || '(sem título)',
        status: ticket.status,
        urgency: ticket.sla_status === 'Fora do SLA' ? 'critical' :
          (ticket.priority === 'Alta' || ticket.priority === 'Muito Alta') ? 'high' : 'info',
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
