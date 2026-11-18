import { BookOpen, Mail, Settings, Users } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useMarketingAccess } from '../../../context/MarketingAccessContext';
import { articleCard, primaryButton, secondaryButton } from '../Artigos/ArticleUi';
import { MARKETING_PATH, useMarketingQuery } from './marketingData';

const tabs = [
  { to: MARKETING_PATH, name: 'E-books', Icon: BookOpen },
  { to: MARKETING_PATH + '/contatos', name: 'Contatos', Icon: Users },
  { to: MARKETING_PATH + '/campanhas', name: 'Campanhas', Icon: Mail },
  { to: MARKETING_PATH + '/email', name: 'Configurações de e-mail', Icon: Settings },
];

export default function MarketingRoute() {
  const { access, checkAgain } = useMarketingAccess();
  if (access === 'allowed') return <MarketingDashboard />;

  return (
    <section className={`${articleCard} mx-auto max-w-4xl space-y-3 p-5 sm:p-6`}>
      {access === 'checking' ? (
        <p role="status" className="text-sm text-slate-600">Verificando acesso ao Marketing…</p>
      ) : (
        <>
          <h1 className="text-xl font-bold text-slate-900">
            {access === 'denied' ? 'Marketing indisponível' : 'Falha ao verificar o acesso ao Marketing'}
          </h1>
          <div className="flex flex-wrap gap-2">
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

function MarketingDashboard() {
  const ebooks = useMarketingQuery('/ebooks', 'Não foi possível carregar os e-books.');
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Marketing</h1>
      <nav aria-label="Seções de Marketing" className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(({ to, name, Icon }) => (
          <NavLink
            end
            key={to}
            to={to}
            className={({ isActive }) => `inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold sm:px-4 ${isActive
              ? 'border-blue-700 text-blue-800'
              : 'border-transparent text-slate-700 hover:bg-slate-100'}`}
          >
            <Icon size={17} aria-hidden="true" />
            {name}
          </NavLink>
        ))}
      </nav>
      <Outlet context={ebooks} />
    </div>
  );
}
