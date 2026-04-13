import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { KafkaService } from '../../brokers/kafka/kafka.service';
import { RedisService } from '../../brokers/redis/redis.service';
import { EVENTS, KAFKA_TOPICS, EstadoPedido } from '../../config/constants';
import {
  CrearPedidoDto,
  CancelarPedidoDto,
  ConfirmarPedidoRestauranteDto,
  RechazarPedidoRestauranteDto,
} from './dto/pedidos.dto';

/**
 * PedidosService
 *
 * Gestiona el ciclo de vida completo de un pedido.
 * Actúa como PRODUCTOR de eventos hacia Kafka.
 *
 * Event Sourcing: el estado se reconstruye a partir de la secuencia de eventos.
 * En memoria simulamos el store de pedidos (en producción sería PostgreSQL + Event Store).
 */
@Injectable()
export class PedidosService {
  private readonly logger = new Logger(PedidosService.name);

  // En producción: PostgreSQL (proyecciones) + Kafka Event Store (fuente de verdad)
  // Para demostración: store en memoria
  private pedidosStore: Map<string, any> = new Map();

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * FASE 1: El cliente confirma su orden
   * Produce: pedido.creado → tópico pedidos
   *
   * Dispara en paralelo (fan-out):
   *   - Servicio de Notificaciones (push al cliente)
   *   - Servicio de Matching (inicia espera de correlación)
   *   - Servicio de Analytics (registra métrica)
   */
  async crearPedido(dto: CrearPedidoDto): Promise<{ pedido_id: string }> {
    const pedidoId = uuidv4();
    const traceId = uuidv4();

    const pedido = {
      pedido_id: pedidoId,
      trace_id: traceId,
      cliente_id: dto.cliente_id,
      restaurante_id: dto.restaurante_id,
      direccion_entrega: dto.direccion_entrega,
      items: dto.items,
      metodo_pago: dto.metodo_pago,
      notas: dto.notas,
      total: dto.items.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0),
      estado: EstadoPedido.PENDIENTE,
      created_at: new Date().toISOString(),
    };

    // Guardar en store local (proyección materializada)
    this.pedidosStore.set(pedidoId, pedido);

    // Publicar evento → fan-out a todos los consumidores suscritos
    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.PEDIDOS,
      EVENTS.PEDIDO_CREADO,
      pedido,
      traceId,
    );

    this.logger.log(`✅ Pedido creado: ${pedidoId} | Total: S/ ${pedido.total}`);
    return { pedido_id: pedidoId };
  }

  /**
   * El restaurante acepta preparar el pedido.
   * Produce: pedido.confirmado_por_restaurante
   *
   * El Servicio de Matching usa este evento + pago.procesado para correlación AND.
   * Solo cuando AMBOS llegan se asigna el repartidor.
   */
  async confirmarPorRestaurante(dto: ConfirmarPedidoRestauranteDto): Promise<void> {
    const pedido = this.pedidosStore.get(dto.pedido_id);
    if (!pedido) throw new NotFoundException(`Pedido ${dto.pedido_id} no encontrado`);

    pedido.estado = EstadoPedido.EN_PREPARACION;
    pedido.tiempo_estimado_preparacion_minutos = dto.tiempo_estimado_preparacion_minutos;

    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.PEDIDOS,
      EVENTS.PEDIDO_CONFIRMADO_POR_RESTAURANTE,
      {
        pedido_id: dto.pedido_id,
        restaurante_id: dto.restaurante_id,
        tiempo_estimado_preparacion_minutos: dto.tiempo_estimado_preparacion_minutos,
        timestamp: new Date().toISOString(),
      },
    );

    this.logger.log(`🍽️  Pedido ${dto.pedido_id} confirmado por restaurante`);
  }

  /**
   * El restaurante rechaza el pedido.
   * Dispara flujo de reasignación o cancelación con reembolso.
   */
  async rechazarPorRestaurante(dto: RechazarPedidoRestauranteDto): Promise<void> {
    const pedido = this.pedidosStore.get(dto.pedido_id);
    if (!pedido) throw new NotFoundException(`Pedido ${dto.pedido_id} no encontrado`);

    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.PEDIDOS,
      EVENTS.PEDIDO_RECHAZADO_POR_RESTAURANTE,
      {
        pedido_id: dto.pedido_id,
        restaurante_id: dto.restaurante_id,
        motivo: dto.motivo,
        timestamp: new Date().toISOString(),
      },
    );

    this.logger.warn(`❌ Pedido ${dto.pedido_id} rechazado por restaurante: ${dto.motivo}`);
  }

  /**
   * Cancelación por cualquier actor.
   * Si el pago ya fue procesado → dispara flujo de reembolso (Saga).
   */
  async cancelarPedido(dto: CancelarPedidoDto): Promise<void> {
    const pedido = this.pedidosStore.get(dto.pedido_id);
    if (!pedido) throw new NotFoundException(`Pedido ${dto.pedido_id} no encontrado`);

    pedido.estado = EstadoPedido.CANCELADO;

    await this.kafkaService.publicarEvento(
      KAFKA_TOPICS.PEDIDOS,
      EVENTS.PEDIDO_CANCELADO,
      {
        pedido_id: dto.pedido_id,
        cancelado_por: dto.cancelado_por,
        motivo: dto.motivo,
        pago_habia_sido_procesado: pedido.estado !== EstadoPedido.PENDIENTE,
        cliente_id: pedido.cliente_id,
        total: pedido.total,
        timestamp: new Date().toISOString(),
      },
    );

    this.logger.log(`🚫 Pedido ${dto.pedido_id} cancelado por ${dto.cancelado_por}`);
  }

  /**
   * Consulta el estado actual de un pedido.
   * En producción: PostgreSQL con proyección materializada actualizada por consumer group.
   */
  obtenerPedido(pedidoId: string): any {
    const pedido = this.pedidosStore.get(pedidoId);
    if (!pedido) throw new NotFoundException(`Pedido ${pedidoId} no encontrado`);
    return pedido;
  }

  obtenerTodosLosPedidos(): any[] {
    return Array.from(this.pedidosStore.values());
  }

  /**
   * Actualiza el estado interno del pedido (llamado por consumidores de otros módulos).
   * Simula la proyección materializada que en producción estaría en PostgreSQL.
   */
  actualizarEstado(pedidoId: string, nuevoEstado: EstadoPedido, datos?: any): void {
    const pedido = this.pedidosStore.get(pedidoId);
    if (pedido) {
      pedido.estado = nuevoEstado;
      if (datos) Object.assign(pedido, datos);
      this.logger.log(`📋 Pedido ${pedidoId} → Estado: ${nuevoEstado}`);
    }
  }
}
