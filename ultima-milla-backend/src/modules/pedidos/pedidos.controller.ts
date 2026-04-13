import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import {
  CrearPedidoDto,
  CancelarPedidoDto,
  ConfirmarPedidoRestauranteDto,
  RechazarPedidoRestauranteDto,
} from './dto/pedidos.dto';

/**
 * PedidosController
 *
 * Endpoints REST para el ciclo de vida del pedido.
 * La App Cliente (Next.js) y la App Restaurante consumen estos endpoints.
 *
 * Cada acción publica un evento en Kafka; el controlador NO llama
 * directamente a otros microservicios (principio de desacoplamiento EDA).
 */
@Controller('pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(private readonly pedidosService: PedidosService) {}

  /**
   * POST /pedidos
   * La App Cliente confirma un nuevo pedido.
   * Produce: pedido.creado
   */
  @Post()
  async crearPedido(@Body() dto: CrearPedidoDto) {
    return this.pedidosService.crearPedido(dto);
  }

  /**
   * GET /pedidos
   * Lista todos los pedidos (para dashboard).
   */
  @Get()
  obtenerTodos() {
    return this.pedidosService.obtenerTodosLosPedidos();
  }

  /**
   * GET /pedidos/:id
   * Estado actual de un pedido (proyección materializada).
   */
  @Get(':id')
  obtenerPedido(@Param('id') id: string) {
    return this.pedidosService.obtenerPedido(id);
  }

  /**
   * POST /pedidos/:id/cancelar
   * Cancelación por cliente o sistema.
   * Produce: pedido.cancelado
   */
  @Post(':id/cancelar')
  cancelar(@Param('id') id: string, @Body() dto: CancelarPedidoDto) {
    return this.pedidosService.cancelarPedido({ ...dto, pedido_id: id });
  }

  /**
   * POST /pedidos/:id/confirmar-restaurante
   * La App Restaurante acepta preparar el pedido.
   * Produce: pedido.confirmado_por_restaurante
   */
  @Post(':id/confirmar-restaurante')
  confirmarRestaurante(
    @Param('id') id: string,
    @Body() dto: ConfirmarPedidoRestauranteDto,
  ) {
    return this.pedidosService.confirmarPorRestaurante({ ...dto, pedido_id: id });
  }

  /**
   * POST /pedidos/:id/rechazar-restaurante
   * La App Restaurante rechaza el pedido.
   * Produce: pedido.rechazado_por_restaurante
   */
  @Post(':id/rechazar-restaurante')
  rechazarRestaurante(
    @Param('id') id: string,
    @Body() dto: RechazarPedidoRestauranteDto,
  ) {
    return this.pedidosService.rechazarPorRestaurante({ ...dto, pedido_id: id });
  }
}
