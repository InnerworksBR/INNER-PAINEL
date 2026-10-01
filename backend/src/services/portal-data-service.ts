import type { SupabaseClient } from '@supabase/supabase-js';

// Use deterministic pages so totals do not depend on PostgREST's row limit.
export async function loadCompanyRows(db: SupabaseClient, table: string, companyId: string | null, filters: Record<string, string> = {}): Promise<any[]> {
  const rows: any[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = db.from(table).select('*').order('id');
    if (companyId) query = query.eq('company_id', companyId);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
