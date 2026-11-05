import React, { useEffect, useState } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import api from '../../../services/api';

const formatMonth = value => new Date(`${value.slice(0, 7)}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export default function MonthlyReports({ requestConfig }) {
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(null);
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
      setPreview(data);
      setSelected('preview');
      setState('ready');
    } catch (error) {
      setGenerationError(error.response?.data?.error || 'Não foi possível gerar o relatório agora. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };
  const report = selected === 'preview' ? preview : reports.find(item => item.id === selected);
  const metrics = report?.metrics;
  return (
    <section aria-labelledby="monthly-reports-title" className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6 border-b border-neutral-100">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><FileText size={19} /></span>
          <div><h2 id="monthly-reports-title" className="text-base font-semibold text-neutral-900">Relatórios mensais</h2><p className="mt-1 text-sm text-neutral-600">Indicadores e análise dos seus chamados ao longo do tempo.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(reports.length > 0 || preview) && state === 'ready' && <label className="text-sm font-medium text-neutral-700">Mês do relatório <select aria-label="Mês do relatório" value={selected} onChange={event => setSelected(event.target.value)} className="ml-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-emerald-600">{preview && <option value="preview">{formatMonth(preview.period_start)} — prévia</option>}{reports.map(item => <option key={item.id} value={item.id}>{formatMonth(item.period_start)}</option>)}</select></label>}
          <button type="button" onClick={generatePreview} disabled={generating || state === 'loading'} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={15} className={generating ? 'animate-spin motion-reduce:animate-none' : ''} />{generating ? 'Gerando relatório...' : 'Gerar relatório agora'}</button>
        </div>
      </div>
      {generating && <p role="status" className="px-6 pt-4 text-sm text-neutral-600">Consultando os chamados e preparando a análise. Isso pode levar alguns minutos.</p>}
      {generationError && <p role="alert" className="px-6 pt-4 text-sm text-red-700">{generationError}</p>}
      {state === 'loading' && <p role="status" className="p-6 text-sm text-neutral-600">Carregando relatórios...</p>}
      {state === 'error' && <div role="alert" className="p-6 text-sm text-red-700"><p>Não foi possível carregar os relatórios.</p><button type="button" onClick={() => { setState('loading'); setAttempt(value => value + 1); }} className="mt-3 inline-flex items-center gap-2 font-semibold underline underline-offset-4"><RefreshCw size={15} /> Tentar novamente</button></div>}
      {state === 'ready' && !report && <p className="p-6 text-sm text-neutral-600">Ainda não há relatórios mensais disponíveis para esta empresa.</p>}
      {state === 'ready' && report && metrics && <div className="p-5 sm:p-6 space-y-6">
        {report.is_preview && <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-semibold">Prévia do mês em andamento</p><p className="mt-1">Esta prévia não é salva nem enviada por e-mail. O relatório mensal definitivo será gerado normalmente.</p></div>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-neutral-100 pb-5">
          {[['Abertos no mês', metrics.opened], ['Solucionados no mês', metrics.solved], ['Pendentes na coleta', metrics.unresolved]].map(([label, value]) => <div key={label}><p className="text-sm text-neutral-600">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p></div>)}
        </div>
        <div><h3 className="font-semibold text-neutral-900">Análise do período</h3><p className="mt-2 max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700">{report.analysis}</p></div>
        <div className="grid gap-5 sm:grid-cols-2">{[['Categorias', metrics.categories], ['Prioridades', metrics.priorities]].map(([label, values]) => <div key={label}><h3 className="text-sm font-semibold text-neutral-900">{label} dos chamados abertos</h3><ul className="mt-2 space-y-1 text-sm text-neutral-600">{Object.entries(values || {}).length ? Object.entries(values).sort((a, b) => b[1] - a[1]).map(([name, count]) => <li key={name} className="flex justify-between gap-4"><span className="break-words">{name}</span><span className="tabular-nums">{count}</span></li>) : <li>Sem dados no período.</li>}</ul></div>)}</div>
        <p className="text-xs text-neutral-600">{report.generated_at && `Gerado em ${new Date(report.generated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. `}Pendências observadas em {new Date(metrics.observedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Os indicadores mensais consideram datas de abertura e solução.{metrics.solvedDateMissing > 0 && ` ${metrics.solvedDateMissing} chamados solucionados não têm data de solução e não podem ser atribuídos a um mês.`}{metrics.openingDateFallback > 0 && ` Para ${metrics.openingDateFallback} chamados sem data de abertura foi usada a data de criação do registro.`}</p>
      </div>}
    </section>
  );
}
