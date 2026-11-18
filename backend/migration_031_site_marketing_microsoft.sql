BEGIN;

CREATE TABLE IF NOT EXISTS site_marketing.microsoft_mail (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  pending_id uuid,
  pending_actor uuid,
  pending_state_hash text,
  pending_verifier text,
  pending_mailbox text,
  pending_expires_at timestamptz,
  connection_id uuid,
  mailbox text,
  encrypted_grant text,
  next_send_at timestamptz NOT NULL DEFAULT '-infinity'
);

INSERT INTO site_marketing.microsoft_mail (singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE site_marketing.microsoft_mail ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE site_marketing.microsoft_mail FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.site_marketing_microsoft_mail(p_operation text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  result jsonb;
  current_time_at_call timestamptz := clock_timestamp();
BEGIN
  CASE p_operation
    WHEN 'status' THEN
      SELECT jsonb_build_object('connected', encrypted_grant IS NOT NULL, 'mailbox', mailbox)
      INTO result FROM site_marketing.microsoft_mail;
      RETURN result;
    WHEN 'credentials' THEN
      SELECT jsonb_build_object('id', connection_id, 'mailbox', mailbox, 'encryptedGrant', encrypted_grant)
      INTO result FROM site_marketing.microsoft_mail
      WHERE encrypted_grant IS NOT NULL AND next_send_at <= current_time_at_call;
      RETURN result;
    WHEN 'begin' THEN
      UPDATE site_marketing.microsoft_mail SET
        pending_id = gen_random_uuid(),
        pending_actor = (p_data->>'actor')::uuid,
        pending_state_hash = p_data->>'stateHash',
        pending_verifier = p_data->>'verifier',
        pending_mailbox = p_data->>'mailbox',
        pending_expires_at = current_time_at_call + interval '10 minutes'
      WHERE singleton;
    WHEN 'take' THEN
      UPDATE site_marketing.microsoft_mail SET pending_state_hash = NULL
      WHERE pending_actor = (p_data->>'actor')::uuid
        AND pending_state_hash = p_data->>'stateHash' AND pending_expires_at > current_time_at_call
      RETURNING jsonb_build_object('id', pending_id, 'mailbox', pending_mailbox, 'verifier', pending_verifier) INTO result;
      RETURN result;
    WHEN 'connect' THEN
      UPDATE site_marketing.microsoft_mail SET
        connection_id = gen_random_uuid(), mailbox = pending_mailbox, encrypted_grant = p_data->>'encryptedGrant',
        pending_id = NULL, pending_actor = NULL, pending_verifier = NULL, pending_mailbox = NULL, pending_expires_at = NULL
      WHERE pending_id = (p_data->>'id')::uuid AND pending_state_hash IS NULL
        AND pending_mailbox = p_data->>'mailbox' AND pending_expires_at > current_time_at_call;
    WHEN 'renew' THEN
      UPDATE site_marketing.microsoft_mail SET encrypted_grant = p_data->>'encryptedGrant'
      WHERE connection_id = (p_data->>'id')::uuid AND encrypted_grant = p_data->>'previous';
    WHEN 'invalidate' THEN
      UPDATE site_marketing.microsoft_mail SET encrypted_grant = NULL
      WHERE connection_id = (p_data->>'id')::uuid AND encrypted_grant = p_data->>'encryptedGrant';
    WHEN 'disconnect' THEN
      UPDATE site_marketing.microsoft_mail SET
        connection_id = NULL, mailbox = NULL, encrypted_grant = NULL,
        pending_id = NULL, pending_actor = NULL, pending_state_hash = NULL,
        pending_verifier = NULL, pending_mailbox = NULL, pending_expires_at = NULL
      WHERE singleton;
    WHEN 'reserve' THEN
      UPDATE site_marketing.microsoft_mail SET next_send_at = current_time_at_call + interval '2.1 seconds'
      WHERE connection_id = (p_data->>'id')::uuid AND encrypted_grant IS NOT NULL
        AND next_send_at <= current_time_at_call;
    WHEN 'defer' THEN
      UPDATE site_marketing.microsoft_mail SET
        next_send_at = greatest(next_send_at, current_time_at_call + make_interval(secs => (p_data->>'seconds')::integer))
      WHERE connection_id = (p_data->>'id')::uuid AND encrypted_grant IS NOT NULL;
    ELSE
      RAISE EXCEPTION 'Invalid Microsoft mail operation' USING ERRCODE = '22023';
  END CASE;
  RETURN to_jsonb(FOUND);
END;
$$;

REVOKE ALL ON FUNCTION public.site_marketing_microsoft_mail(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_marketing_microsoft_mail(text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
