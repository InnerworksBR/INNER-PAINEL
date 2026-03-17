import { Outlet } from "react-router-dom";
import SidebarAdmin from "../components/SidebarAdmin";
import { CompanyProvider } from "../context/CompanyContext";

const AdminLayout = () => {
    return (
        <CompanyProvider>
            <div className="flex min-h-screen font-admin font-normal text-slate-900">
                <SidebarAdmin />
                <main className="flex-1 bg-gray-100 p-8">
                    <Outlet />
                </main>
            </div>
        </CompanyProvider>
    );
};

export default AdminLayout;
