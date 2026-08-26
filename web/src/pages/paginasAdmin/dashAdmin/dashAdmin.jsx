import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Building2, FileText, RefreshCw, ShieldCheck, Users, TrendingUp, CheckCircle2, XCircle, Clock, ArrowRight, Sparkles } from "lucide-react";
import api from '../../../services/api';

const DashAdmin = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/dashboard/stats');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching admin stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-6 lg:p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-10 bg-neutral-200 rounded-xl w-64" />
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-neutral-200 rounded-2xl" />)}
                    </div>
                </div>
            </div>
        );
    }

    const healthLabel = getHealthLabel(stats);
    const cards = [
        {
            title: "Empresas",
            value: stats?.companies?.total || 0,
            subValue: `${stats?.companies?.active || 0} ativas`,
            icon: Building2,
            color: { from: '#3b82f6', to: '#2563eb' },
            path: '/admin/empresasAdmin',
        },
        {
            title: "Usuários",
            value: stats?.users?.total || 0,
            subValue: `${stats?.users?.active || 0} ativos`,
            icon: Users,
            color: { from: '#10b981', to: '#059669' },
            path: '/admin/usuariosAdmin',
        },
        {
            title: "Documentos",
            value: stats?.documents?.total || 0,
            subValue: `${stats?.documents?.stored || 0} armazenados`,
            icon: FileText,
            color: { from: '#8b5cf6', to: '#7c3aed' },
            path: '/admin/docAdmin',
        },
        {
            title: "Saúde Operacional",
            value: healthLabel.value,
            subValue: healthLabel.subtitle,
            icon: healthLabel.icon,
            color: healthLabel.color,
            path: '/admin/auditAdmin',
        },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-6 rounded-full" style={{ background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' }} />
                        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Painel Administrativo</h1>
                    </div>
                    <p className="text-neutral-500 ml-3.5">Visão operacional real do portal</p>
                </div>
                <button
                    onClick={fetchStats}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                        bg-white border border-neutral-200 text-neutral-700
                        hover:bg-neutral-50 hover:border-neutral-300 shadow-sm transition-all"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Atualizar dados
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {cards.map((card, i) => (
                    <div
                        key={i}
                        onClick={() => navigate(card.path)}
                        className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200/60 shadow-sm
                            hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                    >
                        {/* Gradient accent */}
                        <div
                            className="absolute top-0 left-0 right-0 h-1"
                            style={{ background: `linear-gradient(90deg, ${card.color.from}, ${card.color.to})` }}
                        />

                        {/* Glow */}
                        <div
                            className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-500"
                            style={{ background: `radial-gradient(circle, ${card.color.from} 0%, transparent 70%)` }}
                        />

                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-sm font-medium text-neutral-500">{card.title}</h3>
                                </div>
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: `linear-gradient(135deg, ${card.color.from}15, ${card.color.to}08)`,
                                        border: `1px solid ${card.color.from}20`
                                    }}
                                >
                                    <card.icon size={20} style={{ color: card.color.from }} />
                                </div>
                            </div>
                            <div>
                                <span className="text-3xl font-bold text-neutral-900">{card.value}</span>
                                <p className="text-sm text-neutral-500 mt-1">{card.subValue}</p>
                            </div>
                        </div>

                        {/* Arrow */}
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <ArrowRight size={18} className="text-neutral-400 group-hover:text-neutral-600 group-hover:translate-x-1" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Panels Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Integrations Panel */}
                <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-neutral-100">
                        <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Integrações
                        </h2>
                    </div>
                    <div className="p-5 space-y-3">
                        <Metric
                            label="Empresas com integração"
                            value={stats?.integrations?.configured || 0}
                            icon={CheckCircle2}
                            iconColor="text-emerald-600"
                        />
                        <Metric
                            label="Com erro de sync"
                            value={stats?.integrations?.withError || 0}
                            icon={stats?.integrations?.withError ? XCircle : CheckCircle2}
                            iconColor={stats?.integrations?.withError ? 'text-red-600' : 'text-emerald-600'}
                            tone={stats?.integrations?.withError ? 'danger' : 'ok'}
                        />
                        <Metric
                            label="Sem sincronização"
                            value={stats?.integrations?.withoutSync || 0}
                            icon={stats?.integrations?.withoutSync ? AlertTriangle : CheckCircle2}
                            iconColor={stats?.integrations?.withoutSync ? 'text-amber-600' : 'text-emerald-600'}
                            tone={stats?.integrations?.withoutSync ? 'warn' : 'ok'}
                        />
                    </div>
                </div>

                {/* Critical Events Panel */}
                <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Eventos críticos recentes
                        </h2>
                    </div>
                    <div className="p-5">
                        {(stats?.recentCriticalEvents || []).length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle2 size={24} className="text-emerald-500" />
                                </div>
                                <p className="text-sm font-medium text-neutral-700">Nenhum evento crítico</p>
                                <p className="text-xs text-neutral-400 mt-1">Tudo operando normalmente</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {stats.recentCriticalEvents.slice(0, 5).map((event) => (
                                    <TimelineRow
                                        key={event.id}
                                        title={event.entity_name}
                                        text={event.message}
                                        date={event.created_at}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Audit Logs Panel */}
                <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Últimas ações admin
                        </h2>
                    </div>
                    <div className="p-5">
                        {(stats?.recentAuditLogs || []).length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-3">
                                    <Sparkles size={24} className="text-neutral-400" />
                                </div>
                                <p className="text-sm font-medium text-neutral-700">Nenhuma ação registrada</p>
                                <p className="text-xs text-neutral-400 mt-1">As ações aparecerão aqui</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {stats.recentAuditLogs.slice(0, 5).map((log) => (
                                    <TimelineRow
                                        key={log.id}
                                        title={log.action}
                                        text={log.summary}
                                        date={log.created_at}
                                        icon={ShieldCheck}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom spacing */}
            <div className="h-8" />
        </div>
    );
};

function getHealthLabel(stats) {
    if ((stats?.recentCriticalEvents || []).length > 0 || (stats?.integrations?.withError || 0) > 0) {
        return {
            value: "Atenção",
            subtitle: "Há eventos críticos ou integrações com erro",
            icon: AlertTriangle,
            color: { from: '#f59e0b', to: '#d97706' },
        };
    }
    return {
        value: "Estável",
        subtitle: "Sem alerta crítico recente",
        icon: Activity,
        color: { from: '#10b981', to: '#059669' },
    };
}

const Metric = ({ label, value, icon: Icon, iconColor = 'text-neutral-500', tone }) => {
    const tones = {
        danger: 'bg-red-50 text-red-700 border-red-100',
        warn: 'bg-amber-50 text-amber-700 border-amber-100',
        ok: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    };

    return (
        <div className={`flex items-center justify-between p-3 rounded-xl border ${tones[tone] || 'bg-neutral-50 text-neutral-700 border-neutral-100'}`}>
            <div className="flex items-center gap-2">
                <Icon size={16} className={iconColor} />
                <span className="text-sm font-medium">{label}</span>
            </div>
            <span className="font-bold">{value}</span>
        </div>
    );
};

const TimelineRow = ({ title, text, date, icon: Icon = ShieldCheck }) => (
    <div className="p-3 rounded-xl bg-neutral-50/50 border border-neutral-100">
        <div className="flex items-center gap-2 mb-1.5">
            <Icon size={14} className="text-blue-600" />
            <span className="text-sm font-semibold text-neutral-900">{title}</span>
        </div>
        <p className="text-xs text-neutral-600 ml-5">{text}</p>
        <div className="flex items-center gap-1 mt-1.5 ml-5">
            <Clock size={10} className="text-neutral-400" />
            <span className="text-[10px] text-neutral-400">{formatDate(date)}</span>
        </div>
    </div>
);

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR');
}

export default DashAdmin;
