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
  'network-agent-migration.integration.sql'
)
foreach ($file in $files) {
  $path = Join-Path $PSScriptRoot $file
  Get-Content -LiteralPath $path -Raw | docker exec -i $Container psql -U postgres -d $dbName -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL regression step failed: $file" }
}
Write-Output "PASS: migrations 022-024 and network-agent integration fixture in $dbName (container $Container)."
