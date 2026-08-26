import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Building2 } from 'lucide-react';
import BasicInfo from './steps/BasicInfo';
import ModulesSelect from './steps/ModulesSelect';
import Integrations from './steps/Integrations';
import Notifications from './steps/Notifications';
import api from '../../../services/api';

const STEPS = [
  { id: 1, title: 'Dados Básicos', description: 'Informações da empresa' },
  { id: 2, title: 'Módulos', description: 'Selecione os módulos' },
  { id: 3, title: 'Integrações', description: 'Configure conexões' },
  { id: 4, title: 'Notificações', description: 'Alertas e e-mails' },
];

const DEFAULT_FORM_DATA = {
  // Basic Info
  name: '',
  cnpj: '',
  sector: '',
  phone: '',
  email: '',

  // Modules
  enabled_modules: ['dashboard', 'ms365', 'chamados'],

  // Integrations
  glpi_enabled: false,
  glpi_entity_id: '',
  ms365_enabled: false,
  ms_graph_tenant_id: '',
  ms_graph_client_id: '',
  ms_graph_client_secret: '',
  zabbix_enabled: false,
  zabbix_api_url: '',
  zabbix_user: '',
  zabbix_password: '',

  // Notifications
  notify_critical_email: true,
  notify_daily_summary: true,
  notify_weekly_summary: false,
  notification_emails: '',
};

const OnboardingWizard = ({ isOpen, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    const clearedErrors = {};
    Object.keys(updates).forEach(key => {
      if (errors[key]) clearedErrors[key] = undefined;
    });
    setErrors(prev => ({ ...prev, ...clearedErrors }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.name?.trim()) newErrors.name = 'Nome da empresa é obrigatório';
      if (!formData.cnpj?.trim()) newErrors.cnpj = 'CNPJ é obrigatório';
      else if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(formData.cnpj)) {
        newErrors.cnpj = 'CNPJ inválido';
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'E-mail inválido';
      }
    }

    if (step === 2) {
      if (formData.enabled_modules.length === 0) {
        newErrors.enabled_modules = 'Selecione pelo menos um módulo';
      }
    }

    if (step === 3) {
      if (formData.glpi_enabled && !formData.glpi_entity_id) {
        newErrors.glpi_entity_id = 'ID da entidade é obrigatório';
      }
      if (formData.ms365_enabled) {
        if (!formData.ms_graph_tenant_id) newErrors.ms_graph_tenant_id = 'Tenant ID é obrigatório';
        if (!formData.ms_graph_client_id) newErrors.ms_graph_client_id = 'Client ID é obrigatório';
      }
      if (formData.zabbix_enabled) {
        if (!formData.zabbix_api_url) newErrors.zabbix_api_url = 'URL da API é obrigatória';
        if (!formData.zabbix_user) newErrors.zabbix_user = 'Usuário é obrigatório';
      }
    }

    if (step === 4) {
      if (formData.notification_emails) {
        const emails = formData.notification_emails.split(',').map(e => e.trim()).filter(Boolean);
        for (const email of emails) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.notification_emails = `E-mail inválido: ${email}`;
            break;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // 1. Create company with modules
      const companyPayload = {
        name: formData.name,
        cnpj: formData.cnpj,
        sector: formData.sector,
        status: 'Ativo',
        enabled_modules: formData.enabled_modules,
        phone: formData.phone || null,
        email: formData.email || null,
      };

      const companyResponse = await api.post('/admin/companies', companyPayload);
      const company = companyResponse.data;

      // 2. Create integrations if any enabled
      const integrations = {};

      if (formData.glpi_enabled) {
        integrations.glpi_entity_id = formData.glpi_entity_id ? parseInt(formData.glpi_entity_id, 10) : null;
      }

      if (formData.ms365_enabled) {
        integrations.ms_graph_tenant_id = formData.ms_graph_tenant_id;
        integrations.ms_graph_client_id = formData.ms_graph_client_id;
        integrations.ms_graph_client_secret = formData.ms_graph_client_secret;
      }

      if (formData.zabbix_enabled) {
        integrations.zabbix_api_url = formData.zabbix_api_url;
        integrations.zabbix_user = formData.zabbix_user;
        integrations.zabbix_password = formData.zabbix_password;
      }

      if (Object.keys(integrations).length > 0) {
        await api.post(`/admin/companies/${company.id}/integrations`, integrations);
      }

      // 3. Create notification settings if any configured
      if (formData.notification_emails || formData.notify_critical_email || formData.notify_daily_summary || formData.notify_weekly_summary) {
        await api.post(`/admin/companies/${company.id}/notifications`, {
          notify_critical_email: formData.notify_critical_email,
          notify_daily_summary: formData.notify_daily_summary,
          notify_weekly_summary: formData.notify_weekly_summary,
          notification_emails: formData.notification_emails,
        });
      }

      if (onSuccess) onSuccess(company);
      handleClose();
    } catch (error) {
      console.error('Onboarding error:', error);
      setSubmitError(error.response?.data?.error || 'Erro ao criar empresa. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData(DEFAULT_FORM_DATA);
    setErrors({});
    setSubmitError('');
    onClose();
  };

  const renderStep = () => {
    const props = { formData, updateFormData, errors };

    switch (currentStep) {
      case 1:
        return <BasicInfo {...props} />;
      case 2:
        return <ModulesSelect {...props} />;
      case 3:
        return <Integrations {...props} />;
      case 4:
        return <Notifications {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Building2 size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Onboarding de Cliente</h2>
              <p className="text-sm text-slate-500">Configure uma nova empresa no portal</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      currentStep > step.id
                        ? 'bg-blue-600 text-white'
                        : currentStep === step.id
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {currentStep > step.id ? <Check size={16} /> : step.id}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-slate-500">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      currentStep > step.id ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {submitError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2">
              <X size={18} className="text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Erro</p>
                <p className="text-xs mt-1">{submitError}</p>
              </div>
            </div>
          )}
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            Voltar
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {currentStep} de {STEPS.length}
            </span>

            {currentStep < STEPS.length ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                Continuar
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Criando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Criar Empresa
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
