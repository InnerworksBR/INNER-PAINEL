# Inner PAINEL - Deploy Rápido
# Instala Agente e Coletor SNMP com um único comando

param(
    [Parameter(Mandatory=$true)]
    [string]$PortalUrl,

    [Parameter(Mandatory=$true)]
    [string]$ActivationToken,

    [ValidateSet("both", "agent", "collector")]
    [string]$Component = "both",

    [string]$IpRangeStart = "192.168.1.1",

    [string]$IpRangeEnd = "192.168.1.254",

    [string]$CommunityString = "public"
)

$ErrorActionPreference = "Stop"
$Script:Version = "1.0.0"

function Write-DeployLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "$timestamp [$Level] $Message"
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-ScriptDirectory {
    if ($PSScriptRoot) { return $PSScriptRoot }
    return Split-Path -Parent $MyInvocation.MyCommand.Path
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Inner PAINEL - Deploy Rápido" -ForegroundColor Cyan
Write-Host "  Versão $Script:Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar administrator
if (-not (Test-Administrator)) {
    Write-Host "ERRO: Execute como Administrador." -ForegroundColor Red
    exit 1
}

$scriptDir = Get-ScriptDirectory
$agentScript = "$scriptDir\install-agent.ps1"
$collectorScript = "$scriptDir\install-collector.ps1"

Write-DeployLog "Portal: $PortalUrl"
Write-DeployLog "Componente: $Component"
Write-Host ""

# Validar scripts existem
if ($Component -in @("both", "agent") -and -not (Test-Path $agentScript)) {
    Write-Host "ERRO: Script do Agente não encontrado: $agentScript" -ForegroundColor Red
    exit 1
}

if ($Component -in @("both", "collector") -and -not (Test-Path $collectorScript)) {
    Write-Host "ERRO: Script do Coletor não encontrado: $collectorScript" -ForegroundColor Red
    exit 1
}

$errors = @()

# Instalar Agente
if ($Component -in @("both", "agent")) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Instalando Inner Agent..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    try {
        & $agentScript -PortalUrl $PortalUrl -ActivationToken $ActivationToken
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            $errors += "Agent: Exit code $LASTEXITCODE"
        }
    } catch {
        $errors += "Agent: $($_.Exception.Message)"
    }
    Write-Host ""
}

# Instalar Coletor
if ($Component -in @("both", "collector")) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Instalando Inner SNMP Collector..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    try {
        & $collectorScript `
            -PortalUrl $PortalUrl `
            -ActivationToken $ActivationToken `
            -IpRangeStart $IpRangeStart `
            -IpRangeEnd $IpRangeEnd `
            -CommunityString $CommunityString
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            $errors += "Collector: Exit code $LASTEXITCODE"
        }
    } catch {
        $errors += "Collector: $($_.Exception.Message)"
    }
    Write-Host ""
}

# Resultado final
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESULTADO DO DEPLOY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($errors.Count -eq 0) {
    Write-Host "SUCESSO! Todos os componentes instalados." -ForegroundColor Green
    Write-Host ""
    Write-Host "Serviços instalados:" -ForegroundColor White
    Write-Host "  - InnerAgent (Agente de Host/VMs)" -ForegroundColor Cyan
    Write-Host "  - InnerSnmpCollector (Coletor de Rede)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Verificar status:" -ForegroundColor White
    Write-Host "  Get-Service InnerAgent, InnerSnmpCollector" -ForegroundColor Yellow
} else {
    Write-Host "ERROS detectados:" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "  - $err" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Verifique os logs em:" -ForegroundColor Yellow
    Write-Host "  $env:ProgramFiles\InnerAgent\install.log" -ForegroundColor Gray
    Write-Host "  $env:ProgramFiles\InnerSnmpCollector\install.log" -ForegroundColor Gray
}

Write-Host ""
