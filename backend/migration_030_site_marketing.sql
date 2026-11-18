-- E-books, consentimento e campanhas do site. O PostgREST expõe somente os RPCs.
BEGIN;

CREATE SCHEMA IF NOT EXISTS site_marketing;

CREATE TABLE IF NOT EXISTS site_marketing.ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL CHECK (char_length(description) <= 1000),
  cover_path text,
  pdf_path text,
  pdf_name text,
  published_title text,
  published_description text,
  published_cover_path text,
  published_pdf_path text,
  published_pdf_name text,
  download_generation uuid,
  published_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS marketing_ebooks_public_idx
  ON site_marketing.ebooks (published_at DESC, slug) WHERE published_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS site_marketing.assets (
  path text PRIMARY KEY,
  ebook_id uuid NOT NULL REFERENCES site_marketing.ebooks(id),
  kind text NOT NULL CHECK (kind IN ('cover', 'pdf')),
  filename text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS site_marketing.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (char_length(email) <= 254),
  name text CHECK (char_length(name) <= 120),
  marketing_status text NOT NULL DEFAULT 'not_subscribed'
    CHECK (marketing_status IN ('not_subscribed', 'pending', 'subscribed', 'unsubscribed', 'suppressed')),
  consent_epoch integer NOT NULL DEFAULT 0,
  last_request_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS marketing_contacts_list_idx
  ON site_marketing.contacts (last_request_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS marketing_contacts_subscribed_idx
  ON site_marketing.contacts (id) WHERE marketing_status = 'subscribed';

CREATE TABLE IF NOT EXISTS site_marketing.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES site_marketing.contacts(id),
  ebook_id uuid NOT NULL REFERENCES site_marketing.ebooks(id),
  ebook_title text NOT NULL,
  download_generation uuid NOT NULL,
  wants_marketing boolean NOT NULL,
  consent_epoch integer NOT NULL,
  consent_notice_version integer,
  requested_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  UNIQUE (id, contact_id)
);

CREATE INDEX IF NOT EXISTS marketing_requests_contact_idx
  ON site_marketing.requests (contact_id, ebook_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS marketing_requests_ebook_idx
  ON site_marketing.requests (ebook_id, contact_id);

CREATE TABLE IF NOT EXISTS site_marketing.capture_limits (
  period_start timestamptz NOT NULL,
  scope text NOT NULL CHECK (scope IN ('source', 'email')),
  identity_hash text NOT NULL,
  total integer NOT NULL CHECK (total > 0),
  PRIMARY KEY (period_start, scope, identity_hash)
);

CREATE TABLE IF NOT EXISTS site_marketing.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 180),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  ebook_id uuid REFERENCES site_marketing.ebooks(id),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'scheduled', 'sending', 'paused', 'completed')),
  scheduled_at timestamptz,
  audience_size integer NOT NULL DEFAULT 0 CHECK (audience_size >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS site_marketing.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('delivery', 'campaign', 'test')),
  email text NOT NULL,
  recipient_name text,
  request_id uuid UNIQUE,
  contact_id uuid REFERENCES site_marketing.contacts(id),
  campaign_id uuid REFERENCES site_marketing.campaigns(id),
  campaign_version integer,
  consent_epoch integer,
  ebook_title text,
  wants_marketing boolean NOT NULL DEFAULT false,
  subject text,
  body text,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'leased', 'sending', 'accepted', 'failed', 'skipped', 'uncertain')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_token uuid,
  lease_until timestamptz,
  authorized_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  blocked_at timestamptz,
  last_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (request_id, contact_id) REFERENCES site_marketing.requests (id, contact_id),
  CHECK (
    (kind = 'delivery' AND request_id IS NOT NULL AND contact_id IS NOT NULL AND campaign_id IS NULL)
    OR (kind = 'campaign' AND request_id IS NULL AND contact_id IS NOT NULL AND campaign_id IS NOT NULL)
    OR (kind = 'test' AND request_id IS NULL AND contact_id IS NULL AND campaign_id IS NOT NULL)
  ),
  CHECK ((state IN ('leased', 'sending')) = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_campaign_recipient_idx
  ON site_marketing.jobs (campaign_id, contact_id) WHERE kind = 'campaign';
CREATE INDEX IF NOT EXISTS marketing_jobs_campaign_state_idx
  ON site_marketing.jobs (campaign_id, state) WHERE kind = 'campaign';
CREATE INDEX IF NOT EXISTS marketing_jobs_pending_idx
  ON site_marketing.jobs (kind, next_attempt_at, id) WHERE state = 'pending';
CREATE INDEX IF NOT EXISTS marketing_jobs_lease_idx
  ON site_marketing.jobs (lease_until, id) WHERE state IN ('leased', 'sending');
CREATE INDEX IF NOT EXISTS marketing_jobs_test_idx
  ON site_marketing.jobs (campaign_id, created_at DESC) WHERE kind = 'test';

CREATE TABLE IF NOT EXISTS site_marketing.provider_events (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('delivered', 'bounce', 'complaint')),
  job_id uuid NOT NULL REFERENCES site_marketing.jobs(id),
  received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE site_marketing.ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_marketing.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_marketing.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_marketing.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_marketing.capture_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_marketing.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_marketing.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_marketing.provider_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA site_marketing FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA site_marketing FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-marketing', 'site-marketing', false, 20971520, ARRAY['application/pdf', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Impede leitura e mutação do bucket mesmo se houver políticas permissivas do Storage.
DROP POLICY IF EXISTS site_marketing_private_objects ON storage.objects;
CREATE POLICY site_marketing_private_objects ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'site-marketing')
  WITH CHECK (bucket_id <> 'site-marketing');

