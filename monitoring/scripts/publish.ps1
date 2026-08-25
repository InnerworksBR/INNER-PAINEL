# Inner Monitoring - Publish Script
# Gera binarios auto-contidos (single-file) para distribuicao no cliente.
#
# Uso:
#   .\publish.ps1                                  # publica Agent (win-x64) e Edge Collector (win-x64 + linux-x64)
#   .\publish.ps1 -SkipAgent                       # so Edge Collector
#   .\publish.ps1 -SkipCollector                   # so Agent
#   .\publish.ps1 -OutputDir "C:\dist\inner"       # muda a pasta de saida
#   .\publish.ps1 -Version "1.1.0"                 # sobrescreve a versao dos binarios
#
# Saida (padrao em .\dist):
#   .\dist\agent\win-x64\Inner.Monitoring.Agent.Windows.exe
#   .\dist\collector\win-x64\Inner.Monitoring.Edge.Collector.exe
#   .\dist\collector\linux-x64\Inner.Monitoring.Edge.Collector
#   .\dist\info.txt                                # resumo com tamanhos e versoes

[CmdletBinding()]
param(
    [switch]$SkipAgent = $false,
    [switch]$SkipCollector = $false,
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\dist"),
    [string]$Configuration = "Release",
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "=== $Message ===" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# ---------------------------------------------------------
# Pre-checks
# ---------------------------------------------------------

Write-Step "Pre-checks"

try {
    $dotnetVersion = (& dotnet --version).Trim()
    Write-Ok ".NET SDK detectado: $dotnetVersion"
}
catch {
    Write-Err ".NET SDK nao encontrado no PATH. Instale o .NET 8 SDK."
    exit 1
}

$majorVersion = ($dotnetVersion.Split('.')[0])
if ($majorVersion -lt 8) {
    Write-Warn "Detectado .NET $dotnetVersion. Recomendado .NET 8 ou superior. Continuando..."
}

if (-not $Version) {
    # Tenta pegar do AssemblyInfo do Agent; fallback para 1.0.0
    $Version = "1.0.0"
    try {
        $agentCsproj = Join-Path $PSScriptRoot "..\src\Inner.Monitoring.Agent.Windows\Inner.Monitoring.Agent.Windows.csproj"
        if (Test-Path $agentCsproj) {
            [xml]$csproj = Get-Content $agentCsproj
            if ($csproj.Project.PropertyGroup.Version) {
                $Version = $csproj.Project.PropertyGroup.Version
            }
        }
    }
    catch {
        # Mantem 1.0.0
    }
}
Write-Ok "Versao dos binarios: $Version"

# Resolve caminhos
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$solutionPath = Join-Path $repoRoot "Inner.Monitoring.sln"
# Garante que o diretorio de saida existe; Resolve-Path falha em caminhos ausentes no PS5.1
$resolvedOutput = Resolve-Path -LiteralPath $OutputDir -ErrorAction SilentlyContinue
if ($resolvedOutput) {
    $publishRoot = $resolvedOutput.Path
}
else {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    $publishRoot = (Resolve-Path -LiteralPath $OutputDir).Path
}

if (-not (Test-Path $solutionPath)) {
    Write-Err "Solucao nao encontrada em: $solutionPath"
    exit 1
}

# Limpa outputs anteriores (apenas os diretorios desta run)
foreach ($dir in @("agent", "collector")) {
    $fullPath = Join-Path $publishRoot $dir
    if (Test-Path $fullPath) {
        Remove-Item $fullPath -Recurse -Force
    }
}

# ---------------------------------------------------------
# Agent (Windows only)
# ---------------------------------------------------------

if (-not $SkipAgent) {
    Write-Step "Publicando Inner Agent (Windows x64)"

    $agentProject = "src\Inner.Monitoring.Agent.Windows\Inner.Monitoring.Agent.Windows.csproj"
    $agentOutDir = Join-Path $publishRoot "agent\win-x64"

    $publishArgs = @(
        "publish", $agentProject,
        "-c", $Configuration,
        "-r", "win-x64",
        "--self-contained", "true",
        "-o", $agentOutDir,
        "-p:PublishSingleFile=true",
        "-p:IncludeNativeLibrariesForSelfExtract=true",
        "-p:EnableCompressionInSingleFile=true",
        "-p:DebugType=embedded",
        "-p:Version=$Version",
        "--nologo"
    )

    Write-Host "Comando: dotnet $($publishArgs -join ' ')"
    & dotnet @publishArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Falha ao publicar o Agent (exit $LASTEXITCODE)."
        exit 1
    }

    $agentExe = Join-Path $agentOutDir "Inner.Monitoring.Agent.Windows.exe"
    if (Test-Path $agentExe) {
        $agentSize = "{0:N2} MB" -f ((Get-Item $agentExe).Length / 1MB)
        Write-Ok "Agent publicado: $agentExe ($agentSize)"
    }
    else {
        Write-Err "Binario do Agent nao encontrado em $agentExe"
        exit 1
    }
}

