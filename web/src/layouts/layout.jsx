import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row min-h-screen overflow-hidden">

      {/* Sidebar */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Conteúdo */}
      <main className="flex-1 bg-gray-100 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} title="Portal de Contratos" />
        <div className="p-4 sm:p-8 flex-1">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default Layout;