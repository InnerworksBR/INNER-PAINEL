-- Relatórios mensais: tabelas privadas; acesso mediado pela API.
CREATE TABLE IF NOT EXISTS monthly_glpi_report_settings (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  recipients text[] NOT NULL DEFAULT '{}',
  enabled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monthly_glpi_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'ready')),
  metrics jsonb,
  analysis text,
  recipient_snapshot text[],
  generated_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, period_start)
);

CREATE TABLE IF NOT EXISTS monthly_glpi_report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES monthly_glpi_reports(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'uncertain', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  sent_at timestamptz,
  UNIQUE (report_id, recipient)
);

ALTER TABLE monthly_glpi_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_glpi_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_glpi_report_deliveries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_monthly_glpi_report(p_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  UPDATE monthly_glpi_reports SET state = 'processing', lease_token = p_token,
    lease_until = now() + interval '30 minutes', attempts = attempts + 1
  WHERE id = p_id AND next_attempt_at <= now()
    AND (state IN ('pending', 'ready') OR (state = 'processing' AND lease_until < now()));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;
REVOKE ALL ON FUNCTION claim_monthly_glpi_report(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_monthly_glpi_report(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION claim_monthly_glpi_delivery(p_id uuid, p_report_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  UPDATE monthly_glpi_report_deliveries d SET state = 'sending', attempts = attempts + 1
  WHERE d.id = p_id AND d.report_id = p_report_id AND d.state = 'pending' AND d.next_attempt_at <= now()
    AND EXISTS (SELECT 1 FROM monthly_glpi_reports r WHERE r.id = p_report_id
      AND r.lease_token = p_token AND r.lease_until > now() AND r.state = 'processing'
      AND EXISTS (SELECT 1 FROM monthly_glpi_report_settings s WHERE s.company_id = r.company_id
        AND s.enabled AND d.recipient = ANY(s.recipients)));
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END $$;
REVOKE ALL ON FUNCTION claim_monthly_glpi_delivery(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_monthly_glpi_delivery(uuid, uuid, uuid) TO service_role;

GRANT ALL ON monthly_glpi_report_settings, monthly_glpi_reports, monthly_glpi_report_deliveries TO service_role;
NOTIFY pgrst, 'reload schema';
