import React, { useState } from 'react';
import {
  Server,
  Search,
  Settings,
  Bell,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useRealtimeData } from '../../../hooks/useRealtimeSubscription';

const Servidores = () => {
  const { data: servers, loading, refresh } = useRealtimeData('/client/metrics/servers', 'servers', { intervalMs: 30000 });
  const [activeServerId, setActiveServerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const effectiveActiveServerId = activeServerId || servers[0]?.id || null;
  const activeServer = servers.find(s => s.id === effectiveActiveServerId) || null;

  // Dados dos gráficos baseados no servidor ativo
  const cpuData = activeServer ? [
    { name: 'Em Uso', value: activeServer.cpu_usage, color: '#3b82f6' },
    { name: 'Livre', value: 100 - activeServer.cpu_usage, color: '#e5e7eb' },
  ] : [];

  const memData = activeServer ? [
    { name: 'Em Uso', value: activeServer.memory_usage, color: '#8b5cf6' },
    { name: 'Livre', value: 100 - activeServer.memory_usage, color: '#e5e7eb' },
  ] : [];

  const filteredServers = servers.filter(s => 
    s.hostname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'offline': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
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
                    <p className="text-[10px] text-gray-500">Última atualização: {new Date(server.last_updated).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${server.status === 'Online' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-gray-500">CPU: {server.cpu_usage}%</span>
                  <span className="text-gray-500">MEM: {server.memory_usage}%</span>
                </div>
                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                   <div className="bg-blue-500 h-full" style={{ width: `${server.cpu_usage}%` }}></div>
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
            onClick={refresh}
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
                   <div className="text-sm text-gray-500">Status: <span className="text-emerald-600 font-semibold">{activeServer.status}</span></div>
                </div>
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
                        {activeServer.memory_used || 0} GB / {activeServer.memory_total || 0} GB
                      </div>
                      <div className="text-[10px]">Utilização de RAM</div>
                   </div>
                </div>
              </div>

              {/* Disk Card */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
                  <HardDrive className="w-5 h-5 text-indigo-500" /> Armazenamento
                </h3>
                 <div className="text-xs font-semibold text-indigo-600 mb-2">
                    {activeServer.disk_used || 0} GB usados de {activeServer.disk_total || 0} GB
                 </div>
                 <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
                    <div className="bg-indigo-500 h-full" style={{ width: `${activeServer.disk_usage}%` }}></div>
                 </div>
                 <div className="text-xs text-gray-400 mt-2">
                    Capacidade Total: {activeServer.disk_total || 0} GB
                 </div>
                 <div className="mt-4 text-[10px] text-gray-400 flex justify-between">
                    <span>Atualizado: {new Date(activeServer.last_updated).toLocaleString()}</span>
                 </div>
              </div>
            </div>

            {/* Tabela de Inventário */}
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
                            <span className="text-[10px] text-gray-500">{s.memory_used}GB / {s.memory_total}GB</span>
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex flex-col">
                               <span className="text-sm font-medium">{s.disk_usage}%</span>
                               <span className="text-[10px] text-gray-500">{s.disk_used}GB / {s.disk_total}GB</span>
                            </div>
                         </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(s.status)}`}>
                            {s.status}
                          </span>
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
