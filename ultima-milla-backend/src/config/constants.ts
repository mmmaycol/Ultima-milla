// ============================================================
// TÓPICOS DE KAFKA
// Configuración centralizada de todos los tópicos del sistema
// Basado en la arquitectura EDA definida en el proyecto
// ============================================================

export const KAFKA_TOPICS = {
  // Tópicos principales de negocio
  PEDIDOS: 'pedidos',
  PAGOS: 'pagos',
  REPARTIDORES_EVENTOS: 'repartidores.eventos',
  NOTIFICACIONES: 'notificaciones',
  ANALYTICS_RAW: 'analytics.raw',
  DEAD_LETTER_QUEUE: 'dead-letter-queue',
};

// ============================================================
// NOMBRES DE EVENTOS
// Convención: entidad.accion_en_pasado
// Un evento es un hecho consumado, no una orden
// ============================================================

export const EVENTS = {
  // Ciclo de vida del pedido
  PEDIDO_CREADO: 'pedido.creado',
  PEDIDO_CONFIRMADO_POR_RESTAURANTE: 'pedido.confirmado_por_restaurante',
  PEDIDO_RECHAZADO_POR_RESTAURANTE: 'pedido.rechazado_por_restaurante',
  PEDIDO_ENTREGADO: 'pedido.entregado',
  PEDIDO_CANCELADO: 'pedido.cancelado',

  // Pagos
  PAGO_PROCESADO: 'pago.procesado',
  PAGO_FALLIDO: 'pago.fallido',

  // Repartidor
  REPARTIDOR_ASIGNADO: 'repartidor.asignado',
  REPARTIDOR_EN_CAMINO_AL_RESTAURANTE: 'repartidor.en_camino_al_restaurante',
  REPARTIDOR_RECOGIO_PEDIDO: 'repartidor.recogio_pedido',
  REPARTIDOR_POSICION_ACTUALIZADA: 'repartidor.posicion_actualizada',

  // Post-entrega
  REEMBOLSO_INICIADO: 'reembolso.iniciado',
  CALIFICACION_RECIBIDA: 'calificacion.recibida',
};

// ============================================================
// ESTADOS DEL PEDIDO
// Reconstruidos via Event Sourcing desde el log de eventos
// ============================================================

export enum EstadoPedido {
  PENDIENTE = 'PENDIENTE',
  PAGO_CONFIRMADO = 'PAGO_CONFIRMADO',
  EN_PREPARACION = 'EN_PREPARACION',
  REPARTIDOR_ASIGNADO = 'REPARTIDOR_ASIGNADO',
  REPARTIDOR_EN_CAMINO = 'REPARTIDOR_EN_CAMINO',
  EN_ENTREGA = 'EN_ENTREGA',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO',
}

// ============================================================
// CONFIGURACIÓN DE REINTENTOS (Backoff Exponencial)
// ============================================================

export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000, // 1s, 2s, 4s con backoff exponencial
  MAX_JITTER_MS: 500,
};

// ============================================================
// REDIS TTL
// ============================================================

export const REDIS_TTL = {
  GPS_POSITION_SECONDS: 600,       // 10 minutos
  MATCHING_CORRELATION_SECONDS: 600, // 10 minutos
  SESSION_SECONDS: 86400,          // 24 horas
};

// ============================================================
// CONFIGURACIÓN DE TÓPICOS KAFKA
// ============================================================

export const TOPIC_CONFIG = {
  [KAFKA_TOPICS.PEDIDOS]: { partitions: 24, retentionDays: 7 },
  [KAFKA_TOPICS.PAGOS]: { partitions: 12, retentionDays: 30 },
  [KAFKA_TOPICS.REPARTIDORES_EVENTOS]: { partitions: 24, retentionDays: 7 },
  [KAFKA_TOPICS.NOTIFICACIONES]: { partitions: 12, retentionDays: 3 },
  [KAFKA_TOPICS.ANALYTICS_RAW]: { partitions: 48, retentionDays: 90 },
  [KAFKA_TOPICS.DEAD_LETTER_QUEUE]: { partitions: 6, retentionDays: 14 },
};
