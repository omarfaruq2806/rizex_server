import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import webpush from 'web-push';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto.js';

export interface SendNotificationPayload {
  userId: string;
  title: string;
  message?: string;
  linkUrl?: string;
  orderId?: string;
  type?: NotificationType;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly notificationStream$ = new Subject<{
    userId: string;
    notification: any;
  }>();

  private vapidPublicKey: string = '';
  private vapidPrivateKey: string = '';
  private vapidSubject: string = 'mailto:support@rizex.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    // 1. Setup VAPID keys for Web Push
    const envPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const envPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const envSubject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:support@rizex.com';

    if (envPublicKey && envPrivateKey) {
      this.vapidPublicKey = envPublicKey;
      this.vapidPrivateKey = envPrivateKey;
      this.vapidSubject = envSubject;
    } else {
      // Auto-generate VAPID keys for development if not provided
      const generated = webpush.generateVAPIDKeys();
      this.vapidPublicKey = generated.publicKey;
      this.vapidPrivateKey = generated.privateKey;
      this.vapidSubject = envSubject;
      this.logger.warn('⚠️ No VAPID keys provided in environment variables. Auto-generated temporary dev keys.');
    }

    try {
      webpush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey,
      );
      this.logger.log('✅ Web Push Notification Service initialized successfully');
    } catch (err: any) {
      this.logger.error(`❌ Failed to initialize Web Push: ${err.message}`);
    }
  }

  /**
   * Return VAPID Public Key for client subscription
   */
  getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.vapidPublicKey };
  }

  /**
   * Main Dispatcher: Store in DB -> Stream over SSE -> Send Web Push
   */
  async sendNotification(payload: SendNotificationPayload) {
    try {
      // 1. Save in Database
      const notification = await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          title: payload.title,
          message: payload.message || null,
          linkUrl: payload.linkUrl || null,
          orderId: payload.orderId || null,
          type: payload.type || NotificationType.SYSTEM,
        },
      });

      // 2. Dispatch Live SSE stream
      this.notificationStream$.next({
        userId: payload.userId,
        notification,
      });

      // 3. Dispatch Web Push asynchronously
      this.dispatchWebPush(payload.userId, notification).catch((err) => {
        this.logger.warn(`Web Push error for user ${payload.userId}: ${err.message}`);
      });

      return notification;
    } catch (error: any) {
      this.logger.error(`Failed to send notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * SSE Stream Observable for specific user
   */
  getUserStream(userId: string): Observable<MessageEvent> {
    return this.notificationStream$.pipe(
      filter((event) => event.userId === userId),
      map((event) => {
        return {
          data: event.notification,
        } as MessageEvent;
      }),
    );
  }

  /**
   * Get user's notifications with pagination and unread filter
   */
  async getUserNotifications(userId: string, query: QueryNotificationsDto) {
    const { unreadOnly, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        isRead: true,
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      success: true,
      updatedCount: result.count,
    };
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId,
      },
    });
  }

  /**
   * Save / Upsert Browser Web Push Subscription
   */
  async savePushSubscription(userId: string, dto: SavePushSubscriptionDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        userAgent: dto.userAgent || null,
      },
      update: {
        userId,
        p256dh: dto.p256dh,
        auth: dto.auth,
        userAgent: dto.userAgent || null,
      },
    });
  }

  /**
   * Delete Push Subscription
   */
  async deletePushSubscription(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });
  }

  /**
   * Private Helper: Send Web Push notifications to all user subscriptions
   */
  private async dispatchWebPush(userId: string, notification: any) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message || 'You have a new update in RizeX',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: {
        id: notification.id,
        linkUrl: notification.linkUrl || (notification.orderId ? `/orders/${notification.orderId}` : '/'),
        orderId: notification.orderId,
      },
    });

    const pushPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, payload);
      } catch (err: any) {
        // If status is 404 or 410, subscription is no longer valid, delete it
        if (err.statusCode === 404 || err.statusCode === 410) {
          this.logger.debug(`Subscription expired or gone, removing endpoint: ${sub.endpoint}`);
          await this.prisma.pushSubscription.delete({
            where: { id: sub.id },
          }).catch(() => {});
        } else {
          this.logger.warn(`Failed to send web push to ${sub.endpoint}: ${err.message}`);
        }
      }
    });

    await Promise.allSettled(pushPromises);
  }
}
