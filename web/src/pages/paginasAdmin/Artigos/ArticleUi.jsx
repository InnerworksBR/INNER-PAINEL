import { useEffect, useId, useRef } from 'react';

const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const primaryButton = `${button} bg-blue-700 text-white enabled:hover:bg-blue-800`;
export const secondaryButton = `${button} border border-slate-300 bg-white text-slate-800 enabled:hover:bg-slate-50`;
export const dangerButton = `${button} bg-red-700 text-white enabled:hover:bg-red-800`;
export const fieldClass = 'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline focus:outline-2 focus:outline-blue-600 disabled:bg-slate-50';
export const articleCard = 'rounded-xl border border-slate-200 bg-white shadow-sm';

export function ArticleStatus({ status }) {
  const statuses = {
    draft: { label: 'Rascunho', color: 'bg-amber-50 text-amber-900' },
    published: { label: 'Publicado', color: 'bg-emerald-50 text-emerald-800' },
    unpublished: { label: 'Retirado do ar', color: 'bg-slate-100 text-slate-700' },
  };
  const { label, color } = statuses[status];

  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

export function ArticleAlert({ children }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      {children}
    </div>
  );
}

export function ArticleConfirmation({ title, children, label, busy, danger, error, onConfirm, onCancel }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="m-auto w-11/12 max-w-md rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/40 sm:p-6"
      onCancel={event => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 className="text-lg font-bold" id={titleId}>{title}</h2>
      <div className="mt-2 text-sm leading-6 text-slate-700" id={descriptionId}>{children}</div>
      {error && <div className="mt-4"><ArticleAlert>{error}</ArticleAlert></div>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={secondaryButton} disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className={danger ? dangerButton : primaryButton} disabled={busy} onClick={onConfirm}>
          {busy ? 'Aguarde…' : label}
        </button>
      </div>
    </dialog>
  );
}
