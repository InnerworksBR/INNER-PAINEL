import { LayoutDashboard, Cloud, Server, Network, FileText, Ticket, LogOut, UserRound, X, Shield, ChevronRight, Settings } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useClientPortalPath, useClientPreview } from "../context/ClientPreviewContext";

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const portalPath = useClientPortalPath();
  const preview = useClientPreview();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { to: portalPath('dashboard'), icon: LayoutDashboard, label: 'Dashboard', badge: null },
    { to: portalPath('ms365'), icon: Cloud, label: 'Microsoft 365', badge: null },
    { to: portalPath('servidores'), icon: Server, label: 'Servidores', badge: null },
    { to: portalPath('rede'), icon: Network, label: 'Rede', badge: null },
    { to: portalPath('documentacao'), icon: FileText, label: 'Documentação', badge: null },
    { to: portalPath('chamados'), icon: Ticket, label: 'Chamados GLPI', badge: null },
    { to: portalPath('seguranca'), icon: Shield, label: 'Segurança', badge: null },
  ];

  const bottomItems = !preview?.isPreview ? [
    { to: portalPath('conta'), icon: UserRound, label: 'Minha Conta', badge: null },
  ] : [];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50
          h-screen w-[280px]
          flex flex-col
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'linear-gradient(180deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
        }}
      >
        {/* Decorative gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }}
          />
          <div
            className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }}
          />
        </div>

        {/* Header */}
        <div className="relative p-6 border-b border-white/5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Logo area with subtle glow */}
              <div className="flex items-center gap-3 mb-1">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    <span className="text-white font-bold text-lg">I</span>
                  </div>
                  <div
                    className="absolute inset-0 rounded-xl blur-md opacity-50"
                    style={{ background: '#10b981' }}
                  />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg tracking-tight">INNER</h1>
                  <p className="text-white/40 text-[10px] font-medium tracking-widest uppercase">Painel de Gestão</p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* User info */}
          {user && (
            <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 flex items-center justify-center border border-emerald-500/20">
                  <span className="text-emerald-400 text-sm font-semibold">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">
                    {user.name || user.email?.split('@')[0] || 'Usuário'}
                  </p>
                  <p className="text-white/40 text-xs truncate">{user.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-1">
            {menuItems.map((item, index) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) => `
                  group relative flex items-center gap-3 px-4 py-3 rounded-xl
                  text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-900/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                  }
                `}
                style={({ isActive }) => isActive ? {
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(16, 185, 129, 0.3)'
                } : {}}
              >
                {({ isActive }) => (
                  <>
                    {/* Active indicator */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                        style={{ background: 'linear-gradient(180deg, #34d399 0%, #10b981 100%)' }}
                      />
                    )}

                    {/* Icon */}
                    <item.icon
                      size={20}
                      className={`
                        transition-colors duration-200
                        ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'}
                      `}
                    />

                    {/* Label */}
                    <span className="flex-1">{item.label}</span>

                    {/* Badge or indicator */}
                    {isActive && (
                      <ChevronRight size={16} className="text-white/60" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Divider */}
          <div className="my-4 mx-4 h-px bg-white/5" />

          {/* Bottom section */}
          <div className="space-y-1">
            {bottomItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) => `
                  group flex items-center gap-3 px-4 py-3 rounded-xl
                  text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <item.icon
                  size={20}
                  className={`
                    transition-colors duration-200
                    ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70'}
                  `}
                />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Settings link for admins */}
            {user?.role === 'admin' && (
              <NavLink
                to="/admin/config"
                onClick={onClose}
                className={({ isActive }) => `
                  group flex items-center gap-3 px-4 py-3 rounded-xl
                  text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <Settings
                  size={20}
                  className="text-white/40 group-hover:text-white/70 transition-colors"
                />
                <span>Configurações</span>
              </NavLink>
            )}
          </div>
        </nav>

        {/* Footer - Logout */}
        <div className="relative p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="group w-full flex items-center gap-3 px-4 py-3 rounded-xl
              text-sm font-medium text-white/50 hover:text-red-400
              hover:bg-red-500/10 transition-all duration-200"
          >
            <LogOut
              size={20}
              className="text-white/30 group-hover:text-red-400 transition-colors"
            />
            <span className="group-hover:translate-x-0.5 transition-transform">
              Sair da conta
            </span>
          </button>

          {/* Version tag */}
          <p className="text-center text-white/20 text-[10px] mt-3 font-medium tracking-wider">
            INNER PAINEL v2.0
          </p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
