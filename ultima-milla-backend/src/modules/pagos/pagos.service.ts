import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { EVENTS, KAFKA_TOPICS } from '../../config/constants';

/**
 * PagosService
 *
 * Adaptador entre la pasarela de pago externa (Stripe/Culqi) y el sistema EDA.
 *
 * Actúa como PRODUCTOR de eventos de pago.
 * Recibe webhooks de la pasarela, valida la firma, y publica el evento correspondiente.
 *
 * Es el ÚNICO punto de contacto con sistemas de pago externos.
 * Ningún otro servicio se comunica directamente con Stripe/Culqi.
 */
@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  // Store en memoria (en producción: PostgreSQL)
  private pagosStore: Map<string, any> = new Map();

  constructor(private readonly kafkaService: KafkaService) {}

  /**
   * Procesa el webhook de la pasarela de pago.
   * En producción: validar firma HMAC del webhook antes de procesar.
   *
   * Produce: pago.procesado | pago.fallido
   */
  async procesarWebhookPago(webhookPayload: any): Promise<void> {
    const { event_type, data } = webhookPayload;

    if (event_type === 'charge.succeeded' || event_type === 'payment_intent.succeeded') {
      await this.registrarPagoExitoso({
        pedido_id: data.metadata?.pedido_id,
        transaction_id: data.id,
        monto: data.amount / 100, // Stripe/Culqi manejan centavos
        moneda: data.currency?.toUpperCase() || 'PEN',
        cliente_id: data.metadata?.cliente_id,
        metodo_pago: data.payment_method_types?.[0] || 'tarjeta',
      });
    } else if (
      event_type === 'charge.failed' ||
      event_type === 'payment_intent.payment_failed'
    ) {
      await this.registrarPagoFallido({
        pedido_id: data.metadata?.pedido_id,
        transaction_id: data.id,
        codigo_error: data.last_payment_error?.code || 'unknown',
        motivo: data.last_payment_error?.message || 'Pago rechazado',
        cliente_id: data.metadata?.cliente_id,
      });
    }
  }

  /**
   * Simula un pago exitoso (para demo/testing sin pasarela real).
   * Produce: pago.procesado → activa Facturación + segunda mitad de correlación Matching
   */
  async simularPagoExitoso(pedidoId: string, monto: number, clienteId: string): Promise<void> {
    await this.registrarPagoExitoso({
      pedido_id: pedidoId,
      transaction_id: `sim_${Date.now()}`,
      monto,
      moneda: 'PEN',
      cliente_id: clienteId,
      metodo_pago: 'tarjeta',
    });
  }

  async simularPagoFallido(pedidoId: string, clienteId: string): Promise<void> {
    await this.registrarPagoFallido({
      pedido_id: pedidoId,
      transaction_id: `sim_failed_${Date.now()}`,
      codigo_error: 'insufficient_funds',
      motivo: 'Fondos insuficientes',
      cliente_id: clienteId,
    });
  }

  private async registrarPagoExitoso(datos: {
    pedido_id: string;
    transaction_id: string;
    monto: number;
    moneda: string;
    cliente_id: string;
    metodo_pago: string;
  }): Promise<void> {
    const pago = {
      ...datos,
      estado: 'procesado',
      timestamp: new Date().toISOString(),
    };

    this.pagosStore.set(datos.pedido_id, pago);

    // Produce pago.procesado → fan-out:
    // → Servicio de Facturación (genera comprobante)
    // → Servicio de Matching (segunda mitad correlación AND)
    // → Servicio de Notificaciones (push al cliente)
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.PAGOS,
      EVENTS.PAGO_PROCESADO,
      pago,
    );

    this.logger.log(`💳 Pago procesado: ${datos.transaction_id} | S/ ${datos.monto}`);
  }

  private async registrarPagoFallido(datos: {
    pedido_id: string;
    transaction_id: string;
    codigo_error: string;
    motivo: string;
    cliente_id: string;
  }): Promise<void> {
    const pago = {
      ...datos,
      estado: 'fallido',
      timestamp: new Date().toISOString(),
    };

    this.pagosStore.set(datos.pedido_id, pago);

    // Produce pago.fallido → activa Fraude/CEP + Notificaciones
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.PAGOS,
      EVENTS.PAGO_FALLIDO,
      pago,
    );

    this.logger.warn(`❌ Pago fallido: ${datos.transaction_id} | ${datos.motivo}`);
  }

  obtenerPago(pedidoId: string): any {
    return this.pagosStore.get(pedidoId) || null;
  }

  obtenerTodosLosPagos(): any[] {
    return Array.from(this.pagosStore.values());
  }
}
