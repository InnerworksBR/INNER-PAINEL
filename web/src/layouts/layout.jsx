import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import MobileHeader from "../components/MobileHeader";

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row min-h-screen" style={{ background: '#fafaf9' }}>
      {/* Sidebar */}
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile Header */}
        <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} />

        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
