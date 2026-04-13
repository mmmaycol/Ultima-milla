import { Controller, Post, Get, Body, Param, Headers, Logger } from '@nestjs/common';
import { PagosService } from './pagos.service';

@Controller('pagos')
export class PagosController {
  private readonly logger = new Logger(PagosController.name);

  constructor(private readonly pagosService: PagosService) {}

  /**
   * POST /pagos/webhook
   * Endpoint para recibir webhooks de Stripe/Culqi.
   * En producción: validar firma HMAC con el header stripe-signature.
   */
  @Post('webhook')
  async webhook(@Body() payload: any, @Headers('stripe-signature') sig: string) {
    this.logger.log(`📨 Webhook recibido: ${payload.event_type}`);
    await this.pagosService.procesarWebhookPago(payload);
    return { received: true };
  }

  /**
   * POST /pagos/simular-exitoso
   * Simula pago exitoso para demo (sin pasarela real).
   * Produce: pago.procesado
   */
  @Post('simular-exitoso')
  async simularExitoso(@Body() body: { pedido_id: string; monto: number; cliente_id: string }) {
    await this.pagosService.simularPagoExitoso(body.pedido_id, body.monto, body.cliente_id);
    return { mensaje: 'Pago exitoso simulado', pedido_id: body.pedido_id };
  }

  /**
   * POST /pagos/simular-fallido
   * Simula pago fallido para demo.
   * Produce: pago.fallido
   */
  @Post('simular-fallido')
  async simularFallido(@Body() body: { pedido_id: string; cliente_id: string }) {
    await this.pagosService.simularPagoFallido(body.pedido_id, body.cliente_id);
    return { mensaje: 'Pago fallido simulado', pedido_id: body.pedido_id };
  }

  /**
   * GET /pagos
   * Lista todos los pagos registrados.
   */
  @Get()
  obtenerTodos() {
    return this.pagosService.obtenerTodosLosPagos();
  }

  /**
   * GET /pagos/pedido/:pedidoId
   * Estado de pago de un pedido específico.
   */
  @Get('pedido/:pedidoId')
  obtenerPago(@Param('pedidoId') pedidoId: string) {
    return this.pagosService.obtenerPago(pedidoId);
  }
}
