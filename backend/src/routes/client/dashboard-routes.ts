// src/routes/client/dashboard-routes.ts
import type { FastifyInstance } from 'fastify';
import type { JWTPayload } from '../../types';

export default async function clientDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);

  // Dashboard agregado para o cliente
  fastify.get('/summary', async (request, reply) => {
    const { user } = request.user as JWTPayload;
    const companyId = user.company_id;

    if (user.role !== 'admin' && !companyId) {
      return reply.code(403).send({ error: 'Usuário sem empresa associada' });
    }

    try {
      // Build queries filtered by company for clients
      const filterByCompany = (query: any) => {
        if (user.role !== 'admin' && companyId) {
          return query.eq('company_id', companyId);
        }
        return query;
      };

      const [ms365Res, serversRes, ticketsRes, docsRes] = await Promise.all([
        filterByCompany(supabaseAdmin.from('ms365_metrics').select('*')),
        filterByCompany(supabaseAdmin.from('servers').select('*')),
        filterByCompany(supabaseAdmin.from('glpi_tickets').select('*')),
        filterByCompany(supabaseAdmin.from('documents').select('id', { count: 'exact', head: true })),
      ]);

      const ms365 = ms365Res.data || [];
      const servers = serversRes.data || [];
      const tickets = ticketsRes.data || [];

      // Filtro para considerar apenas licenças "Pagas" ou Centrais (reduzindo distorção de 3 milhões de licenças gratuitas)
      // Filtro Rigoroso: Microsoft tem várias licenças de 1 milhão (free) e Add-ons que dobram a contagem de usuários
      const isBaseLicenseForUserCount = (name: string) => {
        const n = name.toLowerCase();
        // Apenas licenças Teto (que dão caixa de e-mail ao usuário) devem somar na quantidade de "Usuários Ativos"
        return n.includes('business') || n.includes('exchange') || n.includes('enterprise') || n.includes('standard');
      };

      const isPaidLicenseForTotal = (m: any) => {
        if (!m.license_name) return false;
        if (m.total > 10005) return false; // SKUs da Microsoft com limites gigantes e irreais (1 milhão) costumam ser lixo de background
        
        const n = m.license_name.toLowerCase();
        const paidKeywords = ['business', 'exchange', 'power', 'premium', 'standard', 'enterprise', 'visio', 'project', 'e3', 'e5'];
        const freeKeywords = ['free', 'exploratory', 'audit', 'compliance', 'security', 'defender', 'teams', 'virtual', 'stream'];
        
        if (freeKeywords.some(kw => n.includes(kw))) return false;
        return paidKeywords.some(kw => n.includes(kw));
      };

      const validMs365 = ms365.filter(isPaidLicenseForTotal);
      const baseMs365ForUsers = validMs365.filter((m: any) => isBaseLicenseForUserCount(m.license_name));

      // MS365 Stats
      const totalLicenses = validMs365.reduce((acc: number, m: any) => acc + (m.total || 0), 0);
      const usedLicenses = baseMs365ForUsers.reduce((acc: number, m: any) => acc + (m.used || 0), 0); // Soma estrita
      const utilizationRate = totalLicenses > 0 ? ((usedLicenses / totalLicenses) * 100).toFixed(1) : '0';

      // Server Stats
      const onlineServers = servers.filter((s: any) => s.status === 'Online').length;
      const totalServers = servers.length;
      const avgCpu = servers.length > 0
        ? (servers.reduce((acc: number, s: any) => acc + (s.cpu_usage || 0), 0) / servers.length).toFixed(1)
        : '0';

      // Ticket Stats
      const openTickets = tickets.filter((t: any) =>
        !['Resolvido', 'Fechado', '5', '6'].includes(t.status)
      ).length;
      const resolvedTickets = tickets.filter((t: any) =>
        ['Resolvido', 'Fechado', '5', '6'].includes(t.status)
      ).length;

      // Health calculation
      const healthScore = calculateHealthScore(servers, ms365, tickets);

      return {
        ms365: {
          activeUsers: usedLicenses,
          totalLicenses,
          utilizationRate: parseFloat(utilizationRate),
          lastUpdated: ms365[0]?.last_updated || null,
        },
        servers: {
          total: totalServers,
          online: onlineServers,
          offline: totalServers - onlineServers,
          avgCpu: parseFloat(avgCpu),
        },
        tickets: {
          total: tickets.length,
          open: openTickets,
          resolved: resolvedTickets,
        },
        documents: {
          total: docsRes.count || 0,
        },
        health: healthScore,
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}

function calculateHealthScore(servers: any[], ms365: any[], tickets: any[]): { healthy: number; warning: number; critical: number } {
  let healthy = 0;
  let warning = 0;
  let critical = 0;

  // Server health
  servers.forEach((s: any) => {
    if (s.status !== 'Online') { critical++; return; }
    if (s.cpu_usage > 90 || s.memory_usage > 90) { critical++; return; }
    if (s.cpu_usage > 70 || s.memory_usage > 70) { warning++; return; }
    healthy++;
  });

  // Convert to percentages
  const total = Math.max(servers.length, 1);
  return {
    healthy: Math.round((healthy / total) * 100),
    warning: Math.round((warning / total) * 100),
    critical: Math.round((critical / total) * 100),
  };
}
