# 🔗 Guía de Integración Frontend (Next.js)

**Para tu compañero que está haciendo el frontend**

---

## 📋 Endpoints Disponibles

### 🧾 Base URL
```
http://localhost:3000/api
```

---

## 📦 Módulo: Pedidos

### 1. Crear un Pedido

**Endpoint:**
```
POST /pedidos
```

**Request Body:**
```json
{
  "cliente_id": "string (required)",
  "restaurante_id": "string (required)",
  "direccion_entrega": {
    "calle": "string (required)",
    "distrito": "string (required)",
    "ciudad": "string (required)",
    "referencia": "string (optional)",
    "latitud": "number (required)",
    "longitud": "number (required)"
  },
  "items": [
    {
      "producto_id": "string",
      "nombre": "string",
      "cantidad": "number",
      "precio_unitario": "number"
    }
  ],
  "metodo_pago": "tarjeta | efectivo | billetera_digital",
  "notas": "string (optional)"
}
```

**Response:**
```json
{
  "pedido_id": "uuid-string"
}
```

**Ejemplos TypeScript/React:**
```typescript
// App Cliente
const crearPedido = async (datos) => {
  const response = await fetch('http://localhost:3000/api/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  return response.json();
};

// Llamar:
const { pedido_id } = await crearPedido({
  cliente_id: 'user_123',
  restaurante_id: 'resto_456',
  direccion_entrega: {
    calle: 'Av. Larco 123',
    distrito: 'Miraflores',
    ciudad: 'Lima',
    latitud: -12.1219,
    longitud: -77.0299
  },
  items: [
    {
      producto_id: 'menu_001',
      nombre: 'Combo Burger',
      cantidad: 1,
      precio_unitario: 28.50
    }
  ],
  metodo_pago: 'tarjeta'
});
```

---

### 2. Listar Pedidos del Cliente

**Endpoint:**
```
GET /pedidos
```

**Query Parameters:**
```
?cliente_id=string (optional)
```

**Response:**
```json
[
  {
    "pedido_id": "uuid",
    "cliente_id": "string",
    "restaurante_id": "string",
    "total": 46.30,
    "estado": "ENTREGADO",
    "created_at": "ISO-8601"
  }
]
```

---

### 3. Obtener un Pedido Específico

**Endpoint:**
```
GET /pedidos/:id
```

**Response:**
```json
{
  "pedido_id": "uuid",
  "cliente_id": "string",
  "restaurante_id": "string",
  "estado": "EN_ENTREGA",
  "direccion_entrega": { ... },
  "items": [ ... ],
  "total": 46.30,
  "repartidor_asignado": {
    "id": "rep_001",
    "nombre": "Carlos",
    "calificacion": 4.8,
    "ubicacion": {
      "latitud": -12.125,
      "longitud": -77.028
    }
  }
}
```

---

### 4. Confirmar Pedido desde Restaurante

**Endpoint:**
```
POST /pedidos/:id/confirmar-restaurante
```

**Request Body:**
```json
{
  "restaurante_id": "string",
  "tiempo_estimado_preparacion_minutos": 15
}
```

**Response:**
```json
{
  "ok": true
}
```

---

### 5. Cancelar Pedido

**Endpoint:**
```
POST /pedidos/:id/cancelar
```

**Request Body:**
```json
{
  "motivo": "string",
  "cancelado_por": "cliente | restaurante | sistema"
}
```

---

## 💳 Módulo: Pagos

### 1. Webhook de Pasarela (NO LLAMAR desde Frontend)

**Endpoint:**
```
POST /pagos/webhook
```

**Nota:** Este endpoint es llamado por Stripe/Culqi, NO desde tu frontend.

---

### 2. Obtener Pagos de un Pedido

**Endpoint:**
```
GET /pagos/pedido/:pedidoId
```

**Response:**
```json
[
  {
    "pago_id": "uuid",
    "pedido_id": "uuid",
    "monto": 46.30,
    "estado": "COMPLETADO",
    "metodo": "tarjeta",
    "timestamp": "ISO-8601"
  }
]
```

---

## 📡 Módulo: Tracking (GPS en Tiempo Real)

### 1. Conectar WebSocket para Tracking

**URL:**
```
ws://localhost:3000/tracking
```

**Código React:**
```typescript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function TrackingMap({ pedidoId }) {
  const [repartidorUbicacion, setRepartidorUbicacion] = useState(null);

  useEffect(() => {
    // Conectar al WebSocket
    const socket = io('http://localhost:3000/tracking', {
      cors: {
        origin: 'http://localhost:3001',
        credentials: true
      }
    });

    // Suscribirse al tracking de este pedido
    socket.emit('suscribir_pedido', { pedido_id: pedidoId });

    // Escuchar actualizaciones de GPS
    socket.on('gps_actualizado', (datos) => {
      setRepartidorUbicacion({
        latitud: datos.latitud,
        longitud: datos.longitud,
        velocidad: datos.velocidad
      });
    });

    // Cleanup
    return () => {
      socket.emit('desuscribir_pedido', { pedido_id: pedidoId });
      socket.disconnect();
    };
  }, [pedidoId]);

  return (
    <div>
      {repartidorUbicacion ? (
        <p>
          Repartidor en: {repartidorUbicacion.latitud.toFixed(4)},
          {repartidorUbicacion.longitud.toFixed(4)} 
          ({repartidorUbicacion.velocidad.toFixed(1)} km/h)
        </p>
      ) : (
        <p>Esperando ubicación...</p>
      )}
    </div>
  );
}
```

---

### 2. Obtener Última Posición Conocida

**Endpoint:**
```
GET /tracking/posicion/:repartidorId
```

