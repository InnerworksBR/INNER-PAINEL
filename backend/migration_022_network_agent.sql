-- Isolated network-agent identity, configuration, credentials, pairing and idempotent ingest.
ALTER TABLE registered_agents ADD COLUMN IF NOT EXISTS agent_kind TEXT NOT NULL DEFAULT 'hyperv';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='registered_agents_company_machine_idx') THEN
    DROP INDEX registered_agents_company_machine_idx;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS registered_agents_company_machine_kind_idx
  ON registered_agents(company_id, machine_id, agent_kind) WHERE machine_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS network_agent_pairings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), machine_id text NOT NULL, hostname text NOT NULL,
 agent_version text NOT NULL, os_version text, detected_networks jsonb NOT NULL DEFAULT '[]',
 code_hash text NOT NULL UNIQUE, device_secret_hash text NOT NULL, refresh_token_hash text,
 company_id uuid REFERENCES companies(id), state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','completed','expired')),
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 completed_at timestamptz, agent_id uuid REFERENCES registered_agents(id));
CREATE TABLE IF NOT EXISTS network_agent_configurations (
 agent_id uuid PRIMARY KEY REFERENCES registered_agents(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE, version bigint NOT NULL DEFAULT 0,
 enabled boolean NOT NULL DEFAULT false, collection_interval_seconds integer NOT NULL DEFAULT 60,
 discovery_interval_seconds integer NOT NULL DEFAULT 900, configuration jsonb NOT NULL DEFAULT '{"networks":[]}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS network_snmp_credentials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 name text NOT NULL, version text NOT NULL CHECK(version IN ('2c','3')), username text,
 security_level text, auth_protocol text, privacy_protocol text, context_name text,
 key_version text NOT NULL, iv text NOT NULL, ciphertext text NOT NULL, auth_tag text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS network_agent_credential_links (
 agent_id uuid NOT NULL REFERENCES registered_agents(id) ON DELETE CASCADE, network_id uuid NOT NULL,
 credential_id uuid NOT NULL REFERENCES network_snmp_credentials(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE, PRIMARY KEY(agent_id,network_id,credential_id));
CREATE TABLE IF NOT EXISTS network_agent_batches (
 agent_id uuid NOT NULL REFERENCES registered_agents(id) ON DELETE CASCADE, sequence bigint NOT NULL,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE, collected_at timestamptz NOT NULL,
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(agent_id,sequence));
CREATE TABLE IF NOT EXISTS network_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
 network_id uuid NOT NULL, agent_id uuid NOT NULL REFERENCES registered_agents(id) ON DELETE CASCADE,
 device_uid text NOT NULL, ip_address inet NOT NULL, device_name text NOT NULL, device_type text NOT NULL DEFAULT 'Outro',
 monitoring_source text NOT NULL DEFAULT 'agent_snmp', status text NOT NULL DEFAULT 'Online', result text,
 last_poll_at timestamptz, last_success_at timestamptz, consecutive_failures integer NOT NULL DEFAULT 0,
 sys_object_id text, sys_description text, snmp_uptime bigint, response_time_ms double precision,
 manufacturer text, model text, serial_number text, firmware_version text, location text, engine_id text,
 interfaces jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,network_id,device_uid));
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS network_id uuid;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES registered_agents(id) ON DELETE SET NULL;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS device_uid text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS monitoring_source text NOT NULL DEFAULT 'legacy';
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS result text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS last_poll_at timestamptz;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS last_success_at timestamptz;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS consecutive_failures integer NOT NULL DEFAULT 0;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS sys_object_id text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS sys_description text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS snmp_uptime bigint;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS response_time_ms double precision;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS serial_number text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS firmware_version text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS engine_id text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS interfaces jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS uptime_percent double precision;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS last_updated timestamptz NOT NULL DEFAULT now();
ALTER TABLE network_devices ALTER COLUMN uptime_percent DROP DEFAULT;
ALTER TABLE network_devices ALTER COLUMN uptime_percent DROP NOT NULL;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.network_devices'::regclass AND contype='u' AND pg_get_constraintdef(oid) ILIKE '%company_id, device_name%' LOOP
  EXECUTE format('ALTER TABLE public.network_devices DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
DROP INDEX IF EXISTS network_devices_company_scope_uid_idx;
CREATE UNIQUE INDEX network_devices_company_scope_uid_idx ON network_devices(company_id,network_id,device_uid);
CREATE TABLE IF NOT EXISTS network_device_samples (
 id bigserial PRIMARY KEY, device_id uuid NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE, agent_id uuid NOT NULL,
 sequence bigint NOT NULL, observed_at timestamptz NOT NULL, result text NOT NULL, payload jsonb NOT NULL,
 UNIQUE(agent_id,sequence,device_id));
CREATE INDEX IF NOT EXISTS network_device_samples_company_time_idx ON network_device_samples(company_id,observed_at DESC);
ALTER TABLE network_agent_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_agent_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_snmp_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_agent_credential_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_agent_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_device_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON network_agent_pairings,network_agent_configurations,network_snmp_credentials,network_agent_credential_links,network_agent_batches,network_devices,network_device_samples FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON network_agent_configurations,network_snmp_credentials,network_agent_credential_links,network_devices,network_device_samples,network_agent_batches,network_agent_pairings TO service_role;
GRANT USAGE,SELECT ON SEQUENCE network_device_samples_id_seq TO service_role;

CREATE OR REPLACE FUNCTION create_network_pairing(p_machine_id text,p_hostname text,p_agent_version text,p_os_version text,p_detected_networks jsonb,p_code_hash text,p_device_secret_hash text,p_expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; BEGIN
 INSERT INTO network_agent_pairings(machine_id,hostname,agent_version,os_version,detected_networks,code_hash,device_secret_hash,expires_at)
 VALUES(p_machine_id,p_hostname,p_agent_version,p_os_version,p_detected_networks,p_code_hash,p_device_secret_hash,p_expires_at) RETURNING id INTO v_id; RETURN v_id; END $$;
CREATE OR REPLACE FUNCTION claim_network_pairing(p_company_id uuid,p_user_id uuid,p_code_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p network_agent_pairings%ROWTYPE; BEGIN
 SELECT * INTO p FROM network_agent_pairings WHERE code_hash=p_code_hash AND state='pending' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAIRING_INVALID'; END IF;
 UPDATE network_agent_pairings SET company_id=p_company_id,created_by=p_user_id,state='approved' WHERE id=p.id;
 RETURN jsonb_build_object('hostname',p.hostname,'company_id',p_company_id,'state','approved','pairing_id',p.id); END $$;
CREATE OR REPLACE FUNCTION get_network_pairing_status(p_pairing_id uuid,p_device_secret_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p network_agent_pairings%ROWTYPE; BEGIN
 SELECT * INTO p FROM network_agent_pairings WHERE id=p_pairing_id AND device_secret_hash=p_device_secret_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAIRING_INVALID'; END IF;
 IF p.state IN ('pending','approved') AND p.expires_at<=now() THEN UPDATE network_agent_pairings SET state='expired' WHERE id=p.id; RETURN jsonb_build_object('state','expired'); END IF;
 RETURN jsonb_build_object('state',p.state,'company_name',(SELECT name FROM companies WHERE id=p.company_id)); END $$;
CREATE OR REPLACE FUNCTION complete_network_pairing(p_pairing_id uuid,p_device_secret_hash text,p_refresh_token_hash text,p_agent_secret_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p network_agent_pairings%ROWTYPE; a registered_agents%ROWTYPE; BEGIN
 SELECT * INTO p FROM network_agent_pairings WHERE id=p_pairing_id AND device_secret_hash=p_device_secret_hash FOR UPDATE;
 IF NOT FOUND OR p.state NOT IN ('approved','completed') OR (p.state='approved' AND p.expires_at<=now()) THEN RAISE EXCEPTION 'PAIRING_INVALID'; END IF;
 IF p.state='completed' AND (p.completed_at<now()-interval '15 minutes' OR p.refresh_token_hash<>p_refresh_token_hash) THEN RAISE EXCEPTION 'PAIRING_INVALID'; END IF;
 IF p.state='completed' THEN SELECT * INTO a FROM registered_agents WHERE id=p.agent_id; RETURN jsonb_build_object('agent_id',a.id,'company_id',a.company_id); END IF;
 IF EXISTS(SELECT 1 FROM registered_agents WHERE machine_id=p.machine_id AND agent_kind='network' AND status<>'Revoked') THEN RAISE EXCEPTION 'NETWORK_AGENT_ALREADY_LINKED'; END IF;
 INSERT INTO registered_agents(company_id,agent_type,agent_kind,asset_key,agent_secret,refresh_token_hash,machine_id,hostname,version,agent_version,status,last_heartbeat,metadata)
 VALUES(p.company_id,'endpoint','network','network-agent:'||p.company_id||':'||p.machine_id,p_agent_secret_hash,p_refresh_token_hash,p.machine_id,p.hostname,p.agent_version,p.agent_version,'Online',now(),jsonb_build_object('source','network-agent','detected_networks',p.detected_networks))
 ON CONFLICT(company_id,machine_id,agent_kind) WHERE machine_id IS NOT NULL DO UPDATE SET hostname=EXCLUDED.hostname,agent_version=EXCLUDED.agent_version,version=EXCLUDED.version,agent_secret=EXCLUDED.agent_secret,refresh_token_hash=EXCLUDED.refresh_token_hash,status='Online',last_heartbeat=now()
 RETURNING * INTO a;
 UPDATE network_agent_pairings SET state='completed',completed_at=now(),agent_id=a.id,refresh_token_hash=p_refresh_token_hash WHERE id=p.id;
 INSERT INTO network_agent_configurations(agent_id,company_id) VALUES(a.id,a.company_id) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('agent_id',a.id,'company_id',a.company_id); END $$;
CREATE OR REPLACE FUNCTION save_network_agent_configuration(p_agent_id uuid,p_company_id uuid,p_configuration jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v jsonb; cfg jsonb; item jsonb; expected_count integer; BEGIN
 IF NOT EXISTS(SELECT 1 FROM registered_agents WHERE id=p_agent_id AND company_id=p_company_id AND agent_kind='network' AND status<>'Revoked') THEN RAISE EXCEPTION 'AGENT_SCOPE'; END IF;
 cfg:=jsonb_set(p_configuration,'{networks}',COALESCE((SELECT jsonb_agg(CASE WHEN NULLIF(value->>'id','') IS NULL THEN jsonb_set(value,'{id}',to_jsonb(gen_random_uuid()::text),true) ELSE value END) FROM jsonb_array_elements(COALESCE(p_configuration->'networks','[]'::jsonb))),'[]'::jsonb));
 INSERT INTO network_agent_configurations(agent_id,company_id,version,enabled,collection_interval_seconds,discovery_interval_seconds,configuration)
 VALUES(p_agent_id,p_company_id,1,COALESCE((cfg->>'enabled')::boolean,false),COALESCE((cfg->>'collection_interval_seconds')::integer,60),COALESCE((cfg->>'discovery_interval_seconds')::integer,900),cfg)
 ON CONFLICT(agent_id) DO UPDATE SET version=network_agent_configurations.version+1,enabled=EXCLUDED.enabled,collection_interval_seconds=EXCLUDED.collection_interval_seconds,discovery_interval_seconds=EXCLUDED.discovery_interval_seconds,configuration=EXCLUDED.configuration,updated_at=now()
 RETURNING jsonb_build_object('version',version,'enabled',enabled,'collection_interval_seconds',collection_interval_seconds,'discovery_interval_seconds',discovery_interval_seconds,'networks',configuration->'networks') INTO v;
 DELETE FROM network_agent_credential_links WHERE agent_id=p_agent_id AND company_id=p_company_id;
 FOR item IN SELECT value FROM jsonb_array_elements(cfg->'networks') LOOP
  IF NULLIF(item->>'id','') IS NOT NULL AND jsonb_typeof(item->'credential_ids')='array' THEN
   INSERT INTO network_agent_credential_links(agent_id,network_id,credential_id,company_id)
   SELECT p_agent_id,(item->>'id')::uuid,(c.value #>> '{}')::uuid,p_company_id FROM jsonb_array_elements(item->'credential_ids') c
   JOIN network_snmp_credentials cred ON cred.id=(c.value #>> '{}')::uuid AND cred.company_id=p_company_id;
   expected_count:=jsonb_array_length(item->'credential_ids');
   IF (SELECT count(*) FROM network_agent_credential_links WHERE agent_id=p_agent_id AND network_id=(item->>'id')::uuid)<>expected_count THEN RAISE EXCEPTION 'CREDENTIAL_SCOPE'; END IF;
  END IF;
 END LOOP; RETURN v; END $$;
CREATE OR REPLACE FUNCTION get_agent_network_configuration(p_agent_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v jsonb; BEGIN
 SELECT jsonb_build_object('version',c.version,'enabled',c.enabled,'collection_interval_seconds',c.collection_interval_seconds,'discovery_interval_seconds',c.discovery_interval_seconds,'networks',c.configuration->'networks','credentials',COALESCE((SELECT jsonb_agg(to_jsonb(cr)) FROM (SELECT DISTINCT cr.id,cr.name,cr.version,cr.username,cr.security_level,cr.auth_protocol,cr.privacy_protocol,cr.context_name,cr.key_version,cr.iv,cr.ciphertext,cr.auth_tag FROM network_agent_credential_links l JOIN network_snmp_credentials cr ON cr.id=l.credential_id AND cr.company_id=l.company_id WHERE l.agent_id=p_agent_id AND l.company_id=c.company_id) cr),'[]'::jsonb))
 INTO v FROM network_agent_configurations c JOIN registered_agents a ON a.id=c.agent_id AND a.company_id=c.company_id WHERE c.agent_id=p_agent_id AND a.agent_kind='network' AND a.status<>'Revoked'; RETURN v; END $$;
CREATE OR REPLACE FUNCTION delete_network_snmp_credential(p_company_id uuid,p_credential_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE removed integer; BEGIN
 IF NOT EXISTS(SELECT 1 FROM network_snmp_credentials WHERE id=p_credential_id AND company_id=p_company_id) THEN RETURN false; END IF;
 UPDATE network_agent_configurations c SET configuration=jsonb_set(c.configuration,'{networks}',COALESCE((
   SELECT jsonb_agg(jsonb_set(n,'{credential_ids}',COALESCE((SELECT jsonb_agg(v) FROM jsonb_array_elements(COALESCE(n->'credential_ids','[]'::jsonb)) v WHERE v #>> '{}'<>p_credential_id::text),'[]'::jsonb)))
   FROM jsonb_array_elements(COALESCE(c.configuration->'networks','[]'::jsonb)) n),'[]'::jsonb)),version=version+1,updated_at=now()
 WHERE c.company_id=p_company_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(c.configuration->'networks','[]'::jsonb)) n WHERE COALESCE(n->'credential_ids','[]'::jsonb) @> jsonb_build_array(p_credential_id::text));
 DELETE FROM network_agent_credential_links WHERE company_id=p_company_id AND credential_id=p_credential_id;
 DELETE FROM network_snmp_credentials WHERE company_id=p_company_id AND id=p_credential_id;
 GET DIAGNOSTICS removed=ROW_COUNT; RETURN removed=1; END $$;
CREATE OR REPLACE FUNCTION ingest_network_metric_batch(p_agent_id uuid,p_company_id uuid,p_batch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n bigint; inserted integer; dev jsonb; d_id uuid; old_status text; new_status text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM registered_agents WHERE id=p_agent_id AND company_id=p_company_id AND agent_kind='network' AND status<>'Revoked') THEN RAISE EXCEPTION 'AGENT_SCOPE'; END IF;
 n:=(p_batch->>'sequence')::bigint;
 INSERT INTO network_agent_batches(agent_id,company_id,sequence,collected_at,payload) VALUES(p_agent_id,p_company_id,n,(p_batch->>'collected_at')::timestamptz,p_batch) ON CONFLICT(agent_id,sequence) DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=0 THEN RETURN jsonb_build_object('status','duplicate','sequence',n); END IF;
 FOR dev IN SELECT value FROM jsonb_array_elements(p_batch->'devices') LOOP
 IF NOT EXISTS (
   SELECT 1 FROM network_agent_configurations c,
     LATERAL jsonb_array_elements(COALESCE(c.configuration->'networks','[]'::jsonb)) configured
   WHERE c.agent_id=p_agent_id AND c.company_id=p_company_id AND c.enabled
     AND configured->>'id'=dev->>'network_id' AND COALESCE((configured->>'enabled')::boolean,false)
     AND (dev->>'ip_address')::inet <<= (configured->>'cidr')::cidr
     AND NOT COALESCE(configured->'excluded_ips','[]'::jsonb) @> jsonb_build_array(dev->>'ip_address')
 ) THEN RAISE EXCEPTION 'AGENT_SCOPE'; END IF;
 SELECT status INTO old_status FROM network_devices WHERE company_id=p_company_id AND network_id=(dev->>'network_id')::uuid AND device_uid=dev->>'device_uid';
 INSERT INTO network_devices(company_id,network_id,agent_id,device_uid,monitoring_source,ip_address,device_name,device_type,status,result,last_poll_at,last_success_at,sys_object_id,sys_description,snmp_uptime,response_time_ms,manufacturer,model,serial_number,firmware_version,location,engine_id,interfaces,consecutive_failures)
 VALUES(p_company_id,(dev->>'network_id')::uuid,p_agent_id,dev->>'device_uid','agent_snmp',(dev->>'ip_address')::inet,dev->>'device_name',COALESCE(dev->>'device_type','Outro'),CASE WHEN dev->>'result' IN ('success','partial') THEN 'Online' ELSE 'Atencao' END,dev->>'result',(dev->>'observed_at')::timestamptz,CASE WHEN dev->>'result' IN ('success','partial') THEN (dev->>'observed_at')::timestamptz END,dev->>'sys_object_id',dev->>'sys_description',NULLIF(dev->>'uptime_seconds','')::bigint,NULLIF(dev->>'response_time_ms','')::double precision,dev->>'manufacturer',dev->>'model',dev->>'serial_number',dev->>'firmware_version',dev->>'location',dev->>'engine_id',COALESCE(dev->'interfaces','[]'),CASE WHEN dev->>'result'='timeout' THEN 1 ELSE 0 END)
 ON CONFLICT(company_id,network_id,device_uid) DO UPDATE SET monitoring_source='agent_snmp',ip_address=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.ip_address ELSE network_devices.ip_address END,device_name=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.device_name ELSE network_devices.device_name END,device_type=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.device_type ELSE network_devices.device_type END,result=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.result ELSE network_devices.result END,last_poll_at=GREATEST(EXCLUDED.last_poll_at,network_devices.last_poll_at),last_success_at=GREATEST(EXCLUDED.last_success_at,network_devices.last_success_at),status=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at AND EXCLUDED.result IN ('success','partial') THEN 'Online' WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at AND EXCLUDED.result='timeout' AND network_devices.consecutive_failures>=2 THEN 'Sem resposta SNMP' WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN 'Atencao' ELSE network_devices.status END,consecutive_failures=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at AND EXCLUDED.result='timeout' THEN network_devices.consecutive_failures+1 WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN 0 ELSE network_devices.consecutive_failures END,interfaces=CASE WHEN EXCLUDED.result IN ('success','partial') AND EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.interfaces ELSE network_devices.interfaces END,updated_at=now(),last_updated=now()
 RETURNING id,status INTO d_id,new_status;
 INSERT INTO network_device_samples(device_id,company_id,agent_id,sequence,observed_at,result,payload) VALUES(d_id,p_company_id,p_agent_id,n,(dev->>'observed_at')::timestamptz,dev->>'result',dev) ON CONFLICT DO NOTHING;
 INSERT INTO network_status_history(company_id,network_device_id,device_name,device_type,ip_address,status,collected_at) VALUES(p_company_id,d_id,dev->>'device_name',dev->>'device_type',dev->>'ip_address',CASE WHEN dev->>'result' IN ('success','partial') THEN 'Online' ELSE 'Atencao' END,(dev->>'observed_at')::timestamptz);
 INSERT INTO asset_profiles(company_id,source_type,source_id,asset_type,display_name,manufacturer,model,serial_number,firmware_version,location,auto_data,last_synced_at)
 SELECT d.company_id,'network_device',d.id,'network',d.device_name,d.manufacturer,d.model,d.serial_number,d.firmware_version,d.location,jsonb_build_object('ip_address',d.ip_address,'result',d.result,'last_poll_at',d.last_poll_at),now() FROM network_devices d WHERE d.id=d_id
 ON CONFLICT(company_id,source_type,source_id) DO UPDATE SET manufacturer=COALESCE(asset_profiles.manufacturer,EXCLUDED.manufacturer),model=COALESCE(asset_profiles.model,EXCLUDED.model),serial_number=COALESCE(asset_profiles.serial_number,EXCLUDED.serial_number),firmware_version=COALESCE(asset_profiles.firmware_version,EXCLUDED.firmware_version),location=COALESCE(asset_profiles.location,EXCLUDED.location),auto_data=asset_profiles.auto_data||EXCLUDED.auto_data,last_synced_at=now();
 IF old_status IS DISTINCT FROM new_status THEN
  INSERT INTO monitoring_events(company_id,source,entity_name,entity_type,previous_status,current_status,severity,message,metadata)
  VALUES(p_company_id,'network',dev->>'device_name','network_device',old_status,new_status,CASE WHEN new_status='Online' THEN 'info' ELSE 'warning' END,CASE WHEN new_status='Online' THEN 'Equipamento respondeu via SNMP' ELSE 'Falha de consulta SNMP' END,jsonb_build_object('network_device_id',d_id,'agent_id',p_agent_id,'result',dev->>'result'));
 END IF;
 END LOOP; RETURN jsonb_build_object('status','accepted','sequence',n); END $$;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('create_network_pairing','claim_network_pairing','get_network_pairing_status','complete_network_pairing','save_network_agent_configuration','get_agent_network_configuration','delete_network_snmp_credential','ingest_network_metric_batch') LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f.sig||' FROM PUBLIC,anon,authenticated'; EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.sig||' TO service_role'; END LOOP; END $$;
