@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
echo.
echo ========================================
echo   Frontend - Ultima Milla
echo ========================================
echo.
echo Iniciando Frontend en puerto 3000...
echo.

cd frontend
npm run dev

pause
