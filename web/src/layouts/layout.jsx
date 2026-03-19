import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const Layout = () => {
  return (
    <div className="flex min-h-screen">

      {/* Sidebar */}
      <Sidebar />

      {/* Conteúdo */}
      <main className="flex-1 bg-gray-100 p-8">
        <Outlet />
      </main>

    </div>
  );
};

export default Layout;