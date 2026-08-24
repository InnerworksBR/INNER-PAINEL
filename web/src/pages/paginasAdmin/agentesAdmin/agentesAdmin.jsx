import React, { useState, useEffect } from 'react';
import { Cpu, Radio, Key, Plus, RefreshCw, Copy, Check, Trash2, ShieldAlert, CheckCircle2, XCircle, Terminal, HardDrive, Network } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
import api from '../../../services/api';

const AgentesAdmin = () => {
    const { companies } = useCompanies();
    const [tokens, setTokens] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Estado para coletores SNMP
    const [snmpCollectors, setSnmpCollectors] = useState([]);
    const [isSnmpModalOpen, setIsSnmpModalOpen] = useState(false);
    const [editingCollector, setEditingCollector] = useState(null);
    const [snmpForm, setSnmpForm] = useState({
        company_id: '',
        name: '',
        ip_range_start: '',
        ip_range_end: '',
        community_string: 'public',
        snmp_version: '2c',
        snmp_port: 161,
        interval_seconds: 300,
        enabled: true
    });

    // Modal para Gerar Token
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [tokenLabel, setTokenLabel] = useState('Instalação Cliente');
    const [daysValid, setDaysValid] = useState(30);
    const [createdToken, setCreatedToken] = useState(null);
    const [copiedField, setCopiedField] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [tokensRes, agentsRes, snmpRes] = await Promise.all([
                api.get('/admin/agents/tokens'),
                api.get('/admin/agents/list'),
                api.get('/admin/snmp/collectors').catch(() => ({ data: [] }))
            ]);
            setTokens(tokensRes.data || []);
            setAgents(agentsRes.data || []);
            setSnmpCollectors(snmpRes.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao carregar dados dos agentes.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreateToken = async (e) => {
        e.preventDefault();
        if (!selectedCompanyId) return;

        try {
            const res = await api.post('/admin/agents/tokens', {
                company_id: selectedCompanyId,
                label: tokenLabel,
                days_valid: Number(daysValid)
            });
            setCreatedToken(res.data);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao gerar token.');
        }
    };

    const handleRevokeToken = async (tokenId) => {
        if (!window.confirm('Tem certeza que deseja revogar este token de ativação?')) return;
        try {
            await api.post(`/admin/agents/tokens/${tokenId}/revoke`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao revogar token.');
        }
    };

    const handleDeleteAgent = async (agentId) => {
        if (!window.confirm('Tem certeza que deseja remover este agente registrado?')) return;
        try {
            await api.delete(`/admin/agents/${agentId}`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao remover agente.');
        }
    };

    // SNMP Collector handlers
    const handleOpenSnmpModal = (collector = null) => {
        if (collector) {
            setEditingCollector(collector);
            setSnmpForm({
                company_id: collector.company_id,
                name: collector.name || '',
                ip_range_start: collector.ip_range_start || '',
                ip_range_end: collector.ip_range_end || '',
                community_string: collector.community_string || 'public',
                snmp_version: collector.snmp_version || '2c',
                snmp_port: collector.snmp_port || 161,
                interval_seconds: collector.interval_seconds || 300,
                enabled: collector.enabled !== false
            });
        } else {
            setEditingCollector(null);
            setSnmpForm({
                company_id: companies[0]?.id || '',
                name: '',
                ip_range_start: '',
                ip_range_end: '',
                community_string: 'public',
                snmp_version: '2c',
                snmp_port: 161,
                interval_seconds: 300,
                enabled: true
            });
        }
        setIsSnmpModalOpen(true);
    };

    const handleSaveSnmpCollector = async (e) => {
        e.preventDefault();
        try {
            if (editingCollector) {
                await api.patch(`/admin/snmp/collectors/${editingCollector.id}`, snmpForm);
            } else {
                await api.post('/admin/snmp/collectors', snmpForm);
            }
            setIsSnmpModalOpen(false);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar coletor SNMP.');
        }
    };

    const handleDeleteSnmpCollector = async (collectorId) => {
        if (!window.confirm('Tem certeza que deseja remover este coletor SNMP?')) return;
        try {
            await api.delete(`/admin/snmp/collectors/${collectorId}`);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao remover coletor.');
        }
    };

    const copyToClipboard = (text, fieldName) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(''), 2500);
    };

    const baseUrl = window.location.origin.includes('localhost')
        ? 'http://localhost:3000/api'
        : `${window.location.origin}/api`;

    // Estatísticas
    const totalAgents = agents.length;
    const endpoints = agents.filter(a => a.agent_type === 'endpoint').length;
    const collectors = agents.filter(a => a.agent_type === 'collector').length;
    const onlineCount = agents.filter(a => a.computed_status === 'Online').length;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                        <Radio className="text-blue-600" size={28} />
                        Central de Agentes & Coletores Nativos
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Gerenciamento de chaves de ativação, instaladores automatizados e acompanhamento dos agentes Inner.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                    <button
                        onClick={() => handleOpenSnmpModal()}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center gap-2 text-sm transition-colors"
                    >
                        <Network size={16} />
                        Configurar Coletores SNMP
                    </button>
                    <button
                        onClick={() => {
                            setCreatedToken(null);
                            setSelectedCompanyId(companies[0]?.id || '');
                            setIsModalOpen(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-2 text-sm shadow-sm transition-colors"
                    >
                        <Plus size={18} />
                        Gerar Chave de Ativação
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

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Total de Agentes</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalAgents}</h3>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Cpu size={24} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Agentes de Máquina</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{endpoints}</h3>
                    </div>
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                        <HardDrive size={24} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Coletores de Rede LAN</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">{collectors}</h3>
                    </div>
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                        <Network size={24} />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">Status Online</p>
                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">{onlineCount} / {totalAgents}</h3>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle2 size={24} />
                    </div>
                </div>
            </div>

            {/* Tabela de Agentes Registrados */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">Agentes Conectados & Chaves de Ativos</h2>
                        <p className="text-slate-500 text-xs mt-0.5">Máquinas e coletores enviando métricas em tempo real para o portal.</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                            <tr>
                                <th className="p-4">Hostname / Dispositivo</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Chave do Ativo (Portal)</th>
                                <th className="p-4">Empresa</th>
                                <th className="p-4">IP / SO</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Último Heartbeat</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {agents.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400">
                                        Nenhum agente instalado ou conectado até o momento.
                                    </td>
                                </tr>
                            ) : (
                                agents.map((agent) => (
                                    <tr key={agent.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-4 font-medium text-slate-800 flex items-center gap-2">
                                            {agent.agent_type === 'collector' ? (
                                                <Network className="text-purple-600" size={16} />
                                            ) : (
                                                <HardDrive className="text-blue-600" size={16} />
                                            )}
                                            {agent.hostname}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                                                agent.agent_type === 'collector' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {agent.agent_type === 'collector' ? 'Coletor de Rede' : 'Agente de Máquina'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded border border-slate-200 font-bold">
                                                {agent.asset_key}
                                            </span>
                                        </td>
                                        <td className="p-4 font-medium text-slate-700">
                                            {agent.companies?.name || 'Sem empresa'}
                                        </td>
                                        <td className="p-4 text-xs text-slate-500">
                                            <div>{agent.ip_address || 'IP N/D'}</div>
                                            <div className="truncate max-w-[160px] text-slate-400">{agent.os_info}</div>
                                        </td>
                                        <td className="p-4">
                                            {agent.computed_status === 'Online' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    Online
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                                                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                                    Offline
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs text-slate-500">
                                            {new Date(agent.last_heartbeat).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleDeleteAgent(agent.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                                title="Revogar Agente"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Secao de Coletores SNMP */}
            <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Network size={20} className="text-purple-600" />
                            Coletores SNMP Configurados
                        </h2>
                        <p className="text-slate-500 text-xs mt-0.5">
                            Configure o scan de dispositivos de rede (switches, roteadores, access points, impressoras).
                        </p>
                    </div>
                    <button
                        onClick={() => handleOpenSnmpModal()}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg flex items-center gap-2"
                    >
                        <Plus size={16} />
                        Novo Coletor
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-purple-50 text-purple-700 font-medium border-b border-purple-100">
                            <tr>
                                <th className="p-4">Nome</th>
                                <th className="p-4">Empresa</th>
                                <th className="p-4">Range de IPs</th>
                                <th className="p-4">Community</th>
                                <th className="p-4">Intervalo</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {snmpCollectors.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        Nenhum coletor SNMP configurado. Clique em "Novo Coletor" para adicionar.
                                    </td>
                                </tr>
                            ) : (
                                snmpCollectors.map((col) => (
                                    <tr key={col.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-4 font-medium text-slate-800">{col.name}</td>
                                        <td className="p-4">{col.companies?.name || '-'}</td>
                                        <td className="p-4 font-mono text-xs">
                                            {col.ip_range_start} - {col.ip_range_end}
                                        </td>
                                        <td className="p-4 font-mono text-xs">{col.community_string}</td>
                                        <td className="p-4">{col.interval_seconds}s</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${col.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {col.enabled ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleOpenSnmpModal(col)}
                                                className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSnmpCollector(col.id)}
                                                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs ml-2"
                                            >
                                                Remover
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Coletores SNMP */}
            {isSnmpModalOpen && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-800">Chaves / Tokens de Ativação Ativos</h2>
                    <p className="text-slate-500 text-xs mt-0.5">Tokens que os instaladores utilizam para vincular novos agentes aos clientes.</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
                            <tr>
                                <th className="p-4">Chave de Ativação (Token)</th>
                                <th className="p-4">Empresa</th>
                                <th className="p-4">Identificação / Rótulo</th>
                                <th className="p-4">Expiração</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tokens.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                        Nenhum token de ativação gerado ainda. Clique em "Gerar Chave de Ativação".
                                    </td>
                                </tr>
                            ) : (
                                tokens.map((t) => (
                                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="p-4 font-mono font-bold text-blue-700">
                                            {t.token}
                                        </td>
                                        <td className="p-4 font-medium text-slate-800">
                                            {t.companies?.name || 'Sem empresa'}
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            {t.label}
                                        </td>
                                        <td className="p-4 text-xs text-slate-500">
                                            {t.expires_at ? new Date(t.expires_at).toLocaleDateString('pt-BR') : 'Sem expiração'}
                                        </td>
                                        <td className="p-4">
                                            {t.is_active ? (
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-semibold">Ativo</span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-semibold">Revogado</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            {t.is_active && (
                                                <button
                                                    onClick={() => handleRevokeToken(t.id)}
                                                    className="px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                                                >
                                                    Revogar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Coletores SNMP */}
            {isSnmpModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-xl font-semibold text-slate-800">
                                {editingCollector ? 'Editar' : 'Novo'} Coletor SNMP
                            </h2>
                            <p className="text-slate-500 text-sm mt-1">
                                Configure o range de IPs e parametros SNMP para descoberta de dispositivos.
                            </p>
                        </div>

                        <form onSubmit={handleSaveSnmpCollector} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
                                <select
                                    value={snmpForm.company_id}
                                    onChange={(e) => setSnmpForm({ ...snmpForm, company_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                >
                                    <option value="">Selecione a empresa</option>
                                    {companies.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Coletor</label>
                                <input
                                    type="text"
                                    value={snmpForm.name}
                                    onChange={(e) => setSnmpForm({ ...snmpForm, name: e.target.value })}
                                    placeholder="Ex: Rede Principal"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">IP Inicial</label>
                                    <input
                                        type="text"
                                        value={snmpForm.ip_range_start}
                                        onChange={(e) => setSnmpForm({ ...snmpForm, ip_range_start: e.target.value })}
                                        placeholder="192.168.1.1"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">IP Final</label>
                                    <input
                                        type="text"
                                        value={snmpForm.ip_range_end}
                                        onChange={(e) => setSnmpForm({ ...snmpForm, ip_range_end: e.target.value })}
                                        placeholder="192.168.1.254"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Community String</label>
                                <input
                                    type="text"
                                    value={snmpForm.community_string}
                                    onChange={(e) => setSnmpForm({ ...snmpForm, community_string: e.target.value })}
                                    placeholder="public"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Intervalo (segundos)</label>
                                    <input
                                        type="number"
                                        value={snmpForm.interval_seconds}
                                        onChange={(e) => setSnmpForm({ ...snmpForm, interval_seconds: Number(e.target.value) })}
                                        min="60"
                                        max="3600"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <select
                                        value={snmpForm.enabled ? 'true' : 'false'}
                                        onChange={(e) => setSnmpForm({ ...snmpForm, enabled: e.target.value === 'true' })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                    >
                                        <option value="true">Ativo</option>
                                        <option value="false">Inativo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsSnmpModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                                >
                                    {editingCollector ? 'Salvar' : 'Criar'} Coletor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Gerar Chave de Ativação & Exibir Comandos */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
                        {!createdToken ? (
                            <form onSubmit={handleCreateToken} className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Key className="text-blue-600" size={22} />
                                        Gerar Nova Chave de Ativação
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Empresa / Cliente</label>
                                    <select
                                        value={selectedCompanyId}
                                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white"
                                        required
                                    >
                                        <option value="">Selecione a empresa...</option>
                                        {companies.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Identificação / Rótulo</label>
                                    <input
                                        type="text"
                                        value={tokenLabel}
                                        onChange={(e) => setTokenLabel(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                                        placeholder="Ex: Instalação Servidores Filial SP"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Validade (em dias)</label>
                                    <input
                                        type="number"
                                        value={daysValid}
                                        onChange={(e) => setDaysValid(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg text-sm"
                                        min={1}
                                        max={365}
                                        required
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                    >
                                        Gerar Token
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-5">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <h3 className="text-xl font-bold text-emerald-600 flex items-center gap-2">
                                        <CheckCircle2 size={24} />
                                        Chave Gerada com Sucesso!
                                    </h3>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="p-4 bg-slate-900 rounded-xl text-white">
                                    <p className="text-xs text-slate-400 uppercase font-semibold">Chave / Token de Ativação</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="font-mono text-2xl font-bold text-yellow-400 tracking-wider">
                                            {createdToken.token}
                                        </span>
                                        <button
                                            onClick={() => copyToClipboard(createdToken.token, 'token')}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg text-slate-300 flex items-center gap-1.5 border border-slate-700"
                                        >
                                            {copiedField === 'token' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                            {copiedField === 'token' ? 'Copiado!' : 'Copiar Chave'}
                                        </button>
                                    </div>
                                </div>

                                {/* Comando 1: Agente de Máquina */}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                        <Terminal size={16} className="text-blue-600" />
                                        Comando de Instalação: Agente de Máquina (Windows PowerShell)
                                    </h4>
                                    <div className="p-3 bg-slate-800 text-slate-200 font-mono text-xs rounded-lg flex items-center justify-between overflow-x-auto">
                                        <code>powershell -ExecutionPolicy Bypass -File .\install-windows.ps1 -ApiUrl "{baseUrl}" -ActivationToken "{createdToken.token}"</code>
                                        <button
                                            onClick={() => copyToClipboard(`powershell -ExecutionPolicy Bypass -File .\\install-windows.ps1 -ApiUrl "${baseUrl}" -ActivationToken "${createdToken.token}"`, 'cmd1')}
                                            className="ml-2 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 flex items-center gap-1"
                                        >
                                            {copiedField === 'cmd1' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Comando 2: Coletor de Rede */}
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                        <Network size={16} className="text-purple-600" />
                                        Comando de Instalação: Coletor de Rede LAN (PABX / Impressoras / Switches)
                                    </h4>
                                    <div className="p-3 bg-slate-800 text-slate-200 font-mono text-xs rounded-lg flex items-center justify-between overflow-x-auto">
                                        <code>powershell -ExecutionPolicy Bypass -File .\install-collector.ps1 -ApiUrl "{baseUrl}" -ActivationToken "{createdToken.token}"</code>
                                        <button
                                            onClick={() => copyToClipboard(`powershell -ExecutionPolicy Bypass -File .\\install-collector.ps1 -ApiUrl "${baseUrl}" -ActivationToken "${createdToken.token}"`, 'cmd2')}
                                            className="ml-2 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 flex items-center gap-1"
                                        >
                                            {copiedField === 'cmd2' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                    >
                                        Concluído
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentesAdmin;
