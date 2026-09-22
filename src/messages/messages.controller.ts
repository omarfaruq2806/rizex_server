import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { QueryMessagesDto } from './dto/query-messages.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller()
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Send a message in an Order chat room
   */
  @Post('orders/:orderId/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('orderId') orderId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.sendMessage(orderId, user, dto);
  }

  /**
   * View messages in an Order chat room (Admin has oversight over ALL orders)
   */
  @Get('orders/:orderId/messages')
  async getOrderMessages(
    @Param('orderId') orderId: string,
    @Query() query: QueryMessagesDto,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getOrderMessages(orderId, user, query);
  }

  /**
   * Admin Central Chat Overview (Supervise all client-worker conversations across platform)
   */
  @Get('admin/chats/overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminChatOverview() {
    return this.messagesService.getAdminChatOverview();
  }
}
