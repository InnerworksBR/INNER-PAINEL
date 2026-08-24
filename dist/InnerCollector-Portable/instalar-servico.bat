@echo off
echo ========================================
echo   Inner SNMP Collector - Instalacao
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
sc create InnerCollector binPath= "%~dp0iniciar.bat" start= auto DisplayName= "Inner SNMP Collector"
sc description InnerCollector "Inner SNMP Collector - Descoberta de dispositivos de rede"
echo.
echo Iniciando servico...
net start InnerCollector
echo.
echo ========================================
echo   Instalacao concluida!
echo ========================================
echo.
echo Verifique o log: %~dp0collector.log
echo.
pause
