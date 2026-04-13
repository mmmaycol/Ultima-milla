# 🧪 Guía de Pruebas — Backend EDA Última Milla

**Última actualización:** 13 de Abril, 2026

---

## ✅ Status Actual

El backend está **100% funcional** y listo para pruebas.

✅ Node.js + NestJS compilando sin errores  
✅ Kafka conectado y topics creados automáticamente  
✅ Redis conectado (Pub/Sub + Cache)  
✅ WebSocket Gateway iniciado  
✅ Todos los microservicios escuchando eventos  
✅ API REST respondiendo en `http://localhost:3000/api`  

---

## 🚀 1. Levantamiento Rápido

### Paso 1: Iniciar la infraestructura

```bash
cd ultima-milla-backend
docker-compose up -d
```

**Verifica que todo esté running:**
```bash
docker-compose ps
```

Deberías ver:
- ✅ zookeeper (UP)
- ✅ kafka (UP)
- ✅ kafka-ui (UP)
- ✅ redis (UP)
- ✅ redis-commander (UP)

### Paso 2: Instalar dependencias

```bash
npm install
```

### Paso 3: Iniciar el backend

```bash
npm run start:dev
```

Esperarás mensajes como:
```
[Nest] xxxx - ... LOG [KafkaService] ✅ Kafka Producer conectado
[Nest] xxxx - ... LOG [RedisService] ✅ Redis conectado
[Nest] xxxx - ... LOG [MatchingService] 🎯 MatchingService listo
```

### Paso 4: Verificar salud

```bash
curl http://localhost:3000/api/health
```

Deberías ver:
```json
{
  "status": "ok",
  "componentes": {
    "kafka": "UP",
    "redis": "UP",
    "websocket": "UP"
  }
}
```

---

## 📊 2. Dashboards de Infraestructura

Accede a estas UIs para monitorear en tiempo real:

| Servicio | URL | Propósito |
|----------|-----|----------|
| **Kafka UI** | http://localhost:8080 | Ver topics, mensajes, consumer lag |
| **Redis Commander** | http://localhost:8081 | Ver keys, valores en cache |
| **Backend API** | http://localhost:3000/api/health | Health check |

### Usando Kafka UI

1. Navega a http://localhost:8080
2. Ve a "Topics"
3. Verás topics como `pedidos`, `pagos`, `repartidores.eventos`
4. Haz click en cualquier topic para ver los mensajes en tiempo real

---

## 🧪 3. Pruebas Manuales con cURL

### 3.1 Health Check

```bash
curl -X GET http://localhost:3000/api/health
```

### 3.2 Crear un Pedido

```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": "cliente_001",
    "restaurante_id": "resto_001",
    "direccion_entrega": {
      "calle": "Av. Larco 123",
      "distrito": "Miraflores",
      "ciudad": "Lima",
      "latitud": -12.1219,
      "longitud": -77.0299
    },
    "items": [
      {
        "producto_id": "prod_001",
        "nombre": "Hamburguesa",
        "cantidad": 2,
        "precio_unitario": 18.90
      }
    ],
    "metodo_pago": "tarjeta",
    "notas": "Sin cebolla"
  }'
```

**Respuesta esperada:**
```json
{
  "pedido_id": "uuid-aqui"
}
```

### 3.3 Simular Pago Exitoso

```bash
# Reemplaza PEDIDO_ID con el obtenido en paso 3.2
curl -X POST http://localhost:3000/api/pagos/simular-exitoso \
  -H "Content-Type: application/json" \
  -d '{
    "pedido_id": "PEDIDO_ID_AQUI",
    "monto": 46.30,
    "cliente_id": "cliente_001"
  }'
```

**¿Qué sucede?**
- El evento `pago.procesado` se publica en Kafka
- El servicio de Facturación genera una boleta
- El servicio de Notificaciones envía un push al cliente
- El servicio de Matching comienza a esperar confirmación del restaurante

### 3.4 Confirmar Restaurante

```bash
curl -X POST "http://localhost:3000/api/pedidos/PEDIDO_ID_AQUI/confirmar-restaurante" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurante_id": "resto_001",
    "tiempo_estimado_preparacion_minutos": 12
  }'
```

**¿Qué sucede?**
- Se publica `pedido.confirmado_por_restaurante`
- El servicio de Matching tiene AMBAS mitades de la correlación AND
- Se ejecuta el algoritmo de matching
- Se asigna un repartidor
- Se publica `repartidor.asignado`

