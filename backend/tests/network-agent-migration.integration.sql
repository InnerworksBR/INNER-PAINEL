-- Run only against a disposable PostgreSQL database after migrations 022 and 023.
-- The schema fixture must include companies, registered_agents, network_devices,
-- network_status_history, monitoring_events, and asset_profiles from migrations 001-019.
DO $$
DECLARE
  company_a uuid; company_b uuid; pairing uuid; pairing2 uuid; pairing3 uuid; pairing4 uuid; pairing5 uuid; credential uuid; machine text := gen_random_uuid()::text; code_hash text := encode(gen_random_bytes(32),'hex'); secret text := repeat('s',64); refresh_hash text := encode(gen_random_bytes(32),'hex'); replacement_hash text := encode(gen_random_bytes(32),'hex');
  agent jsonb; other_agent jsonb; config jsonb; network_id text; batch jsonb; result jsonb; device uuid;
  shared_scope uuid; shared_device uuid; second_agent jsonb; second_config jsonb; third_agent jsonb; third_config jsonb; fourth_agent jsonb; fourth_config jsonb; before_version bigint; removed jsonb; cleanup_iteration integer; hidden_event uuid;
BEGIN
  -- Keep repeated fixture runs deterministic by draining leftovers from earlier successful runs.
  FOR cleanup_iteration IN 1..10 LOOP
    removed := purge_network_agent_raw_data(5000);
    EXIT WHEN removed->>'has_more_batches'='false' AND removed->>'has_more_samples'='false';
  END LOOP;
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
  before_version := (config->>'version')::bigint;
  PERFORM replace_network_snmp_credential(company_a,credential,jsonb_build_object('name','integration-test-replaced','version','2c','key_version','v1','iv','iv-new','ciphertext','cipher-new','auth_tag','tag-new'));
  config := get_agent_network_configuration((agent->>'agent_id')::uuid);
  IF (config->>'version')::bigint <= before_version OR config->'credentials'->0->>'ciphertext' <> 'cipher-new' THEN RAISE EXCEPTION 'linked credential replacement did not update agent config/version atomically'; END IF;
  IF NOT delete_network_snmp_credential(company_a,credential) THEN RAISE EXCEPTION 'credential deletion failed'; END IF;
  IF jsonb_array_length(get_agent_network_configuration((agent->>'agent_id')::uuid)->'credentials')<>0 THEN RAISE EXCEPTION 'deleted credential remained linked'; END IF;
  -- Re-add the saved network with no credential so subsequent ingest scopes remain stable.
  config := save_network_agent_configuration((agent->>'agent_id')::uuid,company_a,
    jsonb_build_object('version',1,'enabled',true,'collection_interval_seconds',60,'discovery_interval_seconds',900,
      'networks',jsonb_build_array(jsonb_build_object('id',config->'networks'->0->>'id','cidr','10.44.0.0/24','enabled',true,'snmp_port',161,'excluded_ips','[]'::jsonb,'credential_ids','[]'::jsonb))));
  network_id := config->'networks'->0->>'id';
  batch := jsonb_build_object('sequence',1,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now()-interval '30 seconds','result','success','manufacturer','Fixture Vendor','firmware_version','1.0','serial_number','fixture-serial','sys_contact','noc@example.invalid','interfaces',jsonb_build_array(jsonb_build_object('if_index',1,'name','eth0','if_type',6)))));
  result := ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF result->>'status' <> 'accepted' THEN RAISE EXCEPTION 'first batch not accepted'; END IF;
  result := ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF result->>'status' <> 'duplicate' THEN RAISE EXCEPTION 'duplicate batch not idempotent'; END IF;
  IF (SELECT count(*) FROM network_device_samples WHERE agent_id=(agent->>'agent_id')::uuid AND sequence=1) <> 1 THEN RAISE EXCEPTION 'duplicate sample written'; END IF;

  -- A newer timeout changes poll status but preserves last successful interfaces.
  batch := jsonb_build_object('sequence',2,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','10.44.0.7','device_type','Outro','observed_at',now(),'result','timeout','manufacturer','Wrong Vendor','firmware_version','wrong','sys_contact',null,'interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  SELECT id INTO device FROM network_devices WHERE agent_id=(agent->>'agent_id')::uuid AND device_uid='stable-device';
  IF NOT EXISTS (SELECT 1 FROM network_devices WHERE network_devices.id=device AND network_devices.result='timeout' AND jsonb_array_length(network_devices.interfaces)=1) THEN RAISE EXCEPTION 'failed poll erased interfaces'; END IF;
  IF NOT EXISTS (SELECT 1 FROM network_devices WHERE network_devices.id=device AND manufacturer='Fixture Vendor' AND firmware_version='1.0' AND sys_contact='noc@example.invalid' AND interfaces->0->>'if_type'='6') THEN RAISE EXCEPTION 'partial or timeout observation damaged persisted serializer inventory'; END IF;
  IF NOT EXISTS (SELECT 1 FROM network_device_samples WHERE device_id=device AND sequence=1 AND payload->>'sys_contact'='noc@example.invalid' AND payload->'interfaces'->0->>'if_type'='6') THEN RAISE EXCEPTION 'raw sample did not retain optional serializer fields'; END IF;
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
  batch := jsonb_build_object('sequence',7,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now()+interval '4 seconds','result','success','manufacturer','Fixture Vendor','firmware_version','2.0','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF NOT EXISTS (SELECT 1 FROM asset_profiles WHERE source_id=device AND firmware_version='2.0') THEN RAISE EXCEPTION 'newer auto firmware did not refresh asset profile'; END IF;
  UPDATE asset_profiles SET firmware_version='manual-fw',manual_override_fields=ARRAY['firmware_version'] WHERE source_id=device;
  batch := jsonb_build_object('sequence',8,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',network_id,'device_uid','stable-device','ip_address','10.44.0.7','device_name','SW-A','device_type','Switch','observed_at',now()+interval '5 seconds','result','success','firmware_version','3.0','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,batch);
  IF NOT EXISTS (SELECT 1 FROM asset_profiles WHERE source_id=device AND firmware_version='manual-fw') THEN RAISE EXCEPTION 'manual firmware override was overwritten'; END IF;

  BEGIN
    PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_b,
      jsonb_build_object('sequence',9,'collected_at',now(),'devices','[]'::jsonb));
    RAISE EXCEPTION 'cross-company ingest accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='cross-company ingest accepted' THEN RAISE; END IF; END;
  BEGIN
    PERFORM ingest_network_metric_batch((agent->>'agent_id')::uuid,company_a,
      jsonb_build_object('sequence',10,'collected_at',now(),'devices',jsonb_build_array(jsonb_build_object('network_id',network_id,'device_uid','outside','ip_address','192.0.2.1','device_name','outside','device_type','Other','observed_at',now(),'result','success','interfaces','[]'::jsonb))));
    RAISE EXCEPTION 'out-of-scope address accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='out-of-scope address accepted' THEN RAISE; END IF; END;
  IF has_function_privilege('anon','ingest_network_metric_batch(uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'anon can execute ingestion'; END IF;
  INSERT INTO monitoring_events(company_id,source,entity_name,entity_type,current_status,severity,message,metadata)
  VALUES(company_a,'network','SW-A','network_device','Online','info','hidden fixture event',jsonb_build_object('network_device_id',device)) RETURNING id INTO hidden_event;
  UPDATE asset_profiles SET customer_visible=false WHERE company_id=company_a AND source_type='network_device' AND source_id=device;
  IF EXISTS(SELECT 1 FROM get_visible_network_events(company_a,50) WHERE id=hidden_event) THEN RAISE EXCEPTION 'visible event projection leaked a hidden asset event'; END IF;
  UPDATE asset_profiles SET customer_visible=true WHERE company_id=company_a AND source_type='network_device' AND source_id=device;
  IF NOT EXISTS(SELECT 1 FROM get_visible_network_events(company_a,50) WHERE id=hidden_event) THEN RAISE EXCEPTION 'visible event projection omitted a customer-visible event'; END IF;

  -- Retention is bounded and affects only raw payloads, not current state or audit history.
  INSERT INTO network_agent_batches(agent_id,company_id,sequence,collected_at,payload) VALUES
    ((agent->>'agent_id')::uuid,company_a,998,now()-interval '32 days','{}'::jsonb),
    ((agent->>'agent_id')::uuid,company_a,999,now()-interval '31 days','{}'::jsonb);
  INSERT INTO network_device_samples(device_id,company_id,agent_id,sequence,observed_at,result,payload) VALUES
    (device,company_a,(agent->>'agent_id')::uuid,998,now()-interval '32 days','success','{}'::jsonb),
    (device,company_a,(agent->>'agent_id')::uuid,999,now()-interval '31 days','success','{}'::jsonb);
  removed := purge_network_agent_raw_data(1);
  IF (removed->>'batches_deleted')::integer <> 1 OR (removed->>'samples_deleted')::integer <> 1 THEN RAISE EXCEPTION 'bounded raw retention did not delete one old row of each kind'; END IF;
  IF removed->>'has_more_batches' <> 'true' OR removed->>'has_more_samples' <> 'true' THEN RAISE EXCEPTION 'bounded raw retention failed to report backlog'; END IF;
  IF (SELECT count(*) FROM network_agent_batches WHERE agent_id=(agent->>'agent_id')::uuid AND collected_at<now()-interval '30 days') <> 1 OR (SELECT count(*) FROM network_device_samples WHERE agent_id=(agent->>'agent_id')::uuid AND observed_at<now()-interval '30 days') <> 1 THEN RAISE EXCEPTION 'raw retention exceeded the requested batch bound'; END IF;
  removed := purge_network_agent_raw_data(1);
  IF (removed->>'batches_deleted')::integer <> 1 OR (removed->>'samples_deleted')::integer <> 1 OR removed->>'has_more_batches' <> 'false' OR removed->>'has_more_samples' <> 'false' THEN RAISE EXCEPTION 'bounded raw retention did not report an empty backlog'; END IF;
  IF NOT EXISTS(SELECT 1 FROM network_devices WHERE id=device AND status='Online' AND firmware_version='3.0') THEN RAISE EXCEPTION 'raw retention deleted current state'; END IF;
  IF NOT EXISTS(SELECT 1 FROM network_status_history WHERE network_device_id=device) THEN RAISE EXCEPTION 'raw retention deleted status history'; END IF;

  -- Shared physical scopes require an authorized same-company record and trusted identity.
  IF to_regclass('public.network_physical_scopes') IS NULL THEN RAISE EXCEPTION 'physical scope registry is missing'; END IF;
  INSERT INTO network_physical_scopes(company_id,name) VALUES(company_a,'HQ core') RETURNING id INTO shared_scope;
  pairing4 := create_network_pairing(gen_random_uuid()::text,'other-company-host','1.0','Windows','[]',encode(gen_random_bytes(32),'hex'),repeat('o',64),now()+interval '15 minutes');
  PERFORM claim_network_pairing(company_b,gen_random_uuid(),(SELECT p.code_hash FROM network_agent_pairings p WHERE p.id=pairing4));
  other_agent := complete_network_pairing(pairing4,repeat('o',64),encode(gen_random_bytes(32),'hex'),encode(gen_random_bytes(32),'hex'));
  BEGIN
    PERFORM save_network_agent_configuration((other_agent->>'agent_id')::uuid,company_b,jsonb_build_object('version',1,'enabled',true,'collection_interval_seconds',60,'discovery_interval_seconds',900,'networks',jsonb_build_array(jsonb_build_object('cidr','10.45.0.0/24','enabled',true,'network_scope_id',shared_scope))));
    RAISE EXCEPTION 'cross-company physical scope assignment accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='cross-company physical scope assignment accepted' THEN RAISE; END IF; END;
  pairing2 := create_network_pairing(gen_random_uuid()::text,'second-host','1.0','Windows','[]',encode(gen_random_bytes(32),'hex'),repeat('t',64),now()+interval '15 minutes');
  PERFORM claim_network_pairing(company_a,gen_random_uuid(),(SELECT p.code_hash FROM network_agent_pairings p WHERE p.id=pairing2));
  second_agent := complete_network_pairing(pairing2,repeat('t',64),repeat('u',64),repeat('v',64));
  second_config := save_network_agent_configuration((second_agent->>'agent_id')::uuid,company_a,
    jsonb_build_object('version',1,'enabled',true,'collection_interval_seconds',60,'discovery_interval_seconds',900,
      'networks',jsonb_build_array(jsonb_build_object('cidr','10.44.1.0/24','enabled',true,'network_scope_id',shared_scope,'credential_ids','[]'::jsonb))));
  -- Chassis/serial can reconcile devices only inside the same explicit shared scope.
  batch := jsonb_build_object('sequence',1,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',second_config->'networks'->0->>'id','device_uid','different-local-uid','ip_address','10.44.1.9','device_name','renamed-switch','device_type','Switch','serial_number',' CHASSIS-42 ','manufacturer','Acme','model','Core S1','firmware_version','1.0','location','Rack A','engine_id','engine-a','observed_at',now(),'result','success','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((second_agent->>'agent_id')::uuid,company_a,batch);
  SELECT id INTO shared_device FROM network_devices WHERE company_id=company_a AND network_scope_id=shared_scope AND trusted_identity_value='chassis-42';
  IF (SELECT count(*) FROM network_devices WHERE company_id=company_a AND network_scope_id=shared_scope AND trusted_identity_kind='serial' AND trusted_identity_value='chassis-42') <> 1 THEN RAISE EXCEPTION 'shared trusted serial identity created duplicate device'; END IF;
  IF NOT EXISTS(SELECT 1 FROM network_devices WHERE id=shared_device AND ip_address::inet='10.44.1.9'::inet AND device_name='renamed-switch') THEN RAISE EXCEPTION 'shared trusted serial identity did not reconcile current device'; END IF;
  pairing3 := create_network_pairing(gen_random_uuid()::text,'third-host','1.0','Windows','[]',encode(gen_random_bytes(32),'hex'),repeat('w',64),now()+interval '15 minutes');
  PERFORM claim_network_pairing(company_a,gen_random_uuid(),(SELECT p.code_hash FROM network_agent_pairings p WHERE p.id=pairing3));
  third_agent := complete_network_pairing(pairing3,repeat('w',64),repeat('x',64),repeat('y',64));
  third_config := save_network_agent_configuration((third_agent->>'agent_id')::uuid,company_a,
    jsonb_build_object('version',1,'enabled',true,'collection_interval_seconds',60,'discovery_interval_seconds',900,
      'networks',jsonb_build_array(jsonb_build_object('cidr','10.44.2.0/24','enabled',true,'network_scope_id',shared_scope,'credential_ids','[]'::jsonb))));
  batch := jsonb_build_object('sequence',1,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',third_config->'networks'->0->>'id','device_uid','third-local-uid','ip_address','10.44.2.9','device_name','renamed-switch-2','device_type','Switch','serial_number','chassis-42','manufacturer','OtherVendor','model','Conflict Model','firmware_version','9.9','location','Other Rack','engine_id','engine-b','observed_at',now()-interval '1 minute','result','timeout','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((third_agent->>'agent_id')::uuid,company_a,batch);
  IF (SELECT count(*) FROM network_devices WHERE company_id=company_a AND network_scope_id=shared_scope AND trusted_identity_value='chassis-42') <> 1 THEN RAISE EXCEPTION 'shared physical scope did not reconcile across collectors'; END IF;
  IF NOT EXISTS(SELECT 1 FROM network_devices WHERE company_id=company_a AND network_scope_id=shared_scope AND trusted_identity_kind='engine_id' AND trusted_identity_value='engine-b' AND id<>shared_device) THEN RAISE EXCEPTION 'conflicting chassis and engine evidence was merged instead of quarantined as a separate identity'; END IF;
  IF NOT EXISTS(SELECT 1 FROM network_devices WHERE id=shared_device AND ip_address::inet='10.44.1.9'::inet AND device_name='renamed-switch' AND status='Online' AND manufacturer='Acme' AND model='Core S1' AND serial_number=' CHASSIS-42 ' AND firmware_version='1.0' AND location='Rack A' AND engine_id='engine-a') THEN RAISE EXCEPTION 'stale shared-scope observation regressed device metadata or state'; END IF;
  IF NOT EXISTS(SELECT 1 FROM asset_profiles WHERE company_id=company_a AND source_type='network_device' AND source_id=shared_device AND manufacturer='Acme' AND model='Core S1' AND firmware_version='1.0' AND location='Rack A') THEN RAISE EXCEPTION 'stale shared-scope observation regressed the derived asset profile'; END IF;
  batch := jsonb_build_object('sequence',2,'collected_at',now(),'devices',jsonb_build_array(
    jsonb_build_object('network_id',second_config->'networks'->0->>'id','device_uid','different-local-uid','ip_address','10.44.1.9','device_name','renamed-switch','device_type','Switch','observed_at',now()+interval '5 seconds','result','timeout','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((second_agent->>'agent_id')::uuid,company_a,batch);
  IF (SELECT count(*) FROM network_devices WHERE company_id=company_a AND network_scope_id=shared_scope AND trusted_identity_value='chassis-42') <> 1 THEN RAISE EXCEPTION 'known collector timeout without fresh chassis identity created a duplicate'; END IF;
  IF NOT EXISTS(SELECT 1 FROM network_status_history WHERE network_device_id=shared_device AND collected_at>=now()-interval '1 minute' AND status='Atencao') THEN RAISE EXCEPTION 'known collector timeout was not attached to the bound shared device history'; END IF;
  pairing5 := create_network_pairing(gen_random_uuid()::text,'separate-scope-host','1.0','Windows','[]',encode(gen_random_bytes(32),'hex'),repeat('p',64),now()+interval '15 minutes');
  PERFORM claim_network_pairing(company_a,gen_random_uuid(),(SELECT p.code_hash FROM network_agent_pairings p WHERE p.id=pairing5));
  fourth_agent := complete_network_pairing(pairing5,repeat('p',64),encode(gen_random_bytes(32),'hex'),encode(gen_random_bytes(32),'hex'));
  fourth_config := save_network_agent_configuration((fourth_agent->>'agent_id')::uuid,company_a,jsonb_build_object('version',1,'enabled',true,'collection_interval_seconds',60,'discovery_interval_seconds',900,'networks',jsonb_build_array(jsonb_build_object('cidr','10.44.2.0/24','enabled',true,'credential_ids','[]'::jsonb))));
  batch := jsonb_build_object('sequence',1,'collected_at',now(),'devices',jsonb_build_array(jsonb_build_object('network_id',fourth_config->'networks'->0->>'id','device_uid','local-only-uid','ip_address','10.44.2.9','device_name','renamed-switch-2','device_type','Switch','serial_number','chassis-42','observed_at',now()+interval '2 seconds','result','success','interfaces','[]'::jsonb)));
  PERFORM ingest_network_metric_batch((fourth_agent->>'agent_id')::uuid,company_a,batch);
  IF (SELECT count(*) FROM network_devices WHERE company_id=company_a AND trusted_identity_value='chassis-42') <> 2 THEN RAISE EXCEPTION 'separate default scopes merged by IP/name/serial without authorization'; END IF;

  -- Refresh requests are idempotent only for the already-stored replacement hash and active network agents.
  result := rotate_network_agent_refresh_token(refresh_hash,replacement_hash);
  IF result->>'id' <> agent->>'agent_id' THEN RAISE EXCEPTION 'network refresh rotation failed'; END IF;
  IF rotate_network_agent_refresh_token(refresh_hash,replacement_hash)->>'id' <> agent->>'agent_id' THEN RAISE EXCEPTION 'lost-response refresh retry failed'; END IF;
  IF rotate_network_agent_refresh_token(refresh_hash,encode(gen_random_bytes(32),'hex')) IS NOT NULL THEN RAISE EXCEPTION 'wrong refresh replacement accepted'; END IF;
  UPDATE registered_agents SET status='Revoked' WHERE id=(agent->>'agent_id')::uuid;
  IF rotate_network_agent_refresh_token(replacement_hash,encode(gen_random_bytes(32),'hex')) IS NOT NULL THEN RAISE EXCEPTION 'revoked network refresh accepted'; END IF;
END $$;
