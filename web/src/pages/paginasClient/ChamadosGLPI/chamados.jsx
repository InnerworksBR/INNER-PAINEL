import React, { useState, useEffect } from 'react';
import { Filter, Ticket, AlertCircle, CheckCircle2, TrendingUp, ChevronDown, RefreshCw, Search, Download, Calendar, X } from 'lucide-react';

const DEFAULT_FILTROS = {
  status: 'Todos os status',
  prioridade: 'Todas as Prioridades',
  busca: '',
  dataInicio: '',
  dataFim: '',
};
import api from '../../../services/api';
import { useClientRequestConfig } from '../../../context/ClientPreviewContext';
import TicketDetailDrawer from '../../../components/TicketDetailDrawer';

const DropdownFiltro = ({ icone: Icon, valorAtual, opcoes, aoSelecionar, aberto, aoAlternar, largura = 'w-44' }) => {
  return (
    <div className="relative">
      <button onClick={aoAlternar} className={`flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-md border border-slate-200 transition-colors ${largura}`}>
        <div className="flex items-center gap-2 truncate">
          <Icon size={16} className="text-slate-400 shrink-0" />
          <span className="truncate">{valorAtual}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className={`absolute top-full left-0 mt-1 ${largura} bg-white border border-slate-200 rounded-md shadow-lg z-10 py-1`}>
          {opcoes.map(opcao => (
            <button key={opcao} onClick={() => aoSelecionar(opcao)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${valorAtual === opcao ? 'bg-blue-50/50 font-semibold text-blue-700' : 'text-slate-700'}`}>
              {opcao}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ChamadosGLPI = () => {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [filtros, setFiltros] = useState(DEFAULT_FILTROS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(DEFAULT_FILTROS);
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

  // Filtragem local baseada em filtrosAplicados
  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = filtrosAplicados.status === 'Todos os status' || ticket.status === filtrosAplicados.status;
    const matchesPriority = filtrosAplicados.prioridade === 'Todas as Prioridades' || ticket.priority === filtrosAplicados.prioridade;
    
    const searchString = filtros.busca.toLowerCase();
    const matchesBusca = !searchString || 
      String(ticket.glpi_id).includes(searchString) || 
      (ticket.title && ticket.title.toLowerCase().includes(searchString));
      
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

  const getStatusStyle = (status) => {
    if (['Resolvido', 'Fechado'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (['Em Andamento', 'Em Andamento (Atribuído)', 'Em Andamento (Planejado)'].includes(status)) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (status === 'Pendente') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getPriorityStyle = (priority) => {
    if (['Alta', 'Muito Alta', 'Maior'].includes(priority)) return 'bg-red-50 text-red-700 border-red-100';
    if (priority === 'Média') return 'bg-amber-50 text-amber-700 border-amber-100';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  // Extrair opções únicas dos dados
  const statusOptions = ['Todos os status', ...new Set(tickets.map(t => t.status).filter(Boolean))];
  const priorityOptions = ['Todas as Prioridades', ...new Set(tickets.map(t => t.priority).filter(Boolean))];

  // Top Requerentes
  const topRequesters = stats?.topRequesters || [];

  // Categorias
  const categoryStats = stats?.byCategory ? Object.entries(stats.byCategory).map(([name, count]) => ({ name, count })) : [];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 font-medium">Carregando chamados...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard de Chamados GLPI</h1>
          <p className="text-slate-500 text-lg">Indicadores consolidados de suporte técnico</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-r border-slate-200 pr-4">
              <Filter size={20} className="text-slate-400" />
              Filtros
            </h2>
            
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por ID ou Título..." 
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm w-full md:w-64 focus:outline-none focus:border-blue-500"
              />
            </div>
            
            <DropdownFiltro icone={Ticket} valorAtual={filtros.status} opcoes={statusOptions}
              aberto={openDropdown === 'status'} aoAlternar={() => toggleDropdown('status')}
              aoSelecionar={(valor) => handleSelect('status', valor)} largura="w-56" />
            <DropdownFiltro icone={Ticket} valorAtual={filtros.prioridade} opcoes={priorityOptions}
              aberto={openDropdown === 'prioridade'} aoAlternar={() => toggleDropdown('prioridade')}
              aoSelecionar={(valor) => handleSelect('prioridade', valor)} largura="w-52" />
          </div>

          {/* Botões de Ação: Filtrar e Exportar */}
          <div className="flex items-center gap-3">
            <button onClick={() => setFiltrosAplicados(filtros)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 border border-transparent rounded-xl text-sm font-semibold transition-colors">
              <Filter size={16} />
              Aplicar Filtros
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-red-500 border border-slate-200 rounded-xl text-sm font-semibold transition-colors">
                <X size={15} />
                Limpar
              </button>
            )}
            <button onClick={exportToCSV} disabled={filteredTickets.length === 0} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>
        
        {/* Filtros de Data */}
        <div className="flex items-center gap-4 ml-0 md:ml-28">
           <div className="flex items-center gap-2 text-sm text-slate-600">
             <Calendar size={16} className="text-slate-400" />
             <span>Período:</span>
           </div>
           <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500" />
           <span className="text-slate-400">até</span>
           <input type="date" value={filtros.dataFim} onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      {/* Chips de filtros ativos */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          {filtrosAplicados.status !== DEFAULT_FILTROS.status && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold">
              Status: {filtrosAplicados.status}
              <button onClick={() => setFiltrosAplicados(prev => ({ ...prev, status: DEFAULT_FILTROS.status }))} className="hover:text-red-500 transition-colors ml-0.5">
                <X size={12} />
              </button>
            </span>
          )}
          {filtrosAplicados.prioridade !== DEFAULT_FILTROS.prioridade && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold">
              Prioridade: {filtrosAplicados.prioridade}
              <button onClick={() => setFiltrosAplicados(prev => ({ ...prev, prioridade: DEFAULT_FILTROS.prioridade }))} className="hover:text-red-500 transition-colors ml-0.5">
                <X size={12} />
              </button>
            </span>
          )}
          {(filtrosAplicados.dataInicio || filtrosAplicados.dataFim) && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold">
              Período: {filtrosAplicados.dataInicio ? new Date(filtrosAplicados.dataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : '...'} – {filtrosAplicados.dataFim ? new Date(filtrosAplicados.dataFim + 'T00:00:00').toLocaleDateString('pt-BR') : '...'}
              <button onClick={() => setFiltrosAplicados(prev => ({ ...prev, dataInicio: DEFAULT_FILTROS.dataInicio, dataFim: DEFAULT_FILTROS.dataFim }))} className="hover:text-red-500 transition-colors ml-0.5">
                <X size={12} />
              </button>
            </span>
          )}
          {filtros.busca !== DEFAULT_FILTROS.busca && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-semibold">
              Busca: {filtros.busca}
              <button onClick={() => setFiltros(prev => ({ ...prev, busca: DEFAULT_FILTROS.busca }))} className="hover:text-red-500 transition-colors ml-0.5">
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Total de Chamados</h3>
          <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{stats?.total || 0}</span>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md max-w-fit">
            <TrendingUp size={16} />
            Base sincronizada
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Chamados Pendentes</h3>
          <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{stats?.open || 0}</span>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md max-w-fit">
            <AlertCircle size={16} />
            Ação necessária
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-500 mb-2">SLA Cumprido</h3>
          <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{stats?.slaPercentage || 0}%</span>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md max-w-fit">
            <CheckCircle2 size={16} />
            Dentro do prazo
          </div>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Top Requerentes</h2>
          <div className="space-y-4">
            {topRequesters.length > 0 ? topRequesters.map((usr, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}º
                  </span>
                  <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{usr.name}</h4>
                </div>
                <div className="text-right">
                  <span className="block text-lg font-bold text-slate-700">{usr.count}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Chamados</span>
                </div>
              </div>
            )) : (
              <p className="text-center py-8 text-slate-400">Nenhum dado disponível</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Chamados por Categoria</h2>
          <div className="grid grid-cols-2 gap-4">
            {categoryStats.length > 0 ? categoryStats.slice(0, 6).map((cat, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-5 border border-slate-100 hover:border-slate-200 transition-colors">
                <h4 className="font-medium text-slate-600 mb-3 truncate">{cat.name}</h4>
                <span className="text-3xl font-extrabold text-slate-800">{cat.count}</span>
              </div>
            )) : (
              <div className="col-span-2 text-center py-8 text-slate-400">Nenhum dado disponível</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Chamados */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Listagem de Chamados</h2>
          <p className="text-sm text-slate-500 mt-1">{filteredTickets.length} chamados encontrados</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">ID GLPI</th>
                <th className="px-6 py-4">Título</th>
                <th className="px-6 py-4">Requerente</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Prioridade</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    onClick={() => {
                      setSelectedTicketId(ticket.glpi_id);
                      setIsDrawerOpen(true);
                    }}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 font-medium text-blue-600 group-hover:text-blue-700">#{ticket.glpi_id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900 max-w-xs truncate group-hover:text-blue-600 transition-colors">{ticket.title}</td>
                    <td className="px-6 py-4">{ticket.requester || '-'}</td>
                    <td className="px-6 py-4">{ticket.category || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityStyle(ticket.priority)}`}>
                        {ticket.priority || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {ticket.glpi_date_mod && ticket.glpi_date_mod !== ticket.created_at ? new Date(ticket.glpi_date_mod).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                    Nenhum chamado encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Drawer de Detalhes */}
      <TicketDetailDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        ticketId={selectedTicketId} 
      />
    </div>
  );
};

export default ChamadosGLPI;
