import { LayoutDashboard, Cloud, Server, Network, FileText, Ticket, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClientPortalPath } from "../context/ClientPreviewContext";

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const portalPath = useClientPortalPath();

  const navItemClass = "flex items-center gap-3 p-3 rounded-lg transition-colors";

  const getActiveClass = ({ isActive }) =>
    isActive
      ? `${navItemClass} bg-blue-600 font-medium text-white`
      : `${navItemClass} hover:bg-slate-800 text-slate-300 hover:text-white`;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="w-64 h-screen sticky top-0 bg-slate-900 text-white p-6 flex flex-col">

      <div className="mb-10">
        <h1 className="text-xl font-bold text-white">Portal de Contratos</h1>
        <p className="text-sm text-slate-400 mt-1">Gestão de TI</p>
        {user && (
          <p className="text-xs text-slate-500 mt-2 truncate">{user.email}</p>
        )}
      </div>

      <nav className="flex flex-col gap-2 flex-1">

        <NavLink to={portalPath('dashboard')} className={getActiveClass}>
          <LayoutDashboard size={18} />
          Dashboard Geral
        </NavLink>

        <NavLink to={portalPath('ms365')} className={getActiveClass}>
          <Cloud size={18} />
          Microsoft 365
        </NavLink>

        <NavLink to={portalPath('servidores')} className={getActiveClass}>
          <Server size={18} />
          Servidores
        </NavLink>

        <NavLink to={portalPath('rede')} className={getActiveClass}>
          <Network size={18} />
          Rede
        </NavLink>

        <NavLink to={portalPath('documentacao')} className={getActiveClass}>
          <FileText size={18} />
          Documentação Técnica
        </NavLink>

        <NavLink to={portalPath('chamados')} className={getActiveClass}>
          <Ticket size={18} />
          Chamados GLPI
        </NavLink>

      </nav>

      <div className="border-t border-slate-700 pt-4 mt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-red-600/20 text-slate-400 hover:text-red-400 w-full"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>

    </aside>
  );
};

export default Sidebar;