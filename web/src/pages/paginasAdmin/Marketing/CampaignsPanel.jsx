import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import api from '../../../services/api';
import { useMarketingAccess } from '../../../context/MarketingAccessContext';
import { ArticleAlert, ArticleConfirmation, articleCard, fieldClass, primaryButton, secondaryButton } from '../Artigos/ArticleUi';
import { EbookSelect, formCard, MarketingActionStatus, MarketingField, MarketingQueryStatus } from './MarketingUi';
import { campaignStatuses, formatMarketingDate, MARKETING_PATH, toSaoPauloTimestamp, useMarketingAction, useMarketingQuery } from './marketingData';

const endpoint = MARKETING_PATH + '/campaigns';
const newCampaign = { name: '', subject: '', body: '', ebookId: null };
const metrics = [
  ['audienceSize', 'Audiência na ativação'],
  ['queued', 'Na fila'],
  ['accepted', 'Aceitos pelo servidor de e-mail'],
  ['delivered', 'Entregues'],
  ['failed', 'Falhas'],
  ['skipped', 'Ignorados'],
  ['uncertain', 'Resultado incerto'],
];

export default function CampaignsPanel() {
  const ebooks = useOutletContext();
  const campaigns = useMarketingQuery('/campaigns', 'Não foi possível carregar as campanhas.');
  const { campaignReady } = useMarketingAccess();
  const [selection, setSelection] = useState(null);
  const action = useMarketingAction();
  const items = campaigns.data?.campaigns ?? [];
  const selected = items.find(item => item.id === selection);
  const blocked = action.pending || action.conflict;

  function select(id) {
    action.clear();
    setSelection(id);
  }

  function save(campaign) {
    campaigns.replace('campaigns', campaign);
    setSelection(campaign.id);
  }

  function reload() {
    action.clear();
    campaigns.reload();
  }

  return (
    <section className="space-y-4" aria-labelledby="marketing-campaigns">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="marketing-campaigns" className="text-xl font-bold text-slate-900">Campanhas</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} disabled={!campaigns.data || blocked || selection === 'new' || selected?.state === 'draft'} onClick={reload}>
            <RefreshCw size={16} aria-hidden="true" /> Atualizar campanhas
          </button>
          <button type="button" className={primaryButton} disabled={!campaigns.data || blocked || selection === 'new'} onClick={() => select('new')}>
            <Plus size={17} aria-hidden="true" /> Nova campanha
          </button>
        </div>
      </div>
      {!campaignReady && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Os serviços de envio da campanha estão indisponíveis. Você pode preparar rascunhos e consultar as campanhas.
        </p>
      )}
      <div className={selection ? 'grid items-start gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]' : ''}>
        <div className={articleCard} aria-label="Lista de campanhas" aria-busy={campaigns.loading}>
          <MarketingQueryStatus query={campaigns} loadingText="Carregando campanhas…" />
          {campaigns.data && !items.length && <p className="p-4 text-sm text-slate-600">Nenhuma campanha cadastrada.</p>}
          {items.length > 0 && (
            <ul className="divide-y divide-slate-200">
              {items.map(campaign => (
                <li key={campaign.id}>
                  <button
                    type="button"
                    className="w-full space-y-1 px-4 py-3 text-left hover:bg-slate-50 aria-pressed:bg-blue-50"
                    aria-pressed={selection === campaign.id}
                    disabled={blocked}
                    onClick={() => select(campaign.id)}
                  >
                    <span className="block break-words text-sm font-bold text-slate-900">{campaign.name}</span>
                    <CampaignStatus state={campaign.state} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {campaigns.data && (selection === 'new' || selected) && (
          <CampaignEditor
            key={selection}
            campaign={selected}
            ebooks={ebooks}
            action={action}
            ready={campaignReady}
            onSave={save}
            onReload={reload}
          />
        )}
      </div>
    </section>
  );
}

function CampaignStatus({ state }) {
  const color = state === 'completed' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-800';
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{campaignStatuses[state]}</span>;
}

function CampaignEditor({ campaign, ebooks, action, ready, onSave, onReload }) {
  const [fields, setFields] = useState({});
  const [preview, setPreview] = useState(false);
  const saved = campaign ?? newCampaign;
  const name = fields.name ?? saved.name;
  const subject = fields.subject ?? saved.subject;
  const body = fields.body ?? saved.body;
  const ebookId = fields.ebookId ?? saved.ebookId ?? '';
  const dirty = name !== saved.name || subject !== saved.subject || body !== saved.body || ebookId !== (saved.ebookId ?? '');
  const editable = !campaign || campaign.state === 'draft';
  const busy = action.pending || action.conflict;

  function save(event) {
    event.preventDefault();
    action.run(async () => {
      const content = { name: name.trim(), subject: subject.trim(), body: body.trim(), ebookId: ebookId || null };
      const { data } = campaign
        ? await api.patch(endpoint + '/' + campaign.id, { ...content, version: campaign.version })
        : await api.post(endpoint, content);

      setFields({});
      onSave(data.campaign);
      return 'Campanha salva.';
    }, 'Não foi possível salvar a campanha.');
  }

  return (
    <div className="min-w-0 space-y-4">
      <form className={formCard} onSubmit={save}>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">{campaign ? (editable ? 'Editar campanha' : 'Mensagem da campanha') : 'Nova campanha'}</h3>
          {campaign && <CampaignStatus state={campaign.state} />}
        </div>
        <MarketingField label="Nome da campanha">
          <input required className={fieldClass} value={name} maxLength={160} disabled={busy || !editable} onChange={event => setFields({ ...fields, name: event.target.value })} />
        </MarketingField>
        <MarketingField label="Assunto">
          <input required className={fieldClass} value={subject} maxLength={180} disabled={busy || !editable} onChange={event => setFields({ ...fields, subject: event.target.value })} />
        </MarketingField>
        <MarketingField label="Corpo do e-mail">
          <textarea required className={fieldClass} value={body} maxLength={10000} rows={7} disabled={busy || !editable} onChange={event => setFields({ ...fields, body: event.target.value })} />
        </MarketingField>
        <MarketingField label="Segmento por e-book">
          <EbookSelect
            all="Todos os contatos inscritos"
            ebooks={ebooks.data?.ebooks ?? []}
            value={ebookId}
            disabled={busy || !editable || ebooks.loading || !!ebooks.error}
            onChange={event => setFields({ ...fields, ebookId: event.target.value })}
          />
        </MarketingField>
        {ebooks.error && editable && <MarketingQueryStatus query={ebooks} />}
        <p className="text-xs text-slate-600">A audiência inclui somente contatos inscritos que se encaixam no segmento.</p>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <button type="submit" className={primaryButton} disabled={busy || !dirty || !name.trim() || !subject.trim() || !body.trim()}>
              {campaign ? 'Salvar alterações' : 'Criar rascunho'}
            </button>
          )}
          <button type="button" className={secondaryButton} aria-expanded={preview} onClick={() => setPreview(value => !value)}>
            {preview ? 'Fechar prévia' : 'Prévia da mensagem'}
          </button>
        </div>
      </form>
      {preview && (
        <section className={formCard} aria-label="Prévia da mensagem">
          <h3 className="break-words text-base font-bold text-slate-900">{subject.trim() || 'Sem assunto'}</h3>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{body.trim() || 'A mensagem está vazia.'}</p>
        </section>
      )}
      {campaign ? (
        <CampaignSend campaign={campaign} action={action} ready={ready} dirty={dirty} onSave={onSave} onReload={onReload} />
      ) : (
        <MarketingActionStatus action={action} onReload={onReload} />
      )}
    </div>
  );
}

function CampaignSend({ campaign, action, ready, dirty, onSave, onReload }) {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('now');
  const [schedule, setSchedule] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [audience, setAudience] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const { id, state, version } = campaign;
  const path = endpoint + '/' + id;
  const draft = state === 'draft';
  const blocked = action.pending || action.conflict;
  const showConfirmation = confirmation && !action.conflict;
  const currentAudience = audience?.version === version ? audience.eligible : null;

  function sendTest(event) {
    event.preventDefault();
    action.run(async () => {
      await api.post(path + '/test', { email: email.trim(), version });
      return 'Envio de teste adicionado à fila.';
    }, 'Não foi possível adicionar o teste à fila de envio.');
  }

  function readAudience(review = false) {
    setScheduleError('');
    const scheduledAt = mode === 'scheduled' ? toSaoPauloTimestamp(schedule) : null;
    if (review && mode === 'scheduled' && (!scheduledAt || Date.parse(scheduledAt) <= Date.now())) {
      setScheduleError('Informe uma data e hora futuras no horário de São Paulo.');
      return;
    }

    action.run(async () => {
      const { data } = await api.get(path + '/audience');
      const { eligible } = data;
      setAudience({ eligible, version });
      if (review && eligible > 0) setConfirmation({ kind: 'activate', scheduledAt, eligible, version });
      return '';
    }, 'Não foi possível calcular a audiência.');
  }

  function confirmAction() {
    action.run(async () => {
      const { kind, scheduledAt, eligible } = confirmation;
      const payload = kind === 'activate'
        ? { version: confirmation.version, scheduledAt, expectedAudience: eligible }
        : { version: confirmation.version };
      const { data } = await api.post(path + '/' + kind, payload);
      onSave(data.campaign);
      setConfirmation(null);
      if (kind === 'pause') return 'Campanha pausada.';
      if (kind === 'resume') return 'Campanha retomada.';
      return scheduledAt ? 'Campanha agendada.' : 'Campanha iniciada.';
    }, 'Não foi possível atualizar o envio da campanha.');
  }

  let confirmationTitle;
  if (confirmation?.kind === 'activate') confirmationTitle = confirmation.scheduledAt ? 'Agendar campanha' : 'Disparar campanha';
  if (confirmation?.kind === 'pause') confirmationTitle = 'Pausar campanha';
  if (confirmation?.kind === 'resume') confirmationTitle = 'Retomar campanha';

  return (
    <>
      {draft ? (
        <>
          <form className={formCard} onSubmit={sendTest}>
            <h3 className="text-lg font-bold text-slate-900">Envio de teste</h3>
            <MarketingField label="E-mail para teste">
              <input required type="email" className={fieldClass} value={email} maxLength={254} disabled={blocked} onChange={event => setEmail(event.target.value)} />
            </MarketingField>
            <button type="submit" className={secondaryButton} disabled={blocked || dirty || !ready || !email.trim()}>Enviar teste</button>
          </form>
          <section className={formCard} aria-labelledby="marketing-campaign-send">
            <h3 id="marketing-campaign-send" className="text-lg font-bold text-slate-900">Audiência e disparo</h3>
            {dirty && <p className="text-sm text-slate-700">Salve as alterações para calcular a audiência, testar e disparar.</p>}
            {!dirty && currentAudience !== null && (
              <p role="status" className="text-sm text-slate-700">
                {currentAudience === 0 ? 'Nenhum contato elegível no segmento.' : `Contatos elegíveis: ${currentAudience.toLocaleString('pt-BR')}`}
              </p>
            )}
            <button type="button" className={secondaryButton} disabled={blocked || dirty} onClick={() => readAudience()}>
              Calcular audiência
            </button>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-slate-800">Quando enviar</legend>
              <div className="flex flex-wrap gap-4 text-sm text-slate-800">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="dispatch-time" checked={mode === 'now'} disabled={blocked || !ready} onChange={() => { setMode('now'); setScheduleError(''); }} /> Enviar agora
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="dispatch-time" checked={mode === 'scheduled'} disabled={blocked || !ready} onChange={() => setMode('scheduled')} /> Agendar
                </label>
              </div>
              {mode === 'scheduled' && (
                <MarketingField label="Data e hora em São Paulo">
                  <input type="datetime-local" className={fieldClass} value={schedule} disabled={blocked || !ready} onChange={event => { setSchedule(event.target.value); setScheduleError(''); }} />
                </MarketingField>
              )}
              {scheduleError && <ArticleAlert>{scheduleError}</ArticleAlert>}
            </fieldset>
            <button type="button" className={primaryButton} disabled={blocked || dirty || !ready} onClick={() => readAudience(true)}>
              Revisar disparo
            </button>
          </section>
        </>
      ) : (
        <section className={formCard} aria-labelledby="marketing-campaign-metrics">
          <h3 id="marketing-campaign-metrics" className="text-lg font-bold text-slate-900">Envio e métricas</h3>
          {campaign.scheduledAt && (
            <p className="text-sm text-slate-700">Agendamento para {formatMarketingDate(campaign.scheduledAt)} (horário de São Paulo)</p>
          )}
          <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(([key, label]) => (
              <div key={key} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs font-medium text-slate-700">{label}</dt>
                <dd className="mt-1 text-lg font-bold text-slate-900">{campaign[key]?.toLocaleString('pt-BR') ?? '—'}</dd>
              </div>
            ))}
          </dl>
          {(state === 'scheduled' || state === 'sending') && (
            <button type="button" className={secondaryButton} disabled={blocked} onClick={() => { action.clear(); setConfirmation({ kind: 'pause', version }); }}>Pausar campanha</button>
          )}
          {state === 'paused' && (
            <button type="button" className={primaryButton} disabled={blocked || !ready} onClick={() => { action.clear(); setConfirmation({ kind: 'resume', version }); }}>Retomar campanha</button>
          )}
        </section>
      )}
      {!showConfirmation && <MarketingActionStatus action={action} onReload={onReload} />}
      {showConfirmation && (
        <ArticleConfirmation
          title={confirmationTitle}
          label={confirmationTitle}
          busy={action.pending}
          error={action.error}
          onCancel={() => { action.clear(); setConfirmation(null); }}
          onConfirm={confirmAction}
        >
          {confirmation.kind === 'activate' && (
            <p>
              A campanha <strong>{campaign.name}</strong> será enviada para <strong>{confirmation.eligible.toLocaleString('pt-BR')}</strong> contatos elegíveis{' '}
              {confirmation.scheduledAt
                ? <>em <strong>{formatMarketingDate(confirmation.scheduledAt)}</strong> (horário de São Paulo).</>
                : 'assim que o processamento da fila começar.'}
            </p>
          )}
          {confirmation.kind === 'pause' && <p>O processamento dos próximos envios será pausado.</p>}
          {confirmation.kind === 'resume' && <p>O processamento dos envios pendentes será retomado.</p>}
        </ArticleConfirmation>
      )}
    </>
  );
}
