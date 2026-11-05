import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, FileText, RefreshCw } from 'lucide-react';
import api from '../../../services/api';

const formatMonth = value => new Date(`${value.slice(0, 7)}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const formatMoment = value => value ? new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : 'Não informado';
const formatCount = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value).toLocaleString('pt-BR') : '—';

function Breakdown({ title, entries, total }) {
  const items = Object.entries(entries || {}).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0).sort((a, b) => Number(b[1]) - Number(a[1]));
  return <section className="min-w-0">
    <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
    <p className="mt-1 text-xs leading-5 text-neutral-600">Entre os chamados abertos no período</p>
    {items.length ? <ul className="mt-4 space-y-3">{items.map(([name, count]) => {
      const percentage = Number(total) > 0 ? Math.min(100, Math.max(0, Number(count) / Number(total) * 100)) : 0;
      return <li key={name}><div className="flex items-baseline justify-between gap-4 text-sm"><span className="min-w-0 break-words text-neutral-700">{name}</span><span className="shrink-0 font-semibold tabular-nums text-neutral-900">{formatCount(count)}</span></div><div aria-hidden="true" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${percentage}%` }} /></div></li>;
    })}</ul> : <p className="mt-4 text-sm text-neutral-600">Sem dados disponíveis para este período.</p>}
  </section>;
}

