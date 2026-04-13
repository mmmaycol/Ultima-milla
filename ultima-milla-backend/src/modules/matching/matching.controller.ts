import { Controller, Get, Param } from '@nestjs/common';
import { MatchingService } from './matching.service';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('repartidores/disponibles')
  obtenerRepartidoresDisponibles() {
    return this.matchingService.obtenerRepartidoresDisponibles();
  }

  @Get('asignaciones')
  obtenerTodasLasAsignaciones() {
    return this.matchingService.obtenerTodasLasAsignaciones();
  }

  @Get('asignacion/:pedidoId')
  obtenerAsignacion(@Param('pedidoId') pedidoId: string) {
    const asignacion = this.matchingService.obtenerAsignacion(pedidoId);
    return asignacion || { error: 'Asignación no encontrada' };
  }
}
