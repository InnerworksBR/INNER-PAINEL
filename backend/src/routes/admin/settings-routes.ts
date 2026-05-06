// src/routes/admin/settings-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { clearSettingsCache } from '../../services/settings-service';

export default async function adminSettingsRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  // Ler todas as configurações
  fastify.get('/', async (_request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*');

    if (error) return reply.code(500).send({ error: error.message });

    // Converter array de {key, value} para objeto {key: value}
    const settings: Record<string, string> = {};
    (data || []).forEach((row: any) => {
      settings[row.key] = row.value;
    });

    return settings;
  });

  // Salvar configurações (bulk upsert)
  fastify.post<{ Body: Record<string, string> }>('/', async (request, reply) => {
    const allowedKeys = ['systemName', 'baseUrl', 'sessionTimeout', 'maintenanceMode', 'detailedLogs'];
    const settingsObj = Object.fromEntries(
      Object.entries(request.body).filter(([key]) => allowedKeys.includes(key))
    );

    const rows = Object.entries(settingsObj).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) return reply.code(500).send({ error: error.message });
    clearSettingsCache();
    return { success: true };
  });
}
