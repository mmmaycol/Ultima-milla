# 🚚 Última Milla - Sistema de Logística Event-Driven

**Demostración funcional de Arquitectura Orientada a Eventos (EDA)**

> Sistema de logística de última milla con Kafka, Redis y WebSocket. Incluye dashboards para Cliente, Restaurante y Repartidor con tracking en tiempo real.

---

## ⚡ Demostración en Vivo (Sin Docker)

### 🎯 Inicio Rápido (30 segundos)

```powershell
# PowerShell (Windows)
cd c:\Users\USER\Downloads\ultima-milla-backend
.\run-frontend.ps1
```

Luego abre: **http://localhost:3000** 🎉

### ✨ Lo que Verás

1. **Página Principal**: 3 dashboards (Cliente, Restaurante, Repartidor)
2. **Dashboard Cliente**: 
   - Crea un pedido con "✨ Crear Nuevo Pedido"
   - Ve eventos EDA en vivo en "📅 Timeline de Eventos"
   - Tracking con GPS interpolado en tiempo real
3. **Dashboard Restaurante**: 
   - Recibe el pedido automáticamente
   - Marca como listo para entregar
4. **Dashboard Repartidor**: 
   - Ve pedido asignado
   - Inicia entrega y ve GPS en vivo en mapa

---

## 🏗️ Arquitectura de Eventos

```
1. Cliente crea pedido
   ↓ [pedido.creado event]
   
2. Matching Service (Producer)
   ↓ Asigna restaurante más cercano (Haversine distance)
   ↓ [pedido.asignado_restaurante event]
   
3. Matching Service (Consumer)  
   ↓ Asigna repartidor disponible
   ↓ [pedido.asignado_repartidor event]
   
4. Restaurante (Consumer)
   ↓ [pedido.en_preparacion event]
   ↓ Comienza preparación
   
5. Repartidor (Consumer)
   ↓ [pedido.en_camino event]
   ↓ Comienza entrega con GPS
   
6. Cliente (Observer)
   → Ve tracking en mapa
   → Actualización cada 3 segundos
```

**Detalles técnicos:**
- Producer: `crearPedidoConEventos()` en `eventosService.ts`
- Consumer: Simulados con estado React local
- Tracking: GPS interpolado con progreso porcentual
- Distancia: Fórmula Haversine (precisión en Lima)
- Timing: Basado en distancia real (30 km/h promedio)

---

## 📊 Datos de Prueba Incluidos

### 🏢 Restaurantes (Ubicaciones reales Lima)
| Nombre | Ubicación | Prep Time |
|--------|-----------|-----------|
| Pizza Don Pepe | Centro (-12.0464, -77.0428) | 15 min |
| Chifa Ling Tao | Surco (-12.0520, -77.0350) | 20 min |
| Burger House | Miraflores (-12.0400, -77.0500) | 10 min |

### 🚗 Repartidores
- Carlos María, Juan (con ubicaciones aleatorias iniciales)

### 📦 Items Ejemplo
- Pizza Margarita ($35)
- Gaseosa Inca Kola ($5)
- Postre Tiramisú ($15)

### 📍 Entregas
- Ubicación aleatoria en San Isidro
- Distancia calculada automáticamente
- ETA = distancia / 30 km/h + tiempo preparación

---

## 🚀 Instalación y Ejecución

