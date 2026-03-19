import { Activity, CheckCircle, Clock, Server } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const trafficData = [
  { time: "00:00", entrada: 250, saida: 150 },
  { time: "06:00", entrada: 300, saida: 200 },
  { time: "12:00", entrada: 800, saida: 600 },
  { time: "18:00", entrada: 750, saida: 500 },
  { time: "20:00", entrada: 400, saida: 300 },
];

const inventario = [
  { equipamento: "Cisco Catalyst 9300 - Core", tipo: "Switch Core", localizacao: "Datacenter Principal", uptime: "99.98%", status: "Operacional", contrato: "CT-2025-189" },
  { equipamento: "Meraki MX100", tipo: "Gateway SD-WAN", localizacao: "Filial SP", uptime: "99.95%", status: "Operacional", contrato: "CT-2026-012" },
  { equipamento: "Aruba AP-515", tipo: "Access Point", localizacao: "Sede - Andar 1", uptime: "99.91%", status: "Operacional", contrato: "CT-2026-067" },
  { equipamento: "Fortinet FortiGate 200F", tipo: "Firewall", localizacao: "Filial BH", uptime: "99.96%", status: "Operacional", contrato: "CT-2026-089" },
];

const Rede = () => {
  return (
    <div className="p-8 pb-16 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Rede</h1>
        <p className="text-slate-500 mt-2">Gerenciamento de infraestrutura de rede e contratos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Metric Cards */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Equipamentos Ativos</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Server size={20} />
            </div>
          </div>
          <div>
            <span className="text-3xl font-bold text-slate-800">8</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Operacionais</h3>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle size={20} />
            </div>
          </div>
          <div>
            <span className="text-3xl font-bold text-slate-800">7</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Uptime Médio</h3>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Clock size={20} />
            </div>
          </div>
          <div>
            <span className="text-3xl font-bold text-slate-800">99,6%</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Mbps Médio Atual</h3>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Activity size={20} />
            </div>
          </div>
          <div>
            <span className="text-3xl font-bold text-slate-800">650</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Area Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Tráfego de Rede (últimas 24h)</h2>
          <div className="h-80 select-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={15} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dx={-10} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#0f172a', fontWeight: '600', marginBottom: '8px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area type="monotone" dataKey="entrada" name="Tráfego de Entrada" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEntrada)" activeDot={{ r: 6, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="saida" name="Tráfego de Saída" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorSaida)" activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Inventário de Equipamentos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
                  <th className="px-6 py-4 whitespace-nowrap">Equipamento</th>
                  <th className="px-6 py-4 whitespace-nowrap">Tipo</th>
                  <th className="px-6 py-4 whitespace-nowrap">Localização</th>
                  <th className="px-6 py-4 whitespace-nowrap">Uptime (30d)</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap">Contrato</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
                {inventario.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{item.equipamento}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.tipo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.localizacao}</td>
                    <td className="px-6 py-4 text-emerald-600 font-medium whitespace-nowrap">{item.uptime}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">{item.contrato}</td>
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

export default Rede;