import React from 'react';
import { User, FileText, DollarSign, Calendar, Code, BarChart2, Mail, List, Clock, TrendingUp, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

const FIELD_CONFIG = {
  cliente: {
    label: 'Nome do Cliente',
    icon: User,
    type: 'text',
    placeholder: 'Ex: Empresa XYZ Ltda',
    required: true,
  },
  assunto: {
    label: 'Assunto',
    icon: FileText,
    type: 'text',
    placeholder: 'Ex: Proposta de Serviços de TI',
    required: true,
  },
  valor: {
    label: 'Valor (R$)',
    icon: DollarSign,
    type: 'text',
    placeholder: 'Ex: 15.000,00',
    required: true,
  },
  descricao: {
    label: 'Descrição dos Serviços',
    icon: FileText,
    type: 'textarea',
    placeholder: 'Descreva detalhadamente os serviços propostos...',
    required: true,
  },
  prazo_entrega: {
    label: 'Prazo de Entrega',
    icon: Calendar,
    type: 'text',
    placeholder: 'Ex: 30 dias úteis após aprovação',
    required: false,
  },
  nome_sistema: {
    label: 'Nome do Sistema',
    icon: Code,
    type: 'text',
    placeholder: 'Ex: Portal de Gestão Empresarial',
    required: true,
  },
  funcionalidades: {
    label: 'Funcionalidades',
    icon: List,
    type: 'textarea',
    placeholder: 'Liste as funcionalidades principais:\n- Módulo de usuários\n- Dashboard analítico\n- Relatórios customizados',
    required: true,
  },
  tecnologias: {
    label: 'Tecnologias',
    icon: Code,
    type: 'text',
    placeholder: 'Ex: React, Node.js, PostgreSQL',
    required: false,
  },
  cronograma: {
    label: 'Cronograma',
    icon: Clock,
    type: 'textarea',
    placeholder: 'Ex:\nFase 1 - Levantamento: 2 semanas\nFase 2 - Desenvolvimento: 8 semanas\nFase 3 - Testes: 2 semanas',
    required: false,
  },
  mes_ano: {
    label: 'Mês/Ano de Referência',
    icon: Calendar,
    type: 'text',
    placeholder: 'Ex: Agosto/2024',
    required: true,
  },
  resumo_executivo: {
    label: 'Resumo Executivo',
    icon: FileText,
    type: 'textarea',
    placeholder: 'Breve resumo das atividades realizadas no período...',
    required: true,
  },
  metricas: {
    label: 'Métricas e Indicadores',
    icon: TrendingUp,
    type: 'textarea',
    placeholder: 'Liste as principais métricas:\n- Disponibilidade: 99.5%\n- Tickets resolvidos: 150\n- SLA cumprimento: 95%',
    required: false,
  },
  ocorrencias: {
    label: 'Ocorrências Relevantes',
    icon: AlertCircle,
    type: 'textarea',
    placeholder: 'Descreva as principais ocorrências do período...',
    required: false,
  },
  proximos_passos: {
    label: 'Próximos Passos',
    icon: CheckCircle,
    type: 'textarea',
    placeholder: 'Liste as ações planejadas:\n1. Implementar backup automatizado\n2. Migrar servidores\n3. Treinamento da equipe',
    required: false,
  },
  mensagem: {
    label: 'Mensagem',
    icon: Mail,
    type: 'textarea',
    placeholder: 'Digite sua mensagem...',
    required: true,
  },
};

const DocForm = ({ template, formData, onChange, errors }) => {
  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 bg-slate-100 rounded-xl text-slate-400 mb-4">
          <FileText size={32} />
        </div>
        <p className="text-slate-500 text-sm">
          Selecione um modelo para começar a preencher
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <FileText size={16} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-800">{template.label}</h3>
          <p className="text-xs text-slate-500">{template.fields.length} campos</p>
        </div>
      </div>

      <div className="space-y-4">
        {template.fields.map((fieldKey) => {
          const config = FIELD_CONFIG[fieldKey];
          if (!config) return null;

          const IconComponent = config.icon;
          const value = formData[fieldKey] || '';
          const error = errors?.[fieldKey];

          return (
            <div key={fieldKey} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <IconComponent size={14} className="text-slate-400" />
                {config.label}
                {config.required && <span className="text-red-400">*</span>}
              </label>

              {config.type === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(e) => onChange(fieldKey, e.target.value)}
                  placeholder={config.placeholder}
                  rows={4}
                  className={`
                    w-full px-3 py-2.5 rounded-xl border text-sm
                    bg-white text-slate-800 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                    transition-all resize-none
                    ${error
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                    }
                  `}
                />
              ) : (
                <div className="relative">
                  {fieldKey === 'valor' && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      R$
                    </span>
                  )}
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(fieldKey, e.target.value)}
                    placeholder={config.placeholder}
                    className={`
                      w-full px-3 py-2.5 rounded-xl border text-sm
                      bg-white text-slate-800 placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                      transition-all
                      ${fieldKey === 'valor' ? 'pl-10' : ''}
                      ${error
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                      }
                    `}
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocForm;
