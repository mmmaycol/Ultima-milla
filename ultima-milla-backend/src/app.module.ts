import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Brokers
import { KafkaModule } from './brokers/kafka/kafka.module';
import { RedisModule } from './brokers/redis/redis.module';

// Módulos de negocio
import { PedidosModule } from './modules/pedidos/pedidos.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { MatchingModule } from './modules/matching/matching.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { ReembolsosModule } from './modules/reembolsos/reembolsos.module';
import { FacturacionModule } from './modules/facturacion/facturacion.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DLQModule } from './modules/dlq/dlq.module';

// Gateway WebSocket
import { TrackingGateway } from './gateway/tracking.gateway';

/**
 * AppModule
 *
 * Módulo raíz de la arquitectura EDA.
 *
 * Todos los módulos son independientes y se comunican ÚNICAMENTE
 * a través del broker (Kafka/Redis). Ningún módulo importa
 * directamente a otro módulo de negocio (principio de desacoplamiento).
 *
 * La única excepción son los brokers (KafkaModule y RedisModule)
 * que son @Global() y están disponibles en toda la aplicación.
 */
@Module({
  imports: [
    // Infraestructura de mensajería (global)
    KafkaModule,
    RedisModule,

    // Microservicios de negocio
    PedidosModule,
    PagosModule,
    MatchingModule,
    TrackingModule,
    NotificacionesModule,
    ReembolsosModule,
    FacturacionModule,
    AnalyticsModule,
    DLQModule,
  ],
  controllers: [AppController],
  providers: [AppService, TrackingGateway],
})
export class AppModule {}
