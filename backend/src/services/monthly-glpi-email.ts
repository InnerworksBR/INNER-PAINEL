import nodemailer from 'nodemailer';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export function buildMonthlyEmail(input: { company: string; month: string; analysis: string; metrics: { opened: number; solved: number; unresolved: number; solvedDateMissing?: number; openingDateFallback?: number }; portalUrl: string }) {
  const link = `${input.portalUrl.replace(/\/+$/, '')}/app/chamados`;
  const subject = `Relatório de chamados — ${input.month} — ${input.company}`;
  const summary = `Abertos no mês: ${input.metrics.opened}. Solucionados no mês: ${input.metrics.solved}. Pendentes na coleta: ${input.metrics.unresolved}.${input.metrics.solvedDateMissing ? ` ${input.metrics.solvedDateMissing} chamados solucionados estão sem data de solução e não podem ser atribuídos a um mês.` : ''}${input.metrics.openingDateFallback ? ` Para ${input.metrics.openingDateFallback} chamados sem data de abertura foi usada a data de criação do registro.` : ''}`;
  return { subject, text: `${summary}\n\n${input.analysis}\n\nAcesse o relatório: ${link}`, html: `<h2>Relatório de chamados — ${escapeHtml(input.company)}</h2><p>${escapeHtml(input.month)}</p><p>${escapeHtml(summary)}</p><p>${escapeHtml(input.analysis).replace(/\n/g, '<br>')}</p><p><a href="${escapeHtml(link)}">Consultar relatório no portal</a></p>` };
}

export function configuredMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, PORTAL_URL } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || !PORTAL_URL) throw new Error('Configuração SMTP ou PORTAL_URL ausente');
  const url = new URL(PORTAL_URL);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('PORTAL_URL inválida');
  return { from: SMTP_FROM, portalUrl: PORTAL_URL, transport: nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD }, connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 60000 }) };
}
