-- migration_005.sql
-- Inventário técnico de ativos exibíveis ao cliente.

CREATE TABLE IF NOT EXISTS asset_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('server', 'network_device')),
  source_id UUID NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'outro',
  display_name TEXT,
  customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  operating_system TEXT,
  operating_system_version TEXT,
  firmware_version TEXT,
  physical_or_virtual TEXT,
  business_purpose TEXT,
  technical_purpose TEXT,
  environment TEXT,
  criticality TEXT,
  location TEXT,
  notes_for_customer TEXT,
  auto_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  manual_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  manual_override_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_synced_at TIMESTAMP WITH TIME ZONE,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT asset_profiles_source_unique UNIQUE (company_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS asset_profiles_company_idx
  ON asset_profiles (company_id);

CREATE INDEX IF NOT EXISTS asset_profiles_source_idx
  ON asset_profiles (source_type, source_id);

CREATE INDEX IF NOT EXISTS asset_profiles_company_visibility_idx
  ON asset_profiles (company_id, customer_visible);

ALTER TABLE asset_profiles ENABLE ROW LEVEL SECURITY;

INSERT INTO asset_profiles (
  company_id,
  source_type,
  source_id,
  asset_type,
  display_name,
  customer_visible,
  auto_data,
  last_synced_at
)
SELECT
  company_id,
  'server',
  id,
  'servidor',
  hostname,
  FALSE,
  jsonb_build_object(
    'hostname', hostname,
    'cpu_usage', cpu_usage,
    'memory_usage', memory_usage,
    'disk_usage', disk_usage,
    'memory_total', memory_total,
    'disk_total', disk_total,
    'status', status,
    'zabbix_host_id', zabbix_host_id
  ),
  last_updated
FROM servers
ON CONFLICT (company_id, source_type, source_id) DO NOTHING;

INSERT INTO asset_profiles (
  company_id,
  source_type,
  source_id,
  asset_type,
  display_name,
  customer_visible,
  location,
  auto_data,
  last_synced_at
)
SELECT
  company_id,
  'network_device',
  id,
  CASE
    WHEN lower(device_type) LIKE '%switch%' THEN 'switch'
    WHEN lower(device_type) LIKE '%router%' THEN 'roteador'
    WHEN lower(device_type) LIKE '%firewall%' THEN 'firewall'
    WHEN lower(device_type) LIKE '%access point%' THEN 'access_point'
    ELSE 'outro'
  END,
  device_name,
  FALSE,
  location,
  jsonb_build_object(
    'device_name', device_name,
    'device_type', device_type,
    'ip_address', ip_address,
    'status', status
  ),
  last_updated
FROM network_devices
ON CONFLICT (company_id, source_type, source_id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'asset_profiles'
      AND policyname = 'Admins can do everything on asset profiles'
  ) THEN
    CREATE POLICY "Admins can do everything on asset profiles" ON asset_profiles FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'asset_profiles'
      AND policyname = 'Clients view own visible asset profiles'
  ) THEN
    CREATE POLICY "Clients view own visible asset profiles" ON asset_profiles FOR SELECT USING (
      customer_visible = TRUE
      AND company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;
