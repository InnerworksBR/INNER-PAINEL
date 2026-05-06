import React, { useState } from 'react';
import {
  Server,
  Search,
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  AlertCircle
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

const Servidores = () => {
  const { data: servers, loading, refresh } = useRealtimeData('/client/metrics/servers', 'servers', { intervalMs: 30000 });
  const { data: events, refresh: refreshEvents } = useRealtimeData('/client/metrics/servers/events', 'server_events', { intervalMs: 30000 });
  const [activeServerId, setActiveServerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const effectiveActiveServerId = activeServerId || servers[0]?.id || null;
  const activeServer = servers.find(s => s.id === effectiveActiveServerId) || null;
  const { data: history } = useRealtimeData(
    activeServer ? `/client/metrics/servers/${activeServer.id}/history` : '/client/metrics/servers',
    `server_history_${activeServer?.id || 'none'}`,
    { enabled: Boolean(activeServer), intervalMs: 30000 }
  );

  const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));

  // Dados dos gráficos baseados no servidor ativo
  const cpuData = activeServer ? [
    { name: 'Em Uso', value: clampPercent(activeServer.cpu_usage), color: '#3b82f6' },
    { name: 'Livre', value: 100 - clampPercent(activeServer.cpu_usage), color: '#e5e7eb' },
  ] : [];

  const memData = activeServer ? [
    { name: 'Em Uso', value: clampPercent(activeServer.memory_usage), color: '#8b5cf6' },
    { name: 'Livre', value: 100 - clampPercent(activeServer.memory_usage), color: '#e5e7eb' },
  ] : [];

  const filteredServers = servers.filter(s => 
    s.hostname.toLowerCase().includes(searchQuery.toLowerCase())
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
  const formatZabbixTime = (server) => {
    const value = server?.zabbix_last_data_at || server?.last_updated;
    return value ? new Date(value).toLocaleString('pt-BR') : '--';
  };
  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 font-medium">Monitorando infraestrutura...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-screen bg-gray-50/50">
      {/* PAINEL LATERAL DE SERVIDORES */}
      <div className="w-72 bg-white border-r border-gray-100 flex-shrink-0 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-gray-100">
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
          {filteredServers.map((server) => (
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
                    <h3 className="font-semibold text-sm text-gray-800">{server.hostname}</h3>
                    <p className="text-[10px] text-gray-500">Coleta Zabbix: {formatZabbixTime(server)}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${getStatusDotColor(server.status)}`}></div>
              </div>
              {server.zabbix_sync_warning && (
                <p className="text-[10px] text-amber-700 mb-2">{server.zabbix_sync_warning}</p>
              )}
              <div className="mt-2">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-gray-500">CPU: {server.cpu_usage}%</span>
                  <span className="text-gray-500">MEM: {server.memory_usage}%</span>
                </div>
                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                   <div className="bg-blue-500 h-full" style={{ width: `${clampPercent(server.cpu_usage)}%` }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Monitoramento de Servidores</h1>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full hover:bg-emerald-100 transition-colors"
          >
            <RefreshCw size={14} className="text-emerald-700" />
            <span className="text-xs font-medium text-emerald-700">Atualizar Zabbix</span>
          </button>
        </div>

        {activeServer ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* CPU Card */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <Cpu className="w-5 h-5 text-blue-500" /> Uso de CPU
                </h3>
                <div className="flex items-center justify-around">
                   <div className="relative w-24 h-24">
                      <ResponsiveContainer>
                        <RechartsPieChart>
                          <Pie data={cpuData} cx="50%" cy="50%" innerRadius={35} outerRadius={45} dataKey="value" stroke="none">
                            {cpuData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">{activeServer.cpu_usage}%</div>
                   </div>
                   <div className="text-sm text-gray-500">Status: <span className={`font-semibold ${activeServer.status === 'Online' ? 'text-emerald-600' : activeServer.status === 'Offline' ? 'text-red-600' : 'text-amber-700'}`}>{displayStatus(activeServer.status)}</span></div>
                </div>
                {activeServer.zabbix_sync_warning && (
                  <p className="mt-4 text-xs text-amber-700">{activeServer.zabbix_sync_warning}</p>
                )}
              </div>

              {/* Memory Card */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-purple-500" /> Uso de Memória
                </h3>
                <div className="flex items-center justify-around">
                   <div className="relative w-24 h-24">
                      <ResponsiveContainer>
                        <RechartsPieChart>
                          <Pie data={memData} cx="50%" cy="50%" innerRadius={35} outerRadius={45} dataKey="value" stroke="none">
                            {memData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                          </Pie>
                        </RechartsPieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">{activeServer.memory_usage}%</div>
                   </div>
                   <div className="text-sm text-gray-500 text-center">
                      <div className="font-semibold text-gray-800">
                        {formatGbPair(activeServer.memory_used, activeServer.memory_total)}
                      </div>
                      <div className="text-[10px]">{hasGbData(activeServer.memory_used, activeServer.memory_total) ? 'Utilizacao de RAM' : 'Dados parciais'}</div>
                   </div>
                </div>
              </div>

              {/* Disk Card */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <HardDrive className="w-5 h-5 text-indigo-500" /> Armazenamento
                </h3>
                 <div className="text-xs font-semibold text-indigo-600 mb-2">
                    {hasGbData(activeServer.disk_used, activeServer.disk_total) ? `${activeServer.disk_used || 0} GB usados de ${activeServer.disk_total || 0} GB` : 'Dados parciais'}
                 </div>
                 <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
                    <div className="bg-indigo-500 h-full" style={{ width: `${clampPercent(activeServer.disk_usage)}%` }}></div>
                 </div>
                 <div className="text-xs text-gray-400 mt-2">
                    Capacidade Total: {hasGbData(activeServer.disk_used, activeServer.disk_total) ? `${activeServer.disk_total || 0} GB` : '--'}
                 </div>
                 <div className="mt-4 text-[10px] text-gray-400 flex justify-between">
                    <span>Coleta Zabbix: {formatZabbixTime(activeServer)}</span>
                 </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Tendência Recente</h2>
                <p className="text-xs text-gray-500 mt-1">Histórico salvo a cada sincronização Zabbix para o servidor selecionado</p>
              </div>
              <div className="h-72 p-5">
                {history.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history.map((row) => ({ ...row, time: new Date(row.collected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="cpu_usage" name="CPU" stroke="#3b82f6" dot={false} />
                      <Line type="monotone" dataKey="memory_usage" name="Memória" stroke="#8b5cf6" dot={false} />
                      <Line type="monotone" dataKey="disk_usage" name="Disco" stroke="#6366f1" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400 text-center">
                    Ainda não há histórico suficiente. Execute pelo menos duas sincronizações para ver tendência.
                  </div>
                )}
              </div>
            </div>

            {/* Tabela de Inventário */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Eventos Recentes</h2>
                  <p className="text-xs text-gray-500 mt-1">Quedas e retornos detectados nas sincronizações do Zabbix</p>
                </div>
                <AlertCircle className="w-5 h-5 text-gray-400" />
              </div>
              <div className="divide-y divide-gray-100">
                {events.length > 0 ? events.slice(0, 8).map((event) => (
                  <div key={event.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${event.severity === 'critical' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{event.entity_name}</p>
                        <p className="text-xs text-gray-500 truncate">{event.message}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-gray-700">{event.previous_status || '-'} -&gt; {event.current_status}</p>
                      <p className="text-[10px] text-gray-400">{new Date(event.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                )) : (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    Nenhuma queda ou retorno registrado ainda. Os eventos aparecem quando o status muda entre sincronizações.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Todos os Servidores</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-6 py-4">Hostname</th>
                       <th className="px-6 py-4">CPU</th>
                       <th className="px-6 py-4">Memória (GB)</th>
                       <th className="px-6 py-4">Disco (GB)</th>
                       <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {servers.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-semibold">{s.hostname}</td>
                         <td className="px-6 py-4">{s.cpu_usage}%</td>
                         <td className="px-6 py-4 flex flex-col">
                            <span className="text-sm font-medium">{s.memory_usage}%</span>
                            <span className="text-[10px] text-gray-500">{formatGbPair(s.memory_used, s.memory_total)}</span>
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex flex-col">
                               <span className="text-sm font-medium">{s.disk_usage}%</span>
                               <span className="text-[10px] text-gray-500">{formatGbPair(s.disk_used, s.disk_total)}</span>
                            </div>
                         </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(s.status)}`}>
                            {displayStatus(s.status)}
                          </span>
                          {s.zabbix_sync_warning && (
                            <p className="mt-1 text-[10px] text-amber-700 max-w-48">{s.zabbix_sync_warning}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white p-12 rounded-xl border border-dashed border-gray-200 text-center text-gray-400">
             Nenhum servidor monitorado encontrado para esta empresa.
          </div>
        )}
      </div>
    </div>
  );
};

export default Servidores;
