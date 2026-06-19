import React, { useState, useEffect } from 'react';
import { Save, Cog, Check, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../../services/api';

const ConfigAdmin = () => {
    const [systemName, setSystemName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [sessionTimeout, setSessionTimeout] = useState(30);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [detailedLogs, setDetailedLogs] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/admin/settings');
                const s = res.data;
                if (s.systemName) setSystemName(s.systemName);
                if (s.baseUrl) setBaseUrl(s.baseUrl);
                if (s.sessionTimeout) setSessionTimeout(parseInt(s.sessionTimeout, 10));
                if (s.maintenanceMode !== undefined) setMaintenanceMode(s.maintenanceMode === 'true');
                if (s.detailedLogs !== undefined) setDetailedLogs(s.detailedLogs === 'true');
            } catch (error) {
                console.error('Erro ao carregar configurações:', error);
                setErrorMessage('Falha ao carregar configurações.');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setErrorMessage('');
        const timeoutValue = Number(sessionTimeout);
        if (timeoutValue < 5) {
            setErrorMessage('O timeout mínimo é 5 minutos.');
            return;
        }
        if (timeoutValue > 480) {
            setErrorMessage('O timeout máximo é 480 minutos (8 horas).');
            return;
        }
        if (!systemName?.trim()) {
            setErrorMessage('O nome do sistema não pode ficar em branco.');
            return;
        }
        setIsSaving(true);
        try {
            await api.post('/admin/settings', {
                systemName,
                baseUrl,
                sessionTimeout: String(sessionTimeout),
                maintenanceMode: String(maintenanceMode),
                detailedLogs: String(detailedLogs),
            });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            setErrorMessage('Falha ao salvar: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    const Switch = ({ enabled, onChange }) => (
        <button
            type="button"
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enabled ? 'bg-blue-600' : 'bg-slate-300'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    );

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[300px]">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-500">Carregando configurações...</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 font-admin">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-normal text-slate-900 tracking-tight">Configurações</h1>
                    <p className="text-slate-500 text-lg font-normal">Somente controles com efeito real em produção mínima</p>
                </div>
                {showSuccess && (
                    <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl border border-emerald-100 flex items-center gap-3">
                        <Check size={20} />
                        <span className="text-sm font-normal">Configurações salvas com sucesso!</span>
                    </div>
                )}
            </div>

            {errorMessage && (
                <div className="bg-red-50 text-red-700 px-6 py-3 rounded-2xl border border-red-100 flex items-center gap-3">
                    <AlertCircle size={20} />
                    <span className="text-sm font-normal">{errorMessage}</span>
                </div>
            )}

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col space-y-8">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Cog size={24} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-2xl font-normal text-slate-800">Sistema</h2>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-normal text-slate-700">Nome do Sistema</label>
                        <input
                            type="text"
                            value={systemName}
                            onChange={(e) => setSystemName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-normal text-slate-700">URL Base</label>
                        <input
                            type="text"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-normal text-slate-700">Timeout de Sessão (minutos)</label>
                        <input
                            type="number"
                            min="5"
                            max="480"
                            value={sessionTimeout}
                            onChange={(e) => setSessionTimeout(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>

                    <div className="pt-4 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[15px] font-normal text-slate-800">Modo de Manutenção</p>
                                <p className="text-xs text-slate-500 uppercase tracking-tight">Bloqueia clientes e visitantes; admins continuam acessando</p>
                            </div>
                            <Switch enabled={maintenanceMode} onChange={setMaintenanceMode} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[15px] font-normal text-slate-800">Logs Detalhados</p>
                                <p className="text-xs text-slate-500 uppercase tracking-tight">Exibe logs técnicos extras nas sincronizações</p>
                            </div>
                            <Switch enabled={detailedLogs} onChange={setDetailedLogs} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-normal transition-all shadow-lg shadow-blue-500/20 active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isSaving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Save size={20} />
                    )}
                    {isSaving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
            </div>
        </div>
    );
};

export default ConfigAdmin;
