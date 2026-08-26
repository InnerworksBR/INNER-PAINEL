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
  Radio,
  Wifi,
  WifiOff,
  Clock,
  TrendingUp
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

  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          text: 'text-emerald-700',
          dot: 'bg-emerald-500',
          icon: CheckCircle2
        };
      case 'offline':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-700',
          dot: 'bg-red-500',
          icon: XCircle
        };
      case 'atencao':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          text: 'text-amber-700',
          dot: 'bg-amber-500',
          icon: Wifi
        };
      default:
        return {
          bg: 'bg-neutral-50',
          border: 'border-neutral-200',
          text: 'text-neutral-700',
          dot: 'bg-neutral-500',
          icon: WifiOff
        };
    }
  };

  const formatLastUpdate = (server) => {
    const value = server?.last_updated || server?.last_heartbeat;
    return value ? new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }) : '--';
  };

  const getMonitoringBadge = (server) => {
    if (server.monitoring_source === 'agent_native') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-md font-medium border border-blue-100">
          <Radio size={10} />
          Agente
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] rounded-md font-medium border border-neutral-200">
        <Monitor size={10} />
        Manual
      </span>
    );
  };

  const onlineCount = servers.filter(s => s.status === 'Online').length;
  const offlineCount = servers.filter(s => s.status === 'Offline').length;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-neutral-200 rounded-xl w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-neutral-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen" style={{ background: '#fafaf9' }}>
      {/* Server List Panel */}
      <div
        className="w-80 bg-white border-r border-neutral-200/60 flex-shrink-0 flex flex-col hidden lg:flex
          shadow-sm"
      >
        <div className="p-5 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-neutral-900 text-lg">Servidores</h2>
            <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
              {filteredServers.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar servidor..."
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm
                focus:outline-none focus:border-emerald-500/50 focus:bg-white transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredServers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-neutral-300" />
              </div>
              <p className="text-sm font-medium text-neutral-600">Nenhum servidor encontrado</p>
              <p className="text-xs text-neutral-400 mt-1">Instale o agente Inner nos servidores</p>
            </div>
          ) : (
            filteredServers.map((server) => {
              const statusConfig = getStatusConfig(server.status);
              return (
                <div
                  key={server.id}
                  onClick={() => setActiveServerId(server.id)}
                  className={`group p-4 rounded-xl cursor-pointer transition-all duration-200 border
                    ${effectiveActiveServerId === server.id
                      ? 'bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200 shadow-sm'
                      : 'bg-white border-transparent hover:bg-neutral-50 hover:border-neutral-200'
                    }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${statusConfig.bg} ${statusConfig.border}`}
                      >
                        <Server size={18} className={statusConfig.text} />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailServer(server);
                          }}
                          className="font-semibold text-sm text-neutral-900 hover:text-emerald-600 transition-colors text-left"
                        >
                          {server.hostname}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5">
                          {getMonitoringBadge(server)}
                        </div>
                      </div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.dot}`}
                      style={server.status === 'Online' ? { boxShadow: '0 0 8px currentColor' } : {}}
                    />
                  </div>

                  {/* Mini stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Cpu size={10} className="text-blue-500" />
                        <span className="text-[10px] text-neutral-500">CPU</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-neutral-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${clampPercent(server.cpu_usage)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-neutral-700">{server.cpu_usage}%</span>
                      </div>
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <HardDrive size={10} className="text-purple-500" />
                        <span className="text-[10px] text-neutral-500">MEM</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-neutral-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-purple-500 transition-all"
                            style={{ width: `${clampPercent(server.memory_usage)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-neutral-700">{server.memory_usage}%</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-neutral-400 mt-2">
                    Atualizado: {formatLastUpdate(server)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600" />
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Monitor de Servidores</h1>
            </div>
            <p className="text-neutral-500 ml-3.5 text-sm">Monitoramento em tempo real via Agente Inner</p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              bg-white border border-neutral-200 text-neutral-700
              hover:bg-neutral-50 hover:border-neutral-300 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-neutral-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 font-medium">Total</p>
                <p className="text-2xl font-bold text-neutral-900">{servers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-neutral-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 font-medium">Online</p>
                <p className="text-2xl font-bold text-emerald-600">{onlineCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-neutral-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 font-medium">Offline</p>
                <p className="text-2xl font-bold text-red-600">{offlineCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-neutral-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 font-medium">Atenção</p>
                <p className="text-2xl font-bold text-amber-600">
                  {servers.filter(s => s.status === 'Atencao').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Server Details */}
        {activeServer ? (
          <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
            {/* Server Header */}
            <div className="p-6 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getStatusConfig(activeServer.status).bg} border ${getStatusConfig(activeServer.status).border}`}>
                    <Server size={28} className={getStatusConfig(activeServer.status).text} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900">{activeServer.hostname}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      {getMonitoringBadge(activeServer)}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusConfig(activeServer.status).bg} ${getStatusConfig(activeServer.status).text} border ${getStatusConfig(activeServer.status).border}`}>
                        {activeServer.status}
                      </span>
                      <span className="text-xs text-neutral-400 flex items-center gap-1">
                        <Clock size={12} />
                        {formatLastUpdate(activeServer)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-neutral-700 mb-4">Métricas em Tempo Real</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* CPU */}
                <div className="bg-gradient-to-br from-blue-50/50 to-blue-50/20 rounded-2xl p-5 border border-blue-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Cpu size={16} className="text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-neutral-700">CPU</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600">{activeServer.cpu_usage}%</span>
                  </div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={cpuData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {cpuData.map((entry, index) => (
                            <Cell key={`cpu-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Memory */}
                <div className="bg-gradient-to-br from-purple-50/50 to-purple-50/20 rounded-2xl p-5 border border-purple-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <HardDrive size={16} className="text-purple-600" />
                      </div>
                      <span className="text-sm font-semibold text-neutral-700">Memória</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-600">{activeServer.memory_usage}%</span>
                  </div>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={memData}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={50}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {memData.map((entry, index) => (
                            <Cell key={`mem-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-neutral-500 text-center mt-2">
                    {activeServer.memory_usage || 0} GB / {activeServer.memory_total || 0} GB
                  </p>
                </div>

                {/* Disk */}
                <div className="bg-gradient-to-br from-emerald-50/50 to-emerald-50/20 rounded-2xl p-5 border border-emerald-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <HardDrive size={16} className="text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold text-neutral-700">Disco</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">{activeServer.disk_usage || 0}%</span>
                  </div>
                  <div className="mt-4">
                    <div className="w-full bg-neutral-100 rounded-full h-3">
                      <div
                        className="h-3 rounded-full transition-all duration-500"
                        style={{
                          width: `${clampPercent(activeServer.disk_usage)}%`,
                          background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                        }}
                      />
                    </div>
                    <p className="text-xs text-neutral-500 mt-2">
                      {activeServer.disk_usage || 0} GB / {activeServer.disk_total || 0} GB
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* History Chart */}
            {history && history.length > 0 && (
              <div className="p-6 border-t border-neutral-100">
                <h3 className="text-sm font-semibold text-neutral-700 mb-4">Histórico de Métricas</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
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
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Line type="monotone" dataKey="cpu_usage" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU %" />
                      <Line type="monotone" dataKey="memory_usage" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Memória %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <Server className="w-10 h-10 text-neutral-300" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-700 mb-2">Nenhum servidor selecionado</h3>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">
              Selecione um servidor na lista ao lado ou instale o agente Inner para começar o monitoramento.
            </p>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
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
