import { createBrowserRouter } from "react-router-dom";

import Layout from "../layouts/layout";
import AdminLayout from "../layouts/AdminLayout";
import ClientPreviewLayout from "../layouts/ClientPreviewLayout";
import DashboardGeral from "../pages/paginasClient/Dashboard/dashboard";
import Microsoft365 from "../pages/paginasClient/Microsoft/microsoft";
import Servidores from "../pages/paginasClient/Servidores/servidores";
import Rede from "../pages/paginasClient/Rede/rede";
import DocumentacaoTecnica from "../pages/paginasClient/Documentação/documentacao";
import ChamadosGLPI from "../pages/paginasClient/ChamadosGLPI/chamados";
import Login from "../pages/Login/login";

// Admin Pages
import DashAdmin from "../pages/paginasAdmin/dashAdmin/dashAdmin";
import EmpresasAdmin from "../pages/paginasAdmin/empresasAdmin/empresasAdmin";
import DocAdmin from "../pages/paginasAdmin/docAdmin/docAdmin";
import UsuariosAdmin from "../pages/paginasAdmin/usuariosAdmin/usuariosAdmin";
import ConfigAdmin from "../pages/paginasAdmin/configAdmin/configAdmin";
import AuditAdmin from "../pages/paginasAdmin/auditAdmin/auditAdmin";

// Route Protection
import { ProtectedRoute, AdminRoute } from "../components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/admin/empresas/:companyId/preview",
    element: (
      <AdminRoute>
        <ClientPreviewLayout />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <DashboardGeral /> },
      { path: "dashboard", element: <DashboardGeral /> },
      { path: "ms365", element: <Microsoft365 /> },
      { path: "servidores", element: <Servidores /> },
      { path: "rede", element: <Rede /> },
      { path: "documentacao", element: <DocumentacaoTecnica /> },
      { path: "chamados", element: <ChamadosGLPI /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <DashAdmin /> },
      { path: "dashAdmin", element: <DashAdmin /> },
      { path: "empresasAdmin", element: <EmpresasAdmin /> },
      { path: "docAdmin", element: <DocAdmin /> },
      { path: "usuariosAdmin", element: <UsuariosAdmin /> },
      { path: "auditAdmin", element: <AuditAdmin /> },
      { path: "configAdmin", element: <ConfigAdmin /> },
    ],
  },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardGeral /> },
      { path: "dashboard", element: <DashboardGeral /> },
      { path: "ms365", element: <Microsoft365 /> },
      { path: "servidores", element: <Servidores /> },
      { path: "rede", element: <Rede /> },
      { path: "documentacao", element: <DocumentacaoTecnica /> },
      { path: "chamados", element: <ChamadosGLPI /> },
    ],
  },
]);
