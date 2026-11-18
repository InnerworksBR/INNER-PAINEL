export type ArticleImage = { mediaId: string; alt: string };

export type ArticleBlock =
  | { type: 'paragraph' | 'heading' | 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | ({ type: 'image' } & ArticleImage);

export interface ArticleContent {
  title: string;
  summary: string;
  cover: ArticleImage | null;
  blocks: ArticleBlock[];
}

export class ArticleRequestError extends Error {
  constructor(message: string, readonly statusCode = 422) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const INVALID_TEXT = /[\u0000\uD800-\uDFFF]/u;

export function readUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ArticleRequestError('Informe um identificador válido.');
  }
  return value.toLowerCase();
}

export function readPage(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,4}$/.test(value) || Number(value) > 10000) {
    throw new ArticleRequestError('Informe uma página entre 1 e 10000.');
  }
  return Number(value);
}

export function readCreateArticle(value: unknown): string {
  return readUuid(asObject(value).id);
}

export function readSaveArticle(value: unknown): ArticleContent & { version: number } {
  const { version, title, summary, cover, blocks } = asObject(value);
  if (!Array.isArray(blocks) || blocks.length > 100) {
    throw new ArticleRequestError('Use uma lista de até 100 blocos no artigo.');
  }
  return {
    version: readVersion(version),
    title: readText(title, 160, 'no título'),
    summary: readText(summary, 320, 'no resumo'),
    cover: cover === null ? null : readImage(asObject(cover)),
    blocks: blocks.map(readBlock),
  };
}

export function readArticleTransition(value: unknown, restore: boolean) {
  const { version, requestId, revisionId } = asObject(value);
  return {
    version: readVersion(version),
    requestId: readUuid(requestId),
    revisionId: restore ? readUuid(revisionId) : null,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ArticleRequestError('Informe os dados do artigo em um objeto JSON.');
  }
  return value as Record<string, unknown>;
}

function readVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new ArticleRequestError('Informe uma versão válida do artigo.');
  }
  return value;
}

function readText(value: unknown, limit: number, field: string): string {
  if (typeof value !== 'string' || INVALID_TEXT.test(value) || (value.length > limit && [...value].length > limit)) {
    throw new ArticleRequestError('Use texto de até ' + limit + ' caracteres ' + field + '.');
  }
  return value;
}

function readImage({ mediaId, alt }: Record<string, unknown>): ArticleImage {
  return { mediaId: readUuid(mediaId), alt: readText(alt, 240, 'na descrição da imagem') };
}

function readBlock(value: unknown): ArticleBlock {
  const block = asObject(value);
  switch (block.type) {
    case 'paragraph':
    case 'heading':
    case 'quote':
      return { type: block.type, text: readText(block.text, 4000, 'no bloco') };
    case 'image':
      return { type: 'image', ...readImage(block) };
    case 'list':
      if (typeof block.ordered !== 'boolean' || !Array.isArray(block.items) || block.items.length > 30) {
        throw new ArticleRequestError('Informe o tipo da lista e use até 30 itens.');
      }
      return {
        type: 'list',
        ordered: block.ordered,
        items: block.items.map(item => readText(item, 500, 'no item da lista')),
      };
    default:
      throw new ArticleRequestError('Tipo de bloco inválido.');
  }
}
