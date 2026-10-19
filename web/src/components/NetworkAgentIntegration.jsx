import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Download, LoaderCircle, Network, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import api from '../services/api';

const adminPrefix = (companyId) => `/admin/monitoring/companies/${encodeURIComponent(companyId)}`;
const emptyConfiguration = { version: 0, enabled: false, collection_interval_seconds: 60, discovery_interval_seconds: 900, networks: [] };
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const messageFrom = (error, fallback) => error?.response?.data?.error || error?.message || fallback;
const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não registrado';

const NetworkAgentIntegration = ({ companyId }) => {
  const [agents, setAgents] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [configuration, setConfiguration] = useState(emptyConfiguration);
  const [pairingCode, setPairingCode] = useState('');
  const [credential, setCredential] = useState({ name: '', version: '2c', community: '', username: '', security_level: 'authNoPriv', auth_protocol: 'SHA256', auth_password: '', privacy_protocol: 'AES128', privacy_password: '', context_name: '' });
  const [credentialIdBeingReplaced, setCredentialIdBeingReplaced] = useState('');
  const [networkDraft, setNetworkDraft] = useState({ cidr: '', snmp_port: '161', excluded_ips: '', credential_ids: [], network_scope_id: '' });
  const [scopeName, setScopeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [downloadUnavailable, setDownloadUnavailable] = useState(false);
  const [credentialError, setCredentialError] = useState('');
  const [credentialNotice, setCredentialNotice] = useState('');
  const activeRef = useRef(true);
  const companyPrefix = useMemo(() => adminPrefix(companyId || ''), [companyId]);
  const selectedAgent = agents.find((agent) => agent.id === agentId) || null;

  const loadCompanyData = useCallback(async (isActive = () => true) => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    try {
      const [agentsResponse, credentialsResponse, scopesResponse] = await Promise.all([
        api.get(`${companyPrefix}/network-agents`),
        api.get(`${companyPrefix}/snmp-credentials`),
        api.get(`${companyPrefix}/network-scopes`),
      ]);
      if (!isActive()) return;
      const nextAgents = Array.isArray(agentsResponse.data) ? agentsResponse.data : [];
      setAgents(nextAgents);
      setCredentials(Array.isArray(credentialsResponse.data) ? credentialsResponse.data : []);
      setScopes(Array.isArray(scopesResponse.data) ? scopesResponse.data : []);
      setAgentId((current) => nextAgents.some((agent) => agent.id === current) ? current : nextAgents[0]?.id || '');
    } catch (loadError) {
      if (isActive()) setError(messageFrom(loadError, 'Não foi possível carregar os agentes de rede.'));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [companyId, companyPrefix]);

  useEffect(() => {
    activeRef.current = companyId;
    setAgents([]);
    setCredentials([]);
    setScopes([]);
    setAgentId('');
    setConfiguration(emptyConfiguration);
    setPairingCode('');
    setCredentialIdBeingReplaced('');
    setError('');
    setNotice('');
    setCredential({ name: '', version: '2c', community: '', username: '', security_level: 'authNoPriv', auth_protocol: 'SHA256', auth_password: '', privacy_protocol: 'AES128', privacy_password: '', context_name: '' });
    loadCompanyData(() => activeRef.current === companyId);
    return () => { if (activeRef.current === companyId) activeRef.current = null; };
  }, [loadCompanyData, companyId]);

  useEffect(() => {
    if (!agentId || !companyId) {
      setConfiguration(emptyConfiguration);
      return undefined;
    }
    let active = true;
    setConfiguration(emptyConfiguration);
    api.get(`${companyPrefix}/network-agents/${encodeURIComponent(agentId)}/config`)
      .then((response) => { if (active) setConfiguration({ ...emptyConfiguration, ...response.data, networks: response.data?.networks || [] }); })
      .catch((loadError) => { if (active) setError(messageFrom(loadError, 'Não foi possível carregar a configuração do agente.')); });
    return () => { active = false; };
  }, [agentId, companyId, companyPrefix]);

  const refresh = () => loadCompanyData(() => activeRef.current === companyId);

  const claimAgent = async (event) => {
    event.preventDefault();
    const code = pairingCode.trim().toUpperCase();
    if (!code) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await api.post(`${companyPrefix}/network-agents/claim`, { code });
      setPairingCode('');
      setNotice(`Agente vinculado: ${response.data.hostname}.`);
      await refresh();
    } catch (claimError) {
      setError(messageFrom(claimError, 'Não foi possível vincular o agente. Confira o código e tente novamente.'));
    } finally { setSaving(false); }
  };

  const downloadPackage = async () => {
    setDownloadUnavailable(false); setError('');
    try {
      const response = await api.get('/admin/monitoring/network-agent/download', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'Inner.Network.Agent-win-x64.zip'; anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      if (downloadError.response?.status === 503) setDownloadUnavailable(true);
      else setError(messageFrom(downloadError, 'Não foi possível baixar o pacote do agente.'));
    }
  };

  const saveCredential = async (event) => {
    event.preventDefault();
    setCredentialError(''); setCredentialNotice('');
    const body = { name: credential.name.trim(), version: credential.version };
    if (credential.version === '2c') body.community = credential.community;
    else {
      body.username = credential.username.trim();
      body.security_level = credential.security_level;
      body.auth_protocol = credential.auth_protocol;
      body.auth_password = credential.auth_password;
      if (credential.security_level === 'authPriv') {
        body.privacy_protocol = credential.privacy_protocol;
        body.privacy_password = credential.privacy_password;
      }
      if (credential.context_name.trim()) body.context_name = credential.context_name.trim();
    }
    try {
      if (credentialIdBeingReplaced) await api.put(`${companyPrefix}/snmp-credentials/${encodeURIComponent(credentialIdBeingReplaced)}`, body);
      else await api.post(`${companyPrefix}/snmp-credentials`, body);
      setCredential({ name: '', version: '2c', community: '', username: '', security_level: 'authNoPriv', auth_protocol: 'SHA256', auth_password: '', privacy_protocol: 'AES128', privacy_password: '', context_name: '' });
      setCredentialIdBeingReplaced('');
      setCredentialNotice('Credencial salva. Os segredos foram removidos dos campos.');
      await refresh();
    } catch (saveError) { setCredentialError(messageFrom(saveError, 'Não foi possível cadastrar a credencial.')); }
  };

  const deleteCredential = async (id) => {
    setCredentialError(''); setCredentialNotice('');
    try { await api.delete(`${companyPrefix}/snmp-credentials/${encodeURIComponent(id)}`); await refresh(); }
    catch (deleteError) { setCredentialError(messageFrom(deleteError, 'Não foi possível remover a credencial.')); }
  };

  const revokeAgent = async () => {
    if (!selectedAgent) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api.post(`${companyPrefix}/network-agents/${encodeURIComponent(selectedAgent.id)}/revoke`);
      setNotice(`Coletor ${selectedAgent.hostname} revogado.`);
      await refresh();
    } catch (revokeError) { setError(messageFrom(revokeError, 'Não foi possível revogar o coletor.')); }
    finally { setSaving(false); }
  };

  const saveConfiguration = async (networks = configuration.networks, enabled = configuration.enabled) => {
    if (!selectedAgent) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await api.put(`${companyPrefix}/network-agents/${encodeURIComponent(selectedAgent.id)}/config`, {
        version: configuration.version,
        enabled,
        collection_interval_seconds: Number(configuration.collection_interval_seconds || 60),
        discovery_interval_seconds: Number(configuration.discovery_interval_seconds || 900),
        networks,
      });
      setConfiguration({ ...emptyConfiguration, ...response.data, networks: response.data?.networks || [] });
      setNotice('Configuração salva. O agente a aplicará no próximo contato.');
    } catch (saveError) { setError(messageFrom(saveError, 'Não foi possível salvar a configuração.')); }
    finally { setSaving(false); }
  };

  const addNetwork = (event) => {
    event.preventDefault();
    const cidr = networkDraft.cidr.trim();
    const match = cidr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
    const validOctets = match && match.slice(1, 5).every((part) => Number(part) <= 255 && String(Number(part)) === part);
    const prefix = match ? Number(match[5]) : -1;
    if (!match || !validOctets || prefix < 0 || prefix > 32) { setError('Informe um CIDR IPv4 válido, como 192.168.10.0/24.'); return; }
    const value = match.slice(1, 5).map(Number).reduce((result, octet) => ((result << 8) | octet) >>> 0, 0);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    if ((value & mask) >>> 0 !== value) { setError('O endereço de rede deve ter os bits de host zerados; use, por exemplo, 192.168.10.0/24.'); return; }
    if (Number(networkDraft.snmp_port) < 1 || Number(networkDraft.snmp_port) > 65535) { setError('A porta SNMP deve estar entre 1 e 65535.'); return; }
    if (configuration.networks.length >= 256) { setError('O limite de 256 redes por coletor foi atingido.'); return; }
    if (configuration.networks.some((network) => network.cidr === cidr)) { setError('Esta rede já está na configuração.'); return; }
    const network = { cidr, enabled: true, snmp_port: Number(networkDraft.snmp_port || 161), excluded_ips: networkDraft.excluded_ips.split(',').map((item) => item.trim()).filter(Boolean), credential_ids: networkDraft.credential_ids, ...(networkDraft.network_scope_id ? { network_scope_id: networkDraft.network_scope_id } : {}) };
    saveConfiguration([...configuration.networks, network], true);
    setNetworkDraft({ cidr: '', snmp_port: '161', excluded_ips: '', credential_ids: [], network_scope_id: '' });
  };

  const createScope = async () => {
    const name = scopeName.trim();
    if (!name) return;
    setError('');
    try {
      const response = await api.post(`${companyPrefix}/network-scopes`, { name });
      setScopes((current) => [...current, response.data]);
      setNetworkDraft((current) => ({ ...current, network_scope_id: response.data.id }));
      setScopeName('');
    } catch (scopeError) { setError(messageFrom(scopeError, 'Não foi possível criar o escopo físico.')); }
  };

  const toggleCredential = (id) => setNetworkDraft((current) => ({ ...current, credential_ids: current.credential_ids.includes(id) ? current.credential_ids.filter((item) => item !== id) : [...current.credential_ids, id] }));

  if (!companyId) return <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Selecione uma empresa para configurar o agente de rede.</section>;

  return (
    <section aria-labelledby="network-agent-title" onKeyDown={(event) => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault(); }} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="network-agent-title" className="flex items-center gap-2 text-base font-semibold text-slate-800"><Network size={18} className="text-blue-600" />Agente Inner de Rede</h3>
          <p className="mt-1 text-sm text-slate-500">Baixe o pacote Windows, instale na rede e vincule o código a esta empresa.</p>
        </div>
        <button type="button" onClick={downloadPackage} className={buttonClass}><Download size={16} />Baixar pacote Windows</button>
      </div>

      {downloadUnavailable && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">O pacote ainda não está disponível. Peça ao suporte para gerar e publicar o instalador do agente.</p>}
      {error && <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle size={17} className="mt-0.5 shrink-0" />{notice}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-800">Vincular coletor</h4>
            <label className="block text-sm font-medium text-slate-700">Código de vinculação
              <input aria-label="Código de vinculação" autoComplete="off" value={pairingCode} onChange={(event) => setPairingCode(event.target.value.toUpperCase())} placeholder="ABCD-EFGH-JKLM" className={`${inputClass} mt-1`} />
            </label>
            <button type="button" onClick={claimAgent} disabled={saving || pairingCode.trim().length < 14} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{saving && <LoaderCircle size={15} className="animate-spin" />}Vincular agente</button>
            <p className="text-xs text-slate-500">No Windows, extraia o ZIP, abra o instalador e copie o código exibido.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3"><h4 className="font-semibold text-slate-800">Coletores desta empresa</h4><button type="button" onClick={refresh} className={buttonClass} aria-label="Atualizar agentes"><RefreshCw size={15} />Atualizar</button></div>
            {loading ? <p className="text-sm text-slate-500">Carregando coletores…</p> : agents.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">Nenhum coletor vinculado. A lista de equipamentos visíveis na tela Rede não informa se um agente foi instalado.</p> : (
              <div className="space-y-2">
                {agents.map((agent) => {
                  const state = agent.status === 'Revoked' ? 'Revogado' : agent.status === 'Paused' ? 'Pausado' : agent.last_collection_result === 'failed' ? 'Erro na coleta' : agent.discovery_state === 'discovering' ? 'Descobrindo' : agent.discovery_state === 'awaiting_config' ? 'Aguardando configuração' : agent.status === 'Online' ? 'Online' : agent.status || 'Sem contato';
                  return <button type="button" key={agent.id} onClick={() => setAgentId(agent.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${agentId === agent.id ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <span className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-800">{agent.hostname}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{state}</span></span>
                    <span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500"><span>Versão: {agent.agent_version || '—'}</span><span>Equipamentos: {agent.device_count ?? 0}</span><span>Último contato: {formatDate(agent.last_heartbeat)}</span><span>Última descoberta: {formatDate(agent.last_discovery_at)}</span><span>Descoberta: {agent.discovery_state || 'Ainda não informada'}</span><span>Última coleta: {agent.last_collection_result || '—'}</span></span>
                  </button>;
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h4 className="flex items-center gap-2 font-semibold text-slate-800"><Shield size={16} className="text-slate-500" />Credenciais SNMP</h4>
          <label className="block text-sm font-medium text-slate-700">Nome da credencial<input aria-label="Nome da credencial" className={`${inputClass} mt-1`} value={credential.name} onChange={(event) => setCredential({ ...credential, name: event.target.value })} /></label>
          <label className="block text-sm font-medium text-slate-700">Versão
            <select value={credential.version} onChange={(event) => setCredential({ ...credential, version: event.target.value })} className={`${inputClass} mt-1`}><option value="2c">SNMP v2c</option><option value="3">SNMP v3</option></select>
          </label>
          {credential.version === '2c' ? <label className="block text-sm font-medium text-slate-700">Comunidade SNMP<input aria-label="Comunidade SNMP" type="password" autoComplete="new-password" className={`${inputClass} mt-1`} value={credential.community} onChange={(event) => setCredential({ ...credential, community: event.target.value })} /></label> : <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">Usuário SNMP<input className={`${inputClass} mt-1`} value={credential.username} onChange={(event) => setCredential({ ...credential, username: event.target.value })} /></label>
            <label className="block text-sm font-medium text-slate-700">Segurança<select value={credential.security_level} onChange={(event) => setCredential({ ...credential, security_level: event.target.value })} className={`${inputClass} mt-1`}><option value="authNoPriv">Autenticação, sem privacidade</option><option value="authPriv">Autenticação e privacidade</option></select></label>
            <label className="block text-sm font-medium text-slate-700">Protocolo de autenticação<select value={credential.auth_protocol} onChange={(event) => setCredential({ ...credential, auth_protocol: event.target.value })} className={`${inputClass} mt-1`}><option value="SHA1">SHA-1</option><option value="SHA256">SHA-256</option></select></label>
            <label className="block text-sm font-medium text-slate-700">Senha de autenticação<input type="password" autoComplete="new-password" className={`${inputClass} mt-1`} value={credential.auth_password} onChange={(event) => setCredential({ ...credential, auth_password: event.target.value })} /></label>
            {credential.security_level === 'authPriv' && <><label className="block text-sm font-medium text-slate-700">Protocolo de privacidade<select value={credential.privacy_protocol} onChange={(event) => setCredential({ ...credential, privacy_protocol: event.target.value })} className={`${inputClass} mt-1`}><option value="AES128">AES-128</option></select></label><label className="block text-sm font-medium text-slate-700">Senha de privacidade<input type="password" autoComplete="new-password" className={`${inputClass} mt-1`} value={credential.privacy_password} onChange={(event) => setCredential({ ...credential, privacy_password: event.target.value })} /></label></>}
            <label className="block text-sm font-medium text-slate-700">Contexto (opcional)<input className={`${inputClass} mt-1`} value={credential.context_name} onChange={(event) => setCredential({ ...credential, context_name: event.target.value })} /></label>
          </div>}
          {credentialError && <p role="alert" className="text-sm text-red-700">{credentialError}</p>}{credentialNotice && <p role="status" className="text-sm text-emerald-700">{credentialNotice}</p>}
          <button type="button" onClick={saveCredential} className={buttonClass} disabled={!credential.name.trim() || (credential.version === '2c' ? !credential.community : !credential.username || !credential.auth_password || credential.security_level === 'authPriv' && !credential.privacy_password)}><Plus size={15} />{credentialIdBeingReplaced ? 'Salvar substituição' : 'Salvar credencial'}</button>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {credentials.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong className="text-slate-700">{item.name}</strong><span className="ml-2 text-xs text-slate-500">SNMP {item.version}</span>{item.username && <span className="ml-2 text-xs text-slate-500">Usuário: {item.username}</span>}</span><span className="flex items-center gap-1"><button type="button" onClick={() => { setCredentialIdBeingReplaced(item.id); setCredential({ name: item.name, version: item.version, community: '', username: item.username || '', security_level: item.security_level || 'authNoPriv', auth_protocol: item.auth_protocol || 'SHA256', auth_password: '', privacy_protocol: item.privacy_protocol || 'AES128', privacy_password: '', context_name: '' }); setCredentialNotice('Informe o novo segredo. O valor atual não pode ser recuperado.'); }} className="rounded-md px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">Substituir</button><button type="button" aria-label={`Remover credencial ${item.name}`} onClick={() => deleteCredential(item.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={15} /></button></span></li>)}
            {!credentials.length && <li className="py-2 text-xs text-slate-500">Nenhuma credencial cadastrada. Segredos existentes não são exibidos.</li>}
          </ul>
        </div>
      </div>

      {selectedAgent && <div className="space-y-4 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-800">Redes de {selectedAgent.hostname}</h4><p className="mt-1 text-xs text-slate-500">Somente endereços de rede canônicos; exemplo: 192.168.10.0/24.</p></div><span className="text-xs text-slate-500">Configuração v{configuration.version || 0} · {configuration.enabled ? 'Ativa' : 'Pendente'}</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Intervalo de coleta (segundos)<input type="number" min="30" max="3600" className={`${inputClass} mt-1`} value={configuration.collection_interval_seconds} onChange={(event) => setConfiguration((current) => ({ ...current, collection_interval_seconds: event.target.value }))} /></label><label className="text-sm font-medium text-slate-700">Intervalo de descoberta (segundos)<input type="number" min="60" max="86400" className={`${inputClass} mt-1`} value={configuration.discovery_interval_seconds} onChange={(event) => setConfiguration((current) => ({ ...current, discovery_interval_seconds: event.target.value }))} /></label><button type="button" onClick={() => saveConfiguration()} disabled={saving || !configuration.networks.length} className={`${buttonClass} sm:col-span-2`}>Salvar intervalos e estado</button></div>
        <div className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">Rede IPv4 (CIDR)<input aria-label="Rede IPv4 (CIDR)" className={`${inputClass} mt-1`} placeholder="192.168.10.0/24" value={networkDraft.cidr} onChange={(event) => setNetworkDraft({ ...networkDraft, cidr: event.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700">Porta SNMP<input type="number" min="1" max="65535" className={`${inputClass} mt-1`} value={networkDraft.snmp_port} onChange={(event) => setNetworkDraft({ ...networkDraft, snmp_port: event.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700">IPs excluídos<input className={`${inputClass} mt-1`} placeholder="Separe por vírgula" value={networkDraft.excluded_ips} onChange={(event) => setNetworkDraft({ ...networkDraft, excluded_ips: event.target.value })} /></label>
          <label className="text-sm font-medium text-slate-700">Escopo físico compartilhado<select className={`${inputClass} mt-1`} value={networkDraft.network_scope_id} onChange={(event) => setNetworkDraft({ ...networkDraft, network_scope_id: event.target.value })}><option value="">Somente este coletor e esta rede</option>{scopes.map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}</select></label>
          <div className="space-y-2 text-sm text-slate-700"><span className="font-medium">Credenciais permitidas</span>{credentials.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm font-normal"><input type="checkbox" checked={networkDraft.credential_ids.includes(item.id)} onChange={() => toggleCredential(item.id)} />{item.name} · v{item.version}</label>)}{!credentials.length && <p className="text-xs text-slate-500">Cadastre uma credencial para habilitar consultas.</p>}</div>
          <div className="flex flex-wrap items-end gap-2"><button type="button" onClick={addNetwork} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Plus size={15} />Adicionar rede</button>{configuration.enabled ? <button type="button" disabled={saving} onClick={() => saveConfiguration(configuration.networks, false)} className={buttonClass}>Pausar configuração</button> : <button type="button" disabled={saving || !configuration.networks.length} onClick={() => saveConfiguration(configuration.networks, true)} className={buttonClass}>Retomar configuração</button>}<button type="button" disabled={saving || selectedAgent.status === 'Revoked'} onClick={revokeAgent} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Revogar coletor</button></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-700">Escopo compartilhado novo<input className={`${inputClass} mt-1 min-w-60`} value={scopeName} onChange={(event) => setScopeName(event.target.value)} placeholder="Filial ou local físico" /></label>
          <button type="button" onClick={createScope} disabled={!scopeName.trim()} className={`${buttonClass} mt-5`}>Criar escopo</button>
        </div>
        {configuration.networks.length > 0 ? <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">{configuration.networks.map((network, index) => <li key={network.id || `${network.cidr}-${index}`} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"><span className="font-medium text-slate-800">{network.cidr} <span className="font-normal text-slate-500">· UDP {network.snmp_port} · {network.credential_ids?.length || 0} credencial(is) · {network.enabled ? 'Ativa' : 'Pausada'}</span></span><button type="button" aria-label={`Remover rede ${network.cidr}`} onClick={() => saveConfiguration(configuration.networks.filter((_, itemIndex) => itemIndex !== index), configuration.enabled)} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={15} /></button></li>)}</ul> : <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">Nenhuma rede configurada para este coletor.</p>}
      </div>}
    </section>
  );
};

export default NetworkAgentIntegration;
