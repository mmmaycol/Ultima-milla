import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { RedisService } from '../../brokers/redis/redis.service';
import { EVENTS, KAFKA_TOPICS } from '../../config/constants';

/**
 * FacturacionService
 *
 * Consumidor de pago.procesado.
 * Genera comprobante de pago (boleta/factura) de forma asíncrona.
 *
 * Es idempotente: si recibe el mismo pago.procesado dos veces,
 * detecta que ya existe un comprobante para ese transaction_id
 * y no genera un duplicado.
 */
@Injectable()
export class FacturacionService implements OnModuleInit {
  private readonly logger = new Logger(FacturacionService.name);
  private comprobantesStore: Map<string, any> = new Map();

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    await this.kafkaService.suscribir(
      'facturacion-group-pagos',
      KAFKA_TOPICS.PAGOS,
      this.manejarEventoPago.bind(this),
    );
    this.logger.log('🧾 FacturacionService listo. Escuchando pago.procesado...');
  }

  private async manejarEventoPago(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());
    if (mensaje.event_type !== EVENTS.PAGO_PROCESADO) return;

    // Idempotencia: detectar duplicados por transaction_id
    if (await this.redisService.yaFueProcesado(`factura_${mensaje.event_id}`)) {
      this.logger.warn(`⚠️  Comprobante ya generado para evento ${mensaje.event_id}`);
      return;
    }

    await this.generarComprobante(mensaje.payload);
  }

  private async generarComprobante(pago: any): Promise<void> {
    const comprobante = {
      comprobante_id: `B001-${Date.now()}`,
      tipo: 'BOLETA',
      pedido_id: pago.pedido_id,
      transaction_id: pago.transaction_id,
      cliente_id: pago.cliente_id,
      monto: pago.monto,
      moneda: pago.moneda,
      fecha_emision: new Date().toISOString(),
      estado: 'EMITIDO',
    };

    this.comprobantesStore.set(pago.transaction_id, comprobante);

    // En producción: generar PDF y enviar por email al cliente
    this.logger.log(`🧾 Comprobante generado: ${comprobante.comprobante_id} | S/ ${pago.monto}`);
  }

  obtenerComprobantes(): any[] {
    return Array.from(this.comprobantesStore.values());
  }
}
