import React, { useState } from 'react';
import { Download, Calendar, Filter, Ticket, AlertCircle, CheckCircle2, TrendingUp, TrendingDown, Clock, ChevronDown } from 'lucide-react';

const DropdownFiltro = ({ icone: Icon, valorAtual, opcoes, aoSelecionar, aberto, aoAlternar, largura = 'w-44' }) => {
  return (
    <div className="relative">
      <button
        onClick={aoAlternar}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-md border border-slate-200 transition-colors ${largura}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Icon size={16} className="text-slate-400 shrink-0" />
          <span className="truncate">{valorAtual}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className={`absolute top-full left-0 mt-1 ${largura} bg-white border border-slate-200 rounded-md shadow-lg z-10 py-1`}>
          {opcoes.map(opcao => (
            <button
              key={opcao}
              onClick={() => aoSelecionar(opcao)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors ${valorAtual === opcao ? 'bg-blue-50/50 font-semibold text-blue-700' : 'text-slate-700'}`}
            >
              {opcao}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ALL_TICKETS = [
  { id: '#3421', titulo: 'Problema com impressora', requerente: 'Maria Silva', depto: 'TI', categoria: 'Hardware', prioridade: 'Média', status: 'Em Andamento', data: '2026-02-10' },
  { id: '#3420', titulo: 'Acesso ao sistema financeiro', requerente: 'João Santos', depto: 'Financeiro', categoria: 'Acesso', prioridade: 'Alta', status: 'Aberto', data: '2026-02-10' },
  { id: '#3419', titulo: 'Atualização de software', requerente: 'Ana Costa', depto: 'RH', categoria: 'Software', prioridade: 'Baixa', status: 'Resolvido', data: '2026-02-09' },
  { id: '#3418', titulo: 'Conexão VPN instável', requerente: 'Pedro Oliveira', depto: 'Comercial', categoria: 'Rede', prioridade: 'Alta', status: 'Em Andamento', data: '2026-02-09' },
  { id: '#3417', titulo: 'E-mail não sincroniza', requerente: 'Carlos Souza', depto: 'Operações', categoria: 'E-mail', prioridade: 'Média', status: 'Resolvido', data: '2026-02-08' },
  { id: '#3416', titulo: 'Novo notebook para estagiário', requerente: 'Maria Silva', depto: 'TI', categoria: 'Hardware', prioridade: 'Baixa', status: 'Aberto', data: '2026-02-07' },
  { id: '#3415', titulo: 'Erro ao emitir nota fiscal', requerente: 'João Santos', depto: 'Financeiro', categoria: 'Software', prioridade: 'Alta', status: 'Resolvido', data: '2026-02-06' },
  { id: '#3414', titulo: 'Criação de conta para novo colaborador', requerente: 'Ana Costa', depto: 'RH', categoria: 'Acesso', prioridade: 'Média', status: 'Aberto', data: '2026-02-05' },
  { id: '#3413', titulo: 'Wi-fi lento na sala de reuniões', requerente: 'Pedro Oliveira', depto: 'Comercial', categoria: 'Rede', prioridade: 'Baixa', status: 'Em Andamento', data: '2026-02-04' },
  { id: '#3412', titulo: 'Backup de arquivos antigos', requerente: 'Carlos Souza', depto: 'Operações', categoria: 'Outros', prioridade: 'Baixa', status: 'Resolvido', data: '2026-02-03' },
];

const ChamadosGLPI = () => {
  const [openDropdown, setOpenDropdown] = useState(null);
  const [filtros, setFiltros] = useState({
    periodo: 'Últimos 30 dias',
    status: 'Todos os status',
    categoria: 'Todas as Categorias',
    prioridade: 'Todas as Prioridades',
  });

  const toggleDropdown = (dropdown) => {
    setOpenDropdown(prev => prev === dropdown ? null : dropdown);
  };

  const handleSelect = (tipo, valor) => {
    setFiltros(prev => ({ ...prev, [tipo]: valor }));
    setOpenDropdown(null);
  };

  const limparFiltros = () => {
    setFiltros({
      periodo: 'Últimos 30 dias',
      status: 'Todos os status',
      categoria: 'Todas as Categorias',
      prioridade: 'Todas as Prioridades',
    });
    setOpenDropdown(null);
  };

  // Filtragem dos chamados
  const filteredTickets = ALL_TICKETS.filter(ticket => {
    const matchesStatus = filtros.status === 'Todos os status' || ticket.status === filtros.status;
    const matchesCategory = filtros.categoria === 'Todas as Categorias' || ticket.categoria === filtros.categoria;
    const matchesPriority = filtros.prioridade === 'Todas as Prioridades' || ticket.prioridade === filtros.prioridade;
    
    // Simulação de filtro de período (simplificado para o exemplo)
    const ticketDate = new Date(ticket.data);
    const now = new Date();
    const diffDays = (now - ticketDate) / (1000 * 60 * 60 * 24);
    let matchesPeriod = true;
    if (filtros.periodo === 'Últimos 7 dias') matchesPeriod = diffDays <= 7;
    else if (filtros.periodo === 'Últimos 30 dias') matchesPeriod = diffDays <= 30;
    else if (filtros.periodo === 'Últimos 90 dias') matchesPeriod = diffDays <= 90;

    return matchesStatus && matchesCategory && matchesPriority && matchesPeriod;
  });

  // Indicadores calculados
  const totalTickets = filteredTickets.length;
  const openTicketsCount = filteredTickets.filter(t => t.status === 'Aberto' || t.status === 'Em Andamento').length;
  const slaPercentage = totalTickets > 0 ? ((filteredTickets.filter(t => t.status === 'Resolvido').length / totalTickets) * 100).toFixed(1) : "0";

  // Agrupamento por Categoria para os cards
  const categoriesStats = ['Hardware', 'Software', 'Rede', 'Acesso'].map(cat => ({
    nome: cat,
    total: filteredTickets.filter(t => t.categoria === cat).length
  }));

  // Ranking de Requerentes baseado nos tickets filtrados
  const requesterRanking = Array.from(new Set(filteredTickets.map(t => t.requerente)))
    .map(name => ({
      nome: name,
      depto: filteredTickets.find(t => t.requerente === name).depto,
      chamados: filteredTickets.filter(t => t.requerente === name).length
    }))
    .sort((a, b) => b.chamados - a.chamados)
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Cabeçalho superior */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard de Chamados GLPI</h1>
          <p className="text-slate-500 text-lg">Relatórios e indicadores consolidados de suporte técnico</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-r border-slate-200 pr-6">
            <Filter size={20} className="text-slate-400" />
            Filtros de Relatório
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <DropdownFiltro
              icone={Calendar}
              valorAtual={filtros.periodo}
              opcoes={['Últimos 7 dias', 'Últimos 30 dias', 'Últimos 90 dias']}
              aberto={openDropdown === 'periodo'}
              aoAlternar={() => toggleDropdown('periodo')}
              aoSelecionar={(valor) => handleSelect('periodo', valor)}
              largura="w-48"
            />

            <DropdownFiltro
              icone={Ticket}
              valorAtual={filtros.status}
              opcoes={['Todos os status', 'Aberto', 'Em Andamento', 'Resolvido']}
              aberto={openDropdown === 'status'}
              aoAlternar={() => toggleDropdown('status')}
              aoSelecionar={(valor) => handleSelect('status', valor)}
              largura="w-48"
            />

            <DropdownFiltro
              icone={Ticket}
              valorAtual={filtros.categoria}
              opcoes={['Todas as Categorias', 'Hardware', 'Software', 'Rede', 'Acesso', 'E-mail', 'Outros']}
              aberto={openDropdown === 'categoria'}
              aoAlternar={() => toggleDropdown('categoria')}
              aoSelecionar={(valor) => handleSelect('categoria', valor)}
              largura="w-56"
            />

            <DropdownFiltro
              icone={Ticket}
              valorAtual={filtros.prioridade}
              opcoes={['Todas as Prioridades', 'Alta', 'Média', 'Baixa']}
              aberto={openDropdown === 'prioridade'}
              aoAlternar={() => toggleDropdown('prioridade')}
              aoSelecionar={(valor) => handleSelect('prioridade', valor)}
              largura="w-52"
            />
          </div>
        </div>
      </div>

      {/* Primeira linha de indicadores (3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Total de Chamados</h3>
          <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalTickets}</span>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md max-w-fit">
            <TrendingUp size={16} />
            Efetividade nos filtros
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Chamados Pendentes</h3>
          <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{openTicketsCount}</span>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-md max-w-fit">
            <AlertCircle size={16} />
            Ação necessária
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-500 mb-2">Resolução SLA</h3>
          <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{slaPercentage}%</span>
          <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md max-w-fit">
            <CheckCircle2 size={16} />
            Média de entrega
          </div>
        </div>
      </div>

      {/* Segunda seção - Rankings / Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Requerentes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Top Requerentes</h2>
          <div className="space-y-4">
            {requesterRanking.length > 0 ? (
              requesterRanking.map((usr, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100">
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {i + 1}º
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{usr.nome}</h4>
                      <p className="text-xs font-medium text-slate-500">Departamento: {usr.depto}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-lg font-bold text-slate-700">{usr.chamados}</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Chamados</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-slate-400">Nenhum dado para mostrar</p>
            )}
          </div>
        </div>

        {/* Chamados por Categoria */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Chamados por Categoria</h2>
          <div className="grid grid-cols-2 gap-4">
            {categoriesStats.map((cat, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-5 border border-slate-100 hover:border-slate-200 transition-colors">
                <h4 className="font-medium text-slate-600 mb-3">{cat.nome}</h4>
                <div className="flex flex-col gap-1">
                  <span className="text-3xl font-extrabold text-slate-800">{cat.total}</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-slate-400">
                    distribuição atual
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chamados Recentes (Tabela) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Listagem de Chamados</h2>
              <p className="text-sm text-slate-500 mt-1">Chamados ativos conforme os filtros aplicados</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">ID</th>
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
                    <td className="px-6 py-4 font-medium text-blue-600">{ticket.id}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{ticket.titulo}</td>
                    <td className="px-6 py-4">{ticket.requerente}</td>
                    <td className="px-6 py-4">{ticket.categoria}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        ticket.prioridade === 'Alta' ? 'bg-red-50 text-red-700 border-red-100' :
                        ticket.prioridade === 'Média' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {ticket.prioridade}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        ticket.status === 'Resolvido' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        ticket.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(ticket.data).toLocaleDateString('pt-BR')}
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