import { useId } from 'react';
import { ImagePlus } from 'lucide-react';
import { ImageUpload, ProtectedArticleImage } from './ArticleImages';
import { articleCard, fieldClass, secondaryButton } from './ArticleUi';
import { ArticleWritingEditor } from './ArticleWritingEditor';
import { ARTICLE_LIMITS, formatPublicArticleDate } from './articleEditorial';

export function ArticleContentEditor({ articleId, draft, updateDraft, disabled, onUpload }) {
  const { title, summary, cover, blocks } = draft;
  const coverInput = useId();
  const titleInput = useId();
  const summaryInput = useId();

  function updateField(field, value) {
    updateDraft(current => ({ ...current, [field]: value }));
  }

  function uploadCover(file) {
    onUpload(file, mediaId => updateField('cover', { mediaId, alt: '' }));
  }

  return (
    <section aria-label="Editor do artigo" className={`${articleCard} overflow-hidden`}>
      {cover ? (
        <div className="border-b border-slate-200 bg-slate-50">
          <ProtectedArticleImage articleId={articleId} media={cover}
            className="block aspect-[2.8/1] w-full object-cover" />
          <div className="space-y-3 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap gap-2">
              <ImageUpload label="Trocar imagem de capa" disabled={disabled} onSelect={uploadCover} />
              <button type="button" className={secondaryButton} disabled={disabled}
                onClick={() => updateField('cover', null)}>Remover capa</button>
            </div>
            <label className="block text-sm font-medium text-slate-800">
              Texto alternativo da capa
              <input className={fieldClass} maxLength={ARTICLE_LIMITS.alt} value={cover.alt} disabled={disabled}
                onChange={event => updateField('cover', { ...cover, alt: event.target.value })} />
            </label>
          </div>
        </div>
      ) : (
        <div className="m-4 flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center sm:m-6 sm:min-h-32">
          <ImagePlus size={23} className="text-slate-600" aria-hidden="true" />
          <ImageUpload label="Enviar imagem de capa" disabled={disabled} onSelect={uploadCover} describedBy={coverInput} />
          <p id={coverInput} className="text-xs text-slate-600">JPEG, PNG ou WebP de até 8 MiB</p>
        </div>
      )}

      <div className="space-y-4 px-4 pb-4 pt-1 sm:px-6 sm:pb-6">
        <div>
          <label htmlFor={titleInput} className="sr-only">Título</label>
          <textarea id={titleInput} rows={1} placeholder="Título do artigo" maxLength={ARTICLE_LIMITS.title} value={title} disabled={disabled}
            className="block w-full resize-none rounded-md px-2 py-2 text-3xl font-extrabold tracking-tight text-slate-900 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 sm:text-4xl [field-sizing:content]"
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
            }}
            onChange={event => updateField('title', event.target.value.replace(/[\r\n]+/g, ' '))} />
        </div>
        <div>
          <label htmlFor={summaryInput} className="block text-sm font-semibold text-slate-700">Resumo</label>
          <textarea id={summaryInput} className={`${fieldClass} resize-y`} placeholder="Uma breve descrição para a página de artigos" rows={2}
            maxLength={ARTICLE_LIMITS.summary} value={summary} disabled={disabled}
            onChange={event => updateField('summary', event.target.value)} />
        </div>
        <ArticleWritingEditor articleId={articleId} blocks={blocks} disabled={disabled}
          onUpload={onUpload} onChange={next => updateField('blocks', next)} />
      </div>
    </section>
  );
}

function PreviewBlock({ articleId, block }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="whitespace-pre-line text-2xl font-bold">{block.text}</h3>;
    case 'quote':
      return <blockquote className="whitespace-pre-line border-l-4 border-[#9ec825] bg-[#edf2f9] px-5 py-3"><p>{block.text}</p></blockquote>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return <List className={`${block.ordered ? 'list-decimal' : 'list-disc'} whitespace-pre-line space-y-2 pl-6`}>
        {block.items.filter(item => item.trim()).map((item, index) => <li key={index}>{item}</li>)}
      </List>;
    }
    case 'image':
      return <figure><ProtectedArticleImage articleId={articleId} media={block} className="mx-auto h-auto max-w-full rounded-xl" /></figure>;
    default:
      return <p className="whitespace-pre-line">{block.text}</p>;
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
          {draft.blocks.map((block, index) => <PreviewBlock key={index} articleId={article.id} block={block} />)}
        </div>
      </div>
    </article>
  );
}
