-- Bounded raw-data retention and explicitly authorized shared physical scopes.
CREATE TABLE IF NOT EXISTS network_physical_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, id),
  UNIQUE(company_id, name)
);
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS network_scope_id uuid REFERENCES network_physical_scopes(id) ON DELETE SET NULL;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS trusted_identity_kind text;
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS trusted_identity_value text;
CREATE UNIQUE INDEX IF NOT EXISTS network_devices_shared_identity_idx
  ON network_devices(company_id,network_scope_id,trusted_identity_kind,trusted_identity_value)
  WHERE network_scope_id IS NOT NULL AND trusted_identity_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS network_agent_batches_retention_idx ON network_agent_batches(collected_at);
CREATE INDEX IF NOT EXISTS network_device_samples_retention_idx ON network_device_samples(observed_at);

ALTER TABLE network_physical_scopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON network_physical_scopes FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT ON network_physical_scopes TO service_role;

CREATE OR REPLACE FUNCTION save_network_agent_configuration(p_agent_id uuid,p_company_id uuid,p_configuration jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb; cfg jsonb; item jsonb; expected_count integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM registered_agents WHERE id=p_agent_id AND company_id=p_company_id AND agent_kind='network' AND status<>'Revoked') THEN RAISE EXCEPTION 'AGENT_SCOPE'; END IF;
 cfg:=jsonb_set(p_configuration,'{networks}',COALESCE((SELECT jsonb_agg(CASE WHEN NULLIF(value->>'id','') IS NULL THEN jsonb_set(value,'{id}',to_jsonb(gen_random_uuid()::text),true) ELSE value END) FROM jsonb_array_elements(COALESCE(p_configuration->'networks','[]'::jsonb))),'[]'::jsonb));
 FOR item IN SELECT value FROM jsonb_array_elements(cfg->'networks') LOOP
   IF NULLIF(item->>'network_scope_id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM network_physical_scopes WHERE id=(item->>'network_scope_id')::uuid AND company_id=p_company_id) THEN RAISE EXCEPTION 'NETWORK_SCOPE'; END IF;
 END LOOP;
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
 END LOOP; RETURN v;
END $$;

CREATE OR REPLACE FUNCTION replace_network_snmp_credential(p_company_id uuid,p_credential_id uuid,p_values jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 UPDATE network_snmp_credentials SET name=p_values->>'name',version=p_values->>'version',username=p_values->>'username',security_level=p_values->>'security_level',auth_protocol=p_values->>'auth_protocol',privacy_protocol=p_values->>'privacy_protocol',context_name=p_values->>'context_name',key_version=p_values->>'key_version',iv=p_values->>'iv',ciphertext=p_values->>'ciphertext',auth_tag=p_values->>'auth_tag',updated_at=now()
 WHERE id=p_credential_id AND company_id=p_company_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE network_agent_configurations c SET version=c.version+1,updated_at=now()
 WHERE c.company_id=p_company_id AND EXISTS(SELECT 1 FROM network_agent_credential_links l WHERE l.agent_id=c.agent_id AND l.company_id=p_company_id AND l.credential_id=p_credential_id);
 SELECT jsonb_build_object('id',id,'name',name,'version',version,'username',username,'security_level',security_level,'auth_protocol',auth_protocol,'privacy_protocol',privacy_protocol,'context_name',context_name)
 INTO result FROM network_snmp_credentials WHERE id=p_credential_id AND company_id=p_company_id;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION purge_network_agent_raw_data(p_batch_limit integer DEFAULT 5000)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE batches_deleted integer; samples_deleted integer; bounded_limit integer; more_batches boolean; more_samples boolean;
BEGIN
 bounded_limit:=LEAST(GREATEST(COALESCE(p_batch_limit,5000),1),5000);
 WITH doomed AS (SELECT ctid FROM network_agent_batches WHERE collected_at < now()-interval '30 days' ORDER BY collected_at LIMIT bounded_limit), removed AS (DELETE FROM network_agent_batches b USING doomed d WHERE b.ctid=d.ctid RETURNING 1) SELECT count(*) INTO batches_deleted FROM removed;
 WITH doomed AS (SELECT id FROM network_device_samples WHERE observed_at < now()-interval '30 days' ORDER BY observed_at LIMIT bounded_limit), removed AS (DELETE FROM network_device_samples s USING doomed d WHERE s.id=d.id RETURNING 1) SELECT count(*) INTO samples_deleted FROM removed;
 SELECT EXISTS(SELECT 1 FROM network_agent_batches WHERE collected_at < now()-interval '30 days') INTO more_batches;
 SELECT EXISTS(SELECT 1 FROM network_device_samples WHERE observed_at < now()-interval '30 days') INTO more_samples;
 RETURN jsonb_build_object('batches_deleted',batches_deleted,'samples_deleted',samples_deleted,'has_more_batches',more_batches,'has_more_samples',more_samples);
END $$;

CREATE OR REPLACE FUNCTION rotate_network_agent_refresh_token(p_current_hash text,p_replacement_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a registered_agents%ROWTYPE;
BEGIN
 IF p_current_hash IS NULL OR p_replacement_hash IS NULL OR p_current_hash=p_replacement_hash THEN RETURN NULL; END IF;
 SELECT * INTO a FROM registered_agents WHERE agent_kind='network' AND status<>'Revoked' AND (refresh_token_hash=p_current_hash OR refresh_token_hash=p_replacement_hash) FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF a.refresh_token_hash=p_current_hash THEN
   UPDATE registered_agents SET refresh_token_hash=p_replacement_hash,last_heartbeat=now() WHERE id=a.id RETURNING * INTO a;
 END IF;
 RETURN jsonb_build_object('id',a.id,'company_id',a.company_id,'hostname',a.hostname,'agent_version',a.agent_version);
END $$;

CREATE OR REPLACE FUNCTION ingest_network_metric_batch(p_agent_id uuid,p_company_id uuid,p_batch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint; inserted integer; dev jsonb; d_id uuid; old_status text; new_status text; v_scope uuid; identity_kind text; identity_value text; current_device network_devices%ROWTYPE; observed timestamptz;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM registered_agents WHERE id=p_agent_id AND company_id=p_company_id AND agent_kind='network' AND status<>'Revoked') THEN RAISE EXCEPTION 'AGENT_SCOPE'; END IF;
 n:=(p_batch->>'sequence')::bigint;
 INSERT INTO network_agent_batches(agent_id,company_id,sequence,collected_at,payload) VALUES(p_agent_id,p_company_id,n,(p_batch->>'collected_at')::timestamptz,p_batch) ON CONFLICT(agent_id,sequence) DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT; IF inserted=0 THEN RETURN jsonb_build_object('status','duplicate','sequence',n); END IF;
 FOR dev IN SELECT value FROM jsonb_array_elements(p_batch->'devices') LOOP
   v_scope:=NULL; identity_kind:=NULL; identity_value:=NULL; observed:=(dev->>'observed_at')::timestamptz;
   SELECT NULLIF(configured->>'network_scope_id','')::uuid INTO v_scope FROM network_agent_configurations c, LATERAL jsonb_array_elements(COALESCE(c.configuration->'networks','[]'::jsonb)) configured
   WHERE c.agent_id=p_agent_id AND c.company_id=p_company_id AND c.enabled AND configured->>'id'=dev->>'network_id' AND COALESCE((configured->>'enabled')::boolean,false)
     AND (dev->>'ip_address')::inet <<= (configured->>'cidr')::cidr AND NOT COALESCE(configured->'excluded_ips','[]'::jsonb) @> jsonb_build_array(dev->>'ip_address')
     AND (NULLIF(configured->>'network_scope_id','') IS NULL OR EXISTS(SELECT 1 FROM network_physical_scopes ps WHERE ps.id=(configured->>'network_scope_id')::uuid AND ps.company_id=p_company_id));
   IF NOT FOUND THEN RAISE EXCEPTION 'AGENT_SCOPE'; END IF;
   IF NULLIF(btrim(dev->>'serial_number'),'') IS NOT NULL THEN identity_kind:='serial'; identity_value:=lower(btrim(dev->>'serial_number'));
   ELSIF NULLIF(btrim(dev->>'engine_id'),'') IS NOT NULL THEN identity_kind:='engine_id'; identity_value:=lower(btrim(dev->>'engine_id')); END IF;
   d_id:=NULL; old_status:=NULL;
   IF v_scope IS NOT NULL AND identity_value IS NOT NULL THEN
     PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::text||':'||v_scope::text||':'||identity_kind||':'||identity_value,0));
     SELECT * INTO current_device FROM network_devices WHERE company_id=p_company_id AND network_scope_id=v_scope AND trusted_identity_kind=identity_kind AND trusted_identity_value=identity_value FOR UPDATE;
     IF FOUND THEN
       d_id:=current_device.id; old_status:=current_device.status;
       UPDATE network_devices SET agent_id=CASE WHEN observed>=last_poll_at THEN p_agent_id ELSE agent_id END,monitoring_source='agent_snmp',ip_address=CASE WHEN observed>=last_poll_at THEN dev->>'ip_address' ELSE ip_address END,device_name=CASE WHEN observed>=last_poll_at THEN dev->>'device_name' ELSE device_name END,device_type=CASE WHEN observed>=last_poll_at THEN COALESCE(dev->>'device_type','Outro') ELSE device_type END,result=CASE WHEN observed>=last_poll_at THEN dev->>'result' ELSE result END,last_poll_at=GREATEST(last_poll_at,observed),last_success_at=GREATEST(last_success_at,CASE WHEN dev->>'result' IN ('success','partial') THEN observed END),status=CASE WHEN observed>=last_poll_at AND dev->>'result' IN ('success','partial') THEN 'Online' WHEN observed>=last_poll_at AND dev->>'result'='timeout' AND consecutive_failures>=2 THEN 'Sem resposta SNMP' WHEN observed>=last_poll_at THEN 'Atencao' ELSE status END,consecutive_failures=CASE WHEN observed>=last_poll_at AND dev->>'result'='timeout' THEN consecutive_failures+1 WHEN observed>=last_poll_at THEN 0 ELSE consecutive_failures END,sys_object_id=CASE WHEN observed>=last_poll_at THEN dev->>'sys_object_id' ELSE sys_object_id END,sys_description=CASE WHEN observed>=last_poll_at THEN dev->>'sys_description' ELSE sys_description END,snmp_uptime=CASE WHEN observed>=last_poll_at THEN NULLIF(dev->>'uptime_seconds','')::bigint ELSE snmp_uptime END,response_time_ms=CASE WHEN observed>=last_poll_at THEN NULLIF(dev->>'response_time_ms','')::double precision ELSE response_time_ms END,manufacturer=CASE WHEN observed>=last_poll_at THEN COALESCE(NULLIF(dev->>'manufacturer',''),manufacturer) ELSE manufacturer END,model=CASE WHEN observed>=last_poll_at THEN COALESCE(NULLIF(dev->>'model',''),model) ELSE model END,serial_number=CASE WHEN observed>=last_poll_at THEN COALESCE(NULLIF(dev->>'serial_number',''),serial_number) ELSE serial_number END,firmware_version=CASE WHEN observed>=last_poll_at THEN COALESCE(NULLIF(dev->>'firmware_version',''),firmware_version) ELSE firmware_version END,location=CASE WHEN observed>=last_poll_at THEN COALESCE(NULLIF(dev->>'location',''),location) ELSE location END,engine_id=CASE WHEN observed>=last_poll_at THEN COALESCE(NULLIF(dev->>'engine_id',''),engine_id) ELSE engine_id END,interfaces=CASE WHEN observed>=last_poll_at AND dev->>'result' IN ('success','partial') THEN COALESCE(dev->'interfaces','[]') ELSE interfaces END,updated_at=now(),last_updated=now() WHERE id=d_id RETURNING status INTO new_status;
     END IF;
   END IF;
   IF d_id IS NULL THEN
     SELECT status INTO old_status FROM network_devices WHERE company_id=p_company_id AND network_id=(dev->>'network_id')::uuid AND device_uid=dev->>'device_uid';
     INSERT INTO network_devices(company_id,network_id,agent_id,device_uid,network_scope_id,trusted_identity_kind,trusted_identity_value,monitoring_source,ip_address,device_name,device_type,status,result,last_poll_at,last_success_at,sys_object_id,sys_description,snmp_uptime,response_time_ms,manufacturer,model,serial_number,firmware_version,location,engine_id,interfaces,consecutive_failures)
     VALUES(p_company_id,(dev->>'network_id')::uuid,p_agent_id,dev->>'device_uid',v_scope,identity_kind,identity_value,'agent_snmp',(dev->>'ip_address')::inet,dev->>'device_name',COALESCE(dev->>'device_type','Outro'),CASE WHEN dev->>'result' IN ('success','partial') THEN 'Online' ELSE 'Atencao' END,dev->>'result',observed,CASE WHEN dev->>'result' IN ('success','partial') THEN observed END,dev->>'sys_object_id',dev->>'sys_description',NULLIF(dev->>'uptime_seconds','')::bigint,NULLIF(dev->>'response_time_ms','')::double precision,dev->>'manufacturer',dev->>'model',dev->>'serial_number',dev->>'firmware_version',dev->>'location',dev->>'engine_id',COALESCE(dev->'interfaces','[]'),CASE WHEN dev->>'result'='timeout' THEN 1 ELSE 0 END)
     ON CONFLICT(company_id,network_id,device_uid) DO UPDATE SET monitoring_source='agent_snmp',network_scope_id=EXCLUDED.network_scope_id,trusted_identity_kind=EXCLUDED.trusted_identity_kind,trusted_identity_value=EXCLUDED.trusted_identity_value,ip_address=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.ip_address ELSE network_devices.ip_address END,device_name=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.device_name ELSE network_devices.device_name END,device_type=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.device_type ELSE network_devices.device_type END,result=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.result ELSE network_devices.result END,last_poll_at=GREATEST(EXCLUDED.last_poll_at,network_devices.last_poll_at),last_success_at=GREATEST(EXCLUDED.last_success_at,network_devices.last_success_at),status=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at AND EXCLUDED.result IN ('success','partial') THEN 'Online' WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at AND EXCLUDED.result='timeout' AND network_devices.consecutive_failures>=2 THEN 'Sem resposta SNMP' WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN 'Atencao' ELSE network_devices.status END,consecutive_failures=CASE WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at AND EXCLUDED.result='timeout' THEN network_devices.consecutive_failures+1 WHEN EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN 0 ELSE network_devices.consecutive_failures END,interfaces=CASE WHEN EXCLUDED.result IN ('success','partial') AND EXCLUDED.last_poll_at>=network_devices.last_poll_at THEN EXCLUDED.interfaces ELSE network_devices.interfaces END,updated_at=now(),last_updated=now() RETURNING id,status INTO d_id,new_status;
   END IF;
   INSERT INTO network_device_samples(device_id,company_id,agent_id,sequence,observed_at,result,payload) VALUES(d_id,p_company_id,p_agent_id,n,observed,dev->>'result',dev) ON CONFLICT DO NOTHING;
   INSERT INTO network_status_history(company_id,network_device_id,device_name,device_type,ip_address,status,collected_at) VALUES(p_company_id,d_id,dev->>'device_name',dev->>'device_type',dev->>'ip_address',CASE WHEN dev->>'result' IN ('success','partial') THEN 'Online' ELSE 'Atencao' END,observed);
   INSERT INTO asset_profiles(company_id,source_type,source_id,asset_type,display_name,manufacturer,model,serial_number,firmware_version,location,auto_data,last_synced_at)
   SELECT d.company_id,'network_device',d.id,'network',d.device_name,d.manufacturer,d.model,d.serial_number,d.firmware_version,d.location,jsonb_build_object('ip_address',d.ip_address,'result',d.result,'last_poll_at',d.last_poll_at),now() FROM network_devices d WHERE d.id=d_id
   ON CONFLICT(company_id,source_type,source_id) DO UPDATE SET manufacturer=COALESCE(asset_profiles.manufacturer,EXCLUDED.manufacturer),model=COALESCE(asset_profiles.model,EXCLUDED.model),serial_number=COALESCE(asset_profiles.serial_number,EXCLUDED.serial_number),firmware_version=COALESCE(asset_profiles.firmware_version,EXCLUDED.firmware_version),location=COALESCE(asset_profiles.location,EXCLUDED.location),auto_data=asset_profiles.auto_data||EXCLUDED.auto_data,last_synced_at=now();
   IF old_status IS DISTINCT FROM new_status THEN INSERT INTO monitoring_events(company_id,source,entity_name,entity_type,previous_status,current_status,severity,message,metadata) VALUES(p_company_id,'network',dev->>'device_name','network_device',old_status,new_status,CASE WHEN new_status='Online' THEN 'info' ELSE 'warning' END,CASE WHEN new_status='Online' THEN 'Equipamento respondeu via SNMP' ELSE 'Falha de consulta SNMP' END,jsonb_build_object('network_device_id',d_id,'agent_id',p_agent_id,'result',dev->>'result')); END IF;
 END LOOP; RETURN jsonb_build_object('status','accepted','sequence',n);
END $$;

REVOKE ALL ON FUNCTION replace_network_snmp_credential(uuid,uuid,jsonb),purge_network_agent_raw_data(integer),rotate_network_agent_refresh_token(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION replace_network_snmp_credential(uuid,uuid,jsonb),purge_network_agent_raw_data(integer),rotate_network_agent_refresh_token(text,text) TO service_role;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ingest_network_metric_batch' LOOP EXECUTE 'REVOKE ALL ON FUNCTION '||f.sig||' FROM PUBLIC,anon,authenticated'; EXECUTE 'GRANT EXECUTE ON FUNCTION '||f.sig||' TO service_role'; END LOOP; END $$;
