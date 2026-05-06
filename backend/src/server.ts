// src/server.ts
import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({ logger: true });

// Registrar plugins
import corsPlugin from './plugins/cors';
import jwtPlugin from './plugins/jwt';
import supabasePlugin from './plugins/supabase';
import multipartPlugin from './plugins/multipart';
import maintenancePlugin from './plugins/maintenance';

fastify.register(corsPlugin);
fastify.register(jwtPlugin);
fastify.register(supabasePlugin);
fastify.register(multipartPlugin);
fastify.register(maintenancePlugin);

// Auth Routes
import authRoutes from './routes/auth';
fastify.register(authRoutes, { prefix: '/api/auth' });

// Client Routes
import clientGlpiRoutes from './routes/client/glpi-routes';
import clientMetricsRoutes from './routes/client/metrics-routes';
import clientDocsRoutes from './routes/client/docs-routes';
import clientDashboardRoutes from './routes/client/dashboard-routes';
import clientNetworkRoutes from './routes/client/network-routes';

fastify.register(clientGlpiRoutes, { prefix: '/api/client/glpi' });
fastify.register(clientMetricsRoutes, { prefix: '/api/client/metrics' });
fastify.register(clientDocsRoutes, { prefix: '/api/client/docs' });
fastify.register(clientDashboardRoutes, { prefix: '/api/client/dashboard' });
fastify.register(clientNetworkRoutes, { prefix: '/api/client/network' });

// Admin Routes
import adminUserRoutes from './routes/admin/users-routes';
import adminCompaniesRoutes from './routes/admin/companies-routes';
import adminDocsRoutes from './routes/admin/docs-routes';
import adminDashboardRoutes from './routes/admin/dashboard-routes';
import adminSettingsRoutes from './routes/admin/settings-routes';
import adminAuditRoutes from './routes/admin/audit-routes';

fastify.register(adminUserRoutes, { prefix: '/api/admin/users' });
fastify.register(adminCompaniesRoutes, { prefix: '/api/admin/companies' });
fastify.register(adminDocsRoutes, { prefix: '/api/admin/docs' });
fastify.register(adminDashboardRoutes, { prefix: '/api/admin/dashboard' });
fastify.register(adminSettingsRoutes, { prefix: '/api/admin/settings' });
fastify.register(adminAuditRoutes, { prefix: '/api/admin/audit-logs' });

// Health check
fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Storage + Sync Scheduler
import { ensureBucketExists } from './services/storage-service';
import { startSyncScheduler } from './jobs/sync-scheduler';

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Servidor rodando na porta ${port}`);

    // Após o servidor subir, inicializar Storage e Scheduler
    try {
      await ensureBucketExists(fastify.supabaseAdmin);
      fastify.log.info('Supabase Storage bucket verificado');
    } catch (err: any) {
      fastify.log.warn('Aviso: não foi possível verificar Storage bucket: ' + err.message);
    }

    // Iniciar Cron Jobs de sincronização
    startSyncScheduler(fastify.supabaseAdmin);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
