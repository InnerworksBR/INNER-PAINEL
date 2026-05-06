import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Building2, FileText, RefreshCw, ShieldCheck, Users } from "lucide-react";
import api from '../../../services/api';

const DashAdmin = () => {
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
            <div className="p-8 flex items-center justify-center min-h-[300px]">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-500">Carregando dashboard...</span>
            </div>
        );
    }

    const healthLabel = getHealthLabel(stats);
    const cards = [
        {
            title: "Empresas",
            value: stats?.companies?.total || 0,
            subtitle: `${stats?.companies?.active || 0} ativas`,
            icon: Building2,
            color: "bg-blue-50 text-blue-600",
        },
        {
            title: "Usuários",
            value: stats?.users?.total || 0,
            subtitle: `${stats?.users?.active || 0} ativos / ${stats?.users?.blocked || 0} bloqueados`,
            icon: Users,
            color: "bg-emerald-50 text-emerald-600",
        },
        {
            title: "Documentos",
            value: stats?.documents?.total || 0,
            subtitle: `${stats?.documents?.stored || 0} armazenados / ${stats?.documents?.pending || 0} pendentes`,
            icon: FileText,
            color: "bg-violet-50 text-violet-600",
        },
        {
            title: "Saúde Operacional",
            value: healthLabel.value,
            subtitle: healthLabel.subtitle,
            icon: healthLabel.icon,
            color: healthLabel.color,
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold text-slate-800">Painel Administrativo</h1>
                    <p className="text-slate-500 text-lg">Visão operacional real do portal</p>
                </div>
                <button onClick={fetchStats} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                    <RefreshCw size={16} />
                    Atualizar
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-sm font-semibold text-slate-500">{card.title}</h3>
                            <div className={`p-2 rounded-lg ${card.color}`}>
                                <card.icon size={20} />
                            </div>
                        </div>
                        <span className="text-3xl font-bold text-slate-800">{card.value}</span>
                        <p className="text-xs text-slate-500 mt-2">{card.subtitle}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Panel title="Integrações">
                    <Metric label="Empresas com integração" value={stats?.integrations?.configured || 0} />
                    <Metric label="Com erro de sync" value={stats?.integrations?.withError || 0} tone={stats?.integrations?.withError ? 'danger' : 'ok'} />
                    <Metric label="Sem nenhuma sincronização" value={stats?.integrations?.withoutSync || 0} tone={stats?.integrations?.withoutSync ? 'warn' : 'ok'} />
                </Panel>

                <Panel title="Eventos críticos recentes">
                    {(stats?.recentCriticalEvents || []).length === 0 ? (
                        <Empty text="Nenhum evento crítico recente." />
                    ) : stats.recentCriticalEvents.map((event) => (
                        <TimelineRow key={event.id} title={event.entity_name} text={event.message} date={event.created_at} />
                    ))}
                </Panel>

                <Panel title="Últimas ações admin">
                    {(stats?.recentAuditLogs || []).length === 0 ? (
                        <Empty text="Nenhuma ação registrada ainda." />
                    ) : stats.recentAuditLogs.map((log) => (
                        <TimelineRow key={log.id} title={log.action} text={log.summary} date={log.created_at} />
                    ))}
                </Panel>
            </div>
        </div>
    );
};

function getHealthLabel(stats) {
    if ((stats?.recentCriticalEvents || []).length > 0 || (stats?.integrations?.withError || 0) > 0) {
        return {
            value: "Atenção",
            subtitle: "Há eventos críticos ou integrações com erro",
            icon: AlertTriangle,
            color: "bg-amber-50 text-amber-600",
        };
    }
    return {
        value: "Estável",
        subtitle: "Sem alerta crítico recente",
        icon: Activity,
        color: "bg-green-50 text-green-600",
    };
}

const Panel = ({ title, children }) => (
    <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">{title}</h2>
        <div className="space-y-3">{children}</div>
    </section>
);

const Metric = ({ label, value, tone }) => {
    const tones = {
        danger: 'text-red-700 bg-red-50',
        warn: 'text-amber-700 bg-amber-50',
        ok: 'text-emerald-700 bg-emerald-50',
    };
    return (
        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-600 text-sm">{label}</span>
            <span className={`font-bold px-2 py-1 rounded-md ${tones[tone] || 'text-slate-800'}`}>{value}</span>
        </div>
    );
};

const TimelineRow = ({ title, text, date }) => (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ShieldCheck size={14} className="text-blue-600" />
            {title}
        </div>
        <p className="text-sm text-slate-600 mt-1">{text}</p>
        <p className="text-xs text-slate-400 mt-1">{formatDate(date)}</p>
    </div>
);

const Empty = ({ text }) => <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">{text}</p>;

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString('pt-BR');
}

export default DashAdmin;
