// src/services/document-generator-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `Você é um assistente especializado em formatar documentos comerciais profissionais. Sua tarefa é transformar dados brutos em documentos HTML bem formatados e profissionais.

REGRAS IMPORTANTES:
1. Retorne SOMENTE o HTML completo do documento, sem explicações adicionais
2. Use este template HTML base (não inclua as tags html, head, body - apenas o conteúdo interno):
   <style>
     body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; background: #fff; color: #334155; }
     .container { max-width: 800px; margin: 0 auto; }
   </style>
   [seu conteúdo aqui]

3. O documento deve incluir:
   - Cabeçalho com logo da INNER SOLUTIONS (use 'S' dentro de um quadrado azul escuro #1e3a5f)
   - Data formatada em português
   - Título do documento
   - Seções bem organizadas
   - Formatação de valores em reais (R$)
   - Rodapé com contatos da empresa

4. Estilos a usar:
   - Cor primária: #1e3a5f (azul escuro)
   - Cor secundária: #3b82f6 (azul)
   - Cor de destaque: #059669 (verde para valores)
   - Texto: #334155, #475569, #64748b
   - Bordas: #e2e8f0

5. Para valores monetários, formate como: R$ X.XXX,XX

6. Mantenha formatação consistente e profissional`;

interface GenerateOptions {
  template: string;
  formData: Record<string, string>;
  templateLabel: string;
}

interface EmailOptions {
  companyId: string;
  companyName: string;
  template: string;
  formData: Record<string, string>;
  html: string;
  userEmail?: string;
}

const TEMPLATE_PROMPTS: Record<string, string> = {
  proposta_comercial: `Crie uma PROPOSTA COMERCIAL profissional com os seguintes dados:

- Cliente: {cliente}
- Assunto: {assunto}
- Valor: R$ {valor}
- Descrição: {descricao}
- Prazo de Entrega: {prazo_entrega}

A proposta deve ter seções para:
1. Cabeçalho com logo INNER SOLUTIONS e data
2. Dados do cliente
3. Descrição detalhada dos serviços
4. Valor total destacado em verde
5. Condições de prazo
6. Rodapé com contatos`,

  proposta_sistema: `Crie uma PROPOSTA DE SISTEMA profissional com os seguintes dados:

- Cliente: {cliente}
- Nome do Sistema: {nome_sistema}
- Funcionalidades: {funcionalidades}
- Tecnologias: {tecnologias}
- Valor: R$ {valor}
- Cronograma: {cronograma}

A proposta deve ter seções para:
1. Cabeçalho com logo INNER SOLUTIONS e data
2. Identificação do projeto
3. Lista de funcionalidades (formate como lista)
4. Tecnologias a serem utilizadas
5. Investimento destacado
6. Cronograma detalhado
7. Rodapé com contatos`,

  relatorio_mensal: `Crie um RELATÓRIO MENSAL profissional com os seguintes dados:

- Cliente: {cliente}
- Mês/Ano: {mes_ano}
- Resumo Executivo: {resumo_executivo}
- Métricas: {metricas}
- Ocorrências: {ocorrencias}
- Próximos Passos: {proximos_passos}

O relatório deve ter seções para:
1. Cabeçalho com logo INNER SOLUTIONS e data
2. Resumo Executivo
3. Métricas e Indicadores (destaque em cards)
4. Ocorrências Relevantes
5. Próximos Passos (como lista numerada)
6. Rodapé com contatos`,

  comunicacao: `Crie uma COMUNICAÇÃO AO CLIENTE profissional com os seguintes dados:

- Cliente: {cliente}
- Assunto: {assunto}
- Mensagem: {mensagem}

A comunicação deve ter:
1. Cabeçalho com logo INNER SOLUTIONS e data
2. Destinatário
3. Assunto destacado
4. Corpo da mensagem em um bloco destacado com borda azul
5. Rodapé com contatos`,
};

/**
 * Gera conteúdo de documento usando a API do Claude
 */
export async function generateDocumentContent(
  template: string,
  formData: Record<string, string>,
  templateLabel: string
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    // Fallback: retorna HTML gerado localmente
    return generateLocalContent(template, formData, templateLabel);
  }

  const promptTemplate = TEMPLATE_PROMPTS[template] || TEMPLATE_PROMPTS.proposta_comercial;

  // Substituir placeholders nos dados
  let prompt = promptTemplate;
  Object.entries(formData).forEach(([key, value]) => {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value || 'Não informado');
  });

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Erro da API Anthropic:', response.status, errorData);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('Resposta vazia da API');
    }

    return content;
  } catch (err: any) {
    console.error('Erro ao chamar API do Claude:', err.message);
    // Fallback para geração local
    return generateLocalContent(template, formData, templateLabel);
  }
}

/**
 * Gera conteúdo HTML localmente (fallback quando API não disponível)
 */
function generateLocalContent(
  template: string,
  formData: Record<string, string>,
  templateLabel: string
): string {
  const formatDate = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  };

  const formatCurrency = (value: string) => {
    if (!value) return 'R$ 0,00';
    const cleanValue = value.replace(/[^\d,]/g, '').replace(',', '.');
    const numValue = parseFloat(cleanValue);
    if (isNaN(numValue)) return value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(numValue);
  };

  const formatValue = (val: string) => val || '-';

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
          <div>${formatDate()}</div>
        </div>
      </div>
    </div>
  `;

  const footerHTML = `
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Contato</div>
          <div style="font-size: 12px; color: #475569; line-height: 1.6;">
            <div>contato@innersolutions.com.br</div>
            <div>+55 (11) 99999-9999</div>
          </div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Endereço</div>
          <div style="font-size: 12px; color: #475569; line-height: 1.6;">
            <div>Av. Paulista, 1000 - Sala 1205</div>
            <div>São Paulo - SP, 01310-100</div>
          </div>
        </div>
        <div>
          <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">CNPJ</div>
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

  switch (template) {
    case 'proposta_comercial':
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
    <h1 style="font-size: 24px; color: #1e3a5f; margin: 0 0 8px 0;">Proposta Comercial</h1>
    <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">${formatValue(formData.assunto)}</p>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Dados do Cliente</div>
      <div style="${labelStyle}">Cliente</div>
      <div style="${valueStyle}">${formatValue(formData.cliente)}</div>
    </div>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Descrição dos Serviços</div>
      <div style="${textStyle}">${formatValue(formData.descricao).replace(/\n/g, '<br>')}</div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; ${sectionStyle}">
      <div>
        <div style="${titleStyle}">Valor</div>
        <div style="font-size: 24px; font-weight: 700; color: #059669;">${formatCurrency(formData.valor)}</div>
      </div>
      <div>
        <div style="${titleStyle}">Prazo de Entrega</div>
        <div style="${valueStyle}">${formatValue(formData.prazo_entrega) || 'A combinar'}</div>
      </div>
    </div>

    ${footerHTML}
  </div>
</body>
</html>`;

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
    <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">${formatValue(formData.nome_sistema)}</p>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Dados do Projeto</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div>
          <div style="${labelStyle}">Cliente</div>
          <div style="${valueStyle}">${formatValue(formData.cliente)}</div>
        </div>
        <div>
          <div style="${labelStyle}">Sistema</div>
          <div style="${valueStyle}">${formatValue(formData.nome_sistema)}</div>
        </div>
      </div>
    </div>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Funcionalidades</div>
      <div style="${textStyle}">${formatValue(formData.funcionalidades).replace(/\n/g, '<br>')}</div>
    </div>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Tecnologias</div>
      <div style="${valueStyle}">${formatValue(formData.tecnologias) || 'A definir'}</div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <div style="${titleStyle}">Investimento</div>
        <div style="font-size: 24px; font-weight: 700; color: #059669;">${formatCurrency(formData.valor)}</div>
      </div>
      <div>
        <div style="${titleStyle}">Cronograma</div>
        <div style="${textStyle}">${formatValue(formData.cronograma || 'A definir').replace(/\n/g, '<br>')}</div>
      </div>
    </div>

    ${footerHTML}
  </div>
</body>
</html>`;

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
    <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">Referente a ${formatValue(formData.mes_ano)} - ${formatValue(formData.cliente)}</p>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Resumo Executivo</div>
      <div style="${textStyle}">${formatValue(formData.resumo_executivo).replace(/\n/g, '<br>')}</div>
    </div>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Métricas e Indicadores</div>
      <div style="${textStyle}">${formatValue(formData.metricas).replace(/\n/g, '<br>')}</div>
    </div>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Ocorrências Relevantes</div>
      <div style="${textStyle}">${formatValue(formData.ocorrencias) || 'Nenhuma ocorrência relevante no período.'}</div>
    </div>

    <div style="${sectionStyle}">
      <div style="${titleStyle}">Próximos Passos</div>
      <div style="${textStyle}">${formatValue(formData.proximos_passos).replace(/\n/g, '<br>')}</div>
    </div>

    ${footerHTML}
  </div>
</body>
</html>`;

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
    <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">${formatValue(formData.assunto)}</p>

    <div style="${sectionStyle}">
      <div style="${labelStyle}">Destinatário</div>
      <div style="${valueStyle}">${formatValue(formData.cliente)}</div>
    </div>

    <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 8px 8px 0;">
      <div style="${textStyle}">${formatValue(formData.mensagem).replace(/\n/g, '<br>')}</div>
    </div>

    ${footerHTML}
  </div>
</body>
</html>`;

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
</html>`;
  }
}

