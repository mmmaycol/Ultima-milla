# ✔️ Checklist de Validación Final

**Usa este checklist para verificar que TODO funciona**

---

## 🐳 1. Infraestructura Docker

- [ ] Docker está instalado
- [ ] Docker Compose está instalado
- [ ] Ejecutar: `docker-compose ps`
- [ ] Todos los contenedores están `UP`:
  - [ ] zookeeper
  - [ ] kafka
  - [ ] kafka-ui
  - [ ] redis
  - [ ] redis-commander

**Si algo falla:**
```bash
docker-compose down --volumes
docker-compose up -d
```

---

## 📦 2. Dependencias Node.js

- [ ] Node.js 18+ instalado: `node --version`
- [ ] npm instalado: `npm --version`
- [ ] `npm install` completó sin errores
- [ ] Carpeta `node_modules/` existe
- [ ] Archivo `.env` existe

**Si algo falla:**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 🚀 3. Backend Corriendo

**Ejecutar:**
```bash
npm run start:dev
```

Esperar hasta ver:
- [ ] ✅ `Kafka Producer conectado`
- [ ] ✅ `Redis conectado`
- [ ] ✅ `TrackingGateway iniciado`
- [ ] ✅ Rutas mapeadas (PedidosController, PagosController, etc.)
- [ ] ✅ `MatchingService listo`
- [ ] ✅ `NotificacionesService listo`

**NO debe haber errores rojo en la consola**

---

## 🔗 4. Health Checks

### 4.1 API Health

```bash
curl http://localhost:3000/api/health
```

**Esperado:**
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

- [ ] Status es "ok"
- [ ] Kafka es "UP"
- [ ] Redis es "UP"
- [ ] WebSocket es "UP"

### 4.2 Info del Sistema

```bash
curl http://localhost:3000/api
```

**Esperado:**
```json
{
  "sistema": "Sistema de Logística y Entrega de Última Milla",
  "arquitectura": "Event-Driven Architecture (EDA)",
  "broker_principal": "Apache Kafka"
}
```

- [ ] Retorna información del sistema

---

## 📊 5. Dashboards

Abrir en navegador:

- [ ] Kafka UI: http://localhost:8080
  - [ ] Ve "Topics" en el menú izquierdo
  - [ ] Selecciona `pedidos` topic
  - [ ] Puedes ver la estructura de tópicos
  
- [ ] Redis Commander: http://localhost:8081
  - [ ] Conectado a Redis
  - [ ] Puedes ver keys

---

## 🧪 6. Pruebas de Funcionalidad

### 6.1 Crear Pedido

```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": "test_001",
    "restaurante_id": "resto_001",
    "direccion_entrega": {
      "calle": "Av. Test",
      "distrito": "Lima",
      "ciudad": "Lima",
      "latitud": -12.1219,
      "longitud": -77.0299
    },
    "items": [{
      "producto_id": "p1",
      "nombre": "Burger",
      "cantidad": 1,
      "precio_unitario": 10.0
    }],
    "metodo_pago": "tarjeta"
  }'
```

- [ ] Retorna un `pedido_id`
- [ ] Sin errors
- [ ] Guarda el `pedido_id` para los siguientes tests

### 6.2 Ver el Evento en Kafka

1. Abre http://localhost:8080
2. Click en "Topics"
3. Selecciona `pedidos`
4. Click en "Messages"
5. Deberías ver un evento `pedido.creado`

- [ ] Puedo ver el evento
- [ ] El evento tiene el `pedido_id` correcto

### 6.3 Obtener Pedido

```bash
# Reemplaza PEDIDO_ID con el de arriba
curl http://localhost:3000/api/pedidos/PEDIDO_ID
```

- [ ] Retorna el pedido
- [ ] Estado es correcto
- [ ] Datos coinciden

### 6.4 Simular Pago

```bash
curl -X POST http://localhost:3000/api/pagos/simular-exitoso \
  -H "Content-Type: application/json" \
  -d '{
    "pedido_id": "PEDIDO_ID_AQUI",
    "monto": 10.0,
    "cliente_id": "test_001"
  }'
```

- [ ] Sin errores
- [ ] Evento `pago.procesado` aparece en Kafka

### 6.5 Confirmar Restaurante

```bash
curl -X POST http://localhost:3000/api/pedidos/PEDIDO_ID_AQUI/confirmar-restaurante \
  -H "Content-Type: application/json" \
  -d '{
    "restaurante_id": "resto_001",
    "tiempo_estimado_preparacion_minutos": 12
  }'
```

- [ ] Sin errores
- [ ] Evento `pedido.confirmado_por_restaurante` en Kafka

### 6.6 Ver Asignación de Repartidor

```bash
curl http://localhost:3000/api/matching/asignacion/PEDIDO_ID_AQUI
```

