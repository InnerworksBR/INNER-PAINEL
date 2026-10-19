param(
    [Parameter(Mandatory = $true)]
    [string] $ApiBaseUrl
)

$ErrorActionPreference = 'Stop'
$agentRoot = $PSScriptRoot
$repoRoot = Split-Path -Parent $agentRoot
$agentProject = Join-Path $agentRoot 'Inner.Network.Agent\Inner.Network.Agent.csproj'
$setupProject = Join-Path $agentRoot 'Inner.Network.Agent.Setup\Inner.Network.Agent.Setup.csproj'
$artifactRoot = Join-Path $agentRoot 'artifacts'
$publishRoot = Join-Path $artifactRoot 'network-publish'
$agentPublish = Join-Path $publishRoot 'agent'
$setupPublish = Join-Path $publishRoot 'setup'
$packageDir = Join-Path $publishRoot 'distribution'
$zipPath = Join-Path $publishRoot 'agent-payload.zip'
$finalZip = Join-Path $artifactRoot 'Inner.Network.Agent-win-x64.zip'
$buildStage = Join-Path ([IO.Path]::GetTempPath()) "inner-network-agent-build-$([guid]::NewGuid().ToString('N'))"

$uri = $null
if (-not [Uri]::TryCreate($ApiBaseUrl, [UriKind]::Absolute, [ref] $uri) -or $uri.Scheme -ne 'https') {
    throw 'ApiBaseUrl must be an absolute HTTPS URL.'
}
$baseUrl = $uri.GetLeftPart([UriPartial]::Authority) + $uri.AbsolutePath.TrimEnd('/')
if ($baseUrl.EndsWith('/api', [StringComparison]::OrdinalIgnoreCase)) { $baseUrl = $baseUrl.Substring(0, $baseUrl.Length - 4) }

function Remove-CheckedTree([string] $candidate, [string] $allowedRoot, [string] $expectedLeaf) {
    $resolvedCandidate = [IO.Path]::GetFullPath($candidate).TrimEnd('\')
    $resolvedRoot = [IO.Path]::GetFullPath($allowedRoot).TrimEnd('\') + '\'
    if (-not $resolvedCandidate.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolvedCandidate) -ne $expectedLeaf) {
        throw "Refusing to remove unexpected path: $resolvedCandidate"
    }
    if (Test-Path -LiteralPath $resolvedCandidate) { Remove-Item -LiteralPath $resolvedCandidate -Recurse -Force }
}

New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
Remove-CheckedTree $publishRoot $artifactRoot 'network-publish'
New-Item -ItemType Directory -Path $agentPublish, $setupPublish, $packageDir, $buildStage -Force | Out-Null
try {
    dotnet publish $agentProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true -o $agentPublish
    if ($LASTEXITCODE -ne 0) { throw "Agent publish failed with exit code $LASTEXITCODE." }

    $configuration = @{ Agent = @{ ApiBaseUrl = $baseUrl; DataDirectory = 'C:\ProgramData\InnerWorks\NetworkAgent' } } | ConvertTo-Json -Depth 4
    [IO.File]::WriteAllText((Join-Path $agentPublish 'appsettings.json'), $configuration, [Text.UTF8Encoding]::new($false))
    Get-ChildItem -LiteralPath $agentPublish -Filter '*.pdb' -File | Remove-Item -Force
    Compress-Archive -Path (Join-Path $agentPublish '*') -DestinationPath $zipPath -CompressionLevel Optimal

    dotnet publish $setupProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true "-p:AgentPackagePath=$zipPath" -o $setupPublish
    if ($LASTEXITCODE -ne 0) { throw "Installer publish failed with exit code $LASTEXITCODE." }

    Copy-Item -LiteralPath (Join-Path $setupPublish 'InnerNetworkAgent-Setup.exe') -Destination $packageDir
    Copy-Item -LiteralPath (Join-Path $setupPublish 'InnerNetworkAgent-Setup.exe') -Destination $artifactRoot -Force
    Copy-Item -LiteralPath (Join-Path $agentRoot 'install-network-agent.ps1'), (Join-Path $agentRoot 'network-agent-status.ps1'), (Join-Path $agentRoot 'NETWORK-AGENT.md') -Destination $packageDir
    Copy-Item -LiteralPath (Join-Path $agentRoot 'THIRD-PARTY-NOTICES.txt') -Destination $packageDir
    if (Test-Path -LiteralPath $finalZip -PathType Leaf) { Remove-Item -LiteralPath $finalZip -Force }
    Compress-Archive -Path (Join-Path $packageDir '*') -DestinationPath $finalZip -CompressionLevel Optimal
    Write-Host "Created standalone installer: $(Join-Path $packageDir 'InnerNetworkAgent-Setup.exe')"
    Write-Host "Created distribution ZIP: $finalZip"
}
finally {
    Remove-CheckedTree $buildStage ([IO.Path]::GetTempPath()) ([IO.Path]::GetFileName($buildStage))
}
