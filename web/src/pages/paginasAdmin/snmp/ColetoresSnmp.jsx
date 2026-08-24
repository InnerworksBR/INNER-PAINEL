import React, { useState, useEffect } from 'react';
import {
  Network,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  X,
  AlertCircle,
  Check,
  Wifi,
  WifiOff,
} from 'lucide-react';
import api from '../../../services/api';
import { useCompanies } from '../../../context/CompanyContext';

const ColetoresSnmp = () => {
  const { companies } = useCompanies();
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollector, setEditingCollector] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const [formValues, setFormValues] = useState({
    company_id: '',
    name: '',
    collector_host: '',
    ip_range_start: '',
    ip_range_end: '',
    community_string: '',
    snmp_version: '2c',
    snmp_port: '161',
    interval_seconds: '300',
    enabled: true,
  });

  const loadCollectors = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/snmp/collectors');
      setCollectors(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar coletores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollectors();
  }, []);

  const handleOpenModal = (collector = null) => {
    if (collector) {
      setEditingCollector(collector);
      setFormValues({
        company_id: collector.company_id || '',
        name: collector.name || '',
        collector_host: collector.collector_host || '',
        ip_range_start: collector.ip_range_start || '',
        ip_range_end: collector.ip_range_end || '',
        community_string: '', // Não mostrar senha existente
        snmp_version: collector.snmp_version || '2c',
        snmp_port: String(collector.snmp_port || '161'),
        interval_seconds: String(collector.interval_seconds || '300'),
        enabled: collector.enabled !== false,
      });
    } else {
      setEditingCollector(null);
      setFormValues({
        company_id: companies[0]?.id || '',
        name: '',
        collector_host: '',
        ip_range_start: '',
        ip_range_end: '',
        community_string: '',
        snmp_version: '2c',
        snmp_port: '161',
        interval_seconds: '300',
        enabled: true,
      });
    }
    setTestResult(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCollector(null);
    setTestResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTestResult(null);

    const payload = {
      company_id: formValues.company_id,
      name: formValues.name,
      collector_host: formValues.collector_host,
      ip_range_start: formValues.ip_range_start,
      ip_range_end: formValues.ip_range_end,
      snmp_version: formValues.snmp_version,
      snmp_port: parseInt(formValues.snmp_port, 10),
      interval_seconds: parseInt(formValues.interval_seconds, 10),
      enabled: formValues.enabled,
    };

    // Só enviar community_string se foi preenchida (não mostrar existente)
    if (formValues.community_string) {
      payload.community_string = formValues.community_string;
    }

    try {
      if (editingCollector) {
        await api.patch(`/admin/snmp/collectors/${editingCollector.id}`, payload);
      } else {
        if (!formValues.community_string) {
          setTestResult({ success: false, message: 'Community string é obrigatória.' });
          return;
        }
        payload.community_string = formValues.community_string;
        await api.post('/admin/snmp/collectors', payload);
      }
      loadCollectors();
      handleCloseModal();
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Erro ao salvar coletor.',
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este coletor?')) return;
    try {
      await api.delete(`/admin/snmp/collectors/${id}`);
      loadCollectors();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao remover coletor.');
    }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await api.post(`/admin/snmp/collectors/${id}/collect`);
      setTestResult({
        success: true,
        message: `${res.data.devices_found || 0} dispositivos encontrados em ${res.data.duration_ms || 0}ms`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Erro ao testar coleta.',
      });
    } finally {
      setTestingId(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            <Network className="text-purple-600" size={28} />
            Coletores SNMP
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerenciamento de coletores SNMP para descoberta de dispositivos de rede.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCollectors}
            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
          >
            <Plus size={18} />
            Novo Coletor
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <ShieldAlert size={18} />
          {error}
        </div>
      )}

      {/* Test Result Banner */}
      {testResult && (
        <div
          className={`p-4 rounded-lg border flex items-start gap-3 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 size={20} className="text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle size={20} className="text-red-600 mt-0.5" />
          )}
          <div>
            <p className="font-medium">{testResult.success ? 'Sucesso!' : 'Erro'}</p>
            <p className="text-sm mt-0.5">{testResult.message}</p>
          </div>
        </div>
      )}

      {/* Tabela de Coletores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Coletores Registrados</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">Empresa</th>
                <th className="p-4">IP Range</th>
                <th className="p-4">SNMP</th>
                <th className="p-4">Host</th>
                <th className="p-4">Status</th>
                <th className="p-4">Última Execução</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {collectors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhum coletor SNMP cadastrado.
                  </td>
                </tr>
              ) : (
                collectors.map((collector) => (
                  <tr key={collector.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Network className="text-purple-600" size={18} />
                        <span className="font-medium text-slate-800">{collector.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-700">
                      {collector.companies?.name || 'N/A'}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600">
                      {collector.ip_range_start} - {collector.ip_range_end}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          v{collector.snmp_version}
                        </span>
                        <span className="text-xs text-slate-500">:{collector.snmp_port}</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {collector.collector_host || 'N/A'}
                    </td>
                    <td className="p-4">
                      {collector.enabled !== false ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={12} />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          <XCircle size={12} />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {formatDate(collector.last_collection_at)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleTest(collector.id)}
                          disabled={testingId === collector.id}
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                          title="Testar coleta"
                        >
                          <Play size={16} className={testingId === collector.id ? 'animate-pulse' : ''} />
                        </button>
                        <button
                          onClick={() => handleOpenModal(collector)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(collector.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criar/Editar Coletor */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Network className="text-purple-600" size={22} />
                {editingCollector ? 'Editar Coletor SNMP' : 'Novo Coletor SNMP'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Empresa */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
                <select
                  value={formValues.company_id}
                  onChange={(e) => setFormValues({ ...formValues, company_id: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500/20"
                  required
                >
                  <option value="">Selecione a empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Coletor</label>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                  placeholder="Ex: Coletor Filial SP"
                  required
                />
              </div>

              {/* IP Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">IP Inicial</label>
                  <input
                    type="text"
                    value={formValues.ip_range_start}
                    onChange={(e) => setFormValues({ ...formValues, ip_range_start: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono"
                    placeholder="192.168.1.1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">IP Final</label>
                  <input
                    type="text"
                    value={formValues.ip_range_end}
                    onChange={(e) => setFormValues({ ...formValues, ip_range_end: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono"
                    placeholder="192.168.1.254"
                    required
                  />
                </div>
              </div>

              {/* SNMP Version */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Versão SNMP</label>
                  <select
                    value={formValues.snmp_version}
                    onChange={(e) => setFormValues({ ...formValues, snmp_version: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50"
                  >
                    <option value="2c">v2c</option>
                    <option value="1">v1</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Porta</label>
                  <input
                    type="number"
                    value={formValues.snmp_port}
                    onChange={(e) => setFormValues({ ...formValues, snmp_port: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                    placeholder="161"
                  />
                </div>
              </div>

              {/* Community String */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Community String
                  {editingCollector && (
                    <span className="text-slate-400 font-normal ml-1">(deixe em branco para manter)</span>
                  )}
                </label>
                <input
                  type="password"
                  value={formValues.community_string}
                  onChange={(e) => setFormValues({ ...formValues, community_string: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-mono"
                  placeholder={editingCollector ? '••••••••' : 'public'}
                  required={!editingCollector}
                />
              </div>

              {/* Host do Coletor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Host do Coletor (opcional)</label>
                <input
                  type="text"
                  value={formValues.collector_host}
                  onChange={(e) => setFormValues({ ...formValues, collector_host: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                  placeholder="Nome do servidor que executa o coletor"
                />
              </div>

              {/* Intervalo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Intervalo de Coleta (segundos)</label>
                <input
                  type="number"
                  value={formValues.interval_seconds}
                  onChange={(e) => setFormValues({ ...formValues, interval_seconds: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                  min={60}
                />
              </div>

              {/* Enabled */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formValues.enabled}
                  onChange={(e) => setFormValues({ ...formValues, enabled: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <label htmlFor="enabled" className="text-sm text-slate-700">
                  Coletor ativo
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                >
                  {editingCollector ? 'Salvar Alterações' : 'Criar Coletor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColetoresSnmp;
