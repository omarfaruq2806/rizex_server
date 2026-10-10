import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { initSentry } from './common/utils/sentry.util.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Initialize Sentry error monitoring (if SENTRY_DSN provided in .env)
  initSentry();

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 5000;
  const apiPrefix = configService.get<string>('apiPrefix') || '/api/v1';
  const clientUrl = configService.get<string>('clientUrl') || 'http://localhost:3000';
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Security Headers with Helmet
  // - Content-Security-Policy (CSP): Restricts unauthorized scripts & objects
  // - Strict-Transport-Security (HSTS): Forces HTTPS connections in production
  // - X-Frame-Options: Prevents Clickjacking attacks (deny iframes)
  // - X-Content-Type-Options: Prevents MIME type sniffing
  // - XSS Filter & hidePoweredBy: Obscures backend technology signature
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      frameguard: {
        action: 'deny',
      },
      hidePoweredBy: true,
      noSniff: true,
    }),
  );

  // 2. Production-Grade CORS Configuration
  // Safely parses allowed origins from environment variable or falls back to known defaults
  const customOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];

  const allowedOrigins = [
    clientUrl,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...customOrigins,
  ].filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // In development, allow tools like Postman / mobile or same-origin (origin undefined)
      if (!origin) return callback(null, true);

      // Check if origin matches allowed list or matches .vercel.app for staging previews
      const isAllowed =
        allowedOrigins.includes(origin) ||
        (!isProduction && origin.includes('localhost')) ||
        origin.endsWith('.vercel.app');

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`Blocked by CORS policy: ${origin}`);
        callback(new Error(`CORS blocked for origin: ${origin}`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Cookie',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  // 3. Global API Prefix
  app.setGlobalPrefix(apiPrefix.replace(/^\//, ''));

  // 4. Global DTO Validation & Sanitization Pipe
  // - whitelist: true -> strips all unrecognized incoming properties
  // - forbidNonWhitelisted: true -> throws bad request error if unknown properties are sent
  // - transform: true -> transforms request payloads into typed DTO instances
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

  // 5. Global Error & Response Handlers
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(port);
  logger.log(`🚀 RizeX Server running on: http://localhost:${port}/${apiPrefix.replace(/^\//, '')}`);
}

bootstrap();
