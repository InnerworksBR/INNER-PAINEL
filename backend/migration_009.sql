-- migration_009.sql
-- Aba de Segurança: relatórios de análise de risco por empresa

CREATE TABLE IF NOT EXISTS security_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('zero_trust', 'simplified')),
  title       TEXT NOT NULL DEFAULT '',
  file_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, report_type)
);

ALTER TABLE security_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_security_all" ON security_reports
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "clients_security_select" ON security_reports
  FOR SELECT
  USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
