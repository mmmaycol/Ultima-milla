import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getSystemInfo() {
    return {
      sistema: 'Sistema de Logística y Entrega de Última Milla',
      version: '1.0.0',
      arquitectura: 'Event-Driven Architecture (EDA)',
      broker_principal: 'Apache Kafka',
      broker_gps: 'Redis Pub/Sub',
      patron_dominante: 'Coreografía (microservicios autónomos)',
      patron_reembolsos: 'Saga Orchestration',
      persistencia: 'Event Sourcing + PostgreSQL (proyecciones)',
      universidad: 'Universidad Nacional de Ingeniería',
      curso: 'SI806V Desarrollo Adaptativo e Integración de Software',
      timestamp: new Date().toISOString(),
    };
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      componentes: {
        kafka: 'UP',
        redis: 'UP',
        websocket: 'UP',
      },
      topicos_kafka: [
        { nombre: 'pedidos', particiones: 24, retencion: '7 días' },
        { nombre: 'pagos', particiones: 12, retencion: '30 días' },
        { nombre: 'repartidores.eventos', particiones: 24, retencion: '7 días' },
        { nombre: 'notificaciones', particiones: 12, retencion: '3 días' },
        { nombre: 'analytics.raw', particiones: 48, retencion: '90 días' },
        { nombre: 'dead-letter-queue', particiones: 6, retencion: '14 días' },
      ],
    };
  }
}
