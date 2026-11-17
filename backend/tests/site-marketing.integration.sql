\set ON_ERROR_STOP on
BEGIN;

DO $test$
BEGIN
  IF to_regprocedure('public.site_marketing_admin(uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'A migração precisa disponibilizar os RPCs de marketing';
  END IF;
  IF has_schema_privilege('anon', 'site_marketing', 'USAGE')
    OR has_schema_privilege('authenticated', 'site_marketing', 'USAGE')
    OR has_function_privilege('anon', 'public.site_marketing_public(text,jsonb)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.site_marketing_worker(text,jsonb)', 'EXECUTE')
    OR has_table_privilege('service_role', 'site_marketing.jobs', 'SELECT') THEN
    RAISE EXCEPTION 'O schema privado ou seus RPCs têm grants indevidos';
  END IF;
END;
$test$;

INSERT INTO auth.users (id, email) VALUES
  ('1aa4ce9a-1fa7-4479-85f2-8ea68a1a8303', 'marketing-admin@example.test'),
  ('d7b1781c-6d18-4b4b-8685-91d473828f3c', 'marketing-client@example.test');

INSERT INTO public.profiles (id, role, status) VALUES
  ('1aa4ce9a-1fa7-4479-85f2-8ea68a1a8303', 'admin', 'active'),
  ('d7b1781c-6d18-4b4b-8685-91d473828f3c', 'client', 'active')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- A integração HTTP usa os arquivos reais. Este teste simula apenas o registro do Storage.
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('site-marketing', 'cover/01b2815f-a402-44b0-b243-f7f8f27cc76b.webp'),
  ('site-marketing', 'pdf/87368971-7b6d-499f-90c0-76ceadf1db01.pdf'),
  ('site-marketing', 'pdf/87568971-7b6d-499f-90c0-76ceadf1db01.pdf'),
  ('site-marketing', 'cover/f26060a9-740b-4d33-935c-741f1dbb369f.webp'),
  ('site-marketing', 'pdf/3f213e9a-9566-4614-8c40-02d113c9b0b7.pdf');

SET LOCAL ROLE service_role;
DO $test$
DECLARE
  admin_id constant uuid := '1aa4ce9a-1fa7-4479-85f2-8ea68a1a8303';
  client_id constant uuid := 'd7b1781c-6d18-4b4b-8685-91d473828f3c';
  cover_path constant text := 'cover/01b2815f-a402-44b0-b243-f7f8f27cc76b.webp';
  file_path constant text := 'pdf/87368971-7b6d-499f-90c0-76ceadf1db01.pdf';
  next_file_path constant text := 'pdf/87568971-7b6d-499f-90c0-76ceadf1db01.pdf';
  ebook jsonb;
  ebook_id uuid;
  slug text;
  campaign jsonb;
  campaign_id uuid;
  capture jsonb;
  job jsonb;
  lease_data jsonb;
  request_data jsonb;
  contact_data jsonb;
  second_request_data jsonb;
  event_data jsonb;
BEGIN
  BEGIN
    PERFORM public.site_marketing_admin(client_id, 'ebooks', '{}');
    RAISE EXCEPTION 'Um cliente leu dados da área administrativa';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  ebook := public.site_marketing_admin(admin_id, 'createEbook', '{"title":"Gestão de TI","description":"Primeira edição."}') -> 'ebook';
  ebook_id := (ebook->>'id')::uuid;
  IF ebook->>'status' IS DISTINCT FROM 'draft'
    OR (public.site_marketing_public('list', '{"page":1}') -> 'ebooks') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Um rascunho criou dados públicos';
  END IF;

  BEGIN
    PERFORM public.site_marketing_admin(admin_id, 'publishEbook', jsonb_build_object('id', ebook_id, 'version', ebook->'version'));
    RAISE EXCEPTION 'Publicação sem PDF e capa foi aceita';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;

  ebook := public.site_marketing_admin(admin_id, 'attachEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version', 'kind', 'cover', 'path', cover_path)) -> 'ebook';
  ebook := public.site_marketing_admin(admin_id, 'attachEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version', 'kind', 'pdf', 'path', file_path, 'filename', 'guia.pdf')) -> 'ebook';
  ebook := public.site_marketing_admin(admin_id, 'publishEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version')) -> 'ebook';
  slug := ebook->>'slug';
  IF (public.site_marketing_public('cover', jsonb_build_object('slug', slug))->>'path') IS DISTINCT FROM cover_path
    OR (public.site_marketing_public('get', jsonb_build_object('slug', slug))->'ebook'->>'title') IS DISTINCT FROM 'Gestão de TI' THEN
    RAISE EXCEPTION 'A publicação não apareceu com a sua capa';
  END IF;

  capture := jsonb_build_object('slug', slug, 'email', ' MARKETING-LEAD@example.test ',
    'name', 'Contato de teste', 'consent', true, 'sourceKey', 'fixture');
  PERFORM public.site_marketing_public('capture', capture);
  PERFORM public.site_marketing_public('capture', capture);
  SELECT jobs->0 INTO job FROM (SELECT public.site_marketing_worker(
    'claim', '{"channels":["delivery"],"limit":10,"leaseSeconds":60}') -> 'jobs' AS jobs) q
  WHERE jsonb_array_length(jobs) = 1;

  IF job->>'email' IS DISTINCT FROM 'marketing-lead@example.test'
    OR job->>'wantsMarketing' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'A captura não normalizou o endereço ou criou duplicidade';
  END IF;

  request_data := jsonb_build_object('id', job->'requestId');
  contact_data := jsonb_build_object('id', job->'contactId');
  lease_data := jsonb_build_object('id', job->'id', 'lease', job->'lease');
  PERFORM public.site_marketing_worker('authorize', lease_data);
  PERFORM public.site_marketing_worker('finish', lease_data || '{"state":"accepted"}');
  IF public.site_marketing_public('download', request_data)->>'path' IS DISTINCT FROM file_path
    OR public.site_marketing_admin(admin_id, 'contacts', '{"page":1}')->'contacts'->0->>'marketingStatus' IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'O download ou o consentimento pendente ficou indisponível';
  END IF;
  IF jsonb_array_length(public.site_marketing_admin(admin_id, 'contacts', jsonb_build_object(
      'ebookId', ebook_id, 'from', (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date,
      'to', (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date))->'contacts') <> 1
    OR jsonb_array_length(public.site_marketing_admin(admin_id, 'contacts', jsonb_build_object(
      'ebookId', ebook_id, 'to', '2000-01-01'))->'contacts') <> 0 THEN
    RAISE EXCEPTION 'O filtro de data não encontrou os pedidos do período correto';
  END IF;
  PERFORM public.site_marketing_public('confirm', request_data);

  campaign := public.site_marketing_admin(admin_id, 'createCampaign', jsonb_build_object(
    'name', 'Campanha', 'subject', 'Assunto', 'body', 'Mensagem', 'ebookId', ebook_id)) -> 'campaign';
  campaign_id := (campaign->>'id')::uuid;
  IF public.site_marketing_admin(admin_id, 'audience', jsonb_build_object('id', campaign_id))->>'eligible' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'O consentimento confirmado não apareceu no público';
  END IF;

  BEGIN
    PERFORM public.site_marketing_admin(admin_id, 'activateCampaign', jsonb_build_object(
      'id', campaign_id, 'version', campaign->'version', 'expectedAudience', 2));
    RAISE EXCEPTION 'Uma contagem desatualizada ativou a campanha';
  EXCEPTION WHEN serialization_failure THEN
    NULL;
  END;
  campaign := public.site_marketing_admin(admin_id, 'activateCampaign', jsonb_build_object(
    'id', campaign_id, 'version', campaign->'version', 'expectedAudience', 1)) -> 'campaign';
  job := public.site_marketing_worker('claim', '{"channels":["campaign"],"limit":10,"leaseSeconds":60}')->'jobs'->0;
  lease_data := jsonb_build_object('id', job->'id', 'lease', job->'lease');
  campaign := public.site_marketing_admin(admin_id, 'pauseCampaign', jsonb_build_object(
    'id', campaign_id, 'version', campaign->'version')) -> 'campaign';
  IF public.site_marketing_worker('authorize', lease_data)->>'allowed' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'Um envio prosseguiu após a pausa';
  END IF;
  campaign := public.site_marketing_admin(admin_id, 'resumeCampaign', jsonb_build_object(
    'id', campaign_id, 'version', campaign->'version')) -> 'campaign';
  job := public.site_marketing_worker('claim', '{"channels":["campaign"],"limit":10,"leaseSeconds":60}')->'jobs'->0;
  lease_data := jsonb_build_object('id', job->'id', 'lease', job->'lease');
  IF public.site_marketing_worker('authorize', lease_data)->>'allowed' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'A retomada não liberou o envio';
  END IF;
  event_data := jsonb_build_object('eventId', gen_random_uuid(), 'kind', 'delivered', 'jobId', job->'id');
  PERFORM public.site_marketing_worker('event', event_data);
  PERFORM public.site_marketing_worker('event', event_data);
  PERFORM public.site_marketing_worker('finish', lease_data || '{"state":"accepted"}');
  campaign := public.site_marketing_admin(admin_id, 'campaigns', '{}')->'campaigns'->0;
  IF campaign->>'state' IS DISTINCT FROM 'completed' OR campaign->>'delivered' IS DISTINCT FROM '1'
    OR campaign->>'accepted' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'O evento antecipado ou repetido alterou indevidamente a contagem';
  END IF;

  campaign := public.site_marketing_admin(admin_id, 'createCampaign', jsonb_build_object(
    'name', 'Agendamento', 'subject', 'Assunto futuro', 'body', 'Mensagem futura', 'ebookId', ebook_id)) -> 'campaign';
  campaign_id := (campaign->>'id')::uuid;
  campaign := public.site_marketing_admin(admin_id, 'activateCampaign', jsonb_build_object(
    'id', campaign_id, 'version', campaign->'version', 'expectedAudience', 1,
    'scheduledAt', clock_timestamp() + interval '1 hour')) -> 'campaign';
  IF campaign->>'state' IS DISTINCT FROM 'scheduled'
    OR public.site_marketing_worker('claim', '{"channels":["campaign"],"limit":10,"leaseSeconds":60}')->'jobs' <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Uma campanha agendada entrou na fila antes do horário';
  END IF;
  campaign := public.site_marketing_admin(admin_id, 'pauseCampaign', jsonb_build_object(
    'id', campaign_id, 'version', campaign->'version')) -> 'campaign';
  campaign := public.site_marketing_admin(admin_id, 'resumeCampaign', jsonb_build_object(
    'id', campaign_id, 'version', campaign->'version')) -> 'campaign';
  IF campaign->>'state' IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'A retomada de uma campanha futura adiantou a data';
  END IF;

  campaign := public.site_marketing_admin(admin_id, 'createCampaign', jsonb_build_object(
    'name', 'Descadastro', 'subject', 'Assunto', 'body', 'Mensagem', 'ebookId', ebook_id)) -> 'campaign';
  campaign_id := (campaign->>'id')::uuid;
  campaign := public.site_marketing_admin(admin_id, 'activateCampaign', jsonb_build_object(
    'id', campaign_id, 'version', campaign->'version', 'expectedAudience', 1)) -> 'campaign';
  job := public.site_marketing_worker('claim', '{"channels":["campaign"],"limit":10,"leaseSeconds":60}')->'jobs'->0;
  IF job->>'subject' IS DISTINCT FROM 'Assunto' OR job->>'body' IS DISTINCT FROM 'Mensagem' THEN
    RAISE EXCEPTION 'O job não carregou a mensagem congelada da campanha';
  END IF;
  lease_data := jsonb_build_object('id', job->'id', 'lease', job->'lease');

  PERFORM public.site_marketing_public('unsubscribe', contact_data);
  IF public.site_marketing_worker('authorize', lease_data)->>'allowed' IS DISTINCT FROM 'false'
    OR public.site_marketing_admin(admin_id, 'campaigns', '{}')->'campaigns'->0->>'skipped' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'O descadastro não bloqueou a campanha já enfileirada';
  END IF;
  BEGIN
    PERFORM public.site_marketing_public('confirm', request_data);
    RAISE EXCEPTION 'Um link revogado retornou uma confirmação';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;
  IF public.site_marketing_admin(admin_id, 'contacts', '{"page":1}')->'contacts'->0->>'marketingStatus'
    IS DISTINCT FROM 'unsubscribed' THEN
    RAISE EXCEPTION 'Um link antigo reativou o consentimento';
  END IF;

  ebook := public.site_marketing_admin(admin_id, 'editEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version', 'title', 'Gestão de TI', 'description', 'Segunda edição.')) -> 'ebook';
  IF public.site_marketing_public('get', jsonb_build_object('slug', slug))->'ebook'->>'description' IS DISTINCT FROM 'Primeira edição.' THEN
    RAISE EXCEPTION 'A alteração do rascunho modificou a descrição pública';
  END IF;
  ebook := public.site_marketing_admin(admin_id, 'publishEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version')) -> 'ebook';
  IF public.site_marketing_public('download', request_data)->>'path' IS DISTINCT FROM file_path THEN
    RAISE EXCEPTION 'Uma alteração que manteve o PDF invalidou o download';
  END IF;

  ebook := public.site_marketing_admin(admin_id, 'attachEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version', 'kind', 'pdf', 'path', next_file_path, 'filename', 'novo.pdf')) -> 'ebook';
  IF public.site_marketing_public('download', request_data)->>'path' IS DISTINCT FROM file_path
    OR ebook->>'hasDraftChanges' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'O rascunho substituiu o PDF publicado';
  END IF;
  ebook := public.site_marketing_admin(admin_id, 'publishEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version')) -> 'ebook';
  BEGIN
    PERFORM public.site_marketing_public('download', request_data);
    RAISE EXCEPTION 'A troca de PDF não revogou o download anterior';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;

  PERFORM public.site_marketing_public('capture', capture || '{"consent":false}');
  job := public.site_marketing_worker('claim', '{"channels":["delivery"],"limit":10,"leaseSeconds":60}')->'jobs'->0;
  second_request_data := jsonb_build_object('id', job->'requestId');
  IF public.site_marketing_public('download', second_request_data)->>'path' IS DISTINCT FROM next_file_path
    OR job->>'wantsMarketing' IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'O material não foi liberado sem consentimento de marketing';
  END IF;
  BEGIN
    PERFORM public.site_marketing_public('confirm', second_request_data);
    RAISE EXCEPTION 'A confirmação de pedido sem consentimento foi aceita';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;
  PERFORM public.site_marketing_admin(admin_id, 'unpublishEbook', jsonb_build_object('id', ebook_id, 'version', ebook->'version'));
  BEGIN
    PERFORM public.site_marketing_public('download', second_request_data);
    RAISE EXCEPTION 'O download continuou ativo após a retirada';
  EXCEPTION WHEN no_data_found THEN
    NULL;
  END;

  ebook := public.site_marketing_admin(admin_id, 'createEbook', '{"title":"Confirm","description":"Rota reservada."}') -> 'ebook';
  ebook_id := (ebook->>'id')::uuid;
  BEGIN
    PERFORM public.site_marketing_admin(admin_id, 'attachEbook', jsonb_build_object(
      'id', ebook_id, 'version', ebook->'version', 'kind', 'cover', 'path', cover_path));
    RAISE EXCEPTION 'Um arquivo privado foi vinculado a dois e-books';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  ebook := public.site_marketing_admin(admin_id, 'attachEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version', 'kind', 'cover', 'path',
    'cover/f26060a9-740b-4d33-935c-741f1dbb369f.webp')) -> 'ebook';
  ebook := public.site_marketing_admin(admin_id, 'attachEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version', 'kind', 'pdf', 'path',
    'pdf/3f213e9a-9566-4614-8c40-02d113c9b0b7.pdf', 'filename', 'exemplo.pdf')) -> 'ebook';
  ebook := public.site_marketing_admin(admin_id, 'publishEbook', jsonb_build_object(
    'id', ebook_id, 'version', ebook->'version')) -> 'ebook';
  IF ebook->>'slug' IS DISTINCT FROM 'confirm-ebook' THEN
    RAISE EXCEPTION 'O slug do e-book colide com a rota de confirmação';
  END IF;
END;
$test$;

RESET ROLE;
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.admin_audit_logs WHERE admin_user_id = '1aa4ce9a-1fa7-4479-85f2-8ea68a1a8303') < 4
    OR EXISTS (SELECT 1 FROM public.admin_audit_logs WHERE admin_user_id = '1aa4ce9a-1fa7-4479-85f2-8ea68a1a8303'
      AND (admin_email IS NOT NULL OR ip_address IS NOT NULL OR user_agent IS NOT NULL
        OR summary LIKE '%@%' OR metadata::text LIKE '%@%')) THEN
    RAISE EXCEPTION 'A auditoria administrativa está ausente ou contém dados de contato';
  END IF;
END;
$test$;

ROLLBACK;