- [ ] Retorna repartidor asignado
- [ ] Tiene nombre, calificación, ubicación

### 6.7 Actualizar GPS

```bash
curl -X POST http://localhost:3000/api/tracking/gps \
  -H "Content-Type: application/json" \
  -d '{
    "repartidor_id": "rep_001",
    "latitud": -12.125,
    "longitud": -77.028,
    "velocidad": 42.5
  }'
```

- [ ] Sin errores
- [ ] Retorna `{"ok": true}`

### 6.8 Obtener Última Posición

```bash
curl http://localhost:3000/api/tracking/posicion/rep_001
```

- [ ] Retorna posición
- [ ] Latitud y longitud son números válidos

---

## 📝 7. Logs Esperados

En la terminal donde corre `npm run start:dev`, deberías ver:

```
✅ Kafka Producer conectado
✅ Redis conectado
🔌 WebSocket Gateway iniciado
📤 Evento publicado → [pedidos] pedido.creado
🎯 MatchingService listo
🔔 NotificacionesService listo
👂 Consumer [notificaciones-group-pedidos] suscrito
```

- [ ] Hay logs verde (✅)
- [ ] Hay emojis de estado
- [ ] NO hay líneas rojo (excepto advertencias de Kafka al iniciar)

---

## 🎯 8. Script de Demo

Ejecutar en una terminal nueva:

```bash
npx ts-node scripts/demo-flujo-completo.ts
```

Debería:
- [ ] Crear un pedido
- [ ] Simular un pago
- [ ] Confirmar restaurante
- [ ] Ver asignación de repartidor
- [ ] Actualizar GPS
- [ ] Confirmar entrega

Output esperado:
```
╔══════════════════════════════════════════════════════════╗
║   DEMO: Sistema EDA - Logística de Última Milla          ║
║   Universidad Nacional de Ingeniería - SI806V             ║
╚══════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────
  📱 FASE 1 - El cliente confirma su pedido
────────────────────────────────────────────────────────────
```

- [ ] Script se ejecuta sin errores
- [ ] Completa todas las fases

---

## 🔍 9. Troubleshooting

Si algo NO está chequeado, usar estas soluciones:

### Problema: "Connection refused" en Kafka

**Solución:**
```bash
docker-compose restart kafka zookeeper
sleep 10
npm run start:dev
```

### Problema: "Port already in use"

**Solución:**
```bash
docker-compose down --volumes
docker-compose up -d
npm run start:dev
```

### Problema: Backend no compila

**Solución:**
```bash
rm -rf dist/
npm run build
npm run start:dev
```

### Problema: "Redis not available"

**Solución:**
```bash
docker-compose restart redis
```

### Problema: Endpoints retornan 404

**Asegúrate:**
- [ ] Backend está corriendo
- [ ] URL es correcta (`http://localhost:3000/api/...`)
- [ ] Método HTTP es correcto (POST vs GET)
- [ ] Headers incluyen `Content-Type: application/json`

---

## 📋 Checklist Final (para entregar)

Antes de entregar el proyecto, verificar:

- [ ] ✅ Backend compila sin errores
- [ ] ✅ docker-compose up -d funciona
- [ ] ✅ npm run start:dev funciona
- [ ] ✅ Todos los endpoints responden
- [ ] ✅ Kafka UI muestra eventos
- [ ] ✅ Redis Commander, funciona
- [ ] ✅ Script demo se ejecuta sin errores
- [ ] ✅ Logs en consola son mayormente verdes
- [ ] ✅ .env existe (desde .env.example)
- [ ] ✅ package.json tiene todas las dependencias

---

## 📦 Archivo a Entregar

### ZIP del Backend

Incluir:
```
ultima-milla-backend/
├── src/
├── scripts/
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env (NO incluir en repo público, usar .env.example)
├── README.md
├── GUIA_PRUEBAS.md (esta guía)
└── EXPLICACION_ARQUITECTURA.md
```

**NO incluir:**
```
node_modules/
dist/
.env (usar .env.example en su lugar)
```

### Comando para crear ZIP

```bash
cd ~/proyectos/Ultima-milla
zip -r ultima-milla-backend.zip ultima-milla-backend/ \
  -x "ultima-milla-backend/node_modules/*" \
  "ultima-milla-backend/dist/*" \
  "ultima-milla-backend/.env"

# Verificar
unzip -l ultima-milla-backend.zip | head -20
```

---

**¡SI TODO ESTÁ CHEQUEADO, EL BACKEND ESTÁ 100% LISTO!** 🚀

Compartir con tu grupo:
- 📄 GUIA_PRUEBAS.md (cómo probar)
- 📄 EXPLICACION_ARQUITECTURA.md (para el informe)
- 📄 INTEGRACION_FRONTEND.md (para tu compañero frontend)
