import React, { useState, useEffect } from 'react';
import { Save, Cog, Lock, Check, RefreshCw } from 'lucide-react';
import api from '../../../services/api';

const ConfigAdmin = () => {
    // Estados para os campos
    const [systemName, setSystemName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [sessionTimeout, setSessionTimeout] = useState(30);
    const [loginAttempts, setLoginAttempts] = useState(5);
    const [lockoutTime, setLockoutTime] = useState(15);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [detailedLogs, setDetailedLogs] = useState(true);
    const [twoFactor, setTwoFactor] = useState(false);
    const [strongPassword, setStrongPassword] = useState(true);
    const [passwordExpiration, setPasswordExpiration] = useState(true);

    // Estados de UI
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Carregar configurações salvas
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/admin/settings');
                const s = res.data;
                if (s.systemName) setSystemName(s.systemName);
                if (s.baseUrl) setBaseUrl(s.baseUrl);
                if (s.sessionTimeout) setSessionTimeout(parseInt(s.sessionTimeout));
                if (s.loginAttempts) setLoginAttempts(parseInt(s.loginAttempts));
                if (s.lockoutTime) setLockoutTime(parseInt(s.lockoutTime));
                if (s.maintenanceMode !== undefined) setMaintenanceMode(s.maintenanceMode === 'true');
                if (s.detailedLogs !== undefined) setDetailedLogs(s.detailedLogs === 'true');
                if (s.twoFactor !== undefined) setTwoFactor(s.twoFactor === 'true');
                if (s.strongPassword !== undefined) setStrongPassword(s.strongPassword === 'true');
                if (s.passwordExpiration !== undefined) setPasswordExpiration(s.passwordExpiration === 'true');
            } catch (error) {
                console.error('Erro ao carregar configurações:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // Salvar de verdade na API
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.post('/admin/settings', {
                systemName,
                baseUrl,
                sessionTimeout: String(sessionTimeout),
                loginAttempts: String(loginAttempts),
                lockoutTime: String(lockoutTime),
                maintenanceMode: String(maintenanceMode),
                detailedLogs: String(detailedLogs),
                twoFactor: String(twoFactor),
                strongPassword: String(strongPassword),
                passwordExpiration: String(passwordExpiration),
            });
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            alert('Falha ao salvar: ' + (error.response?.data?.error || error.message));
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
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12 font-admin">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-normal text-slate-900 tracking-tight">Configurações</h1>
                    <p className="text-slate-500 text-lg font-normal">Configurações gerais do sistema</p>
                </div>
                {showSuccess && (
                    <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl border border-emerald-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                        <Check size={20} />
                        <span className="text-sm font-normal">Configurações salvas com sucesso!</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sistema */}
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
                            <input type="text" value={systemName} onChange={(e) => setSystemName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-normal text-slate-700">URL Base</label>
                            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-normal text-slate-700">Timeout de Sessão (minutos)</label>
                            <input type="number" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                        </div>
                        <div className="pt-4 space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[15px] font-normal text-slate-800">Modo de Manutenção</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-tight">Ativar página de manutenção</p>
                                </div>
                                <Switch enabled={maintenanceMode} onChange={setMaintenanceMode} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[15px] font-normal text-slate-800">Logs Detalhados</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-tight">Registrar logs de debug</p>
                                </div>
                                <Switch enabled={detailedLogs} onChange={setDetailedLogs} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Segurança */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col space-y-8">
                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Lock size={24} strokeWidth={1.5} />
                        </div>
                        <h2 className="text-2xl font-normal text-slate-800">Segurança</h2>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[15px] font-normal text-slate-800">Autenticação de Dois Fatores</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-tight">Exigir 2FA para todos os usuários</p>
                                </div>
                                <Switch enabled={twoFactor} onChange={setTwoFactor} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[15px] font-normal text-slate-800">Forçar Senha Forte</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-tight">Mínimo de 8 caracteres com números e símbolos</p>
                                </div>
                                <Switch enabled={strongPassword} onChange={setStrongPassword} />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[15px] font-normal text-slate-800">Expiração de Senha</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-tight">Forçar troca de senha a cada 90 dias</p>
                                </div>
                                <Switch enabled={passwordExpiration} onChange={setPasswordExpiration} />
                            </div>
                        </div>
                        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-normal text-slate-700">Tentativas de Login Permitidas</label>
                                <input type="number" value={loginAttempts} onChange={(e) => setLoginAttempts(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-normal text-slate-700">Tempo de Bloqueio (minutos)</label>
                                <input type="number" value={lockoutTime} onChange={(e) => setLockoutTime(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button onClick={handleSave} disabled={isSaving}
                    className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-normal transition-all shadow-lg shadow-blue-500/20 active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
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
