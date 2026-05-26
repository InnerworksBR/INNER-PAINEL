import { useState } from "react";
import { ArrowLeft, Eye } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import MobileHeader from '../components/MobileHeader';
import { ClientPreviewProvider, useClientPreview } from '../context/ClientPreviewContext';

const PreviewShell = () => {
  const { company, loading, error } = useClientPreview();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) return <div className="p-4 sm:p-8 text-slate-500">Carregando visualização...</div>;
  if (error) return <div className="p-4 sm:p-8 text-red-600">{error}</div>;

  return (
    <div className="flex flex-col md:flex-row min-h-screen overflow-hidden">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 bg-gray-100 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <MobileHeader onMenuClick={() => setIsMobileMenuOpen(true)} title="Portal de Contratos (Visualização)" />
        <div className="md:sticky md:top-0 z-10 border-b border-amber-200 bg-amber-50 px-4 sm:px-8 py-3 text-amber-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <Eye size={18} />
              Visualizando como cliente: <strong>{company?.name}</strong> — modo administrativo
            </div>
            <Link to="/admin/empresasAdmin" className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-amber-100">
              <ArrowLeft size={16} />
              Voltar ao admin
            </Link>
          </div>
        </div>
        <main className="p-4 sm:p-8 flex-1"><Outlet /></main>
      </div>
    </div>
  );
};

const ClientPreviewLayout = () => (
  <ClientPreviewProvider>
    <PreviewShell />
  </ClientPreviewProvider>
);

export default ClientPreviewLayout;
