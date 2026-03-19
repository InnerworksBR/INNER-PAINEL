import { LayoutDashboard, Building2, FileText, Users, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const SidebarAdmin = () => {
    const navItemClass = "flex items-center gap-3 p-3 rounded-lg transition-colors";

    const getActiveClass = ({ isActive }) =>
        isActive
            ? `${navItemClass} bg-blue-600 font-normal text-white`
            : `${navItemClass} hover:bg-slate-800 text-slate-300 hover:text-white`;

    return (
        <aside className="w-64 h-screen sticky top-0 bg-slate-900 text-white p-6 flex flex-col">
            <div className="mb-10">
                <h1 className="text-xl font-normal text-white">Suporte Innerworks</h1>
                <p className="text-sm text-slate-400 mt-1">Gestão Administrativa</p>
            </div>

            <nav className="flex flex-col gap-2">
                <NavLink to="/admin/dashAdmin" className={getActiveClass}>
                    <LayoutDashboard size={18} />
                    Dashboard
                </NavLink>

                <NavLink to="/admin/empresasAdmin" className={getActiveClass}>
                    <Building2 size={18} />
                    Empresas
                </NavLink>

                <NavLink to="/admin/docAdmin" className={getActiveClass}>
                    <FileText size={18} />
                    Documentação
                </NavLink>

                <NavLink to="/admin/usuariosAdmin" className={getActiveClass}>
                    <Users size={18} />
                    Usuários
                </NavLink>

                <NavLink to="/admin/configAdmin" className={getActiveClass}>
                    <Settings size={18} />
                    Configurações
                </NavLink>
            </nav>
        </aside>
    );
};

export default SidebarAdmin;
