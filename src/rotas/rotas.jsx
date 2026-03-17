import { createBrowserRouter } from "react-router-dom";

import Layout from "../layouts/layout";
import AdminLayout from "../layouts/AdminLayout";
import DashboardGeral from "../pages/Dashboard/dashboard";
import Microsoft365 from "../pages/Microsoft/microsoft";
import Servidores from "../pages/Servidores/servidores";
import Rede from "../pages/Rede/rede";
import DocumentacaoTecnica from "../pages/Documentação/documentacao";
import ChamadosGLPI from "../pages/ChamadosGLPI/chamados";
import Login from "../pages/Login/login";

// Admin Pages
import DashAdmin from "../pages/paginasAdmin/dashAdmin/dashAdmin";
import EmpresasAdmin from "../pages/paginasAdmin/empresasAdmin/empresasAdmin";
import DocAdmin from "../pages/paginasAdmin/docAdmin/docAdmin";
import UsuariosAdmin from "../pages/paginasAdmin/usuariosAdmin/usuariosAdmin";
import ConfigAdmin from "../pages/paginasAdmin/configAdmin/configAdmin";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <DashAdmin /> },
      { path: "dashAdmin", element: <DashAdmin /> },
      { path: "empresasAdmin", element: <EmpresasAdmin /> },
      { path: "docAdmin", element: <DocAdmin /> },
      { path: "usuariosAdmin", element: <UsuariosAdmin /> },
      { path: "configAdmin", element: <ConfigAdmin /> },
    ],
  },
  {
    path: "/app",
    element: <Layout />,
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