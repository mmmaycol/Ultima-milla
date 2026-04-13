import { Module } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { Controller, Get } from '@nestjs/common';

@Controller('facturacion')
class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}

  @Get('comprobantes')
  obtenerComprobantes() {
    return this.facturacionService.obtenerComprobantes();
  }
}

@Module({
  controllers: [FacturacionController],
  providers: [FacturacionService],
  exports: [FacturacionService],
})
export class FacturacionModule {}
