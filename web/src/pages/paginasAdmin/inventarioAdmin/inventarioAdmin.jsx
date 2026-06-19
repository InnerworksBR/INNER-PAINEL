import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, CheckCircle, Eye, EyeOff, RefreshCw, Search, X } from 'lucide-react';
import api from '../../../services/api';
import { useCompanies } from '../../../context/CompanyContext';

const emptyForm = {
  display_name: '',
  asset_type: '',
  manufacturer: '',
  model: '',
  serial_number: '',
  operating_system: '',
  operating_system_version: '',
  firmware_version: '',
  physical_or_virtual: '',
  business_purpose: '',
  technical_purpose: '',
  environment: '',
  criticality: '',
  location: '',
  notes_for_customer: '',
};

const InventarioAdmin = () => {
  const { companies } = useCompanies();
  const [profiles, setProfiles] = useState([]);
  const [filters, setFilters] = useState({ company_id: '', source_type: '', customer_visible: '', include_in_health_score: '', completeness_status: '', search: '' });
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);

  const showFeedback = (type, text) => {
    clearTimeout(feedbackTimer.current);
    setFeedback({ type, text });
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
  };

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const response = await api.get('/admin/inventory/profiles', { params });
      setProfiles(response.data || []);
    } catch (err) {
      showFeedback('error', 'Erro ao carregar inventário.');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
    return () => clearTimeout(feedbackTimer.current);
  }, []);

  const visibleProfiles = useMemo(() => profiles, [profiles]);

  const openProfile = async (profile) => {
    const response = await api.get(`/admin/inventory/profiles/${profile.id}`);
    setSelected(response.data);
    setForm(Object.fromEntries(Object.keys(emptyForm).map((key) => [key, response.data[key] || ''])));
  };

  const saveProfile = async () => {
    try {
      const response = await api.patch(`/admin/inventory/profiles/${selected.id}`, form);
      setSelected({ ...selected, ...response.data });
      await loadProfiles();
      showFeedback('success', 'Operação realizada com sucesso.');
    } catch (err) {
      showFeedback('error', 'Falha ao realizar operação.');
    }
  };

  const toggleVisibility = async (profile) => {
    if (profile.customer_visible && !window.confirm('Ocultar este ativo do cliente?')) return;
    try {
      await api.patch(`/admin/inventory/profiles/${profile.id}/visibility`, { customer_visible: !profile.customer_visible });
      await loadProfiles();
      showFeedback('success', 'Operação realizada com sucesso.');
    } catch (err) {
      showFeedback('error', 'Falha ao realizar operação.');
    }
  };

  const markReviewed = async () => {
    try {
      const response = await api.post(`/admin/inventory/profiles/${selected.id}/review`);
      setSelected({ ...selected, ...response.data });
      await loadProfiles();
      showFeedback('success', 'Operação realizada com sucesso.');
    } catch (err) {
      showFeedback('error', 'Falha ao realizar operação.');
    }
  };

  const toggleHealthScore = async (profile) => {
    try {
      await api.patch(`/admin/inventory/profiles/${profile.id}`, {
        include_in_health_score: !profile.include_in_health_score,
      });
      await loadProfiles();
      showFeedback('success', 'Operação realizada com sucesso.');
    } catch (err) {
      showFeedback('error', 'Falha ao realizar operação.');
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={feedback.type === 'success'
          ? 'mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm'
          : 'mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm'}>
          {feedback.text}
        </div>
      )}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Inventário</h1>
          <p className="text-slate-500 mt-1">Curadoria técnica dos ativos disponíveis no portal.</p>
        </div>
        <button onClick={loadProfiles} className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <select className="border rounded-xl px-3 py-2" value={filters.company_id} onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}>
          <option value="">Todas as empresas</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <select className="border rounded-xl px-3 py-2" value={filters.source_type} onChange={(e) => setFilters({ ...filters, source_type: e.target.value })}>
          <option value="">Todas as origens</option>
          <option value="server">Servidor</option>
          <option value="network_device">Rede</option>
        </select>
        <select className="border rounded-xl px-3 py-2" value={filters.customer_visible} onChange={(e) => setFilters({ ...filters, customer_visible: e.target.value })}>
          <option value="">Toda visibilidade</option>
          <option value="true">Visíveis</option>
          <option value="false">Ocultos</option>
        </select>
        <select className="border rounded-xl px-3 py-2" value={filters.include_in_health_score} onChange={(e) => setFilters({ ...filters, include_in_health_score: e.target.value })}>
          <option value="">Toda estatística</option>
          <option value="true">Conta na saúde</option>
          <option value="false">Fora da saúde</option>
        </select>
        <select className="border rounded-xl px-3 py-2" value={filters.completeness_status} onChange={(e) => setFilters({ ...filters, completeness_status: e.target.value })}>
          <option value="">Toda completude</option>
          <option value="sem_descricao">Sem descrição</option>
          <option value="sem_modelo">Sem modelo</option>
          <option value="sem_finalidade">Sem finalidade</option>
          <option value="completo">Completo</option>
        </select>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="w-full border rounded-xl pl-9 pr-3 py-2" placeholder="Buscar ativo..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <button onClick={loadProfiles} className="px-3 rounded-xl border">Filtrar</button>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b flex items-center gap-2">
          <Boxes size={18} className="text-blue-600" />
          <h2 className="font-semibold">Ativos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left p-4">Ativo</th>
                <th className="text-left p-4">Empresa</th>
                <th className="text-left p-4">Origem</th>
                <th className="text-left p-4">Tipo</th>
                <th className="text-left p-4">Completude</th>
                <th className="text-left p-4">Visibilidade</th>
                <th className="text-left p-4">Saúde Geral</th>
                <th className="text-right p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {!loading && visibleProfiles.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-slate-400">Nenhum ativo encontrado com os filtros aplicados.</td></tr>
              )}
              {visibleProfiles.map((profile) => (
                <tr key={profile.id} className="border-t">
                  <td className="p-4 font-medium">{profile.display_name || '-'}</td>
                  <td className="p-4">{profile.company_name || '-'}</td>
                  <td className="p-4">{profile.source_type === 'server' ? 'Servidor' : 'Rede'}</td>
                  <td className="p-4">{profile.asset_type}</td>
                  <td className="p-4">{formatCompleteness(profile.completeness_status)}</td>
                  <td className="p-4">{profile.customer_visible ? 'Visível' : 'Oculto'}</td>
                  <td className="p-4">{profile.include_in_health_score ? 'Incluído' : 'Ignorado'}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => toggleVisibility(profile)} className="p-2 rounded-lg hover:bg-slate-100">
                        {profile.customer_visible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => toggleHealthScore(profile)}
                        className={`px-3 py-1.5 rounded-lg border ${profile.include_in_health_score ? 'border-amber-200 text-amber-700' : 'border-emerald-200 text-emerald-700'}`}
                      >
                        {profile.include_in_health_score ? 'Ignorar na saúde' : 'Contar na saúde'}
                      </button>
                      <button onClick={() => openProfile(profile)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white">Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between">
              <div>
                <h2 className="text-xl font-bold">{selected.display_name || 'Editar ativo'}</h2>
                <p className="text-sm text-slate-500">Origem: {selected.source_type}</p>
              </div>
              <button onClick={() => setSelected(null)}><X /></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(emptyForm).map((key) => (
                <label key={key} className={key === 'notes_for_customer' || key === 'business_purpose' || key === 'technical_purpose' ? 'md:col-span-2' : ''}>
                  <span className="flex items-center gap-2 text-xs uppercase text-slate-500 mb-1">
                    {formatLabel(key)}
                    <em className="not-italic text-[10px] rounded-full bg-slate-100 px-2 py-0.5">
                      {selected.manual_override_fields?.includes(key) ? 'manual' : selected.auto_data?.[key] ? 'automático' : 'sem origem'}
                    </em>
                  </span>
                  {key === 'notes_for_customer' || key === 'business_purpose' || key === 'technical_purpose' ? (
                    <textarea className="w-full border rounded-xl px-3 py-2 min-h-24" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  ) : (
                    <input className="w-full border rounded-xl px-3 py-2" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  )}
                </label>
              ))}
            </div>
            <div className="p-6 border-t flex flex-wrap justify-between gap-3">
              <button onClick={markReviewed} className="inline-flex items-center gap-2 px-4 py-2 border rounded-xl">
                <CheckCircle size={16} />
                Marcar revisão manual
              </button>
              <button onClick={saveProfile} className="px-5 py-2 bg-blue-600 text-white rounded-xl">Salvar ficha</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatCompleteness(value) {
  return ({
    sem_descricao: 'Sem descrição',
    sem_modelo: 'Sem modelo',
    sem_finalidade: 'Sem finalidade',
    completo: 'Completo',
  })[value] || value;
}

function formatLabel(value) {
  return value.replaceAll('_', ' ');
}

export default InventarioAdmin;
