import React from 'react';
import { Bell, Mail, AlertTriangle, Calendar, Check, AlertCircle } from 'lucide-react';

const Notifications = ({ formData, updateFormData, errors }) => {
  const handleToggle = (key) => {
    updateFormData({ [key]: !formData[key] });
  };

  const Toggle = ({ checked, onChange, label, description }) => (
    <label className="flex items-start gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer bg-white">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only"
        />
        <div className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform mt-1 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {checked ? <Check size={14} className="text-blue-600" /> : null}
          <span className="text-sm font-medium text-slate-900">{label}</span>
        </div>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Configurações de Notificação</h3>
        <p className="text-sm text-slate-500">Defina como e quando a empresa receberá alertas e relatórios.</p>
      </div>

      {/* Notification Types */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Bell size={16} className="text-slate-400" />
          Tipos de Notificação
        </h4>

        <Toggle
          checked={formData.notify_critical_email}
          onChange={() => handleToggle('notify_critical_email')}
          label="Alertas Críticos por E-mail"
          description="Envia e-mail imediato quando eventos críticos são detectados (servidores offline, violações de segurança)"
        />

        <Toggle
          checked={formData.notify_daily_summary}
          onChange={() => handleToggle('notify_daily_summary')}
          label="Resumo Diário"
          description="Envia um resumo diário com o status geral da infraestrutura às 8h da manhã"
        />

        <Toggle
          checked={formData.notify_weekly_summary}
          onChange={() => handleToggle('notify_weekly_summary')}
          label="Resumo Semanal"
          description="Envia um relatório semanal com métricas e tendências toda segunda-feira"
        />
      </div>

      {/* Notification Emails */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Mail size={16} className="text-slate-400" />
          E-mails para Notificações
        </h4>

        <div className="space-y-2">
          <textarea
            value={formData.notification_emails}
            onChange={(e) => updateFormData({ notification_emails: e.target.value })}
            placeholder="separados@por.virgula.com&#10;outro@email.com.br&#10;terceiro@empresa.com"
            rows={4}
            className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm resize-none ${
              errors.notification_emails ? 'border-red-300 bg-red-50' : 'border-slate-200'
            }`}
          />
          {errors.notification_emails && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle size={12} />
              {errors.notification_emails}
            </div>
          )}
          <p className="text-xs text-slate-500">
            Informe um ou mais e-mails separados por vírgula. Estes e-mails receberão os alertas configurados acima.
          </p>
        </div>
      </div>

      {/* Summary Preview */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          Resumo da Configuração
        </h4>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${formData.notify_critical_email ? 'bg-red-500' : 'bg-slate-300'}`} />
            <span className={formData.notify_critical_email ? 'text-slate-700' : 'text-slate-400'}>
              Alertas críticos {formData.notify_critical_email ? 'ativados' : 'desativados'}
            </span>
          </li>
          <li className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${formData.notify_daily_summary ? 'bg-blue-500' : 'bg-slate-300'}`} />
            <span className={formData.notify_daily_summary ? 'text-slate-700' : 'text-slate-400'}>
              Resumo diário {formData.notify_daily_summary ? 'ativado' : 'desativado'}
            </span>
          </li>
          <li className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${formData.notify_weekly_summary ? 'bg-purple-500' : 'bg-slate-300'}`} />
            <span className={formData.notify_weekly_summary ? 'text-slate-700' : 'text-slate-400'}>
              Resumo semanal {formData.notify_weekly_summary ? 'ativado' : 'desativado'}
            </span>
          </li>
          <li className="flex items-center gap-2 text-sm pt-2 border-t border-slate-200 mt-2">
            <Mail size={12} className={formData.notification_emails ? 'text-blue-500' : 'text-slate-400'} />
            <span className={formData.notification_emails ? 'text-slate-700' : 'text-slate-400'}>
              {formData.notification_emails
                ? `${formData.notification_emails.split(',').filter(e => e.trim()).length} e-mail(s) configurado(s)`
                : 'Nenhum e-mail configurado'}
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Notifications;
