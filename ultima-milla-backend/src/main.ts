import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Bootstrap
 *
 * Punto de entrada del backend EDA de Última Milla.
 *
 * Configuración:
 * - CORS habilitado para el frontend Next.js
 * - Validation Pipe global (class-validator)
 * - WebSocket Server integrado (Socket.IO) para tracking GPS
 * - Puerto configurable via variable de entorno PORT
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // CORS para el frontend Next.js
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Validación automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Prefijo global de la API
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log('================================================');
  logger.log('  🚀 Sistema Logística Última Milla - Backend');
  logger.log('================================================');
  logger.log(`  📡 HTTP API:    http://localhost:${port}/api`);
  logger.log(`  🔌 WebSocket:   ws://localhost:${port}/tracking`);
  logger.log(`  ❤️  Health:      http://localhost:${port}/api/health`);
  logger.log('================================================');
  logger.log('  Arquitectura: Event-Driven (EDA)');
  logger.log('  Broker:       Apache Kafka + Redis Pub/Sub');
  logger.log('  Patrón:       Coreografía + Saga (reembolsos)');
  logger.log('================================================');
}

bootstrap();
