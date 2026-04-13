import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  /**
   * POST /tracking/gps
   * La App Repartidor envía su posición GPS cada 3 segundos.
   * → Redis Pub/Sub → WebSocket → cliente (latencia < 10ms)
   */
  @Post('gps')
  async actualizarGPS(
    @Body() body: { repartidor_id: string; latitud: number; longitud: number; velocidad: number },
  ) {
    await this.trackingService.actualizarPosicionGPS(
      body.repartidor_id,
      body.latitud,
      body.longitud,
      body.velocidad,
    );
    return { ok: true };
  }

  /**
   * GET /tracking/posicion/:repartidorId
   * Última posición conocida desde Redis Cache (TTL 10 minutos).
   */
  @Get('posicion/:repartidorId')
  async obtenerPosicion(@Param('repartidorId') id: string) {
    return this.trackingService.obtenerUltimaPosicion(id);
  }

  /**
   * POST /tracking/en-camino
   * El repartidor confirma que inicia el viaje al restaurante.
   */
  @Post('en-camino')
  async enCamino(@Body() body: { repartidor_id: string; pedido_id: string }) {
    await this.trackingService.repartidorEnCamino(body.repartidor_id, body.pedido_id);
    return { ok: true };
  }

  /**
   * POST /tracking/recogio-pedido
   * El repartidor confirma que tomó el paquete físicamente.
   */
  @Post('recogio-pedido')
  async recogioP edido(@Body() body: { repartidor_id: string; pedido_id: string }) {
    await this.trackingService.repartidorRecogioPedido(body.repartidor_id, body.pedido_id);
    return { ok: true };
  }

  /**
   * POST /tracking/confirmar-entrega
   * El repartidor confirma la entrega al cliente.
   */
  @Post('confirmar-entrega')
  async confirmarEntrega(
    @Body() body: {
      repartidor_id: string;
      pedido_id: string;
      metodo_confirmacion: 'foto' | 'firma' | 'codigo';
    },
  ) {
    await this.trackingService.confirmarEntrega(
      body.repartidor_id,
      body.pedido_id,
      body.metodo_confirmacion,
    );
    return { ok: true };
  }
}
