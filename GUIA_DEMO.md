# 🚀 Guía de Demostración - Última Milla (Event-Driven Architecture)

## ✨ Lo que Verás en Esta Demo

Este sistema demuestra una **Arquitectura Orientada a Eventos (EDA)** completa con:

- ✅ **Creación de Pedidos**: Cliente crea una orden desde el dashboard
- ✅ **Evento Producer**: Dispara evento `pedido.creado` en Kafka
- ✅ **Event Consumers**: Servicios de matching asignan automáticamente:
  - Restaurante más cercano (basado en ubicación)
  - Repartidor disponible (basado en distancia)
- ✅ **Real-time Tracking**: Al instante ves el repartidor moviéndose en el mapa
- ✅ **Timeline de Eventos**: Visualiza toda la cadena EDA: Cronología de eventos
  - 1️⃣ `pedido.creado` → App Cliente
  - 2️⃣ `pedido.asignado_restaurante` → Matching Service (via Kafka)
  - 3️⃣ `pedido.asignado_repartidor` → Matching Service (via Kafka)
  - 4️⃣ `pedido.en_preparacion` → Restaurante (via WebSocket)
  - 5️⃣ `pedido.en_camino` → Repartidor (GPS + tracking)

---

## 🚀 Cómo Ejecutar

### Opción 1: Ejecución Rápida (Recomendado)

```powershell
# 1. Abre PowerShell en la carpeta del proyecto
cd c:\Users\USER\Downloads\ultima-milla-backend

# 2. Ejecuta el script de inicio
.\start-all.ps1
```

Esto iniciará automáticamente:
- ✅ Frontend en `http://localhost:3000`
- ✅ (Backend en `http://localhost:3001` si está disponible)

### Opción 2: Manual (Dos Terminales)

**Terminal 1 - Frontend:**
```powershell
cd c:\Users\USER\Downloads\ultima-milla-backend\frontend
npm install  # Solo la primera vez
npm run dev
```

Accede a: http://localhost:3000

**Terminal 2 - Backend (Opcional - usaremos Mock Service):**
```powershell
cd c:\Users\USER\Downloads\ultima-milla-backend
npm run start:dev
```

---

## 📊 Flujo de Demostra ción Paso a Paso

### 1. 🏠 Página Principal (http://localhost:3000)
- Verás 3 tarjetas: Cliente, Restaurante, Repartidor
- Cada una muestra qué puedes hacer en ese dashboard
- Haz clic en cualquiera para entrar

### 2. 🛍️ Dashboard Cliente (http://localhost:3000/cliente)

**Crear un Pedido:**
1. Haz clic en botón "✨ Crear Nuevo Pedido"
2. El sistema automáticamente:
   - 📋 Genera evento `pedido.creado`
   - 🏠 Asigna restaurante más cercano (via Kafka)
   - 🚗 Asigna repartidor disponible (via Kafka)
   - 👨‍🍳 Inicia preparación (via WebSocket)

**Ver Timeline de Eventos:**
- En la sección "📅 Timeline de Eventos (EDA)" ves:
  - Todos los eventos procesados
  - Timestamps exactos
  - Datos de cada evento

**Tracking en Vivo:**
- Una vez asignado el repartidor:
  - 📍 Ves la barra de progreso
  - 🗺️ Mapa interactivo con posición actual
  - 📍 Ubicación interpolada GPS

### 3. 🍳 Dashboard Restaurante (http://localhost:3000/restaurante)

**Pedidos por Confirmar:**
- Cuando un cliente crea un pedido, aparece en "📋 Pedidos Nuevos"
- Haz clic en "✓ Aceptar y Preparar"

**En Preparación:**
- El pedido se mueve a "👨‍🍳 En Preparación"
- Después del tiempo estimado, aparece "✅ Listo"
- Haz clic en "🚚 Marcar como Listo"

**Entregas Completadas:**
- Track de resultados del día

### 4. 🚚 Dashboard Repartidor (http://localhost:3000/repartidor)

**Información del Repartidor:**
- Nombre, estado, entregas hoy, rating
- Vehículo asignado
- Contacto

**Pedidos Pendientes:**
- Lista de todas las entregas asignadas
- Monto y distancia de cada una
- Haz clic en "🚗 Iniciar Entrega"

**Entrega en Curso:**
- Visualización completa:
  - Estado y ETA
  - Items a entregar
  - Mapa con posición en vivo
  - Barra de progreso en tiempo real
- Haz clic en "✅ Marcar como Entregado"

---

## 🗺️ Datos de Prueba

### Restaurantes (ubicaciones reales en Lima):
- **Pizza Don Pepe** - Centro de Lima (-12.0464, -77.0428)
- **Chifa Ling Tao** - Surco (-12.0520, -77.0350)
- **Burger House** - Miraflores (-12.0400, -77.0500)

