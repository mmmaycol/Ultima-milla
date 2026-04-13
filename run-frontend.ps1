# Script para ejecutar Última Milla Frontend con Hot Reload

# Colores para output
$colors = @{
    'success' = 'Green'
    'info'    = 'Cyan'
    'error'   = 'Red'
    'warning' = 'Yellow'
}

function Write-Log {
    param([string]$Message, [string]$Level = 'info')
    $color = $colors[$Level]
    Write-Host "[$Level] $Message" -ForegroundColor $color
}

# Verificar que Node.js está instalado
Write-Log "Verificando Node.js..." "info"
try {
    $nodeVersion = node --version
    Write-Log "Node.js $nodeVersion encontrado ✓" "success"
} catch {
    Write-Log "Node.js no está instalado 😞" "error"
    Write-Log "Descárgalo de: https://nodejs.org/" "warning"
    exit 1
}

# Ir a carpeta del frontend
Write-Log "Navegando a carpeta frontend..." "info"
$frontendPath = Join-Path $PSScriptRoot "frontend"

if (-Not (Test-Path $frontendPath)) {
    Write-Log "❌ No se encontró carpeta /frontend" "error"
    exit 1
}

Set-Location $frontendPath
Write-Log "Ubicación: $(Get-Location)" "info"

# Instalar dependencias si no existen
if (-Not (Test-Path "node_modules")) {
    Write-Log "📦 Instalando dependencias npm..." "info"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Log "❌ Error instalando dependencias" "error"
        exit 1
    }
    Write-Log "✓ Dependencias instaladas" "success"
} else {
    Write-Log "✓ node_modules ya existe" "success"
}

# Iniciar servidor de desarrollo
Write-Log "🚀 Iniciando Frontend en puerto 3000..." "warning"
Write-Log "Abre tu navegador en: http://localhost:3000" "info"
Write-Log "Presiona Ctrl+C para parar" "info"
Write-Log "═══════════════════════════════════════════════════════════" "info"

npm run dev

# Si npm run dev falla
if ($LASTEXITCODE -ne 0) {
    Write-Log "❌ Error al iniciar frontend" "error"
    exit 1
}
