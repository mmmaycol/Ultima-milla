@echo off
setlocal enabledelayedexpansion

REM Detectar si estamos en Windows
if not defined PROMPT (
    echo Error: Este script debe ejecutarse desde CMD o PowerShell
    pause
    exit /b 1
)

cd /d "%~dp0"
echo.
echo ========================================
echo   Backend - Ultima Milla
echo ========================================
echo.
echo Iniciando Backend en puerto 3001...
echo.

cd ultima-milla-backend
set PORT=3001
npm run start:dev

pause
