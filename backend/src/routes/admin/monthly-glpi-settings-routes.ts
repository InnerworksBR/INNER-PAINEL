import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { parseReportRecipients } from '../../services/monthly-glpi-metrics';
import { writeAdminAuditLog } from '../../services/audit-service';

export default async function monthlyGlpiSettingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);
  fastify.get<{ Params: { id: string } }>('/:id/monthly-glpi-settings', async (request, reply) => {
    const { data, error } = await fastify.supabaseAdmin.from('monthly_glpi_report_settings').select('enabled,recipients,enabled_at').eq('company_id', request.params.id).maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    return data || { enabled: false, recipients: [] };
  });
  fastify.get<{ Params: { id: string } }>('/:id/monthly-glpi-status', async (request, reply) => {
    const { data, error } = await fastify.supabaseAdmin.from('monthly_glpi_reports')
      .select('id,period_start,state,generated_at,last_error,monthly_glpi_report_deliveries(recipient,state,last_error)')
      .eq('company_id', request.params.id).order('period_start', { ascending: false }).limit(12);
    if (error) return reply.code(500).send({ error: error.message });
    return data || [];
  });
  fastify.put<{ Params: { id: string }; Body: { enabled?: boolean; recipients?: string } }>('/:id/monthly-glpi-settings', async (request, reply) => {
    const { enabled, recipients } = request.body || {};
    if (typeof enabled !== 'boolean' || typeof recipients !== 'string') return reply.code(400).send({ error: 'Informe o estado e os e-mails' });
    let addresses: string[];
    try { addresses = parseReportRecipients(recipients); } catch (error: any) { return reply.code(400).send({ error: error.message }); }
    if (enabled && !addresses.length) return reply.code(400).send({ error: 'Informe ao menos um destinatário' });
    const db = fastify.supabaseAdmin;
    const company = await db.from('companies').select('id').eq('id', request.params.id).maybeSingle();
    if (company.error) return reply.code(500).send({ error: company.error.message });
    if (!company.data) return reply.code(404).send({ error: 'Empresa não encontrada' });
    const old = await db.from('monthly_glpi_report_settings').select('enabled,enabled_at').eq('company_id', request.params.id).maybeSingle();
    if (old.error) return reply.code(500).send({ error: old.error.message });
    const enabledAt = enabled ? (old.data?.enabled ? old.data.enabled_at : new Date().toISOString()) : null;
    const { data, error } = await db.from('monthly_glpi_report_settings').upsert({ company_id: request.params.id, enabled, recipients: addresses, enabled_at: enabledAt, updated_at: new Date().toISOString() }, { onConflict: 'company_id' }).select('enabled,recipients,enabled_at').single();
    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(db, request, { action: 'monthly_glpi_settings.save', entityType: 'company', companyId: request.params.id, entityId: request.params.id, summary: 'Configuração de relatório mensal alterada', metadata: { enabled, recipient_count: addresses.length } });
    return data;
  });
}
