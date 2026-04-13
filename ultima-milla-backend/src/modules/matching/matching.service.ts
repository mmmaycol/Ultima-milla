import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { RedisService } from '../../brokers/redis/redis.service';
import { EVENTS, KAFKA_TOPICS, EstadoPedido } from '../../config/constants';

/**
 * MatchingService
 *
 * Implementa la CORRELACIÓN AND del sistema EDA.
 *
 * Para asignar un repartidor se necesitan DOS eventos independientes:
 *   1. pago.procesado       (la pasarela autorizó el cobro)
 *   2. pedido.confirmado_por_restaurante (el local aceptó)
 *
 * Pueden llegar en cualquier orden. Se mantiene en Redis una estructura
 * temporal con TTL de 10 minutos esperando al segundo evento.
 *
 * Solo cuando AMBOS han ocurrido → ejecuta el algoritmo de matching
 * y publica repartidor.asignado (convirtiéndose en PRODUCTOR).
 *
 * Este patrón se denomina "Event Processor": es consumidor y productor a la vez.
 */
@Injectable()
export class MatchingService implements OnModuleInit {
  private readonly logger = new Logger(MatchingService.name);

  // Repartidores disponibles (en producción: base de datos con estado en tiempo real)
  private repartidoresDisponibles: Map<string, any> = new Map([
    ['rep_001', { id: 'rep_001', nombre: 'Carlos Quispe', calificacion: 4.8, latitud: -12.046, longitud: -77.042, activo: true }],
    ['rep_002', { id: 'rep_002', nombre: 'María López', calificacion: 4.9, latitud: -12.051, longitud: -77.038, activo: true }],
    ['rep_003', { id: 'rep_003', nombre: 'Juan Flores', calificacion: 4.7, latitud: -12.043, longitud: -77.045, activo: true }],
  ]);

  // Asignaciones activas
  private asignacionesStore: Map<string, any> = new Map();

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Suscribirse a los dos eventos de la correlación AND
    await this.kafkaService.suscribir(
      'matching-group-pago',
      KAFKA_TOPICS.PAGOS,
      this.manejarEventoPago.bind(this),
    );

    await this.kafkaService.suscribir(
      'matching-group-pedidos',
      KAFKA_TOPICS.PEDIDOS,
      this.manejarEventoPedido.bind(this),
    );

