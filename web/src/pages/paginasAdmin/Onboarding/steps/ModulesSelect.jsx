import React from 'react';
import { LayoutDashboard, Mail, Server, Network, Shield, Laptop, Ticket, FileText, Check, AlertCircle } from 'lucide-react';

const AVAILABLE_MODULES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    desc: 'Visão geral da empresa com métricas e indicadores',
    color: 'blue',
    required: true,
  },
  {
    id: 'ms365',
    label: 'Microsoft 365',
    icon: Mail,
    desc: 'Gerenciamento de licenças e usuários do Microsoft 365',
    color: 'indigo',
  },
  {
    id: 'servidores',
    label: 'Servidores',
    icon: Server,
    desc: 'Monitoramento de servidores e serviços críticos',
    color: 'purple',
  },
  {
    id: 'rede',
    label: 'Rede',
    icon: Network,
    desc: 'Wi-Fi, firewall, conectividade e ativos de rede',
    color: 'cyan',
  },
  {
    id: 'seguranca',
    label: 'Segurança',
    icon: Shield,
    desc: 'Antivírus, proteção endpoint e políticas de segurança',
    color: 'emerald',
  },
  {
    id: 'inventario',
    label: 'Inventário',
    icon: Laptop,
    desc: 'Equipamentos de TI, hardware e software instalado',
    color: 'amber',
  },
  {
    id: 'chamados',
    label: 'Chamados',
    icon: Ticket,
    desc: 'Tickets de suporte e atendimento (GLPI)',
    color: 'orange',
  },
  {
    id: 'documentacao',
    label: 'Documentação',
    icon: FileText,
    desc: 'Manuais, procedimentos e documentação técnica',
    color: 'slate',
  },
];

const COLORS = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', accent: 'bg-blue-500' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-600', accent: 'bg-indigo-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', accent: 'bg-purple-500' },
  cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'text-cyan-600', accent: 'bg-cyan-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600', accent: 'bg-emerald-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600', accent: 'bg-amber-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', accent: 'bg-orange-500' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'text-slate-600', accent: 'bg-slate-500' },
};

const ModulesSelect = ({ formData, updateFormData, errors }) => {
  const { enabled_modules } = formData;

  const toggleModule = (moduleId) => {
    if (moduleId === 'dashboard') return; // Cannot toggle required module

    const newModules = enabled_modules.includes(moduleId)
      ? enabled_modules.filter(id => id !== moduleId)
      : [...enabled_modules, moduleId];

    updateFormData({ enabled_modules: newModules });
  };

  const isSelected = (moduleId) => enabled_modules.includes(moduleId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Seleção de Módulos</h3>
        <p className="text-sm text-slate-500">Escolha quais módulos estarão disponíveis para este cliente.</p>
      </div>

      {errors.enabled_modules && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={16} />
          {errors.enabled_modules}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AVAILABLE_MODULES.map((module) => {
          const colorScheme = COLORS[module.color];
          const selected = isSelected(module.id);
          const required = module.required;

          return (
            <button
              key={module.id}
              type="button"
              onClick={() => toggleModule(module.id)}
              disabled={required}
              className={`
                relative p-4 rounded-xl border-2 text-left transition-all
                ${selected
                  ? `${colorScheme.bg} ${colorScheme.border} shadow-sm`
                  : 'bg-white border-slate-200 hover:border-slate-300'
                }
                ${required ? 'cursor-default' : 'cursor-pointer'}
              `}
            >
              {/* Check indicator */}
              <div className={`
                absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center
                ${selected ? colorScheme.accent : 'bg-slate-200'}
              `}>
                <Check size={14} className={selected ? 'text-white' : 'text-slate-400'} />
              </div>

              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg ${colorScheme.bg} flex items-center justify-center`}>
                  <module.icon size={20} className={colorScheme.icon} />
                </div>
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-slate-900">{module.label}</h4>
                    {required && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{module.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm text-slate-600">
          <span className="font-medium">{enabled_modules.length}</span> módulo(s) selecionado(s)
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Módulos obrigatórios são marcados e não podem ser desativados.
        </p>
      </div>
    </div>
  );
};

export default ModulesSelect;
