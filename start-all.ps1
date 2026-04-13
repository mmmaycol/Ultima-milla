# Script PowerShell para iniciar Última Milla
# Uso: .\start-all.ps1

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "  Última Milla - Startup Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

$projectRoot = Get-Location

# Paso 1: Docker Compose
Write-Host "[1/3] Levantando infraestructura (Kafka + Redis)..." -ForegroundColor Yellow
Set-Location "$projectRoot\ultima-milla-backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "docker-compose up -d; Write-Host 'Infraestructura levantada' -ForegroundColor Green" -WindowStyle Normal

Start-Sleep -Seconds 3

# Paso 2: Backend
Write-Host "[2/3] Levantando Backend en puerto 3001..." -ForegroundColor Yellow
Set-Location "$projectRoot\ultima-milla-backend"
$backendEnv = @{
    "PORT" = "3001"
    "NODE_ENV" = "development"
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\ultima-milla-backend'; `$env:PORT='3001'; npm run start:dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Paso 3: Frontend
Write-Host "[3/3] Levantando Frontend en puerto 3000..." -ForegroundColor Yellow
Set-Location "$projectRoot\frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\frontend'; npm run dev" -WindowStyle Normal

Write-Host "`n================================" -ForegroundColor Green
Write-Host "  ✓ Sistema iniciado" -ForegroundColor Green
Write-Host "================================`n" -ForegroundColor Green

Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:     http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:3001" -ForegroundColor White

Write-Host "`nDashboards:" -ForegroundColor Cyan
Write-Host "  Cliente:      http://localhost:3000/cliente" -ForegroundColor White
Write-Host "  Restaurante:  http://localhost:3000/restaurante" -ForegroundColor White
Write-Host "  Repartidor:   http://localhost:3000/repartidor" -ForegroundColor White

Write-Host "`nModeradores:" -ForegroundColor Cyan
Write-Host "  Kafka UI:     http://localhost:8080" -ForegroundColor White
Write-Host "  Redis Cmdr:   http://localhost:8081`n" -ForegroundColor White
