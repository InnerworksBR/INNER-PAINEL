BEGIN;

DO $$
DECLARE
  actor text := '11111111-1111-4111-8111-111111111111';
  pending jsonb;
  connection jsonb;
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.site_marketing_microsoft_mail(text, jsonb)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.site_marketing_microsoft_mail(text, jsonb)', 'EXECUTE');
  ASSERT has_function_privilege('service_role', 'public.site_marketing_microsoft_mail(text, jsonb)', 'EXECUTE');
  PERFORM public.site_marketing_microsoft_mail('disconnect', '{}');
  UPDATE site_marketing.microsoft_mail SET next_send_at = '-infinity' WHERE singleton;

  PERFORM public.site_marketing_microsoft_mail('begin', jsonb_build_object(
    'actor', actor, 'mailbox', 'marketing@example.test', 'stateHash', 'test-state', 'verifier', 'test-verifier'
  ));
  ASSERT public.site_marketing_microsoft_mail('take', jsonb_build_object(
    'actor', '22222222-2222-4222-8222-222222222222', 'stateHash', 'test-state'
  )) IS NULL;
  pending := public.site_marketing_microsoft_mail('take', jsonb_build_object('actor', actor, 'stateHash', 'test-state'));
  ASSERT pending->>'mailbox' = 'marketing@example.test' AND pending->>'verifier' = 'test-verifier';
  ASSERT public.site_marketing_microsoft_mail('take', jsonb_build_object('actor', actor, 'stateHash', 'test-state')) IS NULL;
  ASSERT public.site_marketing_microsoft_mail('connect', pending || '{"encryptedGrant":"first-grant"}') = 'true'::jsonb;
  ASSERT public.site_marketing_microsoft_mail('connect', pending || '{"encryptedGrant":"duplicate"}') = 'false'::jsonb;

  ASSERT public.site_marketing_microsoft_mail('status', '{}') = '{"mailbox":"marketing@example.test","connected":true}'::jsonb;
  connection := public.site_marketing_microsoft_mail('credentials', '{}');
  ASSERT connection->>'encryptedGrant' = 'first-grant';
  ASSERT public.site_marketing_microsoft_mail('reserve', connection) = 'true'::jsonb;
  ASSERT public.site_marketing_microsoft_mail('reserve', connection) = 'false'::jsonb;
  ASSERT public.site_marketing_microsoft_mail('credentials', '{}') IS NULL;

  ASSERT public.site_marketing_microsoft_mail('renew', connection || '{"encryptedGrant":"refreshed","previous":"first-grant"}') = 'true'::jsonb;
  ASSERT public.site_marketing_microsoft_mail('invalidate', connection) = 'false'::jsonb;
  ASSERT public.site_marketing_microsoft_mail('status', '{}')->>'connected' = 'true';
  ASSERT public.site_marketing_microsoft_mail('invalidate', connection || '{"encryptedGrant":"refreshed"}') = 'true'::jsonb;
  ASSERT public.site_marketing_microsoft_mail('status', '{}')->>'connected' = 'false';
END;
$$;

ROLLBACK;
