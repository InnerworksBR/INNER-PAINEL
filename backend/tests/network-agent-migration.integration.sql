-- Run only against a disposable PostgreSQL database after migration_022_network_agent.sql.
-- The schema fixture must include companies, registered_agents, network_devices,
-- network_status_history, monitoring_events, and asset_profiles from migrations 001-019.
DO $$
DECLARE
  company_a uuid; company_b uuid; pairing uuid; credential uuid; machine text := gen_random_uuid()::text; code_hash text := encode(gen_random_bytes(32),'hex'); secret text := repeat('s',64); refresh_hash text := repeat('r',64);
  agent jsonb; config jsonb; network_id text; batch jsonb; result jsonb; device uuid;
BEGIN
  INSERT INTO companies(name) VALUES ('network-test-a') RETURNING id INTO company_a;
  INSERT INTO companies(name) VALUES ('network-test-b') RETURNING id INTO company_b;

  pairing := create_network_pairing(machine,'test-host','1.0','Windows','["10.44.0.0/24"]',code_hash,secret,now()+interval '15 minutes');
  PERFORM claim_network_pairing(company_a,gen_random_uuid(),code_hash);
  IF get_network_pairing_status(pairing,secret)->>'state' <> 'approved' THEN RAISE EXCEPTION 'pairing approval failed'; END IF;
  agent := complete_network_pairing(pairing,secret,refresh_hash,repeat('a',64));
  IF complete_network_pairing(pairing,secret,refresh_hash,repeat('b',64))->>'agent_id' <> agent->>'agent_id' THEN RAISE EXCEPTION 'lost-response completion retry changed agent'; END IF;
  IF EXISTS (SELECT 1 FROM registered_agents WHERE id=(agent->>'agent_id')::uuid AND agent_kind <> 'network') THEN RAISE EXCEPTION 'network identity kind missing'; END IF;
  BEGIN
    PERFORM claim_network_pairing(company_b,gen_random_uuid(),code_hash);
    RAISE EXCEPTION 'one-time pairing code was reused';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='one-time pairing code was reused' THEN RAISE; END IF; END;

  -- Same company/machine can keep its independent legacy Hyper-V identity.
  INSERT INTO registered_agents(company_id,agent_type,agent_kind,asset_key,machine_id,hostname,status)
  VALUES(company_a,'endpoint','hyperv','agent:'||company_a||':'||machine,machine,'test-host','Online');
  IF (SELECT count(*) FROM registered_agents WHERE company_id=company_a AND machine_id=machine) <> 2 THEN RAISE EXCEPTION 'Hyper-V/network coexistence failed'; END IF;

  INSERT INTO network_snmp_credentials(company_id,name,version,key_version,iv,ciphertext,auth_tag)
  VALUES(company_a,'integration-test','2c','v1','iv-test','cipher-test','tag-test') RETURNING id INTO credential;
  config := save_network_agent_configuration((agent->>'agent_id')::uuid,company_a,
    jsonb_build_object('version',1,'enabled',true,'collection_interval_seconds',60,'discovery_interval_seconds',900,
      'networks',jsonb_build_array(jsonb_build_object('cidr','10.44.0.0/24','enabled',true,'snmp_port',161,'excluded_ips','[]'::jsonb,'credential_ids',jsonb_build_array(credential::text)))));
  IF jsonb_array_length(get_agent_network_configuration((agent->>'agent_id')::uuid)->'credentials')<>1 THEN RAISE EXCEPTION 'agent did not receive assigned credential'; END IF;
  IF NOT delete_network_snmp_credential(company_a,credential) THEN RAISE EXCEPTION 'credential deletion failed'; END IF;
  IF jsonb_array_length(get_agent_network_configuration((agent->>'agent_id')::uuid)->'credentials')<>0 THEN RAISE EXCEPTION 'deleted credential remained linked'; END IF;
  -- Re-add the saved network with no credential so subsequent ingest scopes remain stable.
  config := save_network_agent_configuration((agent->>'agent_id')::uuid,company_a,
    jsonb_build_object('version',1,'enabled',true,'collection_interval_seconds',60,'discovery_interval_seconds',900,
      'networks',jsonb_build_array(jsonb_build_object('id',config->'networks'->0->>'id','cidr','10.44.0.0/24','enabled',true,'snmp_port',161,'excluded_ips','[]'::jsonb,'credential_ids','[]'::jsonb))));
  network_id := config->'networks'->0->>'id';
  batch := jsonb_build_object('sequence',1,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now()-interval '30 seconds','result','success','interfaces',jsonb_build_array(jsonb_build_object('if_index',1,'name','eth0')))));
  result := ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF result->>'status' <> 'accepted' THEN RAISE EXCEPTION 'first batch not accepted'; END IF;
  result := ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF result->>'status' <> 'duplicate' THEN RAISE EXCEPTION 'duplicate batch not idempotent'; END IF;
  IF (SELECT count(*) FROM network_device_samples WHERE agent_id=(agent->>'agent_id')::uuid AND sequence=1) <> 1 THEN RAISE EXCEPTION 'duplicate sample written'; END IF;

  -- A newer timeout changes poll status but preserves last successful interfaces.
  batch := jsonb_build_object('sequence',2,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now(),'result','timeout','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  SELECT id INTO device FROM network_devices WHERE agent_id=(agent->>'agent_id')::uuid AND device_uid='stable-device';
  IF NOT EXISTS (SELECT 1 FROM network_devices WHERE network_devices.id=device AND network_devices.result='timeout' AND jsonb_array_length(network_devices.interfaces)=1) THEN RAISE EXCEPTION 'failed poll erased interfaces'; END IF;
  -- Later receipt of an older observation appends history without regressing current state.
  batch := jsonb_build_object('sequence',3,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.8','device_name','OLD-NAME','device_type','Switch','observed_at',now()-interval '2 minutes','result','success','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF NOT EXISTS (SELECT 1 FROM network_devices WHERE network_devices.id=device AND network_devices.result='timeout' AND network_devices.ip_address::inet='10.44.0.7'::inet) THEN RAISE EXCEPTION 'old observation regressed current device'; END IF;

  batch := jsonb_build_object('sequence',4,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now()+interval '1 second','result','timeout','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  batch := jsonb_build_object('sequence',5,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now()+interval '2 seconds','result','timeout','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF NOT EXISTS (SELECT 1 FROM network_devices WHERE network_devices.id=device AND network_devices.status='Sem resposta SNMP') THEN RAISE EXCEPTION 'three timeouts did not produce the SNMP no-response state'; END IF;
  batch := jsonb_build_object('sequence',6,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now()+interval '3 seconds','result','auth_error','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF NOT EXISTS (SELECT 1 FROM network_devices WHERE network_devices.id=device AND network_devices.status='Atencao' AND network_devices.consecutive_failures=0) THEN RAISE EXCEPTION 'authentication error was classified as no response'; END IF;

  BEGIN
    PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_b,
      jsonb_build_object('sequence',7,'collected_at',now(),'devices','[]'::jsonb));
    RAISE EXCEPTION 'cross-company ingest accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='cross-company ingest accepted' THEN RAISE; END IF; END;
  BEGIN
    PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,
      jsonb_build_object('sequence',8,'collected_at',now(),'devices',jsonb_build_array(jsonb_build_object('network_id',network_id,'device_uid','outside','ip_address','192.0.2.1','device_name','outside','device_type','Other','observed_at',now(),'result','success','interfaces','[]'::jsonb))));
    RAISE EXCEPTION 'out-of-scope address accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='out-of-scope address accepted' THEN RAISE; END IF; END;
  IF has_function_privilege('anon','ingest_network_metric_batch(uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'anon can execute ingestion'; END IF;
END $$;
