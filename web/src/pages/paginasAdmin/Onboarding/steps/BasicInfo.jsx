import React from 'react';
import { Building2, Briefcase, Phone, Mail } from 'lucide-react';

const SECTORS = [
  'Tecnologia da Informação',
  'Saúde',
  'Financeiro',
  'Educação',
  'Indústria',
  'Comércio',
  'Serviços',
  'Logística',
  'Telecomunicações',
  'Construção Civil',
  'Agronegócio',
  'Varejo',
  'Outro',
];

const formatCNPJ = (value) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const formatPhone = (value) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const BasicInfo = ({ formData, updateFormData, errors }) => {
  const handleCNPJChange = (e) => {
    const formatted = formatCNPJ(e.target.value);
    updateFormData({ cnpj: formatted });
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhone(e.target.value);
    updateFormData({ phone: formatted });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Dados da Empresa</h3>
        <p className="text-sm text-slate-500">Informe os dados básicos da empresa que será cadastrada.</p>
      </div>

      {/* Nome da Empresa */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 ml-1">
          <Building2 size={16} className="text-slate-400" />
          Nome da Empresa <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="Ex: InnerWorks Tecnologia Ltda"
          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm ${
            errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
          }`}
        />
        {errors.name && <p className="text-xs text-red-600 ml-1">{errors.name}</p>}
      </div>

      {/* CNPJ */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 ml-1">
          CNPJ <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.cnpj}
          onChange={handleCNPJChange}
          placeholder="00.000.000/0001-00"
          maxLength={18}
          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm ${
            errors.cnpj ? 'border-red-300 bg-red-50' : 'border-slate-200'
          }`}
        />
        {errors.cnpj && <p className="text-xs text-red-600 ml-1">{errors.cnpj}</p>}
      </div>

      {/* Setor e Telefone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 ml-1">
            <Briefcase size={16} className="text-slate-400" />
            Setor
          </label>
          <select
            value={formData.sector}
            onChange={(e) => updateFormData({ sector: e.target.value })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm appearance-none"
          >
            <option value="">Selecione o setor</option>
            {SECTORS.map((sector) => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 ml-1">
            <Phone size={16} className="text-slate-400" />
            Telefone
          </label>
          <input
            type="text"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="(11) 99999-9999"
            maxLength={15}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm"
          />
        </div>
      </div>

      {/* E-mail Principal */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 ml-1">
          <Mail size={16} className="text-slate-400" />
          E-mail Principal
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => updateFormData({ email: e.target.value })}
          placeholder="contato@empresa.com.br"
          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all text-sm ${
            errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
          }`}
        />
        {errors.email && <p className="text-xs text-red-600 ml-1">{errors.email}</p>}
        <p className="text-xs text-slate-500 ml-1">Este e-mail será usado para notificações e contato.</p>
      </div>
    </div>
  );
};

export default BasicInfo;
