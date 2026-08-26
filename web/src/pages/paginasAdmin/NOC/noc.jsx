import React, { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle, Building2, CheckCircle2, Clock, XCircle, Monitor, Maximize2, RefreshCw, Signal, Ticket, TrendingUp, X } from "lucide-react";
import api from '../../../services/api';

const NOC = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch NOC stats
    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/noc/stats');
            setStats(response.data);
        } catch (error) {
            console.error('Error fetching NOC stats:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load and auto-refresh every 30 seconds
    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [fetchStats]);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    // Handle F11 key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleFullscreen]);

    // Format time
    const formatTime = (date) => {
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    // Format date
    const formatDate = (date) => {
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    // Get status color classes
    const getStatusClasses = (status) => {
        switch (status) {
            case 'online':
                return { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400', icon: CheckCircle2 };
            case 'warning':
                return { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400', icon: AlertTriangle };
            case 'critical':
                return { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-400', icon: XCircle };
            case 'offline':
            default:
                return { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-400', icon: XCircle };
        }
    };

    // Get severity classes
    const getSeverityClasses = (severity) => {
        switch (severity) {
            case 'critical':
                return 'bg-red-500/30 border-red-500 text-red-300';
            case 'warning':
                return 'bg-amber-500/30 border-amber-500 text-amber-300';
            case 'info':
            default:
                return 'bg-blue-500/30 border-blue-500 text-blue-300';
        }
    };

    // Loading state
    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-xl">Carregando NOC...</p>
                </div>
            </div>
        );
    }

    const statusCounts = stats?.statusCounts || { online: 0, warning: 0, critical: 0, offline: 0 };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 lg:p-6">
            {/* Header */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Monitor className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">NOC - INNER SOLUTIONS</h1>
                        <p className="text-slate-400 text-lg">Network Operations Center</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-4xl lg:text-5xl font-bold text-white tabular-nums">
                            {formatTime(currentTime)}
                        </div>
                        <div className="text-slate-400 text-sm capitalize">
                            {formatDate(currentTime)}
                        </div>
                    </div>
                    <button
                        onClick={fetchStats}
                        className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                        title="Atualizar (F11 para fullscreen)"
                    >
                        <RefreshCw className={`w-6 h-6 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={toggleFullscreen}
                        className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
                        title="Fullscreen (F11)"
                    >
                        <Maximize2 className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
            </header>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <SummaryCard
                    title="Total Empresas"
                    value={stats?.totalCompanies || 0}
                    icon={Building2}
                    color="blue"
                />
                <SummaryCard
                    title="Críticos"
                    value={statusCounts.critical}
                    icon={XCircle}
                    color="red"
                />
                <SummaryCard
                    title="Alertas"
                    value={statusCounts.warning}
                    icon={AlertTriangle}
                    color="amber"
                />
                <SummaryCard
                    title="Online"
                    value={statusCounts.online}
                    icon={CheckCircle2}
                    color="emerald"
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Companies Status Table */}
                <div className="lg:col-span-2 bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                        <Signal className="w-6 h-6 text-blue-400" />
                        <h2 className="text-xl font-bold">Status das Empresas</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Empresa</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400">Status</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400">Tickets</th>
                                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400">SLA</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {(stats?.companies || []).map((company) => {
                                    const statusStyle = getStatusClasses(company.status);
                                    const StatusIcon = statusStyle.icon;
                                    return (
                                        <tr key={company.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className="text-lg font-medium">{company.name}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}>
                                                    <StatusIcon className="w-4 h-4" />
                                                    <span className="capitalize">{company.status}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    {company.ticketCount.open > 0 && (
                                                        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-sm font-medium">
                                                            {company.ticketCount.open} abertos
                                                        </span>
                                                    )}
                                                    {company.ticketCount.critical > 0 && (
                                                        <span className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-sm font-medium">
                                                            {company.ticketCount.critical} críticos
                                                        </span>
                                                    )}
                                                    {company.ticketCount.open === 0 && company.ticketCount.critical === 0 && (
                                                        <span className="text-slate-500 text-sm">Sem tickets</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-16 h-2 rounded-full bg-slate-700 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${company.slaCompliance >= 80 ? 'bg-emerald-500' : company.slaCompliance >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                                                }`}
                                                            style={{ width: `${company.slaCompliance}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-300">{company.slaCompliance}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(!stats?.companies || stats.companies.length === 0) && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                            Nenhuma empresa encontrada
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Alerts */}
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-400" />
                        <h2 className="text-xl font-bold">Últimos Alertas</h2>
                    </div>
                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                        {(stats?.recentAlerts || []).slice(0, 10).map((alert, index) => (
                            <div
                                key={index}
                                className={`p-3 rounded-xl border ${getSeverityClasses(alert.severity)}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">{alert.companyName}</p>
                                        <p className="text-xs opacity-80 mt-1">{alert.message}</p>
                                    </div>
                                    <span className="text-xs opacity-60 whitespace-nowrap">
                                        {formatTimestamp(alert.timestamp)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {(!stats?.recentAlerts || stats.recentAlerts.length === 0) && (
                            <div className="text-center py-8 text-slate-500">
                                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Sem alertas recentes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Tickets */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-700 flex items-center gap-3">
                    <Ticket className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-bold">Tickets Recentes</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">ID</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Empresa</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Título</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400">Status</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400">Urgência</th>
                                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-400">Criado em</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {(stats?.recentTickets || []).map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-slate-700/30 transition-colors">
                                    <td className="px-4 py-3 text-slate-400">#{ticket.id}</td>
                                    <td className="px-4 py-3 font-medium">{ticket.companyName}</td>
                                    <td className="px-4 py-3">{ticket.title}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-700 text-slate-300 capitalize">
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${ticket.urgency === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                ticket.urgency === 'high' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            {ticket.urgency}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-400">
                                        {formatTimestamp(ticket.createdAt)}
                                    </td>
                                </tr>
                            ))}
                            {(!stats?.recentTickets || stats.recentTickets.length === 0) && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        Nenhum ticket recente
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Status Bar */}
            <footer className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
                <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-12">
                    <StatusBarItem
                        label="Online"
                        count={statusCounts.online}
                        color="emerald"
                        icon={CheckCircle2}
                    />
                    <StatusBarItem
                        label="Atenção"
                        count={statusCounts.warning}
                        color="amber"
                        icon={AlertTriangle}
                    />
                    <StatusBarItem
                        label="Crítico"
                        count={statusCounts.critical}
                        color="red"
                        icon={XCircle}
                    />
                    <StatusBarItem
                        label="Offline"
                        count={statusCounts.offline}
                        color="slate"
                        icon={XCircle}
                    />
                    <div className="h-8 w-px bg-slate-700 hidden lg:block" />
                    <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">
                            Atualizado: {stats?.timestamp ? formatTimestamp(stats.timestamp) : '-'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="text-sm">Auto-refresh: 30s</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

// Summary Card Component
const SummaryCard = ({ title, value, icon: Icon, color }) => {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600',
        red: 'from-red-500 to-red-600',
        amber: 'from-amber-500 to-amber-600',
        emerald: 'from-emerald-500 to-emerald-600',
    };

    const iconColors = {
        blue: 'text-blue-400',
        red: 'text-red-400',
        amber: 'text-amber-400',
        emerald: 'text-emerald-400',
    };

    return (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm lg:text-base">{title}</span>
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                </div>
            </div>
            <div className="text-3xl lg:text-4xl font-bold">
                {value}
            </div>
        </div>
    );
};

// Status Bar Item Component
const StatusBarItem = ({ label, count, color, icon: Icon }) => {
    const colorClasses = {
        emerald: 'text-emerald-400',
        amber: 'text-amber-400',
        red: 'text-red-400',
        slate: 'text-slate-400',
    };

    return (
        <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
            <span className="text-slate-400">{label}:</span>
            <span className={`font-bold text-lg ${colorClasses[color]}`}>{count}</span>
        </div>
    );
};

export default NOC;
