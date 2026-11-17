import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { articleCard, fieldClass, primaryButton, secondaryButton } from '../Artigos/ArticleUi';
import { EbookSelect, formCard, MarketingField, MarketingQueryStatus } from './MarketingUi';
import { contactStatuses, formatMarketingDate, useMarketingQuery } from './marketingData';

const emptyFilters = { q: '', ebookId: '', status: '', from: '', to: '' };
const headerClass = 'px-4 py-3 text-left font-semibold text-slate-800';

export default function ContactsPanel() {
  const ebooks = useOutletContext();
  const [filters, setFilters] = useState(emptyFilters);
  const [params, setParams] = useState({ page: 1 });
  const contacts = useMarketingQuery('/contacts', 'Não foi possível carregar os contatos.', params);
  const { page } = params;

  function applyFilters(event) {
    event.preventDefault();
    const { ebookId, status, from, to } = filters;
    const q = filters.q.trim();
    setParams({ page: 1, ...(ebookId && { ebookId }), ...(status && { status }), ...(from && { from }), ...(to && { to }), ...(q && { q }) });
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setParams({ page: 1 });
  }

  return (
    <section className="space-y-4" aria-labelledby="marketing-contacts">
      <h2 id="marketing-contacts" className="text-xl font-bold text-slate-900">Contatos</h2>
      <form className={formCard} onSubmit={applyFilters}>
        <div className="grid gap-3 xl:grid-cols-[2fr_1fr_1fr]">
          <MarketingField label="Buscar por nome ou e-mail">
            <input type="search" className={fieldClass} value={filters.q} maxLength={160} onChange={event => setFilters({ ...filters, q: event.target.value })} />
          </MarketingField>
          <MarketingField label="E-book">
            <EbookSelect
              ebooks={ebooks.data?.ebooks ?? []}
              disabled={ebooks.loading || !!ebooks.error}
              value={filters.ebookId}
              onChange={event => setFilters({ ...filters, ebookId: event.target.value })}
            />
          </MarketingField>
          <MarketingField label="Status de marketing">
            <select className={fieldClass} value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Todos os status</option>
              {Object.entries(contactStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </MarketingField>
          <MarketingField label="Pedido a partir de">
            <input type="date" className={fieldClass} value={filters.from} max={filters.to || undefined}
              onChange={event => setFilters({ ...filters, from: event.target.value })} />
          </MarketingField>
          <MarketingField label="Pedido até">
            <input type="date" className={fieldClass} value={filters.to} min={filters.from || undefined}
              onChange={event => setFilters({ ...filters, to: event.target.value })} />
          </MarketingField>
        </div>
        {ebooks.error && <MarketingQueryStatus query={ebooks} />}
        <div className="flex flex-wrap gap-2">
          <button className={primaryButton} type="submit">Filtrar</button>
          <button className={secondaryButton} type="button" onClick={clearFilters}>Limpar filtros</button>
        </div>
      </form>
      <div className={articleCard} aria-busy={contacts.loading}>
        <MarketingQueryStatus query={contacts} loadingText="Carregando contatos…" />
        {contacts.data?.contacts.length === 0 && <p className="p-4 text-sm text-slate-600">Nenhum contato encontrado.</p>}
        {contacts.data?.contacts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Contatos de Marketing">
              <thead className="bg-slate-50">
                <tr>
                  <th className={headerClass} scope="col">Contato</th>
                  <th className={headerClass} scope="col">Status de marketing</th>
                  <th className={headerClass} scope="col">E-books solicitados</th>
                  <th className={headerClass} scope="col">Último pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {contacts.data.contacts.map(contact => (
                  <tr key={contact.id}>
                    <th scope="row" className="max-w-72 break-words px-4 py-3 text-left font-normal">
                      {contact.name && <span className="block font-semibold text-slate-900">{contact.name}</span>}
                      {contact.email}
                    </th>
                    <td className="px-4 py-3">{contactStatuses[contact.marketingStatus] || '—'}</td>
                    <td className="px-4 py-3">{contact.ebooks.map(ebook => ebook.title).join(', ') || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatMarketingDate(contact.lastRequestAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {(page > 1 || contacts.data?.hasMore) && (
          <nav aria-label="Páginas de contatos" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-4">
            <button type="button" className={secondaryButton} disabled={page === 1 || contacts.loading} onClick={() => setParams({ ...params, page: page - 1 })}>
              Anterior
            </button>
            <span className="text-sm text-slate-700">Página {page}</span>
            <button type="button" className={secondaryButton} disabled={!contacts.data?.hasMore} onClick={() => setParams({ ...params, page: page + 1 })}>
              Próxima
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
