import { Menu, Bell, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

const MobileHeader = ({ onMenuClick, title }) => {
  const location = useLocation();

  // Dynamic title based on route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return 'Dashboard';
    if (path.includes('ms365') || path.includes('microsoft')) return 'Microsoft 365';
    if (path.includes('servidores')) return 'Servidores';
    if (path.includes('rede')) return 'Rede';
    if (path.includes('documentacao')) return 'Documentação';
    if (path.includes('chamados')) return 'Chamados GLPI';
    if (path.includes('seguranca')) return 'Segurança';
    if (path.includes('conta')) return 'Minha Conta';
    return title || 'Portal';
  };

  return (
    <header
      className="md:hidden sticky top-0 z-30 backdrop-blur-xl border-b"
      style={{
        background: 'rgba(28, 25, 23, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.08)'
      }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left - Menu */}
        <button
          onClick={onMenuClick}
          className="w-10 h-10 rounded-xl flex items-center justify-center
            text-white/60 hover:text-white hover:bg-white/5
            transition-all duration-200"
          aria-label="Abrir menu"
        >
          <Menu size={22} />
        </button>

        {/* Center - Logo & Title */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            <span className="text-white font-bold text-sm">I</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm tracking-tight">{getPageTitle()}</h1>
            <p className="text-white/40 text-[10px] font-medium tracking-widest uppercase">INNER</p>
          </div>
        </div>

        {/* Right - Actions */}
        <div className="flex items-center gap-1">
          <button
            className="w-10 h-10 rounded-xl flex items-center justify-center
              text-white/60 hover:text-white hover:bg-white/5
              transition-all duration-200 relative"
            aria-label="Notificações"
          >
            <Bell size={20} />
            {/* Notification dot */}
            <span
              className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500"
              style={{ boxShadow: '0 0 8px #10b981' }}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
