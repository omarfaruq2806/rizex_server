import { Module } from '@nestjs/common';
import { QuoteRequestsService } from './quote-requests.service.js';
import { QuoteRequestsController } from './quote-requests.controller.js';

@Module({
  controllers: [QuoteRequestsController],
  providers: [QuoteRequestsService],
  exports: [QuoteRequestsService],
})
export class QuoteRequestsModule {}
