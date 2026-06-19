import { LayoutDashboard, Building2, FileText, Users, Settings, LogOut, FileSearch, Boxes, X, UserRound } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const SidebarAdmin = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const navItemClass = "flex items-center gap-3 p-3 rounded-lg transition-colors";

    const getActiveClass = ({ isActive }) =>
        isActive
            ? `${navItemClass} bg-blue-600 font-normal text-white`
            : `${navItemClass} hover:bg-slate-800 text-slate-300 hover:text-white`;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <>
        {/* Overlay for mobile */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
                onClick={onClose}
            />
        )}

        <aside className={`w-64 h-screen fixed md:sticky top-0 left-0 bg-slate-900 text-white p-6 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <div className="mb-10 flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-normal text-white">Suporte Innerworks</h1>
                    <p className="text-sm text-slate-400 mt-1">Gestão Administrativa</p>
                    {user && (
                        <p className="text-xs text-slate-500 mt-2 truncate">{user.email}</p>
                    )}
                </div>
                <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800">
                    <X size={20} />
                </button>
            </div>

            <nav className="flex flex-col gap-2 flex-1">
                <NavLink to="/admin/dashAdmin" className={getActiveClass} onClick={onClose}>
                    <LayoutDashboard size={18} />
                    Dashboard
                </NavLink>

                <NavLink to="/admin/empresasAdmin" className={getActiveClass} onClick={onClose}>
                    <Building2 size={18} />
                    Empresas
                </NavLink>

                <NavLink to="/admin/docAdmin" className={getActiveClass} onClick={onClose}>
                    <FileText size={18} />
                    Documentação
                </NavLink>

                <NavLink to="/admin/usuariosAdmin" className={getActiveClass} onClick={onClose}>
                    <Users size={18} />
                    Usuários
                </NavLink>

                <NavLink to="/admin/auditAdmin" className={getActiveClass} onClick={onClose}>
                    <FileSearch size={18} />
                    Auditoria
                </NavLink>

                <NavLink to="/admin/inventarioAdmin" className={getActiveClass} onClick={onClose}>
                    <Boxes size={18} />
                    Inventário
                </NavLink>

                <NavLink to="/admin/configAdmin" className={getActiveClass} onClick={onClose}>
                    <Settings size={18} />
                    Configurações
                </NavLink>
            </nav>

            <div className="border-t border-slate-700 pt-4 mt-4">
                <NavLink to="/admin/conta" className={getActiveClass} onClick={onClose}>
                    <UserRound size={18} />
                    Minha Conta
                </NavLink>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-red-600/20 text-slate-400 hover:text-red-400 w-full mt-1"
                >
                    <LogOut size={18} />
                    Sair
                </button>
            </div>
        </aside>
        </>
    );
};

export default SidebarAdmin;
