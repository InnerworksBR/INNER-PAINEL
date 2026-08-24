@echo off
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
sc create InnerAgent binPath= "%~dp0iniciar.bat" start= auto DisplayName= "Inner Agent"
sc description InnerAgent "Inner Agent - Monitoramento"
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

