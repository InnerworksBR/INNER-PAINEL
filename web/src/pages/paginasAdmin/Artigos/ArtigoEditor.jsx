import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Copy, Eye, ExternalLink, Save, Send } from 'lucide-react';
import { Link, useBlocker } from 'react-router-dom';
import api from '../../../services/api';
import { ArticleContentEditor, ArticlePreview } from './ArticleContent';
import { ArticleAlert, ArticleConfirmation, ArticleStatus, articleCard, primaryButton, secondaryButton } from './ArticleUi';
import {
  ARTICLES_PATH, ARTICLE_IMAGE_TYPES, ARTICLE_LIMITS, articleError, draftBodyIssue, draftPayload, editableArticle,
  formatArticleDate, publicationIssues,
} from './articleEditorial';

const publicationActions = {
  publish: {
    title: 'Colocar artigo no ar?',
    label: 'Confirmar publicação',
    error: 'Não foi possível confirmar a publicação. Tente novamente.',
    success: 'Artigo publicado.',
  },
  restore: {
    title: 'Restaurar versão pública?',
    label: 'Confirmar restauração',
    error: 'Não foi possível confirmar a restauração. Tente novamente.',
    success: 'Versão restaurada.',
  },
  unpublish: {
    title: 'Retirar artigo do ar?',
    label: 'Confirmar retirada',
    error: 'Não foi possível confirmar a retirada. Tente novamente.',
    success: 'Artigo retirado do ar.',
  },
};

function PublicLink({ url }) {
  const link = useRef(null);
  const [feedback, setFeedback] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Link copiado.');
    } catch {
      link.current?.focus();
      link.current?.select();
      setFeedback('Endereço selecionado. Use a opção de copiar do seu dispositivo.');
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-800">
        Endereço público
        <input ref={link} readOnly value={url} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryButton} onClick={copy}>
          <Copy size={15} aria-hidden="true" /> Copiar link público
        </button>
        <a className={secondaryButton} href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden="true" /> Abrir no site
        </a>
      </div>
      {feedback && <p role="status" className="text-sm text-slate-700">{feedback}</p>}
    </div>
  );
}