**Response:**
```json
{
  "repartidor_id": "rep_001",
  "latitud": -12.1250,
  "longitud": -77.0280,
  "velocidad": 42.5,
  "timestamp": "ISO-8601"
}
```

---

## 🎯 Módulo: Matching

### 1. Ver Repartidores Disponibles

**Endpoint:**
```
GET /matching/repartidores/disponibles
```

**Response:**
```json
[
  {
    "id": "rep_001",
    "nombre": "Carlos Quispe",
    "calificacion": 4.8,
    "latitud": -12.046,
    "longitud": -77.042,
    "activo": true
  },
  {
    "id": "rep_002",
    "nombre": "María López",
    "calificacion": 4.9,
    "latitud": -12.051,
    "longitud": -77.038,
    "activo": true
  }
]
```

---

### 2. Ver Asignación de un Pedido

**Endpoint:**
```
GET /matching/asignacion/:pedidoId
```

**Response:**
```json
{
  "pedido_id": "uuid",
  "repartidor_asignado": {
    "id": "rep_001",
    "nombre": "Carlos Quispe",
    "calificacion": 4.8,
    "telefono": "+51-900-123-456"
  }
}
```

---

## 🔔 Módulo: Notificaciones

### 1. Historial de Notificaciones

**Endpoint:**
```
GET /notificaciones
```

**Response:**
```json
[
  {
    "notificacion_id": "uuid",
    "usuario_id": "string",
    "mensaje": "Tu repartidor está a 5 minutos",
    "tipo": "push | sms | email",
    "leída": false,
    "timestamp": "ISO-8601"
  }
]
```

---

## 📊 Módulo: Analytics

### 1. Obtener Métricas del Sistema

**Endpoint:**
```
GET /analytics/metricas
```

**Response:**
```json
{
  "periodo": "hoy",
  "pedidos_creados": 145,
  "pedidos_entregados": 132,
  "pedidos_cancelados": 8,
  "tiempo_promedio_entrega_minutos": 18,
  "tasa_exito_pagos_porcentaje": 98.5,
  "repartidores_activos": 12,
  "ingresos_total": 2850.75,
  "calificacion_promedio": 4.7
}
```

---

## 🔑 Ejemplo Completo: Flujo de Compra

### Cliente en React/Next.js

```typescript
// pages/pedido.tsx
import { useState } from 'react';
import { TrackingMap } from '@/components/TrackingMap';

export default function PedidoPage() {
  const [pedidoId, setPedidoId] = useState(null);
  const [estado, setEstado] = useState('CREANDO');

  const crearPedido = async () => {
    setEstado('CREANDO');
    
    // PASO 1: Crear pedido
    const respuesta = await fetch('http://localhost:3000/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: 'user_123',
        restaurante_id: 'resto_001',
        direccion_entrega: {
          calle: 'Av. Larco 123',
          distrito: 'Miraflores',
          ciudad: 'Lima',
          latitud: -12.1219,
          longitud: -77.0299
        },
        items: [
          {
            producto_id: 'prod_001',
            nombre: 'Combo Burger',
            cantidad: 1,
            precio_unitario: 28.50
          }
        ],
        metodo_pago: 'tarjeta'
      })
    });

    const { pedido_id } = await respuesta.json();
    setPedidoId(pedido_id);
    
    setEstado('PAGANDO');
    // PASO 2: Procesar pago (Stripe)
    // ... código de Stripe ...
    
    setEstado('CONFIRMANDO');
    // PASO 3: El restaurante acepta
    // (esperar evento del backend)
    
    setEstado('TRACKING');
  };

  if (!pedidoId) {
    return <button onClick={crearPedido}>Crear Pedido</button>;
  }

  return (
    <div>
      <h1>Seguimiento de Pedido {pedidoId}</h1>
      <p>Estado: {estado}</p>
      <TrackingMap pedidoId={pedidoId} />
    </div>
  );
}
```

---

## ⚙️ CORS Configuration

El backend está configurado para aceptar CORS desde:
```
http://localhost:3001  (default Next.js dev port)
```

Si tu frontend corre en otro puerto, modificar [main.ts](main.ts):
```typescript
app.enableCors({
  origin: 'http://localhost:3001', // Cambiar aquí
  credentials: true,
});
```

---

## 🔐 Notas de Seguridad

1. **JWT:** El backend NO incluye autenticación (tu dominio)
2. **HTTPS:** En producción, cambiar `http://` a `https://`
3. **Validación Backend:** El backend valida con `class-validator`
4. **CORS:** Cambiar `http://localhost:3001` en producción

---

## 📱 Interfaces TypeScript Recomendadas

```typescript
// types.ts
export interface Pedido {
  pedido_id: string;
  cliente_id: string;
  restaurante_id: string;
  estado: 'PENDIENTE' | 'PAGO_CONFIRMADO' | 'EN_PREPARACION' | 
          'REPARTIDOR_ASIGNADO' | 'REPARTIDOR_EN_CAMINO' | 
          'EN_ENTREGA' | 'ENTREGADO' | 'CANCELADO';
  total: number;
  created_at: string;
}

export interface Repartidor {
  id: string;
  nombre: string;
  calificacion: number;
  latitud: number;
  longitud: number;
  activo: boolean;
}

export interface PosicionGPS {
  repartidor_id: string;
  latitud: number;
  longitud: number;
  velocidad: number;
  timestamp: string;
}
```

---

## 🚀 Listo para Integrarse

El backend está **100% funcional** y listo para que tu compañero desarrolle el frontend.

**Importante:** Mantener el backend corriendo mientras desarrolla (o usar datos mockados en desarrollo).
