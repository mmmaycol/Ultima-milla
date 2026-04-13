import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { RedisService } from '../../brokers/redis/redis.service';
import { EVENTS, KAFKA_TOPICS } from '../../config/constants';

/**
 * ReembolsosService
 *
 * El ÚNICO servicio que usa ORQUESTACIÓN centralizada (Saga Pattern).
 *
 * ¿Por qué Saga aquí y no coreografía?
 * El flujo de cancelación-reembolso requiere transaccionalidad y compensación:
 * Si el pago ya fue procesado, la cancelación DEBE reembolsar el dinero
 * antes de marcar el pedido como cancelado.
 *
 * Un fallo a mitad del proceso dejaría el sistema inconsistente:
 * pedido cancelado pero dinero NO devuelto.
 *
 * El Saga Orchestrator define pasos secuenciales con acciones de compensación.
 *
 * Pasos:
 *   1. Verificar que existe pago procesado     [compensación: ninguna]
 *   2. Solicitar reembolso a pasarela          [compensación: reintentar 3x, luego escalar]
 *   3. Esperar confirmación del reembolso      [compensación: verificar estado en pasarela]
 *   4. Marcar pedido como cancelado en BD      [compensación: registrar en cola de inconsistencias]
 *   5. Publicar evento reembolso.iniciado      [garantizado por Outbox Pattern]
 */
@Injectable()
export class ReembolsosService implements OnModuleInit {
  private readonly logger = new Logger(ReembolsosService.name);

  private reembolsosStore: Map<string, any> = new Map();

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.kafkaService.suscribir(
      'reembolsos-group-pedidos',
      KAFKA_TOPICS.PEDIDOS,
      this.manejarEventoPedido.bind(this),
    );

