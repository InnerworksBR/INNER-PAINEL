import React from 'react';
import {
  Building2,
  Globe,
  Key,
  CreditCard,
  Users,
  CheckCircle2,
  PieChart,
  Activity,
  Clock,
  HardDrive,
  ShieldAlert,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const Microsoft365 = () => {
  // Dados simulados baseados no prompt
  const tenantInfo = [
    { label: 'Nome da organização', value: 'Carpolog Logistics', icon: Building2 },
    { label: 'Domínio principal', value: 'carpolog.com.br', icon: Globe },
    { label: 'Tenant ID', value: 'a1b2c3d4-e5f6-7890', icon: Key },
    { label: 'Plano contratado', value: 'Enterprise E3/E5', icon: CreditCard },
  ];

  const metrics = [
    {
      title: 'Usuários Ativos',
      value: '155',
      subtitle: 'Total de usuários com licenças atribuídas',
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
      status: 'Ativo'
    },
    {
      title: 'Total de Licenças',
      value: '155',
      subtitle: 'Licenças contratadas no tenant',
      icon: PieChart,
      color: 'bg-indigo-50 text-indigo-600'
    },
    {
      title: 'Taxa de Utilização',
      value: '91.4%',
      subValue: 'Disponível: 77',
      subtitle: 'Taxa de Utilização',
      icon: Activity,
      color: 'bg-purple-50 text-purple-600'
    },
    {
      title: 'Dias até Renovação',
      value: '247',
      subValue: 'Vencimento: 31/12/2026',
      subtitle: 'Dias até Renovação',
      icon: Clock,
      color: 'bg-orange-50 text-orange-600'
    },
  ];

  const services = [
    { name: 'Exchange Online', users: 155, status: 'Operacional' },
    { name: 'SharePoint Online', users: 155, status: 'Operacional' },
    { name: 'Microsoft Teams', users: 155, status: 'Operacional' },
    { name: 'OneDrive for Business', users: 155, status: 'Operacional' },
  ];

  const alerts = [
    {
      title: '77 licenças não utilizadas',
      description: 'Considere revisar licenças não utilizadas para reduzir custos. Economia potencial: R$ 3.500/mês',
      type: 'warning',
      icon: AlertTriangle,
      color: 'text-amber-600 bg-amber-50 border-amber-200'
    },
    {
      title: 'Armazenamento em 74% de uso',
      description: 'Armazenamento SharePoint está próximo do limite. Considere fazer limpeza de arquivos antigos ou ampliar o plano.',
      type: 'info',
      icon: Info,
      color: 'text-blue-600 bg-blue-50 border-blue-200'
    },
    {
      title: 'Todos os serviços operacionais',
      description: 'Nenhum incidente reportado nos últimos 30 dias. Ambiente estável e saudável.',
      type: 'success',
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    }
  ];

  // Dados para os gráficos
  const licenciasData = [
    { name: 'Em Uso', value: 155, color: '#3b82f6' }, // blue-500
    { name: 'Disponível', value: 77, color: '#e5e7eb' }, // gray-200
  ];

  const storageData = [
    { name: 'Utilizado', value: 18500, color: '#8b5cf6' }, // purple-500
    { name: 'Disponível', value: 6500, color: '#e5e7eb' }, // gray-200
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho da página */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Microsoft 365</h1>
        <p className="text-gray-500 mt-1">Visão completa do tenant e gerenciamento de licenças</p>
      </div>

      {/* Seção – Informações do Tenant */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 cursor-pointer hover:text-blue-600 transition-colors">Informações do Tenant</h2>
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

      {/* Seção de indicadores principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-default relative overflow-hidden group">
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

            <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-500">
              <metric.icon className="w-32 h-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Seção de gráficos e Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Card — Distribuição de Licenças */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-default">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 cursor-pointer hover:text-blue-600 transition-colors">Distribuição de Licenças</h2>

          <div className="relative h-48 w-full flex-grow flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={licenciasData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {licenciasData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} licenças`, 'Quantidade']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-800">91.4%</span>
              <span className="text-xs text-gray-500">em uso</span>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-600">Licenças em uso</span>
              </div>
              <span className="font-semibold text-gray-800">823</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                <span className="text-gray-600">Licenças disponíveis</span>
              </div>
              <span className="font-semibold text-gray-800">77</span>
            </div>
          </div>
        </div>

        {/* Card — Armazenamento SharePoint Online */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-default">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 cursor-pointer hover:text-blue-600 transition-colors">Armazenamento SharePoint Online</h2>

          <div className="relative h-48 w-full flex-grow flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={storageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {storageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} GB`, 'Armazenamento']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-800">74.0%</span>
              <span className="text-xs text-gray-500">utilizado</span>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-gray-600">Armazenamento utilizado</span>
              </div>
              <span className="font-semibold text-gray-800">18.500 GB</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                <span className="text-gray-600">Espaço disponível</span>
              </div>
              <span className="font-semibold text-gray-800">6.500 GB</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500 justify-center">
            <HardDrive className="w-4 h-4" />
            <span>Capacidade Total: 25.000 GB incluindo OneDrive</span>
          </div>
        </div>

        {/* Seção – Alertas e Recomendações */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 cursor-pointer hover:text-blue-600 transition-colors">Alertas e Recomendações</h2>
          <p className="text-sm text-gray-500 mb-5">Insights automáticos do seu ambiente</p>

          <div className="space-y-4 flex-grow">
            {alerts.map((alert, index) => (
              <div key={index} className={`p-4 rounded-lg border flex gap-3 items-start ${alert.color}`}>
                <alert.icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-sm">{alert.title}</h4>
                  <p className="text-xs mt-1 opacity-90 leading-relaxed">{alert.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Seção – Status dos Serviços Microsoft 365 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors inline-block">Status dos Serviços Microsoft 365</h2>
          <p className="text-sm text-gray-500 mt-1">Monitoramento em tempo real dos serviços principais</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="px-6 py-4 font-medium min-w-[200px]">Serviço</th>
                <th className="px-6 py-4 font-medium">Usuários Ativos</th>
                <th className="px-6 py-4 font-medium text-right sm:text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((service, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                    {service.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      {service.users}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right sm:text-left">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {service.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Microsoft365;