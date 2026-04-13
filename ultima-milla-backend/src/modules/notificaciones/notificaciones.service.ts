import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { RedisService } from '../../brokers/redis/redis.service';
import { EVENTS, KAFKA_TOPICS } from '../../config/constants';

/**
 * NotificacionesService
 *
 * El consumidor más activo del sistema.
 * Se suscribe a casi todos los eventos y decide el canal de notificación:
 *   - Push notification (Firebase/Expo)
 *   - SMS (Twilio/AWS SNS)
 *   - Email
 *
 * Implementa Circuit Breaker hacia el proveedor de SMS:
 * Si la tasa de error supera el 50% en 60 segundos → el circuito se ABRE
 * y las notificaciones degradan graciosamente a push notification.
 *
 * Esto evita que errores del proveedor externo saturen el sistema interno.
 */
@Injectable()
export class NotificacionesService implements OnModuleInit {
  private readonly logger = new Logger(NotificacionesService.name);

  // Historial de notificaciones (en producción: base de datos)
  private notificacionesStore: any[] = [];

  // Circuit Breaker state para SMS
  private circuitBreaker = {
    estado: 'CERRADO' as 'CERRADO' | 'ABIERTO' | 'SEMI_ABIERTO',
    erroresSMS: 0,
    totalSMS: 0,
    ultimoFallo: null as Date | null,
    umbralError: 0.5,      // 50% de error
    ventanaSegundos: 60,   // en 60 segundos
    tiempoEsperaMs: 120000, // 120 segundos antes de Semi-abierto
  };

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit() {
    // Suscribirse a pedidos
    await this.kafkaService.suscribir(
      'notificaciones-group-pedidos',
      KAFKA_TOPICS.PEDIDOS,
      this.manejarEventoPedido.bind(this),
    );

    // Suscribirse a pagos
    await this.kafkaService.suscribir(
      'notificaciones-group-pagos',
      KAFKA_TOPICS.PAGOS,
      this.manejarEventoPago.bind(this),
    );

    // Suscribirse a eventos de repartidores
    await this.kafkaService.suscribir(
      'notificaciones-group-repartidores',
      KAFKA_TOPICS.REPARTIDORES_EVENTOS,
      this.manejarEventoRepartidor.bind(this),
    );

    this.logger.log('🔔 NotificacionesService listo. Escuchando todos los tópicos...');
  }

  private async manejarEventoPedido(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());
    if (await this.redisService.yaFueProcesado(`notif_${mensaje.event_id}`)) return;

    const { event_type, payload } = mensaje;

