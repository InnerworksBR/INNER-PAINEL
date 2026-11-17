import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import api from '../../../services/api';
import { useMarketingAccess } from '../../../context/MarketingAccessContext';
import { ArticleConfirmation, ArticleStatus, articleCard, fieldClass, primaryButton, secondaryButton } from '../Artigos/ArticleUi';
import { formCard, MarketingActionStatus, MarketingField, MarketingQueryStatus } from './MarketingUi';
import { formatMarketingDate, MARKETING_PATH, useMarketingAction } from './marketingData';

const endpoint = MARKETING_PATH + '/ebooks';
const newEbook = { title: '', description: '' };
const assetTypes = {
  cover: { label: 'Capa', accept: 'image/png,image/jpeg,image/webp', help: 'PNG, JPEG ou WebP. Até 8 MB.', limit: 8 },
  pdf: { label: 'Arquivo PDF', accept: 'application/pdf', help: 'PDF. Até 20 MB.', limit: 20 },
};

export default function EbooksPanel() {
  const ebooks = useOutletContext();
  const { deliveryReady } = useMarketingAccess();
  const [selection, setSelection] = useState(null);
  const action = useMarketingAction();
  const items = ebooks.data?.ebooks ?? [];
  const selected = items.find(item => item.id === selection);
  const blocked = action.pending || action.conflict;

  function select(id) {
    action.clear();
    setSelection(id);
  }

  function save(ebook) {
    ebooks.replace('ebooks', ebook);
    setSelection(ebook.id);
  }

  function reload() {
    action.clear();
    ebooks.reload();
  }

  return (
    <section className="space-y-4" aria-labelledby="marketing-ebooks">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="marketing-ebooks" className="text-xl font-bold text-slate-900">E-books</h2>
        <button type="button" className={primaryButton} disabled={!ebooks.data || blocked || selection === 'new'} onClick={() => select('new')}>
          <Plus size={17} aria-hidden="true" /> Novo e-book
        </button>
      </div>
      {!deliveryReady && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          O envio automático de e-books por e-mail está indisponível. Você pode preparar rascunhos.
        </p>
      )}
      <div className={selection ? 'grid items-start gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]' : ''}>
        <div className={articleCard} aria-label="Lista de e-books" aria-busy={ebooks.loading}>
          <MarketingQueryStatus query={ebooks} loadingText="Carregando e-books…" />
          {ebooks.data && items.length === 0 && <p className="p-4 text-sm text-slate-600">Nenhum e-book cadastrado.</p>}
          {items.length > 0 && (
            <ul className="divide-y divide-slate-200">
              {items.map(ebook => (
                <li key={ebook.id}>
                  <button
                    type="button"
                    className="w-full space-y-1 px-4 py-3 text-left hover:bg-slate-50 aria-pressed:bg-blue-50"
                    aria-pressed={selection === ebook.id}
                    disabled={blocked}
                    onClick={() => select(ebook.id)}
                  >
                    <span className="block break-words text-sm font-bold text-slate-900">{ebook.title}</span>
                    <ArticleStatus status={ebook.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {ebooks.data && (selection === 'new' || selected) && (
          <EbookEditor key={selection} ebook={selected} action={action} deliveryReady={deliveryReady} onSave={save} onReload={reload} />
        )}
      </div>
    </section>
  );
}

function EbookEditor({ ebook, action, deliveryReady, onSave, onReload }) {
  const [fields, setFields] = useState({});
  const [confirmation, setConfirmation] = useState(null);
  const saved = ebook ?? newEbook;
  const title = fields.title ?? saved.title;
  const description = fields.description ?? saved.description;
  const dirty = title !== saved.title || description !== saved.description;
  const busy = action.pending || action.conflict;
  const publicUrl = ebook?.status === 'published' && /^https?:\/\//i.test(ebook.publicUrl ?? '') ? ebook.publicUrl : null;
  const showConfirmation = confirmation && !action.conflict;

  function save(event) {
    event.preventDefault();
    action.run(async () => {
      const content = { title: title.trim(), description: description.trim() };
      const { data } = ebook
        ? await api.patch(endpoint + '/' + ebook.id, { ...content, version: ebook.version })
        : await api.post(endpoint, content);

      setFields({});
      onSave(data.ebook);
      return 'E-book salvo.';
    }, 'Não foi possível salvar o e-book.');
  }

  function upload(kind, file, resetInput) {
    action.run(async () => {
      const payload = new FormData();
      payload.append('file', file);
      const { data } = await api.post(endpoint + '/' + ebook.id + '/' + kind, payload, { params: { version: ebook.version } });
      onSave(data.ebook);
      resetInput();
      return kind === 'pdf' ? 'PDF enviado.' : 'Capa enviada.';
    }, kind === 'pdf' ? 'Não foi possível enviar o PDF.' : 'Não foi possível enviar a capa.');
  }

  function confirmPublication() {
    action.run(async () => {
      const { data } = await api.post(endpoint + '/' + ebook.id + '/' + confirmation, { version: ebook.version });
      onSave(data.ebook);
      setConfirmation(null);
      return confirmation === 'publish' ? 'E-book publicado.' : 'E-book retirado do ar.';
    }, 'Não foi possível atualizar a publicação.');
  }

  return (
    <div className="min-w-0 space-y-4">
      <form className={formCard} onSubmit={save}>
        <h3 className="text-lg font-bold text-slate-900">{ebook ? 'Editar e-book' : 'Novo e-book'}</h3>
        <MarketingField label="Título">
          <input required className={fieldClass} maxLength={160} value={title} disabled={busy} onChange={event => setFields({ ...fields, title: event.target.value })} />
        </MarketingField>
        <MarketingField label="Descrição">
          <textarea required className={fieldClass} maxLength={1000} rows={4} value={description} disabled={busy} onChange={event => setFields({ ...fields, description: event.target.value })} />
        </MarketingField>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={primaryButton} disabled={busy || !dirty || !title.trim() || !description.trim()}>
            {ebook ? 'Salvar alterações' : 'Criar e-book'}
          </button>
          {ebook && <p className="text-xs text-slate-600">Editado em {formatMarketingDate(ebook.updatedAt)}</p>}
        </div>
      </form>
      {ebook && (
        <>
          <section className={formCard} aria-labelledby="marketing-ebook-files">
            <h3 id="marketing-ebook-files" className="text-lg font-bold text-slate-900">Arquivos</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadAsset kind="cover" uploaded={ebook.coverReady} disabled={busy} onUpload={upload}>
                {ebook.coverReady && <CoverPreview ebook={ebook} />}
              </UploadAsset>
              <UploadAsset kind="pdf" uploaded={ebook.pdfReady} disabled={busy} onUpload={upload}>
                {ebook.pdfReady && <p className="break-all text-sm text-slate-800">{ebook.pdfName || 'PDF enviado'}</p>}
              </UploadAsset>
            </div>
          </section>
          <section className={formCard} aria-labelledby="marketing-ebook-publication">
            <div className="flex flex-wrap items-center gap-3">
              <h3 id="marketing-ebook-publication" className="text-lg font-bold text-slate-900">Publicação</h3>
              <ArticleStatus status={ebook.status} />
            </div>
            {ebook.status === 'published' && ebook.hasDraftChanges && (
              <p className="text-sm text-amber-900">Há alterações salvas que ainda precisam ser publicadas.</p>
            )}
            {dirty && <p className="text-sm text-slate-600">Salve as alterações antes de publicar.</p>}
            {(!ebook.coverReady || !ebook.pdfReady) && (
              <p className="text-sm text-slate-600">Envie uma capa e um PDF antes de publicar.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {(ebook.status !== 'published' || ebook.hasDraftChanges || dirty) && (
                <button type="button" className={primaryButton} disabled={busy || dirty || !deliveryReady || !ebook.coverReady || !ebook.pdfReady} onClick={() => { action.clear(); setConfirmation('publish'); }}>
                  {ebook.status === 'published' ? 'Publicar alterações' : 'Publicar'}
                </button>
              )}
              {publicUrl && (
                <a className={secondaryButton} href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={16} aria-hidden="true" /> Abrir página pública
                </a>
              )}
              {ebook.status === 'published' && (
                <button type="button" className={secondaryButton} disabled={busy} onClick={() => { action.clear(); setConfirmation('unpublish'); }}>Retirar do ar</button>
              )}
            </div>
          </section>
        </>
      )}
      {!showConfirmation && <MarketingActionStatus action={action} onReload={onReload} />}
      {showConfirmation && (
        <ArticleConfirmation
          title={confirmation === 'publish' ? 'Publicar e-book' : 'Retirar e-book do ar'}
          label={confirmation === 'publish' ? 'Publicar e-book' : 'Retirar do ar'}
          busy={action.pending}
          danger={confirmation === 'unpublish'}
          error={action.error}
          onCancel={() => { action.clear(); setConfirmation(null); }}
          onConfirm={confirmPublication}
        >
          {confirmation === 'publish'
            ? 'O título, a descrição e os arquivos salvos ficarão disponíveis na página pública.'
            : 'O formulário público deixará de aceitar novos pedidos de download.'}
        </ArticleConfirmation>
      )}
    </div>
  );
}

function UploadAsset({ kind, uploaded, disabled, children, onUpload }) {
  const ref = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const { label, accept, help, limit } = assetTypes[kind];

  function update(event) {
    const selected = event.target.files[0];
    if (selected && (!accept.split(',').includes(selected.type) || selected.size > limit * 1024 * 1024 || !selected.size)) {
      event.target.value = '';
      setFile(null);
      setError('Selecione um arquivo com o formato e tamanho indicados.');
      return;
    }
    setError('');
    setFile(selected ?? null);
  }

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-3">
      <MarketingField label={label}>
        <input ref={ref} type="file" className={fieldClass + ' text-sm'} accept={accept} disabled={disabled} onChange={update} />
      </MarketingField>
      <p className="text-xs text-slate-600">{help}</p>
      {uploaded ? children : <p className="text-xs text-slate-600">Nenhum arquivo enviado.</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <button
        type="button"
        className={secondaryButton}
        disabled={disabled || !file}
        onClick={() => onUpload(kind, file, () => { if (ref.current) ref.current.value = ''; setFile(null); })}
      >
        {kind === 'pdf' ? 'Enviar PDF' : 'Enviar capa'}
      </button>
    </div>
  );
}

function CoverPreview({ ebook }) {
  const [result, setResult] = useState(null);
  const id = ebook.id;
  const version = ebook.version;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl;
    api.get(endpoint + '/' + id + '/cover', { responseType: 'blob', signal }).then(({ data }) => {
      if (signal.aborted) return;
      objectUrl = URL.createObjectURL(data);
      setResult({ version, url: objectUrl });
    }).catch(() => {
      if (!signal.aborted) setResult({ version, error: true });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, version]);

  if (result?.version !== version) return <p role="status" className="text-xs text-slate-600">Carregando capa…</p>;
  if (result.error) return <p className="text-xs text-slate-600">Capa cadastrada. Prévia indisponível.</p>;
  return <img className="max-h-40 rounded border border-slate-200 object-contain" src={result.url} alt={`Capa de ${ebook.title}`} />;
}
