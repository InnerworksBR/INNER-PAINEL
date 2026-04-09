// src/routes/admin/settings-routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';

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
    const settingsObj = request.body;

    const rows = Object.entries(settingsObj).map(([key, value]) => ({
      key,
      value: String(value),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert(rows, { onConflict: 'key' });

    if (error) return reply.code(500).send({ error: error.message });
    return { success: true };
  });
}
