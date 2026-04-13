import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { RedisService } from '../../brokers/redis/redis.service';
import { KAFKA_TOPICS } from '../../config/constants';

/**
 * AnalyticsService
 *
 * Consumidor del tópico analytics.raw (recibe TODOS los eventos del sistema).
 *
 * Usa Kafka Streams (simulado aquí) para procesar eventos en ventanas de 1 minuto:
 *   - Pedidos por minuto por zona geográfica
 *   - Tiempo promedio de preparación por restaurante
 *   - Tasa de cancelación por motivo
 *   - Distribución de calificaciones
 *
 * Los resultados se proyectan al Data Warehouse (BigQuery en producción)
 * y al dashboard en tiempo real.
 *
 * Consistencia eventual: el dashboard puede mostrar datos con hasta
 * 2 segundos de retraso. Esto es aceptable para el negocio.
 */
@Injectable()
export class AnalyticsService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsService.name);

  // Métricas agregadas (en producción: BigQuery + dashboard en tiempo real)
  private metricas = {
    total_pedidos: 0,
    pedidos_entregados: 0,
    pedidos_cancelados: 0,
    total_pagos_procesados: 0,
    ingresos_totales: 0,
    pagos_fallidos: 0,
    calificaciones: [] as number[],
    eventos_por_tipo: {} as Record<string, number>,
    ultima_actualizacion: new Date().toISOString(),
  };

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.kafkaService.suscribir(
      'analytics-group-raw',
      KAFKA_TOPICS.ANALYTICS_RAW,
      this.procesarEvento.bind(this),
    );
    this.logger.log('📊 AnalyticsService listo. Procesando analytics.raw...');
  }

  private async procesarEvento(messagePayload: any): Promise<void> {
    try {
      const mensaje = JSON.parse(messagePayload.message.value.toString());
      const { event_type, payload } = mensaje;

      // Contador por tipo de evento
      this.metricas.eventos_por_tipo[event_type] =
        (this.metricas.eventos_por_tipo[event_type] || 0) + 1;

      // Métricas específicas por evento
      switch (event_type) {
        case 'pedido.creado':
          this.metricas.total_pedidos++;
          break;
        case 'pedido.entregado':
          this.metricas.pedidos_entregados++;
          break;
        case 'pedido.cancelado':
          this.metricas.pedidos_cancelados++;
          break;
        case 'pago.procesado':
          this.metricas.total_pagos_procesados++;
          this.metricas.ingresos_totales += payload?.monto || 0;
          break;
        case 'pago.fallido':
          this.metricas.pagos_fallidos++;
          break;
        case 'calificacion.recibida':
          if (payload?.calificacion) {
            this.metricas.calificaciones.push(payload.calificacion);
          }
          break;
      }

      this.metricas.ultima_actualizacion = new Date().toISOString();
    } catch (error) {
      // Analytics no debe interrumpir el flujo principal por errores propios
      this.logger.error(`Error procesando evento analytics: ${error.message}`);
    }
  }

  obtenerMetricas(): any {
    const calificacionPromedio =
      this.metricas.calificaciones.length > 0
        ? this.metricas.calificaciones.reduce((a, b) => a + b, 0) /
          this.metricas.calificaciones.length
        : 0;

    return {
      ...this.metricas,
      calificacion_promedio: Math.round(calificacionPromedio * 100) / 100,
      tasa_conversion: this.metricas.total_pedidos > 0
        ? Math.round((this.metricas.pedidos_entregados / this.metricas.total_pedidos) * 100)
        : 0,
      tasa_cancelacion: this.metricas.total_pedidos > 0
        ? Math.round((this.metricas.pedidos_cancelados / this.metricas.total_pedidos) * 100)
        : 0,
    };
  }
}
