# Script de Debug - Teste Manual do Agente
# Execute no servidor para verificar problemas de conexao

param(
    [string]$PortalUrl = "https://portal.inner.com.br",
    [string]$Token = "INNER-KEY-SUA_CHAVE_AQUI"
)

$ErrorActionPreference = "Continue"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Inner Agent - Debug Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuracao:" -ForegroundColor Yellow
Write-Host "  Portal URL: $PortalUrl"
Write-Host "  Token: $Token"
Write-Host ""

# Teste 1: Conectividade
Write-Host "[TESTE 1] Conectividade com o portal..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $PortalUrl -Method Head -TimeoutSec 10 -ErrorAction Stop
    Write-Host "  OK - Portal esta acessivel" -ForegroundColor Green
} catch {
    Write-Host "  FALHA - Nao foi possivel acessar o portal: $_" -ForegroundColor Red
    Write-Host "  Verifique a URL e a conexao de rede" -ForegroundColor Red
    exit 1
}

# Teste 2: API de Enrollment
Write-Host ""
Write-Host "[TESTE 2] Testando Enrollment..." -ForegroundColor Yellow

$body = @{
    activation_token = $Token
    agent_type = "endpoint"
    hostname = $env:COMPUTERNAME
    ip_address = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|Loopback Pseudo-Interface" } | Select-Object -First 1).IPAddress
    os_info = "Windows Teste"
    version = "1.0.0-debug"
} | ConvertTo-Json

Write-Host "  Payload enviado:" -ForegroundColor Gray
Write-Host "  $body" -ForegroundColor Gray
Write-Host ""

try {
    $result = Invoke-RestMethod -Uri "$PortalUrl/api/agent/enroll" `
        -Method Post `
        -Headers @{ "Content-Type" = "application/json" } `
        -Body $body `
        -TimeoutSec 30

    Write-Host "  Resposta do servidor:" -ForegroundColor Green
    $result | ConvertTo-Json | Write-Host

    if ($result.status -eq "success") {
        Write-Host ""
        Write-Host "  ========================================" -ForegroundColor Green
        Write-Host "  SUCESSO! Agente registrado!" -ForegroundColor Green
        Write-Host "  ========================================" -ForegroundColor Green
        Write-Host "  Asset Key: $($result.asset_key)" -ForegroundColor Cyan
        Write-Host "  Agent Secret: $($result.agent_secret)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Copie esses valores para o arquivo config.json" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  FALHA no Enrollment!" -ForegroundColor Red
    Write-Host "  Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "  Mensagem: $_" -ForegroundColor Red

    # Tentar ler a resposta de erro
    try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Resposta do servidor: $responseBody" -ForegroundColor Red
    } catch {}
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fim do Debug" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
