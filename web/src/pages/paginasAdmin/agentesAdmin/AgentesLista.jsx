import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  Radio,
  HardDrive,
  Network,
  RefreshCw,
  Trash2,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Monitor,
  ShieldAlert,
  ChevronRight,
  Plus,
} from 'lucide-react';
import api from '../../../services/api';

const AgentesLista = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

  const loadAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/agents/list');
      setAgents(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar agentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleDeleteAgent = async (agentId) => {
    if (!window.confirm('Tem certeza que deseja remover este agente registrado?')) return;
    try {
      await api.delete(`/admin/agents/${agentId}`);
      loadAgents();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover agente.');
    }
  };

  const formatHeartbeat = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString('pt-BR');
  };

  const getTimeSinceHeartbeat = (date) => {
    if (!date) return '';
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  // Estatísticas
  const totalAgents = agents.length;
  const onlineCount = agents.filter((a) => a.computed_status === 'Online').length;
  const endpoints = agents.filter((a) => a.agent_type === 'endpoint').length;
  const collectors = agents.filter((a) => a.agent_type === 'collector').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            <Radio className="text-blue-600" size={28} />
            Lista de Agentes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitore todos os agentes e coletores registrados no sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAgents}
            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={() => setIsTokenModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
          >
            <Plus size={18} />
            Gerar Token
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <ShieldAlert size={18} />
          {error}
        </div>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Total de Agentes</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalAgents}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Cpu size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Online</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{onlineCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Endpoints</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{endpoints}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <HardDrive size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">Coletores</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{collectors}</h3>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Network size={24} />
          </div>
        </div>
      </div>

      {/* Tabela de Agentes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Agentes Registrados</h2>
            <p className="text-slate-500 text-xs mt-0.5">Clique em um agente para ver detalhes.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4">Hostname</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Empresa</th>
                <th className="p-4">IP / SO</th>
                <th className="p-4">Status</th>
                <th className="p-4">Último Heartbeat</th>
                <th className="p-4">Versão</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhum agente registrado.
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/agente/${agent.id}`)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {agent.agent_type === 'collector' ? (
                          <Network className="text-purple-600" size={18} />
                        ) : (
                          <HardDrive className="text-blue-600" size={18} />
                        )}
                        <span className="font-medium text-slate-800">{agent.hostname}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-semibold ${
                          agent.agent_type === 'collector'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {agent.agent_type === 'collector' ? 'Coletor' : 'Endpoint'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-700">
                      {agent.companies?.name || 'N/A'}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      <div>{agent.ip_address || 'N/A'}</div>
                      <div className="truncate max-w-[140px] text-slate-400">{agent.os_info || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      {agent.computed_status === 'Online' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          Offline
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-xs text-slate-500">{formatHeartbeat(agent.last_heartbeat)}</div>
                      <div className="text-xs text-slate-400">{getTimeSinceHeartbeat(agent.last_heartbeat)}</div>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {agent.agent_version || 'N/A'}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/agente/${agent.id}`)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Ver detalhes"
                        >
                          <Monitor size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Excluir agente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgentesLista;
