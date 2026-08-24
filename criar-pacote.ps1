# Criar pacote portable do Inner Agent
$outputDir = "C:\Apps\INNER_PAINEL\dist\InnerAgent-Portable"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# Copiar arquivos do agente
Copy-Item -Path "C:\Apps\INNER_PAINEL\agente\install\agent.ps1" -Destination $outputDir
Copy-Item -Path "C:\Apps\INNER_PAINEL\agente\debug-agent.ps1" -Destination $outputDir

# Criar config.example
$configContent = @"
{
    "portalUrl": "https://SEU_PORTAL_AQUI",
    "token": "INNER-KEY-SEU_TOKEN_AQUI",
    "intervalSeconds": 60
}
"@
$configContent | Out-File -FilePath "$outputDir\config.json" -Encoding UTF8

# Criar script de inicializacao
$startBat = "@echo off
cd /d ""%~dp0""
powershell -ExecutionPolicy Bypass -NoLogo -WindowStyle Hidden -File ""%~dp0agent.ps1""
pause
"
$startBat | Out-File -FilePath "$outputDir\iniciar.bat" -Encoding ASCII

# Criar script de instalacao como servico
$installBat = "@echo off
echo ========================================
echo   Inner Agent - Instalacao
echo ========================================
echo.

REM Verificar se e administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERRO: Execute este script como ADMINISTRADOR
    echo.
    echo Clique com botao direito > Executar como Administrador
    pause
    exit /b 1
)

echo Instalando servico Windows...
sc create InnerAgent binPath= ""%~dp0iniciar.bat"" start= auto DisplayName= ""Inner Agent""
sc description InnerAgent ""Inner Agent - Monitoramento""
echo.
echo Iniciando servico...
net start InnerAgent
echo.
echo ========================================
echo   Instalacao concluida!
echo ========================================
echo.
echo Verifique o log: %~dp0agent.log
echo.
pause
"
$installBat | Out-File -FilePath "$outputDir\instalar-servico.bat" -Encoding ASCII

# Criar README
$readme = @"
INNER AGENT - INSTALACAO
=======================

PASSO 1: CONFIGURAR
--------------------
1. Edite o arquivo config.json
2. Altere a URL do portal (portalUrl)
3. Cole o token de ativacao (token)

PASSO 2: INSTALAR COMO SERVICO
-------------------------------
1. Clique com botao DIREITO em "instalar-servico.bat"
2. Selecione "Executar como Administrador"
3. Aguarde a mensagem de sucesso

PASSO 3: VERIFICAR
-------------------
1. Abra o Painel de Controle > Ferramentas Administrativas > Servicos
2. Procure por "Inner Agent"
3. Verifique se o status e "Em Execucao"

ARQUIVOS:
- agent.ps1        -> Script principal de monitoramento
- config.json      -> Configuracao (URL e Token)
- iniciar.bat      -> Script para iniciar o agente
- agent.log        -> Log de execucao (gerado automaticamente)

PROBLEMAS?
----------
1. Verifique se o config.json esta correto
2. Execute "debug-agent.ps1" no PowerShell para testar
3. Verifique o arquivo agent.log para erros
"@
$readme | Out-File -FilePath "$outputDir\LEIA-ME.txt" -Encoding UTF8

# Criar ZIP
$zipPath = "C:\Apps\INNER_PAINEL\dist\InnerAgent-Portable.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$outputDir\*" -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Pacote criado com sucesso!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Local: $zipPath" -ForegroundColor Green
Write-Host ""
Write-Host "Arquivos incluidos:" -ForegroundColor Yellow
Get-ChildItem $outputDir | ForEach-Object { Write-Host "  - $($_.Name)" }
Write-Host ""
