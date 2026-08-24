import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Monitor,
  HardDrive,
  Network,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  MemoryStick,
  Globe,
  ShieldAlert,
  RefreshCw,
  Trash2,
  Calendar,
  Activity,
  Server,
} from 'lucide-react';
import api from '../../../services/api';

const AgenteDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    loadAgent();
  }, [id]);

  const loadAgent = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/agents/list');
      const found = (res.data || []).find((a) => a.id === id);
      if (!found) {
        setError('Agente não encontrado.');
      } else {
        setAgent(found);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar dados do agente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!window.confirm('Tem certeza que deseja remover este agente?')) return;
    try {
      await api.delete(`/admin/agents/${id}`);
      navigate('/admin/agentesAdmin');
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover agente.');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('pt-BR');
  };

  const getTimeSince = (date) => {
    if (!date) return '';
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'agora mesmo';
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} horas, ${minutes % 60} minutos`;
    return `${Math.floor(hours / 24)} dias`;
  };

  const isOnline = agent?.computed_status === 'Online';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/admin/agentesAdmin')}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
          Voltar para lista
        </button>
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <ShieldAlert size={20} />
          {error || 'Agente não encontrado.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/admin/agentesAdmin')}
            className="mt-1 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              {agent.agent_type === 'collector' ? (
                <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
                  <Network size={28} />
                </div>
              ) : (
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                  <HardDrive size={28} />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-semibold text-slate-800">{agent.hostname}</h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  {agent.agent_type === 'collector' ? 'Coletor de Rede' : 'Agente de Endpoint'}
                  {' • '}
                  {agent.companies?.name || 'Sem empresa'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              isOnline
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            {isOnline ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Offline
              </>
            )}
          </span>
          <button
            onClick={handleDeleteAgent}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Remover agente"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-xl border ${
        isOnline
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          {isOnline ? (
            <CheckCircle2 className="text-emerald-600" size={24} />
          ) : (
            <XCircle className="text-amber-600" size={24} />
          )}
          <div>
            <p className={`font-medium ${isOnline ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isOnline
                ? 'Agente está online e enviando métricas'
                : 'Agente offline - último contato há ' + getTimeSince(agent.last_heartbeat)}
            </p>
            <p className={`text-sm ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
              Último heartbeat: {formatDate(agent.last_heartbeat)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {['details', 'metrics', 'vms', 'events'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'vms' ? 'VMs' : tab === 'metrics' ? 'Métricas' : tab === 'events' ? 'Eventos' : 'Detalhes'}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informações Gerais */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Monitor size={20} className="text-blue-600" />
              Informações Gerais
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">ID</span>
                <span className="font-mono text-sm text-slate-800">{agent.id}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Asset Key</span>
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-800">
                  {agent.asset_key}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Empresa</span>
                <span className="text-slate-800">{agent.companies?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Tipo</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  agent.agent_type === 'collector'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {agent.agent_type === 'collector' ? 'Coletor SNMP' : 'Endpoint'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Versão do Agente</span>
                <span className="text-slate-800">{agent.agent_version || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">IP Address</span>
                <span className="text-slate-800">{agent.ip_address || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Sistema e Rede */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Globe size={20} className="text-purple-600" />
              Sistema e Rede
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Sistema Operacional</span>
                <span className="text-slate-800">{agent.os_info || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Hostname</span>
                <span className="text-slate-800">{agent.hostname || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">IP Local</span>
                <span className="text-slate-800">{agent.local_ip || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">MAC Address</span>
                <span className="font-mono text-xs text-slate-800">{agent.mac_address || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-500">Host do Coletor</span>
                <span className="text-slate-800">{agent.collector_host || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">Registrado em</span>
                <span className="text-slate-800">{formatDate(agent.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-emerald-600" />
              Histórico
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Activity size={16} />
                </div>
                <div>
                  <p className="font-medium text-slate-800">Último Heartbeat</p>
                  <p className="text-sm text-slate-500">{formatDate(agent.last_heartbeat)}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="font-medium text-slate-800">Data de Registro</p>
                  <p className="text-sm text-slate-500">{formatDate(agent.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'metrics' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-blue-600" />
            Última Métrica Coletada
          </h3>
          {agent.last_metric_at ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Cpu size={16} />
                  <span className="text-xs uppercase">CPU</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {agent.last_cpu_percent != null ? `${agent.last_cpu_percent}%` : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <MemoryStick size={16} />
                  <span className="text-xs uppercase">RAM</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {agent.last_ram_percent != null ? `${agent.last_ram_percent}%` : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <HardDrive size={16} />
                  <span className="text-xs uppercase">Disco</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {agent.last_disk_percent != null ? `${agent.last_disk_percent}%` : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                  <Clock size={16} />
                  <span className="text-xs uppercase">Coletado em</span>
                </div>
                <p className="text-sm font-medium text-slate-800">
                  {formatDate(agent.last_metric_at)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              Nenhuma métrica coletada ainda.
            </div>
          )}
        </div>
      )}

      {activeTab === 'vms' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Server size={20} className="text-purple-600" />
              Máquinas Virtuais Associadas
            </h3>
          </div>
          {agent.vms && agent.vms.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="p-4">Nome</th>
                  <th className="p-4">vCPU</th>
                  <th className="p-4">Memória</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agent.vms.map((vm, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-4 font-medium text-slate-800">{vm.name}</td>
                    <td className="p-4 text-slate-600">{vm.vcpu || 'N/A'}</td>
                    <td className="p-4 text-slate-600">{vm.memory || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        vm.state === 'Running'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {vm.state || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-400">
              Nenhuma VM associada a este agente.
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-amber-600" />
            Histórico de Eventos
          </h3>
          <div className="text-center py-8 text-slate-400">
            Histórico de eventos em desenvolvimento.
          </div>
        </div>
      )}
    </div>
  );
};

export default AgenteDetalhe;
