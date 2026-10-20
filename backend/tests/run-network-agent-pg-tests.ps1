param(
  [string]$Container = 'inner-network-agent-db-20261019'
)
$ErrorActionPreference = 'Stop'
if ($Container -ne 'inner-network-agent-db-20261019') { throw 'This harness is restricted to the approved disposable PostgreSQL container.' }
$network = (docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' $Container).Trim()
if ($LASTEXITCODE -ne 0 -or $network -ne 'none') { throw 'Expected the isolated disposable PostgreSQL container with network none.' }
$dbName = 'network_agent_fresh_' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
docker exec $Container createdb -U postgres $dbName
if ($LASTEXITCODE -ne 0) { throw 'Could not create the disposable regression database.' }
$files = @(
  'network-agent-test-bootstrap.sql',
  '..\migration_022_network_agent.sql',
  '..\migration_023_network_agent_retention_scopes.sql',
  '..\migration_024_network_agent_interop.sql',
  '..\migration_025_network_observation_identity.sql',
  'network-agent-migration.integration.sql'
)
foreach ($file in $files) {
  $path = Join-Path $PSScriptRoot $file
  Get-Content -LiteralPath $path -Raw | docker exec -i $Container psql -U postgres -d $dbName -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL regression step failed: $file" }
}
$setup = Join-Path $PSScriptRoot 'network-agent-concurrent-identity.setup.sql'
Get-Content -LiteralPath $setup -Raw | docker exec -i $Container psql -X -U postgres -d $dbName -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL concurrent identity setup failed.' }
$company = '10000000-0000-4000-8000-000000000001'
$scope = '30000000-0000-4000-8000-000000000001'
$serialLock = "$company`:$scope`:serial`:race-chassis"
$batchA = "jsonb_build_object('sequence',1,'collected_at',now(),'devices',jsonb_build_array(jsonb_build_object('network_id','40000000-0000-4000-8000-000000000001','device_uid','local-a','ip_address','10.66.1.9','device_name','race-a','device_type','Switch','serial_number','race-chassis','engine_id','engine-a','manufacturer','Vendor A','observed_at',now(),'result','success','interfaces','[]'::jsonb)))"
$batchB = "jsonb_build_object('sequence',1,'collected_at',now(),'devices',jsonb_build_array(jsonb_build_object('network_id','40000000-0000-4000-8000-000000000002','device_uid','local-b','ip_address','10.66.2.9','device_name','race-b','device_type','Switch','serial_number','race-chassis','engine_id','engine-b','manufacturer','Vendor B','observed_at',now(),'result','success','interfaces','[]'::jsonb)))"
$sessionA = "BEGIN; SET application_name='identity-race-a'; SELECT pg_advisory_xact_lock(hashtextextended('$serialLock',0)); SELECT ingest_network_metric_batch('20000000-0000-4000-8000-000000000001','$company',$batchA); SELECT pg_sleep(5); COMMIT;"
$sessionB = "SET application_name='identity-race-b'; SELECT ingest_network_metric_batch('20000000-0000-4000-8000-000000000002','$company',$batchB);"
docker exec -d $Container psql -X -U postgres -d $dbName -v ON_ERROR_STOP=1 -c $sessionA | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL race session A.' }
Start-Sleep -Milliseconds 250
docker exec -d $Container psql -X -U postgres -d $dbName -v ON_ERROR_STOP=1 -c $sessionB | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not start PostgreSQL race session B.' }
$waitDeadline = [DateTime]::UtcNow.AddSeconds(4)
$waiting = $false
while ([DateTime]::UtcNow -lt $waitDeadline) {
  $waiting = (docker exec $Container psql -X -U postgres -d $dbName -Atc "SELECT count(*) FROM pg_stat_activity WHERE application_name='identity-race-b' AND wait_event='advisory'").Trim() -eq '1'
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect PostgreSQL session wait state.' }
  if ($waiting) { break }
  Start-Sleep -Milliseconds 100
}
if (-not $waiting) { throw 'Second PostgreSQL session never waited on the shared serial lock; concurrent race was not exercised.' }
$finishDeadline = [DateTime]::UtcNow.AddSeconds(8)
do {
  $active = (docker exec $Container psql -X -U postgres -d $dbName -Atc "SELECT count(*) FROM pg_stat_activity WHERE application_name IN ('identity-race-a','identity-race-b')").Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect PostgreSQL race session completion.' }
  if ($active -eq '0') { break }
  Start-Sleep -Milliseconds 100
} while ([DateTime]::UtcNow -lt $finishDeadline)
if ($active -ne '0') { throw 'Concurrent PostgreSQL ingest sessions did not finish within the test deadline.' }
$devices = docker exec $Container psql -X -U postgres -d $dbName -Atc "SELECT count(*) FROM network_devices WHERE company_id='$company' AND network_scope_id='$scope' AND (serial_number='race-chassis' OR engine_id IN ('engine-a','engine-b'))"
if ($LASTEXITCODE -ne 0 -or $devices.Trim() -ne '2') { throw "Conflicting first observations were merged; expected 2 identities, found $devices." }
Write-Output "PASS: migrations 022-025, integration fixture, and concurrent shared-identity regression in $dbName (container $Container)."
