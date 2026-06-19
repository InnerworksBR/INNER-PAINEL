import { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarAdmin from "../components/SidebarAdmin";
import { CompanyProvider } from "../context/CompanyContext";
import MobileHeader from "../components/MobileHeader";

const AdminLayout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <CompanyProvider>
            <div className="flex flex-col md:flex-row min-h-screen font-admin font-normal text-slate-900">
                <SidebarAdmin isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
                <main className="flex-1 bg-gray-100 flex flex-col min-h-screen min-w-0 overflow-y-auto overflow-x-hidden">
                    <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} title="Suporte Innerworks" />
                    <div className="p-4 sm:p-8 flex-1">
                        <Outlet />
                    </div>
                </main>
            </div>
        </CompanyProvider>
    );
};

export default AdminLayout;
