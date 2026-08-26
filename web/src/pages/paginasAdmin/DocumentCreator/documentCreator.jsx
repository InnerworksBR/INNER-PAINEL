import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import TemplateSelector from './TemplateSelector';
import DocForm from './DocForm';
import DocPreview from './DocPreview';
import api from '../../../services/api';
import { useCompanies } from '../../../context/CompanyContext';

const INITIAL_FORM_DATA = {
  cliente: '',
  assunto: '',
  valor: '',
  descricao: '',
  prazo_entrega: '',
  nome_sistema: '',
  funcionalidades: '',
  tecnologias: '',
  cronograma: '',
  mes_ano: '',
  resumo_executivo: '',
  metricas: '',
  ocorrencias: '',
  proximos_passos: '',
  mensagem: '',
};

const DocumentCreator = () => {
  const { companies } = useCompanies();
  const iframeRef = useRef(null);

  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
    setGeneratedContent(null);
  }, []);

  const handleTemplateSelect = useCallback((template) => {
    setSelectedTemplate(template);
    setFormData(INITIAL_FORM_DATA);
    setErrors({});
    setGeneratedContent(null);
  }, []);

  const validateForm = () => {
    if (!selectedTemplate) {
      showNotification('error', 'Selecione um modelo de documento');
      return false;
    }

    const newErrors = {};
    let hasErrors = false;

    selectedTemplate.fields.forEach((field) => {
      const value = formData[field]?.trim();
      const requiredFields = selectedTemplate.fields.filter((f) => {
        const fieldConfig = {
          cliente: true,
          assunto: true,
          valor: true,
          descricao: true,
          prazo_entrega: false,
          nome_sistema: true,
          funcionalidades: true,
          tecnologias: false,
          cronograma: false,
          mes_ano: true,
          resumo_executivo: true,
          metricas: false,
          ocorrencias: false,
          proximos_passos: false,
          mensagem: true,
        };
        return fieldConfig[f] || false;
      });

      if (requiredFields.includes(field) && !value) {
        newErrors[field] = 'Este campo é obrigatório';
        hasErrors = true;
      }
    });

    setErrors(newErrors);
    return !hasErrors;
  };

  const generateWithAI = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);

    try {
      const response = await api.post('/admin/documents/generate', {
        template: selectedTemplate.id,
        formData,
        templateLabel: selectedTemplate.label,
      });

      if (response.data?.content) {
        setGeneratedContent(response.data.content);
        showNotification('success', 'Documento gerado com sucesso!');
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (err) {
      console.error('Erro ao gerar documento:', err);
      showNotification(
        'error',
        err.response?.data?.error || 'Falha ao gerar documento. Tente novamente.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!generatedContent && !selectedTemplate) {
      showNotification('error', 'Gere o documento primeiro');
      return;
    }

    try {
      const response = await api.post('/admin/documents/download-pdf', {
        html: generatedContent,
        template: selectedTemplate.id,
        filename: `${selectedTemplate.label.replace(/\s+/g, '_')}_${formData.cliente || 'documento'}`,
      }, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${selectedTemplate.label.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotification('success', 'Download iniciado!');
    } catch (err) {
      console.error('Erro ao baixar PDF:', err);
      showNotification('error', 'Falha ao gerar PDF. Tente novamente.');
    }
  };

  const sendEmail = async () => {
    if (!selectedCompany) {
      showNotification('error', 'Selecione uma empresa para enviar');
      return;
    }

    try {
      await api.post('/admin/documents/send-email', {
        template: selectedTemplate.id,
        formData,
        html: generatedContent,
        companyId: selectedCompany,
      });

      showNotification('success', 'E-mail enviado com sucesso!');
    } catch (err) {
      console.error('Erro ao enviar e-mail:', err);
      showNotification(
        'error',
        err.response?.data?.error || 'Falha ao enviar e-mail. Tente novamente.'
      );
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 pb-12 font-admin">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-4xl font-normal text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-xl">
            <Sparkles size={28} className="text-purple-600" />
          </div>
          Criador de Documentos com IA
        </h1>
        <p className="text-slate-500 text-lg font-normal font-light">
          Crie documentos comerciais profissionais usando inteligência artificial
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`
            fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg
            animate-in slide-in-from-top-2 duration-300
            ${notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
            }
          `}
        >
          {notification.type === 'success' ? (
            <CheckCircle size={20} className="text-emerald-500" />
          ) : (
            <AlertCircle size={20} className="text-red-500" />
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column - Form */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onSelect={handleTemplateSelect}
            />
          </div>

          {/* Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <DocForm
              template={selectedTemplate}
              formData={formData}
              onChange={handleFieldChange}
              errors={errors}
            />
          </div>

          {/* Company Selection & Actions */}
          {selectedTemplate && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Selecionar Empresa (para envio de e-mail)
                  </label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                  >
                    <option value="">Selecione uma empresa...</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={generateWithAI}
                    disabled={isGenerating}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm
                      transition-all duration-200
                      ${isGenerating
                        ? 'bg-purple-400 text-white cursor-wait'
                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow'
                      }
                    `}
                  >
                    <Sparkles size={18} />
                    {isGenerating ? 'Gerando...' : 'Gerar com IA'}
                  </button>
                  <button
                    onClick={sendEmail}
                    disabled={!selectedCompany || !generatedContent}
                    className={`
                      flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm
                      transition-all duration-200
                      ${!selectedCompany || !generatedContent
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                      }
                    `}
                  >
                    <Mail size={18} />
                    Enviar E-mail
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Preview */}
        <div className="h-[calc(100vh-200px)] xl:h-auto xl:min-h-[700px]">
          <DocPreview
            ref={iframeRef}
            template={selectedTemplate}
            formData={formData}
            generatedContent={generatedContent}
            onGenerate={generateWithAI}
            onDownload={downloadPDF}
            onEmail={sendEmail}
            isGenerating={isGenerating}
          />
        </div>
      </div>
    </div>
  );
};

export default DocumentCreator;
