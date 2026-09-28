[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiBaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$ActivationTokenFile,

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
    throw "A API deve usar HTTPS. Use -AllowInsecureHttp somente em laboratorio."
}
if (-not (Test-Path -LiteralPath $ActivationTokenFile)) {
    throw "Arquivo de token nao encontrado: $ActivationTokenFile"
}
if (-not (Test-Path -LiteralPath $PackagePath)) {
    throw "Pacote nao encontrado: $PackagePath"
}

$staging = Join-Path $env:TEMP ("inner-agent-" + [Guid]::NewGuid().ToString("N"))
$tokenSourcePath = (Resolve-Path -LiteralPath $ActivationTokenFile).Path
$tokenText = (Get-Content -LiteralPath $tokenSourcePath -Raw).Trim()
try {
    $tokenObject = $tokenText | ConvertFrom-Json
    $activationToken = [string]$tokenObject.activation_token
} catch {
    $activationToken = $tokenText
}
if ([string]::IsNullOrWhiteSpace($activationToken)) {
    throw "O arquivo de token esta vazio ou nao contem activation_token."
}

$installationSucceeded = $false
New-Item -ItemType Directory -Path $staging -Force | Out-Null
try {
    if ([IO.Path]::GetExtension($PackagePath) -eq ".zip") {
        Expand-Archive -LiteralPath $PackagePath -DestinationPath $staging -Force
    } else {
        Copy-Item -LiteralPath (Join-Path $PackagePath "*") -Destination $staging -Recurse -Force
    }

    $executable = Join-Path $staging "Inner.Agent.Windows.exe"
    if (-not (Test-Path -LiteralPath $executable)) {
        throw "Inner.Agent.Windows.exe nao encontrado no pacote."
    }

    $existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existing) {
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    }

    New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $dataDirectory -Force | Out-Null
    icacls $dataDirectory /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)(F)" "*S-1-5-32-544:(OI)(CI)(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger o diretorio de dados do agente." }
    Copy-Item -LiteralPath (Join-Path $staging "*") -Destination $InstallRoot -Recurse -Force

    $configPath = Join-Path $InstallRoot "appsettings.json"
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $config.Agent.ApiBaseUrl = $ApiBaseUrl.TrimEnd("/")
    $config.Agent.DataDirectory = $dataDirectory
    $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8

    $bootstrapPath = Join-Path $InstallRoot "bootstrap.json"
    @{ activation_token = $activationToken; created_at = [DateTime]::UtcNow.ToString("O") } |
        ConvertTo-Json | Set-Content -LiteralPath $bootstrapPath -Encoding UTF8
    icacls $bootstrapPath /inheritance:r /grant:r "*S-1-5-18:(R)" "*S-1-5-32-544:(R)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger o bootstrap do agente." }

    $installedExecutable = Join-Path $InstallRoot "Inner.Agent.Windows.exe"
    $binPath = '"' + $installedExecutable + '"'
    if ($existing) {
        sc.exe config $serviceName binPath= $binPath start= auto obj= LocalSystem DisplayName= "Inner Hyper-V Agent" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel atualizar o servico do agente." }
    } else {
        sc.exe create $serviceName binPath= $binPath start= auto obj= LocalSystem DisplayName= "Inner Hyper-V Agent" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel criar o servico do agente." }
    }
    sc.exe description $serviceName "Coleta host Hyper-V e suas maquinas virtuais para o painel Inner." | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel configurar a descricao do servico." }
    Start-Service -Name $serviceName
    $installationSucceeded = $true
    Write-Host "Agente instalado e iniciado como servico $serviceName."
} finally {
    if (-not $installationSucceeded -and $existing) {
        Start-Service -Name $serviceName -ErrorAction SilentlyContinue
    }
    if ($installationSucceeded -and (Test-Path -LiteralPath $tokenSourcePath)) {
        Remove-Item -LiteralPath $tokenSourcePath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
}