### Repartidores:
- Carlos, María, Juan (ubicaciones aleatorias)

### Tiempos:
- **Preparación**: 10-20 minutos por restaurante
- **Entrega**: Calculada automáticamente basada en distancia
  - Velocidad promedio: 30 km/h
  - Fórmula Haversine para distancias precisas

### Clientes:
- Ubicación aleatoria cada vez (área de San Isidro)
- Items: Pizza, Gaseosa, Postre

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                        │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │   Cliente    │ Restaurante  │    Repartidor           │ │
│  │  Dashboard   │  Dashboard   │    Dashboard            │ │
│  └──────┬───────┴──────┬───────┴──────────┬──────────────┘ │
└─────────┼──────────────┼──────────────────┼─────────────────┘
          │              │                  │
    HTTP  │         HTTP │              HTTP│
    POST  │         GET  │              GET │
          │              │                  │
┌─────────▼──────────────▼──────────────────▼─────────────────┐
│           Mock Service (eventosService.ts)                  │
├─────────────────────────────────────────────────────────────┤
│  Producer:  crearPedidoConEventos()                         │
│  Consumer:  Simula Matching Service (auto-asignación)       │
│  Tracking:  simularTrackingEnTiempoReal() (GPS interpolado) │
│  Events:    pedido.creado → pedido.entregado               │
└─────────────────────────────────────────────────────────────┘
          │
    (En prod: WebSocket → Backend NestJS → Kafka + Redis)
```

---

## 🎯 Conceptos EDA Demostrados

### 1. Event Producer Pattern
```
Cliente crea pedido → Sistema emite evento `pedido.creado`
```

### 2. Event Consumer Pattern
```
Matching Service consume evento → Asigna restaurante + repartidor
```

### 3. Event Sourcing
```
Cada acción genera evento
→ Timeline completo de eventos visible en UI
→ Modo auditoria de todas las acciones
```

### 4. Real-time Communication
```
WebSocket + GPS interpolation
→ Repartidor se mueve en mapa en vivo
→ Cliente ve progreso en tiempo real
```

### 5. Geolocation-based Matching
```
Haversine formula → Distancia precisas
→ Restaurante más cercano automático
→ ETA basada en distancia real
```

---

## 🐛 Troubleshooting

### La página no carga
```
1. Verifica que estés en http://localhost:3000
2. Abre DevTools (F12) y mira la consola
3. Intenta hacer refresh (Ctrl+R)
```

### Los eventos no aparecen en el timeline
```
1. Abre la consola del navegador (F12)
2. Crea un pedido nuevo
3. Espera 2-3 segundos para que se generen todos los eventos
4. Para ver events en tiempo real mira console.log()
```

### El mapa no muestra ubicación
```
1. El mapa usa Google Maps embed (iframe)
2. Requiere conexión a internet
3. Si falla, verás solo la ubicación en texto
```

### Script no ejecuta
```
Si ves error en PowerShell:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📊 Métricas que Puedes Observar

### Cliente:
- Tiempo desde creación hasta evento asignación: ~2.5 segundos
- Tiempo de entrega estimado: Basado en distancia real
- Progreso en vivo: Actualiza cada 3 segundos

### Restaurante:
- Tiempo de preparación: 10-20 minutos (simulado)
- Pedidos por confirmar: Actualización en vivo

### Repartidor:
- Entregas completadas: Contador diario
- Rating: Simulado 4.8-4.9
- Ubicación: Interpolada suavemente

---

## 🚀 Próximas Mejoras (Si quieres expandir)

1. Conectar a backend real (NestJS)
2. Reemplazar Mock Service con Kafka y Redis reales
3. Agregar autenticación
4. Agregar ratings y comentarios
5. Agregar histórico de pedidos
6. Agregar notificaciones push
7. Agregar chat entre usuarios

---

## ✅ Checklist de Demostración

- [ ] Frontend carga en localhost:3000
- [ ] Página principal muestra 3 dashboards
- [ ] Puedo crear un pedido en Cliente
- [ ] Veo timeline de eventos completo en Cliente
- [ ] El mapa se actualiza en tiempo real
- [ ] El restaurante ve el pedido nuevo
- [ ] El repartidor ve la entrega asignada
- [ ] Puedo marcar entregas como completadas
- [ ] Las estadísticas se actualizan

---

## 📞 Soporte

Si tienes problemas:
1. Verifica los logs en la consola del navegador (F12)
2. Revisa que npm packages estén instalados (`npm install`)
3. Prueba hacer refresh de la página
4. Intenta en incógnito sin cache

---

¡Disfruta la demostración de Event-Driven Architecture en acción! 🎉
