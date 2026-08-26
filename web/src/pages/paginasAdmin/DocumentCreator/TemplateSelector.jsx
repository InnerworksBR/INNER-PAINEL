import React from 'react';
import { FileText, Smartphone, BarChart, Mail } from 'lucide-react';

const ICONS = {
  FileText,
  Smartphone,
  BarChart,
  Mail,
};

const TEMPLATES = [
  {
    id: 'proposta_comercial',
    label: 'Proposta Comercial',
    icon: 'FileText',
    description: 'Proposta de serviços gerais',
    fields: ['cliente', 'assunto', 'valor', 'descricao', 'prazo_entrega'],
  },
  {
    id: 'proposta_sistema',
    label: 'Proposta de Sistema',
    icon: 'Smartphone',
    description: 'Proposta para desenvolvimento de sistemas',
    fields: ['cliente', 'nome_sistema', 'funcionalidades', 'tecnologias', 'valor', 'cronograma'],
  },
  {
    id: 'relatorio_mensal',
    label: 'Relatório Mensal',
    icon: 'BarChart',
    description: 'Relatório de prestação de serviços',
    fields: ['cliente', 'mes_ano', 'resumo_executivo', 'metricas', 'ocorrencias', 'proximos_passos'],
  },
  {
    id: 'comunicacao',
    label: 'Comunicação ao Cliente',
    icon: 'Mail',
    description: 'Comunicação formal',
    fields: ['cliente', 'assunto', 'mensagem'],
  },
];

const TemplateSelector = ({ selectedTemplate, onSelect }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-slate-800">Selecione um Modelo</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TEMPLATES.map((template) => {
          const IconComponent = ICONS[template.icon];
          const isSelected = selectedTemplate?.id === template.id;

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className={`
                group relative p-4 rounded-xl border-2 text-left transition-all duration-200
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                }
              `}
            >
              {/* Indicador de seleção */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div
                  className={`
                    p-2.5 rounded-lg transition-colors
                    ${isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                    }
                  `}
                >
                  <IconComponent size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                    {template.label}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{template.description}</p>
                </div>
              </div>

              {/* Tags de campos */}
              <div className="mt-3 flex flex-wrap gap-1">
                {template.fields.slice(0, 3).map((field) => (
                  <span
                    key={field}
                    className={`
                      text-[10px] px-1.5 py-0.5 rounded
                      ${isSelected
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50'
                      }
                    `}
                  >
                    {field}
                  </span>
                ))}
                {template.fields.length > 3 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                    +{template.fields.length - 3}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { TEMPLATES };
export default TemplateSelector;
