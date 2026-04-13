import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /
   * Health check básico del sistema.
   */
  @Get()
  getInfo() {
    return this.appService.getSystemInfo();
  }

  /**
   * GET /health
   * Estado de salud de todos los componentes.
   * Usado por Kubernetes para liveness/readiness probes.
   */
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
