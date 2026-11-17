import dotenv from 'dotenv';
import { buildApp } from './app';
import { startSyncScheduler } from './jobs/sync-scheduler';
import { startSiteMarketingMail } from './jobs/site-marketing-mail';
import { ensureBucketExists } from './services/storage-service';

dotenv.config();

const fastify = buildApp({
  logger: {
    serializers: {
      req(request) {
        const url = (request.url ?? '')
          .replace(/(\/api\/public\/ebooks\/(?:download|confirm|unsubscribe)\/)[^?#]*/i, '$1[redacted]')
          .replace(/(\/api\/admin\/marketing\/contacts)\?.*/i, '$1');
        return { method: request.method, url, host: request.hostname, remoteAddress: request.ip, remotePort: request.socket?.remotePort };
      },
    },
  },
});
let stopMarketingMail: (() => void) | undefined;
fastify.addHook('onClose', async () => { stopMarketingMail?.(); });

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Servidor rodando na porta ${port}`);

    try {
      await ensureBucketExists(fastify.supabaseAdmin);
      fastify.log.info('Supabase Storage bucket verificado');
    } catch (err: any) {
      fastify.log.warn('Aviso: nao foi possivel verificar Storage bucket: ' + err.message);
    }

    startSyncScheduler(fastify.supabaseAdmin);
    stopMarketingMail = startSiteMarketingMail(fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
