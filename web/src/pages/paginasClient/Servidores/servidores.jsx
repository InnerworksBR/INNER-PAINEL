import React, { useState } from 'react';
import {
  Server,
  Search,
  Cpu,
  HardDrive,
  RefreshCw,
  Monitor,
  CheckCircle2,
  XCircle,
  Radio
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { useRealtimeData } from '../../../hooks/useRealtimeSubscription';
import AssetDetailDrawer from '../../../components/AssetDetailDrawer';

const Servidores = () => {
  const { data: servers, loading, refresh } = useRealtimeData('/client/metrics/servers', 'servers', { intervalMs: 30000 });
  const { data: events, refresh: refreshEvents } = useRealtimeData('/client/metrics/servers/events', 'server_events', { intervalMs: 30000 });
  const [activeServerId, setActiveServerId] = useState(null);
  const [detailServer, setDetailServer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const effectiveActiveServerId = activeServerId || servers[0]?.id || null;
  const activeServer = servers.find(s => s.id === effectiveActiveServerId) || null;
  const { data: history } = useRealtimeData(
    activeServer ? `/client/metrics/servers/${activeServer.id}/history` : '/client/metrics/servers',
    `server_history_${activeServer?.id || 'none'}`,
    { enabled: Boolean(activeServer), intervalMs: 30000 }
  );

  const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));

  // Dados dos graficos baseados no servidor ativo
  const cpuData = activeServer ? [
    { name: 'Em Uso', value: clampPercent(activeServer.cpu_usage), color: '#3b82f6' },
    { name: 'Livre', value: 100 - clampPercent(activeServer.cpu_usage), color: '#e5e7eb' },
  ] : [];

  const memData = activeServer ? [
    { name: 'Em Uso', value: clampPercent(activeServer.memory_usage), color: '#8b5cf6' },
    { name: 'Livre', value: 100 - clampPercent(activeServer.memory_usage), color: '#e5e7eb' },
  ] : [];

  const filteredServers = servers.filter(s =>
    s.hostname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    refresh();
    refreshEvents();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'offline': return 'bg-red-50 text-red-600 border-red-100';
      case 'atencao': return 'bg-amber-50 text-amber-700 border-amber-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getStatusDotColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-emerald-500';
      case 'offline': return 'bg-red-500';
      case 'atencao': return 'bg-amber-500';
      default: return 'bg-gray-400';
    }
  };

  const displayStatus = (status) => status === 'Atencao' ? 'Atencao' : status;
  const hasGbData = (used, total) => Number(used) > 0 || Number(total) > 0;
  const formatGbPair = (used, total) => hasGbData(used, total) ? `${used || 0} GB / ${total || 0} GB` : '--';

  // Formatar tempo da ultima coleta
  const formatLastUpdate = (server) => {
    const value = server?.last_updated || server?.last_heartbeat;
    return value ? new Date(value).toLocaleString('pt-BR') : '--';
  };

  // Obter badge da fonte de monitoramento
  const getMonitoringBadge = (server) => {
    if (server.monitoring_source === 'agent_native') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] rounded font-medium">
          <Radio size={8} />
          Agente
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] rounded font-medium">
        <Monitor size={8} />
        Manual
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 font-medium">Carregando servidores...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50/50">
      {/* PAINEL LATERAL DE SERVIDORES */}
      <div className="w-72 bg-white border-r border-gray-100 flex-shrink-0 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-800 text-sm">Servidores</h2>
            <span className="text-xs text-gray-500">{filteredServers.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar servidor..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {filteredServers.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum servidor encontrado</p>
              <p className="text-xs mt-1">Instale o agente Inner nos servidores</p>
            </div>
          ) : (
            filteredServers.map((server) => (
              <div
                key={server.id}
                onClick={() => setActiveServerId(server.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${effectiveActiveServerId === server.id
                  ? 'bg-blue-50 border-blue-100 shadow-sm'
                  : 'bg-white border-transparent hover:bg-gray-50'
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Server className={`w-4 h-4 ${effectiveActiveServerId === server.id ? 'text-blue-600' : 'text-gray-500'}`} />
                    <div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDetailServer(server);
                        }}
                        className="font-semibold text-sm text-gray-800 hover:text-blue-600 text-left"
                      >
                        {server.hostname}
                      </button>
                      <div className="flex items-center gap-1 mt-0.5">
                        {getMonitoringBadge(server)}
                        <span className="text-[10px] text-gray-400">
                          {formatLastUpdate(server)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${getStatusDotColor(server.status)}`}></div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-500">CPU: {server.cpu_usage}%</span>
                    <span className="text-gray-500">MEM: {server.memory_usage}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full transition-all"
                      style={{ width: `${clampPercent(server.cpu_usage)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AREA PRINCIPAL */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Monitor de Servidores</h1>
            <p className="text-sm text-gray-500">Monitoramento em tempo real via Agente Inner</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total de Servidores</p>
                <p className="text-2xl font-bold text-gray-800">{servers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Online</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {servers.filter(s => s.status === 'Online').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 rounded-lg">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Offline</p>
                <p className="text-2xl font-bold text-red-600">
                  {servers.filter(s => s.status === 'Offline').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Servidor Ativo */}
        {activeServer ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header do Servidor */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${getStatusColor(activeServer.status)}`}>
                  <Server size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{activeServer.hostname}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    {getMonitoringBadge(activeServer)}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activeServer.status)}`}>
                      {displayStatus(activeServer.status)}
                    </span>
                    <span className="text-xs text-gray-400">
                      Ultima atualizacao: {formatLastUpdate(activeServer)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metricas */}
            <div className="p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Metricas em Tempo Real</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CPU */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">CPU</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">{activeServer.cpu_usage}%</span>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <RechartsPieChart>
                      <Pie
                        data={cpuData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {cpuData.map((entry, index) => (
                          <Cell key={`cpu-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                {/* Memoria */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-gray-700">Memoria</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-600">{activeServer.memory_usage}%</span>
                  </div>
                  <ResponsiveContainer width="100%" height={100}>
                    <RechartsPieChart>
                      <Pie
                        data={memData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {memData.map((entry, index) => (
                          <Cell key={`mem-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    {activeServer.memory_usage || 0} GB / {activeServer.memory_total || 0} GB
                  </p>
                </div>

                {/* Disco */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-emerald-600" />
                      <span className="text-sm font-medium text-gray-700">Disco</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">{activeServer.disk_usage || 0}%</span>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-emerald-500 h-3 rounded-full transition-all"
                        style={{ width: `${clampPercent(activeServer.disk_usage)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formatGbPair(activeServer.disk_usage, activeServer.disk_total)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Historico */}
            {history && history.length > 0 && (
              <div className="p-6 border-t border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-4">Historico de Metricas</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="created_at"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      stroke="#9ca3af"
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString('pt-BR')}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Line type="monotone" dataKey="cpu_usage" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU %" />
                    <Line type="monotone" dataKey="memory_usage" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memoria %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Server className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhum servidor selecionado</h3>
            <p className="text-gray-500 text-sm">
              Selecione um servidor na lista ao lado ou instale o agente Inner para comecar o monitoramento.
            </p>
          </div>
        )}
      </div>

      {/* Drawer de Detalhes */}
      {detailServer && (
        <AssetDetailDrawer
          asset={detailServer}
          onClose={() => setDetailServer(null)}
        />
      )}
    </div>
  );
};

export default Servidores;
