import { ArticleAlert, articleCard, fieldClass, secondaryButton } from '../Artigos/ArticleUi';

export const formCard = `${articleCard} space-y-4 p-4 sm:p-5`;
export const labelClass = 'block min-w-0 text-sm font-semibold text-slate-800';

export function MarketingField({ label, children, optional }) {
  return (
    <label className={labelClass}>
      {label} {optional && <small className="font-normal text-slate-600">(opcional)</small>}
      {children}
    </label>
  );
}

export function EbookSelect({ value, onChange, ebooks, all = 'Todos os e-books', disabled }) {
  return (
    <select className={fieldClass} value={value} onChange={onChange} disabled={disabled}>
      <option value="">{all}</option>
      {value && !ebooks.some(item => item.id === value) && <option value={value}>E-book vinculado</option>}
      {ebooks.map(ebook => <option key={ebook.id} value={ebook.id}>{ebook.title}</option>)}
    </select>
  );
}

export function MarketingQueryStatus({ query, loadingText }) {
  if (query.loading) return <p role="status" className="p-4 text-sm text-slate-600">{loadingText}</p>;
  if (!query.error) return null;
  return (
    <div className="space-y-3 p-4">
      <ArticleAlert>{query.error}</ArticleAlert>
      <button type="button" className={secondaryButton} onClick={query.reload}>Tentar novamente</button>
    </div>
  );
}

export function MarketingActionStatus({ action, onReload }) {
  return (
    <>
      {action.pending && <p role="status" className="text-sm text-slate-600">Processando…</p>}
      {action.error && <ArticleAlert>{action.error}</ArticleAlert>}
      {action.conflict && <button type="button" className={secondaryButton} onClick={onReload}>Recarregar dados</button>}
      {action.notice && <p role="status" className="text-sm font-medium text-emerald-800">{action.notice}</p>}
    </>
  );
}
