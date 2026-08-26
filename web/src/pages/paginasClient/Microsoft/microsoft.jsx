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
  ChevronDown,
  AlertCircle,
  TrendingUp,
  BadgeCheck,
  Sparkles
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

  const storageCompanyId = preview?.companyId || user?.company_id || 'default';
  const STORAGE_KEY_HIDDEN = `ms365_hidden_${storageCompanyId}`;
  const STORAGE_KEY_SHOW_ALL = `ms365_showall_${storageCompanyId}`;

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHOW_ALL, JSON.stringify(showAllLicenses));
  }, [showAllLicenses, STORAGE_KEY_SHOW_ALL]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(Array.from(hiddenLicenses)));
  }, [hiddenLicenses, STORAGE_KEY_HIDDEN]);

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
    {
      title: 'Licenças Atribuídas',
      value: totalUsado,
      subValue: `de ${totalLicenças} total`,
      subtitle: 'Assentos em uso no tenant',
      icon: Users,
      color: { from: '#3b82f6', to: '#2563eb' }
    },
    {
      title: 'Total de Licenças',
      value: totalLicenças,
      subValue: 'contratadas',
      subtitle: 'Planos ativos',
      icon: PieChart,
      color: { from: '#8b5cf6', to: '#7c3aed' }
    },
    {
      title: 'Taxa de Utilização',
      value: `${taxaUtilizacao}%`,
      subValue: `${totalDisponivel} disponíveis`,
      subtitle: 'Eficiência de consumo',
      icon: Activity,
      color: { from: '#10b981', to: '#059669' }
    },
    {
      title: 'Última Sincronização',
      value: metricsData.length > 0 ? new Date(metricsData[0].last_updated).toLocaleDateString('pt-BR') : '--',
      subValue: lastUpdated ? lastUpdated.toLocaleTimeString('pt-BR') : '',
      subtitle: 'Atualização dos dados',
      icon: Clock,
      color: { from: '#f59e0b', to: '#d97706' }
    },
  ];

  const licenciasData = [
    { name: 'Em Uso', value: totalUsado, color: '#3b82f6' },
    { name: 'Disponível', value: totalDisponivel, color: '#e5e7eb' },
  ];

  const barChartData = dashboardLicenses.map(item => ({
    name: getFriendlyName(item.license_name).length > 20
      ? getFriendlyName(item.license_name).substring(0, 20) + '...'
      : getFriendlyName(item.license_name),
    'Em Uso': item.used,
    'Disponível': item.available,
  }));

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-neutral-200 rounded-xl w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-neutral-200 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }} />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Microsoft 365</h1>
          </div>
          <p className="text-neutral-500 ml-3.5">Visão completa do tenant e gerenciamento de licenças</p>
        </div>
        <div className="flex items-center gap-2">
          {otherLicenses.length > 0 && (
            <button
              onClick={() => setShowAllLicenses(!showAllLicenses)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border
                ${showAllLicenses
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                } shadow-sm`}
            >
              {showAllLicenses ? <Eye size={14} /> : <EyeOff size={14} />}
              {showAllLicenses ? `Todas (${metricsData.length})` : `Relevantes (${relevantLicenses.length})`}
            </button>
          )}
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border shadow-sm
              ${filterOpen
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
              }`}
          >
            <Filter size={14} />
            Filtrar
            <ChevronDown size={12} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all
              bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      {!loading && metricsData.length === 0 && (
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/50">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} className="text-amber-600" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-900">Nenhuma licença sincronizada</h4>
            <p className="text-sm text-amber-700/80 mt-1">
              Configure a integração Microsoft 365 em Empresas &rsaquo; Integrações ou aguarde a próxima sincronização.
            </p>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {filterOpen && (
        <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-6 animate-slide-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-neutral-700">Selecionar licenças visíveis</h3>
            <div className="flex gap-3">
              <button onClick={() => setHiddenLicenses(new Set())} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                Mostrar todas
              </button>
              <button onClick={() => setHiddenLicenses(new Set(metricsData.map(m => m.license_name)))} className="text-xs text-neutral-500 hover:text-neutral-700 font-medium">
                Esconder todas
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {(showAllLicenses ? metricsData : relevantLicenses).map((item) => {
              const isHidden = hiddenLicenses.has(item.license_name);
              return (
                <button
                  key={item.license_name}
                  onClick={() => toggleLicense(item.license_name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                    ${isHidden
                      ? 'bg-neutral-100 text-neutral-400 border-neutral-200 line-through'
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
            <p className="text-xs text-neutral-400 mt-3">
              {otherLicenses.length} licença(s) oculta(s) — clique em "Todas" para visualizar
            </p>
          )}
        </div>
      )}

      {/* Admin Dashboard Inclusion Panel */}
      {user?.role === 'admin' && (
        <div className="bg-white rounded-2xl border border-amber-200/50 shadow-sm p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <BadgeCheck size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Licenças no Dashboard</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Selecione os SKUs que devem compor os totais executivos.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {metricsData.map((item) => (
              <button
                key={`dashboard-${item.id}`}
                onClick={() => toggleDashboardInclusion(item)}
                disabled={savingLicenseId === item.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-60
                  ${item.include_in_dashboard
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-neutral-50 text-neutral-500 border-neutral-200'
                  }`}
              >
                {getFriendlyName(item.license_name)}
                <span className="ml-1.5 text-[10px] opacity-70">({item.used}/{item.total})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tenant Info */}
      <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-5">Informações do Tenant</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tenantInfo.map((info, index) => (
            <div key={index} className="p-4 rounded-xl bg-neutral-50/50 border border-neutral-100">
              <div className="flex items-center gap-2 mb-2">
                <info.icon size={16} className="text-neutral-400" />
                <span className="text-xs font-medium text-neutral-500">{info.label}</span>
              </div>
              <p className="font-semibold text-neutral-900 text-sm">{info.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200/60 shadow-sm
              hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
          >
            {/* Gradient accent */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: `linear-gradient(90deg, ${metric.color.from}, ${metric.color.to})` }}
            />

            {/* Glow */}
            <div
              className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-500"
              style={{ background: `radial-gradient(circle, ${metric.color.from} 0%, transparent 70%)` }}
            />

            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${metric.color.from}15, ${metric.color.to}08)`,
                    border: `1px solid ${metric.color.from}20`
                  }}
                >
                  <metric.icon size={20} style={{ color: metric.color.from }} />
                </div>
                {index === 2 && metricsData.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <TrendingUp size={10} />
                    Ótimo
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-neutral-900">{metric.value}</span>
                  {metric.subValue && <span className="text-sm text-neutral-500">{metric.subValue}</span>}
                </div>
                <p className="text-sm font-medium text-neutral-700 mt-1">{metric.title}</p>
                <p className="text-xs text-neutral-400 mt-1">{metric.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution Donut */}
        <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <h2 className="text-lg font-semibold text-neutral-900">Distribuição de Licenças</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Uso vs disponível</p>
          </div>
          <div className="p-6">
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={licenciasData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {licenciasData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold text-neutral-900">{taxaUtilizacao}%</span>
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">em uso</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        {barChartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-100">
              <h2 className="text-lg font-semibold text-neutral-900">Uso por Licença</h2>
              <p className="text-sm text-neutral-500 mt-0.5">Comparativo de consumo</p>
            </div>
            <div className="p-6 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: '#57534e' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar dataKey="Em Uso" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Disponível" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Planos e SKUs Detalhados</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Exibindo {visibleLicenses.length} de {metricsData.length} licença(s)
                {' '}· {dashboardLicenses.length} contabilizada(s) nos indicadores
              </p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-neutral-50/50">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Licença</th>
                <th className="px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Total</th>
                <th className="px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Em Uso</th>
                <th className="px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Disponível</th>
                <th className="px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider text-center">Uso %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {visibleLicenses.map((item, idx) => {
                const usagePercent = item.total > 0 ? ((item.used / item.total) * 100).toFixed(0) : 0;
                const usageColor = usagePercent > 90 ? 'text-red-600' : usagePercent > 70 ? 'text-amber-600' : 'text-emerald-600';
                const usageBarColor = usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500';

                return (
                  <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-neutral-900 text-sm">{getFriendlyName(item.license_name)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded font-mono">{item.license_name}</code>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-neutral-600">{item.total}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-semibold text-blue-600 text-sm">{item.used}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-neutral-500">{item.available}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={`font-bold text-sm ${usageColor}`}>{usagePercent}%</span>
                        <div className="w-16 bg-neutral-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${usageBarColor}`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleLicenses.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
                        <Sparkles size={20} className="text-neutral-300" />
                      </div>
                      <p className="text-sm text-neutral-500">
                        {metricsData.length > 0
                          ? 'Todas as licenças estão ocultas. Clique em "Filtrar" para selecionar.'
                          : 'Nenhuma licença encontrada. Sincronize via Integrações.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  );
};

export default Microsoft365;
