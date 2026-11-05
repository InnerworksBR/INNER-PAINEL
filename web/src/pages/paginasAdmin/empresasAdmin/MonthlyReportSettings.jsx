import React, { useEffect, useState } from 'react';
import api from '../../../services/api';

export default function MonthlyReportSettings({ companyId }) {
  const [enabled, setEnabled] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoaded(false); setError('');
    api.get(`/admin/companies/${companyId}/monthly-glpi-settings`).then(({ data }) => {
      if (active) { setEnabled(data.enabled); setRecipients((data.recipients || []).join(', ')); setLoaded(true); }
    }).catch(() => { if (active) setError('Não foi possível carregar a configuração.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [companyId, retry]);
  useEffect(() => {
    let active = true;
    api.get(`/admin/companies/${companyId}/monthly-glpi-status`).then(({ data }) => { if (active && Array.isArray(data)) { setHistory(data); setHistoryError(false); } }).catch(() => { if (active) { setHistory([]); setHistoryError(true); } });
    return () => { active = false; };
  }, [companyId]);
  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const { data } = await api.put(`/admin/companies/${companyId}/monthly-glpi-settings`, { enabled, recipients });
      setRecipients(data.recipients.join(', ')); setMessage('Configuração do relatório salva.');
    } catch (err) { setError(err.response?.data?.error || 'Não foi possível salvar a configuração.'); }
    finally { setSaving(false); }
  };
  return <section className="p-4 border border-slate-200 rounded-2xl bg-white">
    <h3 className="font-semibold text-slate-800">Relatório mensal de chamados</h3>
    <p className="mt-1 text-sm text-slate-600">O relatório do mês anterior é gerado no dia 1 e enviado aos destinatários abaixo.</p>
    {loading ? <p role="status" className="mt-3 text-sm text-slate-600">Carregando configuração...</p> : loaded && <div className="mt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /> Ativar relatório mensal</label>
      <label className="block text-sm font-medium text-slate-700">Destinatários do relatório
        <input value={recipients} onChange={event => setRecipients(event.target.value)} placeholder="cliente@empresa.com, gestor@empresa.com" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-2 focus:outline-blue-600" />
      </label>
      <p className="text-xs text-slate-600">Separe os e-mails por vírgula ou ponto e vírgula. São independentes dos demais alertas.</p>
      <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar configuração do relatório'}</button>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Recarregar</button></p>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    {historyError && <p className="mt-3 text-sm text-red-700">Não foi possível carregar o status dos relatórios.</p>}
    {history.length > 0 && <details className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700"><summary className="cursor-pointer font-medium">Status dos últimos relatórios</summary><div className="mt-2 space-y-3">{history.map(report => <div key={report.id}><p className="font-medium">{report.period_start.slice(0, 7)} · {report.state === 'ready' ? 'Gerado' : report.state === 'processing' ? 'Em processamento' : 'Pendente'}</p>{report.last_error && <p className="break-words text-red-700">{report.last_error}</p>}<ul>{(report.monthly_glpi_report_deliveries || []).map(item => <li key={item.recipient} className="break-words text-slate-600">{item.recipient}: {{ pending: 'pendente', sending: 'enviando', sent: 'enviado', uncertain: 'envio incerto — verificar com o destinatário', failed: 'falhou', cancelled: 'cancelado' }[item.state] || item.state}</li>)}</ul></div>)}</div></details>}
  </section>;
}