function PublicationCard({ article, dirty, issues, disabled, onAction }) {
  const published = article.status === 'published';

  return (
    <aside aria-labelledby="article-publication" className="min-w-0 space-y-5">
      <section className={`${articleCard} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="article-publication" className="text-lg font-bold text-slate-900">Publicação</h2>
          <ArticleStatus status={article.status} />
        </div>
        {published && (dirty || article.hasDraftChanges) && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            O site continua exibindo a versão publicada. Publique o rascunho para atualizar o artigo no mesmo endereço.
          </p>
        )}
        {article.publishedAt && (
          <p className="text-sm text-slate-700">
            Primeira publicação em <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
          </p>
        )}
        {published && article.publicUrl && <PublicLink key={article.publicUrl} url={article.publicUrl} />}
        {(dirty || issues.length > 0) && (
          <div className="space-y-1 text-sm text-slate-700" id="publish-requirements">
            <p className="font-semibold text-slate-800">Para publicar</p>
            <ul className="list-disc space-y-1 pl-5">
              {issues.map(issue => <li key={issue}>{issue}</li>)}
              {dirty && <li>Salve o rascunho.</li>}
            </ul>
          </div>
        )}
        {published && (
          <button type="button" className={`${secondaryButton} !text-red-800`} disabled={disabled}
            onClick={() => onAction({ type: 'unpublish' })}>Retirar do ar</button>
        )}
      </section>

      {article.revisions.length > 0 && (
        <section aria-labelledby="article-revisions" className={`${articleCard} p-4 sm:p-5`}>
          <h2 id="article-revisions" className="text-lg font-bold text-slate-900">Versões publicadas</h2>
          <ul className="mt-2 divide-y divide-slate-200">
            {article.revisions.map(revision => {
              const active = published && revision.id === article.publishedRevisionId;
              return (
                <li key={revision.id} className="space-y-2 py-3 last:pb-0">
                  <p className="break-words text-sm font-semibold text-slate-900">{revision.title}</p>
                  <time className="block text-xs text-slate-600" dateTime={revision.publishedAt}>{formatArticleDate(revision.publishedAt)}</time>
                  {active ? (
                    <span className="inline-block text-xs font-semibold text-emerald-800">Versão no ar</span>
                  ) : (
                    <button type="button" className={secondaryButton} disabled={disabled} aria-label={`Restaurar versão ${revision.title}`}
                      onClick={() => onAction({ type: 'restore', revision })}>Restaurar versão</button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}

export default function ArtigoEditor({ initialArticle }) {
  const [article, setArticle] = useState(initialArticle);
  const [draft, setDraft] = useState(() => editableArticle(initialArticle));
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const requestIds = useRef(new Map());
  const articlePath = `${ARTICLES_PATH}/${article.id}`;
  const payload = draftPayload(draft);
  const serialized = JSON.stringify(payload);
  const dirty = serialized !== JSON.stringify(draftPayload(article));
  const issues = publicationIssues(payload);
  const published = article.status === 'published';
  const canPublish = !busy && !conflict && !dirty && issues.length === 0 && (!published || article.hasDraftChanges);
  const protectEdits = dirty || Boolean(busy);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    protectEdits && currentLocation.pathname !== nextLocation.pathname
  ));

  useEffect(() => {
    if (!protectEdits) return;
    function handleUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [protectEdits]);

  function updateDraft(update) {
    setDraft(update);
    setMessage('');
  }

  function openConfirmation(action) {
    setConfirmation(action);
    setError('');
    setMessage('');
  }

  function startOperation(name) {
    setBusy(name);
    setError('');
    setMessage('');
  }

  function handleError(cause, fallback) {
    if (cause.response?.status === 409) {
      setConflict(true);
      setConfirmation(null);
    } else {
      setError(articleError(cause, fallback));
    }
  }

  async function saveDraft() {
    if (busy || conflict || !dirty) return;
    const bodyIssue = draftBodyIssue(payload.blocks);
    if (bodyIssue) {
      setError(bodyIssue);
      return;
    }
    const request = { ...payload, version: article.version };
    if (new Blob([JSON.stringify(request)]).size > ARTICLE_LIMITS.draftBytes) {
      setError('O rascunho excede 256 KiB de texto. Reduza o conteúdo e tente novamente.');
      return;
    }

    startOperation('save');
    try {
      const { data } = await api.patch(articlePath, request);
      const next = data.article;
      setArticle(next);
      setDraft(editableArticle(next));
      requestIds.current.clear();
      setMessage('Rascunho salvo.');
    } catch (cause) {
      handleError(cause, 'Não foi possível salvar o rascunho. Suas alterações continuam no editor.');
    } finally {
      setBusy('');
    }
  }

  function handleSaveShortcut(event) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!confirmation && blocker.state !== 'blocked') saveDraft();
    }
  }

  async function uploadImage(file, applyImage) {
    if (busy) return;
    setMessage('');
    if (file.size > ARTICLE_LIMITS.imageBytes) {
      setError('A imagem ultrapassa o limite de 8 MiB.');
      return;
    }
    if (!file.size || (file.type && !ARTICLE_IMAGE_TYPES.includes(file.type))) {
      setError('Selecione uma imagem JPEG, PNG ou WebP.');
      return;
    }

    startOperation('upload');
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post(`${articlePath}/media`, form);
      applyImage(data.mediaId);
      setMessage('Imagem enviada. Preencha o texto alternativo e salve o rascunho.');
    } catch (cause) {
      setError(articleError(cause, 'Não foi possível enviar a imagem. Suas alterações continuam no editor.'));
    } finally {
      setBusy('');
    }
  }

  async function reloadArticle() {
    startOperation('reload');
    try {
      const { data } = await api.get(articlePath);
      setArticle(data.article);
      setDraft(editableArticle(data.article));
      setEditorRevision(current => current + 1);
      setConflict(false);
      setConfirmation(null);
      setPreview(false);
      requestIds.current.clear();
      setMessage('Versão salva carregada.');
    } catch (cause) {
      setError(articleError(cause, 'Não foi possível recarregar o artigo. Suas alterações continuam no editor.'));
    } finally {
      setBusy('');
    }
  }

  async function changePublication() {
    if (busy || conflict || (confirmation.type === 'publish' && !canPublish)) return;
    const { type, revision } = confirmation;
    startOperation(type);
    try {
      const key = `${type}/${article.version}/${revision?.id ?? ''}`;
      if (!requestIds.current.has(key)) requestIds.current.set(key, crypto.randomUUID());
      const body = { version: article.version, requestId: requestIds.current.get(key) };
      if (revision) body.revisionId = revision.id;
      const { data } = await api.post(`${articlePath}/${type}`, body);
      setArticle(data.article);
      setConfirmation(null);
      requestIds.current.clear();
      setMessage(publicationActions[type].success);
    } catch (cause) {
      handleError(cause, publicationActions[type].error);
    } finally {
      setBusy('');
    }
  }

  const toolbarStatus = {
    save: 'Salvando rascunho…',
    upload: 'Enviando imagem…',
    reload: 'Carregando a versão salva…',
  }[busy] || message;
  const publicationAction = publicationActions[confirmation?.type];

  return (
    <div className="mx-auto max-w-6xl space-y-5" onKeyDown={handleSaveShortcut}>
      <header className="space-y-2">
        <Link to={ARTICLES_PATH} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar aos artigos
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Editar artigo</h1>
      </header>

      <div className={`${articleCard} sticky top-[65px] z-10 space-y-2 px-3 py-3 sm:px-4 md:top-0`}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} disabled={Boolean(busy) || !dirty || conflict}
              aria-keyshortcuts="Control+S Meta+S" onClick={saveDraft}>
              <Save size={16} aria-hidden="true" /> Salvar rascunho
            </button>
            <button type="button" className={secondaryButton} disabled={Boolean(busy)} onClick={() => setPreview(current => !current)}>
              <Eye size={16} aria-hidden="true" /> {preview ? 'Voltar à edição' : 'Pré-visualizar'}
            </button>
            <button type="button" className={primaryButton} disabled={!canPublish}
              aria-describedby={dirty || issues.length > 0 ? 'publish-requirements' : undefined}
              onClick={() => openConfirmation({ type: 'publish' })}>
              <Send size={16} aria-hidden="true" /> {published ? 'Publicar atualização' : 'Publicar'}
            </button>
          </div>
          <p role="status" className="text-sm text-slate-700">
            {toolbarStatus || (preview ? 'Prévia privada' : dirty ? 'Alterações não salvas' : 'Rascunho salvo no painel')}
          </p>
        </div>
        {conflict && (
          <ArticleAlert>
            A versão salva mudou. Outro editor pode ter atualizado o artigo. Suas alterações continuam no editor.{' '}
            <button type="button" className="font-semibold underline" disabled={Boolean(busy)}
              onClick={() => openConfirmation({ type: 'reload' })}>Recarregar artigo</button>
          </ArticleAlert>
        )}
        {error && !confirmation && <ArticleAlert>{error}</ArticleAlert>}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,21rem)]">
        <div className="min-w-0" hidden={preview}>
          <ArticleContentEditor key={editorRevision} articleId={article.id} draft={draft}
            disabled={Boolean(busy)} updateDraft={updateDraft} onUpload={uploadImage} />
        </div>
        {preview && <ArticlePreview article={article} draft={draft} />}
        <PublicationCard article={article} dirty={dirty} issues={issues} disabled={Boolean(busy) || conflict} onAction={openConfirmation} />
      </div>

      {blocker.state === 'blocked' ? (
        <ArticleConfirmation title="Sair do editor?" label="Sair do editor" danger onCancel={blocker.reset} onConfirm={blocker.proceed}>
          {dirty ? 'Seu rascunho tem alterações não salvas. Se você sair, essas alterações serão descartadas.' : 'Uma operação ainda está em andamento.'}
        </ArticleConfirmation>
      ) : confirmation?.type === 'reload' ? (
        <ArticleConfirmation title="Recarregar artigo?" label="Carregar versão salva" danger={dirty} busy={Boolean(busy)} error={error}
          onCancel={() => setConfirmation(null)} onConfirm={reloadArticle}>
          {dirty ? 'A versão salva substituirá suas alterações locais. Copie o conteúdo que quiser manter antes de confirmar.' : 'O painel vai carregar a versão salva mais recente.'}
        </ArticleConfirmation>
      ) : publicationAction && (
        <ArticleConfirmation title={publicationAction.title} label={publicationAction.label} danger={confirmation.type === 'unpublish'}
          busy={Boolean(busy)} error={error} onCancel={() => setConfirmation(null)} onConfirm={changePublication}>
          {confirmation.type === 'publish' && (published
            ? 'O rascunho salvo substituirá a versão pública no mesmo endereço.'
            : 'O rascunho salvo ficará disponível para os visitantes do site.')}
          {confirmation.type === 'restore' && (
            <>A versão <strong>{confirmation.revision.title}</strong> voltará ao site no mesmo endereço. Você poderá continuar editando o rascunho atual.</>
          )}
          {confirmation.type === 'unpublish' && 'O artigo deixará de aparecer no site e o link público ficará indisponível. Você poderá continuar editando o rascunho.'}
        </ArticleConfirmation>
      )}
    </div>
  );
}
