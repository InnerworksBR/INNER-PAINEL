import React from 'react';
import { Users, Activity, Clock, Server, AlertTriangle, Monitor, Cloud, Network, FileText, CheckCircle, Ticket, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useRealtimeData } from '../../../hooks/useRealtimeSubscription';
import { useClientPortalPath } from '../../../context/ClientPreviewContext';

const DashboardGeral = () => {
  const navigate = useNavigate();
  const portalPath = useClientPortalPath();
  const { data, loading, refresh } = useRealtimeData('/client/dashboard/summary', 'dashboard_summary', { intervalMs: 60000 });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-500">Carregando dashboard...</span>
        </div>
      </div>
    );
  }

  const healthData = data?.health ? [
    { name: 'Saudável', value: data.health.healthy || 0, color: '#10B981' },
    { name: 'Atenção', value: data.health.warning || 0, color: '#F59E0B' },
    { name: 'Crítico', value: data.health.critical || 0, color: '#EF4444' },
  ] : [
    { name: 'Saudável', value: 100, color: '#10B981' },
    { name: 'Atenção', value: 0, color: '#F59E0B' },
    { name: 'Crítico', value: 0, color: '#EF4444' },
  ];

  const ms365Status = data?.ms365?.hasData ? 'Operacional' : 'Sem dados';
  const utilizationRate = data?.ms365?.utilizationRate || 0;
  const assignedLicenses = data?.ms365?.assignedLicenses ?? data?.ms365?.activeUsers ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Visão Geral do Ambiente</h1>
          <p className="text-slate-500 text-lg">Resumo executivo dos contratos e infraestrutura de TI</p>
        </div>
        <button onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* MS365 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Cloud className="text-blue-600" size={24} />
                  Microsoft 365
                </h2>
                <p className="text-sm text-slate-500 mt-1">Status do Ambiente</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${ms365Status === 'Operacional' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {ms365Status === 'Operacional' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                {ms365Status}
              </span>
            </div>
            <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Users size={16} /> Licenças Atribuídas</span>
                <span className="font-semibold text-slate-900">{assignedLicenses}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Activity size={16} /> Taxa de Utilização</span>
                <span className="font-semibold text-slate-900">{utilizationRate}%</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Clock size={16} /> Total Licenças</span>
                <span className="font-semibold text-slate-900">{data?.ms365?.totalLicenses || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Servidores */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Server className="text-blue-600" size={24} />
                  Servidores
                </h2>
                <p className="text-sm text-slate-500 mt-1">Monitoramento</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                {data?.servers?.online || 0} de {data?.servers?.total || 0}
              </span>
            </div>
            <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Monitor size={16} /> Total Monitorados</span>
                <span className="font-semibold text-slate-900">{data?.servers?.total || 0} servidores</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <span className="text-emerald-700 flex items-center gap-2"><CheckCircle size={16} /> Operacionais</span>
                <span className="font-semibold text-emerald-700">{data?.servers?.online || 0}</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 p-3 rounded-lg border border-amber-100">
                <span className="text-amber-700 flex items-center gap-2"><AlertTriangle size={16} /> Offline</span>
                <span className="font-semibold text-amber-700">{data?.servers?.offline || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Saúde Geral */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
          <div className="mb-2">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Activity className="text-blue-600" size={24} />
              Saúde Geral
            </h2>
            <p className="text-sm text-slate-500 mt-1">Indicadores</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative scale-105">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={healthData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => `${value}%`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <span className="text-2xl font-black text-emerald-500">{healthData[0].value}%</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saudável</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {healthData.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center bg-slate-50 rounded-lg p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-xs font-medium text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Acesso Rápido */}
      <div className="pt-4">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Acesso Rápido aos Módulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { title: 'Microsoft 365', desc: 'Licenças e serviços', icon: Cloud, path: portalPath('ms365'), stat: `${data?.ms365?.totalLicenses || 0} licenças`, color: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' },
            { title: 'Servidores', desc: 'Monitoramento', icon: Server, path: portalPath('servidores'), stat: `${data?.servers?.total || 0} monitorados`, color: 'bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-white' },
            { title: 'Rede', desc: 'Infraestrutura', icon: Network, path: portalPath('rede'), stat: data?.network?.hasData ? `${data.network.total || 0} equipamentos` : 'Sem dados', color: 'bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-white' },
            { title: 'Documentação', desc: 'Contratos e docs', icon: FileText, path: portalPath('documentacao'), stat: `${data?.documents?.total || 0} arquivos`, color: 'bg-slate-100 text-slate-600 group-hover:bg-slate-800 group-hover:text-white' },
            { title: 'Chamados', desc: 'GLPI tickets', icon: Ticket, path: portalPath('chamados'), stat: `${data?.tickets?.open || 0} abertos`, color: 'bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white' },
          ].map((mod, i) => (
            <button key={i} onClick={() => navigate(mod.path)} className="flex flex-col bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group text-left">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${mod.color}`}>
                <mod.icon size={20} />
              </div>
              <h3 className="font-bold text-slate-800">{mod.title}</h3>
              <p className="text-sm text-slate-500 mb-4 flex-1">{mod.desc}</p>
              <div className="text-xs font-medium text-slate-600 bg-slate-50 py-1.5 px-3 rounded-md border border-slate-100 w-full">
                {mod.stat}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Alertas - agora baseados em dados reais */}
      <div className="pt-4 pb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Alertas e Notificações</h2>
        <div className="flex flex-col gap-3">
          {data?.servers?.offline > 0 && (
            <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 flex items-start gap-4">
              <div className="bg-red-100 p-2 rounded-lg text-red-600 mt-0.5">
                <AlertTriangle size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-red-900">{data.servers.offline} servidor(es) offline</h4>
                <p className="text-red-800/80 text-sm mt-0.5">Verifique a conectividade e status dos servidores inativos.</p>
              </div>
            </div>
          )}
          {data?.tickets?.open > 0 && (
            <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-4 flex items-start gap-4">
              <div className="bg-orange-100 p-2 rounded-lg text-orange-600 mt-0.5">
                <Ticket size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-orange-900">{data.tickets.open} chamado(s) em aberto</h4>
                <p className="text-orange-800/80 text-sm mt-0.5">Existem chamados pendentes que requerem atenção.</p>
              </div>
            </div>
          )}
          {(!data?.servers?.offline && !data?.tickets?.open) && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex items-start gap-4">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 mt-0.5">
                <CheckCircle size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-900">Tudo operando normalmente</h4>
                <p className="text-emerald-800/80 text-sm mt-0.5">Todos os serviços estão funcionando dentro dos parâmetros esperados.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardGeral;
