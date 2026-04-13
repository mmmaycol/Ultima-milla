import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { KAFKA_TOPICS } from '../../config/constants';

/**
 * DLQWorkerService (Dead Letter Queue Worker)
 *
 * Última línea de defensa del sistema.
 *
 * Un mensaje llega a la DLQ cuando:
 *   - 3 reintentos con backoff exponencial fallaron
 *   - Indica un problema persistente (bug en código, schema incompatible,
 *     dependencia no disponible, etc.)
 *
 * El DLQ Worker:
 *   1. Recoge los mensajes fallidos
 *   2. Registra el error con contexto completo (stack trace, intentos, timestamp)
 *   3. Notifica al equipo de operaciones via Slack/PagerDuty
 *   4. Almacena en cola de revisión manual
 *
 * Retención del tópico DLQ: 14 días (tiempo suficiente para análisis).
 */
@Injectable()
export class DLQWorkerService implements OnModuleInit {
  private readonly logger = new Logger(DLQWorkerService.name);
  private mensajesFallidos: any[] = [];

  constructor(private readonly kafkaService: KafkaService) {}

  async onModuleInit() {
    await this.kafkaService.suscribir(
      'dlq-worker-group',
      KAFKA_TOPICS.DEAD_LETTER_QUEUE,
      this.procesarMensajeFallido.bind(this),
    );
    this.logger.log('🪣 DLQ Worker listo. Monitoreando dead-letter-queue...');
  }

  private async procesarMensajeFallido(messagePayload: any): Promise<void> {
    const contenido = JSON.parse(messagePayload.message.value.toString());

    const registro = {
      id: `dlq_${Date.now()}`,
      ...contenido,
      timestamp_recibido: new Date().toISOString(),
      estado: 'PENDIENTE_REVISION',
    };

    this.mensajesFallidos.push(registro);

    // En producción: enviar alerta a Slack/PagerDuty con contexto completo
    this.logger.error(
      `🚨 DLQ: Mensaje fallido recibido | Intentos: ${contenido.intentos} | Error: ${contenido.error?.message}`,
    );
  }

  obtenerMensajesFallidos(): any[] {
    return this.mensajesFallidos;
  }

  obtenerEstadisticasDLQ(): any {
    return {
      total_mensajes: this.mensajesFallidos.length,
      pendientes_revision: this.mensajesFallidos.filter(m => m.estado === 'PENDIENTE_REVISION').length,
    };
  }
}
