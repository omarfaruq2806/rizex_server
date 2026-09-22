import { Module } from '@nestjs/common';
import { DeliverablesService } from './deliverables.service.js';
import { DeliverablesController } from './deliverables.controller.js';

@Module({
  controllers: [DeliverablesController],
  providers: [DeliverablesService],
  exports: [DeliverablesService],
})
export class DeliverablesModule {}
