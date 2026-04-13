@echo off
cd /d "%~dp0"

echo.
echo ================================
echo   Última Milla - Startup Script
echo ================================
echo.

REM Paso 1: Docker Compose
echo [1/3] Levantando infraestructura (Kafka + Redis)...
start "Docker Compose" cmd /k "cd ultima-milla-backend && docker-compose up -d && echo. && echo Infraestructura levantada. Continúa con el siguiente terminal... && pause"

timeout /t 2 /nobreak

REM Paso 2: Backend
echo [2/3] Levantando Backend en puerto 3001...
start "Backend - NestJS" cmd /k "cd ultima-milla-backend && set PORT=3001 && npm run start:dev"

timeout /t 3 /nobreak

REM Paso 3: Frontend
echo [3/3] Levantando Frontend en puerto 3000...
start "Frontend - Next.js" cmd /k "cd frontend && npm run dev"

echo.
echo ================================
echo   ✓ Sistema iniciado
echo ================================
echo.
echo URLs:
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:3001
echo.
echo Dashboards:
echo   Cliente:      http://localhost:3000/cliente
echo   Restaurante:  http://localhost:3000/restaurante
echo   Repartidor:   http://localhost:3000/repartidor
echo.
pause