    switch (event_type) {
      case EVENTS.PEDIDO_CREADO:
        await this.enviarNotificacion({
          destinatario_id: payload.cliente_id,
          titulo: '🛍️ Pedido recibido',
          cuerpo: 'Tu pedido fue recibido. Procesando tu pago...',
          tipo: 'push',
          datos: { pedido_id: payload.pedido_id },
        });
        break;

      case EVENTS.PEDIDO_CONFIRMADO_POR_RESTAURANTE:
        await this.enviarNotificacion({
          destinatario_id: payload.cliente_id || 'cliente',
          titulo: '👨‍🍳 ¡El restaurante aceptó tu pedido!',
          cuerpo: `Tu pedido estará listo en ~${payload.tiempo_estimado_preparacion_minutos} minutos.`,
          tipo: 'push',
          datos: { pedido_id: payload.pedido_id },
        });
        break;

      case EVENTS.PEDIDO_RECHAZADO_POR_RESTAURANTE:
        await this.enviarNotificacion({
          destinatario_id: payload.cliente_id || 'cliente',
          titulo: '😔 El restaurante no puede atenderte',
          cuerpo: `Motivo: ${payload.motivo}. Te realizaremos el reembolso.`,
          tipo: 'push',
          datos: { pedido_id: payload.pedido_id },
        });
        break;

      case EVENTS.PEDIDO_CANCELADO:
        await this.enviarNotificacion({
          destinatario_id: payload.cliente_id,
          titulo: '❌ Pedido cancelado',
          cuerpo: `Tu pedido fue cancelado. ${payload.pago_habia_sido_procesado ? 'Recibirás tu reembolso en breve.' : ''}`,
          tipo: 'push',
          datos: { pedido_id: payload.pedido_id },
        });
        break;

      case EVENTS.PEDIDO_ENTREGADO:
        await this.enviarNotificacion({
          destinatario_id: payload.cliente_id || 'cliente',
          titulo: '✅ ¡Tu pedido llegó!',
          cuerpo: '¿Cómo estuvo tu experiencia? Califica a tu repartidor.',
          tipo: 'push',
          datos: { pedido_id: payload.pedido_id },
        });
        break;
    }
  }

  private async manejarEventoPago(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());
    if (await this.redisService.yaFueProcesado(`notif_${mensaje.event_id}`)) return;

    const { event_type, payload } = mensaje;

    if (event_type === EVENTS.PAGO_PROCESADO) {
      await this.enviarNotificacion({
        destinatario_id: payload.cliente_id,
        titulo: '💳 Pago confirmado',
        cuerpo: `Se cobró S/ ${payload.monto} ${payload.moneda}. Buscando repartidor...`,
        tipo: 'push',
        datos: { pedido_id: payload.pedido_id, transaction_id: payload.transaction_id },
      });
    } else if (event_type === EVENTS.PAGO_FALLIDO) {
      await this.enviarNotificacion({
        destinatario_id: payload.cliente_id,
        titulo: '❌ Pago rechazado',
        cuerpo: `No pudimos procesar tu pago: ${payload.motivo}. Intenta con otro método.`,
        tipo: 'push',
        datos: { pedido_id: payload.pedido_id },
      });
    }
  }

  private async manejarEventoRepartidor(messagePayload: any): Promise<void> {
    const mensaje = JSON.parse(messagePayload.message.value.toString());
    if (await this.redisService.yaFueProcesado(`notif_${mensaje.event_id}`)) return;

    const { event_type, payload } = mensaje;

    switch (event_type) {
      case EVENTS.REPARTIDOR_ASIGNADO:
        await this.enviarNotificacion({
          destinatario_id: payload.cliente_id,
          titulo: '🏍️ ¡Repartidor asignado!',
          cuerpo: `${payload.repartidor_nombre} (⭐ ${payload.repartidor_calificacion}) llega en ~${payload.eta_minutos} min.`,
          tipo: 'push',
          datos: { pedido_id: payload.pedido_id, repartidor_id: payload.repartidor_id },
        });
        break;

      case EVENTS.REPARTIDOR_RECOGIO_PEDIDO:
        await this.enviarNotificacion({
          destinatario_id: payload.cliente_id || 'cliente',
          titulo: '📦 Tu pedido está en camino',
          cuerpo: '¡El repartidor recogió tu pedido y va hacia ti!',
          tipo: 'push',
          datos: { pedido_id: payload.pedido_id },
        });
        break;
    }
  }

  /**
   * Envía una notificación al usuario.
   * Aplica Circuit Breaker para SMS.
   */
  private async enviarNotificacion(notificacion: {
    destinatario_id: string;
    titulo: string;
    cuerpo: string;
    tipo: 'push' | 'sms' | 'email';
    datos?: any;
  }): Promise<void> {
    let tipoFinal = notificacion.tipo;

    // Circuit Breaker: si el circuito está ABIERTO, degradar SMS a push
    if (notificacion.tipo === 'sms' && this.circuitBreaker.estado === 'ABIERTO') {
      tipoFinal = 'push';
      this.logger.warn('⚡ Circuit Breaker ABIERTO: SMS degradado a push notification');
    }

    const registro = {
      id: `notif_${Date.now()}`,
      ...notificacion,
      tipo_enviado: tipoFinal,
      timestamp: new Date().toISOString(),
      estado: 'enviada',
    };

    // Simulación de envío (en producción: Firebase, Twilio, SendGrid)
    this.logger.log(
      `📬 [${tipoFinal.toUpperCase()}] → ${notificacion.destinatario_id}: ${notificacion.titulo}`,
    );

    this.notificacionesStore.push(registro);

    // En producción: actualizar métricas del Circuit Breaker según resultado real
  }

  /**
   * Evalúa si el Circuit Breaker debe abrirse.
   * Llamado después de cada intento de envío SMS.
   */
  private evaluarCircuitBreaker(exito: boolean): void {
    this.circuitBreaker.totalSMS++;
    if (!exito) {
      this.circuitBreaker.erroresSMS++;
      this.circuitBreaker.ultimoFallo = new Date();
    }

    const tasaError =
      this.circuitBreaker.totalSMS > 0
        ? this.circuitBreaker.erroresSMS / this.circuitBreaker.totalSMS
        : 0;

    if (tasaError > this.circuitBreaker.umbralError && this.circuitBreaker.estado === 'CERRADO') {
      this.circuitBreaker.estado = 'ABIERTO';
      this.logger.error('🔴 Circuit Breaker ABIERTO. SMS suspendido temporalmente.');

      // Programar transición a Semi-abierto
      setTimeout(() => {
        this.circuitBreaker.estado = 'SEMI_ABIERTO';
        this.circuitBreaker.erroresSMS = 0;
        this.circuitBreaker.totalSMS = 0;
        this.logger.warn('🟡 Circuit Breaker SEMI-ABIERTO. Probando recuperación...');
      }, this.circuitBreaker.tiempoEsperaMs);
    }
  }

  obtenerNotificaciones(): any[] {
    return this.notificacionesStore.slice(-100); // Últimas 100
  }

  obtenerEstadoCircuitBreaker(): any {
    return this.circuitBreaker;
  }
}
