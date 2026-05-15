import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Globe,
  Key,
  Users,
  CheckCircle2,
  PieChart,
  Activity,
  Clock,
  RefreshCw,
  Filter,
  Eye,
  EyeOff,
  ChevronDown
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { useAuth } from '../../../context/AuthContext';
import { useRealtimeData } from '../../../hooks/useRealtimeSubscription';
import { useClientPreview } from '../../../context/ClientPreviewContext';
import api from '../../../services/api';

// Licenças relevantes pré-selecionadas (case-insensitive match parcial)
const RELEVANT_KEYWORDS = [
  'BUSINESS', 'EXCHANGE', 'POWER_BI', 'POWERBI', 'POWER BI',
  'OFFICE', 'O365', 'M365', 'MICROSOFT_365',
  'ENTERPRISEPACK', 'ENTERPRISEPREMIUM', 'TEAMS',
  'SHAREPOINTSTANDARD', 'SHAREPOINTENTERPRISE',
  'VISIO', 'PROJECT', 'DEFENDER', 'INTUNE',
  'FLOW', 'POWERAPPS', 'AUTOMATE',
  'WINDOWS', 'EMSPREMIUM', 'AAD_PREMIUM',
  'SPB', 'SPE', 'SMB'
];

function isRelevantLicense(licenseName) {
  const upper = (licenseName || '').toUpperCase();
  return RELEVANT_KEYWORDS.some(kw => upper.includes(kw));
}

// Nomes amigáveis para SKUs comuns
const FRIENDLY_NAMES = {
  'O365_BUSINESS_ESSENTIALS': 'Microsoft 365 Business Basic',
  'O365_BUSINESS_PREMIUM': 'Microsoft 365 Business Standard',
  'SMB_BUSINESS': 'Microsoft 365 Apps for Business',
  'SMB_BUSINESS_ESSENTIALS': 'Microsoft 365 Business Basic',
  'SMB_BUSINESS_PREMIUM': 'Microsoft 365 Business Standard',
  'SPB': 'Microsoft 365 Business Premium',
  'SPE_E3': 'Microsoft 365 E3',
  'SPE_E5': 'Microsoft 365 E5',
  'ENTERPRISEPACK': 'Office 365 E3',
  'ENTERPRISEPREMIUM': 'Office 365 E5',
  'EXCHANGESTANDARD': 'Exchange Online (Plano 1)',
  'EXCHANGEENTERPRISE': 'Exchange Online (Plano 2)',
  'POWER_BI_STANDARD': 'Power BI (Gratuito)',
  'POWER_BI_PRO': 'Power BI Pro',
  'POWER_BI_PREMIUM': 'Power BI Premium',
  'TEAMS_EXPLORATORY': 'Microsoft Teams Exploratory',
  'TEAMS_FREE': 'Microsoft Teams (Gratuito)',
  'FLOW_FREE': 'Power Automate (Gratuito)',
  'POWERAPPS_VIRAL': 'Power Apps (Gratuito)',
  'VISIOCLIENT': 'Visio Online Plano 2',
  'PROJECTPREMIUM': 'Project Online Premium',
  'PROJECTPROFESSIONAL': 'Project Online Professional',
  'WIN_DEF_ATP': 'Microsoft Defender for Endpoint',
  'EMSPREMIUM': 'Enterprise Mobility + Security E5',
  'EMS': 'Enterprise Mobility + Security E3',
  'AAD_PREMIUM': 'Azure AD Premium P1',
  'AAD_PREMIUM_P2': 'Azure AD Premium P2',
  'INTUNE_A': 'Microsoft Intune',
  'RIGHTSMANAGEMENT': 'Azure Information Protection',
  'STREAM': 'Microsoft Stream',
  'MICROSOFT_BUSINESS_CENTER': 'Microsoft Business Center',
};

function getFriendlyName(skuPartNumber) {
  return FRIENDLY_NAMES[skuPartNumber] || skuPartNumber;
}

