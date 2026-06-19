import React, { useState, useEffect } from 'react';
import { Shield, Globe, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../../services/api';
import { useClientRequestConfig } from '../../../context/ClientPreviewContext';

const TABS = [
  {
    type: 'zero_trust',
    label: 'Análise Zero Trust',
    icon: Globe,
    description: 'Relatório detalhado de análise de risco',
  },
  {
    type: 'simplified',
    label: 'Relatório Simplificado',
    icon: FileText,
    description: 'Versão em linguagem acessível',
  },
];

const Seguranca = () => {
  const [activeTab, setActiveTab] = useState('zero_trust');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewUrls, setViewUrls] = useState({});     // PDF: signed URL direto
  const [htmlContent, setHtmlContent] = useState({}); // HTML: conteúdo para srcdoc
  const [loadingView, setLoadingView] = useState({});
  const [error, setError] = useState('');
  const requestConfig = useClientRequestConfig();

  useEffect(() => {
    api.get('/client/security', requestConfig)
      .then((res) => setReports(res.data || []))
      .catch(() => setError('Não foi possível carregar os relatórios.'))
      .finally(() => setLoading(false));
  }, [requestConfig]);

  // Carrega o relatório quando a aba muda ou os reports chegam
  useEffect(() => {
    const report = reports.find((r) => r.report_type === activeTab);
    if (!report) return;
    if (viewUrls[report.id] || htmlContent[report.id] || loadingView[report.id]) return;

    setLoadingView((prev) => ({ ...prev, [report.id]: true }));

    api.get(`/client/security/${report.id}/view`, requestConfig)
      .then(async (res) => {
        const signedUrl = res.data.url;

        if (report.report_type === 'zero_trust') {
          // HTML: buscar conteúdo e usar srcdoc para forçar renderização correta
          const htmlRes = await fetch(signedUrl);
          const htmlText = await htmlRes.text();
          setHtmlContent((prev) => ({ ...prev, [report.id]: htmlText }));
        } else {
          // PDF: signed URL direto funciona bem no iframe
          setViewUrls((prev) => ({ ...prev, [report.id]: signedUrl }));
        }
      })
      .catch(() => {
        setError('Erro ao carregar relatório. Tente novamente.');
        setTimeout(() => setError(''), 5000);
      })
      .finally(() => {
        setLoadingView((prev) => ({ ...prev, [report.id]: false }));
      });
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
      <div className="flex gap-1 mb-6 border-b border-gray-200">
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

          const pdfUrl = viewUrls[report.id];
          const html = htmlContent[report.id];
          const isLoadingView = loadingView[report.id];
          const isReady = report.report_type === 'zero_trust' ? !!html : !!pdfUrl;

          return (
            <div
              key={type}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}
            >
              {isLoadingView || !isReady ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <span className="ml-3 text-gray-500">Carregando relatório...</span>
                </div>
              ) : report.report_type === 'zero_trust' ? (
                <iframe
                  srcDoc={html}
                  title={report.title}
                  className="w-full h-full"
                  style={{ border: 'none' }}
                />
              ) : (
                <iframe
                  src={pdfUrl}
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
