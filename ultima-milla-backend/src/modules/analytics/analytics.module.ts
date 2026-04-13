import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Controller, Get } from '@nestjs/common';

@Controller('analytics')
class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('metricas')
  obtenerMetricas() {
    return this.analyticsService.obtenerMetricas();
  }
}

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
