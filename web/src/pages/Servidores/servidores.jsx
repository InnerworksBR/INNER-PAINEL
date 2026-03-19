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

const Servidores = () => {
  const [activeServer, setActiveServer] = useState('SRV-PROD-01');
  const [searchQuery, setSearchQuery] = useState('');

  // Lista de servidores para a barra lateral
  const sideServers = [
    { id: 'SRV-PROD-01', ip: '192.168.1.50', status: 'operational', cpu: 42 },
    { id: 'SRV-DB-02', ip: '192.168.1.52', status: 'operational', cpu: 68 },
    { id: 'SRV-WEB-01', ip: '192.168.1.10', status: 'alert', cpu: 88 },
  ];

  // Dados dos gráficos circulares
  const cpuData = [
    { name: 'Em Uso', value: 42, color: '#3b82f6' },
    { name: 'Livre', value: 58, color: '#e5e7eb' },
  ];

  const memData = [
    { name: 'Em Uso', value: 44, color: '#8b5cf6' },
    { name: 'Livre', value: 56, color: '#e5e7eb' },
  ];

  // Dados de tráfego de rede (Entrada e Saída)
  const networkData = [
    { time: '10:00', in: 120, out: 80 },
    { time: '10:05', in: 150, out: 90 },
    { time: '10:10', in: 180, out: 110 },
    { time: '10:15', in: 130, out: 85 },
    { time: '10:20', in: 250, out: 140 },
    { time: '10:25', in: 380, out: 190 },
    { time: 'Agora', in: 420, out: 210 },
  ];

  // Inventário completo
  const inventory = [
    { id: 'SRV-APP-01', model: 'Dell PowerEdge R740', cpu: 22, mem: 45, disk: 32, status: 'Operacional', contract: 'CT-2026-038' },
    { id: 'SRV-DB-01', model: 'HPE ProLiant DL380', cpu: 55, mem: 72, disk: 65, status: 'Operacional', contract: 'CT-2025-189' },
    { id: 'SRV-WEB-01', model: 'Dell PowerEdge R640', cpu: 88, mem: 65, disk: 45, status: 'Atenção', contract: 'CT-2026-038' },
  ];

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'operacional': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'atenção': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'alert': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getStatusDot = (status) => {
    return status === 'operational' ? 'bg-emerald-500' : 'bg-red-500';
  };

  return (
    <div className="flex h-full min-h-screen bg-gray-50/50">

      {/* PAINEL LATERAL DE SERVIDORES (Inner Sidebar) */}
      <div className="w-72 bg-white border-r border-gray-100 flex-shrink-0 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar servidor..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sideServers.map((server) => (
            <div
              key={server.id}
              onClick={() => setActiveServer(server.id)}
              className={`p-3 rounded-lg cursor-pointer transition-all border ${activeServer === server.id
                ? 'bg-blue-50 border-blue-100 shadow-sm'
                : 'bg-white border-transparent hover:bg-gray-50'
                }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white rounded shadow-sm border border-gray-100">
                    <Server className={`w-4 h-4 ${activeServer === server.id ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold text-sm ${activeServer === server.id ? 'text-blue-800' : 'text-gray-800'}`}>
                      {server.id}
                    </h3>
                    <p className="text-xs text-gray-500 font-mono">IP: {server.ip}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${getStatusDot(server.status)} ring-2 ring-white`}></div>
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">CPU</span>
                  <span className="font-medium text-gray-700">{server.cpu}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full ${server.status === 'alert' ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${server.cpu}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ÁREA PRINCIPAL DO DASHBOARD */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <span>Gestão de TI</span>
              <ChevronRight className="w-3.5 h-3.5 mx-1" />
              <span className="text-gray-800 font-medium">Servidores</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Monitoramento de Servidores</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-medium text-emerald-700">Sincronizado em tempo real</span>
            </div>
            <button className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Indicadores do Selecionado e Disco */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* CPU Card */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-500" />
                Uso de CPU
              </h3>
            </div>
            <div className="flex justify-between items-center">
              <div className="relative w-24 h-24">
                <ResponsiveContainer>
                  <RechartsPieChart>
                    <Pie data={cpuData} cx="50%" cy="50%" innerRadius={35} outerRadius={45} dataKey="value" stroke="none">
                      {cpuData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-800">42%</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm text-right">
                <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <span className="text-gray-500">Cores:</span> <span className="font-semibold text-gray-800">16</span>
                </div>
                <div className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                  <span className="text-gray-500">Freq:</span> <span className="font-semibold text-gray-800">3.2 GHz</span>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Card */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-500" />
                Uso de Memória
              </h3>
            </div>
            <div className="flex justify-between items-center mb-1">
              <div className="text-xl font-bold text-gray-800">28.4 GB</div>
              <div className="text-sm font-medium text-gray-500">/ 64 GB</div>
            </div>

            <div className="flex gap-4 items-center">
              <div className="relative w-20 h-20">
                <ResponsiveContainer>
                  <RechartsPieChart>
                    <Pie data={memData} cx="50%" cy="50%" innerRadius={28} outerRadius={38} dataKey="value" stroke="none">
                      {memData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-800">44%</span>
                </div>
              </div>

              <div className="flex-1 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Swap:</span>
                  <span className="font-semibold text-gray-700">2 GB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cache:</span>
                  <span className="font-semibold text-gray-700">12 GB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Espaço em Disco & Uptime */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <HardDrive className="w-5 h-5 text-indigo-500" />
              Espaço em Disco
            </h3>

            <div className="mb-2 flex justify-between items-end">
              <span className="text-2xl font-bold text-gray-800">78%</span>
              <span className="text-sm text-gray-500 mb-1">3.2 TB livre de 4 TB</span>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mb-6">
              <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: '78%' }}></div>
            </div>

            <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <span className="text-gray-500 block text-xs">System Uptime</span>
                  <span className="font-semibold text-gray-800">14d 06h 22m</span>
                </div>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                Reiniciar Monitoramento
              </button>
            </div>
          </div>
        </div>

        {/* Gráfico de Rede */}
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-100 shadow-sm mb-6 hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Tráfego de Rede (Mbps)</h2>
              <p className="text-sm text-gray-500"> Monitoramento em tempo real</p>
            </div>
              
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networkData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="in"
                  name="Entrada"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="out"
                  name="Saída"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabela de Inventário */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Inventário de Servidores</h2>
            <div className="text-sm text-gray-500 font-medium">Total: {inventory.length}</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100 font-medium">
                  <th className="px-6 py-4">Servidor</th>
                  <th className="px-6 py-4">Fabricante/Modelo</th>
                  <th className="px-6 py-4">CPU</th>
                  <th className="px-6 py-4">Memória</th>
                  <th className="px-6 py-4">Disco</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Contrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {inventory.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50/50 transition-colors group cursor-default">
                    <td className="px-6 py-4 font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                        {item.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{item.model}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${item.cpu > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${item.cpu}%` }}></div>
                        </div>
                        <span className={`w-8 text-right ${item.cpu > 80 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{item.cpu}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${item.mem > 85 ? 'bg-amber-500' : 'bg-purple-500'}`} style={{ width: `${item.mem}%` }}></div>
                        </div>
                        <span className={`w-8 text-right text-gray-600`}>{item.mem}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${item.disk}%` }}></div>
                        </div>
                        <span className="w-8 text-right text-gray-600">{item.disk}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(item.status)}`}>
                        {item.status === 'Operacional' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {item.status === 'Atenção' && <AlertCircle className="w-3.5 h-3.5" />}
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{item.contract}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Servidores;