@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoLogo -WindowStyle Hidden -File "%~dp0collector.ps1"
pause
