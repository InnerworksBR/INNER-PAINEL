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
import Conta from "../pages/paginasClient/Conta/conta";
import Seguranca from "../pages/paginasClient/Segurança/seguranca";
import Login from "../pages/Login/login";
import RecuperarSenha from "../pages/RecuperarSenha/recuperarSenha";
import RedefinirSenha from "../pages/RedefinirSenha/redefinirSenha";

// Admin Pages
import DashAdmin from "../pages/paginasAdmin/dashAdmin/dashAdmin";
import NOC from "../pages/paginasAdmin/NOC/noc";
import SegurancaAdmin from "../pages/paginasAdmin/segurancaAdmin/segurancaAdmin";
import EmpresasAdmin from "../pages/paginasAdmin/empresasAdmin/empresasAdmin";
import DocAdmin from "../pages/paginasAdmin/docAdmin/docAdmin";
import UsuariosAdmin from "../pages/paginasAdmin/usuariosAdmin/usuariosAdmin";
import ConfigAdmin from "../pages/paginasAdmin/configAdmin/configAdmin";
import AuditAdmin from "../pages/paginasAdmin/auditAdmin/auditAdmin";
import InventarioAdmin from "../pages/paginasAdmin/inventarioAdmin/inventarioAdmin";
import DocumentCreator from "../pages/paginasAdmin/DocumentCreator/documentCreator";

// Route Protection
import { ProtectedRoute, AdminRoute } from "../components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/noc",
    element: (
      <AdminRoute>
        <NOC />
      </AdminRoute>
    ),
  },
  {
    path: "/recuperar-senha",
    element: <RecuperarSenha />,
  },
  {
    path: "/redefinir-senha",
    element: <RedefinirSenha />,
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
      { path: "seguranca", element: <Seguranca /> },
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
      { path: "noc", element: <NOC /> },
      { path: "empresasAdmin", element: <EmpresasAdmin /> },
      { path: "docAdmin", element: <DocAdmin /> },
      { path: "usuariosAdmin", element: <UsuariosAdmin /> },
      { path: "auditAdmin", element: <AuditAdmin /> },
      { path: "inventarioAdmin", element: <InventarioAdmin /> },
      { path: "configAdmin", element: <ConfigAdmin /> },
      { path: "segurancaAdmin", element: <SegurancaAdmin /> },
      { path: "document-creator", element: <DocumentCreator /> },
      { path: "conta", element: <Conta /> },
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
      { path: "seguranca", element: <Seguranca /> },
      { path: "conta", element: <Conta /> },
    ],
  },
]);