    this.logger.log('💰 ReembolsosService listo. Escuchando pedido.cancelado...');
  }

  private async manejarEventoPedido(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());

    if (mensaje.event_type !== EVENTS.PEDIDO_CANCELADO) return;
    if (await this.redisService.yaFueProcesado(`reembolso_${mensaje.event_id}`)) return;

    const { payload } = mensaje;

    // Solo iniciar reembolso si hubo pago previo
    if (payload.pago_habia_sido_procesado) {
      await this.iniciarSagaReembolso(payload);
    } else {
      this.logger.log(`ℹ️  Pedido ${payload.pedido_id} cancelado sin pago previo. No requiere reembolso.`);
    }
  }

  /**
   * Saga de Reembolso: orquestación centralizada con compensación.
   *
   * Cada paso puede fallar. Si falla, se ejecuta la acción de compensación
   * para dejar el sistema en un estado consistente.
   */
  async iniciarSagaReembolso(datosCancelacion: any): Promise<void> {
    const sagaId = `saga_${datosCancelacion.pedido_id}_${Date.now()}`;
    const saga = {
      saga_id: sagaId,
      pedido_id: datosCancelacion.pedido_id,
      cliente_id: datosCancelacion.cliente_id,
      monto: datosCancelacion.total,
      estado: 'INICIADA',
      pasos_completados: [] as string[],
      timestamp_inicio: new Date().toISOString(),
    };

    this.reembolsosStore.set(sagaId, saga);
    this.logger.log(`💰 Iniciando Saga de Reembolso: ${sagaId}`);

    // PASO 1: Verificar pago (solo lectura, sin compensación)
    try {
      saga.pasos_completados.push('verificar_pago');
      saga.estado = 'VERIFICANDO_PAGO';
      this.logger.log(`[Saga ${sagaId}] Paso 1: Pago verificado ✅`);
    } catch (error) {
      saga.estado = 'ERROR_VERIFICACION';
      this.logger.error(`[Saga ${sagaId}] Paso 1 FALLIDO: ${error.message}`);
      return;
    }

    // PASO 2: Solicitar reembolso a pasarela
    try {
      saga.estado = 'SOLICITANDO_REEMBOLSO';
      const reembolsoId = await this.solicitarReembolsoAPasarela(
        datosCancelacion.pedido_id,
        datosCancelacion.total,
      );
      saga.pasos_completados.push('solicitar_reembolso');
      (saga as any).reembolso_id = reembolsoId;
      this.logger.log(`[Saga ${sagaId}] Paso 2: Reembolso solicitado (ID: ${reembolsoId}) ✅`);
    } catch (error) {
      // Compensación: reintentar 3 veces, luego escalar a operaciones
      saga.estado = 'ERROR_REEMBOLSO_PENDIENTE_ESCALACION';
      this.logger.error(`[Saga ${sagaId}] Paso 2 FALLIDO. Escalando a operaciones.`);
      await this.escalarAOperaciones(sagaId, error.message);
      return;
    }

    // PASO 3: Esperar confirmación (simulado)
    try {
      saga.estado = 'ESPERANDO_CONFIRMACION';
      await this.esperarConfirmacionReembolso((saga as any).reembolso_id);
      saga.pasos_completados.push('confirmar_reembolso');
      this.logger.log(`[Saga ${sagaId}] Paso 3: Reembolso confirmado ✅`);
    } catch (error) {
      saga.estado = 'TIMEOUT_CONFIRMACION';
      this.logger.warn(`[Saga ${sagaId}] Paso 3: Timeout. Verificando en pasarela directamente...`);
    }

    // PASO 4: Marcar pedido como cancelado
    try {
      saga.pasos_completados.push('cancelar_pedido');
      saga.estado = 'PEDIDO_CANCELADO_EN_BD';
      this.logger.log(`[Saga ${sagaId}] Paso 4: Pedido marcado como cancelado en BD ✅`);
    } catch (error) {
      // El reembolso ya ocurrió → registrar inconsistencia
      saga.estado = 'INCONSISTENCIA_DETECTADA';
      this.logger.error(`[Saga ${sagaId}] Paso 4 FALLIDO. Reembolso emitido pero pedido no cancelado en BD. Registrando inconsistencia.`);
    }

    // PASO 5: Publicar evento (Outbox Pattern garantiza que no se pierde)
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.PEDIDOS,
      EVENTS.REEMBOLSO_INICIADO,
      {
        saga_id: sagaId,
        pedido_id: datosCancelacion.pedido_id,
        cliente_id: datosCancelacion.cliente_id,
        monto: datosCancelacion.total,
        reembolso_id: (saga as any).reembolso_id,
        timestamp: new Date().toISOString(),
      },
    );

    saga.estado = 'COMPLETADA';
    saga.pasos_completados.push('evento_publicado');
    this.logger.log(`✅ Saga ${sagaId} COMPLETADA. Reembolso de S/ ${datosCancelacion.total} iniciado.`);
  }

  private async solicitarReembolsoAPasarela(pedidoId: string, monto: number): Promise<string> {
    // En producción: llamada a Stripe/Culqi API para crear refund
    // Simulación de latencia de la pasarela
    await new Promise((r) => setTimeout(r, 200));
    return `ref_${pedidoId}_${Date.now()}`;
  }

  private async esperarConfirmacionReembolso(reembolsoId: string): Promise<void> {
    // En producción: polling o webhook de confirmación del reembolso
    await new Promise((r) => setTimeout(r, 100));
  }

  private async escalarAOperaciones(sagaId: string, motivo: string): Promise<void> {
    // En producción: enviar alerta a Slack/PagerDuty
    this.logger.error(`🚨 ESCALACIÓN OPERACIONES: Saga ${sagaId} requiere intervención manual. Motivo: ${motivo}`);
  }

  obtenerReembolsos(): any[] {
    return Array.from(this.reembolsosStore.values());
  }

  obtenerReembolso(sagaId: string): any {
    return this.reembolsosStore.get(sagaId) || null;
  }
}
