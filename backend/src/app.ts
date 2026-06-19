import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';

import adminAuditRoutes from './routes/admin/audit-routes';
import adminSecurityRoutes from './routes/admin/security-routes';
import clientSecurityRoutes from './routes/client/security-routes';
import adminCompaniesRoutes from './routes/admin/companies-routes';
import adminDashboardRoutes from './routes/admin/dashboard-routes';
import adminDocsRoutes from './routes/admin/docs-routes';
import adminInventoryRoutes from './routes/admin/inventory-routes';
import adminMs365Routes from './routes/admin/ms365-routes';
import adminSettingsRoutes from './routes/admin/settings-routes';
import adminUserRoutes from './routes/admin/users-routes';
import authRoutes from './routes/auth';
import clientDashboardRoutes from './routes/client/dashboard-routes';
import clientDocsRoutes from './routes/client/docs-routes';
import clientGlpiRoutes from './routes/client/glpi-routes';
import clientMetricsRoutes from './routes/client/metrics-routes';
import clientNetworkRoutes from './routes/client/network-routes';
import corsPlugin from './plugins/cors';
import jwtPlugin from './plugins/jwt';
import maintenancePlugin from './plugins/maintenance';
import multipartPlugin from './plugins/multipart';
import supabasePlugin from './plugins/supabase';

export function buildApp(options: FastifyServerOptions = { logger: true }): FastifyInstance {
  const fastify = Fastify(options);

  fastify.register(corsPlugin);
  fastify.register(jwtPlugin);
  fastify.register(supabasePlugin);
  fastify.register(multipartPlugin);
  fastify.register(maintenancePlugin);

  fastify.register(authRoutes, { prefix: '/api/auth' });

  fastify.register(clientGlpiRoutes, { prefix: '/api/client/glpi' });
  fastify.register(clientMetricsRoutes, { prefix: '/api/client/metrics' });
  fastify.register(clientDocsRoutes, { prefix: '/api/client/docs' });
  fastify.register(clientDashboardRoutes, { prefix: '/api/client/dashboard' });
  fastify.register(clientNetworkRoutes, { prefix: '/api/client/network' });
  fastify.register(clientSecurityRoutes, { prefix: '/api/client/security' });

  fastify.register(adminUserRoutes, { prefix: '/api/admin/users' });
  fastify.register(adminCompaniesRoutes, { prefix: '/api/admin/companies' });
  fastify.register(adminDocsRoutes, { prefix: '/api/admin/docs' });
  fastify.register(adminDashboardRoutes, { prefix: '/api/admin/dashboard' });
  fastify.register(adminSettingsRoutes, { prefix: '/api/admin/settings' });
  fastify.register(adminAuditRoutes, { prefix: '/api/admin/audit-logs' });
  fastify.register(adminInventoryRoutes, { prefix: '/api/admin/inventory' });
  fastify.register(adminMs365Routes, { prefix: '/api/admin/ms365' });
  fastify.register(adminSecurityRoutes, { prefix: '/api/admin/security' });

  fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return fastify;
}