# ---------------------------------------------------------
# Edge Collector (Windows + Linux)
# ---------------------------------------------------------

if (-not $SkipCollector) {
    Write-Step "Publicando Inner Edge Collector (Windows x64)"

    $collectorProject = "src\Inner.Monitoring.Edge.Collector\Inner.Monitoring.Edge.Collector.csproj"
    $collectorWinOut = Join-Path $publishRoot "collector\win-x64"

    $winArgs = @(
        "publish", $collectorProject,
        "-c", $Configuration,
        "-r", "win-x64",
        "--self-contained", "true",
        "-o", $collectorWinOut,
        "-p:PublishSingleFile=true",
        "-p:IncludeNativeLibrariesForSelfExtract=true",
        "-p:EnableCompressionInSingleFile=true",
        "-p:DebugType=embedded",
        "-p:Version=$Version",
        "--nologo"
    )

    Write-Host "Comando: dotnet $($winArgs -join ' ')"
    & dotnet @winArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Falha ao publicar o Collector para Windows (exit $LASTEXITCODE)."
        exit 1
    }

    $collectorWinExe = Join-Path $collectorWinOut "Inner.Monitoring.Edge.Collector.exe"
    if (Test-Path $collectorWinExe) {
        $winSize = "{0:N2} MB" -f ((Get-Item $collectorWinExe).Length / 1MB)
        Write-Ok "Collector (Windows): $collectorWinExe ($winSize)"
    }
    else {
        Write-Err "Binario Windows do Collector nao encontrado."
        exit 1
    }

    Write-Step "Publicando Inner Edge Collector (Linux x64)"

    $collectorLinuxOut = Join-Path $publishRoot "collector\linux-x64"

    $linuxArgs = @(
        "publish", $collectorProject,
        "-c", $Configuration,
        "-r", "linux-x64",
        "--self-contained", "true",
        "-o", $collectorLinuxOut,
        "-p:PublishSingleFile=true",
        "-p:IncludeNativeLibrariesForSelfExtract=true",
        "-p:EnableCompressionInSingleFile=true",
        "-p:DebugType=embedded",
        "-p:Version=$Version",
        "--nologo"
    )

    Write-Host "Comando: dotnet $($linuxArgs -join ' ')"
    & dotnet @linuxArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Falha ao publicar o Collector para Linux (exit $LASTEXITCODE)."
        exit 1
    }

    $collectorLinuxBin = Join-Path $collectorLinuxOut "Inner.Monitoring.Edge.Collector"
    if (Test-Path $collectorLinuxBin) {
        $linuxSize = "{0:N2} MB" -f ((Get-Item $collectorLinuxBin).Length / 1MB)
        Write-Ok "Collector (Linux): $collectorLinuxBin ($linuxSize)"
    }
    else {
        Write-Err "Binario Linux do Collector nao encontrado."
        exit 1
    }
}

# ---------------------------------------------------------
# Resumo
# ---------------------------------------------------------

Write-Step "Resumo"

$infoPath = Join-Path $publishRoot "info.txt"
$infoLines = @()
$infoLines += "Inner Monitoring - Build de distribuicao"
$infoLines += "Versao:        $Version"
$infoLines += "Configuracao:  $Configuration"
$infoLines += "Data:          $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$infoLines += "Origem:        $repoRoot"
$infoLines += ""
$infoLines += "Binarios:"

if (-not $SkipAgent -and (Test-Path $agentExe)) {
    $infoLines += "  Agent (Windows):       $agentExe ($agentSize)"
}
if (-not $SkipCollector -and (Test-Path $collectorWinExe)) {
    $infoLines += "  Collector (Windows):   $collectorWinExe ($winSize)"
}
if (-not $SkipCollector -and (Test-Path $collectorLinuxBin)) {
    $infoLines += "  Collector (Linux):     $collectorLinuxBin ($linuxSize)"
}

$infoLines | Out-File -FilePath $infoPath -Encoding utf8
Get-Content $infoPath | ForEach-Object { Write-Host $_ }

Write-Step "Proximos passos"
Write-Host "1. Copie o conteudo de $publishRoot\agent\win-x64 para o servidor do cliente (Windows)."
Write-Host "2. Copie o conteudo de $publishRoot\collector\win-x64 ou linux-x64 para o ponto de coleta."
Write-Host "3. Execute o binario com os parametros --portal, --asset-key e --token."
Write-Host "   Exemplo: Inner.Monitoring.Agent.Windows.exe --install --portal https://portal.inner.com.br --asset-key srv-rj-01 --token INNER-XXXX"
Write-Host ""
Write-Ok "Publish concluido."