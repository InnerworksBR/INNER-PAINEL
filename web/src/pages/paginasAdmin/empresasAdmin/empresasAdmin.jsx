import React, { useState } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, X, Check, RefreshCw, AlertCircle, CheckCircle, Eye } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
import api from '../../../services/api';
import { useNavigate } from 'react-router-dom';

const EmpresasAdmin = () => {
    const { companies, addCompany, updateCompany, deleteCompany, updateIntegrations } = useCompanies();
    const navigate = useNavigate();

    // Estados para o modal e formulário
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState(false);
    const [integrationsCompany, setIntegrationsCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCompany, setEditingCompany] = useState(null);
    const [formValues, setFormValues] = useState({
        name: '',
        cnpj: '',
        sector: '',
        status: 'Ativo'
    });
    const [integrationValues, setIntegrationValues] = useState({
        glpi_entity_id: '',
        zabbix_api_url: '', zabbix_user: '', zabbix_password: '',
        ms_graph_tenant_id: '', ms_graph_client_id: '', ms_graph_client_secret: ''
    });

    const handleOpenIntegrationsModal = (company) => {
        setIntegrationsCompany(company);
        setSaveError('');
        setSaveSuccess('');
        setSyncStatus({ loading: false, result: null });
        const ints = Array.isArray(company.company_integrations)
            ? (company.company_integrations[0] || {})
            : (company.company_integrations || {});
            
        setIntegrationValues({
            glpi_entity_id: ints.glpi_entity_id || '',
            zabbix_api_url: ints.zabbix_api_url || '', zabbix_user: ints.zabbix_user || '', zabbix_password: ints.zabbix_password || '',
            ms_graph_tenant_id: ints.ms_graph_tenant_id || '', ms_graph_client_id: ints.ms_graph_client_id || '', ms_graph_client_secret: ints.ms_graph_client_secret || ''
        });
        setIsIntegrationsModalOpen(true);
    };

    const [syncStatus, setSyncStatus] = useState({ loading: false, result: null });
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    const handleIntegrationsSubmit = async (e) => {
        e.preventDefault();
        setSaveError('');
        setSaveSuccess('');
        try {
            const payload = { ...integrationValues };
            if (payload.glpi_entity_id === '') {
                payload.glpi_entity_id = null;
            } else if (payload.glpi_entity_id !== null) {
                payload.glpi_entity_id = parseInt(payload.glpi_entity_id, 10);
            }

            const result = await updateIntegrations(integrationsCompany.id, payload);
            if (result?.success) {
                setSaveSuccess('Integrações salvas com sucesso.');
                setIntegrationsCompany(prev => ({ ...prev, company_integrations: result.data }));
            } else {
                setSaveError(result?.error || 'Erro desconhecido ao salvar integrações');
            }
        } catch (err) {
            setSaveError(err.message || 'Erro ao salvar integrações');
        }
    };

    const handleTestSync = async (type) => {
        if (!integrationsCompany) return;
        setSyncStatus({ loading: true, result: null });
        try {
            const res = await api.post(`/client/metrics/sync/${type}`, {
                company_id: integrationsCompany.id,
            });
            setSyncStatus({ loading: false, result: { success: true, data: res.data } });
            const fieldPrefix = type === 'ms365' ? 'ms365' : type;
            setIntegrationsCompany(prev => ({
                ...prev,
                company_integrations: {
                    ...(Array.isArray(prev.company_integrations) ? (prev.company_integrations[0] || {}) : (prev.company_integrations || {})),
                    [`${fieldPrefix}_last_sync_at`]: res.data?.lastUpdated || new Date().toISOString(),
                    [`${fieldPrefix}_last_sync_error`]: null,
                    [`${fieldPrefix}_last_sync_count`]: res.data?.count ?? 0,
                },
            }));
        } catch (error) {
            setSyncStatus({
                loading: false,
                result: { success: false, error: error.response?.data?.error || error.message },
            });
        }
    };

    const handleOpenModal = (company = null) => {
        if (company) {
            setEditingCompany(company);
            setFormValues(company);
        } else {
            setEditingCompany(null);
            setFormValues({ name: '', cnpj: '', sector: '', status: 'Ativo' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formValues.name && formValues.cnpj) {
            if (editingCompany) {
                updateCompany({ ...formValues, id: editingCompany.id });
            } else {
                addCompany(formValues);
            }
            setIsModalOpen(false);
        }
    };

    const handleDeleteClick = (id) => {
        if (window.confirm('Tem certeza que deseja excluir esta empresa?')) {
            deleteCompany(id);
        }
    };

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cnpj.includes(searchTerm)
    );

    const currentIntegrations = integrationsCompany
        ? (Array.isArray(integrationsCompany.company_integrations)
            ? (integrationsCompany.company_integrations[0] || {})
            : (integrationsCompany.company_integrations || {}))
        : {};

    const integrationStatuses = [
        {
            name: 'GLPI',
            configured: Boolean(currentIntegrations.glpi_entity_id),
            lastSync: currentIntegrations.glpi_last_sync_at,
            lastError: currentIntegrations.glpi_last_sync_error,
            count: currentIntegrations.glpi_last_sync_count,
        },
        {
            name: 'MS365',
            configured: Boolean(currentIntegrations.ms_graph_tenant_id && currentIntegrations.ms_graph_client_id),
            lastSync: currentIntegrations.ms365_last_sync_at,
            lastError: currentIntegrations.ms365_last_sync_error,
            count: currentIntegrations.ms365_last_sync_count,
        },
        {
            name: 'Zabbix Servidores',
            configured: Boolean(currentIntegrations.zabbix_api_url && currentIntegrations.zabbix_user),
            lastSync: currentIntegrations.zabbix_last_sync_at,
            lastError: currentIntegrations.zabbix_last_sync_error,
            count: currentIntegrations.zabbix_last_sync_count,
        },
        {
            name: 'Zabbix Rede',
            configured: Boolean(currentIntegrations.zabbix_api_url && currentIntegrations.zabbix_user),
            lastSync: currentIntegrations.zabbix_network_last_sync_at,
            lastError: currentIntegrations.zabbix_network_last_sync_error,
            count: currentIntegrations.zabbix_network_last_sync_count,
        },
    ];

    const formatSyncDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Nunca';

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 font-admin">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-normal text-slate-900 tracking-tight">Gestão de Empresas</h1>
                    <p className="text-slate-500 text-lg font-normal">Cadastre e gerencie as empresas do portal</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-normal transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus size={20} />
                    Nova Empresa
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar empresa por nome ou CNPJ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-normal"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Empresa</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">CNPJ</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Setor</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCompanies.map((empresa) => (
                                <tr key={empresa.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <Building2 size={20} />
                                            </div>
                                            <span className="font-normal text-slate-800">{empresa.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-sm font-normal">{empresa.cnpj}</td>
                                    <td className="px-6 py-4 text-slate-600 text-sm font-normal">{empresa.sector}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-normal uppercase tracking-wider ${empresa.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {empresa.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => navigate(`/admin/empresas/${empresa.id}/preview`)}
                                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                title="Visualizar portal"
                                                aria-label={`Visualizar portal de ${empresa.name}`}
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenIntegrationsModal(empresa)}
                                                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                                title="Integrações"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(empresa)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(empresa.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredCompanies.length === 0 && (
                        <div className="p-12 text-center text-slate-400 font-normal">
                            Nenhuma empresa encontrada com este critério.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-normal text-slate-900">
                                    {editingCompany ? 'Editar Empresa' : 'Cadastrar Empresa'}
                                </h2>
                                <p className="text-xs text-slate-500 font-normal uppercase tracking-wider mt-0.5">
                                    {editingCompany ? 'Atualizar dados no portal' : 'Nova Entidade no Portal'}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">Nome da Empresa</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ex: InnerWorks Tecnologia"
                                    value={formValues.name}
                                    onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">CNPJ</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="00.000.000/0001-00"
                                    value={formValues.cnpj}
                                    onChange={(e) => setFormValues({ ...formValues, cnpj: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">Setor</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Tecnologia, Logística"
                                    value={formValues.sector}
                                    onChange={(e) => setFormValues({ ...formValues, sector: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">Status</label>
                                <select
                                    value={formValues.status}
                                    onChange={(e) => setFormValues({ ...formValues, status: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm appearance-none"
                                >
                                    <option value="Ativo">Ativo</option>
                                    <option value="Inativo">Inativo</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-normal text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-normal text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                >
                                    <Check size={18} />
                                    {editingCompany ? 'Salvar Alterações' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Integrações */}
            {isIntegrationsModalOpen && integrationsCompany && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-normal text-slate-900">
                                    Integrações: {integrationsCompany.name}
                                </h2>
                                <p className="text-xs text-slate-500 font-normal uppercase tracking-wider mt-0.5">
                                    Chaves e Tokens de API
                                </p>
                            </div>
                            <button onClick={() => setIsIntegrationsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleIntegrationsSubmit} className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                            
                            {/* Error Banner */}
                            {saveError && (
                                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2">
                                    <AlertCircle size={18} className="text-red-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-sm">Erro ao salvar</p>
                                        <p className="text-xs mt-1">{saveError}</p>
                                    </div>
                                </div>
                            )}

                            {saveSuccess && (
                                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
                                    <CheckCircle size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-sm">Salvo</p>
                                        <p className="text-xs mt-1">{saveSuccess}</p>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50">
                                <h3 className="font-semibold text-slate-800 mb-3">Status das sincronizaÃ§Ãµes</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {integrationStatuses.map((item) => (
                                        <div key={item.name} className="bg-white border border-slate-200 rounded-xl p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                                                <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${item.configured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {item.configured ? 'Configurada' : 'Pendente'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">Ãšltima sync: {formatSyncDate(item.lastSync)}</p>
                                            <p className="text-xs text-slate-500">Contagem: {item.count ?? 0}</p>
                                            {item.lastError && <p className="text-xs text-red-600 mt-1 truncate" title={item.lastError}>Erro: {item.lastError}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* GLPI */}
                            <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                <h3 className="font-semibold text-slate-800 mb-4 flex border-b pb-2">GLPI (Chamados)</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">ID da Entidade</label>
                                        <input type="number" placeholder="Ex: 14" value={integrationValues.glpi_entity_id} onChange={(e) => setIntegrationValues({ ...integrationValues, glpi_entity_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Zabbix */}
                            <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                <h3 className="font-semibold text-slate-800 mb-4 flex border-b pb-2">Zabbix (Monitoramento)</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">URL da API</label>
                                        <input type="text" placeholder="https://zabbix.domain.com/api_jsonrpc.php" value={integrationValues.zabbix_api_url} onChange={(e) => setIntegrationValues({ ...integrationValues, zabbix_api_url: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Usuário Zabbix</label>
                                        <input type="text" value={integrationValues.zabbix_user} onChange={(e) => setIntegrationValues({ ...integrationValues, zabbix_user: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Senha Zabbix</label>
                                        <input type="password" value={integrationValues.zabbix_password} onChange={(e) => setIntegrationValues({ ...integrationValues, zabbix_password: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Microsoft 365 */}
                            <div className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                                <h3 className="font-semibold text-slate-800 mb-4 flex border-b pb-2">Microsoft 365 (Licenças)</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Tenant ID</label>
                                        <input type="text" value={integrationValues.ms_graph_tenant_id} onChange={(e) => setIntegrationValues({ ...integrationValues, ms_graph_tenant_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Client ID</label>
                                        <input type="text" value={integrationValues.ms_graph_client_id} onChange={(e) => setIntegrationValues({ ...integrationValues, ms_graph_client_id: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Client Secret</label>
                                        <input type="password" value={integrationValues.ms_graph_client_secret} onChange={(e) => setIntegrationValues({ ...integrationValues, ms_graph_client_secret: e.target.value })} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                                    </div>
                                </div>
                            </div>

                            {/* Resultado do teste */}
                            {syncStatus.result && (
                                <div className={`p-4 rounded-xl border ${syncStatus.result.success
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-red-50 border-red-200 text-red-800'
                                }`}>
                                    <div className="flex items-start gap-2">
                                        {syncStatus.result.success
                                            ? <CheckCircle size={18} className="text-emerald-600 mt-0.5" />
                                            : <AlertCircle size={18} className="text-red-600 mt-0.5" />
                                        }
                                        <div>
                                            <p className="font-semibold text-sm">
                                                {syncStatus.result.success ? 'Sincronização OK!' : 'Erro na Sincronização'}
                                            </p>
                                            <p className="text-xs mt-1 whitespace-pre-wrap">
                                                {syncStatus.result.success
                                                    ? JSON.stringify(syncStatus.result.data, null, 2)
                                                    : syncStatus.result.error
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Botões de Teste */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Testar Conexão (salve antes)</h4>
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => handleTestSync('glpi')} disabled={syncStatus.loading}
                                        className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-all disabled:opacity-50 flex items-center gap-1.5">
                                        {syncStatus.loading ? <RefreshCw size={12} className="animate-spin" /> : null}
                                        Testar GLPI
                                    </button>
                                    <button type="button" onClick={() => handleTestSync('ms365')} disabled={syncStatus.loading}
                                        className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all disabled:opacity-50 flex items-center gap-1.5">
                                        {syncStatus.loading ? <RefreshCw size={12} className="animate-spin" /> : null}
                                        Testar MS365
                                    </button>
                                    <button type="button" onClick={() => handleTestSync('zabbix')} disabled={syncStatus.loading}
                                        className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-all disabled:opacity-50 flex items-center gap-1.5">
                                        {syncStatus.loading ? <RefreshCw size={12} className="animate-spin" /> : null}
                                        Testar Zabbix
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsIntegrationsModalOpen(false); setSyncStatus({ loading: false, result: null }); }}
                                    className="px-5 py-2.5 text-sm font-normal text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-normal text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
                                >
                                    <Check size={18} />
                                    Salvar Integrações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmpresasAdmin;
