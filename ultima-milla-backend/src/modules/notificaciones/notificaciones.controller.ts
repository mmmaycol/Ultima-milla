import { Controller, Get } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  obtenerNotificaciones() {
    return this.notificacionesService.obtenerNotificaciones();
  }

  @Get('circuit-breaker')
  estadoCircuitBreaker() {
    return this.notificacionesService.obtenerEstadoCircuitBreaker();
  }
}
