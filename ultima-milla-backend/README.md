# 🚀 Sistema de Logística de Última Milla — Backend EDA

**Universidad Nacional de Ingeniería | SI806V Desarrollo Adaptativo e Integración de Software**  
**Docente:** Carlos Ramos Montes | **Ciclo:** 26-I

---

## 📐 Arquitectura

Este backend implementa una **Arquitectura Orientada a Eventos (EDA)** para un sistema de logística de última milla estilo Uber Eats / Rappi.

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA DE PRODUCTORES                        │
│  App Cliente  │  Pasarela Pago  │  App Restaurante │  App Rep│
└───────────────────────┬─────────────────────────────────────┘
                        │ eventos
┌───────────────────────▼─────────────────────────────────────┐
│                    EVENT BROKERS                               │
│    Apache Kafka (eventos negocio)  │  Redis Pub/Sub (GPS)     │
└───────────────────────┬─────────────────────────────────────┘
                        │ fan-out
┌───────────────────────▼─────────────────────────────────────┐
│                 MICROSERVICIOS (CONSUMIDORES)                  │
│  Matching │ Notificaciones │ Facturación │ Tracking │ Reemb. │
└─────────────────────────────────────────────────────────────┘
```

### Decisiones técnicas clave

| Decisión | Tecnología | Razón |
|----------|-----------|-------|
| Broker principal | Apache Kafka | Log distribuido, múltiples consumer groups, retención configurable |
| Telemetría GPS | Redis Pub/Sub | Latencia < 10ms (vs 5-50ms Kafka), datos efímeros |
| Streaming cliente | WebSocket (Socket.IO) | Actualización en tiempo real del mapa |
| Reembolsos | Saga Pattern | Transaccionalidad y compensación coordinada |
| Resto del flujo | Coreografía | Sin punto único de fallo, servicios autónomos |
| Idempotencia | Redis (event_id) | Evita efectos duplicados en reintentos |

---

## 📁 Estructura del proyecto

```
src/
├── main.ts                          # Punto de entrada
├── app.module.ts                    # Módulo raíz
├── app.controller.ts                # Health check
├── app.service.ts                   # Info del sistema
│
├── config/
│   └── constants.ts                 # Tópicos, eventos, estados, TTLs
│
├── brokers/
│   ├── kafka/
│   │   ├── kafka.service.ts         # Productor/suscriptor Kafka + DLQ + backoff
│   │   └── kafka.module.ts
│   └── redis/
│       ├── redis.service.ts         # GPS Pub/Sub + Cache + idempotencia
│       └── redis.module.ts
│
├── gateway/
│   └── tracking.gateway.ts          # WebSocket Gateway (Socket.IO)
│
└── modules/
    ├── pedidos/                     # Ciclo de vida del pedido
    ├── pagos/                       # Adaptador pasarela + webhook
    ├── matching/                    # Correlación AND + algoritmo
    ├── tracking/                    # GPS dual: Kafka (estado) + Redis (telemetría)
    ├── notificaciones/              # Circuit Breaker + push/SMS/email
    ├── reembolsos/                  # Saga Pattern con compensación
    ├── facturacion/                 # Idempotencia por transaction_id
    ├── analytics/                   # Métricas en ventanas de tiempo
    └── dlq/                         # Dead Letter Queue Worker
```

---

## ⚙️ Instalación y ejecución

### 1. Requisitos previos
- Node.js 18+
- Docker y Docker Compose

### 2. Levantar infraestructura (Kafka + Redis)

```bash
docker-compose up -d
```

Esto levanta:
- **Kafka** en `localhost:9092`
- **Kafka UI** en `http://localhost:8080` (ver tópicos y mensajes)
- **Redis** en `localhost:6379`
- **Redis Commander** en `http://localhost:8081`

### 3. Instalar dependencias del backend

```bash
npm install
```

### 4. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env si es necesario (por defecto funciona con docker-compose)
```

### 5. Iniciar el servidor

```bash
npm run start:dev
```

El servidor corre en `http://localhost:3000`

---

## 🔌 Endpoints REST

### Sistema
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api` | Info del sistema |
| GET | `/api/health` | Health check (Kafka, Redis, WS) |

### Pedidos
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/pedidos` | Crear pedido → produce `pedido.creado` |
| GET | `/api/pedidos` | Listar todos los pedidos |
| GET | `/api/pedidos/:id` | Estado de un pedido |
| POST | `/api/pedidos/:id/cancelar` | Cancelar → produce `pedido.cancelado` |
| POST | `/api/pedidos/:id/confirmar-restaurante` | Restaurante acepta |
| POST | `/api/pedidos/:id/rechazar-restaurante` | Restaurante rechaza |

