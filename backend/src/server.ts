import dotenv from 'dotenv';
import { buildApp } from './app';
import { startSyncScheduler } from './jobs/sync-scheduler';
import { ensureBucketExists, ensureSecurityBucketExists } from './services/storage-service';

dotenv.config();

const fastify = buildApp();

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Servidor rodando na porta ${port}`);

    try {
      await ensureBucketExists(fastify.supabaseAdmin);
      await ensureSecurityBucketExists(fastify.supabaseAdmin);
      fastify.log.info('Supabase Storage buckets verificados');
    } catch (err: any) {
      fastify.log.warn('Aviso: nao foi possivel verificar Storage bucket: ' + err.message);
    }

    startSyncScheduler(fastify.supabaseAdmin);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