CREATE OR REPLACE FUNCTION site_marketing.admin_allowed(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_actor AND role = 'admin' AND status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION site_marketing.audit(
  p_actor uuid, p_action text, p_entity text, p_id uuid, p_version integer
)
RETURNS void LANGUAGE sql SET search_path = '' AS $function$
  INSERT INTO public.admin_audit_logs
    (admin_user_id, action, entity_type, entity_id, summary, metadata)
  VALUES (p_actor, 'site_marketing.' || p_action, p_entity, p_id::text,
    CASE p_action
      WHEN 'createEbook' THEN 'E-book criado'
      WHEN 'editEbook' THEN 'Rascunho do e-book alterado'
      WHEN 'attachEbook' THEN 'Arquivo de e-book associado'
      WHEN 'publishEbook' THEN 'E-book publicado'
      WHEN 'unpublishEbook' THEN 'E-book retirado'
      WHEN 'createCampaign' THEN 'Campanha criada'
      WHEN 'editCampaign' THEN 'Rascunho da campanha alterado'
      WHEN 'testCampaign' THEN 'Teste de campanha enfileirado'
      WHEN 'activateCampaign' THEN 'Campanha ativada'
      WHEN 'pauseCampaign' THEN 'Campanha pausada'
      WHEN 'resumeCampaign' THEN 'Campanha retomada'
    END,
    jsonb_build_object('version', p_version));
$function$;

CREATE OR REPLACE FUNCTION site_marketing.require_version(p_current integer, p_expected integer)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $function$
BEGIN
  IF p_expected IS NULL OR p_expected < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Versão inválida.';
  END IF;
  IF p_expected <> p_current THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'O registro foi atualizado. Recarregue antes de tentar novamente.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.normalized_email(p_email text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $function$
DECLARE
  email text := lower(btrim(p_email));
BEGIN
  IF email IS NULL OR char_length(email) > 254 OR email !~ '^[^[:space:]@]+@[^[:space:]@.]+([.][^[:space:]@.]+)+$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'E-mail inválido.';
  END IF;
  RETURN email;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.ebook_json(e site_marketing.ebooks)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $function$
  SELECT jsonb_build_object(
    'id', (e).id, 'title', (e).title, 'description', (e).description, 'slug', (e).slug,
    'status', CASE WHEN (e).published_at IS NOT NULL THEN 'published'
                   WHEN (e).slug IS NOT NULL THEN 'unpublished' ELSE 'draft' END,
    'version', (e).version, 'coverReady', (e).cover_path IS NOT NULL,
    'pdfReady', (e).pdf_path IS NOT NULL, 'pdfName', (e).pdf_name,
    'updatedAt', (e).updated_at, 'publishedAt', (e).published_at,
    'hasDraftChanges', (e).published_at IS NOT NULL AND
      ((e).title, (e).description, (e).cover_path, (e).pdf_path, (e).pdf_name)
      IS DISTINCT FROM
      ((e).published_title, (e).published_description, (e).published_cover_path, (e).published_pdf_path, (e).published_pdf_name)
  );
$function$;

CREATE OR REPLACE FUNCTION site_marketing.public_ebook_json(e site_marketing.ebooks)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $function$
  SELECT jsonb_build_object('slug', (e).slug, 'title', (e).published_title,
    'description', (e).published_description, 'publishedAt', (e).published_at);
$function$;

CREATE OR REPLACE FUNCTION site_marketing.assign_slug(p_id uuid, p_title text)
RETURNS text LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  base text;
  candidate text;
BEGIN
  base := translate(lower(p_title), 'àáâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  base := btrim(left(regexp_replace(base, '[^a-z0-9]+', '-', 'g'), 100), '-');
  base := CASE
    WHEN base = '' THEN 'ebook'
    WHEN base IN ('download', 'confirm', 'unsubscribe', 'events') THEN base || '-ebook'
    ELSE base
  END;
  FOR suffix IN 1..1000 LOOP
    candidate := base || CASE WHEN suffix = 1 THEN '' ELSE '-' || suffix::text END;
    BEGIN
      UPDATE site_marketing.ebooks SET slug = candidate WHERE id = p_id;
      RETURN candidate;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;
  RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Não foi possível reservar o endereço do e-book.';
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.manage_ebook(p_actor uuid, p_operation text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  e site_marketing.ebooks%ROWTYPE;
  ebook_id uuid := (p_data->>'id')::uuid;
  draft_title text := btrim(p_data->>'title');
  draft_description text := btrim(p_data->>'description');
  asset_kind text := p_data->>'kind';
  asset_path text := p_data->>'path';
  asset_filename text := btrim(p_data->>'filename');
BEGIN
  IF p_operation IN ('createEbook', 'editEbook') AND (
    coalesce(char_length(draft_title), 0) NOT BETWEEN 1 AND 160
    OR draft_description IS NULL OR char_length(draft_description) > 1000
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Título ou descrição do e-book inválidos.';
  END IF;

  IF p_operation = 'createEbook' THEN
    INSERT INTO site_marketing.ebooks (title, description)
    VALUES (draft_title, draft_description) RETURNING * INTO e;
  ELSE
    SELECT * INTO e FROM site_marketing.ebooks WHERE id = ebook_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'E-book não encontrado.';
    END IF;
    PERFORM site_marketing.require_version(e.version, (p_data->>'version')::integer);

    CASE p_operation
      WHEN 'editEbook' THEN
        e.title := draft_title;
        e.description := draft_description;
      WHEN 'attachEbook' THEN
        IF NOT coalesce(
          (asset_kind = 'cover' AND asset_path ~ '^cover/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]webp$')
          OR (asset_kind = 'pdf' AND asset_path ~ '^pdf/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]pdf$'
            AND char_length(asset_filename) BETWEEN 1 AND 120 AND asset_filename !~ '[[:cntrl:]/]' AND position(chr(92) IN asset_filename) = 0),
          false
        ) OR NOT EXISTS (
          SELECT 1 FROM storage.objects WHERE bucket_id = 'site-marketing' AND name = asset_path
        ) THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Arquivo de e-book inválido ou indisponível.';
        END IF;
        asset_filename := CASE WHEN asset_kind = 'cover' THEN NULL ELSE asset_filename END;
        INSERT INTO site_marketing.assets (path, ebook_id, kind, filename)
        VALUES (asset_path, e.id, asset_kind, asset_filename) ON CONFLICT (path) DO NOTHING;
        IF NOT EXISTS (
          SELECT 1 FROM site_marketing.assets a WHERE a.path = asset_path AND a.ebook_id = e.id
            AND a.kind = asset_kind AND a.filename IS NOT DISTINCT FROM asset_filename
        ) THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Arquivo já associado a outro e-book.';
        END IF;
        IF asset_kind = 'cover' THEN
          e.cover_path := asset_path;
        ELSE
          e.pdf_path := asset_path;
          e.pdf_name := asset_filename;
        END IF;
      WHEN 'publishEbook' THEN
        IF e.description = '' OR e.cover_path IS NULL OR e.pdf_path IS NULL OR (
          SELECT count(*) FROM storage.objects
          WHERE bucket_id = 'site-marketing' AND name IN (e.cover_path, e.pdf_path)
        ) <> 2 THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Preencha a descrição e envie a capa e o PDF antes de publicar.';
        END IF;
        e.slug := coalesce(e.slug, site_marketing.assign_slug(e.id, e.title));
        IF e.published_pdf_path IS DISTINCT FROM e.pdf_path OR e.download_generation IS NULL THEN
          e.download_generation := gen_random_uuid();
        END IF;
        e.published_at := clock_timestamp();
        e.published_title := e.title;
        e.published_description := e.description;
        e.published_cover_path := e.cover_path;
        e.published_pdf_path := e.pdf_path;
        e.published_pdf_name := e.pdf_name;
      WHEN 'unpublishEbook' THEN
        IF e.published_at IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'O e-book já está fora do ar.';
        END IF;
        e.published_at := NULL;
        e.published_title := NULL;
        e.published_description := NULL;
        e.published_cover_path := NULL;
        e.published_pdf_path := NULL;
        e.published_pdf_name := NULL;
        e.download_generation := NULL;
    END CASE;

    UPDATE site_marketing.ebooks SET title = e.title, description = e.description,
      cover_path = e.cover_path, pdf_path = e.pdf_path, pdf_name = e.pdf_name,
      published_at = e.published_at, published_title = e.published_title,
      published_description = e.published_description, published_cover_path = e.published_cover_path,
      published_pdf_path = e.published_pdf_path, published_pdf_name = e.published_pdf_name,
      download_generation = e.download_generation, version = version + 1, updated_at = clock_timestamp()
    WHERE id = ebook_id RETURNING * INTO e;
  END IF;

  PERFORM site_marketing.audit(p_actor, p_operation, 'site_marketing_ebook', e.id, e.version);
  RETURN jsonb_build_object('ebook', site_marketing.ebook_json(e));
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.page_number(p_data jsonb)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $function$
DECLARE
  page integer := coalesce((p_data->>'page')::integer, 1);
BEGIN
  IF page NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Página inválida.';
  END IF;
  RETURN page;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.contacts_page(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
DECLARE
  page integer := site_marketing.page_number(p_data);
  filter_status text := p_data->>'status';
  filter_ebook uuid := (p_data->>'ebookId')::uuid;
  filter_start date := (p_data->>'from')::date;
  filter_end date := (p_data->>'to')::date;
  query text := lower(btrim(p_data->>'q'));
  result jsonb;
BEGIN
  IF filter_status IS NOT NULL AND filter_status NOT IN (
    'not_subscribed', 'pending', 'subscribed', 'unsubscribed', 'suppressed'
  ) OR char_length(query) > 254 OR filter_start > filter_end THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Filtro de contatos inválido.';
  END IF;

  WITH entries AS (
    SELECT c.*, row_number() OVER (ORDER BY c.last_request_at DESC, c.id DESC) AS row_position
    FROM (
      SELECT c.* FROM site_marketing.contacts c
      WHERE (filter_status IS NULL OR c.marketing_status = filter_status)
        AND (query IS NULL OR query = '' OR strpos(c.email, query) > 0 OR strpos(lower(c.name), query) > 0)
        AND ((filter_ebook IS NULL AND filter_start IS NULL AND filter_end IS NULL) OR EXISTS (
          SELECT 1 FROM site_marketing.requests r WHERE r.contact_id = c.id
            AND (filter_ebook IS NULL OR r.ebook_id = filter_ebook)
            AND (filter_start IS NULL OR r.requested_at >= (filter_start::timestamp AT TIME ZONE 'America/Sao_Paulo'))
            AND (filter_end IS NULL OR r.requested_at < ((filter_end + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo'))
        ))
      ORDER BY c.last_request_at DESC, c.id DESC
      OFFSET ((page - 1) * 20) LIMIT 21
    ) c
  )
  SELECT jsonb_build_object(
    'contacts', coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'email', c.email, 'name', c.name, 'marketingStatus', c.marketing_status,
      'lastRequestAt', c.last_request_at, 'ebooks', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', e.id, 'title', coalesce(e.published_title, e.title))
          ORDER BY e.title, e.id)
        FROM site_marketing.ebooks e
        WHERE EXISTS (SELECT 1 FROM site_marketing.requests r WHERE r.contact_id = c.id AND r.ebook_id = e.id)
      ), '[]'::jsonb)
    ) ORDER BY c.row_position) FILTER (WHERE c.row_position <= 20), '[]'::jsonb),
    'page', page, 'hasMore', count(*) > 20
  ) INTO result FROM entries c;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.eligible_contacts(p_ebook uuid)
RETURNS SETOF site_marketing.contacts LANGUAGE sql STABLE SET search_path = '' AS $function$
  SELECT c.* FROM site_marketing.contacts c
  WHERE c.marketing_status = 'subscribed'
    AND (p_ebook IS NULL OR EXISTS (
      SELECT 1 FROM site_marketing.requests r WHERE r.contact_id = c.id AND r.ebook_id = p_ebook
    ));
$function$;

CREATE OR REPLACE FUNCTION site_marketing.campaign_json(c site_marketing.campaigns)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $function$
  SELECT jsonb_build_object(
    'id', (c).id, 'name', (c).name, 'subject', (c).subject, 'body', (c).body, 'ebookId', (c).ebook_id,
    'state', (c).state, 'scheduledAt', (c).scheduled_at, 'version', (c).version,
    'audienceSize', (c).audience_size,
    'queued', count(*) FILTER (WHERE j.state IN ('pending', 'leased', 'sending')),
    'accepted', count(j.accepted_at), 'delivered', count(j.delivered_at),
    'failed', count(*) FILTER (WHERE j.state = 'failed'),
    'skipped', count(*) FILTER (WHERE j.state = 'skipped'),
    'uncertain', count(*) FILTER (WHERE j.state = 'uncertain'),
    'createdAt', (c).created_at, 'updatedAt', (c).updated_at
  )
  FROM site_marketing.jobs j WHERE j.campaign_id = (c).id AND j.kind = 'campaign';
$function$;

CREATE OR REPLACE FUNCTION site_marketing.manage_campaign(p_actor uuid, p_operation text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  c site_marketing.campaigns%ROWTYPE;
  target_id uuid := (p_data->>'id')::uuid;
  target_ebook uuid := (p_data->>'ebookId')::uuid;
  draft_name text := btrim(p_data->>'name');
  draft_subject text := btrim(p_data->>'subject');
  draft_body text := btrim(p_data->>'body');
  target_email text;
  expected_audience integer;
  recipients integer;
  current_timepoint timestamptz := clock_timestamp();
BEGIN
  IF p_operation IN ('createCampaign', 'editCampaign') THEN
    IF coalesce(char_length(draft_name), 0) NOT BETWEEN 1 AND 160
      OR coalesce(char_length(draft_subject), 0) NOT BETWEEN 1 AND 180
      OR coalesce(char_length(draft_body), 0) NOT BETWEEN 1 AND 10000
      OR draft_subject ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Nome, assunto ou mensagem da campanha inválidos.';
    END IF;
    IF target_ebook IS NOT NULL AND NOT EXISTS (SELECT 1 FROM site_marketing.ebooks WHERE id = target_ebook) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'E-book não encontrado.';
    END IF;
  END IF;

  IF p_operation = 'createCampaign' THEN
    INSERT INTO site_marketing.campaigns (name, subject, body, ebook_id)
    VALUES (draft_name, draft_subject, draft_body, target_ebook) RETURNING * INTO c;
  ELSE
    SELECT * INTO c FROM site_marketing.campaigns WHERE id = target_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Campanha não encontrada.';
    END IF;
    IF p_operation = 'audience' THEN
      RETURN jsonb_build_object('eligible', (SELECT count(*) FROM site_marketing.eligible_contacts(c.ebook_id)));
    END IF;
    PERFORM site_marketing.require_version(c.version, (p_data->>'version')::integer);

    CASE p_operation
      WHEN 'editCampaign' THEN
        IF c.state <> 'draft' THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A campanha já foi ativada.';
        END IF;
        c.name := draft_name;
        c.subject := draft_subject;
        c.body := draft_body;
        c.ebook_id := target_ebook;
      WHEN 'testCampaign' THEN
        target_email := site_marketing.normalized_email(p_data->>'email');
        IF EXISTS (
          SELECT 1 FROM site_marketing.jobs j WHERE j.campaign_id = c.id AND j.kind = 'test'
            AND j.campaign_version = c.version AND j.email = target_email
            AND j.created_at >= current_timepoint - interval '1 minute'
        ) THEN
          RETURN jsonb_build_object('queued', true);
        END IF;
        IF (
          SELECT count(*) FROM site_marketing.jobs j WHERE j.campaign_id = c.id AND j.kind = 'test'
            AND j.created_at >= current_timepoint - interval '1 hour'
        ) >= 10 THEN
          RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'Limite de testes atingido. Tente mais tarde.';
        END IF;
        INSERT INTO site_marketing.jobs (kind, email, campaign_id, campaign_version, subject, body)
        VALUES ('test', target_email, c.id, c.version, c.subject, c.body);
        PERFORM site_marketing.audit(p_actor, p_operation, 'site_marketing_campaign', c.id, c.version);
        RETURN jsonb_build_object('queued', true);
      WHEN 'activateCampaign' THEN
        IF c.state <> 'draft' THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A campanha já foi ativada.';
        END IF;
        c.scheduled_at := (p_data->>'scheduledAt')::timestamptz;
        expected_audience := (p_data->>'expectedAudience')::integer;
        IF expected_audience IS NULL OR expected_audience NOT BETWEEN 1 AND 1000000
          OR (c.scheduled_at IS NOT NULL AND (
            NOT isfinite(c.scheduled_at) OR c.scheduled_at <= current_timepoint
            OR c.scheduled_at > current_timepoint + interval '366 days'
          )) THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A data de envio ou a previsão de público é inválida.';
        END IF;

        -- A contagem e a fila usam o mesmo snapshot. Divergências não geram escritas.
        WITH audience AS MATERIALIZED (
          SELECT e.id, e.email, e.name, e.consent_epoch
          FROM site_marketing.eligible_contacts(c.ebook_id) e LIMIT (expected_audience + 1)
        ), size AS (
          SELECT count(*)::integer AS total FROM audience
        ), enqueued AS (
          INSERT INTO site_marketing.jobs (
            kind, email, recipient_name, contact_id, consent_epoch, campaign_id, campaign_version, next_attempt_at
          )
          SELECT 'campaign', a.email, a.name, a.id, a.consent_epoch, c.id, c.version + 1,
            coalesce(c.scheduled_at, current_timepoint)
          FROM audience a CROSS JOIN size s WHERE s.total = expected_audience
        )
        SELECT s.total INTO recipients FROM size s;
        IF recipients <> expected_audience THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'O público da campanha mudou. Confira a contagem novamente.';
        END IF;
        c.audience_size := recipients;
        c.state := CASE WHEN c.scheduled_at IS NULL THEN 'sending' ELSE 'scheduled' END;
      WHEN 'pauseCampaign' THEN
        IF c.state NOT IN ('scheduled', 'sending') THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Esta campanha não pode ser pausada.';
        END IF;
        c.state := 'paused';
      WHEN 'resumeCampaign' THEN
        IF c.state <> 'paused' THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Esta campanha não pode ser retomada.';
        END IF;
        c.state := CASE WHEN c.scheduled_at > current_timepoint THEN 'scheduled' ELSE 'sending' END;
    END CASE;

    UPDATE site_marketing.campaigns SET
      name = c.name, subject = c.subject, body = c.body, ebook_id = c.ebook_id, state = c.state,
      scheduled_at = c.scheduled_at, audience_size = c.audience_size,
      version = version + 1, updated_at = clock_timestamp()
    WHERE id = target_id RETURNING * INTO c;
  END IF;

  PERFORM site_marketing.audit(p_actor, p_operation, 'site_marketing_campaign', c.id, c.version);
  RETURN jsonb_build_object('campaign', site_marketing.campaign_json(c));
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_marketing_admin(p_actor uuid, p_operation text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  allowed boolean := site_marketing.admin_allowed(p_actor);
  path text;
BEGIN
  IF p_operation = 'access' THEN
    RETURN jsonb_build_object('allowed', allowed);
  END IF;
  IF NOT allowed THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Acesso administrativo de marketing negado.';
  END IF;
  CASE
    WHEN p_operation = 'ebooks' THEN
      RETURN jsonb_build_object('ebooks', coalesce((
        SELECT jsonb_agg(site_marketing.ebook_json(e) ORDER BY e.updated_at DESC, e.id DESC)
        FROM site_marketing.ebooks e
      ), '[]'::jsonb));
    WHEN p_operation = 'ebookCover' THEN
      SELECT cover_path INTO path FROM site_marketing.ebooks WHERE id = (p_data->>'id')::uuid;
      IF path IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Capa do e-book não encontrada.';
      END IF;
      RETURN jsonb_build_object('path', path);
    WHEN p_operation IN ('createEbook', 'editEbook', 'attachEbook', 'publishEbook', 'unpublishEbook') THEN
      RETURN site_marketing.manage_ebook(p_actor, p_operation, p_data);
    WHEN p_operation = 'contacts' THEN
      RETURN site_marketing.contacts_page(p_data);
    WHEN p_operation = 'campaigns' THEN
      RETURN jsonb_build_object('campaigns', coalesce((
        SELECT jsonb_agg(site_marketing.campaign_json(c) ORDER BY c.created_at DESC, c.id DESC)
        FROM site_marketing.campaigns c
      ), '[]'::jsonb));
    WHEN p_operation IN ('createCampaign', 'editCampaign', 'audience', 'testCampaign',
      'activateCampaign', 'pauseCampaign', 'resumeCampaign') THEN
      RETURN site_marketing.manage_campaign(p_actor, p_operation, p_data);
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operação administrativa inválida.';
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.public_page(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $function$
DECLARE
  page integer := site_marketing.page_number(p_data);
  result jsonb;
BEGIN
  WITH entries AS (
    SELECT e.*, row_number() OVER (ORDER BY e.recorded_at DESC, e.slug) AS row_position
    FROM (
      SELECT site_marketing.public_ebook_json(e) AS ebook, e.published_at AS recorded_at, e.slug
      FROM site_marketing.ebooks e WHERE e.published_at IS NOT NULL
      ORDER BY e.published_at DESC, e.slug
      OFFSET ((page - 1) * 20) LIMIT 21
    ) e
  )
  SELECT jsonb_build_object(
    'ebooks', coalesce(jsonb_agg(ebook ORDER BY row_position) FILTER (WHERE row_position <= 20), '[]'::jsonb),
    'page', page, 'hasMore', count(*) > 20
  ) INTO result FROM entries;
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.take_capture_slot(
  p_now timestamptz, p_scope text, p_identity text, p_max integer
)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $function$
BEGIN
  INSERT INTO site_marketing.capture_limits AS l (period_start, scope, identity_hash, total)
  VALUES (date_trunc('hour', p_now, 'UTC'), p_scope, encode(sha256(convert_to(p_identity, 'UTF8')), 'hex'), 1)
  ON CONFLICT (period_start, scope, identity_hash) DO UPDATE SET total = l.total + 1
  WHERE l.total < p_max;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '54000', MESSAGE = 'Limite de solicitações atingido. Tente mais tarde.';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.capture(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  e site_marketing.ebooks%ROWTYPE;
  c site_marketing.contacts%ROWTYPE;
  request_id uuid;
  capture_email text := site_marketing.normalized_email(p_data->>'email');
  capture_name text := nullif(btrim(p_data->>'name'), '');
  source_key text := p_data->>'sourceKey';
  consenting boolean := (p_data->>'consent')::boolean;
  current_timepoint timestamptz := clock_timestamp();
BEGIN
  IF consenting IS NULL OR jsonb_typeof(p_data->'consent') <> 'boolean' OR char_length(capture_name) > 120
    OR coalesce(char_length(source_key), 0) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solicitação de e-book inválida.';
  END IF;

  SELECT * INTO e FROM site_marketing.ebooks WHERE slug = p_data->>'slug' AND published_at IS NOT NULL FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'E-book não encontrado.';
  END IF;

  PERFORM site_marketing.take_capture_slot(current_timepoint, 'source', source_key,
    CASE WHEN source_key LIKE 'site:%' THEN 300 ELSE 30 END);
  PERFORM site_marketing.take_capture_slot(current_timepoint, 'email', capture_email, 5);

  INSERT INTO site_marketing.contacts (email, name, last_request_at)
  VALUES (capture_email, capture_name, current_timepoint) ON CONFLICT (email) DO NOTHING;
  SELECT * INTO c FROM site_marketing.contacts WHERE email = capture_email FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM site_marketing.requests r
    WHERE r.contact_id = c.id AND r.ebook_id = e.id AND r.download_generation = e.download_generation
      AND r.wants_marketing = consenting AND r.consent_epoch = c.consent_epoch
      AND r.requested_at >= current_timepoint - interval '15 minutes'
  ) THEN
    RETURN jsonb_build_object('accepted', true);
  END IF;

  UPDATE site_marketing.contacts SET name = coalesce(capture_name, name),
    last_request_at = greatest(last_request_at, current_timepoint),
    marketing_status = CASE WHEN consenting AND marketing_status = 'not_subscribed' THEN 'pending' ELSE marketing_status END
  WHERE id = c.id;

  INSERT INTO site_marketing.requests (
    contact_id, ebook_id, ebook_title, download_generation, wants_marketing,
    consent_epoch, consent_notice_version, requested_at, expires_at
  )
  VALUES (c.id, e.id, e.published_title, e.download_generation, consenting,
    c.consent_epoch, CASE WHEN consenting THEN 1 END, current_timepoint, current_timepoint + interval '168 hours')
  RETURNING id INTO request_id;

  IF c.marketing_status <> 'suppressed' THEN
    INSERT INTO site_marketing.jobs (
      kind, request_id, contact_id, email, recipient_name, ebook_title, wants_marketing
    )
    VALUES ('delivery', request_id, c.id, c.email, coalesce(capture_name, c.name), e.published_title, consenting);
  END IF;
  RETURN jsonb_build_object('accepted', true);
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.request_link(p_operation text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  r site_marketing.requests%ROWTYPE;
  e site_marketing.ebooks%ROWTYPE;
  c site_marketing.contacts%ROWTYPE;
BEGIN
  SELECT * INTO r FROM site_marketing.requests
  WHERE id = (p_data->>'id')::uuid AND expires_at > clock_timestamp();
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Link inválido ou expirado.';
  END IF;
  SELECT * INTO e FROM site_marketing.ebooks
  WHERE id = r.ebook_id AND published_at IS NOT NULL AND download_generation = r.download_generation FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Link inválido ou expirado.';
  END IF;

  IF p_operation = 'download' THEN
    RETURN jsonb_build_object('path', e.published_pdf_path, 'filename', e.published_pdf_name);
  END IF;
  IF NOT r.wants_marketing THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Link inválido ou expirado.';
  END IF;

  SELECT * INTO c FROM site_marketing.contacts WHERE id = r.contact_id FOR UPDATE;
  IF NOT FOUND OR r.consent_epoch <> c.consent_epoch OR c.marketing_status = 'suppressed' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Link inválido ou expirado.';
  END IF;
  UPDATE site_marketing.requests SET confirmed_at = clock_timestamp() WHERE id = r.id AND confirmed_at IS NULL;
  IF FOUND THEN
    UPDATE site_marketing.contacts SET marketing_status = 'subscribed' WHERE id = c.id;
  END IF;
  RETURN jsonb_build_object('confirmed', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_marketing_public(p_operation text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  e site_marketing.ebooks%ROWTYPE;
BEGIN
  CASE
    WHEN p_operation = 'list' THEN
      RETURN site_marketing.public_page(p_data);
    WHEN p_operation IN ('get', 'cover') THEN
      SELECT * INTO e FROM site_marketing.ebooks WHERE slug = p_data->>'slug' AND published_at IS NOT NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'E-book não encontrado.';
      END IF;
      IF p_operation = 'cover' THEN
        RETURN jsonb_build_object('path', e.published_cover_path);
      END IF;
      RETURN jsonb_build_object('ebook', site_marketing.public_ebook_json(e));
    WHEN p_operation = 'capture' THEN
      RETURN site_marketing.capture(p_data);
    WHEN p_operation IN ('download', 'confirm') THEN
      RETURN site_marketing.request_link(p_operation, p_data);
    WHEN p_operation = 'unsubscribe' THEN
      UPDATE site_marketing.contacts SET marketing_status = 'unsubscribed', consent_epoch = consent_epoch + 1
      WHERE id = (p_data->>'id')::uuid AND marketing_status <> 'suppressed';
      RETURN jsonb_build_object('unsubscribed', true);
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operação pública inválida.';
  END CASE;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.complete_campaign(p_id uuid)
RETURNS void LANGUAGE sql SET search_path = '' AS $function$
  UPDATE site_marketing.campaigns c SET state = 'completed', updated_at = clock_timestamp()
  WHERE c.id = p_id AND c.state IN ('sending', 'scheduled', 'paused')
    AND NOT EXISTS (
      SELECT 1 FROM site_marketing.jobs j WHERE j.campaign_id = c.id AND j.kind = 'campaign'
        AND j.state IN ('pending', 'leased', 'sending')
    );
$function$;

CREATE OR REPLACE FUNCTION site_marketing.claim_jobs(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  channels jsonb := p_data->'channels';
  job_limit integer := (p_data->>'limit')::integer;
  lease_seconds integer := (p_data->>'leaseSeconds')::integer;
  current_timepoint timestamptz := clock_timestamp();
  result jsonb;
BEGIN
  IF jsonb_typeof(channels) IS DISTINCT FROM 'array' OR job_limit IS NULL OR job_limit NOT BETWEEN 1 AND 100
    OR lease_seconds IS NULL OR lease_seconds NOT BETWEEN 5 AND 900 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Parâmetros de fila inválidos.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(channels) AS ch(channel)
    WHERE ch.channel NOT IN ('"delivery"'::jsonb, '"campaign"'::jsonb)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Canal de envio inválido.';
  END IF;

  -- Reconciliar antes de bloquear jobs mantém a ordem campanha -> job em todo o worker.
  WITH finished AS (
    SELECT c.id FROM site_marketing.campaigns c
    WHERE c.state IN ('sending', 'scheduled', 'paused') AND NOT EXISTS (
      SELECT 1 FROM site_marketing.jobs j WHERE j.campaign_id = c.id AND j.kind = 'campaign'
        AND j.state IN ('pending', 'leased', 'sending')
    )
    ORDER BY c.id LIMIT 100 FOR UPDATE OF c SKIP LOCKED
  )
  UPDATE site_marketing.campaigns c SET state = 'completed', updated_at = current_timepoint
  FROM finished f WHERE c.id = f.id;

  WITH expired AS (
    SELECT j.id FROM site_marketing.jobs j
    WHERE j.state IN ('leased', 'sending') AND j.lease_until <= current_timepoint
    ORDER BY j.lease_until, j.id LIMIT 1000 FOR UPDATE OF j SKIP LOCKED
  )
  UPDATE site_marketing.jobs j SET
    state = CASE WHEN j.state = 'sending' THEN 'uncertain' ELSE 'pending' END,
    lease_token = NULL, lease_until = NULL
  FROM expired e WHERE j.id = e.id;

  WITH stale AS (
    SELECT l.period_start, l.scope, l.identity_hash FROM site_marketing.capture_limits l
    WHERE l.period_start < current_timepoint - interval '48 hours'
    ORDER BY l.period_start LIMIT 1000 FOR UPDATE OF l SKIP LOCKED
  )
  DELETE FROM site_marketing.capture_limits l USING stale s
  WHERE (l.period_start, l.scope, l.identity_hash) = (s.period_start, s.scope, s.identity_hash);

  WITH candidates AS (
    SELECT j.id FROM site_marketing.jobs j
    LEFT JOIN site_marketing.campaigns c ON c.id = j.campaign_id
    WHERE j.state = 'pending' AND j.next_attempt_at <= current_timepoint
      AND (
        (channels ? 'delivery' AND j.kind = 'delivery')
        OR (channels ? 'campaign' AND (j.kind = 'test' OR (j.kind = 'campaign' AND
          (c.state = 'sending' OR (c.state = 'scheduled' AND c.scheduled_at <= current_timepoint)))))
      )
    ORDER BY j.next_attempt_at, j.id LIMIT job_limit FOR UPDATE OF j SKIP LOCKED
  ), claimed AS (
    UPDATE site_marketing.jobs j SET state = 'leased', lease_token = gen_random_uuid(),
      lease_until = current_timepoint + lease_seconds * interval '1 second'
    FROM candidates c WHERE j.id = c.id RETURNING j.*
  )
  SELECT jsonb_build_object('jobs', coalesce(jsonb_agg(jsonb_build_object(
    'id', j.id, 'lease', j.lease_token, 'kind', j.kind, 'email', j.email, 'recipientName', j.recipient_name,
    'requestId', j.request_id, 'contactId', j.contact_id, 'ebookTitle', j.ebook_title,
    'wantsMarketing', j.wants_marketing, 'subject', coalesce(j.subject, c.subject),
    'body', coalesce(j.body, c.body), 'attempts', j.attempts + 1
  ) ORDER BY j.next_attempt_at, j.id), '[]'::jsonb))
  INTO result FROM claimed j
  LEFT JOIN site_marketing.campaigns c ON c.id = j.campaign_id AND j.kind = 'campaign';
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.authorize_job(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  target_id uuid := (p_data->>'id')::uuid;
  target_lease uuid := (p_data->>'lease')::uuid;
  j site_marketing.jobs%ROWTYPE;
  c site_marketing.campaigns%ROWTYPE;
  recipient site_marketing.contacts%ROWTYPE;
  source_valid boolean := true;
  current_timepoint timestamptz;
BEGIN
  SELECT * INTO j FROM site_marketing.jobs WHERE id = target_id AND state = 'leased' AND lease_token = target_lease;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  IF j.kind = 'campaign' THEN
    SELECT * INTO c FROM site_marketing.campaigns WHERE id = j.campaign_id FOR UPDATE;
  ELSIF j.kind = 'delivery' THEN
    PERFORM e.id FROM site_marketing.requests r
    JOIN site_marketing.ebooks e ON e.id = r.ebook_id AND e.download_generation = r.download_generation
    WHERE r.id = j.request_id AND r.expires_at > clock_timestamp() AND e.published_at IS NOT NULL
    FOR SHARE OF e;
    source_valid := FOUND;
  END IF;

  IF j.contact_id IS NOT NULL THEN
    SELECT * INTO recipient FROM site_marketing.contacts WHERE id = j.contact_id FOR SHARE;
  END IF;
  SELECT * INTO j FROM site_marketing.jobs WHERE id = target_id AND state = 'leased' AND lease_token = target_lease FOR UPDATE;
  current_timepoint := clock_timestamp();
  IF NOT FOUND OR j.lease_until <= current_timepoint THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  IF j.kind = 'campaign' AND NOT (
    c.state = 'sending' OR (c.state = 'scheduled' AND c.scheduled_at <= current_timepoint)
  ) THEN
    UPDATE site_marketing.jobs SET state = 'pending', lease_token = NULL, lease_until = NULL WHERE id = j.id;
    RETURN jsonb_build_object('allowed', false);
  END IF;

  IF (j.kind = 'campaign' AND (
    recipient.marketing_status <> 'subscribed' OR recipient.consent_epoch <> j.consent_epoch
  )) OR (j.kind = 'delivery' AND (NOT source_valid OR recipient.marketing_status = 'suppressed')) THEN
    UPDATE site_marketing.jobs SET state = 'skipped', lease_token = NULL, lease_until = NULL WHERE id = j.id;
    IF j.kind = 'campaign' THEN
      PERFORM site_marketing.complete_campaign(c.id);
    END IF;
    RETURN jsonb_build_object('allowed', false);
  END IF;

  UPDATE site_marketing.jobs SET state = 'sending', attempts = attempts + 1,
    authorized_at = current_timepoint
  WHERE id = j.id;
  IF j.kind = 'campaign' AND c.state = 'scheduled' THEN
    UPDATE site_marketing.campaigns SET state = 'sending', updated_at = current_timepoint WHERE id = c.id;
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.finish_job(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  target_id uuid := (p_data->>'id')::uuid;
  target_lease uuid := (p_data->>'lease')::uuid;
  next_state text := p_data->>'state';
  reason text := p_data->>'reason';
  next_attempt timestamptz := (p_data->>'nextAttemptAt')::timestamptz;
  j site_marketing.jobs%ROWTYPE;
  current_timepoint timestamptz := clock_timestamp();
BEGIN
  IF next_state IS NULL OR next_state NOT IN ('accepted', 'retry', 'failed', 'uncertain', 'skipped')
    OR (next_attempt IS NOT NULL AND NOT isfinite(next_attempt)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Desfecho de envio inválido.';
  END IF;

  SELECT * INTO j FROM site_marketing.jobs WHERE id = target_id AND lease_token = target_lease;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  IF j.kind = 'campaign' THEN
    PERFORM id FROM site_marketing.campaigns WHERE id = j.campaign_id FOR UPDATE;
  END IF;

  UPDATE site_marketing.jobs SET
    state = CASE WHEN next_state = 'retry' THEN 'pending' ELSE next_state END,
    accepted_at = CASE WHEN next_state = 'accepted' THEN coalesce(accepted_at, current_timepoint) ELSE accepted_at END,
    lease_token = NULL, lease_until = NULL,
    next_attempt_at = CASE WHEN next_state = 'retry'
      THEN coalesce(next_attempt, current_timepoint + interval '1 minute') ELSE next_attempt_at END,
    last_reason = CASE WHEN reason ~ '^[a-zA-Z0-9_.:-]{1,64}$' THEN reason ELSE NULL END
  WHERE id = j.id AND state IN ('leased', 'sending') AND lease_token = target_lease
    AND (state = 'sending' OR next_state IN ('retry', 'failed', 'skipped'));
  IF j.kind = 'campaign' THEN
    PERFORM site_marketing.complete_campaign(j.campaign_id);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION site_marketing.record_event(p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE
  target_event text := p_data->>'eventId';
  event_kind text := p_data->>'kind';
  target_job uuid := (p_data->>'jobId')::uuid;
  j site_marketing.jobs%ROWTYPE;
  current_timepoint timestamptz := clock_timestamp();
BEGIN
  IF event_kind IS NULL OR event_kind NOT IN ('delivered', 'bounce', 'complaint')
    OR NOT coalesce(target_event ~ '^[a-zA-Z0-9_.:-]{1,160}$', false) OR target_job IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Evento de entrega inválido.';
  END IF;

  SELECT * INTO j FROM site_marketing.jobs WHERE id = target_job AND authorized_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF j.kind = 'campaign' THEN
    PERFORM id FROM site_marketing.campaigns WHERE id = j.campaign_id FOR UPDATE;
  END IF;
  IF j.contact_id IS NOT NULL AND event_kind IN ('bounce', 'complaint') THEN
    PERFORM id FROM site_marketing.contacts WHERE id = j.contact_id FOR UPDATE;
  END IF;
  PERFORM id FROM site_marketing.jobs WHERE id = j.id FOR UPDATE;

  INSERT INTO site_marketing.provider_events (id, kind, job_id)
  VALUES (target_event, event_kind, target_job) ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF j.contact_id IS NOT NULL AND event_kind IN ('bounce', 'complaint') THEN
    UPDATE site_marketing.contacts SET marketing_status = 'suppressed', consent_epoch = consent_epoch + 1
    WHERE id = j.contact_id AND marketing_status <> 'suppressed';
  END IF;

  UPDATE site_marketing.jobs SET
    state = CASE WHEN event_kind = 'delivered' AND blocked_at IS NULL THEN 'accepted' ELSE 'failed' END,
    accepted_at = coalesce(accepted_at, current_timepoint),
    delivered_at = CASE WHEN event_kind = 'delivered' THEN coalesce(delivered_at, current_timepoint) ELSE delivered_at END,
    blocked_at = CASE WHEN event_kind IN ('bounce', 'complaint') THEN coalesce(blocked_at, current_timepoint) ELSE blocked_at END,
    lease_token = NULL, lease_until = NULL
  WHERE id = j.id;
  IF j.kind = 'campaign' THEN
    PERFORM site_marketing.complete_campaign(j.campaign_id);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.site_marketing_worker(p_operation text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  CASE p_operation
    WHEN 'claim' THEN RETURN site_marketing.claim_jobs(p_data);
    WHEN 'authorize' THEN RETURN site_marketing.authorize_job(p_data);
    WHEN 'finish' THEN RETURN site_marketing.finish_job(p_data);
    WHEN 'event' THEN RETURN site_marketing.record_event(p_data);
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operação de fila inválida.';
  END CASE;
END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA site_marketing FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION
  public.site_marketing_admin(uuid, text, jsonb),
  public.site_marketing_public(text, jsonb),
  public.site_marketing_worker(text, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.site_marketing_admin(uuid, text, jsonb),
  public.site_marketing_public(text, jsonb),
  public.site_marketing_worker(text, jsonb)
TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
