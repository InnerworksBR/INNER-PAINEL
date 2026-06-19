import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Server, AlertTriangle, RefreshCw, Wifi, Search, Activity } from "lucide-react";
import api from '../../../services/api';
import { useClientRequestConfig } from '../../../context/ClientPreviewContext';
import AssetDetailDrawer from '../../../components/AssetDetailDrawer';

const Rede = () => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [detailDevice, setDetailDevice] = useState(null);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceStatusFilter, setDeviceStatusFilter] = useState('Todos');
  const requestConfig = useClientRequestConfig();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [devicesRes, statsRes] = await Promise.all([
        api.get('/client/network/devices', requestConfig),
        api.get('/client/network/stats', requestConfig),
      ]);
      setDevices(devicesRes.data || []);
      setStats(statsRes.data || null);

      try {
        const eventsRes = await api.get('/client/network/events', requestConfig);
        setEvents(eventsRes.data || []);
      } catch (eventsError) {
        console.warn('Network events unavailable:', eventsError);
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching network data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-emerald-100 text-emerald-800';
      case 'offline': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getUptimeColor = (uptime) => {
    if (uptime == null) return 'text-slate-400';
    if (uptime >= 99) return 'text-green-600';
    if (uptime >= 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredDevices = useMemo(() => {
    const query = deviceSearch.toLowerCase();
    return devices.filter((d) => {
      const matchesSearch = !query
        || (d.device_name || '').toLowerCase().includes(query)
        || (d.ip_address || '').toLowerCase().includes(query)
        || (d.device_type || '').toLowerCase().includes(query);
      const matchesStatus = deviceStatusFilter === 'Todos' || d.status === deviceStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [devices, deviceSearch, deviceStatusFilter]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 font-medium">Carregando infraestrutura de rede...</span>
      </div>
    );
  }

  return (
    <div className="p-8 pb-16 min-h-screen">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Rede</h1>
          <p className="text-slate-500 mt-2">Inventário e status de infraestrutura de rede</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Equipamentos</h3>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Server size={20} />
            </div>
          </div>
          <span className="text-3xl font-bold text-slate-800">{stats?.total || 0}</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Online</h3>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle size={20} />
            </div>
          </div>
          <span className="text-3xl font-bold text-slate-800">{stats?.online || 0}</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Offline</h3>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertTriangle size={20} />
            </div>
          </div>
          <span className="text-3xl font-bold text-slate-800">{stats?.offline || 0}</span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Uptime Médio</h3>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <Activity size={20} />
            </div>
          </div>
          <span className="text-3xl font-bold text-slate-800">
            {stats?.avgUptime != null ? stats.avgUptime.toFixed(1) + '%' : '—'}
          </span>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 font-medium text-sm">Tipos</h3>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Wifi size={20} />
            </div>
          </div>
          <span className="text-3xl font-bold text-slate-800">
            {stats?.byType ? Object.keys(stats.byType).length : 0}
          </span>
        </div>
      </div>

      {/* Distribuição por Tipo */}
      {stats?.byType && Object.keys(stats.byType).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(stats.byType).map(([type, count]) => (
            <div key={type} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
              <span className="text-2xl font-bold text-slate-800">{count}</span>
              <p className="text-sm text-slate-500 mt-1">{type}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela de Inventário */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Eventos Recentes</h2>
            <p className="text-sm text-slate-500 mt-1">Histórico de queda e retorno dos equipamentos</p>
          </div>
          <AlertTriangle size={20} className="text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {events.length > 0 ? events.slice(0, 10).map((event) => (
            <div key={event.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${event.severity === 'critical' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{event.entity_name}</p>
                  <p className="text-sm text-slate-500 truncate">{event.message}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-slate-700">{event.previous_status || '-'} -&gt; {event.current_status}</p>
                <p className="text-[11px] text-slate-400">{new Date(event.created_at).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          )) : (
            <div className="px-6 py-10 text-center text-slate-400">
              Nenhum evento registrado ainda. Assim que um equipamento cair ou voltar, o histórico aparecerá aqui.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Inventário de Equipamentos</h2>
          <p className="text-sm text-slate-500 mt-1">{devices.length} dispositivo(s) encontrado(s)</p>
        </div>

        {/* Busca e filtro */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, IP ou tipo..."
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <select
            value={deviceStatusFilter}
            onChange={(e) => setDeviceStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
                <th className="px-6 py-4 whitespace-nowrap">Equipamento</th>
                <th className="px-6 py-4 whitespace-nowrap">Tipo</th>
                <th className="px-6 py-4 whitespace-nowrap">IP</th>
                <th className="px-6 py-4 whitespace-nowrap">Localização</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap">Uptime</th>
                <th className="px-6 py-4 whitespace-nowrap">Contrato</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    Nenhum equipamento de rede registrado.
                  </td>
                </tr>
              ) : filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-400 text-sm">
                    Nenhum dispositivo encontrado com os filtros aplicados.{' '}
                    <button
                      onClick={() => { setDeviceSearch(''); setDeviceStatusFilter('Todos'); }}
                      className="text-blue-500 underline ml-1"
                    >
                      Limpar filtros
                    </button>
                  </td>
                </tr>
              ) : filteredDevices.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                    <button type="button" onClick={() => setDetailDevice(item)} className="hover:text-blue-600">
                      {item.device_name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.device_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">{item.ip_address || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.location || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap font-medium ${getUptimeColor(item.uptime_percent)}`}>
                    {item.uptime_percent != null ? item.uptime_percent.toFixed(1) + '%' : '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">{item.contract_ref || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AssetDetailDrawer open={Boolean(detailDevice)} asset={detailDevice} sourceType="network_device" onClose={() => setDetailDevice(null)} />
    </div>
  );
};

export default Rede;