/**
 * Envia e-mail com documento usando Supabase Edge Function ou serviço SMTP
 */
export async function sendDocumentEmail(
  supabase: SupabaseClient,
  options: EmailOptions
): Promise<void> {
  const { companyId, companyName, template, formData, html, userEmail } = options;

  // Busca configurações de e-mail da empresa ou usa padrão
  const { data: settings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'smtp_config')
    .single();

  // Aqui você implementaria o envio real de e-mail
  // Por exemplo, usando Supabase Edge Functions ou serviço SMTP

  // Por enquanto, apenas logar
  console.log('E-mail a ser enviado:', {
    to: `${companyName} <${userEmail || 'contato@cliente.com'}>`,
    subject: getEmailSubject(template, formData),
    template,
  });

  // Em produção, você chamaria uma Edge Function ou serviço SMTP aqui
  // await supabase.functions.invoke('send-email', { body: { ... } });
}

function getEmailSubject(template: string, formData: Record<string, string>): string {
  switch (template) {
    case 'proposta_comercial':
      return `Proposta Comercial - ${formData.assunto || 'INNER SOLUTIONS'}`;
    case 'proposta_sistema':
      return `Proposta de Sistema - ${formData.nome_sistema || 'INNER SOLUTIONS'}`;
    case 'relatorio_mensal':
      return `Relatório Mensal - ${formData.mes_ano || ''} - ${formData.cliente || ''}`;
    case 'comunicacao':
      return `Comunicação - ${formData.assunto || ''}`;
    default:
      return `Documento INNER SOLUTIONS`;
  }
}
