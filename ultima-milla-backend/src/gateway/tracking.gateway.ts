import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * TrackingGateway
 *
 * WebSocket Gateway para streaming de posición GPS en tiempo real.
 *
 * Flujo completo:
 *   App Repartidor → POST /tracking/gps
 *   → TrackingService → Redis Pub/Sub (< 10ms)
 *   → TrackingGateway → WebSocket → App Cliente (Next.js)
 *
 * El cliente ve el repartidor moverse suavemente en el mapa.
 * Latencia total objetivo: < 100ms end-to-end.
 *
 * Rooms de Socket.IO: cada pedido tiene su sala propia.
 * Cuando el repartidor actualiza GPS, solo los clientes de ESE pedido lo reciben.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  // Mapa: repartidorId → Set de socketIds suscritos
  private suscripcionesGPS: Map<string, Set<string>> = new Map();

  afterInit() {
    this.logger.log('🔌 WebSocket Gateway iniciado → /tracking');
  }

  handleConnection(client: Socket) {
    this.logger.log(`📡 Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`📴 Cliente desconectado: ${client.id}`);

    // Limpiar suscripciones del cliente desconectado
    for (const [repId, sockets] of this.suscripcionesGPS) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.suscripcionesGPS.delete(repId);
      }
    }
  }

  /**
   * El cliente App (Next.js) se une a la sala de un pedido.
   * Recibirá las actualizaciones GPS del repartidor asignado.
   *
   * Evento: 'suscribir_pedido' { pedido_id, repartidor_id }
   */
  @SubscribeMessage('suscribir_pedido')
  async handleSuscribirPedido(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pedido_id: string; repartidor_id: string },
  ) {
    const { pedido_id, repartidor_id } = data;

    // Unirse a la sala del pedido
    await client.join(`pedido:${pedido_id}`);

    // Registrar suscripción GPS
    if (!this.suscripcionesGPS.has(repartidor_id)) {
      this.suscripcionesGPS.set(repartidor_id, new Set());
    }
    this.suscripcionesGPS.get(repartidor_id).add(client.id);

    this.logger.log(`👁️  Cliente ${client.id} suscrito al pedido ${pedido_id} (repartidor ${repartidor_id})`);

    return { ok: true, mensaje: `Suscrito al tracking del pedido ${pedido_id}` };
  }

  /**
   * El cliente se desuscribe del tracking de un pedido.
   */
  @SubscribeMessage('desuscribir_pedido')
  async handleDesuscribirPedido(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pedido_id: string; repartidor_id: string },
  ) {
    await client.leave(`pedido:${data.pedido_id}`);

    const suscripciones = this.suscripcionesGPS.get(data.repartidor_id);
    if (suscripciones) {
      suscripciones.delete(client.id);
    }

    return { ok: true };
  }

  /**
   * Emite actualización de posición GPS a todos los clientes del pedido.
   * Llamado por TrackingService cuando llega nueva telemetría de Redis Pub/Sub.
   *
   * Solo los clientes en la sala correcta reciben el evento (eficiencia).
   */
  emitirPosicionGPS(pedidoId: string, posicion: any): void {
    this.server.to(`pedido:${pedidoId}`).emit('posicion_actualizada', {
      ...posicion,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Emite cambio de estado del pedido a todos los clientes suscritos.
   * Ej: "Tu repartidor llegó al restaurante", "Tu pedido está en camino"
   */
  emitirCambioEstado(pedidoId: string, estado: string, datos?: any): void {
    this.server.to(`pedido:${pedidoId}`).emit('estado_pedido', {
      pedido_id: pedidoId,
      estado,
      datos,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`📢 Estado emitido → pedido ${pedidoId}: ${estado}`);
  }

  /**
   * Número de clientes conectados actualmente.
   */
  get clientesConectados(): number {
    return this.server?.sockets?.sockets?.size || 0;
  }
}
