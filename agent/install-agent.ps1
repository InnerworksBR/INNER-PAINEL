[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$ActivationToken,

    [string]$PackagePath = (Join-Path $PSScriptRoot "artifacts\Inner.Agent.Windows-win-x64.zip"),
    [string]$InstallRoot = "C:\Program Files\InnerWorks\InnerAgent",
    [switch]$AllowInsecureHttp
)

$ErrorActionPreference = "Stop"
$serviceName = "InnerHyperVAgent"
$dataDirectory = "C:\ProgramData\InnerWorks\InnerAgent"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Execute este instalador como Administrador."
}
if (-not $AllowInsecureHttp -and $ApiBaseUrl -notmatch '^https://') {
    throw "A API deve usar HTTPS. Use -AllowInsecureHttp somente em laboratório."
}
if ([string]::IsNullOrWhiteSpace($ActivationToken)) {
    throw "ActivationToken não pode ser vazio."
}
if (-not (Test-Path -LiteralPath $PackagePath)) {
    throw "Pacote não encontrado: $PackagePath"
}

$staging = Join-Path $env:TEMP ("inner-agent-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
try {
    if ([IO.Path]::GetExtension($PackagePath) -eq ".zip") {
        Expand-Archive -LiteralPath $PackagePath -DestinationPath $staging -Force
    } else {
        Copy-Item -LiteralPath (Join-Path $PackagePath "*") -Destination $staging -Recurse -Force
    }

    $executable = Join-Path $staging "Inner.Agent.Windows.exe"
    if (-not (Test-Path -LiteralPath $executable)) {
        throw "Inner.Agent.Windows.exe não encontrado no pacote."
    }

    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existing) {
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $serviceName | Out-Null
        Start-Sleep -Seconds 1
    }

    New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
    icacls $dataDirectory /inheritance:r /grant:r "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)" | Out-Null
    Copy-Item -LiteralPath (Join-Path $staging "*") -Destination $InstallRoot -Recurse -Force

    $configPath = Join-Path $InstallRoot "appsettings.json"
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $config.Agent.ApiBaseUrl = $ApiBaseUrl.TrimEnd("/")
    $config.Agent.DataDirectory = $dataDirectory
    $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8

    $bootstrapPath = Join-Path $InstallRoot "bootstrap.json"
    @{ activation_token = $ActivationToken; created_at = [DateTime]::UtcNow.ToString("O") } |
        ConvertTo-Json | Set-Content -LiteralPath $bootstrapPath -Encoding UTF8
    icacls $bootstrapPath /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(R)" | Out-Null

    $installedExecutable = Join-Path $InstallRoot "Inner.Agent.Windows.exe"
    $binPath = '"' + $installedExecutable + '"'
    sc.exe create $serviceName binPath= $binPath start= auto obj= LocalSystem DisplayName= "Inner Hyper-V Agent" | Out-Null
    sc.exe description $serviceName "Coleta host Hyper-V e suas máquinas virtuais para o painel Inner." | Out-Null
    Start-Service -Name $serviceName
    Write-Host "Agente instalado e iniciado como serviço $serviceName."
} finally {
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
}
