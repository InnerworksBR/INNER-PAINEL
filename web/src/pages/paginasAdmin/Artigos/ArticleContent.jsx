import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { articleCard, fieldClass, secondaryButton } from './ArticleUi';
import { ARTICLES_PATH, ARTICLE_IMAGE_TYPES, ARTICLE_LIMITS, formatPublicArticleDate } from './articleEditorial';

const blockNames = {
  paragraph: 'Parágrafo',
  heading: 'Subtítulo',
  quote: 'Citação',
  list: 'Lista',
  image: 'Imagem',
};
const blockButtonNames = {
  paragraph: 'Adicionar parágrafo',
  heading: 'Adicionar subtítulo',
  quote: 'Adicionar citação',
  list: 'Adicionar lista',
};
const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 enabled:hover:bg-slate-100 disabled:opacity-40';

function ProtectedArticleImage({ articleId, media, className }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const { mediaId, alt } = media;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl;
    api.get(`${ARTICLES_PATH}/${articleId}/media/${mediaId}`, { responseType: 'blob', signal }).then(({ data }) => {
      if (!signal.aborted) {
        objectUrl = URL.createObjectURL(data);
        setResult({ mediaId, url: objectUrl });
      }
    }).catch(() => {
      if (!signal.aborted) setResult({ mediaId, error: true });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [articleId, mediaId, attempt]);

  if (result?.mediaId !== mediaId) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Carregando imagem…</p>;
  }
  if (result.error) {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        Não foi possível carregar a imagem.{' '}
        <button type="button" className="font-semibold text-blue-700 underline" onClick={() => {
          setResult(null);
          setAttempt(value => value + 1);
        }}>Tentar novamente</button>
      </p>
    );
  }
  return <img src={result.url} alt={alt} className={className} />;
}

