export const ARTICLES_PATH = '/admin/artigos';

export const ARTICLE_LIMITS = {
  title: 160,
  summary: 320,
  alt: 240,
  blockCount: 100,
  blockText: 4000,
  listCount: 30,
  listItem: 500,
  draftBytes: 256 * 1024,
  imageBytes: 8 * 1024 * 1024,
};

export const ARTICLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const editorialDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const publicationDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' });

export function formatArticleDate(date) {
  return editorialDate.format(new Date(date));
}

export function formatPublicArticleDate(date) {
  return publicationDate.format(new Date(date));
}

export function articleError(error, fallback) {
  switch (error.response?.status) {
    case 403:
      return 'Sua conta não tem permissão para esta operação.';
    case 404:
      return 'O artigo ou a imagem não está disponível.';
    case 413:
    case 422:
      return error.response.data?.error || fallback;
    default:
      return fallback;
  }
}

export function editableArticle({ title, summary, cover, blocks }) {
  return { title, summary, cover, blocks };
}

export function draftPayload({ title, summary, cover, blocks }) {
  return {
    title,
    summary,
    cover: cover && { mediaId: cover.mediaId, alt: cover.alt },
    blocks: blocks.map(({ type, text, ordered, items, mediaId, alt }) => {
      if (type === 'list') return { type, ordered, items: items.filter(item => item.trim()) };
      if (type === 'image') return { type, mediaId, alt };
      return { type, text };
    }),
  };
}

function exceedsTextLimit(text, limit) {
  return text.length > limit && [...text].length > limit;
}

export function draftBodyIssue(blocks) {
  if (blocks.length > ARTICLE_LIMITS.blockCount) return 'O artigo pode ter até 100 parágrafos, subtítulos, citações, listas ou imagens no total.';
  for (const block of blocks) {
    if (block.type === 'list') {
      if (block.items.length > ARTICLE_LIMITS.listCount) return 'Cada lista pode ter até 30 itens.';
      if (block.items.some(item => exceedsTextLimit(item, ARTICLE_LIMITS.listItem))) return 'Cada item da lista pode ter até 500 caracteres.';
    } else if (block.type !== 'image' && exceedsTextLimit(block.text, ARTICLE_LIMITS.blockText)) {
      return 'Separe os trechos com mais de 4.000 caracteres em parágrafos menores.';
    }
  }
  return '';
}

export function publicationIssues({ title, summary, cover, blocks }) {
  const issues = [];
  if (!title.trim()) issues.push('Informe um título.');
  if (!summary.trim()) issues.push('Informe um resumo.');
  if (!cover?.mediaId) issues.push('Envie uma imagem de capa.');
  if (cover && !cover.alt.trim()) issues.push('Descreva a imagem de capa.');
  if (!blocks.some(block => (
    (['paragraph', 'quote'].includes(block.type) && block.text.trim())
    || (block.type === 'list' && block.items.length > 0)
  ))) issues.push('Adicione um parágrafo, uma citação ou uma lista com texto.');
  if (blocks.some(block => block.type === 'image' && !block.alt.trim())) {
    issues.push('Descreva todas as imagens do conteúdo.');
  }
  return issues;
}