### 3.5 Actualizar Posición GPS del Repartidor

```bash
curl -X POST http://localhost:3000/api/tracking/gps \
  -H "Content-Type: application/json" \
  -d '{
    "repartidor_id": "rep_001",
    "latitud": -12.1250,
    "longitud": -77.0280,
    "velocidad": 42.5
  }'
```

**¿Qué sucede?**
- La posición se publica en Redis Pub/Sub (< 10ms latencia)
- Los clientes WebSocket reciben la actualización en tiempo real
- Se almacena en Redis cache por 10 minutos

### 3.6 Confirmar Recogida

```bash
curl -X POST http://localhost:3000/api/tracking/recogio-pedido \
  -H "Content-Type: application/json" \
  -d '{
    "repartidor_id": "rep_001",
    "pedido_id": "PEDIDO_ID_AQUI"
  }'
```

### 3.7 Confirmar Entrega

```bash
curl -X POST http://localhost:3000/api/tracking/confirmar-entrega \
  -H "Content-Type: application/json" \
  -d '{
    "repartidor_id": "rep_001",
    "pedido_id": "PEDIDO_ID_AQUI",
    "metodo_confirmacion": "foto"
  }'
```

---

## 🎯 4. Flujo Completo Automatizado

Existe un script de demostración que ejecuta todo automáticamente:

```bash
cd ultima-milla-backend
npx ts-node scripts/demo-flujo-completo.ts
```

Este script:
1. ✅ Crea un pedido
2. ✅ Simula un pago exitoso
3. ✅ Confirma el restaurante
4. ✅ Visualiza la asignación de repartidor
5. ✅ Simula actualizaciones GPS
6. ✅ Confirma recogida y entrega

**Output esperado:**
```
╔══════════════════════════════════════════════════════════╗
║   DEMO: Sistema EDA - Logística de Última Milla          ║
║   Universidad Nacional de Ingeniería - SI806V             ║
╚══════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────
  📱 FASE 1 - El cliente confirma su pedido
────────────────────────────────────────────────────────────
  ✅ Pedido creado: uuid-aqui
  📤 Evento publicado → Kafka [pedidos] → pedido.creado
  ...
```

---

## 📈 5. Monitoreo en Tiempo Real

### Ver eventos en Kafka UI

1. Abre http://localhost:8080
2. Click en "Topics"
3. Selecciona un topic (ej: `pedidos`)
4. Haz click en "Messages"
5. Verás todos los eventos publicados en tiempo real

### Ver cache en Redis Commander

1. Abre http://localhost:8081
2. Haz click en "KEYS" en la parte izquierda
3. Filtra por patrón (ej: `posicion:*`)
4. Verás las posiciones GPS cachés

### Ver logs del backend

El backend escribe logs en colores en la terminal:

```
✅ Eventos publicados sin error
❌ Errores críticos
📤 Publishing de eventos
👂 Suscripciones a tópicos
🎯 Lógica de negocio (Matching)
🔌 WebSocket connections
```

---

## 🔍 6. API Reference

### Módulo: Pedidos

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/pedidos` | POST | Crear pedido |
| `/api/pedidos` | GET | Listar todos los pedidos |
| `/api/pedidos/:id` | GET | Obtener detalles de un pedido |
| `/api/pedidos/:id/cancelar` | POST | Cancelar pedido |
| `/api/pedidos/:id/confirmar-restaurante` | POST | Restaurante acepta pedido |
| `/api/pedidos/:id/rechazar-restaurante` | POST | Restaurante rechaza pedido |

### Módulo: Pagos

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/pagos` | GET | Listar pagos |
| `/api/pagos/webhook` | POST | Webhook de pasarela |
| `/api/pagos/simular-exitoso` | POST | Simular pago OK (demo) |
| `/api/pagos/simular-fallido` | POST | Simular pago fallido (demo) |
| `/api/pagos/pedido/:pedidoId` | GET | Pagos de un pedido |

### Módulo: Tracking

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/tracking/gps` | POST | Actualizar posición GPS |
| `/api/tracking/posicion/:repartidorId` | GET | Obtener última posición |
| `/api/tracking/en-camino` | POST | Repartidor en camino a restaurante |
| `/api/tracking/recogio-pedido` | POST | Repartidor recogió pedido |
| `/api/tracking/confirmar-entrega` | POST | Confirmar entrega completada |

### Módulo: Matching

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/matching/repartidores/disponibles` | GET | Listar repartidores activos |
| `/api/matching/asignaciones` | GET | Ver todas las asignaciones |
| `/api/matching/asignacion/:pedidoId` | GET | Repartidor asignado a un pedido |

