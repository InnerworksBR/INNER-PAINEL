-- Artigos institucionais. O PostgREST expõe site_public; site_editorial é interno.
BEGIN;

CREATE SCHEMA IF NOT EXISTS site_editorial;
CREATE SCHEMA IF NOT EXISTS site_public;

CREATE TABLE IF NOT EXISTS site_editorial.publishers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_editorial.articles (
  id uuid PRIMARY KEY,
  slug text UNIQUE,
  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 160),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 320),
  cover jsonb CHECK (cover IS NULL OR jsonb_typeof(cover) = 'object'),
  blocks jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(blocks) = 'array' AND jsonb_array_length(blocks) <= 100),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  first_published_at timestamptz,
  published_revision_id uuid,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS site_articles_updated_idx ON site_editorial.articles (updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS site_editorial.media (
  id uuid PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES site_editorial.articles(id),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1600),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1600)
);
CREATE INDEX IF NOT EXISTS site_article_media_owner_idx ON site_editorial.media (article_id);

CREATE TABLE IF NOT EXISTS site_editorial.revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES site_editorial.articles(id),
  title text NOT NULL,
  summary text NOT NULL,
  cover jsonb NOT NULL,
  blocks jsonb NOT NULL,
  published_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS site_article_revisions_idx
  ON site_editorial.revisions (article_id, published_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS site_editorial.actions (
  article_id uuid REFERENCES site_editorial.articles(id),
  request_id uuid,
  action text NOT NULL CHECK (action IN ('publish', 'unpublish', 'restore')),
  expected_version integer NOT NULL,
  revision_id uuid,
  PRIMARY KEY (article_id, request_id)
);

CREATE TABLE IF NOT EXISTS site_public.articles (
  slug text PRIMARY KEY,
  title text NOT NULL,
  summary text NOT NULL,
  cover jsonb NOT NULL,
  blocks jsonb NOT NULL,
  published_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS site_public_articles_date_idx ON site_public.articles (published_at DESC, slug ASC);

CREATE TABLE IF NOT EXISTS site_public.article_media (
  media_id uuid PRIMARY KEY REFERENCES site_editorial.media(id),
  slug text NOT NULL REFERENCES site_public.articles(slug) ON DELETE CASCADE,
  object_name text UNIQUE GENERATED ALWAYS AS (media_id::text || '.webp') STORED
);
CREATE INDEX IF NOT EXISTS site_public_article_media_slug_idx ON site_public.article_media (slug);

ALTER TABLE site_editorial.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_editorial.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_editorial.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_editorial.revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_editorial.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_public.article_media ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA site_editorial, site_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA site_editorial, site_public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA site_editorial, site_public TO service_role;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA site_editorial TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA site_public TO service_role;
GRANT USAGE ON SCHEMA site_public TO anon, authenticated;
GRANT SELECT ON site_public.articles, site_public.article_media TO anon, authenticated;

DROP POLICY IF EXISTS site_articles_public_read ON site_public.articles;
CREATE POLICY site_articles_public_read ON site_public.articles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS site_articles_public_media ON site_public.article_media;
CREATE POLICY site_articles_public_media ON site_public.article_media FOR SELECT TO anon, authenticated USING (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-articles', 'site-articles', false, 8388608, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- A política restritiva continua valendo se houver políticas permissivas de outros buckets.
DROP POLICY IF EXISTS site_articles_media_boundary ON storage.objects;
CREATE POLICY site_articles_media_boundary ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (
    bucket_id <> 'site-articles'
    OR (
      storage.allow_only_operation('object.get_authenticated')
      AND EXISTS (SELECT 1 FROM site_public.article_media m WHERE m.object_name = storage.objects.name)
    )
  )
  WITH CHECK (bucket_id <> 'site-articles');

DROP POLICY IF EXISTS site_articles_media_download ON storage.objects;
CREATE POLICY site_articles_media_download ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-articles');

CREATE OR REPLACE FUNCTION public.site_article_allowed(p_actor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM site_editorial.publishers a
    JOIN public.profiles p ON p.id = a.user_id
    WHERE p.id = p_actor_id AND p.role = 'admin' AND coalesce(p.status, 'active') = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION site_editorial.require_manager(p_actor_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
BEGIN
  IF NOT public.site_article_allowed(p_actor_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso à edição de artigos negado.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION site_editorial.article_summary(a site_editorial.articles)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $function$
  SELECT jsonb_build_object(
    'id', (a).id, 'slug', (a).slug, 'title', (a).title, 'version', (a).version,
    'status', CASE WHEN (a).published_revision_id IS NOT NULL THEN 'published'
                   WHEN (a).slug IS NOT NULL THEN 'unpublished' ELSE 'draft' END,
    'publishedAt', (a).first_published_at, 'updatedAt', (a).updated_at
  );
$function$;

CREATE OR REPLACE FUNCTION site_editorial.article_detail(p_article_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT site_editorial.article_summary(a) || jsonb_build_object(
    'summary', a.summary, 'cover', a.cover, 'blocks', a.blocks,
    'publishedRevisionId', a.published_revision_id,
    'hasDraftChanges', r.id IS NOT NULL AND
      (a.title, a.summary, a.cover, a.blocks) IS DISTINCT FROM (r.title, r.summary, r.cover, r.blocks),
    'revisions', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object('id', q.id, 'title', q.title, 'publishedAt', q.published_at)
        ORDER BY q.published_at DESC, q.id DESC
      )
      FROM (
        SELECT id, title, published_at FROM site_editorial.revisions
        WHERE article_id = a.id ORDER BY published_at DESC, id DESC LIMIT 20
      ) q
    ), '[]'::jsonb)
  ) INTO result
  FROM site_editorial.articles a
  LEFT JOIN site_editorial.revisions r ON r.id = a.published_revision_id
  WHERE a.id = p_article_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Artigo não encontrado.';
  END IF;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION site_editorial.media_ids(p_cover jsonb, p_blocks jsonb)
RETURNS SETOF uuid LANGUAGE sql IMMUTABLE SET search_path = '' AS $function$
  SELECT (p_cover->>'mediaId')::uuid WHERE p_cover->>'mediaId' IS NOT NULL
  UNION
  SELECT (b->>'mediaId')::uuid FROM jsonb_array_elements(p_blocks) b WHERE b->>'type' = 'image';
$function$;

CREATE OR REPLACE FUNCTION public.site_article_list(p_actor_id uuid, p_page integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
BEGIN
  PERFORM site_editorial.require_manager(p_actor_id);
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'Página inválida.';
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(
      site_editorial.article_summary(q.article) ORDER BY q.updated_at DESC, q.id DESC
    ), '[]'::jsonb)
    FROM (
      SELECT a AS article, a.id, a.updated_at
      FROM site_editorial.articles a
      ORDER BY a.updated_at DESC, a.id DESC
      OFFSET ((p_page - 1) * 20) LIMIT 21
    ) q
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_article_get(p_actor_id uuid, p_article_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
BEGIN
  PERFORM site_editorial.require_manager(p_actor_id);
  RETURN site_editorial.article_detail(p_article_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_article_create(p_actor_id uuid, p_article_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  PERFORM site_editorial.require_manager(p_actor_id);
  INSERT INTO site_editorial.articles (id) VALUES (p_article_id) ON CONFLICT (id) DO NOTHING;
  RETURN site_editorial.article_detail(p_article_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_article_save(
  p_actor_id uuid, p_article_id uuid, p_version integer, p_title text, p_summary text, p_cover jsonb, p_blocks jsonb
)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  current_version integer;
BEGIN
  PERFORM site_editorial.require_manager(p_actor_id);
  SELECT a.version INTO current_version FROM site_editorial.articles a WHERE a.id = p_article_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Artigo não encontrado.';
  END IF;
  IF current_version IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'O artigo foi atualizado. Recarregue antes de tentar novamente.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM site_editorial.media_ids(p_cover, p_blocks) AS requested(id)
    LEFT JOIN site_editorial.media m ON m.id = requested.id AND m.article_id = p_article_id
    WHERE m.id IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'Uma das imagens não pertence a este artigo.';
  END IF;

  UPDATE site_editorial.articles SET
    title = p_title, summary = p_summary, cover = p_cover, blocks = p_blocks,
    version = version + 1, updated_at = clock_timestamp()
  WHERE id = p_article_id;
  RETURN site_editorial.article_detail(p_article_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_article_add_media(
  p_actor_id uuid, p_article_id uuid, p_media_id uuid, p_width integer, p_height integer
)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  PERFORM site_editorial.require_manager(p_actor_id);
  IF NOT EXISTS (SELECT 1 FROM site_editorial.articles WHERE id = p_article_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Artigo não encontrado.';
  END IF;

  INSERT INTO site_editorial.media (id, article_id, width, height)
  VALUES (p_media_id, p_article_id, p_width, p_height);
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_article_get_media(p_actor_id uuid, p_article_id uuid, p_media_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
BEGIN
  PERFORM site_editorial.require_manager(p_actor_id);
  RETURN EXISTS (SELECT 1 FROM site_editorial.media WHERE article_id = p_article_id AND id = p_media_id);
END;
$function$;

CREATE OR REPLACE FUNCTION site_editorial.assign_slug(p_article_id uuid, p_title text)
RETURNS text LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  base text;
  candidate text;
BEGIN
  base := translate(lower(p_title), 'àáâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  base := btrim(left(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), 100), '-');
  base := CASE base WHEN '' THEN 'artigo' WHEN 'midia' THEN 'midia-artigo' ELSE base END;

  FOR suffix IN 1..1000 LOOP
    candidate := base || CASE WHEN suffix = 1 THEN '' ELSE '-' || suffix::text END;
    BEGIN
      UPDATE site_editorial.articles SET slug = candidate WHERE id = p_article_id;
      RETURN candidate;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
  RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Não foi possível reservar o endereço do artigo.';
END;
$function$;

CREATE OR REPLACE FUNCTION site_editorial.check_publishable(
  p_article_id uuid, p_title text, p_summary text, p_cover jsonb, p_blocks jsonb
)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
BEGIN
  IF btrim(p_title) = '' OR btrim(p_summary) = '' OR p_cover IS NULL
    OR coalesce(p_cover->>'mediaId', '') = '' OR coalesce(btrim(p_cover->>'alt'), '') = ''
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_blocks) b
      WHERE (b->>'type' IN ('paragraph', 'quote') AND coalesce(btrim(b->>'text'), '') <> '')
         OR (b->>'type' = 'list' AND EXISTS (
           SELECT 1 FROM jsonb_array_elements_text(b->'items') item WHERE btrim(item) <> ''
         ))
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_blocks) b
      WHERE b->>'type' = 'image' AND coalesce(btrim(b->>'alt'), '') = ''
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'Preencha título, resumo, texto e os textos alternativos das imagens.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM site_editorial.media_ids(p_cover, p_blocks) AS requested(id)
    LEFT JOIN site_editorial.media m ON m.id = requested.id AND m.article_id = p_article_id
    LEFT JOIN storage.objects o ON o.bucket_id = 'site-articles' AND o.name = m.id::text || '.webp'
    WHERE o.id IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'Uma das imagens não está disponível para publicação.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_article_transition(
  p_actor_id uuid, p_actor_email text, p_article_id uuid, p_version integer,
  p_request_id uuid, p_action text, p_revision_id uuid DEFAULT NULL,
  p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  a site_editorial.articles%ROWTYPE;
  previous_action site_editorial.actions%ROWTYPE;
  revision site_editorial.revisions%ROWTYPE;
  changed_at timestamptz;
BEGIN
  PERFORM site_editorial.require_manager(p_actor_id);
  IF p_action IS NULL OR p_action NOT IN ('publish', 'unpublish', 'restore')
    OR (p_action = 'restore') IS DISTINCT FROM (p_revision_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'Operação de publicação inválida.';
  END IF;

  SELECT * INTO a FROM site_editorial.articles WHERE id = p_article_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Artigo não encontrado.';
  END IF;

  SELECT * INTO previous_action FROM site_editorial.actions WHERE article_id = p_article_id AND request_id = p_request_id;
  IF FOUND THEN
    IF (previous_action.expected_version, previous_action.action, previous_action.revision_id)
      IS DISTINCT FROM (p_version, p_action, p_revision_id) THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Identificador de operação já utilizado.';
    END IF;
    IF a.version IS DISTINCT FROM previous_action.expected_version + 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'O artigo foi atualizado desde a última operação.';
    END IF;
    RETURN site_editorial.article_detail(a.id);
  END IF;
  IF a.version IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'O artigo foi atualizado. Recarregue antes de tentar novamente.';
  END IF;

  changed_at := clock_timestamp();

  IF p_action = 'unpublish' THEN
    IF a.published_revision_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'O artigo já está fora do ar.';
    END IF;
    DELETE FROM site_public.articles WHERE slug = a.slug;
    a.published_revision_id := NULL;
  ELSE
    IF p_action = 'publish' THEN
      PERFORM site_editorial.check_publishable(a.id, a.title, a.summary, a.cover, a.blocks);
      INSERT INTO site_editorial.revisions (article_id, title, summary, cover, blocks, published_at)
      VALUES (a.id, a.title, a.summary, a.cover, a.blocks, changed_at) RETURNING * INTO revision;
    ELSE
      SELECT * INTO revision FROM site_editorial.revisions WHERE article_id = a.id AND id = p_revision_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Versão do artigo não encontrada.';
      END IF;
      PERFORM site_editorial.check_publishable(a.id, revision.title, revision.summary, revision.cover, revision.blocks);
    END IF;

    a.slug := coalesce(a.slug, site_editorial.assign_slug(a.id, revision.title));
    a.first_published_at := coalesce(a.first_published_at, changed_at);
    a.published_revision_id := revision.id;

    INSERT INTO site_public.articles (slug, title, summary, cover, blocks, published_at, updated_at)
    VALUES (a.slug, revision.title, revision.summary, revision.cover, revision.blocks, a.first_published_at, changed_at)
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, summary = EXCLUDED.summary, cover = EXCLUDED.cover,
      blocks = EXCLUDED.blocks, updated_at = EXCLUDED.updated_at;

    DELETE FROM site_public.article_media WHERE slug = a.slug;
    INSERT INTO site_public.article_media (media_id, slug)
    SELECT id, a.slug FROM site_editorial.media_ids(revision.cover, revision.blocks) AS media(id);
  END IF;

  UPDATE site_editorial.articles SET
    published_revision_id = a.published_revision_id, first_published_at = a.first_published_at,
    version = version + 1, updated_at = changed_at
  WHERE id = a.id;

  INSERT INTO site_editorial.actions (article_id, request_id, action, expected_version, revision_id)
  VALUES (a.id, p_request_id, p_action, p_version, p_revision_id);

  INSERT INTO public.admin_audit_logs
    (admin_user_id, admin_email, action, entity_type, entity_id, summary, metadata, ip_address, user_agent)
  VALUES (
    p_actor_id, p_actor_email, 'site_article.' || p_action, 'site_article', a.id::text,
    CASE p_action WHEN 'publish' THEN 'Artigo publicado: ' WHEN 'unpublish' THEN 'Artigo retirado: '
      ELSE 'Versão de artigo restaurada: ' END || a.slug,
    jsonb_build_object('requestId', p_request_id, 'publishedRevisionId', a.published_revision_id),
    p_ip, p_user_agent
  );

  RETURN site_editorial.article_detail(a.id);
END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA site_editorial FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA site_editorial TO service_role;

REVOKE ALL ON FUNCTION
  public.site_article_allowed(uuid),
  public.site_article_list(uuid, integer),
  public.site_article_get(uuid, uuid),
  public.site_article_create(uuid, uuid),
  public.site_article_save(uuid, uuid, integer, text, text, jsonb, jsonb),
  public.site_article_add_media(uuid, uuid, uuid, integer, integer),
  public.site_article_get_media(uuid, uuid, uuid),
  public.site_article_transition(uuid, text, uuid, integer, uuid, text, uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.site_article_allowed(uuid),
  public.site_article_list(uuid, integer),
  public.site_article_get(uuid, uuid),
  public.site_article_create(uuid, uuid),
  public.site_article_save(uuid, uuid, integer, text, text, jsonb, jsonb),
  public.site_article_add_media(uuid, uuid, uuid, integer, integer),
  public.site_article_get_media(uuid, uuid, uuid),
  public.site_article_transition(uuid, text, uuid, integer, uuid, text, uuid, text, text)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
