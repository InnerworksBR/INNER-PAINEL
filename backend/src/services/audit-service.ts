import type { FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AuditInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function writeAdminAuditLog(
  supabase: SupabaseClient,
  request: FastifyRequest,
  input: AuditInput
): Promise<void> {
  const actor = (request.user as any)?.user;

  const { error } = await supabase
    .from('admin_audit_logs')
    .insert({
      admin_user_id: actor?.id || null,
      admin_email: actor?.email || null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      company_id: input.companyId || null,
      summary: input.summary,
      metadata: input.metadata || {},
      ip_address: request.ip,
      user_agent: String(request.headers['user-agent'] || ''),
    });

  if (error) {
    request.log.warn({ err: error }, 'Falha ao registrar auditoria administrativa');
  }
}
