import { useState } from "react";
import { Outlet } from "react-router-dom";
import SidebarAdmin from "../components/SidebarAdmin";
import { CompanyProvider } from "../context/CompanyContext";
import MobileHeader from "../components/MobileHeader";

const AdminLayout = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <CompanyProvider>
            <div className="flex flex-col md:flex-row min-h-screen" style={{ background: '#fafaf9' }}>
                <SidebarAdmin isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
                <main className="flex-1 flex flex-col min-h-screen min-w-0">
                    <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
                    <div className="p-4 sm:p-6 lg:p-8 flex-1">
                        <Outlet />
                    </div>
                </main>
            </div>
        </CompanyProvider>
    );
};

export default AdminLayout;
