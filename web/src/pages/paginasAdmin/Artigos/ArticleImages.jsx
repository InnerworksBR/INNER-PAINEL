import { ImagePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../../../services/api';
import { secondaryButton } from './ArticleUi';
import { ARTICLES_PATH, ARTICLE_IMAGE_TYPES } from './articleEditorial';

export function ProtectedArticleImage({ articleId, media, className }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const { mediaId, alt } = media;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl;
    api.get(`${ARTICLES_PATH}/${articleId}/media/${mediaId}`, { responseType: 'blob', signal }).then(({ data }) => {
      if (!signal.aborted) {
        objectUrl = URL.createObjectURL(data);
        setResult({ mediaId, url: objectUrl });
      }
    }).catch(() => {
      if (!signal.aborted) setResult({ mediaId, error: true });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [articleId, mediaId, attempt]);

  if (result?.mediaId !== mediaId) {
    return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Carregando imagem…</p>;
  }
  if (result.error) {
    return (
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        Não foi possível carregar a imagem.{' '}
        <button type="button" className="font-semibold text-blue-700 underline" onClick={() => {
          setResult(null);
          setAttempt(value => value + 1);
        }}>Tentar novamente</button>
      </p>
    );
  }
  return <img src={result.url} alt={alt} className={className} draggable={false} />;
}

export function ImageUpload({ label, disabled, onSelect, describedBy, className = secondaryButton }) {
  return (
    <label className={`${className} focus-within:outline focus-within:outline-2 focus-within:outline-blue-600 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <ImagePlus size={16} aria-hidden="true" />
      {label}
      <input
        type="file"
        className="sr-only"
        accept={ARTICLE_IMAGE_TYPES.join(',')}
        aria-describedby={describedBy}
        disabled={disabled}
        onChange={event => {
          const file = event.target.files[0];
          event.target.value = '';
          if (file) onSelect(file);
        }}
      />
    </label>
  );
}