    this.logger.log('🎯 MatchingService listo. Escuchando correlación AND...');
  }

  /**
   * Maneja pago.procesado.
   * Primera o segunda mitad de la correlación AND.
   */
  private async manejarEventoPago(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());

    // Solo nos interesa pago.procesado
    if (mensaje.event_type !== EVENTS.PAGO_PROCESADO) return;

    // Idempotencia: no procesar el mismo evento dos veces
    if (await this.redisService.yaFueProcesado(mensaje.event_id)) return;

    const { pedido_id } = mensaje.payload;
    this.logger.log(`💳 Correlación AND: pago.procesado recibido para pedido ${pedido_id}`);

    await this.redisService.guardarCorrelacion(pedido_id, 'pago', mensaje.payload);
    await this.intentarCorrelacion(pedido_id);
  }

  /**
   * Maneja pedido.confirmado_por_restaurante.
   * Primera o segunda mitad de la correlación AND.
   */
  private async manejarEventoPedido(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());

    if (mensaje.event_type !== EVENTS.PEDIDO_CONFIRMADO_POR_RESTAURANTE) return;
    if (await this.redisService.yaFueProcesado(mensaje.event_id)) return;

    const { pedido_id } = mensaje.payload;
    this.logger.log(`🍽️  Correlación AND: confirmado_por_restaurante recibido para pedido ${pedido_id}`);

    await this.redisService.guardarCorrelacion(pedido_id, 'confirmacion_restaurante', mensaje.payload);
    await this.intentarCorrelacion(pedido_id);
  }

  /**
   * Verifica si ambos eventos de la correlación AND ya llegaron.
   * Si ambos están presentes → ejecuta el algoritmo de matching.
   * Si solo uno → espera. El TTL de Redis maneja el timeout de 10 minutos.
   */
  private async intentarCorrelacion(pedidoId: string): Promise<void> {
    const datosPago = await this.redisService.obtenerCorrelacion(pedidoId, 'pago');
    const datosConfirmacion = await this.redisService.obtenerCorrelacion(pedidoId, 'confirmacion_restaurante');

    if (!datosPago || !datosConfirmacion) {
      this.logger.log(`⏳ Pedido ${pedidoId}: esperando segundo evento de correlación AND...`);
      return;
    }

    // ¡Correlación AND completa! Ambos eventos llegaron
    this.logger.log(`✅ Correlación AND completa para pedido ${pedidoId}. Ejecutando matching...`);

    // Limpiar correlaciones del store
    await this.redisService.eliminarCorrelacion(pedidoId, 'pago', 'confirmacion_restaurante');

    // Ejecutar algoritmo de matching
    await this.ejecutarMatching(pedidoId, datosPago, datosConfirmacion);
  }

  /**
   * Algoritmo de matching: selecciona el repartidor óptimo.
   *
   * Criterios (simplificado para demo):
   *   1. Distancia al restaurante (principal)
   *   2. Calificación promedio (desempate)
   *   3. No tener pedido activo actualmente
   */
  private async ejecutarMatching(
    pedidoId: string,
    datosPago: any,
    datosConfirmacion: any,
  ): Promise<void> {
    const repartidoresLibres = Array.from(this.repartidoresDisponibles.values()).filter(
      (r) => r.activo,
    );

    if (repartidoresLibres.length === 0) {
      this.logger.error(`❌ No hay repartidores disponibles para pedido ${pedidoId}`);
      // En producción: reintentar o notificar al cliente
      return;
    }

    // Restaurante origen (simulado para demo)
    const restauranteLat = -12.048;
    const restauranteLng = -77.040;

    // Calcular score: combina distancia y calificación
    const repartidorOptimo = repartidoresLibres
      .map((r) => ({
        ...r,
        distancia: this.calcularDistanciaKm(
          r.latitud, r.longitud,
          restauranteLat, restauranteLng,
        ),
        score: 0,
      }))
      .map((r) => ({
        ...r,
        // Score más alto = mejor candidato (calificación alta, distancia corta)
        score: r.calificacion * 10 - r.distancia * 5,
      }))
      .sort((a, b) => b.score - a.score)[0];

    const etaMinutos = Math.round(repartidorOptimo.distancia * 3 + 2); // ~3 min/km + 2 base

    // Marcar repartidor como ocupado
    repartidorOptimo.activo = false;
    this.repartidoresDisponibles.set(repartidorOptimo.id, repartidorOptimo);

    const asignacion = {
      pedido_id: pedidoId,
      repartidor_id: repartidorOptimo.id,
      repartidor_nombre: repartidorOptimo.nombre,
      repartidor_calificacion: repartidorOptimo.calificacion,
      eta_minutos: etaMinutos,
      distancia_km: repartidorOptimo.distancia.toFixed(2),
      cliente_id: datosPago.cliente_id,
      timestamp: new Date().toISOString(),
    };

    this.asignacionesStore.set(pedidoId, asignacion);

    // Publica repartidor.asignado → MatchingService se convierte en PRODUCTOR
    // Fan-out: Notificaciones + App Repartidor + Tracking
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.REPARTIDORES_EVENTOS,
      EVENTS.REPARTIDOR_ASIGNADO,
      asignacion,
    );

    this.logger.log(
      `🏍️  Repartidor asignado: ${repartidorOptimo.nombre} → Pedido ${pedidoId} | ETA: ${etaMinutos} min`,
    );
  }

  /**
   * Haversine formula: distancia entre dos coordenadas GPS en km.
   */
  private calcularDistanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  obtenerAsignacion(pedidoId: string): any {
    return this.asignacionesStore.get(pedidoId) || null;
  }

  obtenerRepartidoresDisponibles(): any[] {
    return Array.from(this.repartidoresDisponibles.values()).filter((r) => r.activo);
  }

  obtenerTodasLasAsignaciones(): any[] {
    return Array.from(this.asignacionesStore.values());
  }
}
