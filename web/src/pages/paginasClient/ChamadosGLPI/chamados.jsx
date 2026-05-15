import React, { useState, useEffect } from 'react';
import { Filter, Ticket, AlertCircle, CheckCircle2, TrendingUp, ChevronDown, RefreshCw } from 'lucide-react';
import api from '../../../services/api';
import { useClientRequestConfig } from '../../../context/ClientPreviewContext';

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
  const [filtros, setFiltros] = useState({
    status: 'Todos os status',
    prioridade: 'Todas as Prioridades',
  });
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

  // Filtragem local
  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = filtros.status === 'Todos os status' || ticket.status === filtros.status;
    const matchesPriority = filtros.prioridade === 'Todas as Prioridades' || ticket.priority === filtros.prioridade;
    return matchesStatus && matchesPriority;
  });

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
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-r border-slate-200 pr-6">
            <Filter size={20} className="text-slate-400" />
            Filtros
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <DropdownFiltro icone={Ticket} valorAtual={filtros.status} opcoes={statusOptions}
              aberto={openDropdown === 'status'} aoAlternar={() => toggleDropdown('status')}
              aoSelecionar={(valor) => handleSelect('status', valor)} largura="w-56" />
            <DropdownFiltro icone={Ticket} valorAtual={filtros.prioridade} opcoes={priorityOptions}
              aberto={openDropdown === 'prioridade'} aoAlternar={() => toggleDropdown('prioridade')}
              aoSelecionar={(valor) => handleSelect('prioridade', valor)} largura="w-52" />
          </div>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-medium text-blue-600">#{ticket.glpi_id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900 max-w-xs truncate">{ticket.title}</td>
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    Nenhum chamado encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ChamadosGLPI;
