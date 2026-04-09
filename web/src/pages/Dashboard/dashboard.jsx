import React from 'react';
import { Users, Activity, Clock, Server, AlertTriangle, Monitor, Cloud, Network, FileText, ChevronRight, Info, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';

const dataHealth = [
  { name: 'Saudável', value: 85, color: '#10B981' }, // emerald-500
  { name: 'Atenção', value: 12, color: '#F59E0B' },  // amber-500
  { name: 'Crítico', value: 3, color: '#EF4444' },   // red-500
];

const DashboardGeral = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Cabeçalho */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Visão Geral do Ambiente</h1>
        <p className="text-slate-500 text-lg">Resumo executivo dos contratos e infraestrutura de TI</p>
      </div>

      {/* Primeira linha de cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        
        
        {/* Card 1 - Microsoft 365 */}
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Operacional
              </span>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Users size={16} /> Usuários Ativos</span>
                <span className="font-semibold text-slate-900">823</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Activity size={16} /> Taxa de Utilização</span>
                <span className="font-semibold text-slate-900">91,4%</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Clock size={16} /> Uptime Médio</span>
                <span className="font-semibold text-emerald-600">99,98%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2 - Servidores */}
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
                6 de 7
              </span>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-slate-600 flex items-center gap-2"><Monitor size={16} /> Total Monitorados</span>
                <span className="font-semibold text-slate-900">7 servidores</span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <span className="text-emerald-700 flex items-center gap-2"><CheckCircle size={16} /> Operacionais</span>
                <span className="font-semibold text-emerald-700">6</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 p-3 rounded-lg border border-amber-100">
                <span className="text-amber-700 flex items-center gap-2"><AlertTriangle size={16} /> Requer Atenção</span>
                <span className="font-semibold text-amber-700">1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3 - Saúde Geral */}
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
                  <Pie
                    data={dataHealth}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {dataHealth.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) => `${value}%`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <span className="text-2xl font-black text-emerald-500">85%</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Saudável</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {dataHealth.map((item, idx) => (
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

      {/* Acesso Rápido aos Módulos */}
      <div className="pt-4">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Acesso Rápido aos Módulos</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* M365 */}
          <button 
            onClick={() => navigate('/app/ms365')}
            className="flex flex-col bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Cloud size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Microsoft 365</h3>
            <p className="text-sm text-slate-500 mb-4 flex-1">Licenças e serviços</p>
            <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 py-1.5 px-3 rounded-md w-full">
              Status: Operacional
            </div>
          </button>

          {/* Servidores */}
          <button 
            onClick={() => navigate('/app/servidores')}
            className="flex flex-col bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3 group-hover:bg-slate-800 group-hover:text-white transition-colors">
              <Server size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Servidores</h3>
            <p className="text-sm text-slate-500 mb-4 flex-1">Monitoramento e contratos</p>
            <div className="text-xs font-medium text-slate-600 bg-slate-50 py-1.5 px-3 rounded-md border border-slate-100 w-full">
              Monitorados: 7 unidades
            </div>
          </button>

          {/* Rede */}
          <button 
            onClick={() => navigate('/app/rede')}
            className="flex flex-col bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3 group-hover:bg-slate-800 group-hover:text-white transition-colors">
              <Network size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Rede</h3>
            <p className="text-sm text-slate-500 mb-4 flex-1">Infraestrutura e equipamentos</p>
            <div className="text-xs font-medium text-slate-600 bg-slate-50 py-1.5 px-3 rounded-md border border-slate-100 w-full">
              Equipamentos: 8 ativos
            </div>
          </button>

          {/* Documentação */}
          <button 
            onClick={() => navigate('/app/documentacao')}
            className="flex flex-col bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center mb-3 group-hover:bg-slate-800 group-hover:text-white transition-colors">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Documentação</h3>
            <p className="text-sm text-slate-500 mb-4 flex-1">Contratos e documentos</p>
            <div className="text-xs font-medium text-slate-600 bg-slate-50 py-1.5 px-3 rounded-md border border-slate-100 w-full">
              Documentos: 9 arquivos
            </div>
          </button>

        </div>
      </div>

      {/* Alertas e Notificações */}
      <div className="pt-4 pb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Alertas e Notificações</h2>

        <div className="flex flex-col gap-3">

          {/* Alerta 1 (laranja) */}
          <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-4 flex items-start gap-4">
            <div className="bg-orange-100 p-2 rounded-lg text-orange-600 mt-0.5">
              <AlertTriangle size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-bold text-orange-900">Servidor SRV-WEB-01 com uso elevado</h4>
              <p className="text-orange-800/80 text-sm mt-0.5">CPU e memória acima de 85%. Considere verificar a carga.</p>
            </div>
          </div>

          {/* Alerta 2 (azul) */}
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 flex items-start gap-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mt-0.5">
              <Info size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-bold text-blue-900">Contratos em renovação - 8 itens</h4>
              <p className="text-blue-800/80 text-sm mt-0.5">Existem 8 contratos que precisam de atenção para renovação nos próximos 30 dias.</p>
            </div>
          </div>

          {/* Alerta 3 (verde) */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex items-start gap-4">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 mt-0.5">
              <CheckCircle size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-900">Todos os serviços Microsoft 365 operacionais</h4>
              <p className="text-emerald-800/80 text-sm mt-0.5">Exchange, Teams, SharePoint e OneDrive com uptime acima de 99,9%.</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default DashboardGeral;