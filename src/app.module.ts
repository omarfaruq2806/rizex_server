import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import configuration from './config/configuration.js';
import { RequestLoggerMiddleware } from './common/middleware/logger.middleware.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ServicesModule } from './services/services.module.js';
import { QuoteRequestsModule } from './quote-requests/quote-requests.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { DeliverablesModule } from './deliverables/deliverables.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    // 1. Global Environment & Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),

    // 2. Global In-Memory & Redis Cache Manager (TTL: 5 Minutes default)
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 1000 * 5, // 5 minutes default in ms
      max: 1000, // Maximum items in memory cache
    }),

    // 3. Global Rate Limiting & DDoS Protection (Throttler)
    // Default Rule: Allow max 100 requests per 60 seconds (1 minute) per IP address
    // Individual endpoints can override this using @Throttle({ default: { limit: 5, ttl: 60000 } })
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60,000 milliseconds = 1 minute window
        limit: 100, // max 100 requests per window
      },
    ]),

    // 4. Application Feature Modules & Health Probes
    HealthModule,
    PrismaModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ServicesModule,
    QuoteRequestsModule,
    QuotesModule,
    OrdersModule,
    AssignmentsModule,
    MessagesModule,
    DeliverablesModule,
    ReviewsModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Register Global Throttler Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
