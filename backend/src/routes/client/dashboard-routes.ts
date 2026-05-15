import type { FastifyInstance } from 'fastify';
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
      const filterByCompany = (query: any) => {
        if (targetCompanyId) {
          return query.eq('company_id', targetCompanyId);
        }
        return query;
      };

      const [ms365Res, serversRes, ticketsRes, docsRes, networkRes, assetProfilesRes] = await Promise.all([
        filterByCompany(supabaseAdmin.from('ms365_metrics').select('*')),
        filterByCompany(supabaseAdmin.from('servers').select('*')),
        filterByCompany(supabaseAdmin.from('glpi_tickets').select('*')),
        filterByCompany(supabaseAdmin.from('documents').select('id, created_at')),
        filterByCompany(supabaseAdmin.from('network_devices').select('*')),
        filterByCompany(
          supabaseAdmin
            .from('asset_profiles')
            .select('source_type, source_id, customer_visible, include_in_health_score')
        ),
      ]);

      const ms365 = ms365Res.data || [];
      const servers = serversRes.data || [];
      const tickets = ticketsRes.data || [];
      const docs = docsRes.data || [];
      const network = networkRes.data || [];
      const assetProfiles = assetProfilesRes.data || [];
      const visibleServerIds = new Set(
        assetProfiles
          .filter((profile: any) => profile.source_type === 'server' && profile.customer_visible === true)
          .map((profile: any) => profile.source_id)
      );
      const visibleNetworkDeviceIds = new Set(
        assetProfiles
          .filter((profile: any) => profile.source_type === 'network_device' && profile.customer_visible === true)
          .map((profile: any) => profile.source_id)
      );
      const visibleServers = servers.filter((server: any) => visibleServerIds.has(server.id));
      const visibleNetwork = network.filter((device: any) => visibleNetworkDeviceIds.has(device.id));

      const validMs365 = ms365.filter(isPaidLicenseForTotal);
      const totalLicenses = validMs365.reduce((acc: number, m: any) => acc + (m.total || 0), 0);
      const assignedLicenses = validMs365.reduce((acc: number, m: any) => acc + (m.used || 0), 0);
      const utilizationRate = totalLicenses > 0 ? (assignedLicenses / totalLicenses) * 100 : 0;

      const onlineServers = visibleServers.filter((s: any) => s.status === 'Online').length;
      const openTickets = tickets.filter((t: any) => !['Resolvido', 'Fechado', '5', '6'].includes(t.status)).length;
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
          offline: visibleServers.length - onlineServers,
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
      const scopedError = sendCompanyScopeError(reply, err);
      if (scopedError) return scopedError;
      return reply.code(500).send({ error: err.message });
    }
  });
}

function isPaidLicenseForTotal(m: any): boolean {
  if (!m.license_name) return false;
  if (m.total > 10005) return false;

  const n = m.license_name.toLowerCase();
  const paidKeywords = ['business', 'exchange', 'power', 'premium', 'standard', 'enterprise', 'visio', 'project', 'e3', 'e5'];
  const freeKeywords = ['free', 'exploratory', 'audit', 'compliance', 'security', 'defender', 'teams', 'virtual', 'stream'];

  if (freeKeywords.some((kw) => n.includes(kw))) return false;
  return paidKeywords.some((kw) => n.includes(kw));
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
}): { healthy: number; warning: number; critical: number } {
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

  if (includedServers.length === 0) warning++;
  includedServers.forEach((server: any) => {
    if (server.status !== 'Online' || server.cpu_usage > 90 || server.memory_usage > 90) {
      critical++;
    } else if (server.cpu_usage > 70 || server.memory_usage > 70) {
      warning++;
    } else {
      healthy++;
    }
  });

  if (includedNetwork.some((device: any) => device.status !== 'Online')) warning++;

  const total = Math.max(healthy + warning + critical, 1);
  return {
    healthy: Math.round((healthy / total) * 100),
    warning: Math.round((warning / total) * 100),
    critical: Math.round((critical / total) * 100),
  };
}
