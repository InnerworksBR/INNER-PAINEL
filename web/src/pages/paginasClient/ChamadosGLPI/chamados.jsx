import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ChevronDown,
  RefreshCw,
  Search,
  Download,
  Calendar,
  X,
  User,
  Tag,
  Filter,
  Activity,
  AlertTriangle,
  Eye,
  EyeOff,
  Inbox,
  CheckCircle,
  ListFilter
} from 'lucide-react';
import api from '../../../services/api';
import { useClientRequestConfig } from '../../../context/ClientPreviewContext';
import TicketDetailDrawer from '../../../components/TicketDetailDrawer';

const DEFAULT_FILTROS = {
  status: 'Todos os status',
  prioridade: 'Todas as Prioridades',
  busca: '',
  dataInicio: '',
  dataFim: '',
};

// Status que NÃO são considerados "solucionados" (filtro padrão)
const STATUS_SOLUCIONADOS = ['Resolvido', 'Fechado', 'Solucionado', 'Closed', 'Resolved'];

const STATUS_CONFIG = {
  'Resolvido':         { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200',  dot: 'bg-emerald-500' },
  'Fechado':           { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200',  dot: 'bg-emerald-500' },
  'Solucionado':       { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200',  dot: 'bg-emerald-500' },
  'Em Andamento':      { bg: 'bg-blue-50',     text: 'text-blue-700',     border: 'border-blue-200',     dot: 'bg-blue-500' },
  'Em Andamento (Atribuído)': { bg: 'bg-blue-50', text: 'text-blue-700',   border: 'border-blue-200',     dot: 'bg-blue-500' },
  'Em Andamento (Planejado)': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'Pendente':          { bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200',    dot: 'bg-amber-500' },
  'Novo':              { bg: 'bg-violet-50',   text: 'text-violet-700',   border: 'border-violet-200',   dot: 'bg-violet-500' },
};

const PRIORITY_CONFIG = {
  'Muito Alta': { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  'Alta':       { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
  'Média':      { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  'Baixa':      { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200' },
};

function statusConfig(status) {
  return STATUS_CONFIG[status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
}

function priorityConfig(priority) {
  return PRIORITY_CONFIG[priority] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
}

function isResolved(status) {
  return STATUS_SOLUCIONADOS.includes(status);
}

function timeSince(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 30) return `${diffDays}d`;
  return date.toLocaleDateString('pt-BR');
}

const ChamadosGLPI = () => {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [filtros, setFiltros] = useState(DEFAULT_FILTROS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(DEFAULT_FILTROS);
  const [apenasNaoSolucionados, setApenasNaoSolucionados] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const requestConfig = useClientRequestConfig();

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        api.get('/client/glpi/tickets', requestConfig),
        api.get('/client/glpi/stats', requestConfig),
      ]);
      setTickets(ticketsRes.data || []);
      setStats(statsRes.data || null);
    } catch (error) {
      console.error('Error fetching GLPI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = (dropdown) => {
    setOpenDropdown(prev => prev === dropdown ? null : dropdown);
  };

  const handleSelect = (tipo, valor) => {
    setFiltros(prev => ({ ...prev, [tipo]: valor }));
    setOpenDropdown(null);
  };

  const clearFilters = () => {
    setFiltros(DEFAULT_FILTROS);
    setFiltrosAplicados(DEFAULT_FILTROS);
  };

  const hasActiveFilters =
    filtrosAplicados.status !== DEFAULT_FILTROS.status ||
    filtrosAplicados.prioridade !== DEFAULT_FILTROS.prioridade ||
    filtrosAplicados.dataInicio !== DEFAULT_FILTROS.dataInicio ||
    filtrosAplicados.dataFim !== DEFAULT_FILTROS.dataFim ||
    filtros.busca !== DEFAULT_FILTROS.busca;

  // Tickets visíveis: aplica toggle "apenas não solucionados" + filtros
  const filteredTickets = useMemo(() => {
    return tickets.filter(ticket => {
      // 1. Toggle principal: se true, esconde resolvidos/fechados
      if (apenasNaoSolucionados && isResolved(ticket.status)) return false;

      // 2. Filtros
      const matchesStatus = filtrosAplicados.status === 'Todos os status' || ticket.status === filtrosAplicados.status;
      const matchesPriority = filtrosAplicados.prioridade === 'Todas as Prioridades' || ticket.priority === filtrosAplicados.prioridade;

      const searchString = filtros.busca.toLowerCase();
      const matchesBusca = !searchString ||
        String(ticket.glpi_id).includes(searchString) ||
        (ticket.title && ticket.title.toLowerCase().includes(searchString)) ||
        (ticket.requester && ticket.requester.toLowerCase().includes(searchString));

      let matchesData = true;
      if (ticket.created_at && (filtrosAplicados.dataInicio || filtrosAplicados.dataFim)) {
        const ticketDate = new Date(ticket.created_at).setHours(0,0,0,0);
        if (filtrosAplicados.dataInicio) {
          const start = new Date(filtrosAplicados.dataInicio + 'T00:00:00').setHours(0,0,0,0);
          if (ticketDate < start) matchesData = false;
        }
        if (filtrosAplicados.dataFim) {
          const end = new Date(filtrosAplicados.dataFim + 'T23:59:59').setHours(0,0,0,0);
          if (ticketDate > end) matchesData = false;
        }
      }

      return matchesStatus && matchesPriority && matchesBusca && matchesData;
    });
  }, [tickets, filtrosAplicados, filtros.busca, apenasNaoSolucionados]);

  // Métricas dinâmicas baseadas no que está visível
  const ticketsNaoSolucionados = tickets.filter(t => !isResolved(t.status));
  const statsVisiveis = {
    total: tickets.length,
    abertos: ticketsNaoSolucionados.length,
    criticos: ticketsNaoSolucionados.filter(t => ['Alta', 'Muito Alta'].includes(t.priority)).length,
    visiveis: filteredTickets.length,
  };

  const exportToCSV = () => {
    if (filteredTickets.length === 0) return;
    const headers = ['ID GLPI', 'Título', 'Requerente', 'Categoria', 'Prioridade', 'Status', 'Data', 'Atualizado'];
    const csvContent = [
      headers.join(','),
      ...filteredTickets.map(t => [
        t.glpi_id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${(t.requester || '').replace(/"/g, '""')}"`,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        t.priority || '',
        t.status || '',
        t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '',
        t.glpi_date_mod && t.glpi_date_mod !== t.created_at ? new Date(t.glpi_date_mod).toLocaleDateString('pt-BR') : '—'
      ].join(','))
    ].join('\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `chamados_glpi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusOptions = ['Todos os status', ...new Set(tickets.map(t => t.status).filter(Boolean))];
  const priorityOptions = ['Todas as Prioridades', ...new Set(tickets.map(t => t.priority).filter(Boolean))];
  const topRequesters = stats?.topRequesters || [];
  const categoryStats = stats?.byCategory ? Object.entries(stats.byCategory).map(([name, count]) => ({ name, count })) : [];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-neutral-200 rounded-xl w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-neutral-200 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map(i => <div key={i} className="h-64 bg-neutral-200 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-violet-500 to-violet-600" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Chamados GLPI</h1>
          </div>
          <p className="text-neutral-500 ml-3.5">Acompanhe e filtre os chamados de suporte técnico</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              bg-white border border-neutral-200 text-neutral-700
              hover:bg-neutral-50 hover:border-neutral-300 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={exportToCSV}
            disabled={filteredTickets.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
              bg-neutral-900 text-white border border-neutral-900
              hover:bg-neutral-800
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-sm transition-all"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs - cards premium com gradient accent */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-500"
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-medium text-neutral-500">Total Sincronizados</h3>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.08) 100%)',
                  border: '1px solid rgba(59,130,246,0.2)'
                }}>
                <Inbox size={20} className="text-blue-600" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-bold text-neutral-900">{statsVisiveis.total}</span>
              <p className="text-xs text-neutral-400 mt-1">Chamados na base GLPI</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-500"
            style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)' }} />
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-medium text-neutral-500">Não Solucionados</h3>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.08) 100%)',
                  border: '1px solid rgba(245,158,11,0.2)'
                }}>
                <AlertCircle size={20} className="text-amber-600" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-bold text-neutral-900">{statsVisiveis.abertos}</span>
              <p className="text-xs text-neutral-400 mt-1">Requerem atenção</p>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl bg-white border border-neutral-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-600" />
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-500"
            style={{ background: 'radial-gradient(circle, #ef4444 0%, transparent 70%)' }} />
          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-medium text-neutral-500">Prioridade Alta+</h3>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.08) 100%)',
                  border: '1px solid rgba(239,68,68,0.2)'
                }}>
                <AlertTriangle size={20} className="text-red-600" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-bold text-neutral-900">{statsVisiveis.criticos}</span>
              <p className="text-xs text-neutral-400 mt-1">Chamados críticos abertos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle "Apenas não solucionados" + Filtros */}
      <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          {/* Toggle principal */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setApenasNaoSolucionados(!apenasNaoSolucionados)}
              className={`
                relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-200 border
                ${apenasNaoSolucionados
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                }
              `}
            >
              {apenasNaoSolucionados ? <Eye size={16} /> : <EyeOff size={16} />}
              {apenasNaoSolucionados ? 'Apenas não solucionados' : 'Mostrar todos'}
              <span
                className={`
                  inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full text-xs font-bold
                  ${apenasNaoSolucionados
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-200 text-neutral-600'
                  }
                `}
              >
                {apenasNaoSolucionados ? statsVisiveis.abertos : statsVisiveis.total}
              </span>
            </button>
          </div>

          {/* Busca + Filtros */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por ID, título ou requerente..."
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                className="pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm
                  focus:outline-none focus:border-emerald-500/50 focus:bg-white
                  transition-all w-full md:w-72"
              />
            </div>

            <button
              onClick={() => setFiltrosAplicados(filtros)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
            >
              <Filter size={14} />
              Aplicar
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold
                  text-neutral-500 hover:text-red-600 border border-neutral-200 hover:border-red-200 transition-colors"
              >
                <X size={14} />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Filtros secundários */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-neutral-100">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <ListFilter size={14} className="text-neutral-400" />
            <span className="font-medium">Filtros:</span>
          </div>

          <DropdownFiltro
            icone={Ticket}
            valorAtual={filtros.status}
            opcoes={statusOptions}
            aberto={openDropdown === 'status'}
            aoAlternar={() => toggleDropdown('status')}
            aoSelecionar={(valor) => handleSelect('status', valor)}
            largura="w-56"
          />
          <DropdownFiltro
            icone={AlertCircle}
            valorAtual={filtros.prioridade}
            opcoes={priorityOptions}
            aberto={openDropdown === 'prioridade'}
            aoAlternar={() => toggleDropdown('prioridade')}
            aoSelecionar={(valor) => handleSelect('prioridade', valor)}
            largura="w-52"
          />

          <div className="flex items-center gap-2 ml-auto">
            <Calendar size={14} className="text-neutral-400" />
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <span className="text-neutral-400 text-sm">até</span>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </div>

      {/* Chips de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {filtrosAplicados.status !== DEFAULT_FILTROS.status && (
            <FilterChip
              label="Status"
              value={filtrosAplicados.status}
              onRemove={() => setFiltrosAplicados(prev => ({ ...prev, status: DEFAULT_FILTROS.status }))}
            />
          )}
          {filtrosAplicados.prioridade !== DEFAULT_FILTROS.prioridade && (
            <FilterChip
              label="Prioridade"
              value={filtrosAplicados.prioridade}
              onRemove={() => setFiltrosAplicados(prev => ({ ...prev, prioridade: DEFAULT_FILTROS.prioridade }))}
            />
          )}
          {(filtrosAplicados.dataInicio || filtrosAplicados.dataFim) && (
            <FilterChip
              label="Período"
              value={`${filtrosAplicados.dataInicio ? new Date(filtrosAplicados.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : '...'} – ${filtrosAplicados.dataFim ? new Date(filtrosAplicados.dataFim + 'T00:00:00').toLocaleDateString('pt-BR') : '...'}`}
              onRemove={() => setFiltrosAplicados(prev => ({ ...prev, dataInicio: DEFAULT_FILTROS.dataInicio, dataFim: DEFAULT_FILTROS.dataFim }))}
            />
          )}
          {filtros.busca !== DEFAULT_FILTROS.busca && (
            <FilterChip
              label="Busca"
              value={filtros.busca}
              onRemove={() => setFiltros(prev => ({ ...prev, busca: DEFAULT_FILTROS.busca }))}
            />
          )}
        </div>
      )}

      {/* Ranking Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Top Requerentes
            </h2>
            <User size={16} className="text-neutral-300" />
          </div>
          <div className="p-5 space-y-2">
            {topRequesters.length > 0 ? topRequesters.slice(0, 5).map((usr, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/50 hover:bg-neutral-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                    ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-200 text-neutral-500'}
                  `}>
                    {i + 1}
                  </span>
                  <h4 className="font-medium text-neutral-900 truncate max-w-[180px]">{usr.name}</h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold text-neutral-700">{usr.count}</span>
                  <span className="text-[10px] font-medium text-neutral-400 uppercase">chamados</span>
                </div>
              </div>
            )) : (
              <EmptyState icon={User} text="Nenhum dado disponível" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Por Categoria
            </h2>
            <Tag size={16} className="text-neutral-300" />
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {categoryStats.length > 0 ? categoryStats.slice(0, 6).map((cat, i) => (
              <div key={i} className="bg-neutral-50/50 rounded-xl p-4 border border-neutral-100 hover:border-neutral-200 transition-colors">
                <h4 className="text-xs font-medium text-neutral-500 mb-2 truncate">{cat.name}</h4>
                <span className="text-2xl font-bold text-neutral-900">{cat.count}</span>
              </div>
            )) : (
              <div className="col-span-2">
                <EmptyState icon={Tag} text="Nenhum dado disponível" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Chamados - Cards */}
      <div className="bg-white rounded-2xl border border-neutral-200/60 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              {apenasNaoSolucionados ? 'Chamados em Aberto' : 'Todos os Chamados'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {filteredTickets.length} de {statsVisiveis.total} chamados exibidos
              {apenasNaoSolucionados && ` · ${statsVisiveis.total - statsVisiveis.abertos} resolvidos ocultos`}
            </p>
          </div>
        </div>

        <div className="divide-y divide-neutral-100">
          {filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => {
              const sCfg = statusConfig(ticket.status);
              const pCfg = priorityConfig(ticket.priority);
              return (
                <div
                  key={ticket.id}
                  onClick={() => {
                    setSelectedTicketId(ticket.glpi_id);
                    setIsDrawerOpen(true);
                  }}
                  className="group p-5 hover:bg-neutral-50/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    {/* ID Badge */}
                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-neutral-100 flex flex-col items-center justify-center border border-neutral-200">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">GLPI</span>
                      <span className="text-base font-bold text-neutral-900">#{ticket.glpi_id}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-neutral-900 group-hover:text-emerald-600 transition-colors truncate">
                          {ticket.title}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sCfg.bg} ${sCfg.text} ${sCfg.border} whitespace-nowrap`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
                          {ticket.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
                        {ticket.requester && (
                          <div className="flex items-center gap-1.5">
                            <User size={12} />
                            <span className="truncate max-w-[140px]">{ticket.requester}</span>
                          </div>
                        )}
                        {ticket.category && (
                          <div className="flex items-center gap-1.5">
                            <Tag size={12} />
                            <span className="truncate max-w-[140px]">{ticket.category}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          <span>Aberto {timeSince(ticket.created_at)}</span>
                        </div>
                        {ticket.glpi_date_mod && ticket.glpi_date_mod !== ticket.created_at && (
                          <div className="flex items-center gap-1.5">
                            <Activity size={12} />
                            <span>Atualizado {timeSince(ticket.glpi_date_mod)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Priority + Action */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${pCfg.bg} ${pCfg.text} ${pCfg.border}`}>
                        {ticket.priority}
                      </span>
                      <ChevronDown
                        size={16}
                        className="text-neutral-300 -rotate-90 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16">
              <EmptyState
                icon={CheckCircle}
                text={apenasNaoSolucionados
                  ? 'Nenhum chamado em aberto no momento!'
                  : 'Nenhum chamado encontrado para os filtros selecionados.'}
                subtitle={apenasNaoSolucionados ? 'Todos os chamados foram solucionados. Desative o filtro para ver o histórico.' : null}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-4" />

      {/* Drawer de Detalhes */}
      <TicketDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        ticketId={selectedTicketId}
      />
    </div>
  );
};

// Componente auxiliar para chip de filtro ativo
const FilterChip = ({ label, value, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
    <span className="text-emerald-500/70">{label}:</span>
    <span className="max-w-[160px] truncate">{value}</span>
    <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
      <X size={12} />
    </button>
  </span>
);

// Componente auxiliar para dropdown de filtro
const DropdownFiltro = ({ icone: Icon, valorAtual, opcoes, aoSelecionar, aberto, aoAlternar, largura = 'w-44' }) => {
  return (
    <div className="relative">
      <button
        onClick={aoAlternar}
        className={`flex items-center justify-between gap-2 px-3 py-2 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-medium rounded-lg border border-neutral-200 transition-colors ${largura}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Icon size={14} className="text-neutral-400 shrink-0" />
          <span className="truncate">{valorAtual}</span>
        </div>
        <ChevronDown size={14} className={`text-neutral-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className={`absolute top-full left-0 mt-1 ${largura} bg-white border border-neutral-200 rounded-lg shadow-lg z-10 py-1 max-h-64 overflow-y-auto`}>
          {opcoes.map(opcao => (
            <button
              key={opcao}
              onClick={() => aoSelecionar(opcao)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 hover:text-emerald-700 transition-colors ${valorAtual === opcao ? 'bg-emerald-50/50 font-semibold text-emerald-700' : 'text-neutral-700'}`}
            >
              {opcao}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Componente para estado vazio
const EmptyState = ({ icon: Icon, text, subtitle }) => (
  <div className="flex flex-col items-center justify-center text-center">
    <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3 border border-emerald-100">
      <Icon size={24} className="text-emerald-500" />
    </div>
    <p className="text-sm font-medium text-neutral-700">{text}</p>
    {subtitle && <p className="text-xs text-neutral-400 mt-1 max-w-xs">{subtitle}</p>}
  </div>
);

export default ChamadosGLPI;