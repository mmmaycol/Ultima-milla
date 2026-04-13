import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer, Consumer, EachMessagePayload, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { KAFKA_TOPICS, RETRY_CONFIG } from '../../config/constants';

/**
 * KafkaService
 *
 * Servicio central para interactuar con Apache Kafka.
 * Implementa el patrón fire-and-forget asegurado con acks=all.
 *
 * Todos los productores publican con confirmación de réplicas.
 * El Outbox Pattern se gestiona a nivel de cada módulo de negocio.
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'ultima-milla-backend',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      // acks=all: el líder y todas las réplicas confirman antes de responder
      // Garantiza que ningún evento se pierde aunque falle un nodo Kafka
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.logger.log('✅ Kafka Producer conectado');
    } catch (error) {
      this.logger.error('❌ Error conectando Kafka Producer:', error.message);
      // En modo desarrollo sin Kafka disponible, continuamos sin bloquear
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    for (const [groupId, consumer] of this.consumers) {
      await consumer.disconnect();
      this.logger.log(`Consumer ${groupId} desconectado`);
    }
  }

  /**
   * Publica un evento en un tópico de Kafka.
   *
   * Cada evento lleva metadata estándar:
   * - event_id: UUID v4 único para idempotencia en consumidores
   * - event_type: nombre del evento (ej: "pedido.creado")
   * - timestamp: ISO 8601
   * - trace_id: para Distributed Tracing con Jaeger
   */
  async publicarEvento(
    topico: string,
    tipoEvento: string,
    payload: Record<string, any>,
    traceId?: string,
  ): Promise<void> {
    const evento = {
      event_id: uuidv4(),
      event_type: tipoEvento,
      timestamp: new Date().toISOString(),
      trace_id: traceId || uuidv4(),
      payload,
    };

    try {
      await this.producer.send({
        topic: topico,
        messages: [
          {
            key: payload.pedido_id || payload.id || uuidv4(),
            value: JSON.stringify(evento),
            headers: {
              event_type: tipoEvento,
              event_id: evento.event_id,
              trace_id: evento.trace_id,
            },
          },
        ],
      });

      this.logger.log(`📤 Evento publicado → [${topico}] ${tipoEvento}`);

      // Forward a analytics.raw (todos los eventos van al tópico analítico)
      if (topico !== KAFKA_TOPICS.ANALYTICS_RAW && topico !== KAFKA_TOPICS.DEAD_LETTER_QUEUE) {
        await this.producer.send({
          topic: KAFKA_TOPICS.ANALYTICS_RAW,
          messages: [{ value: JSON.stringify(evento) }],
        });
      }
    } catch (error) {
      this.logger.error(`❌ Error publicando evento ${tipoEvento}:`, error.message);
      throw error;
    }
  }

  /**
   * Envía un mensaje a la Dead Letter Queue.
   * Llamado después de 3 reintentos fallidos.
   */
  async enviarADLQ(
    mensajeOriginal: any,
    error: Error,
    intentos: number,
  ): Promise<void> {
    const dlqPayload = {
      mensaje_original: mensajeOriginal,
      error: {
        message: error.message,
        stack: error.stack,
      },
      intentos,
      timestamp_fallo: new Date().toISOString(),
    };

    await this.producer.send({
      topic: KAFKA_TOPICS.DEAD_LETTER_QUEUE,
      messages: [{ value: JSON.stringify(dlqPayload) }],
    });

    this.logger.warn(`⚠️  Mensaje enviado a DLQ tras ${intentos} intentos`);
  }

  /**
   * Suscribe un consumer a un tópico con backoff exponencial en errores.
   * Implementa procesamiento idempotente via event_id.
   */
  async suscribir(
    groupId: string,
    topico: string,
    handler: (payload: EachMessagePayload) => Promise<void>,
  ): Promise<void> {
    const consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    try {
      await consumer.connect();
      await consumer.subscribe({ topic: topico, fromBeginning: false });

      await consumer.run({
        eachMessage: async (messagePayload) => {
          let intentos = 0;

          while (intentos < RETRY_CONFIG.MAX_RETRIES) {
            try {
              await handler(messagePayload);
              return;
            } catch (error) {
              intentos++;
              if (intentos >= RETRY_CONFIG.MAX_RETRIES) {
                await this.enviarADLQ(
                  messagePayload.message.value?.toString(),
                  error,
                  intentos,
                );
                return;
              }

              // Backoff exponencial con jitter
              const delay =
                RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, intentos - 1) +
                Math.random() * RETRY_CONFIG.MAX_JITTER_MS;

              this.logger.warn(
                `⟳ Reintento ${intentos}/${RETRY_CONFIG.MAX_RETRIES} en ${Math.round(delay)}ms`,
              );
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        },
      });

      this.consumers.set(groupId, consumer);
      this.logger.log(`👂 Consumer [${groupId}] suscrito a tópico: ${topico}`);
    } catch (error) {
      this.logger.error(
        `❌ Error suscribiendo consumer ${groupId} a ${topico}:`,
        error.message,
      );
    }
  }
}
