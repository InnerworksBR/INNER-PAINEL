import React, { useState, useEffect } from 'react';
import { Building2, Users, FileText, Activity, RefreshCw } from "lucide-react";
import api from '../../../services/api';

const DashAdmin = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/admin/dashboard/stats');
                setStats(response.data);
            } catch (error) {
                console.error('Error fetching admin stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[300px]">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-500">Carregando dashboard...</span>
            </div>
        );
    }

    const cards = [
        {
            title: "Empresas Ativas",
            value: stats?.companies || 0,
            icon: Building2,
            color: "bg-blue-50 text-blue-600",
        },
        {
            title: "Usuários Totais",
            value: stats?.users?.total || 0,
            subtitle: `${stats?.users?.admins || 0} admins / ${stats?.users?.clients || 0} clientes`,
            icon: Users,
            color: "bg-emerald-50 text-emerald-600",
        },
        {
            title: "Documentos",
            value: stats?.documents || 0,
            icon: FileText,
            color: "bg-violet-50 text-violet-600",
        },
        {
            title: "Status do Sistema",
            value: "Operacional",
            icon: Activity,
            color: "bg-green-50 text-green-600",
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-slate-800">Painel Administrativo</h1>
                <p className="text-slate-500 text-lg">Visão geral do sistema e métricas</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-sm font-semibold text-slate-500">{card.title}</h3>
                            <div className={`p-2 rounded-lg ${card.color}`}>
                                <card.icon size={20} />
                            </div>
                        </div>
                        <div>
                            <span className="text-3xl font-bold text-slate-800">{card.value}</span>
                            {card.subtitle && (
                                <p className="text-xs text-slate-500 mt-2">{card.subtitle}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Resumo Rápido */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Resumo do Sistema</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 text-sm">Empresas cadastradas</span>
                            <span className="font-bold text-slate-800">{stats?.companies || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 text-sm">Administradores</span>
                            <span className="font-bold text-slate-800">{stats?.users?.admins || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 text-sm">Clientes (Gestores)</span>
                            <span className="font-bold text-slate-800">{stats?.users?.clients || 0}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600 text-sm">Documentos no sistema</span>
                            <span className="font-bold text-slate-800">{stats?.documents || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Ações Rápidas</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => window.location.href = '/admin/empresasAdmin'}
                            className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                        >
                            <Building2 size={20} className="text-blue-600 mb-2" />
                            <span className="text-sm font-semibold text-slate-700">Nova Empresa</span>
                        </button>
                        <button
                            onClick={() => window.location.href = '/admin/usuariosAdmin'}
                            className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                        >
                            <Users size={20} className="text-emerald-600 mb-2" />
                            <span className="text-sm font-semibold text-slate-700">Novo Usuário</span>
                        </button>
                        <button
                            onClick={() => window.location.href = '/admin/docAdmin'}
                            className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                        >
                            <FileText size={20} className="text-violet-600 mb-2" />
                            <span className="text-sm font-semibold text-slate-700">Novo Documento</span>
                        </button>
                        <button
                            onClick={() => window.location.href = '/admin/configAdmin'}
                            className="p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                        >
                            <Activity size={20} className="text-amber-600 mb-2" />
                            <span className="text-sm font-semibold text-slate-700">Configurações</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashAdmin;
