import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useArtigosAccess } from '../../../context/ArtigosAccessContext';
import api from '../../../services/api';
import { ArticleAlert, ArticleStatus, articleCard, primaryButton, secondaryButton } from './ArticleUi';
import { ARTICLES_PATH, articleError, formatArticleDate } from './articleEditorial';

const ArtigoEditor = lazy(() => import('./ArtigoEditor'));

export function ArtigosAccessRoute() {
  const { access, checkAgain } = useArtigosAccess();

  if (access === 'allowed') return <Outlet />;

  return (
    <section className={`${articleCard} mx-auto max-w-4xl p-5 sm:p-6`}>
      {access === 'checking' ? (
        <p role="status" className="text-sm text-slate-600">Verificando acesso aos artigos…</p>
      ) : (
        <>
          <h1 className="text-xl font-bold text-slate-900">
            {access === 'denied' ? 'Acesso restrito' : 'Não foi possível verificar o acesso'}
          </h1>
          <p className="mt-2 text-sm text-slate-700">
            {access === 'denied'
              ? 'Sua conta não tem permissão para editar artigos do site.'
              : 'Tente verificar a permissão novamente.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {access === 'error' && (
              <button type="button" className={primaryButton} onClick={checkAgain}>Tentar novamente</button>
            )}
            <Link className={secondaryButton} to="/admin">Voltar ao início do painel</Link>
          </div>
        </>
      )}
    </section>
  );
}

export function ArtigosList() {
  const navigate = useNavigate();
  const creationId = useRef(null);
  const creationRequest = useRef(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const current = result?.page === page && result?.attempt === attempt ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    api.get(ARTICLES_PATH, { params: { page }, signal }).then(({ data }) => {
      if (!signal.aborted) setResult({ page, attempt, data });
    }).catch(error => {
      if (!signal.aborted) {
        setResult({ page, attempt, error: articleError(error, 'Não foi possível carregar os artigos.') });
      }
    });
    return () => controller.abort();
  }, [page, attempt]);

  useEffect(() => () => creationRequest.current?.abort(), []);

  async function createArticle() {
    if (creationRequest.current) return;
    const controller = new AbortController();
    const { signal } = controller;
    creationRequest.current = controller;
    setCreating(true);
    setCreateError('');
    try {
      creationId.current ??= crypto.randomUUID();
      const { data } = await api.post(ARTICLES_PATH, { id: creationId.current }, { signal });
      if (!signal.aborted) navigate(`${ARTICLES_PATH}/${data.article.id}`);
    } catch (error) {
      if (!signal.aborted) setCreateError(articleError(error, 'Não foi possível criar o artigo. Tente novamente.'));
    } finally {
      creationRequest.current = null;
      if (!signal.aborted) setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Artigos do site</h1>
        <button type="button" className={primaryButton} disabled={creating} onClick={createArticle}>
          <Plus size={17} aria-hidden="true" />
          {creating ? 'Criando artigo…' : 'Novo artigo'}
        </button>
      </header>

      {createError && <ArticleAlert>{createError}</ArticleAlert>}
      <section className={articleCard} aria-label="Lista de artigos" aria-busy={!current}>
        {!current && <p role="status" className="p-5 text-sm text-slate-600">Carregando artigos…</p>}
        {current?.error && (
          <div className="space-y-3 p-5">
            <ArticleAlert>{current.error}</ArticleAlert>
            <button type="button" className={secondaryButton} onClick={() => setAttempt(value => value + 1)}>
              Tentar novamente
            </button>
          </div>
        )}
        {current?.data?.articles.length === 0 && (
          <p className="p-5 text-sm text-slate-600">{page === 1 ? 'Nenhum artigo criado.' : 'Nenhum artigo nesta página.'}</p>
        )}
        {current?.data?.articles.length > 0 && (
          <ul className="divide-y divide-slate-200">
            {current.data.articles.map(article => (
              <li key={article.id}>
                <Link
                  to={`${ARTICLES_PATH}/${article.id}`}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-4 hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:gap-x-5 sm:px-5"
                >
                  <span className="break-words text-sm font-bold text-slate-900">{article.title.trim() || 'Artigo sem título'}</span>
                  <ArticleStatus status={article.status} />
                  <span className="text-xs text-slate-600">Editado em {formatArticleDate(article.updatedAt)}</span>
                  <ChevronRight size={17} className="justify-self-end text-slate-500" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {(page > 1 || current?.data?.hasMore) && (
          <nav aria-label="Páginas de artigos" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-4">
            <button type="button" className={secondaryButton} disabled={page === 1 || !current} onClick={() => setPage(value => value - 1)}>
              Anterior
            </button>
            <span className="text-sm text-slate-700">Página {page}</span>
            <button type="button" className={secondaryButton} disabled={!current?.data?.hasMore} onClick={() => setPage(value => value + 1)}>
              Próxima
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}

function LoadArticle({ id }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    api.get(`${ARTICLES_PATH}/${encodeURIComponent(id)}`, { signal }).then(({ data }) => {
      if (!signal.aborted) setResult({ article: data.article });
    }).catch(error => {
      if (!signal.aborted) setResult({ error: articleError(error, 'Não foi possível carregar o artigo.') });
    });
    return () => controller.abort();
  }, [id, attempt]);

  if (result?.article) {
    return (
      <Suspense fallback={<p role="status" className="text-sm text-slate-600">Carregando editor…</p>}>
        <ArtigoEditor initialArticle={result.article} />
      </Suspense>
    );
  }

  return (
    <section className={`${articleCard} mx-auto max-w-4xl space-y-4 p-5 sm:p-6`}>
      <Link to={ARTICLES_PATH} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
        <ArrowLeft size={16} aria-hidden="true" /> Artigos do site
      </Link>
      {!result && <p role="status" className="text-sm text-slate-600">Carregando artigo…</p>}
      {result?.error && (
        <>
          <ArticleAlert>{result.error}</ArticleAlert>
          <button type="button" className={secondaryButton} onClick={() => {
            setResult(null);
            setAttempt(value => value + 1);
          }}>Tentar novamente</button>
        </>
      )}
    </section>
  );
}

export function ArtigoRoute() {
  const { articleId } = useParams();
  return <LoadArticle key={articleId} id={articleId} />;
}
