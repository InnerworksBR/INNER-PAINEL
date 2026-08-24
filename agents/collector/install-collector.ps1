# install-collector.ps1
# Script de Instalação do Coletor de Rede Local Inner para Windows

param(
    [string]$ApiUrl = "",
    [string]$ActivationToken = "",
    [string]$SubnetPrefix = "192.168.1"
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   📡 INSTALADOR DO COLETOR DE REDE LOCAL PORTAL INNER" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Perguntar URL da API caso não informada
if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = Read-Host "Informe a URL da API do Portal (Ex: http://localhost:3000/api ou https://painel.suaempresa.com/api)"
}

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    Write-Host "[ERRO] A URL da API é obrigatória!" -ForegroundColor Red
    exit 1
}

$ApiUrl = $ApiUrl.TrimEnd('/')

# 2. Perguntar Token de Ativação caso não informado
if ([string]::IsNullOrWhiteSpace($ActivationToken)) {
    $ActivationToken = Read-Host "Informe a Chave/Token de Ativação da Empresa no Portal (Ex: INNER-KEY-XXXXX)"
}

if ([string]::IsNullOrWhiteSpace($ActivationToken)) {
    Write-Host "[ERRO] A Chave/Token de Ativação é obrigatória!" -ForegroundColor Red
    exit 1
}

# 3. Perguntar Prefix de Subrede
$SubnetInput = Read-Host "Informe o Prefixo de Subrede para Coleta (Padrão: 192.168.1)"
if (-not [string]::IsNullOrWhiteSpace($SubnetInput)) {
    $SubnetPrefix = $SubnetInput.Trim()
}

$Hostname = "$($env:COMPUTERNAME)-COLLECTOR"
Write-Host ""
Write-Host "Registrando Coletor de Rede '$Hostname' no Portal..." -ForegroundColor Yellow

$EnrollUrl = "$ApiUrl/agent/enroll"
$Body = @{
    activation_token = $ActivationToken.Trim()
    agent_type       = "collector"
    hostname         = $Hostname
    os_info          = "Windows $((Get-CimInstance Win32_OperatingSystem).Caption)"
    version          = "1.0.0"
} | ConvertTo-Json

try {
    $Response = Invoke-RestMethod -Uri $EnrollUrl -Method Post -Body $Body -ContentType "application/json" -UseBasicParsing
} catch {
    Write-Host "[ERRO] Falha ao registrar coletor no Portal Inner:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

if ($Response.status -ne "success") {
    Write-Host "[ERRO] O servidor respondeu com erro:" -ForegroundColor Red
    Write-Host $Response.error -ForegroundColor Red
    exit 1
}

# 4. Salvar configurações
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $ScriptDir "config.json"

$ConfigData = @{
    api_url       = $ApiUrl
    asset_key     = $Response.asset_key
    agent_secret  = $Response.agent_secret
    company_id    = $Response.company_id
    hostname      = $Hostname
    subnet_prefix = $SubnetPrefix
} | ConvertTo-Json -Depth 3

Set-Content -Path $ConfigPath -Value $ConfigData -Encoding UTF8

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " 🎉 COLETOR DE REDE LOCAL INSTALADO COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host " 🔑 CHAVE DO COLETOR GERADA PARA O PORTAL:" -ForegroundColor Yellow
Write-Host "    >>> $($Response.asset_key) <<<" -ForegroundColor Cyan
Write-Host ""
Write-Host " Subrede de varredura ativa: $SubnetPrefix.0/24" -ForegroundColor Gray
Write-Host " O coletor agora varrerá a LAN local por Impressoras, PABX, Switches e Antenas." -ForegroundColor Gray
Write-Host ""

# 5. Criar Tarefa Agendada do Coletor
$TaskName = "InnerNetworkCollector"
$CollectorScript = Join-Path $ScriptDir "inner-collector.js"

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    
    $Action = New-ScheduledTaskAction -Execute "node.exe" -Argument "`"$CollectorScript`""
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal | Out-Null
    Write-Host "[OK] Tarefa Agendada '$TaskName' criada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "[AVISO] Não foi possível criar Tarefa Agendada. Você pode iniciar manualmente rodando 'node inner-collector.js'." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Iniciando o Coletor de Rede em segundo plano agora..." -ForegroundColor Green
Start-Process -FilePath "node.exe" -ArgumentList "`"$CollectorScript`"" -WindowStyle Hidden

Write-Host "[PRONTO] Coletor de Rede Local em execução!" -ForegroundColor Green
