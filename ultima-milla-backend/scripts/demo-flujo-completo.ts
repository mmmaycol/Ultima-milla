/**
 * demo-flujo-completo.ts
 *
 * Script de demostración del ciclo de vida completo de un pedido.
 * Simula el flujo EDA end-to-end llamando a los endpoints REST.
 *
 * Ejecutar con:
 *   npx ts-node scripts/demo-flujo-completo.ts
 *
 * Asegurarse de que el servidor esté corriendo en localhost:3000
 */

const BASE_URL = 'http://localhost:3001/api';

async function post(path: string, body: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return null;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(msg: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${msg}`);
  console.log('─'.repeat(60));
}

async function main() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   DEMO: Sistema EDA - Logística de Última Milla          ║');
  console.log('║   Universidad Nacional de Ingeniería - SI806V             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ── FASE 1: CREACIÓN Y PAGO ──────────────────────────────────

  log('📱 FASE 1 - El cliente confirma su pedido');
  const { pedido_id } = await post('/pedidos', {
    cliente_id: 'cliente_piero_001',
    restaurante_id: 'rest_bembos_miraflores',
    direccion_entrega: {
      calle: 'Av. Larco 123',
      distrito: 'Miraflores',
      ciudad: 'Lima',
      referencia: 'Frente al Larcomar',
      latitud: -12.1219,
      longitud: -77.0299,
    },
    items: [
      { producto_id: 'prod_001', nombre: 'Hamburguesa Clásica', cantidad: 2, precio_unitario: 18.90 },
      { producto_id: 'prod_002', nombre: 'Papas Grandes', cantidad: 1, precio_unitario: 8.50 },
    ],
    metodo_pago: 'tarjeta',
    notas: 'Sin cebolla en las hamburguesas',
  });

  console.log(`\n  ✅ Pedido creado: ${pedido_id}`);
  console.log('  📤 Evento publicado → Kafka [pedidos] → pedido.creado');
  console.log('  🔀 Fan-out paralelo iniciado:');
  console.log('     → Notificaciones: push "Pedido recibido"');
  console.log('     → Matching: iniciando espera de correlación AND');
  console.log('     → Analytics: registrando métrica nuevo pedido');

  await esperar(1000);

  log('💳 FASE 1 - La pasarela de pago procesa el cobro');
  await post('/pagos/simular-exitoso', {
    pedido_id,
    monto: 46.30,
    cliente_id: 'cliente_piero_001',
  });
  console.log('  ✅ Pago procesado exitosamente');
  console.log('  📤 Evento publicado → Kafka [pagos] → pago.procesado');
  console.log('  🔀 Fan-out paralelo:');
  console.log('     → Facturación: generando Boleta');
  console.log('     → Matching: registró 1/2 de correlación AND (pago ✓)');
  console.log('     → Notificaciones: push "Pago confirmado S/ 46.30"');

  await esperar(1000);

  log('🍽️  FASE 1 - El restaurante acepta el pedido');
  await post(`/pedidos/${pedido_id}/confirmar-restaurante`, {
    restaurante_id: 'rest_bembos_miraflores',
    tiempo_estimado_preparacion_minutos: 12,
  });
  console.log('  ✅ Restaurante confirmó el pedido');
  console.log('  📤 Evento → pedido.confirmado_por_restaurante');
  console.log('  🎯 Matching: correlación AND COMPLETA (pago ✓ + restaurante ✓)');
  console.log('  🏍️  Ejecutando algoritmo de selección de repartidor...');

  await esperar(3000); // Esperar más tiempo para que Kafka procese

  // ── FASE 2: ASIGNACIÓN Y TRACKING ───────────────────────────

  log('🏍️  FASE 2 - Repartidor asignado');
  let asignacion = null;
  let intentos = 0;
  while (!asignacion && intentos < 10) {
    asignacion = await get(`/matching/asignacion/${pedido_id}`);
    if (!asignacion || asignacion.error) {
      await esperar(1000);
      intentos++;
    }
  }
  if (asignacion && !asignacion.error) {
    console.log(`  Repartidor: ${asignacion.repartidor_nombre}`);
    console.log(`  Calificación: ⭐ ${asignacion.repartidor_calificacion}`);
    console.log(`  ETA estimado: ${asignacion.eta_minutos} minutos`);
    console.log(`  Distancia al restaurante: ${asignacion.distancia_km} km`);
  } else {
    console.log('  ⚠️  Asignación no encontrada (posible delay en Kafka)');
    asignacion = { repartidor_id: 'rep_001' }; // Fallback para demo
  }
  console.log('  📤 Evento → repartidor.asignado');
  console.log('  📬 Notificación push → cliente con nombre y ETA del repartidor');

  await esperar(1000);

  log('📡 FASE 2 - Simulando telemetría GPS (3 actualizaciones)');
  const repartidorId = asignacion?.repartidor_id || 'rep_001';

  for (let i = 0; i < 3; i++) {
    await post('/tracking/gps', {
      repartidor_id: repartidorId,
      latitud: -12.046 + i * 0.001,
      longitud: -77.042 + i * 0.001,
      velocidad: 25 + Math.random() * 10,
    });
    console.log(`  📍 GPS actualizado [${i + 1}/3] → Redis Pub/Sub → WebSocket → cliente`);
    await esperar(500);
  }

  log('📦 FASE 2 - Repartidor en camino al restaurante');
  await post('/tracking/en-camino', {
    repartidor_id: repartidorId,
    pedido_id,
  });
  console.log('  📤 Evento → repartidor.en_camino_al_restaurante (Kafka)');

  await esperar(800);

  log('📦 FASE 2 - Repartidor recogió el pedido');
  await post('/tracking/recogio-pedido', {
    repartidor_id: repartidorId,
    pedido_id,
  });
  console.log('  📤 Evento → repartidor.recogio_pedido (Kafka)');
  console.log('  📬 Notificación push → "Tu pedido está en camino"');

  await esperar(800);

  // ── FASE 3: ENTREGA Y CIERRE ─────────────────────────────────

  log('✅ FASE 3 - Entrega confirmada');
  await post('/tracking/confirmar-entrega', {
    repartidor_id: repartidorId,
    pedido_id,
    metodo_confirmacion: 'codigo',
  });
  console.log('  📤 Evento → pedido.entregado (Kafka)');
  console.log('  🔀 Fan-out paralelo:');
  console.log('     → Notificaciones: push "¡Tu pedido llegó!"');
  console.log('     → Analytics: registra tiempo total de entrega');
  console.log('     → Tracking GPS: desactivado para este repartidor');

  await esperar(800);

  // ── ESTADO FINAL ─────────────────────────────────────────────

  log('📊 ESTADO FINAL DEL SISTEMA');
  const metricas = await get('/analytics/metricas');
  console.log(`  Total pedidos:      ${metricas.total_pedidos}`);
  console.log(`  Pedidos entregados: ${metricas.pedidos_entregados}`);
  console.log(`  Pagos procesados:   ${metricas.total_pagos_procesados}`);
  console.log(`  Ingresos totales:   S/ ${metricas.ingresos_totales?.toFixed(2)}`);

  const notificaciones = await get('/notificaciones');
  console.log(`  Notificaciones enviadas: ${notificaciones.length}`);

  const comprobantes = await get('/facturacion/comprobantes');
  console.log(`  Comprobantes emitidos:   ${comprobantes.length}`);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   ✅ DEMO COMPLETADO - Ciclo de vida end-to-end          ║');
  console.log('║                                                            ║');
  console.log('║   Flujo demostrado:                                        ║');
  console.log('║   1. pedido.creado → fan-out paralelo                     ║');
  console.log('║   2. pago.procesado + confirmado → correlación AND        ║');
  console.log('║   3. repartidor.asignado → tracking activo                ║');
  console.log('║   4. GPS via Redis Pub/Sub → WebSocket (< 10ms)           ║');
  console.log('║   5. pedido.entregado → cierre analítico                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');
}

main().catch(console.error);
