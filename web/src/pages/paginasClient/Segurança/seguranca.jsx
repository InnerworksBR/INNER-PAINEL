import React, { useState, useEffect, useRef } from 'react';
import { Shield, Globe, FileText, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import api from '../../../services/api';
import { useClientRequestConfig } from '../../../context/ClientPreviewContext';

const TABS = [
  {
    type: 'zero_trust',
    label: 'Análise Zero Trust',
    icon: Globe,
    description: 'Relatório detalhado de análise de risco',
    mime: 'text/html',
  },
  {
    type: 'simplified',
    label: 'Relatório Simplificado',
    icon: FileText,
    description: 'Versão em linguagem acessível',
    mime: 'application/pdf',
  },
];

const Seguranca = () => {
  const [activeTab, setActiveTab] = useState('zero_trust');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewUrls, setViewUrls] = useState({});
  const [loadingView, setLoadingView] = useState({});
  const [error, setError] = useState('');
  const requestConfig = useClientRequestConfig();
  const blobUrlsRef = useRef([]);

  useEffect(() => {
    api.get('/client/security', requestConfig)
      .then((res) => setReports(res.data || []))
      .catch(() => setError('Não foi possível carregar os relatórios.'))
      .finally(() => setLoading(false));
  }, [requestConfig]);

  // Limpa os Blob URLs criados ao desmontar o componente
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      blobUrlsRef.current = [];
    };
  }, []);

  // Carrega o relatório quando a aba muda ou os reports chegam.
  // Busca o arquivo via signed URL e o reembala como Blob com o MIME
  // correto — assim o iframe renderiza o HTML/PDF independente do
  // Content-Type que o Supabase Storage devolve.
  useEffect(() => {
    const tab = TABS.find((t) => t.type === activeTab);
    const report = reports.find((r) => r.report_type === activeTab);
    if (!report || viewUrls[report.id] || loadingView[report.id]) return;

    let cancelled = false;
    setLoadingView((prev) => ({ ...prev, [report.id]: true }));

    api.get(`/client/security/${report.id}/view`, requestConfig)
      .then(async (res) => {
        const fileRes = await fetch(res.data.url);
        const buffer = await fileRes.arrayBuffer();
        const blob = new Blob([buffer], { type: tab.mime });
        const blobUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        blobUrlsRef.current.push(blobUrl);
        setViewUrls((prev) => ({ ...prev, [report.id]: blobUrl }));
      })
      .catch(() => {
        if (cancelled) return;
        setError('Erro ao carregar relatório. Tente novamente.');
        setTimeout(() => setError(''), 5000);
      })
      .finally(() => {
        if (!cancelled) setLoadingView((prev) => ({ ...prev, [report.id]: false }));
      });

    return () => { cancelled = true; };
  }, [activeTab, reports, requestConfig]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 font-medium">
          Carregando relatórios de segurança...
        </span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Segurança</h1>
        </div>
        <p className="text-gray-500 ml-10">
          Análise de risco e relatórios de segurança do ambiente de TI
        </p>
      </div>

      {/* Erro */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Abas */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map(({ type, label, icon: Icon }) => {
            const report = reports.find((r) => r.report_type === type);
            const available = !!report;
            return (
              <button
                key={type}
                onClick={() => available && setActiveTab(type)}
                disabled={!available}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === type
                    ? 'border-blue-600 text-blue-600'
                    : available
                    ? 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'
                    : 'border-transparent text-gray-300 cursor-not-allowed'
                }`}
              >
                <Icon size={16} />
                {label}
                {!available && (
                  <span className="text-xs text-gray-300 font-normal">(indisponível)</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Abrir em nova aba */}
        {viewUrls[reports.find((r) => r.report_type === activeTab)?.id] && (
          <a
            href={viewUrls[reports.find((r) => r.report_type === activeTab)?.id]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors pb-2"
          >
            <ExternalLink size={15} />
            Abrir em nova aba
          </a>
        )}
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1">
        {TABS.map(({ type }) => {
          if (activeTab !== type) return null;
          const report = reports.find((r) => r.report_type === type);

          if (!report) {
            return (
              <div
                key={type}
                className="flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200"
                style={{ minHeight: '500px' }}
              >
                <div className="text-center space-y-3">
                  <AlertCircle
                    size={40}
                    className="text-gray-300 mx-auto"
                    strokeWidth={1}
                  />
                  <p className="text-gray-400">Nenhum relatório disponível no momento.</p>
                  <p className="text-sm text-gray-400">
                    Entre em contato com o suporte para mais informações.
                  </p>
                </div>
              </div>
            );
          }

          const url = viewUrls[report.id];
          const isLoadingView = loadingView[report.id];

          return (
            <div
              key={type}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
            >
              {isLoadingView || !url ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="ml-3 text-gray-500">Carregando relatório...</span>
                </div>
              ) : (
                <iframe
                  src={url}
                  title={report.title}
                  className="w-full h-full"
                  style={{ border: 'none' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Seguranca;