export default function MonthlyReports({ requestConfig }) {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const companyId = requestConfig?.params?.company_id;
  useEffect(() => {
    let active = true;
    api.get('/client/glpi/reports', companyId ? { params: { company_id: companyId } } : {})
      .then(({ data }) => { if (active) { setReports(data); setSelected(data[0]?.id || ''); setState('ready'); } })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [companyId, attempt]);
  const generatePreview = async () => {
    setGenerating(true);
    setGenerationError('');
    try {
      const { data } = await api.post('/client/glpi/reports/preview', {}, companyId ? { params: { company_id: companyId } } : {});
      setReports(current => [data, ...current.filter(report => report.id !== data.id)]);
      setSelected(data.id);
      setState('ready');
    } catch (error) {
      setGenerationError(error.response?.data?.error || 'Não foi possível gerar o relatório agora. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };
  const report = reports.find(item => item.id === selected);
  const metrics = report?.metrics;
  const paragraphs = String(report?.analysis || '').split(/\n\s*\n/).map(text => text.replace(/^\s*#{1,6}\s+/gm, '').trim()).filter(Boolean);

  return <section aria-labelledby="monthly-reports-title" className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white">
    <div className="bg-[#14382e] px-5 py-6 text-white sm:px-7 sm:py-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-100"><FileText size={19} /></span>
          <div><h2 id="monthly-reports-title" className="text-lg font-semibold tracking-tight">Relatórios mensais</h2><p className="mt-1 max-w-lg text-sm leading-6 text-emerald-50/85">Uma visão clara do atendimento registrado para sua empresa.</p></div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {reports.length > 0 && state === 'ready' && <label className="text-xs font-medium text-emerald-50">Mês do relatório<select aria-label="Mês do relatório" value={selected} onChange={event => setSelected(event.target.value)} className="mt-1.5 block min-h-10 max-w-full rounded-lg border border-white/20 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-2 focus:outline-offset-2 focus:outline-white">{reports.map(item => <option key={item.id} value={item.id}>{formatMonth(item.period_start)}{item.is_preview ? ' — prévia' : ''}</option>)}</select></label>}
          <button type="button" onClick={generatePreview} disabled={generating || state === 'loading'} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-50 focus:outline-2 focus:outline-offset-2 focus:outline-white disabled:cursor-wait disabled:opacity-60"><RefreshCw size={15} className={generating ? 'animate-spin motion-reduce:animate-none' : ''} />{generating ? 'Gerando relatório...' : 'Gerar relatório agora'}</button>
        </div>
      </div>
    </div>
    {generating && <p role="status" className="px-6 pt-5 text-sm text-neutral-600">Consultando os chamados e preparando a análise. Isso pode levar alguns minutos.</p>}
    {generationError && <p role="alert" className="px-6 pt-5 text-sm text-red-700">{generationError}</p>}
    {state === 'loading' && <p role="status" className="p-7 text-sm text-neutral-600">Carregando relatórios...</p>}
    {state === 'error' && <div role="alert" className="p-7 text-sm text-red-700"><p>Não foi possível carregar os relatórios.</p><button type="button" onClick={() => { setState('loading'); setAttempt(value => value + 1); }} className="mt-3 inline-flex items-center gap-2 font-semibold underline underline-offset-4 focus:outline-2 focus:outline-offset-2 focus:outline-red-700"><RefreshCw size={15} /> Tentar novamente</button></div>}
    {state === 'ready' && !report && <div className="px-6 py-10 sm:px-8"><p className="font-medium text-neutral-900">Ainda não há relatórios mensais disponíveis para esta empresa.</p><p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">Gere uma prévia para conhecer o atendimento do mês atual. Ela ficará salva para consultas futuras.</p></div>}
    {state === 'ready' && report && metrics && <div className="px-5 pb-7 pt-6 sm:px-8 sm:pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-5">
        <div><h3 className="text-lg font-semibold tracking-tight text-neutral-950">Panorama do atendimento</h3><p className="mt-1 text-sm leading-6 text-neutral-600">Dados dos chamados no período, com os registros disponíveis no GLPI.</p></div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"><CalendarDays size={15} /><span>{formatMonth(report.period_start)}</span></div>
      </div>
      {report.is_preview && <div className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950"><p className="font-semibold">Prévia parcial do mês</p><p className="mt-0.5">Esta prévia fica salva no histórico e não é enviada por e-mail. Ela representa os dados disponíveis no momento da coleta; o relatório mensal definitivo é gerado separadamente.</p></div>}
      <div className="grid gap-7 py-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,1fr)] lg:gap-12">
        <div className="min-w-0"><h4 className="text-sm font-semibold text-neutral-900">O que os chamados mostram</h4><div className="mt-3 max-w-3xl space-y-3 text-sm leading-7 text-neutral-700">{paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 20)}`} className="whitespace-pre-wrap break-words">{paragraph}</p>)}</div></div>
        <dl className="border-t border-neutral-200 lg:border-l lg:border-t-0 lg:pl-7">{[['Abertos no mês', metrics.opened], ['Solucionados no mês', metrics.solved], ['Pendentes na coleta', metrics.unresolved]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-neutral-100 py-3"><dt className="text-sm text-neutral-600">{label}</dt><dd className="text-xl font-semibold tabular-nums text-neutral-950">{formatCount(value)}</dd></div>)}</dl>
      </div>
      <div className="grid gap-7 border-t border-neutral-200 pt-6 sm:grid-cols-2 sm:gap-10"><Breakdown title="Assuntos mais frequentes" entries={metrics.categories} total={metrics.opened} /><Breakdown title="Prioridade dos chamados" entries={metrics.priorities} total={metrics.opened} /></div>
      <div className="mt-7 flex items-start gap-2 border-t border-neutral-100 pt-4 text-xs leading-5 text-neutral-600"><ArrowUpRight size={14} className="mt-0.5 shrink-0 text-emerald-700" /><p>{report.generated_at && `Gerado em ${formatMoment(report.generated_at)}. `}Pendências observadas em {formatMoment(metrics.observedAt)}. Os indicadores mensais consideram as datas de abertura e solução.{metrics.solvedDateMissing > 0 && ` ${metrics.solvedDateMissing} chamados solucionados não têm data de solução e não podem ser atribuídos a um mês.`}{metrics.openingDateFallback > 0 && ` Para ${metrics.openingDateFallback} chamados sem data de abertura foi usada a data de criação do registro.`}</p></div>
    </div>}
  </section>;
}
