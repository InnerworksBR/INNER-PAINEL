// src/services/storage-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'documents';
const SECURITY_BUCKET = 'security-reports';

/**
 * Garante que o bucket 'documents' exista no Storage.
 * Chamado no startup do servidor.
 */
export async function ensureBucketExists(supabase: SupabaseClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();

  const exists = buckets?.some((b: any) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50 MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/png',
        'image/jpeg',
        'image/gif',
        'text/plain',
        'text/csv',
        'application/zip',
        'application/x-7z-compressed',
      ],
    });

    if (error) {
      console.error('Erro ao criar bucket:', error.message);
    } else {
      console.log('Bucket "documents" criado com sucesso.');
    }
  }
}

/**
 * Garante que o bucket 'security-reports' exista (HTML + PDF).
 */
export async function ensureSecurityBucketExists(supabase: SupabaseClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: any) => b.name === SECURITY_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(SECURITY_BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024,
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Erro ao criar bucket security-reports:', error.message);
    } else {
      console.log('Bucket "security-reports" criado/verificado com sucesso.');
    }
  }
}

export async function uploadSecurityFile(
  supabase: SupabaseClient,
  storagePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(SECURITY_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Falha no upload de segurança: ${error.message}`);
}

export async function getSecuritySignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SECURITY_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(`Falha ao gerar URL de segurança: ${error.message}`);
  return data.signedUrl;
}

export async function deleteSecurityFile(
  supabase: SupabaseClient,
  storagePath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(SECURITY_BUCKET)
    .remove([storagePath]);
  if (error) console.error(`Erro ao deletar arquivo de segurança ${storagePath}:`, error.message);
}

/**
 * Faz upload de um arquivo para o Supabase Storage.
 * Retorna a URL pública ou signed URL.
 */
export async function uploadFile(
  supabase: SupabaseClient,
  companyId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  // Organizar por empresa: documents/{company_id}/{filename}
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `${companyId}/${timestamp}_${sanitizedName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Falha no upload: ${error.message}`);
  }

  return storagePath;
}

/**
 * Gera uma URL assinada (temporária) para download de um arquivo.
 */
export async function getSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds: number = 3600 // 1 hora
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new Error(`Falha ao gerar URL de download: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Remove um arquivo do Storage.
 */
export async function deleteFile(
  supabase: SupabaseClient,
  storagePath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error(`Erro ao deletar arquivo ${storagePath}:`, error.message);
  }
}
