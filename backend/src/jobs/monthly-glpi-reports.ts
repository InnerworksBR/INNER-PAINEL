import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { collectCompanyTickets } from '../services/monthly-glpi-collection';
import { calculateMonthlyMetrics, periodForMonth, parseReportRecipients } from '../services/monthly-glpi-metrics';
import { generateMonthlyAnalysis } from '../services/monthly-glpi-ai';
import { buildMonthlyEmail, configuredMailer } from '../services/monthly-glpi-email';
import { monthsDue } from '../services/monthly-glpi-scheduling';
import { loadCompanyRows } from '../services/portal-data-service';

const REPORTS = 'monthly_glpi_reports';
const DELIVERIES = 'monthly_glpi_report_deliveries';

function check<T>(response: { data: T; error: any }): T {
  if (response.error) throw new Error(response.error.message || 'Falha no banco de dados');
  return response.data;
}

async function saveLeased(db: SupabaseClient, id: string, token: string, values: Record<string, unknown>) {
  const data = check(await db.from(REPORTS).update(values).eq('id', id).eq('lease_token', token).gt('lease_until', new Date().toISOString()).select('id'));
  if (!data?.length) throw new Error('Concessão do relatório expirou');
}

export async function processMonthlyReport(db: SupabaseClient, report: any, settings: any, company: any, dependencies: { mailer?: typeof configuredMailer } = {}) {
  const token = randomUUID();
  if (!check(await db.rpc('claim_monthly_glpi_report', { p_id: report.id, p_token: token }))) return;
  let hasGenerated = false;
  try {
    const current = check(await db.from(REPORTS).select('*').eq('id', report.id).eq('lease_token', token).maybeSingle());
    if (!current) throw new Error('Concessão do relatório não encontrada');
    report = current;
    hasGenerated = Boolean(report.metrics && report.analysis);
    // Um processo anterior pode ter enviado antes de cair. Nunca reenviar automaticamente.
    check(await db.from(DELIVERIES).update({ state: 'uncertain', last_error: 'Execução interrompida durante envio; verificar com o destinatário.' }).eq('report_id', report.id).eq('state', 'sending'));
    let metrics = report.metrics; let analysis = report.analysis; let recipients = report.recipient_snapshot;
    if (!metrics || !analysis || !Array.isArray(recipients)) {
      recipients = parseReportRecipients((settings.recipients || []).join(','));
      if (!recipients.length) throw new Error('Nenhum destinatário configurado');
      const tickets = await collectCompanyTickets(db, report.company_id);
      metrics = calculateMonthlyMetrics(tickets, periodForMonth(report.period_start.slice(0, 7)), new Date().toISOString());
      analysis = await generateMonthlyAnalysis(metrics, report.period_start.slice(0, 7));
      await saveLeased(db, report.id, token, { metrics, analysis, recipient_snapshot: recipients, generated_at: new Date().toISOString(), last_error: null });
      hasGenerated = true;
    }
    const deliveryRows = recipients.map((recipient: string) => ({ report_id: report.id, recipient }));
    check(await db.from(DELIVERIES).upsert(deliveryRows, { onConflict: 'report_id,recipient', ignoreDuplicates: true }));
    let deliveries = check(await db.from(DELIVERIES).select('*').eq('report_id', report.id).order('recipient')) || [];
    if (deliveries.some((item: any) => item.state === 'pending')) {
      const currentSettings = check(await db.from('monthly_glpi_report_settings').select('enabled,recipients').eq('company_id', report.company_id).maybeSingle());
      if (currentSettings?.enabled && Array.isArray(currentSettings.recipients)) {
        const currentRecipients = parseReportRecipients(currentSettings.recipients.join(','));
        if (currentRecipients.length) {
          check(await db.from(DELIVERIES).upsert(currentRecipients.map(recipient => ({ report_id: report.id, recipient })), { onConflict: 'report_id,recipient', ignoreDuplicates: true }));
          deliveries = check(await db.from(DELIVERIES).select('*').eq('report_id', report.id).order('recipient')) || [];
        }
      }
    }
    const pending = deliveries.filter((item: any) => item.state === 'pending');
    if (pending.length) {
      const mailer = (dependencies.mailer || configuredMailer)();
      const mail = buildMonthlyEmail({ company: company.name, month: report.period_start.slice(0, 7), analysis, metrics, portalUrl: mailer.portalUrl });
      for (const delivery of pending) {
        const activeSettings = check(await db.from('monthly_glpi_report_settings').select('enabled,recipients').eq('company_id', report.company_id).maybeSingle());
        if (!activeSettings?.enabled || !Array.isArray(activeSettings.recipients) || !activeSettings.recipients.includes(delivery.recipient)) {
          check(await db.from(DELIVERIES).update({ state: 'cancelled', last_error: 'Destinatário removido ou relatório desativado.' }).eq('id', delivery.id).eq('state', 'pending'));
          continue;
        }
        if (!check(await db.rpc('claim_monthly_glpi_delivery', { p_id: delivery.id, p_report_id: report.id, p_token: token }))) continue;
        try {
          const result = await mailer.transport.sendMail({ from: mailer.from, to: delivery.recipient, ...mail, messageId: `<glpi-${delivery.id}@inner-report.local>` });
          if (!result.accepted?.length) throw Object.assign(new Error('SMTP não aceitou o destinatário'), { responseCode: 550 });
          check(await db.from(DELIVERIES).update({ state: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', delivery.id).eq('state', 'sending'));
        } catch (err: any) {
          const code = Number(err.responseCode);
          // Uma resposta SMTP negativa é inequívoca; falhas de rede podem ocorrer após aceitação.
          const rejected = code >= 400 && code <= 599;
          const exhausted = delivery.attempts + 1 >= 6;
          const state = rejected ? (exhausted ? 'failed' : 'pending') : 'uncertain';
          const delay = Math.min(24 * 60, 2 ** Math.min(delivery.attempts, 10) * 15);
          check(await db.from(DELIVERIES).update({ state, last_error: rejected ? `SMTP rejeitou a mensagem (${code})` : 'Resultado do envio incerto; verificar antes de reenviar.', next_attempt_at: new Date(Date.now() + delay * 60000).toISOString() }).eq('id', delivery.id).eq('state', 'sending'));
        }
      }
    }
    const remaining = (check(await db.from(DELIVERIES).select('state,next_attempt_at').eq('report_id', report.id).eq('state', 'pending')) || []);
    const nextAttempt = remaining.length ? Math.max(Date.now() + 15 * 60000, Math.min(...remaining.map((item: any) => Date.parse(item.next_attempt_at)))) : Date.parse('9999-01-01T00:00:00Z');
    await saveLeased(db, report.id, token, { state: 'ready', lease_token: null, lease_until: null, attempts: 0, last_error: null, next_attempt_at: new Date(nextAttempt).toISOString() });
  } catch (err: any) {
    const delay = Math.min(24 * 60, 2 ** Math.min(report.attempts || 0, 10) * 15);
    try { await saveLeased(db, report.id, token, { state: hasGenerated ? 'ready' : 'pending', lease_token: null, lease_until: null, last_error: String(err.message || 'Falha no processamento').slice(0, 500), next_attempt_at: new Date(Date.now() + delay * 60000).toISOString() }); }
    catch (releaseError) { console.error('[RELATORIO GLPI] Não foi possível liberar a concessão:', releaseError); }
  }
}

export async function runMonthlyGlpiReports(db: SupabaseClient, now = new Date()): Promise<void> {
  const settings: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = check(await db.from('monthly_glpi_report_settings').select('*').eq('enabled', true).order('company_id').range(offset, offset + 499)) || [];
    settings.push(...page);
    if (page.length < 500) break;
  }
  for (const config of settings) {
    try {
      if (!config.enabled_at || !config.recipients?.length) continue;
      const company = check(await db.from('companies').select('id,name').eq('id', config.company_id).single());
      for (const month of monthsDue(config.enabled_at, now)) {
        check(await db.from(REPORTS).upsert({ company_id: config.company_id, period_start: `${month}-01` }, { onConflict: 'company_id,period_start', ignoreDuplicates: true }));
      }
      const reports = await loadCompanyRows(db, REPORTS, config.company_id);
      for (const report of reports) {
        if (new Date(report.next_attempt_at).getTime() <= now.getTime()) await processMonthlyReport(db, report, config, company);
      }
    } catch (err: any) {
      console.error('[RELATORIO GLPI] Falha ao processar empresa:', config.company_id, err.message);
    }
  }
}
