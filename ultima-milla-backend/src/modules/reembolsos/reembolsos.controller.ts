import { Controller, Get, Param } from '@nestjs/common';
import { ReembolsosService } from './reembolsos.service';

@Controller('reembolsos')
export class ReembolsosController {
  constructor(private readonly reembolsosService: ReembolsosService) {}

  @Get()
  obtenerReembolsos() {
    return this.reembolsosService.obtenerReembolsos();
  }

  @Get(':sagaId')
  obtenerReembolso(@Param('sagaId') sagaId: string) {
    return this.reembolsosService.obtenerReembolso(sagaId);
  }
}
