import React, { useState } from 'react';
import { Globe, Mail, Server, ToggleLeft, ToggleRight, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const Integrations = ({ formData, updateFormData, errors }) => {
  const [testingConnection, setTestingConnection] = useState({});
  const [testResult, setTestResult] = useState({});

  const toggleIntegration = (key) => {
    updateFormData({ [key]: !formData[key] });
  };

  const handleTestConnection = async (type) => {
    setTestingConnection(prev => ({ ...prev, [type]: true }));
    setTestResult(prev => ({ ...prev, [type]: null }));

    try {
      // Simulate test - in real implementation, this would call the API
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Basic validation check
      let hasConfig = false;
      if (type === 'glpi') {
        hasConfig = Boolean(formData.glpi_entity_id);
      } else if (type === 'ms365') {
        hasConfig = Boolean(formData.ms_graph_tenant_id && formData.ms_graph_client_id);
      } else if (type === 'zabbix') {
        hasConfig = Boolean(formData.zabbix_api_url && formData.zabbix_user);
      }

      setTestResult(prev => ({
        ...prev,
        [type]: hasConfig ? { success: true } : { success: false, error: 'Configuração incompleta' }
      }));
    } catch (error) {
      setTestResult(prev => ({
        ...prev,
        [type]: { success: false, error: error.message }
      }));
    } finally {
      setTestingConnection(prev => ({ ...prev, [type]: false }));
    }
  };

  const ToggleButton = ({ enabled, onClick, label }) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2"
    >
      {enabled ? (
        <>
          <ToggleRight size={24} className="text-blue-600" />
          <span className="text-sm font-medium text-slate-700">{label} Ativo</span>
        </>
      ) : (
        <>
          <ToggleLeft size={24} className="text-slate-300" />
          <span className="text-sm text-slate-500">{label} Desativado</span>
        </>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Configurações de Integração</h3>
        <p className="text-sm text-slate-500">Ative e configure as integrações disponíveis para esta empresa.</p>
      </div>

      {/* GLPI Integration */}
      <div className={`p-5 rounded-xl border-2 transition-all ${formData.glpi_enabled ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <TicketIcon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">GLPI (Chamados)</h4>
              <p className="text-xs text-slate-500">Sistema de tickets e chamados de suporte</p>
            </div>
          </div>
          <ToggleButton
            enabled={formData.glpi_enabled}
            onClick={() => toggleIntegration('glpi_enabled')}
            label="GLPI"
          />
        </div>

        {formData.glpi_enabled && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wider ml-1">
                ID da Entidade GLPI <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.glpi_entity_id}
                onChange={(e) => updateFormData({ glpi_entity_id: e.target.value })}
                placeholder="Ex: 14"
                className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm mt-1 ${
                  errors.glpi_entity_id ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {errors.glpi_entity_id && <p className="text-xs text-red-600 ml-1 mt-1">{errors.glpi_entity_id}</p>}
            </div>
            <button
              type="button"
              onClick={() => handleTestConnection('glpi')}
              disabled={testingConnection.glpi}
              className="text-xs font-medium text-orange-700 hover:text-orange-900 flex items-center gap-1.5 disabled:opacity-50"
            >
              {testingConnection.glpi ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Globe size={12} />
              )}
              Testar conexão
            </button>
            {testResult.glpi && (
              <div className={`flex items-center gap-2 text-xs ${testResult.glpi.success ? 'text-emerald-600' : 'text-red-600'}`}>
                {testResult.glpi.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testResult.glpi.success ? 'Conexão bem-sucedida' : testResult.glpi.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MS365 Integration */}
      <div className={`p-5 rounded-xl border-2 transition-all ${formData.ms365_enabled ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Mail size={20} className="text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">Microsoft 365</h4>
              <p className="text-xs text-slate-500">Licenças e usuários do Microsoft 365</p>
            </div>
          </div>
          <ToggleButton
            enabled={formData.ms365_enabled}
            onClick={() => toggleIntegration('ms365_enabled')}
            label="MS365"
          />
        </div>

        {formData.ms365_enabled && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wider ml-1">
                  Tenant ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ms_graph_tenant_id}
                  onChange={(e) => updateFormData({ ms_graph_tenant_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm mt-1 ${
                    errors.ms_graph_tenant_id ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.ms_graph_tenant_id && <p className="text-xs text-red-600 ml-1 mt-1">{errors.ms_graph_tenant_id}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wider ml-1">
                  Client ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ms_graph_client_id}
                  onChange={(e) => updateFormData({ ms_graph_client_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm mt-1 ${
                    errors.ms_graph_client_id ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.ms_graph_client_id && <p className="text-xs text-red-600 ml-1 mt-1">{errors.ms_graph_client_id}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wider ml-1">
                Client Secret
              </label>
              <input
                type="password"
                value={formData.ms_graph_client_secret}
                onChange={(e) => updateFormData({ ms_graph_client_secret: e.target.value })}
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm mt-1"
              />
            </div>
            <button
              type="button"
              onClick={() => handleTestConnection('ms365')}
              disabled={testingConnection.ms365}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1.5 disabled:opacity-50"
            >
              {testingConnection.ms365 ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Globe size={12} />
              )}
              Testar conexão
            </button>
            {testResult.ms365 && (
              <div className={`flex items-center gap-2 text-xs ${testResult.ms365.success ? 'text-emerald-600' : 'text-red-600'}`}>
                {testResult.ms365.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testResult.ms365.success ? 'Conexão bem-sucedida' : testResult.ms365.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zabbix Integration */}
      <div className={`p-5 rounded-xl border-2 transition-all ${formData.zabbix_enabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Server size={20} className="text-emerald-600" />
            </div>
            <div>
              <h4 className="font-medium text-slate-900">Zabbix</h4>
              <p className="text-xs text-slate-500">Monitoramento de servidores e infraestrutura</p>
            </div>
          </div>
          <ToggleButton
            enabled={formData.zabbix_enabled}
            onClick={() => toggleIntegration('zabbix_enabled')}
            label="Zabbix"
          />
        </div>

        {formData.zabbix_enabled && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wider ml-1">
                URL da API <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={formData.zabbix_api_url}
                onChange={(e) => updateFormData({ zabbix_api_url: e.target.value })}
                placeholder="https://zabbix.empresa.com.br/api_jsonrpc.php"
                className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm mt-1 ${
                  errors.zabbix_api_url ? 'border-red-300' : 'border-slate-200'
                }`}
              />
              {errors.zabbix_api_url && <p className="text-xs text-red-600 ml-1 mt-1">{errors.zabbix_api_url}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wider ml-1">
                  Usuário <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.zabbix_user}
                  onChange={(e) => updateFormData({ zabbix_user: e.target.value })}
                  placeholder="Admin"
                  className={`w-full px-4 py-2.5 bg-white border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm mt-1 ${
                    errors.zabbix_user ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {errors.zabbix_user && <p className="text-xs text-red-600 ml-1 mt-1">{errors.zabbix_user}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wider ml-1">
                  Senha
                </label>
                <input
                  type="password"
                  value={formData.zabbix_password}
                  onChange={(e) => updateFormData({ zabbix_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm mt-1"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleTestConnection('zabbix')}
              disabled={testingConnection.zabbix}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 disabled:opacity-50"
            >
              {testingConnection.zabbix ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Globe size={12} />
              )}
              Testar conexão
            </button>
            {testResult.zabbix && (
              <div className={`flex items-center gap-2 text-xs ${testResult.zabbix.success ? 'text-emerald-600' : 'text-red-600'}`}>
                {testResult.zabbix.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testResult.zabbix.success ? 'Conexão bem-sucedida' : testResult.zabbix.error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Simple SVG icon component for Ticket
const TicketIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
    <path d="M13 5v2"/>
    <path d="M13 17v2"/>
    <path d="M13 11v2"/>
  </svg>
);

export default Integrations;
