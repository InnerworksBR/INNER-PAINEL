\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email)
VALUES
  ('91db4af0-9268-4157-b83e-1300bf4a7390', 'articles-editor-sql@example.test'),
  ('f52bd959-9b50-451f-89d7-008c8c462f0e', 'articles-client-sql@example.test');

INSERT INTO public.profiles (id, role, status)
VALUES
  ('91db4af0-9268-4157-b83e-1300bf4a7390', 'admin', 'active'),
  ('f52bd959-9b50-451f-89d7-008c8c462f0e', 'client', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

INSERT INTO site_editorial.publishers (user_id)
VALUES ('91db4af0-9268-4157-b83e-1300bf4a7390');

CREATE FUNCTION pg_temp.reject_site_article_audit()
RETURNS trigger LANGUAGE plpgsql AS $fixture$
BEGIN
  IF NEW.metadata->>'requestId' = 'c177ea8e-fa1d-4a5f-895b-9e343b3b0e5f' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT503', MESSAGE = 'Simulated audit storage failure';
  END IF;
  RETURN NEW;
END;
$fixture$;
CREATE TRIGGER site_article_audit_fixture BEFORE INSERT ON public.admin_audit_logs
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_site_article_audit();
SET LOCAL ROLE service_role;
DO $test$
DECLARE
  editor_id constant uuid := '91db4af0-9268-4157-b83e-1300bf4a7390';
  client_id constant uuid := 'f52bd959-9b50-451f-89d7-008c8c462f0e';
  article_id constant uuid := 'bc1a297a-b296-44e0-9e97-be39e6da51a1';
  image_id constant uuid := 'da911510-1017-44f4-8ff5-5c0765e1a434';
  publish_request constant uuid := '69011411-8651-495c-8d76-6909161426c8';
  cover jsonb := jsonb_build_object('mediaId', image_id, 'alt', 'Imagem de exemplo');
  blocks constant jsonb := '[{"type":"paragraph","text":"Primeira edição."}]';
  article jsonb;
  first_revision_id uuid;
BEGIN
  BEGIN
    PERFORM public.site_article_create(client_id, article_id);
    RAISE EXCEPTION 'A client was allowed to create a draft';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  article := public.site_article_create(editor_id, article_id);
  IF article->>'status' IS DISTINCT FROM 'draft'
     OR (article->>'version')::int IS DISTINCT FROM 1
     OR EXISTS (SELECT 1 FROM site_public.articles) THEN
    RAISE EXCEPTION 'Creating a draft produced unexpected public state';
  END IF;

  PERFORM public.site_article_add_media(editor_id, article_id, image_id, 320, 240);

  article := public.site_article_save(
    editor_id, article_id, 1, 'Segurança e rede', 'Resumo inicial.', cover, blocks
  );
  IF (article->>'version')::int IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Saving a draft did not advance its version';
  END IF;

  BEGIN
    PERFORM public.site_article_transition(
      editor_id, 'articles-editor-sql@example.test', article_id, 2, publish_request, 'publish'
    );
    RAISE EXCEPTION 'Publication succeeded without a stored image';
  EXCEPTION WHEN SQLSTATE 'PT422' THEN
    NULL;
  END;

  -- Only the SQL test uses a simulated storage row. The integrated HTTP test uploads image bytes.
  INSERT INTO storage.objects (bucket_id, name) VALUES ('site-articles', image_id::text || '.webp');
  article := public.site_article_transition(
    editor_id, 'articles-editor-sql@example.test', article_id, 2, publish_request, 'publish'
  );
  first_revision_id := (article->>'publishedRevisionId')::uuid;

  IF article->>'slug' IS DISTINCT FROM 'seguranca-e-rede'
     OR article->>'status' IS DISTINCT FROM 'published'
     OR (SELECT title FROM site_public.articles WHERE slug = 'seguranca-e-rede') IS DISTINCT FROM 'Segurança e rede'
     OR NOT EXISTS (SELECT 1 FROM site_public.article_media WHERE media_id = image_id) THEN
    RAISE EXCEPTION 'The publication or its image was missing from public read models';
  END IF;

  PERFORM public.site_article_transition(
    editor_id, 'articles-editor-sql@example.test', article_id, 2, publish_request, 'publish'
  );
  IF (SELECT count(*) FROM public.admin_audit_logs WHERE entity_id = article_id::text) <> 1 THEN
    RAISE EXCEPTION 'A retry created a duplicate audit entry';
  END IF;

  BEGIN
    PERFORM public.site_article_save(editor_id, article_id, 2, 'Stale', '', cover, blocks);
    RAISE EXCEPTION 'Stale version overwrote a newer version';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    NULL;
  END;

  article := public.site_article_save(
    editor_id, article_id, 3, 'Segurança para equipes', 'Resumo revisto.', cover, blocks
  );
  IF NOT (article->>'hasDraftChanges')::boolean
     OR (SELECT title FROM site_public.articles WHERE slug = 'seguranca-e-rede') IS DISTINCT FROM 'Segurança e rede' THEN
    RAISE EXCEPTION 'Draft edits modified the public snapshot';
  END IF;

  BEGIN
    PERFORM public.site_article_transition(
      editor_id, 'articles-editor-sql@example.test', article_id, 2, publish_request, 'publish'
    );
    RAISE EXCEPTION 'An old reply returned the version of a subsequent edit';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN
    NULL;
  END;
  BEGIN
    PERFORM public.site_article_transition(
      editor_id, 'articles-editor-sql@example.test', article_id, 4,
      'c177ea8e-fa1d-4a5f-895b-9e343b3b0e5f', 'publish'
    );
    RAISE EXCEPTION 'Publication succeeded without its audit entry';
  EXCEPTION WHEN SQLSTATE 'PT503' THEN
    NULL;
  END;
  IF (SELECT title FROM site_public.articles WHERE slug = 'seguranca-e-rede') IS DISTINCT FROM 'Segurança e rede'
    OR (public.site_article_get(editor_id, article_id)->>'version')::int IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'An audit failure left a partial publication';
  END IF;
  article := public.site_article_transition(
    editor_id, 'articles-editor-sql@example.test', article_id, 4, gen_random_uuid(), 'publish'
  );
  IF article->>'slug' IS DISTINCT FROM 'seguranca-e-rede'
     OR (SELECT title FROM site_public.articles WHERE slug = 'seguranca-e-rede') IS DISTINCT FROM 'Segurança para equipes' THEN
    RAISE EXCEPTION 'Republishing changed the URL or failed to show the new content';
  END IF;

  PERFORM public.site_article_transition(
    editor_id, 'articles-editor-sql@example.test', article_id, 5, gen_random_uuid(), 'restore', first_revision_id
  );
  IF (SELECT title FROM site_public.articles WHERE slug = 'seguranca-e-rede') IS DISTINCT FROM 'Segurança e rede' THEN
    RAISE EXCEPTION 'Restoring a past publication failed';
  END IF;

  article := public.site_article_transition(
    editor_id, 'articles-editor-sql@example.test', article_id, 6, gen_random_uuid(), 'unpublish'
  );
  IF article->>'status' IS DISTINCT FROM 'unpublished'
     OR EXISTS (SELECT 1 FROM site_public.articles WHERE slug = 'seguranca-e-rede')
     OR EXISTS (SELECT 1 FROM site_public.article_media WHERE media_id = image_id) THEN
    RAISE EXCEPTION 'Unpublishing left public article or image data';
  END IF;
END
$test$;

SET LOCAL ROLE anon;
DO $test$
BEGIN
  PERFORM slug FROM site_public.articles LIMIT 1;
  BEGIN
    PERFORM id FROM site_editorial.articles LIMIT 1;
    RAISE EXCEPTION 'Anonymous access reached editorial drafts';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.site_article_list('91db4af0-9268-4157-b83e-1300bf4a7390', 1);
    RAISE EXCEPTION 'Anonymous access reached an editorial RPC';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$test$;

ROLLBACK;
