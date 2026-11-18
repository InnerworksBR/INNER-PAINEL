-- Prévia persistida e separada do relatório mensal definitivo.
CREATE TABLE IF NOT EXISTS glpi_report_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'generating', 'ready')),
  metrics jsonb,
  analysis text,
  generated_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state <> 'ready' OR (metrics IS NOT NULL AND analysis IS NOT NULL AND length(trim(analysis)) > 0 AND generated_at IS NOT NULL)),
  UNIQUE (company_id, period_start)
);

ALTER TABLE glpi_report_previews ENABLE ROW LEVEL SECURITY;
GRANT ALL ON glpi_report_previews TO service_role;

CREATE OR REPLACE FUNCTION claim_glpi_report_preview(p_company_id uuid, p_period_start date, p_token uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed_id uuid; existing_state text; retry_at timestamptz; existing_lease_until timestamptz;
BEGIN
  INSERT INTO glpi_report_previews (company_id, period_start, state, lease_token, lease_until)
  VALUES (p_company_id, p_period_start, 'generating', p_token, clock_timestamp() + interval '30 minutes')
  ON CONFLICT (company_id, period_start) DO UPDATE
    SET state = 'generating', lease_token = EXCLUDED.lease_token, lease_until = EXCLUDED.lease_until
    WHERE glpi_report_previews.state <> 'ready'
      AND (glpi_report_previews.lease_until IS NULL OR glpi_report_previews.lease_until < clock_timestamp())
      AND glpi_report_previews.next_attempt_at <= clock_timestamp()
  RETURNING id INTO claimed_id;
  IF claimed_id IS NOT NULL THEN RETURN 'claimed'; END IF;
  SELECT state, next_attempt_at, lease_until INTO existing_state, retry_at, existing_lease_until FROM glpi_report_previews
    WHERE company_id = p_company_id AND period_start = p_period_start;
  IF existing_state = 'ready' THEN RETURN 'ready'; END IF;
  IF existing_state = 'generating' AND existing_lease_until > clock_timestamp() THEN RETURN 'busy'; END IF;
  IF retry_at > clock_timestamp() THEN RETURN 'cooldown'; END IF;
  RETURN 'busy';
END $$;
REVOKE ALL ON FUNCTION claim_glpi_report_preview(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_glpi_report_preview(uuid, date, uuid) TO service_role;

CREATE OR REPLACE FUNCTION fail_glpi_report_preview(p_company_id uuid, p_period_start date, p_token uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE glpi_report_previews SET state = 'pending', lease_token = NULL, lease_until = NULL,
    next_attempt_at = clock_timestamp() + make_interval(secs => LEAST(3600, 60 * power(2, LEAST(attempts, 6))::integer)),
    attempts = attempts + 1
  WHERE company_id = p_company_id AND period_start = p_period_start AND state = 'generating' AND lease_token = p_token;
END $$;
REVOKE ALL ON FUNCTION fail_glpi_report_preview(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION fail_glpi_report_preview(uuid, date, uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
