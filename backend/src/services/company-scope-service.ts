import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '../types';

export interface CompanyScopeResult {
  targetCompanyId: string | null;
  explicitCompanyId: string | null;
}

export async function resolveCompanyScope(
  supabaseAdmin: SupabaseClient,
  user: UserProfile,
  requestedCompanyId?: unknown
): Promise<CompanyScopeResult> {
  const explicitCompanyId =
    typeof requestedCompanyId === 'string' && requestedCompanyId.trim()
      ? requestedCompanyId.trim()
      : null;

  if (user.role !== 'admin') {
    if (!user.company_id) {
      throw new CompanyScopeError(403, 'Usuário sem empresa associada');
    }
    return { targetCompanyId: user.company_id, explicitCompanyId: null };
  }

  if (!explicitCompanyId) {
    return { targetCompanyId: null, explicitCompanyId: null };
  }

  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('id', explicitCompanyId)
    .maybeSingle();

  if (error) throw new CompanyScopeError(500, error.message);
  if (!data) throw new CompanyScopeError(404, 'Empresa não encontrada');

  return { targetCompanyId: explicitCompanyId, explicitCompanyId };
}

export class CompanyScopeError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'CompanyScopeError';
  }
}

export function sendCompanyScopeError(reply: any, error: unknown) {
  if (error instanceof CompanyScopeError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  throw error;
}