const Microsoft365 = () => {
  const { user } = useAuth();
  const preview = useClientPreview();
  const { data: metricsData, loading, refresh, lastUpdated } = useRealtimeData(
    '/client/metrics/ms365',
    'ms365_metrics',
    { intervalMs: 300000 }
  );

  // Chaves de armazenamento no localStorage para persistir as escolhas (por empresa)
  const storageCompanyId = preview?.companyId || user?.company_id || 'default';
  const STORAGE_KEY_HIDDEN = `ms365_hidden_${storageCompanyId}`;
  const STORAGE_KEY_SHOW_ALL = `ms365_showall_${storageCompanyId}`;

  // Filtro de licenças - inicializa com os valores salvos no localStorage
  const [showAllLicenses, setShowAllLicenses] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SHOW_ALL);
      return saved !== null ? JSON.parse(saved) : false;
    } catch { return false; }
  });

  const [hiddenLicenses, setHiddenLicenses] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HIDDEN);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  
  const [filterOpen, setFilterOpen] = useState(false);
  const [savingLicenseId, setSavingLicenseId] = useState(null);

  // Persistir seleções no localStorage sempre que mudarem
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHOW_ALL, JSON.stringify(showAllLicenses));
  }, [showAllLicenses, STORAGE_KEY_SHOW_ALL]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(Array.from(hiddenLicenses)));
  }, [hiddenLicenses, STORAGE_KEY_HIDDEN]);

  // Separar licenças relevantes das "outras"
  const { relevantLicenses, otherLicenses } = useMemo(() => {
    const relevant = [];
    const other = [];
    metricsData.forEach(item => {
      if (isRelevantLicense(item.license_name)) {
        relevant.push(item);
      } else {
        other.push(item);
      }
    });
    return { relevantLicenses: relevant, otherLicenses: other };
  }, [metricsData]);

  // Licenças visíveis (aplicando filtro)
  const visibleLicenses = useMemo(() => {
    const base = showAllLicenses ? metricsData : relevantLicenses;
    return base.filter(item => !hiddenLicenses.has(item.license_name));
  }, [metricsData, relevantLicenses, showAllLicenses, hiddenLicenses]);

  const dashboardLicenses = useMemo(
    () => metricsData.filter((item) => item.include_in_dashboard === true),
    [metricsData]
  );

  const toggleLicense = (licenseName) => {
    setHiddenLicenses(prev => {
      const next = new Set(prev);
      if (next.has(licenseName)) {
        next.delete(licenseName);
      } else {
        next.add(licenseName);
      }
      return next;
    });
  };

  const toggleDashboardInclusion = async (item) => {
    setSavingLicenseId(item.id);
    try {
      await api.patch(`/admin/ms365/licenses/${item.id}/dashboard-inclusion`, {
        include_in_dashboard: !item.include_in_dashboard,
      });
      await refresh();
    } finally {
      setSavingLicenseId(null);
    }
  };

  // Métricas executivas: usam exatamente a mesma seleção do dashboard geral.
  const totalLicenças = dashboardLicenses.reduce((acc, curr) => acc + curr.total, 0);
  const totalUsado = dashboardLicenses.reduce((acc, curr) => acc + curr.used, 0);
  const totalDisponivel = dashboardLicenses.reduce((acc, curr) => acc + curr.available, 0);
  const taxaUtilizacao = totalLicenças > 0 ? ((totalUsado / totalLicenças) * 100).toFixed(1) : '0';

  const tenantInfo = [
    { label: 'Organização', value: user?.company_name || 'Organização', icon: Building2 },
    { label: 'Integração', value: 'Microsoft Graph API', icon: Globe },
    { label: 'Perfil', value: user?.role === 'admin' ? 'Administrador' : 'Gestor de Contrato', icon: Key },
    { label: 'Status', value: metricsData.length > 0 ? 'Conectado' : 'Sem dados', icon: CheckCircle2 },
  ];

  const metrics = [
    { title: 'Licenças Atribuídas', value: totalUsado.toString(), subtitle: 'Assentos em uso no tenant', icon: Users, color: 'bg-blue-50 text-blue-600', status: metricsData.length > 0 ? 'Ativo' : 'Sem dados' },
    { title: 'Total de Licenças', value: totalLicenças.toString(), subtitle: 'Licenças contratadas', icon: PieChart, color: 'bg-indigo-50 text-indigo-600' },
    { title: 'Taxa de Utilização', value: `${taxaUtilizacao}%`, subValue: `Livre: ${totalDisponivel}`, subtitle: 'Eficiência de consumo', icon: Activity, color: 'bg-purple-50 text-purple-600' },
    { title: 'Atualização', value: metricsData.length > 0 ? new Date(metricsData[0].last_updated).toLocaleDateString() : '--', subtitle: lastUpdated ? `Tela atualizada ${lastUpdated.toLocaleTimeString('pt-BR')}` : 'Última sincronização', icon: Clock, color: 'bg-orange-50 text-orange-600' },
  ];

  const licenciasData = [
    { name: 'Em Uso', value: totalUsado, color: '#3b82f6' },
    { name: 'Disponível', value: totalDisponivel, color: '#e5e7eb' },
  ];

  // Dados para o gráfico de barras por licença
  const barChartData = dashboardLicenses.map(item => ({
    name: getFriendlyName(item.license_name).length > 20
      ? getFriendlyName(item.license_name).substring(0, 20) + '...'
      : getFriendlyName(item.license_name),
    'Em Uso': item.used,
    'Disponível': item.available,
  }));

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 font-medium">Carregando métricas do Microsoft 365...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Microsoft 365</h1>
          <p className="text-gray-500 mt-1">Visão completa do tenant e gerenciamento de licenças</p>
        </div>
        <div className="flex items-center gap-2">
          {otherLicenses.length > 0 && (
            <button
              onClick={() => setShowAllLicenses(!showAllLicenses)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${showAllLicenses
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
            >
              {showAllLicenses ? <Eye size={14} /> : <EyeOff size={14} />}
              {showAllLicenses ? `Todas (${metricsData.length})` : `Relevantes (${relevantLicenses.length})`}
            </button>
          )}
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterOpen ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
          >
            <Filter size={14} />
            Filtrar
            <ChevronDown size={12} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Painel de Filtro de Licenças */}
      {filterOpen && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Selecionar licenças visíveis</h3>
            <div className="flex gap-2">
              <button onClick={() => setHiddenLicenses(new Set())} className="text-[10px] text-blue-600 hover:underline">Mostrar todas</button>
              <button onClick={() => setHiddenLicenses(new Set(metricsData.map(m => m.license_name)))} className="text-[10px] text-gray-500 hover:underline">Esconder todas</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {(showAllLicenses ? metricsData : relevantLicenses).map((item) => {
              const isHidden = hiddenLicenses.has(item.license_name);
              return (
                <button
                  key={item.license_name}
                  onClick={() => toggleLicense(item.license_name)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${isHidden
                    ? 'bg-gray-50 text-gray-400 border-gray-200 line-through'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                >
                  {getFriendlyName(item.license_name)}
                  <span className="ml-1.5 text-[10px] opacity-70">({item.used}/{item.total})</span>
                </button>
              );
            })}
          </div>
          {!showAllLicenses && otherLicenses.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-2">
              {otherLicenses.length} licença(s) oculta(s) — clique em "Todas" para visualizar
            </p>
          )}
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Licenças contabilizadas no dashboard</h3>
              <p className="text-xs text-gray-500 mt-0.5">Selecione apenas os SKUs que devem compor os totais executivos.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {metricsData.map((item) => (
              <button
                key={`dashboard-${item.id}`}
                onClick={() => toggleDashboardInclusion(item)}
                disabled={savingLicenseId === item.id}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-60 ${
                  item.include_in_dashboard
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}
              >
                {getFriendlyName(item.license_name)}
                <span className="ml-1.5 text-[10px] opacity-70">({item.used}/{item.total})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Informações do Tenant */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Informações do Tenant</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tenantInfo.map((info, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="mt-0.5 p-2 bg-gray-50 text-gray-400 rounded-lg">
                <info.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{info.label}</p>
                <p className="font-semibold text-gray-800 mt-0.5">{info.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-lg ${metric.color}`}>
                <metric.icon className="w-6 h-6" />
              </div>
              {metric.status && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded-full flex items-center gap-1.5 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {metric.status}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-gray-800">{metric.value}</h3>
                {metric.subValue && <span className="text-sm font-medium text-gray-500">{metric.subValue}</span>}
              </div>
              <p className="font-medium text-gray-700 mt-1">{metric.title}</p>
              <p className="text-xs text-gray-500 mt-2">{metric.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut — Distribuição */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Distribuição de Licenças</h2>
          <div className="relative h-48 w-full flex-grow flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie data={licenciasData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                  {licenciasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-800">{taxaUtilizacao}%</span>
              <span className="text-xs text-gray-500">em uso</span>
            </div>
          </div>
        </div>

        {/* Barras — Por Licença */}
        {barChartData.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Uso por Licença</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="Em Uso" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Disponível" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Tabela Detalhada */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Planos e SKUs Detalhados</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Exibindo {visibleLicenses.length} de {metricsData.length} licença(s)
              {' '}· {dashboardLicenses.length} contabilizada(s) nos indicadores
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3">Licença</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3 text-center">Total</th>
                <th className="px-6 py-3 text-center">Em Uso</th>
                <th className="px-6 py-3 text-center">Disponível</th>
                <th className="px-6 py-3 text-center">Uso %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleLicenses.map((item, idx) => {
                const usagePercent = item.total > 0 ? ((item.used / item.total) * 100).toFixed(0) : 0;
                const usageColor = usagePercent > 90 ? 'text-red-600' : usagePercent > 70 ? 'text-amber-600' : 'text-emerald-600';

                return (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">{getFriendlyName(item.license_name)}</td>
                    <td className="px-6 py-4 text-xs text-gray-400 font-mono">{item.license_name}</td>
                    <td className="px-6 py-4 text-center">{item.total}</td>
                    <td className="px-6 py-4 text-center text-blue-600 font-semibold">{item.used}</td>
                    <td className="px-6 py-4 text-center text-gray-500">{item.available}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-bold ${usageColor}`}>{usagePercent}%</span>
                      <div className="w-full bg-gray-100 h-1 rounded-full mt-1">
                        <div className={`h-full rounded-full ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(usagePercent, 100)}%` }}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleLicenses.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">
                    {metricsData.length > 0
                      ? 'Todas as licenças estão ocultas. Clique em "Filtrar" para selecionar.'
                      : 'Nenhuma licença encontrada. Sincronize via Integrações.'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Microsoft365;
