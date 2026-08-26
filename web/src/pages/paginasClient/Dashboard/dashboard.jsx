import React from 'react';
import { Users, Activity, Clock, Server, AlertTriangle, Monitor, Cloud, Network, FileText, CheckCircle, Ticket, RefreshCw, ArrowRight, TrendingUp, Shield } from 'lucide-react';
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
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-12 bg-neutral-200 rounded-xl w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-neutral-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const healthData = data?.health ? [
    { name: 'Saudável', value: data.health.healthy || 0, color: '#10b981' },
    { name: 'Atenção', value: data.health.warning || 0, color: '#f59e0b' },
    { name: 'Crítico', value: data.health.critical || 0, color: '#ef4444' },
  ] : [
    { name: 'Saudável', value: 100, color: '#10b981' },
    { name: 'Atenção', value: 0, color: '#f59e0b' },
    { name: 'Crítico', value: 0, color: '#ef4444' },
  ];

  const ms365Status = data?.ms365?.hasData ? 'Operacional' : 'Sem dados';
  const utilizationRate = data?.ms365?.utilizationRate || 0;
  const assignedLicenses = data?.ms365?.assignedLicenses ?? data?.ms365?.activeUsers ?? 0;

  const statCards = [
    {
      title: 'Microsoft 365',
      subtitle: 'Status do Ambiente',
      value: assignedLicenses,
      subValue: `${utilizationRate}% utilização`,
      icon: Cloud,
      trend: data?.ms365?.hasData ? '+12%' : null,
      color: { from: '#3b82f6', to: '#2563eb' },
      status: ms365Status === 'Operacional' ? 'success' : 'warning',
      path: portalPath('ms365'),
    },
    {
      title: 'Servidores',
      subtitle: 'Monitoramento',
      value: `${data?.servers?.online || 0}/${data?.servers?.total || 0}`,
      subValue: `${data?.servers?.offline || 0} offline`,
      icon: Server,
      trend: null,
      color: { from: '#10b981', to: '#059669' },
      status: (data?.servers?.offline || 0) === 0 ? 'success' : 'warning',
      path: portalPath('servidores'),
    },
    {
      title: 'Saúde Geral',
      subtitle: 'Indicadores',
      value: `${healthData[0].value}%`,
      subValue: 'índice de saúde',
      icon: Activity,
      trend: null,
      color: { from: '#8b5cf6', to: '#7c3aed' },
      status: healthData[2].value > 0 ? 'warning' : 'success',
      path: null,
    },
  ];

  const modules = [
    {
      title: 'Microsoft 365',
      desc: 'Licenças e serviços',
      icon: Cloud,
      path: portalPath('ms365'),
      stat: `${data?.ms365?.totalLicenses || 0} licenças`,
      color: { bg: 'from-blue-500/10 to-blue-600/5', border: 'border-blue-200/50', icon: 'text-blue-600', hover: 'hover:bg-blue-50 hover:border-blue-300' }
    },
    {
      title: 'Servidores',
      desc: 'Monitoramento',
      icon: Server,
      path: portalPath('servidores'),
      stat: `${data?.servers?.total || 0} monitorados`,
      color: { bg: 'from-emerald-500/10 to-emerald-600/5', border: 'border-emerald-200/50', icon: 'text-emerald-600', hover: 'hover:bg-emerald-50 hover:border-emerald-300' }
    },
    {
      title: 'Rede',
      desc: 'Infraestrutura',
      icon: Network,
      path: portalPath('rede'),
      stat: data?.network?.hasData ? `${data.network.total || 0} equipamentos` : 'Sem dados',
      color: { bg: 'from-violet-500/10 to-violet-600/5', border: 'border-violet-200/50', icon: 'text-violet-600', hover: 'hover:bg-violet-50 hover:border-violet-300' }
    },
    {
      title: 'Documentação',
      desc: 'Contratos e docs',
      icon: FileText,
      path: portalPath('documentacao'),
      stat: `${data?.documents?.total || 0} arquivos`,
      color: { bg: 'from-amber-500/10 to-amber-600/5', border: 'border-amber-200/50', icon: 'text-amber-600', hover: 'hover:bg-amber-50 hover:border-amber-300' }
    },
    {
      title: 'Chamados',
      desc: 'GLPI tickets',
      icon: Ticket,
      path: portalPath('chamados'),
      stat: `${data?.tickets?.open || 0} abertos`,
      color: { bg: 'from-rose-500/10 to-rose-600/5', border: 'border-rose-200/50', icon: 'text-rose-600', hover: 'hover:bg-rose-50 hover:border-rose-300' }
    },
    {
      title: 'Segurança',
      desc: 'Políticas e compliance',
      icon: Shield,
      path: portalPath('seguranca'),
      stat: 'Ativo',
      color: { bg: 'from-cyan-500/10 to-cyan-600/5', border: 'border-cyan-200/50', icon: 'text-cyan-600', hover: 'hover:bg-cyan-50 hover:border-cyan-300' }
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)' }} />
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Visão Geral</h1>
          </div>
          <p className="text-neutral-500 ml-3.5">Resumo executivo dos contratos e infraestrutura de TI</p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            bg-white border border-neutral-200 text-neutral-700
            hover:bg-neutral-50 hover:border-neutral-300
            shadow-sm transition-all duration-200"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar dados
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200/80
              shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            onClick={() => card.path && navigate(card.path)}
            style={card.path ? { cursor: 'pointer' } : {}}
          >
            {/* Gradient accent */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: `linear-gradient(90deg, ${card.color.from}, ${card.color.to})` }}
            />

            {/* Glow effect */}
            <div
              className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-500"
              style={{ background: `radial-gradient(circle, ${card.color.from} 0%, transparent 70%)` }}
            />

            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{card.title}</h2>
                  <p className="text-sm text-neutral-500 mt-0.5">{card.subtitle}</p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${card.color.from}15, ${card.color.to}08)`,
                    border: `1px solid ${card.color.from}20`
                  }}
                >
                  <card.icon size={22} style={{ color: card.color.from }} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-neutral-900">{card.value}</span>
                  {card.trend && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <TrendingUp size={12} />
                      {card.trend}
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500">{card.subValue}</p>
              </div>

              {/* Status badge */}
              {card.status && (
                <div className="mt-4 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                      ${card.status === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${card.status === 'success' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={card.status === 'success' ? { animation: 'pulse 2s infinite' } : {}}
                    />
                    {card.status === 'success' ? 'Operacional' : 'Atenção'}
                  </span>
                </div>
              )}

              {/* Arrow indicator for clickable cards */}
              {card.path && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <ArrowRight size={18} className="text-neutral-400 group-hover:text-neutral-600 group-hover:translate-x-1" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Health Chart & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Chart - Takes 1 column */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <h2 className="text-lg font-semibold text-neutral-900">Saúde do Ambiente</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Distribuição por status</p>
          </div>
          <div className="p-6">
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthData}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => `${value}%`}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-neutral-900">{healthData[0].value}%</span>
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Saudável</span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {healthData.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center p-2 rounded-xl bg-neutral-50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-medium text-neutral-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-neutral-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Access - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <h2 className="text-lg font-semibold text-neutral-900">Acesso Rápido</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Navegue para os módulos principais</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {modules.map((mod, i) => (
                <button
                  key={i}
                  onClick={() => navigate(mod.path)}
                  className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-200
                    bg-gradient-to-br ${mod.color.bg} ${mod.color.border}
                    hover:shadow-md active:scale-[0.98]`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${mod.color.icon} bg-white/80`}>
                    <mod.icon size={20} />
                  </div>
                  <h3 className="font-semibold text-neutral-900 text-sm">{mod.title}</h3>
                  <p className="text-xs text-neutral-500 mb-2">{mod.desc}</p>
                  <div className="mt-auto pt-2 border-t border-neutral-200/50">
                    <span className="text-xs font-medium text-neutral-600">{mod.stat}</span>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={14} className="text-neutral-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            Alertas e Notificações
          </h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col gap-4">
            {data?.servers?.offline > 0 && (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50/50 border border-red-200/50">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Server size={20} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900">{data.servers.offline} servidor(es) offline</h4>
                  <p className="text-sm text-red-700/80 mt-1">Verifique a conectividade e status dos servidores inativos.</p>
                </div>
                <button
                  onClick={() => navigate(portalPath('servidores'))}
                  className="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Verificar <ArrowRight size={14} />
                </button>
              </div>
            )}
            {data?.tickets?.open > 0 && (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-amber-50/50 border border-amber-200/50">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Ticket size={20} className="text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-900">{data.tickets.open} chamado(s) em aberto</h4>
                  <p className="text-sm text-amber-700/80 mt-1">Existem chamados pendentes que requerem atenção.</p>
                </div>
                <button
                  onClick={() => navigate(portalPath('chamados'))}
                  className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700"
                >
                  Verificar <ArrowRight size={14} />
                </button>
              </div>
            )}
            {(!data?.servers?.offline && !data?.tickets?.open) && (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/50">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={20} className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-emerald-900">Tudo operando normalmente</h4>
                  <p className="text-sm text-emerald-700/80 mt-1">Todos os serviços estão funcionando dentro dos parâmetros esperados.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
};

export default DashboardGeral;
