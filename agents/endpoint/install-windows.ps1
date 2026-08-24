# install-windows.ps1
# Script de Instalação do Agente de Máquina Inner para Windows

param(
    [string]$ApiUrl = "",
    [string]$ActivationToken = ""
)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "   🚀 INSTALADOR DO AGENTE DE MÁQUINA PORTAL INNER" -ForegroundColor Cyan
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

# Normalizar URL da API
$ApiUrl = $ApiUrl.TrimEnd('/')

# 2. Perguntar Token de Ativação caso não informado
if ([string]::IsNullOrWhiteSpace($ActivationToken)) {
    $ActivationToken = Read-Host "Informe a Chave/Token de Ativação da Empresa no Portal (Ex: INNER-KEY-XXXXX)"
}

if ([string]::IsNullOrWhiteSpace($ActivationToken)) {
    Write-Host "[ERRO] A Chave/Token de Ativação é obrigatória!" -ForegroundColor Red
    exit 1
}

$Hostname = $env:COMPUTERNAME
Write-Host ""
Write-Host "Conectando ao Portal Inner em: $ApiUrl ..." -ForegroundColor Yellow
Write-Host "Registrando máquina '$Hostname' com a chave de ativação..." -ForegroundColor Yellow

$EnrollUrl = "$ApiUrl/agent/enroll"
$Body = @{
    activation_token = $ActivationToken.Trim()
    agent_type       = "endpoint"
    hostname         = $Hostname
    os_info          = "Windows $((Get-CimInstance Win32_OperatingSystem).Caption)"
    version          = "1.0.0"
} | ConvertTo-Json

try {
    $Response = Invoke-RestMethod -Uri $EnrollUrl -Method Post -Body $Body -ContentType "application/json" -UseBasicParsing
} catch {
    Write-Host "[ERRO] Falha ao registrar agente no Portal Inner:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

if ($Response.status -ne "success") {
    Write-Host "[ERRO] O servidor respondeu com erro:" -ForegroundColor Red
    Write-Host $Response.error -ForegroundColor Red
    exit 1
}

# 3. Salvar configurações no config.json local
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $ScriptDir "config.json"

$ConfigData = @{
    api_url      = $ApiUrl
    asset_key    = $Response.asset_key
    agent_secret = $Response.agent_secret
    company_id   = $Response.company_id
    hostname     = $Hostname
} | ConvertTo-Json -Depth 3

Set-Content -Path $ConfigPath -Value $ConfigData -Encoding UTF8

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " 🎉 AGENTE DE MÁQUINA INSTALADO E REGISTRADO COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host " 🔑 CHAVE DO ATIVO GERADA PARA O PORTAL:" -ForegroundColor Yellow
Write-Host "    >>> $($Response.asset_key) <<<" -ForegroundColor Cyan
Write-Host ""
Write-Host " Esta chave vincula este servidor diretamente ao cliente no Portal Inner." -ForegroundColor Gray
Write-Host " Configurações salvas em: $ConfigPath" -ForegroundColor Gray
Write-Host ""

# 4. Criar Tarefa Agendada para Iniciar no Boot
$TaskName = "InnerEndpointAgent"
$AgentScript = Join-Path $ScriptDir "inner-agent.js"

Write-Host "Configurando execução automática no boot do Windows..." -ForegroundColor Yellow

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    
    $Action = New-ScheduledTaskAction -Execute "node.exe" -Argument "`"$AgentScript`""
    $Trigger = New-ScheduledTaskTrigger -AtStartup
    $Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal | Out-Null
    Write-Host "[OK] Tarefa Agendada '$TaskName' criada com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "[AVISO] Não foi possível criar Tarefa Agendada do sistema (requer privilégios de Administrador). Você pode rodar manualmente 'node inner-agent.js'." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Iniciando o agente em segundo plano agora..." -ForegroundColor Green
Start-Process -FilePath "node.exe" -ArgumentList "`"$AgentScript`"" -WindowStyle Hidden

Write-Host "[PRONTO] Agente de Máquina está em execução e enviando métricas!" -ForegroundColor Green
