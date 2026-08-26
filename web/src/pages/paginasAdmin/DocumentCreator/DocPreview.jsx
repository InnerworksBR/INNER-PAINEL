import React, { forwardRef } from 'react';
import { Download, Mail, Sparkles, FileText, Building2, Calendar, DollarSign } from 'lucide-react';

const formatCurrency = (value) => {
  if (!value) return '';
  const cleanValue = value.replace(/[^\d,]/g, '').replace(',', '.');
  const numValue = parseFloat(cleanValue);
  if (isNaN(numValue)) return value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
};

const formatDate = () => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
};

const generateDocumentHTML = (template, formData) => {
  const data = {
    ...formData,
    dataFormatada: formatDate(),
  };

  const logoHTML = `
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
      <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-weight: bold; font-size: 20px;">S</span>
      </div>
      <div>
        <div style="font-weight: 700; font-size: 18px; color: #1e3a5f;">INNER SOLUTIONS</div>
        <div style="font-size: 11px; color: #64748b;">Tecnologia e Inovação</div>
      </div>
    </div>
  `;

  const headerHTML = `
    <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        ${logoHTML}
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <div style="font-weight: 500; color: #475569;">Data</div>
          <div>${data.dataFormatada}</div>
        </div>
      </div>
    </div>
  `;

  const footerHTML = `
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            Contato
          </div>
          <div style="font-size: 12px; color: #475569; line-height: 1.6;">
            <div>contato@innersolutions.com.br</div>
            <div>+55 (11) 99999-9999</div>
          </div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            Endereço
          </div>
          <div style="font-size: 12px; color: #475569; line-height: 1.6;">
            <div>Av. Paulista, 1000 - Sala 1205</div>
            <div>São Paulo - SP, 01310-100</div>
          </div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            CNPJ
          </div>
          <div style="font-size: 12px; color: #475569;">12.345.678/0001-90</div>
        </div>
      </div>
    </div>
  `;

  const sectionStyle = 'margin-bottom: 20px;';
  const titleStyle = 'font-size: 14px; font-weight: 600; color: #1e3a5f; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0;';
  const textStyle = 'font-size: 13px; color: #334155; line-height: 1.7;';
  const labelStyle = 'font-size: 11px; font-weight: 500; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px;';
  const valueStyle = 'font-size: 13px; color: #1e293b; margin-bottom: 12px;';

  switch (template.id) {
    case 'proposta_comercial':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; background: #fff; color: #334155; }
            .container { max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; color: #1e3a5f; margin: 0 0 8px 0; }
            .subtitle { font-size: 14px; color: #64748b; margin-bottom: 24px; }
          </style>
        </head>
        <body>
          <div class="container">
            ${headerHTML}
            <h1>Proposta Comercial</h1>
            <p class="subtitle">${data.assunto || 'Proposta de Serviços'}</p>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Dados do Cliente</div>
              <div style="${labelStyle}">Cliente</div>
              <div style="${valueStyle}">${data.cliente || '-'}</div>
            </div>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Descrição dos Serviços</div>
              <div style="${textStyle}">${(data.descricao || '-').replace(/\n/g, '<br>')}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; ${sectionStyle}">
              <div>
                <div style="${titleStyle}">Valor</div>
                <div style="font-size: 24px; font-weight: 700; color: #059669;">${formatCurrency(data.valor)}</div>
              </div>
              <div>
                <div style="${titleStyle}">Prazo de Entrega</div>
                <div style="${valueStyle}">${data.prazo_entrega || 'A combinar'}</div>
              </div>
            </div>
            ${footerHTML}
          </div>
        </body>
        </html>
      `;

    case 'proposta_sistema':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; background: #fff; color: #334155; }
            .container { max-width: 800px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            ${headerHTML}
            <h1 style="font-size: 24px; color: #1e3a5f; margin: 0 0 8px 0;">Proposta de Sistema</h1>
            <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">${data.nome_sistema || 'Sistema Personalizado'}</p>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Dados do Projeto</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <div style="${labelStyle}">Cliente</div>
                  <div style="${valueStyle}">${data.cliente || '-'}</div>
                </div>
                <div>
                  <div style="${labelStyle}">Sistema</div>
                  <div style="${valueStyle}">${data.nome_sistema || '-'}</div>
                </div>
              </div>
            </div>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Funcionalidades</div>
              <div style="${textStyle}">${(data.funcionalidades || '-').replace(/\n/g, '<br>')}</div>
            </div>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Tecnologias</div>
              <div style="${valueStyle}">${data.tecnologias || 'A definir'}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <div style="${titleStyle}">Investimento</div>
                <div style="font-size: 24px; font-weight: 700; color: #059669;">${formatCurrency(data.valor)}</div>
              </div>
              <div>
                <div style="${titleStyle}">Cronograma</div>
                <div style="${textStyle}">${(data.cronograma || 'A definir').replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            ${footerHTML}
          </div>
        </body>
        </html>
      `;

    case 'relatorio_mensal':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; background: #fff; color: #334155; }
            .container { max-width: 800px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            ${headerHTML}
            <h1 style="font-size: 24px; color: #1e3a5f; margin: 0 0 8px 0;">Relatório Mensal</h1>
            <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">Referente a ${data.mes_ano || 'período informado'} - ${data.cliente || 'Cliente'}</p>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Resumo Executivo</div>
              <div style="${textStyle}">${(data.resumo_executivo || '-').replace(/\n/g, '<br>')}</div>
            </div>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Métricas e Indicadores</div>
              <div style="${textStyle}">${(data.metricas || '-').replace(/\n/g, '<br>')}</div>
            </div>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Ocorrências Relevantes</div>
              <div style="${textStyle}">${(data.ocorrencias || 'Nenhuma ocorrência relevante no período.').replace(/\n/g, '<br>')}</div>
            </div>
            <div style="${sectionStyle}">
              <div style="${titleStyle}">Próximos Passos</div>
              <div style="${textStyle}">${(data.proximos_passos || '-').replace(/\n/g, '<br>')}</div>
            </div>
            ${footerHTML}
          </div>
        </body>
        </html>
      `;

    case 'comunicacao':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; background: #fff; color: #334155; }
            .container { max-width: 800px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            ${headerHTML}
            <h1 style="font-size: 24px; color: #1e3a5f; margin: 0 0 8px 0;">Comunicação ao Cliente</h1>
            <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">${data.assunto || 'Assunto'}</p>
            <div style="${sectionStyle}">
              <div style="${labelStyle}">Destinatário</div>
              <div style="${valueStyle}">${data.cliente || '-'}</div>
            </div>
            <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 8px 8px 0;">
              <div style="${textStyle}">${(data.mensagem || '-').replace(/\n/g, '<br>')}</div>
            </div>
            ${footerHTML}
          </div>
        </body>
        </html>
      `;

    default:
      return `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: 'Segoe UI', sans-serif; padding: 40px;">
          <div style="max-width: 800px; margin: 0 auto;">
            ${headerHTML}
            <h1 style="font-size: 24px; color: #1e3a5f;">Documento</h1>
            <p style="color: #64748b;">Preview do documento</p>
            ${footerHTML}
          </div>
        </body>
        </html>
      `;
  }
};

const DocPreview = forwardRef(({ template, formData, generatedContent, onGenerate, onDownload, onEmail, isGenerating }, ref) => {
  const hasContent = generatedContent || (template && Object.values(formData).some((v) => v?.trim()));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-slate-800 flex items-center gap-2">
          <FileText size={18} className="text-slate-500" />
          Preview do Documento
        </h3>
        {template && (
          <div className="flex items-center gap-2">
            <button
              onClick={onGenerate}
              disabled={isGenerating || !template}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                transition-all duration-200
                ${isGenerating
                  ? 'bg-purple-100 text-purple-400 cursor-wait'
                  : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow'
                }
              `}
            >
              <Sparkles size={14} />
              {isGenerating ? 'Gerando...' : 'Gerar com IA'}
            </button>
          </div>
        )}
      </div>

      {/* Preview Area */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!template ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="p-4 bg-slate-100 rounded-xl text-slate-400 mb-4">
              <FileText size={40} strokeWidth={1.5} />
            </div>
            <h4 className="text-slate-600 font-medium mb-2">Selecione um template</h4>
            <p className="text-sm text-slate-400 max-w-xs">
              Escolha um modelo acima para visualizar o preview do documento
            </p>
          </div>
        ) : !hasContent ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="p-4 bg-slate-100 rounded-xl text-slate-400 mb-4">
              <Sparkles size={40} strokeWidth={1.5} />
            </div>
            <h4 className="text-slate-600 font-medium mb-2">Preencha os campos</h4>
            <p className="text-sm text-slate-400 max-w-xs">
              Preencha o formulário e clique em "Gerar com IA" para criar o documento
            </p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Action Buttons */}
            <div className="flex items-center gap-2 p-3 border-b border-slate-100 bg-slate-50/50">
              <button
                onClick={onDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <Download size={14} />
                Baixar PDF
              </button>
              <button
                onClick={onEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <Mail size={14} />
                Enviar E-mail
              </button>
            </div>
            {/* Document Preview */}
            <iframe
              ref={ref}
              srcDoc={generatedContent || generateDocumentHTML(template, formData)}
              className="flex-1 w-full border-0"
              title="Preview do Documento"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
});

DocPreview.displayName = 'DocPreview';

export { generateDocumentHTML };
export default DocPreview;
