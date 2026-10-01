import type { FastifyInstance } from 'fastify';
import { loadCompanyRows } from '../../services/portal-data-service';
import { applyServerFreshness } from '../../services/monitoring-freshness-service';
import { isResolvedTicket } from '../../services/ticket-status';
import type { JWTPayload } from '../../types';
import { resolveCompanyScope, sendCompanyScopeError } from '../../services/company-scope-service';

export default async function clientDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/summary', async (request, reply) => {
    const { user } = request.user as JWTPayload;

    try {
      const { targetCompanyId } = await resolveCompanyScope(
        supabaseAdmin,
        user,
        (request.query as any)?.company_id
      );
      const [ms365, servers, tickets, docs, network, assetProfiles] = await Promise.all([
        loadCompanyRows(supabaseAdmin, 'ms365_metrics', targetCompanyId),
        loadCompanyRows(supabaseAdmin, 'servers', targetCompanyId, { monitoring_source: 'agent_native' }),
        loadCompanyRows(supabaseAdmin, 'glpi_tickets', targetCompanyId),
        loadCompanyRows(supabaseAdmin, 'documents', targetCompanyId),
        loadCompanyRows(supabaseAdmin, 'network_devices', targetCompanyId),
        loadCompanyRows(supabaseAdmin, 'asset_profiles', targetCompanyId),
      ]);
      const visibleServers = servers.map(applyServerFreshness);
      const visibleNetworkDeviceIds = new Set(
        assetProfiles
          .filter((profile: any) => profile.source_type === 'network_device' && profile.customer_visible === true)
          .map((profile: any) => profile.source_id)
      );
      const visibleNetwork = network.filter((device: any) => visibleNetworkDeviceIds.has(device.id));

      const validMs365 = ms365.filter((metric: any) => metric.include_in_dashboard === true);
      const totalLicenses = validMs365.reduce((acc: number, m: any) => acc + (m.total || 0), 0);
      const assignedLicenses = validMs365.reduce((acc: number, m: any) => acc + (m.used || 0), 0);
      const utilizationRate = totalLicenses > 0 ? (assignedLicenses / totalLicenses) * 100 : 0;

      const onlineServers = visibleServers.filter((s: any) => s.status === 'Online').length;
      const openTickets = tickets.filter((t: any) => !isResolvedTicket(t.status)).length;
      const resolvedTickets = tickets.length - openTickets;
      const onlineDevices = visibleNetwork.filter((d: any) => d.status === 'Online').length;

      return {
        ms365: {
          hasData: ms365.length > 0,
          assignedLicenses,
          activeUsers: assignedLicenses,
          totalLicenses,
          utilizationRate: Number(utilizationRate.toFixed(1)),
          lastUpdated: getLatestDate(ms365, 'last_updated'),
        },
        servers: {
          hasData: visibleServers.length > 0,
          total: visibleServers.length,
          online: onlineServers,
          offline: visibleServers.filter((server: any) => server.status === 'Offline').length,
          warning: visibleServers.filter((server: any) => server.status === 'Atencao').length,
          avgCpu: average(visibleServers, 'cpu_usage'),
          lastUpdated: getLatestDate(visibleServers, 'last_updated'),
        },
        tickets: {
          hasData: tickets.length > 0,
          total: tickets.length,
          open: openTickets,
          resolved: resolvedTickets,
          lastUpdated: getLatestDate(tickets, 'created_at'),
        },
        network: {
          hasData: visibleNetwork.length > 0,
          total: visibleNetwork.length,
          online: onlineDevices,
          offline: visibleNetwork.length - onlineDevices,
          lastUpdated: getLatestDate(visibleNetwork, 'last_updated'),
        },
        documents: {
          hasData: docs.length > 0,
          total: docs.length,
          lastUpdated: getLatestDate(docs, 'created_at'),
        },
        health: calculateHealthScore({ servers: visibleServers, network: visibleNetwork, healthProfiles: assetProfiles }),
      };
    } catch (err: any) {
      if (err.name === 'CompanyScopeError') return sendCompanyScopeError(reply, err);
      return reply.code(500).send({ error: err.message });
    }
  });
}

function average(rows: any[], field: string): number {
  if (rows.length === 0) return 0;
  const value = rows.reduce((acc, row) => acc + (row[field] || 0), 0) / rows.length;
  return Number(value.toFixed(1));
}

function getLatestDate(rows: any[], field: string): string | null {
  const latest = rows
    .map((row) => row[field])
    .filter(Boolean)
    .sort()
    .at(-1);

  return latest || null;
}

function calculateHealthScore({
  servers,
  network,
  healthProfiles,
}: {
  servers: any[];
  network: any[];
  healthProfiles: any[];
}): { hasData: boolean; healthy: number; warning: number; critical: number } {
  let healthy = 0;
  let warning = 0;
  let critical = 0;

  const excludedServers = new Set(
    healthProfiles
      .filter((profile: any) => profile.source_type === 'server' && profile.include_in_health_score === false)
      .map((profile: any) => profile.source_id)
  );
  const excludedNetworkDevices = new Set(
    healthProfiles
      .filter((profile: any) => profile.source_type === 'network_device' && profile.include_in_health_score === false)
      .map((profile: any) => profile.source_id)
  );
  const includedServers = servers.filter((server: any) => !excludedServers.has(server.id));
  const includedNetwork = network.filter((device: any) => !excludedNetworkDevices.has(device.id));

  includedServers.forEach((server: any) => {
    if (server.status === 'Offline' || server.cpu_usage > 90 || server.memory_usage > 90) {
      critical++;
    } else if (server.status !== 'Online' || server.cpu_usage > 70 || server.memory_usage > 70) {
      warning++;
    } else {
      healthy++;
    }
  });

  includedNetwork.forEach((device: any) => {
    if (device.status !== 'Online') critical++;
    else healthy++;
  });

  const total = Math.max(healthy + warning + critical, 1);
  return {
    hasData: healthy + warning + critical > 0,
    healthy: Math.round((healthy / total) * 100),
    warning: Math.round((warning / total) * 100),
    critical: Math.round((critical / total) * 100),
  };
}
