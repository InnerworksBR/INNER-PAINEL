import nodemailer from 'nodemailer';
import { clientReportText } from './client-report-text';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const formatMonth = (value: string) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return match ? `${months[Number(match[2]) - 1]} de ${match[1]}` : value;
};

export function buildMonthlyEmail(input: { company: string; month: string; analysis: string; metrics: { opened: number; solved: number; unresolved: number; solvedDateMissing?: number; openingDateFallback?: number }; portalUrl: string }) {
  const link = `${input.portalUrl.replace(/\/+$/, '')}/app/chamados`;
  const analysis = clientReportText(input.analysis) || 'Nenhuma análise de atendimento está disponível neste relatório.';
  const period = formatMonth(input.month);
  const subject = `Relatório de chamados — ${period} — ${input.company}`;
  const summary = `Abertos no mês: ${input.metrics.opened}. Solucionados no mês: ${input.metrics.solved}. Pendentes na coleta: ${input.metrics.unresolved}.${input.metrics.solvedDateMissing ? ` ${input.metrics.solvedDateMissing} chamados solucionados estão sem data de solução e não podem ser atribuídos a um mês.` : ''}${input.metrics.openingDateFallback ? ` Para ${input.metrics.openingDateFallback} chamados sem data de abertura foi usada a data de criação do registro.` : ''}`;
  const paragraphs = analysis.split(/\n\s*\n/).map(paragraph => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#33443f;">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
  const rows = [['Abertos no mês', input.metrics.opened], ['Solucionados no mês', input.metrics.solved], ['Pendentes na coleta', input.metrics.unresolved]]
    .map(([label, value]) => `<tr><td style="padding:12px 0;border-bottom:1px solid #e3ebe6;font-size:14px;color:#40534d;">${label}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #e3ebe6;font-size:18px;font-weight:700;color:#17372f;">${value}</td></tr>`).join('');
  const details = `${input.metrics.solvedDateMissing ? `${input.metrics.solvedDateMissing} chamados solucionados não têm data de solução e não podem ser atribuídos a um mês. ` : ''}${input.metrics.openingDateFallback ? `Para ${input.metrics.openingDateFallback} chamados sem data de abertura foi usada a data de criação do registro.` : ''}`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:#f2f6f3;font-family:Arial,sans-serif;color:#18342d;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dce8e0;border-radius:12px;"><tr><td style="padding:30px 32px;background:#163b31;border-radius:12px 12px 0 0;color:#ffffff;"><p style="margin:0 0 12px;font-size:13px;color:#b8dccc;">INNER · RELATÓRIO DE ATENDIMENTO</p><h1 style="margin:0;font-size:24px;line-height:1.25;">${escapeHtml(input.company)}</h1><p style="margin:8px 0 0;font-size:15px;color:#d7e9df;text-transform:capitalize;">${escapeHtml(period)}</p></td></tr><tr><td style="padding:30px 32px;"><h2 style="margin:0 0 12px;font-size:18px;color:#17372f;">Panorama do atendimento</h2>${paragraphs}<p style="margin:26px 0 6px;font-size:13px;font-weight:700;color:#597068;">DADOS DOS CHAMADOS NO PERÍODO</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table><p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#596e66;">As pendências refletem a situação no momento da coleta. ${escapeHtml(details)}</p><p style="margin:28px 0 0;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;background:#166a4d;border-radius:8px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Ver relatório no portal</a></p></td></tr></table><p style="margin:16px 0 0;font-size:12px;color:#677b72;">Informações baseadas nos chamados registrados no GLPI.</p></td></tr></table></body></html>`;
  return { subject, text: `Relatório de chamados — ${period}\n\n${summary}\n\nPanorama do atendimento\n${analysis}\n\nAcesse o relatório: ${link}`, html };
}

export function configuredMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, PORTAL_URL } = process.env;
  const port = Number(SMTP_PORT);
  if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || !PORTAL_URL) throw new Error('Configuração SMTP ou PORTAL_URL ausente');
  const url = new URL(PORTAL_URL);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('PORTAL_URL inválida');
  return { from: SMTP_FROM, portalUrl: PORTAL_URL, transport: nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, requireTLS: port !== 465, auth: { user: SMTP_USER, pass: SMTP_PASSWORD }, connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 60000 }) };
}
