import type { FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { ArticleRequestError } from './site-article-content';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 25_000_000;
const MAX_DIMENSION = 1600;
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SINGLE_FILE_ERROR = 'Envie apenas uma imagem no campo file.';
const INVALID_IMAGE = 'Envie uma imagem JPEG, PNG ou WebP válida de até 25 megapixels.';

export async function readArticleImage(request: FastifyRequest) {
  let input: Buffer | undefined;
  try {
    for await (const part of request.parts({
      limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 0, parts: 1 },
    })) {
      if (part.type !== 'file') throw new ArticleRequestError(SINGLE_FILE_ERROR);
      const file = await part.toBuffer();
      if (part.fieldname !== 'file') throw new ArticleRequestError(SINGLE_FILE_ERROR);
      input = file;
    }
  } catch (error) {
    if ((error as { code?: string })?.code === 'FST_REQ_FILE_TOO_LARGE') {
      throw new ArticleRequestError('Envie uma imagem de até 8 MB.', 413);
    }
    throw new ArticleRequestError(SINGLE_FILE_ERROR);
  }
  if (!input) throw new ArticleRequestError(SINGLE_FILE_ERROR);

  // Select the supported formats before invoking native decoders.
  if (!hasImageHeader(input)) throw new ArticleRequestError(INVALID_IMAGE);
  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: MAX_INPUT_PIXELS });
    const { format } = await image.metadata();
    if (format === 'jpeg' || format === 'png' || format === 'webp') {
      return await image
        .autoOrient()
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    }
  } catch {
    throw new ArticleRequestError(INVALID_IMAGE);
  }
  throw new ArticleRequestError(INVALID_IMAGE);
}

function hasImageHeader(input: Buffer): boolean {
  return (
    input.subarray(0, JPEG_HEADER.length).equals(JPEG_HEADER) ||
    input.subarray(0, PNG_HEADER.length).equals(PNG_HEADER) ||
    (input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP')
  );
}
