import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import {
  SavePushSubscriptionDto,
  DeletePushSubscriptionDto,
} from './dto/save-push-subscription.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get user's notifications list
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: any,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getUserNotifications(user.id, query);
  }

  /**
   * Get unread notifications badge count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  /**
   * Get VAPID public key for browser push subscription
   */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return this.notificationsService.getVapidPublicKey();
  }

  /**
   * Real-Time SSE Stream for current logged-in user
   */
  @Sse('sse')
  streamUserNotifications(@CurrentUser() user: any): Observable<MessageEvent> {
    return this.notificationsService.getUserStream(user.id);
  }

  /**
   * Mark single notification as read
   */
  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  /**
   * Mark all notifications as read
   */
  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  /**
   * Delete a notification
   */
  @Delete(':id')
  async deleteNotification(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.notificationsService.deleteNotification(id, user.id);
  }

  /**
   * Save / Upsert Web Push Subscription
   */
  @Post('push-subscription')
  async savePushSubscription(
    @CurrentUser() user: any,
    @Body() dto: SavePushSubscriptionDto,
  ) {
    return this.notificationsService.savePushSubscription(user.id, dto);
  }

  /**
   * Delete Web Push Subscription
   */
  @Delete('push-subscription')
  async deletePushSubscription(
    @CurrentUser() user: any,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.notificationsService.deletePushSubscription(user.id, dto.endpoint);
  }
}