function ImageUpload({ label, disabled, onSelect }) {
  return (
    <label className={`${secondaryButton} focus-within:outline focus-within:outline-2 focus-within:outline-blue-600 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <ImagePlus size={16} aria-hidden="true" />
      {label}
      <input
        type="file"
        className="sr-only"
        accept={ARTICLE_IMAGE_TYPES.join(',')}
        disabled={disabled}
        onChange={event => {
          const file = event.target.files[0];
          event.target.value = '';
          if (file) onSelect(file);
        }}
      />
    </label>
  );
}

function ListEditor({ block, disabled, onChange }) {
  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={block.ordered} disabled={disabled} onChange={event => onChange({ ordered: event.target.checked })} />
        Lista numerada
      </label>
      <ul className="space-y-2">
        {block.items.map((item, index) => (
          <li key={index} className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-medium text-slate-800">
              Item {index + 1} da lista
              <input
                className={fieldClass}
                maxLength={ARTICLE_LIMITS.listItem}
                value={item}
                disabled={disabled}
                onChange={event => onChange({
                  items: block.items.map((value, position) => position === index ? event.target.value : value),
                })}
              />
            </label>
            <button
              type="button"
              className={iconButton}
              disabled={disabled}
              aria-label={`Remover item ${index + 1} da lista`}
              onClick={() => onChange({ items: block.items.filter((_, position) => position !== index) })}
            ><Trash2 size={16} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={secondaryButton}
        disabled={disabled || block.items.length >= ARTICLE_LIMITS.listCount}
        onClick={() => onChange({ items: [...block.items, ''] })}
      ><Plus size={16} aria-hidden="true" /> Adicionar item</button>
    </div>
  );
}

function BlockFields({ articleId, block, disabled, update, onUpload }) {
  if (block.type === 'list') return <ListEditor block={block} disabled={disabled} onChange={update} />;
  if (block.type === 'image') {
    return (
      <div className="space-y-3">
        <ProtectedArticleImage articleId={articleId} media={block} className="max-h-48 w-auto max-w-full rounded-lg object-contain" />
        <ImageUpload label="Trocar imagem" disabled={disabled} onSelect={onUpload} />
        <label className="block text-sm font-medium text-slate-800">
          Texto alternativo da imagem
          <input className={fieldClass} maxLength={ARTICLE_LIMITS.alt} disabled={disabled} value={block.alt} onChange={event => update({ alt: event.target.value })} />
        </label>
      </div>
    );
  }
  return (
    <label className="block text-sm font-medium text-slate-800">
      {blockNames[block.type]}
      <textarea
        className={fieldClass}
        maxLength={ARTICLE_LIMITS.blockText}
        rows={block.type === 'heading' ? 2 : 4}
        value={block.text}
        disabled={disabled}
        onChange={event => update({ text: event.target.value })}
      />
    </label>
  );
}

export function ArticleContentEditor({ articleId, draft, updateDraft, disabled, onUpload }) {
  const { title, summary, cover, blocks } = draft;

  function updateBlock(editorId, changes) {
    updateDraft(current => ({
      ...current, blocks: current.blocks.map(block => block.editorId === editorId ? { ...block, ...changes } : block),
    }));
  }

  function moveBlock(index, offset) {
    updateDraft(current => {
      const reordered = [...current.blocks];
      const otherIndex = index + offset;
      [reordered[index], reordered[otherIndex]] = [reordered[otherIndex], reordered[index]];
      return { ...current, blocks: reordered };
    });
  }

  function addBlock(type) {
    const block = type === 'list' ? { type, ordered: false, items: [''] } : { type, text: '' };
    const editorId = crypto.randomUUID();
    updateDraft(current => ({ ...current, blocks: [...current.blocks, { ...block, editorId }] }));
  }

  const canAdd = !disabled && blocks.length < ARTICLE_LIMITS.blockCount;

  return (
    <div className="min-w-0 space-y-5">
      <section aria-label="Título e resumo" className={`${articleCard} space-y-4 p-4 sm:p-5`}>
        <label className="block text-sm font-semibold text-slate-800">
          Título
          <input className={fieldClass} maxLength={ARTICLE_LIMITS.title} value={title} disabled={disabled}
            onChange={event => {
              const value = event.target.value;
              updateDraft(current => ({ ...current, title: value }));
            }} />
        </label>
        <label className="block text-sm font-semibold text-slate-800">
          Resumo
          <textarea className={fieldClass} maxLength={ARTICLE_LIMITS.summary} rows={3} value={summary} disabled={disabled}
            onChange={event => {
              const value = event.target.value;
              updateDraft(current => ({ ...current, summary: value }));
            }} />
        </label>
      </section>

      <section aria-labelledby="article-cover" className={`${articleCard} space-y-3 p-4 sm:p-5`}>
        <h2 id="article-cover" className="text-lg font-bold text-slate-900">Imagem de capa</h2>
        {cover && <ProtectedArticleImage articleId={articleId} media={cover} className="max-h-60 w-auto max-w-full rounded-lg object-contain" />}
        <div className="flex flex-wrap items-center gap-2">
          <ImageUpload label={cover ? 'Trocar imagem de capa' : 'Enviar imagem de capa'} disabled={disabled}
            onSelect={file => onUpload(file, mediaId => updateDraft(current => ({ ...current, cover: { mediaId, alt: '' } })))} />
          {cover && (
            <button type="button" className={secondaryButton} disabled={disabled}
              onClick={() => updateDraft(current => ({ ...current, cover: null }))}>Remover capa</button>
          )}
        </div>
        {!cover && <p className="text-xs text-slate-600">JPEG, PNG ou WebP de até 8 MiB.</p>}
        {cover && (
          <label className="block text-sm font-medium text-slate-800">
            Texto alternativo da capa
            <input className={fieldClass} maxLength={ARTICLE_LIMITS.alt} value={cover.alt} disabled={disabled}
              onChange={event => {
                const alt = event.target.value;
                updateDraft(current => ({ ...current, cover: { ...current.cover, alt } }));
              }} />
          </label>
        )}
      </section>

      <section aria-labelledby="article-blocks" className={`${articleCard} space-y-4 p-4 sm:p-5`}>
        <h2 id="article-blocks" className="text-lg font-bold text-slate-900">Conteúdo</h2>
        {blocks.length > 0 && (
          <ol className="space-y-3">
            {blocks.map((block, index) => (
              <li key={block.editorId} className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700">{index + 1}. {blockNames[block.type]}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" className={iconButton} disabled={disabled || index === 0}
                      aria-label={`Mover bloco ${index + 1} para cima`} onClick={() => moveBlock(index, -1)}>
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className={iconButton} disabled={disabled || index === blocks.length - 1}
                      aria-label={`Mover bloco ${index + 1} para baixo`} onClick={() => moveBlock(index, 1)}>
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className={iconButton} disabled={disabled}
                      aria-label={`Remover bloco ${index + 1}`}
                      onClick={() => updateDraft(current => ({
                        ...current, blocks: current.blocks.filter(item => item.editorId !== block.editorId),
                      }))}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <BlockFields articleId={articleId} block={block} disabled={disabled}
                  update={changes => updateBlock(block.editorId, changes)}
                  onUpload={file => onUpload(file, mediaId => updateBlock(block.editorId, { mediaId, alt: '' }))} />
              </li>
            ))}
          </ol>
        )}
        <div className="flex flex-wrap gap-2">
          {Object.entries(blockButtonNames).map(([type, label]) => (
            <button type="button" key={type} className={secondaryButton} disabled={!canAdd} onClick={() => addBlock(type)}>
              <Plus size={15} aria-hidden="true" /> {label}
            </button>
          ))}
          <ImageUpload label="Adicionar imagem" disabled={!canAdd} onSelect={file => onUpload(file, mediaId => {
            const editorId = crypto.randomUUID();
            updateDraft(current => ({ ...current, blocks: [...current.blocks, { type: 'image', editorId, mediaId, alt: '' }] }));
          })} />
        </div>
        {blocks.length >= ARTICLE_LIMITS.blockCount && <p className="text-sm text-slate-700">O artigo atingiu o limite de {ARTICLE_LIMITS.blockCount} blocos.</p>}
      </section>
    </div>
  );
}

function PreviewBlock({ articleId, block }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="text-2xl font-bold">{block.text}</h3>;
    case 'quote':
      return <blockquote className="border-l-4 border-[#9ec825] bg-[#edf2f9] px-5 py-3"><p>{block.text}</p></blockquote>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return <List className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-2 pl-6`}>
        {block.items.filter(item => item.trim()).map((item, index) => <li key={index}>{item}</li>)}
      </List>;
    }
    case 'image':
      return <figure><ProtectedArticleImage articleId={articleId} media={block} className="mx-auto h-auto max-w-full rounded-xl" /></figure>;
    default:
      return <p>{block.text}</p>;
  }
}

export function ArticlePreview({ article, draft }) {
  return (
    <article aria-label="Prévia do artigo" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-[#f6f8fb] text-[#11223c] shadow-sm [overflow-wrap:anywhere]">
      <header className="mx-auto max-w-3xl px-5 pb-6 pt-8 sm:px-8 sm:pt-10">
        {article.publishedAt && (
          <time className="text-sm font-semibold text-[#50617a]" dateTime={article.publishedAt}>{formatPublicArticleDate(article.publishedAt)}</time>
        )}
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {draft.title.trim() || 'Artigo sem título'}
        </h2>
        {draft.summary && <p className="mt-4 text-lg leading-7 text-[#50617a]">{draft.summary}</p>}
      </header>
      {draft.cover && (
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <ProtectedArticleImage articleId={article.id} media={draft.cover} className="block aspect-[16/10] w-full rounded-2xl object-cover sm:aspect-[2/1]" />
        </div>
      )}
      <div className="mx-auto max-w-3xl px-5 py-8 text-base leading-relaxed sm:px-8">
        <div className="max-w-[70ch] space-y-5">
          {draft.blocks.map(block => <PreviewBlock key={block.editorId} articleId={article.id} block={block} />)}
        </div>
      </div>
    </article>
  );
}
