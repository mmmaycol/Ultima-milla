import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { RedisService } from '../../brokers/redis/redis.service';
import { EVENTS, KAFKA_TOPICS } from '../../config/constants';

/**
 * TrackingService
 *
 * Gestiona la telemetría GPS en tiempo real.
 *
 * ARQUITECTURA DUAL (según diseño EDA del proyecto):
 *
 * 1. Eventos de ESTADO (baja frecuencia, alta importancia):
 *    repartidor.en_camino_al_restaurante, repartidor.recogio_pedido, pedido.entregado
 *    → Van a Kafka (persistidos, disparan múltiples consumidores)
 *
 * 2. Telemetría GPS (alta frecuencia, efímera):
 *    repartidor.posicion_actualizada → cada 3 segundos
 *    → Va a Redis Pub/Sub (latencia < 10ms, sin persistencia)
 *    → El Gateway WebSocket distribuye a clientes conectados
 *
 * Por qué Redis y NO Kafka para GPS:
 *   - Kafka tiene latencia 5-50ms por serialización + replicación
 *   - Redis Pub/Sub entrega en < 10ms (en memoria)
 *   - Los datos GPS son efímeros: la posición de hace 3s ya no sirve
 *   - No se necesita replay de coordenadas GPS históricas
 */
@Injectable()
export class TrackingService implements OnModuleInit {
  private readonly logger = new Logger(TrackingService.name);

  // Callback para notificar al WebSocket Gateway
  private webSocketCallback: ((repartidorId: string, posicion: any) => void) | null = null;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Suscribirse a eventos de estado del repartidor en Kafka
    await this.kafkaService.suscribir(
      'tracking-group-repartidores',
      KAFKA_TOPICS.REPARTIDORES_EVENTOS,
      this.manejarEventoRepartidor.bind(this),
    );

    this.logger.log('📡 TrackingService listo. Escuchando eventos de repartidores...');
  }

  /**
   * Registra el callback del WebSocket Gateway para distribución en tiempo real.
   */
  setWebSocketCallback(callback: (repartidorId: string, posicion: any) => void): void {
    this.webSocketCallback = callback;
  }

  /**
   * Procesa actualizaciones de posición GPS.
   *
   * Llamado por la App Repartidor cada 3 segundos.
   * Publica a Redis Pub/Sub (NO a Kafka) para latencia < 10ms.
   */
  async actualizarPosicionGPS(
    repartidorId: string,
    latitud: number,
    longitud: number,
    velocidad: number,
  ): Promise<void> {
    const posicion = {
      repartidor_id: repartidorId,
      latitud,
      longitud,
      velocidad,
      timestamp: new Date().toISOString(),
    };

    // Redis Pub/Sub → latencia < 10ms → WebSocket → cliente
    await this.redisService.publicarPosicionGPS(repartidorId, posicion);

    // Notificar al Gateway WebSocket si hay callback registrado
    if (this.webSocketCallback) {
      this.webSocketCallback(repartidorId, posicion);
    }
  }

  /**
   * Obtiene la última posición conocida de un repartidor desde Redis Cache.
   * Útil cuando un cliente reconecta su WebSocket.
   */
  async obtenerUltimaPosicion(repartidorId: string): Promise<any | null> {
    return this.redisService.obtenerUltimaPosicion(repartidorId);
  }

  /**
   * Repartidor confirma que está en camino al restaurante.
   * Evento de estado → Kafka (importante, persiste).
   */
  async repartidorEnCamino(repartidorId: string, pedidoId: string): Promise<void> {
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.REPARTIDORES_EVENTOS,
      EVENTS.REPARTIDOR_EN_CAMINO_AL_RESTAURANTE,
      {
        repartidor_id: repartidorId,
        pedido_id: pedidoId,
        timestamp: new Date().toISOString(),
      },
    );
    this.logger.log(`🏍️  Repartidor ${repartidorId} en camino al restaurante (pedido ${pedidoId})`);
  }

  /**
   * Repartidor confirma que recogió el pedido físicamente.
   * Inicia el tramo de entrega al cliente.
   */
  async repartidorRecogioPedido(repartidorId: string, pedidoId: string): Promise<void> {
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.REPARTIDORES_EVENTOS,
      EVENTS.REPARTIDOR_RECOGIO_PEDIDO,
      {
        repartidor_id: repartidorId,
        pedido_id: pedidoId,
        timestamp: new Date().toISOString(),
      },
    );
    this.logger.log(`📦 Repartidor ${repartidorId} recogió el pedido ${pedidoId}`);
  }

  /**
   * Repartidor confirma entrega (foto, firma digital o código del cliente).
   * Evento final del ciclo de vida del pedido.
   */
  async confirmarEntrega(
    repartidorId: string,
    pedidoId: string,
    metodoConfirmacion: 'foto' | 'firma' | 'codigo',
  ): Promise<void> {
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.REPARTIDORES_EVENTOS,
      EVENTS.PEDIDO_ENTREGADO,
      {
        repartidor_id: repartidorId,
        pedido_id: pedidoId,
        metodo_confirmacion: metodoConfirmacion,
        timestamp: new Date().toISOString(),
      },
    );

    // Desactivar tracking GPS para este repartidor
    await this.redisService.delete(`posicion:${repartidorId}`);

    this.logger.log(`✅ Entrega confirmada: repartidor ${repartidorId} → pedido ${pedidoId}`);
  }

  /**
   * Maneja eventos de estado de repartidores desde Kafka.
   */
  private async manejarEventoRepartidor(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());

    if (await this.redisService.yaFueProcesado(mensaje.event_id)) return;

    this.logger.log(`📡 Evento repartidor recibido: ${mensaje.event_type}`);
    // El TrackingService puede actualizar proyecciones locales de estado
  }
}
