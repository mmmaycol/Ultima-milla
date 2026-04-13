import { Module } from '@nestjs/common';
import { DLQWorkerService } from './dlq-worker.service';
import { Controller, Get } from '@nestjs/common';

@Controller('dlq')
class DLQController {
  constructor(private readonly dlqWorkerService: DLQWorkerService) {}

  @Get('mensajes')
  obtenerMensajes() {
    return this.dlqWorkerService.obtenerMensajesFallidos();
  }

  @Get('estadisticas')
  obtenerEstadisticas() {
    return this.dlqWorkerService.obtenerEstadisticasDLQ();
  }
}

@Module({
  controllers: [DLQController],
  providers: [DLQWorkerService],
  exports: [DLQWorkerService],
})
export class DLQModule {}