### Pagos (Adaptador Pasarela)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/pagos/webhook` | Recibe webhook Stripe/Culqi |
| POST | `/api/pagos/simular-exitoso` | **Demo:** simula pago exitoso |
| POST | `/api/pagos/simular-fallido` | **Demo:** simula pago fallido |
| GET | `/api/pagos` | Historial de pagos |

### Tracking GPS
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/tracking/gps` | Actualizar posición GPS → Redis Pub/Sub |
| GET | `/api/tracking/posicion/:repartidorId` | Última posición conocida |
| POST | `/api/tracking/en-camino` | Repartidor en camino al restaurante |
| POST | `/api/tracking/recogio-pedido` | Repartidor recogió el pedido |
| POST | `/api/tracking/confirmar-entrega` | Confirmar entrega al cliente |

### Matching
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/matching/repartidores/disponibles` | Repartidores libres |
| GET | `/api/matching/asignaciones` | Todas las asignaciones |
| GET | `/api/matching/asignacion/:pedidoId` | Asignación de un pedido |

### Observabilidad
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/analytics/metricas` | Métricas en tiempo real |
| GET | `/api/notificaciones` | Historial de notificaciones |
| GET | `/api/notificaciones/circuit-breaker` | Estado del Circuit Breaker SMS |
| GET | `/api/facturacion/comprobantes` | Comprobantes generados |
| GET | `/api/reembolsos` | Sagas de reembolso |
| GET | `/api/dlq/mensajes` | Mensajes en Dead Letter Queue |
| GET | `/api/dlq/estadisticas` | Estadísticas de la DLQ |

---

## 🔌 WebSocket (Tracking en tiempo real)

El frontend Next.js puede conectarse al WebSocket para recibir actualizaciones GPS en tiempo real:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/tracking');

// Suscribirse al tracking de un pedido
socket.emit('suscribir_pedido', {
  pedido_id: 'uuid-del-pedido',
  repartidor_id: 'rep_001'
});

// Recibir posición GPS actualizada cada ~3 segundos
socket.on('posicion_actualizada', (data) => {
  console.log(data); // { latitud, longitud, velocidad, timestamp }
  // Actualizar pin del mapa
});

// Recibir cambios de estado del pedido
socket.on('estado_pedido', (data) => {
  console.log(data); // { pedido_id, estado, timestamp }
});
```

---

## 🎬 Demo del flujo completo

```bash
# Con el servidor corriendo:
npx ts-node scripts/demo-flujo-completo.ts
```

El script simula el ciclo de vida completo:
1. Cliente crea pedido → `pedido.creado`
2. Pago procesado → `pago.procesado`
3. Restaurante confirma → correlación AND completa
4. Repartidor asignado → `repartidor.asignado`
5. Telemetría GPS → Redis Pub/Sub (3 actualizaciones)
6. Repartidor en camino → `repartidor.en_camino_al_restaurante`
7. Recogida → `repartidor.recogio_pedido`
8. Entrega confirmada → `pedido.entregado`

---

## 📊 Catálogo de eventos EDA

| Evento | Productor | Tópico Kafka |
|--------|-----------|-------------|
| `pedido.creado` | App Cliente | `pedidos` |
| `pago.procesado` | Pasarela Pago | `pagos` |
| `pago.fallido` | Pasarela Pago | `pagos` |
| `pedido.confirmado_por_restaurante` | App Restaurante | `pedidos` |
| `pedido.rechazado_por_restaurante` | App Restaurante | `pedidos` |
| `repartidor.asignado` | Servicio Matching | `repartidores.eventos` |
| `repartidor.en_camino_al_restaurante` | App Repartidor | `repartidores.eventos` |
| `repartidor.recogio_pedido` | App Repartidor | `repartidores.eventos` |
| `repartidor.posicion_actualizada` | App Repartidor | **Redis Pub/Sub** |
| `pedido.entregado` | App Repartidor | `repartidores.eventos` |
| `pedido.cancelado` | App Cliente/Sistema | `pedidos` |
| `reembolso.iniciado` | Saga Reembolsos | `pedidos` |
| `calificacion.recibida` | App Cliente | `pedidos` |

---

## 👥 Equipo

- **Campos Gamonal, Piero Cesar** — Arquitectura EDA
- **Anaya Quispe, Michael Edwin** — Backend (este repositorio)
- **Huaman Bonifacio, Xavi Julio** — Frontend (Next.js)
