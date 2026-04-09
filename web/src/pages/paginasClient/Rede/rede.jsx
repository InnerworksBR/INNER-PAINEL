import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, Server, AlertTriangle, RefreshCw, Wifi } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from '../../../services/api';

const Rede = () => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [devicesRes, statsRes] = await Promise.all([
        api.get('/client/network/devices'),
        api.get('/client/network/stats'),
      ]);
      setDevices(devicesRes.data || []);
      setStats(statsRes.data || null);
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Rede</h1>
        <p className="text-slate-500 mt-2">Gerenciamento de infraestrutura de rede</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Inventário de Equipamentos</h2>
          <p className="text-sm text-slate-500 mt-1">{devices.length} dispositivo(s) encontrado(s)</p>
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
                <th className="px-6 py-4 whitespace-nowrap">Contrato</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
              {devices.length > 0 ? devices.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{item.device_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.device_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">{item.ip_address || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{item.location || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">{item.contract_ref || '-'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    Nenhum dispositivo de rede encontrado. Execute uma sincronização com o Zabbix para popular os dados.
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

export default Rede;