### Requisitos
- Node.js 18+ ([Descargar](https://nodejs.org/)) 
- npm 9+
- 100 MB de espacio libre
- Conexión a Internet (para mapa)

### Paso 1: Clonar/Descargar
```bash
cd c:\Users\USER\Downloads\ultima-milla-backend
```

### Paso 2: Frontend
```powershell
cd frontend
npm install
npm run dev
```

Abre: http://localhost:3000

### Paso 3 (Opcional): Backend
```powershell
cd ..
npm install
npm run start:dev
```

Backend correría en: http://localhost:3001

---

## 🌐 URLs Principales

| Sección | URL | Estado |
|---------|-----|--------|
| 🏠 Inicio | http://localhost:3000 | ✅ Funcionando |
| 🛍️ Cliente | http://localhost:3000/cliente | ✅ Con datos simulados |
| 🍳 Restaurante | http://localhost:3000/restaurante | ✅ Con datos simulados |
| 🚚 Repartidor | http://localhost:3000/repartidor | ✅ Con datos simulados |
| 🔌 Backend | http://localhost:3001 | 🟡 Opcional |

---

## 📁 Estructura de Carpetas

```
ultima-milla-backend/
├── 📄 README.md (este archivo)
├── 📄 GUIA_DEMO.md (instrucciones detalladas)
├── docker-compose.yml (infraestructura Kafka/Redis)
├── package.json (backend)
├── tsconfig.json (backend)
├── run-frontend.ps1 ⭐ (EJECUTA ESTO)
│
├── frontend/ (Next.js 16)
│   ├── .env.local (ya configurado)
│   ├── src/app/
│   │   ├── page.tsx (home + links)
│   │   ├── cliente/
│   │   │   └── page.tsx ⭐ (demo cliente)
│   │   ├── restaurante/
│   │   │   └── page.tsx ⭐ (demo restaurante)
│   │   ├── repartidor/
│   │   │   └── page.tsx ⭐ (demo repartidor)
│   │   ├── components/
│   │   │   └── Mapa.tsx (Google Maps)
│   │   └── layout.tsx
│   ├── src/lib/
│   │   ├── eventosService.ts ⭐ (EDA CORE)
│   │   └── mock-service.ts (legacy)
│   └── package.json
│
└── src/ (Backend NestJS - referencia)
    ├── main.ts
    ├── app.module.ts
    └── modules/
        ├── pedidos/
        ├── tracking/ (WebSocket)
        └── ...
```

---

## 🔑 Conceptos EDA Demostrados

### 1. **Event Producer Pattern**
```typescript
// Cliente crea pedido → Sistema produce evento
const { pedido, eventos } = await crearPedidoConEventos(nombre, items, direccion);
// Automáticamente:
// - pedido.creado
// - pedido.asignado_restaurante (Kafka simulation)
// - pedido.asignado_repartidor (Kafka simulation) 
// - pedido.en_preparacion (WebSocket simulation)
```

### 2. **Event Consumer Pattern**
```typescript
// Matching Service consume eventos y actúa
// - Asigna restaurante más cercano
// - Calcula distancia con Haversine
// - Asigna repartidor disponible
```

### 3. **Real-time Tracking**
```typescript
// GPS interpolado cada 3 segundos
const interval = simularTrackingEnTiempoReal(pedido, (ubicacion) => {
  // Update UI con nueva posición
});
```

### 4. **Event Sourcing**
```typescript
// Timeline completo de eventos:
// 1. Timestamp exacto
// 2. Datos del evento
// 3. Observable en UI
// → Auditoría completa de transacción
```

### 5. **Geolocation-Based Matching**
```typescript
// Haversine distance formula
const km = calcularDistancia(lat1, lon1, lat2, lon2);
const minutos = calcularTiempoEntrega(km);
// → Restaurante más cercano automático
// → Repartidor señalizado en mapa
```

---

## ✅ Checklist de Demostración

Cuando ejecutes el sistema:

- [ ] Frontend carga en http://localhost:3000
- [ ] Página principal muestra 3 tarjetas (Cliente, Restaurante, Repartidor)
- [ ] Puedo hacer clic en "Cliente" y ver dashboard
- [ ] "Crear Nuevo Pedido" funciona  
- [ ] Eventos aparecen en Timeline en <3 segundos
- [ ] Puedo ver "Asignado a Restaurante" → "Asignado a Repartidor"
- [ ] El mapa se carga (Google Maps)
- [ ] Progreso de entrega sube de 0% → 100%
- [ ] Posición en mapa se actualiza en vivo
- [ ] Dashboard Restaurante muestra pedido nuevo
- [ ] Dashboard Repartidor muestra entrega
- [ ] Puedo marcar como "Entregado"

---

## 🎨 Pantallas y Componentes

### Cliente Dashboard
- 📋 Panel izquierdo: Lista filtrable de pedidos
- 📊 Panel derecho: Detalles, eventos EDA, tracking
- 🗺️ Mapa Google Maps con ubicación en vivo
- 📈 Barra progreso (0-100%)
- 📅 Timeline: Todos los eventos con timestamps

### Restaurante Dashboard  
- 📊 Stats: Contador de estados
- 📋 Pedidos nuevos por confirmar
- 👨‍🍳 Pedidos en preparación
- ✅ Pedidos listos para retirar
- 🎨 Color coding: Blue → Yellow → Green

### Repartidor Dashboard
- 👤 Info repartidor: Nombre, estado, vehículo
- 📦 Lista de entregas pendientes
- 🚗 Entrega en curso: Detalles, items, ETA
- 🗺️ Mapa con posición en vivo
- ✅ Botón "Marcar como Entregado"

---

## 🔍 Cómo Ver los Eventos EDA

**Opción 1: En la UI (Recomendado)**
1. Dashboard Cliente → "📅 Timeline de Eventos (EDA)"
2. Crea un pedido
3. Verás eventos numerados con timestamps

**Opción 2: En la consola del navegador**
1. Abre DevTools (F12 o Ctrl+Shift+I)
2. Tab "Console"
3. Crea un pedido
4. Verás logs: `[EDA] Evento: pedido.creado`, etc.

**Opción 3: En el código fuente**
1. Abre `frontend/src/lib/eventosService.ts`
2. Función `crearPedidoConEventos()` línea ~90
3. Cada `eventos.push()` es un evento

---

## 🐛 Solución de Problemas

### ❌ "No se encuentra npm"
**Solución:** Instala Node.js desde https://nodejs.org/

### ❌ "El puerto 3000 está en uso"
```powershell
# Encuentra qué está usando el puerto
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess

# O mata el proceso
Stop-Process -Port 3000 -Force
```

### ❌ "El mapa no carga"
- Verifica conexión a Internet
- Google Maps requiere acceso a `maps.googleapis.com`
- Si falla, verás texto de ubicación igual

### ❌ "npm install falla"
```powershell
# Limpia caché
npm cache clean --force

# Intenta de nuevo
npm install
```

### ❌ "Los eventos no aparecen"
1. Abre DevTools (F12)
2. Tab Console
3. Crea un pedido
4. Espera 2-3 segundos
5. Revuelve que no haya errores rojos

---

## 🧪 Pruebas Automatizadas

(Próximamente)
- Unit tests para `eventosService.ts`
- E2E tests para dashboards
- Performance tests

---

## 📚 Recursos y Enlaces

- **Next.js**: https://nextjs.org/docs
- **NestJS**: https://docs.nestjs.com
- **Kafka**: https://kafka.apache.org/
- **Redis**: https://redis.io/
- **Google Maps API**: https://developers.google.com/maps
- **Haversine Formula**: https://en.wikipedia.org/wiki/Haversine_formula

---

## 👨‍💻 Autor y Contexto

Desarrollado para demostración de **Arquitectura Orientada a Eventos (EDA)** en el curso SI806V.

**Docente:** Carlos Ramos Montes  
**Universidad:** UNI - Lima  
**Ciclo:** 26-I

---

## 📝 Notas de Desarrollo

### Mock Service vs. Backend Real

**Actualmente (Mock):**
- ✅ Funciona sin Docker
- ✅ Sin dependencias externas
- ✅ Datos simulados completos
- ✅ GPU interpolado suavemente
- ❌ Datos no persistidos

**Con Backend Real** (en dev):
- ✅ Datos persistidos en BD
- ✅ Kafka real para eventos
- ✅ Redis para caché
- ✅ WebSocket genuino
- ❌ Requiere Docker + setup

### Próximas Pasos

1. Conectar Frontend con Backend NestJS real
2. Reemplazar Mock Service con Kafka producers/consumers
3. Agregar autenticación JWT
4. Agregar persistencia en base de datos
5. Agregar notificaciones push

---

## 📄 Licencia

Proyecto educativo - Libre para uso en contexto académico.

---

**¿Listo para la demostración?**

```powershell
cd ultima-milla-backend
.\run-frontend.ps1
```

Abre http://localhost:3000 y ¡disfruta! 🚀🎉
│  Cliente | Restaurante | Repartidor │
└────────────────┬────────────────────┘
                 │ HTTP + WebSocket
┌────────────────▼────────────────────┐
│      Backend (NestJS) :3001         │
│  REST API | Socket.IO Gateway       │
└────────────────┬────────────────────┘
                 │ Eventos
┌────────────────▼────────────────────┐
│      Event Brokers                  │
│  Kafka + Redis Pub/Sub              │
└────────────────┬────────────────────┘
                 │ Eventos
┌────────────────▼────────────────────┐
│   Microservicios (Consumidores)     │
│  Matching | Tracking | Facturación  │
└─────────────────────────────────────┘
```

---

## ✅ Checklist de Verificación

- [ ] Docker Desktop instalado y corriendo
- [ ] Node.js 18+ instalado
- [ ] Infraestructura levantada (`docker-compose up -d`)
- [ ] Backend corriendo en puerto 3001
- [ ] Frontend corriendo en puerto 3000
- [ ] Variables de entorno configuradas
- [ ] Frontend carga sin errores 404 de API
- [ ] Mapa de Google Maps visible
- [ ] WebSocket conecta correctamente

---

## 🐛 Solución de Problemas

### Error: "Cannot connect to localhost:3001"
- Verifica que el backend esté corriendo: `npm run start:dev`
- Verifica que `PORT=3001` esté en `.env`

### Error: "WebSocket connection failed"
- Backend debe estar corriendo
- Verifica que Socket.IO esté en `/tracking`

### Error: "404 /pedidos"
- Backend no está corriendo o está en puerto incorrecto
- Verifica `.env.local` del frontend

### Docker no inicia
- Verifica Docker Desktop esté abierto
- Intenta: `docker-compose down && docker-compose up -d`

---

## 📚 Documentación Adicional

- [Backend README](./ultima-milla-backend/README.md)
- [Frontend README](./frontend/README.md)
- [Guía Rápida](./GUIA_RAPIDA.md)

---

## 👥 Autores

- Proyecto Base: Backend EDA
- Frontend: Desarrollo Next.js
- Curso: SI806V UNI

---

*Última actualización: 12 de Abril, 2026*
