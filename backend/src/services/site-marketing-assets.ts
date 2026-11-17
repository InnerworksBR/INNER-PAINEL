import { Readable } from 'node:stream';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { EBOOK_PDF_BYTES, MARKETING_BUCKET, MarketingError } from './site-marketing';

export async function readEbookPdf(request: FastifyRequest) {
  let result: { bytes: Buffer; filename: string } | undefined;
  try {
    for await (const part of request.parts({ limits: { fileSize: EBOOK_PDF_BYTES, files: 1, fields: 0, parts: 1 } })) {
      if (part.type !== 'file' || part.fieldname !== 'file' || part.mimetype !== 'application/pdf') {
        throw new MarketingError('Envie um PDF no campo file.');
      }
      const bytes = await part.toBuffer();
      if (bytes.length < 12 || !/^%PDF-\d\.\d(?:\r\n|[\r\n])/.test(bytes.toString('ascii', 0, 12)) ||
        !/%%EOF[\x00\t\n\f\r ]*$/.test(bytes.subarray(-1024).toString('latin1'))) {
        throw new MarketingError('Envie um arquivo PDF válido.');
      }
      const basename = part.filename.split(/[\\/]/).pop() ?? '';
      const safe = basename.replace(/\.pdf$/i, '').replace(/[\u0000-\u001f\u007f\uD800-\uDFFF]/gu, '').trim();
      const filename = ([...safe].slice(0, 110).join('') || 'ebook') + '.pdf';
      result = { bytes, filename };
    }
  } catch (error) {
    if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new MarketingError('O PDF deve ter até 20 MiB.', 413);
    if (error instanceof MarketingError) throw error;
    throw new MarketingError('Envie somente um arquivo PDF.');
  }
  if (!result) throw new MarketingError('Selecione o PDF do e-book.');
  return result;
}

interface MarketingAsset {
  path: string;
  filename?: string;
}

export async function sendMarketingAsset(db: SupabaseClient, reply: FastifyReply, kind: 'cover' | 'pdf', asset: MarketingAsset) {
  if (!asset || typeof asset.path !== 'string') throw new MarketingError('Arquivo indisponível.', 404);
  const { data, error } = await db.storage.from(MARKETING_BUCKET).download(asset.path).asStream();
  if (error) {
    if ('status' in error && Number(error.status) === 404) throw new MarketingError('Arquivo indisponível.', 404);
    throw error;
  }
  reply.header('X-Content-Type-Options', 'nosniff');
  if (kind === 'pdf') {
    const name = encodeURIComponent(asset.filename || 'ebook.pdf').replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
    reply.header('Content-Disposition', "attachment; filename=\"ebook.pdf\"; filename*=UTF-8''" + name);
  }
  return reply.type(kind === 'cover' ? 'image/webp' : 'application/pdf').send(Readable.fromWeb(data));
}
