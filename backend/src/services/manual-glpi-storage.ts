import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateManualGlpiPreview } from './manual-glpi-preview';

type Preview = Awaited<ReturnType<typeof generateManualGlpiPreview>> & { id: string };
interface PreviewStore {
  get(companyId: string, periodStart: string): Promise<Preview | null>;
  claim(companyId: string, periodStart: string, token: string): Promise<'claimed' | 'ready' | 'busy' | 'cooldown'>;
  save(companyId: string, periodStart: string, token: string, preview: Omit<Preview, 'id'>): Promise<Preview | null>;
  release(companyId: string, periodStart: string, token: string): Promise<void>;
}

export class PreviewBusyError extends Error {
  constructor(message = 'Uma prévia já está sendo gerada. Aguarde e tente novamente.') { super(message); }
}

export function createPreviewStore(db: SupabaseClient): PreviewStore {
  const table = 'glpi_report_previews';
  return {
    async get(companyId, periodStart) {
      const { data, error } = await db.from(table).select('id,period_start,metrics,analysis,generated_at').eq('company_id', companyId).eq('period_start', periodStart).eq('state', 'ready').maybeSingle();
      if (error) throw error;
      return data ? { ...data, is_preview: true } : null;
    },
    async claim(companyId, periodStart, token) {
      const { data, error } = await db.rpc('claim_glpi_report_preview', { p_company_id: companyId, p_period_start: periodStart, p_token: token });
      if (error) throw error;
      if (!['claimed', 'ready', 'busy', 'cooldown'].includes(data)) throw new Error('Resposta inválida ao reservar prévia');
      return data;
    },
    async save(companyId, periodStart, token, preview) {
      const { data, error } = await db.from(table).update({ state: 'ready', metrics: preview.metrics, analysis: preview.analysis, generated_at: preview.generated_at, lease_token: null, lease_until: null, attempts: 0 })
        .eq('company_id', companyId).eq('period_start', periodStart).eq('state', 'generating').eq('lease_token', token).gt('lease_until', new Date().toISOString())
        .select('id,period_start,metrics,analysis,generated_at').maybeSingle();
      if (error) throw error;
      return data ? { ...data, is_preview: true } : null;
    },
    async release(companyId, periodStart, token) {
      const { error } = await db.rpc('fail_glpi_report_preview', { p_company_id: companyId, p_period_start: periodStart, p_token: token });
      if (error) throw error;
    },
  };
}

export async function getOrCreateManualGlpiPreview(db: SupabaseClient, companyId: string, options: { store?: PreviewStore; now?: () => Date; generate?: typeof generateManualGlpiPreview } = {}): Promise<Preview> {
  const store = options.store || createPreviewStore(db);
  const now = (options.now || (() => new Date()))();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const periodStart = `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-01`;
  const existing = await store.get(companyId, periodStart);
  if (existing) return existing;
  const token = randomUUID();
  const claim = await store.claim(companyId, periodStart, token);
  if (claim === 'busy') throw new PreviewBusyError();
  if (claim === 'cooldown') throw new PreviewBusyError('A última tentativa falhou. Aguarde antes de tentar novamente.');
  if (claim === 'ready') {
    const saved = await store.get(companyId, periodStart);
    if (!saved) throw new Error('Prévia salva não encontrada');
    return saved;
  }
  try {
    const result = await (options.generate || generateManualGlpiPreview)(db, companyId);
    if (result.period_start !== periodStart) throw new Error('O mês mudou durante a geração; tente novamente');
    const saved = await store.save(companyId, periodStart, token, result);
    if (!saved) throw new PreviewBusyError();
    return saved;
  } catch (error) {
    try { await store.release(companyId, periodStart, token); } catch { /* lease expires automatically */ }
    throw error;
  }
}