### Módulo: Notificaciones

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/notificaciones` | GET | Historial de notificaciones |
| `/api/notificaciones/circuit-breaker` | GET | Estado del circuit breaker |

### Módulo: Analytics

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/analytics/metricas` | GET | Métricas en tiempo real |

---

## ⚠️ 7. Troubleshooting

### Error: "Connection refused" en Kafka/Redis

**Causa:** Docker no está corriendo

**Solución:**
```bash
docker-compose down
docker-compose up -d
```

### Error: "Port already in use"

**Causa:** La infraestructura ya está corriendo en otro contenedor

**Solución:**
```bash
docker-compose down --volumes
docker-compose up -d
```

### Error: "Redis not available"

**Solución:** Espera 5 segundos y reinicia los containers
```bash
docker-compose restart redis
```

### El backend no se inicia

**Verificar:**
1. Kafka y Redis están corriendo: `docker-compose ps`
2. Las dependencias están instaladas: `npm install`
3. No hay conflictos de puerto: `lsof -i :3000`

---

## 📝 8. Preparar para Demostración

### Antes de la presentación:

1. **Arrancar todo en este orden:**
   ```bash
   # Terminal 1: Infraestructura
   cd ultima-milla-backend
   docker-compose up -d
   
   # Terminal 2: Backend
   npm run start:dev
   ```

2. **Abrir dashboards:**
   - Kafka UI: http://localhost:8080
   - Redis Commander: http://localhost:8081
   - Backend: http://localhost:3000/api/health

3. **Ejecutar demo completa:**
   ```bash
   # Terminal 3
   npx ts-node scripts/demo-flujo-completo.ts
   ```

4. **Monitorear en tiempo real:**
   - Topics actualizándose en Kafka UI
   - Métricas en Analytics
   - Posiciones GPS en Redis

---

## 🎓 Conceptos Clave

### Event-Driven Architecture (EDA)

Este backend implementa **Arquitectura Orientada a Eventos** donde:

- ✅ **Desacoplamiento:** Los servicios NO conocen uns a otros
- ✅ **Coreografía:** Los servicios publican eventos y se suscriben a otros
- ✅ **Idempotencia:** Con `event_id`, los reintentos no causan duplicados
- ✅ **Resiliencia:** Con Dead Letter Queue, los errores no se pierden
- ✅ **Escalabilidad:** Kafka permite múltiples consumer groups

### Flujo de un Pedido

```
1. Cliente crea pedido
   ↓
2. Evento: pedido.creado → Kafka
   ├─→ Notificaciones: envía push
   ├─→ Matching: espera correlación AND
   └─→ Analytics: registra métrica
   ↓
3. Pasarela procesa pago
   ↓
4. Evento: pago.procesado → Kafka
   ├─→ Facturación: genera boleta
   ├─→ Matching: tiene 1/2 de correlación
   └─→ Notificaciones: push de confirmación
   ↓
5. Restaurante confirma
   ↓
6. Evento: pedido.confirmado_por_restaurante → Kafka
   ├─→ Matching: CORRELACIÓN COMPLETA (AND)
   └─→ Ejecuta algoritmo Haversine + calificación
   ↓
7. Evento: repartidor.asignado → Kafka
   ├─→ Notificaciones: avisa al repartidor
   └─→ Tracking: inicia seguimiento
   ↓
8. Repartidor actualiza GPS cada 3s
   ↓
9. Evento: repartidor.posicion_actualizada → Redis Pub/Sub
   ├─→ WebSocket → Cliente (< 10ms)
   └─→ Cliente ve el repartidor moverse en mapa
   ↓
10. Repartidor confirma entrega
    ↓
11. Evento: pedido.entregado → Kafka
    ├─→ Notificaciones: pide calificación
    ├─→ Analytics: registra cierre
    └─→ Sistema: completado
```

---

## 🚀 ¿Siguiente Paso?

Una vez verificado que el backend funciona:

1. **Frontend (Next.js):** Tu compañero integra con estos endpoints
2. **Documentación API:** Usa esta guía para integración
3. **Tests E2E:** Crea test cases con Cypress/Playwright
4. **Deployment:** Docker → Kubernetes → Cloud

---

**¡Backend EDA listo para producción!** 🎉

Para dudas, revisar logs en terminal donde corre `npm run start:dev`.
