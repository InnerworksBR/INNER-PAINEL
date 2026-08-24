@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoLogo -WindowStyle Hidden -File "%~dp0agent.ps1"
pause

