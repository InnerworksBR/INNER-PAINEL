import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMarketingAccess } from '../../../context/MarketingAccessContext';
import api from '../../../services/api';
import { primaryButton, secondaryButton } from '../Artigos/ArticleUi';
import { formCard, MarketingActionStatus, MarketingField, MarketingQueryStatus } from './MarketingUi';
import { MARKETING_PATH, useMarketingAction, useMarketingQuery } from './marketingData';

const settingsPath = MARKETING_PATH + '/email';
const microsoftPath = settingsPath + '/microsoft';
const connectionError = 'Não foi possível conectar a caixa da Microsoft.';

export default function MarketingEmailPanel() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { checkAgain } = useMarketingAccess();
  const settings = useMarketingQuery('/email', 'Não foi possível carregar as configurações de e-mail.');
  const action = useMarketingAction();
  const callback = useRef(null);
  const [address, setAddress] = useState(null);
  const [loginAddress, setLoginAddress] = useState(null);
  const { run } = action;

  useEffect(() => {
    const params = new URLSearchParams(search);
    if ((!params.has('code') && !params.has('error')) || callback.current === search) return;
    callback.current = search;
    navigate(settingsPath, { replace: true });
    void run(async () => {
      const code = params.get('code');
      const state = params.get('state');
      if (!code || !state) throw new Error('Microsoft authorization not completed');
      await api.post(microsoftPath + '/finish', { code, state });
      checkAgain();
    }, connectionError);
  }, [search, navigate, run, checkAgain]);

  const mailbox = address ?? settings.data?.mailbox ?? '';
  const username = loginAddress ?? settings.data?.username ?? '';

  function connect(event) {
    event.preventDefault();
    void run(async () => {
      const { data } = await api.post(microsoftPath + '/start', { mailbox, username: username.trim() || mailbox });
      window.location.assign(data.authorizationUrl);
    }, connectionError);
  }

  function disconnect() {
    void run(async () => {
      await api.delete(microsoftPath);
      checkAgain();
    }, 'Não foi possível desconectar a caixa da Microsoft.');
  }

  return (
    <section className={formCard + ' max-w-2xl space-y-4'}>
      <h2 className="text-xl font-bold text-slate-900">Configurações de e-mail</h2>
      <MarketingQueryStatus query={settings} loadingText="Carregando a conexão de e-mail…" />
      {settings.data && (settings.data.configured ? (
        settings.data.connected ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Caixa Microsoft conectada</p>
            <p className="break-all font-semibold text-slate-900">{settings.data.mailbox}</p>
            {settings.data.username && settings.data.username !== settings.data.mailbox && (
              <p className="break-all text-sm text-slate-600">Conta Microsoft usada na autenticação {settings.data.username}</p>
            )}
            <p className="text-sm text-slate-600">Esta caixa é usada na entrega dos e-books e nas campanhas.</p>
            <button type="button" className={secondaryButton} disabled={action.pending} onClick={disconnect}>
              Desconectar Microsoft
            </button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={connect}>
            <p className="text-sm text-slate-700">
              {settings.data.mailbox ? 'A autorização expirou. Reconecte a caixa para retomar os envios.'
                : 'Conecte uma caixa Microsoft 365 para enviar os e-books e as campanhas.'}
            </p>
            <MarketingField label="E-mail da caixa remetente">
              <input type="email" autoComplete="email" required maxLength={254} value={mailbox}
                onChange={event => setAddress(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
            </MarketingField>
            <MarketingField label="Conta Microsoft para autenticação" optional>
              <input type="email" autoComplete="username" maxLength={254} value={username}
                onChange={event => setLoginAddress(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
            </MarketingField>
            <p className="text-sm text-slate-600">Para uma caixa compartilhada, informe sua conta com permissão para enviar por ela.</p>
            <button type="submit" className={primaryButton} disabled={action.pending}>
              {settings.data.mailbox ? 'Reconectar Microsoft' : 'Conectar Microsoft'}
            </button>
          </form>
        )
      ) : (
        <p className="text-sm text-slate-700">Cadastre o aplicativo Microsoft Entra para liberar a conexão.</p>
      ))}
      <MarketingActionStatus action={action} onReload={checkAgain} />
    </section>
  );
}
