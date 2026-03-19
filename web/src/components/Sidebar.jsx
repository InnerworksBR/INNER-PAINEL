import { LayoutDashboard, Cloud, Server, Network, FileText, Ticket } from "lucide-react";
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  // Classe base para os links de navegação
  const navItemClass = "flex items-center gap-3 p-3 rounded-lg transition-colors";

  // Função para definir o estilo baseado no estado ativo da rota
  const getActiveClass = ({ isActive }) =>
    isActive
      ? `${navItemClass} bg-blue-600 font-medium text-white`
      : `${navItemClass} hover:bg-slate-800 text-slate-300 hover:text-white`;

  return (
    <aside className="w-64 h-screen sticky top-0 bg-slate-900 text-white p-6 flex flex-col">

      <div className="mb-10">
        <h1 className="text-xl font-bold text-white">Portal de Contratos</h1>
        <p className="text-sm text-slate-400 mt-1">Gestão de TI</p>
      </div>

      <nav className="flex flex-col gap-2">

        <NavLink to="/app/dashboard" className={getActiveClass}>
          <LayoutDashboard size={18} />
          Dashboard Geral
        </NavLink>

        <NavLink to="/app/ms365" className={getActiveClass}>
          <Cloud size={18} />
          Microsoft 365
        </NavLink>

        <NavLink to="/app/servidores" className={getActiveClass}>
          <Server size={18} />
          Servidores
        </NavLink>

        <NavLink to="/app/rede" className={getActiveClass}>
          <Network size={18} />
          Rede
        </NavLink>

        <NavLink to="/app/documentacao" className={getActiveClass}>
          <FileText size={18} />
          Documentação Técnica
        </NavLink>

        <NavLink to="/app/chamados" className={getActiveClass}>
          <Ticket size={18} />
          Chamados GLPI
        </NavLink>

      </nav>

    </aside>
  );
};

export default Sidebar;