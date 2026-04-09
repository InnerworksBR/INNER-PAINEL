<<<<<<< HEAD
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
=======
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Activity, Users, FileText, ChevronRight, Settings } from 'lucide-react';

const DashAdmin = () => {
    const navigate = useNavigate();

    const stats = [
        {
            title: "Empresas Cadastradas",
            value: "4",
            icon: <Building2 className="text-blue-600" size={24} />,
            borderColor: "border-blue-100",
            iconBg: "bg-blue-50"
        },
        {
            title: "Usuários",
            value: "86",
            icon: <Users className="text-purple-600" size={24} />,
            borderColor: "border-purple-100",
            iconBg: "bg-purple-50"
        },
        {
            title: "Documentos",
            value: "312",
            icon: <FileText className="text-orange-600" size={24} />,
            borderColor: "border-orange-100",
            iconBg: "bg-orange-50"
        }
    ];

    const quickActions = [
        {
            title: "Gerenciar Empresas",
            description: "Cadastrar e editar empresas",
            icon: <Building2 className="text-blue-600" size={20} />,
            bg: "bg-blue-50",
            path: "/admin/empresasAdmin"
        },
        {
            title: "Documentação",
            description: "Upload e gestão de documentos",
            icon: <FileText className="text-orange-600" size={20} />,
            bg: "bg-orange-50",
            path: "/admin/docAdmin"
        },
        {
            title: "Usuários",
            description: "Controle de usuários e acessos",
            icon: <Users className="text-green-600" size={20} />,
            bg: "bg-green-50",
            path: "/admin/usuariosAdmin"
        },
        {
            title: "Configurações",
            description: "Configurações gerais do sistema",
            icon: <Settings className="text-slate-600" size={20} />,
            bg: "bg-slate-50",
            path: "/admin/configAdmin"
        }
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 font-admin">
            {/* Topo da página */}
            <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-normal text-slate-900 tracking-tight">Dashboard</h1>
                <p className="text-slate-500 text-lg font-normal font-light">Visão geral do sistema administrativo</p>
            </div>

            {/* Cartões de estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className={`bg-white p-6 rounded-2xl shadow-sm border ${stat.borderColor} hover:shadow-md transition-all duration-300 relative group`}>
                        <div className={`absolute top-6 right-6 p-2.5 ${stat.iconBg} rounded-xl transition-colors`}>
                            {stat.icon}
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-normal text-slate-500 uppercase tracking-wider font-light">{stat.title}</p>
                            <h3 className="text-3xl font-normal text-slate-900">{stat.value}</h3>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
                        </div>
                    </div>
                ))}
            </div>

<<<<<<< HEAD
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
=======
            {/* Seção de Acesso Rápido */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                <h2 className="text-2xl font-normal text-slate-800">Acesso Rápido</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {quickActions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(action.path)}
                            className="flex flex-col items-start p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all duration-300 text-left group w-full"
                        >
                            <div className={`p-4 ${action.bg} rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                {action.icon}
                            </div>
                            <h4 className="text-lg font-normal text-slate-800 mb-1">{action.title}</h4>
                            <p className="text-sm text-slate-500 leading-relaxed mb-4 font-light">{action.description}</p>
                            <div className="flex items-center text-blue-600 font-normal text-sm mt-auto">
                                Acessar área
                                <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Rodapé Info */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center rounded-3xl">
                <p className="text-xs font-normal text-slate-400 uppercase tracking-widest font-light">
                    Portal de Administração InnerWorks Tecnologia
                </p>
            </div>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
        </div>
    );
};

export default DashAdmin;
