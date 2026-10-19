-- TESTS ONLY: minimal legacy-schema stand-in for the isolated PostgreSQL regression harness.
-- This is neither a production schema nor a complete Supabase emulator.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL);
CREATE TABLE registered_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  agent_type text NOT NULL DEFAULT 'endpoint', agent_kind text NOT NULL DEFAULT 'hyperv',
  asset_key text, agent_secret text, refresh_token_hash text, machine_id text, hostname text NOT NULL DEFAULT '',
  version text, agent_version text, os_version text, status text NOT NULL DEFAULT 'Online',
  last_heartbeat timestamptz, last_error text, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE network_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  device_name text NOT NULL, device_type text NOT NULL DEFAULT 'Outro', location text, ip_address text,
  status text NOT NULL DEFAULT 'Online', uptime_percent double precision,
  updated_at timestamptz NOT NULL DEFAULT now(), last_updated timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE network_status_history (
  id bigserial PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), network_device_id uuid,
  device_name text, device_type text, ip_address text, status text, collected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE asset_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  source_type text NOT NULL, source_id uuid NOT NULL, asset_type text, display_name text,
  manufacturer text, model text, serial_number text, firmware_version text, location text,
  operating_system text, operating_system_version text, physical_or_virtual text,
  business_purpose text, technical_purpose text, environment text, criticality text,
  notes_for_customer text, auto_data jsonb NOT NULL DEFAULT '{}', manual_data jsonb NOT NULL DEFAULT '{}',
  manual_override_fields text[] NOT NULL DEFAULT '{}', customer_visible boolean NOT NULL DEFAULT true,
  include_in_health_score boolean NOT NULL DEFAULT true, is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz, updated_at timestamptz,
  UNIQUE(company_id,source_type,source_id)
);
CREATE TABLE monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  source text NOT NULL, entity_name text, entity_type text, previous_status text, current_status text,
  severity text, message text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
