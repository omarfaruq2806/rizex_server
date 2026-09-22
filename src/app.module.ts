import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
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
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
