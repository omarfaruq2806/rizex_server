import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 5000;
  const apiPrefix = configService.get<string>('apiPrefix') || '/api/v1';
  const clientUrl = configService.get<string>('clientUrl') || 'http://localhost:3000';

  // Security Headers with Helmet
  app.use(helmet());

  // CORS Setup
  app.enableCors({
    origin: [clientUrl, 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global API Prefix
  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));

  // Global DTO Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Error & Response Handlers
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.log(`🚀 RizeX Server running on: http://localhost:${port}/${apiPrefix.replace(/^\//, '')}`);
}

bootstrap();
