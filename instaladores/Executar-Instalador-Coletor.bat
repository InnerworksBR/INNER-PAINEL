@echo off
echo.
echo ========================================
echo   Inner SNMP Collector - Instalador
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

:: Executar o instalador com privilegios elevados
powershell -Command "Start-Process -FilePath '%~dp0coletor-snmp\installer\InnerSnmpCollector-Setup-1.0.0.exe' -Verb RunAs"

echo.
echo Instalador iniciado!
echo.
pause
