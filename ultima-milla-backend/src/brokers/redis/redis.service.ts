import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_TTL } from '../../config/constants';

/**
 * RedisService
 *
 * Gestiona dos usos distintos de Redis en la arquitectura EDA:
 *
 * 1. Redis Pub/Sub → Telemetría GPS (repartidor.posicion_actualizada)
 *    - Latencia < 10ms (vs 5-50ms de Kafka)
 *    - Sin persistencia (datos efímeros)
 *    - El cliente ve el repartidor moverse en tiempo real
 *
 * 2. Redis Cache → Estado temporal
 *    - Posición GPS actual con TTL 10 minutos
 *    - Correlaciones pendientes del Servicio de Matching (TTL 10min)
 *    - Registro de event_ids procesados (idempotencia)
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  // Dos clientes separados: uno para Pub/Sub, otro para comandos normales
  private publisher: Redis;
  private subscriber: Redis;
  private cache: Redis;

  private subscriptionHandlers: Map<string, (message: string) => void> = new Map();

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times: number) => {
        if (times > 5) return null; // En dev, no bloquear si Redis no está disponible
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    };

    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
    this.cache = new Redis(redisConfig);
  }

  async onModuleInit() {
    try {
      await this.publisher.connect();
      await this.subscriber.connect();
      await this.cache.connect();
      this.logger.log('✅ Redis conectado (publisher, subscriber, cache)');
    } catch (error) {
      this.logger.warn('⚠️  Redis no disponible, funcionando en modo degradado');
    }
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
    await this.cache.quit();
  }

  // ============================================================
  // GPS PUB/SUB - Telemetría en tiempo real
  // ============================================================

  /**
   * Publica posición GPS de un repartidor.
   * Canal: gps:{repartidor_id}
   * Los clientes con WebSocket abierto reciben la actualización < 10ms.
   */
  async publicarPosicionGPS(
    repartidorId: string,
    posicion: { latitud: number; longitud: number; velocidad: number; timestamp: string },
  ): Promise<void> {
    const canal = `gps:${repartidorId}`;
    const payload = JSON.stringify(posicion);

    // Pub/Sub para entrega inmediata a WebSocket subscribers
    await this.publisher.publish(canal, payload);

    // Cache con TTL 10 minutos (última posición conocida)
    await this.cache.setex(
      `posicion:${repartidorId}`,
      REDIS_TTL.GPS_POSITION_SECONDS,
      payload,
    );
  }

  /**
   * Suscribe a las actualizaciones GPS de un repartidor específico.
   * El Servicio de Tracking llama esto para cada cliente WebSocket activo.
   */
  async suscribirGPS(
    repartidorId: string,
    handler: (posicion: any) => void,
  ): Promise<void> {
    const canal = `gps:${repartidorId}`;

    await this.subscriber.subscribe(canal);
    this.subscriptionHandlers.set(canal, (message) => {
      handler(JSON.parse(message));
    });

    this.subscriber.on('message', (ch, msg) => {
      const h = this.subscriptionHandlers.get(ch);
      if (h) h(msg);
    });
  }

  async desuscribirGPS(repartidorId: string): Promise<void> {
    const canal = `gps:${repartidorId}`;
    await this.subscriber.unsubscribe(canal);
    this.subscriptionHandlers.delete(canal);
  }

  // ============================================================
  // CACHE - Última posición conocida
  // ============================================================

  async obtenerUltimaPosicion(repartidorId: string): Promise<any | null> {
    const data = await this.cache.get(`posicion:${repartidorId}`);
    return data ? JSON.parse(data) : null;
  }

  // ============================================================
  // CORRELACIÓN MATCHING (AND: pago.procesado + confirmado_por_restaurante)
  // ============================================================

  async guardarCorrelacion(pedidoId: string, evento: string, datos: any): Promise<void> {
    const clave = `correlacion:${pedidoId}:${evento}`;
    await this.cache.setex(
      clave,
      REDIS_TTL.MATCHING_CORRELATION_SECONDS,
      JSON.stringify(datos),
    );
  }

  async obtenerCorrelacion(pedidoId: string, evento: string): Promise<any | null> {
    const clave = `correlacion:${pedidoId}:${evento}`;
    const data = await this.cache.get(clave);
    return data ? JSON.parse(data) : null;
  }

  async eliminarCorrelacion(pedidoId: string, ...eventos: string[]): Promise<void> {
    const claves = eventos.map((e) => `correlacion:${pedidoId}:${e}`);
    await this.cache.del(...claves);
  }

  // ============================================================
  // IDEMPOTENCIA - Deduplicación de eventos
  // ============================================================

  /**
   * Verifica si un event_id ya fue procesado.
   * Cada consumidor llama esto para evitar efectos secundarios duplicados.
   */
  async yaFueProcesado(eventId: string): Promise<boolean> {
    const clave = `processed:${eventId}`;
    const resultado = await this.cache.set(clave, '1', 'EX', 86400, 'NX');
    // NX = solo setea si no existe. Si retorna null, ya existía (ya fue procesado)
    return resultado === null;
  }

  // ============================================================
  // CACHE GENÉRICO
  // ============================================================

  async set(clave: string, valor: any, ttlSeconds?: number): Promise<void> {
    const serializado = JSON.stringify(valor);
    if (ttlSeconds) {
      await this.cache.setex(clave, ttlSeconds, serializado);
    } else {
      await this.cache.set(clave, serializado);
    }
  }

  async get<T>(clave: string): Promise<T | null> {
    const data = await this.cache.get(clave);
    return data ? JSON.parse(data) : null;
  }

  async delete(clave: string): Promise<void> {
    await this.cache.del(clave);
  }
}
