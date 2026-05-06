import React, { useCallback, useEffect, useState } from 'react';
import { FileSearch, RefreshCw } from 'lucide-react';
import api from '../../../services/api';

const AuditAdmin = () => {
    const [logs, setLogs] = useState([]);
    const [filters, setFilters] = useState({ action: '', entity_type: '', date_from: '', date_to: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
            const response = await api.get('/admin/audit-logs', { params });
            setLogs(response.data || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao carregar auditoria.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Auditoria</h1>
                    <p className="text-slate-500 mt-1">Rastro de ações administrativas críticas.</p>
                </div>
                <button onClick={fetchLogs} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            <section className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input className="border border-slate-200 rounded-lg px-3 py-2" placeholder="Ação" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
                    <input className="border border-slate-200 rounded-lg px-3 py-2" placeholder="Entidade" value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} />
                    <input className="border border-slate-200 rounded-lg px-3 py-2" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
                    <input className="border border-slate-200 rounded-lg px-3 py-2" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
                </div>
                {error && <p className="mt-3 text-sm text-red-700 bg-red-50 rounded-lg p-3">{error}</p>}
            </section>

            <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                    <FileSearch size={18} className="text-blue-600" />
                    <h2 className="font-bold text-slate-800">Registros</h2>
                </div>
                {logs.length === 0 ? (
                    <p className="p-6 text-slate-500">Nenhum registro encontrado.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500">
                                <tr>
                                    <th className="text-left p-4">Data</th>
                                    <th className="text-left p-4">Admin</th>
                                    <th className="text-left p-4">Ação</th>
                                    <th className="text-left p-4">Entidade</th>
                                    <th className="text-left p-4">Resumo</th>
                                    <th className="text-left p-4">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} className="border-t border-slate-100">
                                        <td className="p-4 whitespace-nowrap">{formatDate(log.created_at)}</td>
                                        <td className="p-4">{log.admin_email || '-'}</td>
                                        <td className="p-4 font-semibold text-slate-800">{log.action}</td>
                                        <td className="p-4">{log.entity_type}</td>
                                        <td className="p-4">{log.summary}</td>
                                        <td className="p-4">{log.ip_address || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

function formatDate(value) {
    return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

export default AuditAdmin;
