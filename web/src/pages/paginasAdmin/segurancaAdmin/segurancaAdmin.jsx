import React, { useState, useRef, useEffect } from 'react';
import {
  Shield, CloudUpload, RefreshCw, Trash2, AlertCircle,
  CheckCircle, Eye, ChevronDown, Globe, FileText
} from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
import api from '../../../services/api';

const REPORT_TYPES = [
  {
    key: 'zero_trust',
    label: 'Relatório Zero Trust',
    description: 'Análise de risco em formato HTML interativo',
    icon: Globe,
    accept: '.html,text/html',
    headerBg: 'bg-blue-50/30',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    uploadHoverBorder: 'hover:border-blue-300',
    uploadHoverBg: 'hover:bg-blue-50/20',
    uploadIconColor: 'text-blue-500',
    previewColor: 'text-blue-500 hover:bg-blue-50',
  },
  {
    key: 'simplified',
    label: 'Relatório Simplificado',
    description: 'Relatório em linguagem acessível (PDF)',
    icon: FileText,
    accept: '.pdf,application/pdf',
    headerBg: 'bg-purple-50/30',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    uploadHoverBorder: 'hover:border-purple-300',
    uploadHoverBg: 'hover:bg-purple-50/20',
    uploadIconColor: 'text-purple-500',
    previewColor: 'text-purple-500 hover:bg-purple-50',
  },
];

const SegurancaAdmin = () => {
  const { companies } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [reports, setReports] = useState([]);
  const [uploading, setUploading] = useState({});
  const [message, setMessage] = useState(null);
  const fileInputRefs = useRef({});

  useEffect(() => {
    if (companies.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    api.get('/admin/security', { params: { company_id: selectedCompanyId } })
      .then((res) => setReports(res.data))
      .catch((err) => console.error('Erro ao buscar relatórios:', err));
  }, [selectedCompanyId]);

  const getReport = (type) => reports.find((r) => r.report_type === type);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleUpload = async (reportType, files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading((prev) => ({ ...prev, [reportType]: true }));

    const formData = new FormData();
    formData.append('company_id', selectedCompanyId);
    formData.append('report_type', reportType);
    formData.append('title', file.name);
    formData.append('file', file);

    try {
      await api.post('/admin/security/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showMessage('success', 'Relatório enviado com sucesso!');
      const res = await api.get('/admin/security', { params: { company_id: selectedCompanyId } });
      setReports(res.data);
    } catch (err) {
      showMessage('error', 'Erro no upload: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading((prev) => ({ ...prev, [reportType]: false }));
      if (fileInputRefs.current[reportType]) fileInputRefs.current[reportType].value = '';
    }
  };

  const handleDelete = async (report) => {
    if (!window.confirm('Remover este relatório permanentemente?')) return;
    try {
      await api.delete(`/admin/security/${report.id}`);
      showMessage('success', 'Relatório removido.');
      const res = await api.get('/admin/security', { params: { company_id: selectedCompanyId } });
      setReports(res.data);
    } catch (err) {
      showMessage('error', 'Erro ao remover: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePreview = async (report) => {
    try {
      const res = await api.get(`/admin/security/${report.id}/view`);
      window.open(res.data.url, '_blank');
    } catch {
      showMessage('error', 'Erro ao gerar link de visualização.');
    }
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12 font-admin">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Shield size={32} className="text-blue-600" strokeWidth={1.5} />
          <h1 className="text-4xl font-normal text-slate-900 tracking-tight">Segurança</h1>
        </div>
        <p className="text-slate-500 text-lg font-light">
          Relatórios de análise de risco por empresa
        </p>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success'
            ? <CheckCircle size={18} />
            : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Seletor de empresa */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <label className="block text-xs text-slate-500 uppercase tracking-widest font-light mb-3">
          Empresa
        </label>
        <div className="relative inline-block w-full max-w-md">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            size={16}
          />
        </div>
      </div>

      {/* Cards de upload por tipo de relatório */}
      {selectedCompanyId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {REPORT_TYPES.map((rt) => {
            const existing = getReport(rt.key);
            const isUploading = uploading[rt.key];
            const Icon = rt.icon;

            return (
              <div
                key={rt.key}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
              >
                {/* Cabeçalho do card */}
                <div className={`p-6 border-b border-slate-100 ${rt.headerBg}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${rt.iconBg} ${rt.iconColor}`}>
                      <Icon size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-normal text-slate-800">{rt.label}</h3>
                      <p className="text-sm text-slate-500 font-light">{rt.description}</p>
                    </div>
                  </div>
                </div>

                {/* Corpo do card */}
                <div className="p-6 space-y-4">
                  {/* Status atual */}
                  {existing ? (
                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle size={18} className="text-emerald-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-normal text-emerald-800 truncate">
                            {existing.title}
                          </p>
                          <p className="text-xs text-emerald-600 font-light">
                            Atualizado em{' '}
                            {new Date(existing.updated_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-3">
                        <button
                          onClick={() => handlePreview(existing)}
                          className={`p-2 rounded-lg transition-colors ${rt.previewColor}`}
                          title="Visualizar no navegador"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(existing)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-2xl text-center">
                      <p className="text-sm text-slate-400 font-light">
                        Nenhum relatório enviado para{' '}
                        <span className="font-normal text-slate-500">
                          {selectedCompany?.name}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Input oculto */}
                  <input
                    type="file"
                    accept={rt.accept}
                    ref={(el) => { fileInputRefs.current[rt.key] = el; }}
                    className="hidden"
                    onChange={(e) => handleUpload(rt.key, e.target.files)}
                  />

                  {/* Botão de upload */}
                  <button
                    onClick={() => !isUploading && fileInputRefs.current[rt.key]?.click()}
                    disabled={isUploading}
                    className={`w-full p-4 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center gap-3 border-slate-200 ${
                      isUploading
                        ? 'opacity-60 cursor-not-allowed'
                        : `${rt.uploadHoverBorder} ${rt.uploadHoverBg} cursor-pointer`
                    }`}
                  >
                    {isUploading ? (
                      <RefreshCw size={18} className="animate-spin text-slate-400" />
                    ) : (
                      <CloudUpload size={18} className={rt.uploadIconColor} />
                    )}
                    <span className="text-sm text-slate-600">
                      {isUploading
                        ? 'Enviando...'
                        : existing
                        ? 'Substituir arquivo'
                        : 'Enviar arquivo'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Overview de todas as empresas */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-2xl font-normal text-slate-800">Visão Geral</h2>
          <p className="text-sm text-slate-500 font-light mt-1">
            Status dos relatórios de segurança em todas as empresas
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest font-light">
                  Empresa
                </th>
                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest font-light">
                  Zero Trust (HTML)
                </th>
                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest font-light">
                  Simplificado (PDF)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => {
                const companyReports = reports.filter((r) => r.company_id === company.id);
                const hasZeroTrust = companyReports.some((r) => r.report_type === 'zero_trust');
                const hasSimplified = companyReports.some((r) => r.report_type === 'simplified');

                return (
                  <tr
                    key={company.id}
                    className={`hover:bg-blue-50/20 transition-colors cursor-pointer ${
                      selectedCompanyId === company.id ? 'bg-blue-50/30' : ''
                    }`}
                    onClick={() => setSelectedCompanyId(company.id)}
                  >
                    <td className="px-6 py-4 text-sm font-normal text-slate-800">
                      {company.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        hasZeroTrust
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {hasZeroTrust ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                        {hasZeroTrust ? 'Disponível' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        hasSimplified
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {hasSimplified ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                        {hasSimplified ? 'Disponível' : 'Pendente'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SegurancaAdmin;
