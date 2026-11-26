@echo off
rem Double-click to run the site locally. Arguments are passed on, e.g.: start-local.cmd -Port 3001
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" %*
if errorlevel 1 pause
