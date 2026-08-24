@echo off
echo.
echo ========================================
echo   Inner PAINEL - Instalador
echo ========================================
echo.
echo ATENCAO: Este instalador precisa de
echo privilegios de Administrador.
echo.
echo Se aparecer tela do UAC, clique em SIM.
echo.
echo Pressione qualquer tecla para continuar...
echo.
pause >nul

echo Iniciando instalador...
echo.

:: Verificar se ja e administrador
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Ja executando como Administrador.
) else (
    echo Solicitando privilegios de Administrador...
)

:: Executar o instalador com privilegios elevados
powershell -Command "Start-Process -FilePath '%~dp0agente\installer\InnerAgent-Setup-1.0.0.exe' -Verb RunAs"

echo.
echo Instalador iniciado!
echo.
pause
