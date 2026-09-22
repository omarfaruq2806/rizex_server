import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { QueryMessagesDto } from './dto/query-messages.dto.js';
import { Prisma, UserRole } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Send a message in an Order chat room
   * (Client, Assigned Worker, or Admin with full supervisory rights)
   */
  async sendMessage(
    orderId: string,
    sender: { id: string; role: UserRole },
    dto: SendMessageDto,
  ) {
    // Step 1: Verify Order exists and load assignment data
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        assignments: { where: { unassignedAt: null } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' does not exist.`);
    }

    // Step 2: Access Control Verification
    if (sender.role === UserRole.CLIENT && order.clientId !== sender.id) {
      throw new ForbiddenException(
        'Access denied. You can only send messages in your own project chat.',
      );
    }

    if (sender.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some((a) => a.memberId === sender.id);
      if (!isAssigned) {
        throw new ForbiddenException(
          'Access denied. You are not assigned to this project.',
        );
      }
    }

    // Note: ADMIN has universal permission to send message in any order room

    // Step 3: Create and return the message with sender information
    return this.prisma.message.create({
      data: {
        orderId,
        senderId: sender.id,
        content: dto.content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * 2. View all messages for a specific Order
   * (Admin has universal oversight over ALL orders; Client & Worker can view their assigned order)
   */
  async getOrderMessages(
    orderId: string,
    currentUser: { id: string; role: UserRole },
    query: QueryMessagesDto,
  ) {
    const limit = query.limit ?? 30;
    const { cursor } = query;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        assignments: { where: { unassignedAt: null } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' does not exist.`);
    }

    // Authorization check
    if (currentUser.role === UserRole.CLIENT && order.clientId !== currentUser.id) {
      throw new ForbiddenException(
        'Access denied. You do not have permission to view messages for this project.',
      );
    }

    if (currentUser.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some(
        (a) => a.memberId === currentUser.id,
      );
      if (!isAssigned) {
        throw new ForbiddenException(
          'Access denied. You are not assigned to this project.',
        );
      }
    }

    const where: Prisma.MessageWhereInput = { orderId };
    const totalCount = await this.prisma.message.count({ where });

    const messages = await this.prisma.message.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
          },
        },
      },
    });

    const hasNextPage = messages.length > limit;
    const paginatedMessages = hasNextPage ? messages.slice(0, limit) : messages;
    const nextCursor = hasNextPage
      ? paginatedMessages[paginatedMessages.length - 1].id
      : null;

    return {
      items: paginatedMessages,
      nextCursor,
      hasNextPage,
      totalCount,
    };
  }

  /**
   * 3. Admin Central Chat Overview (Monitor latest active chats across the agency)
   */
  async getAdminChatOverview() {
    const activeChats = await this.prisma.order.findMany({
      where: {
        messages: { some: {} },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        client: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignments: {
          where: { unassignedAt: null },
          include: {
            member: {
              select: { id: true, name: true, email: true, image: true, role: true },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return activeChats.map((chat) => ({
      orderId: chat.id,
      orderNumber: chat.orderNumber,
      orderTitle: chat.title,
      orderStatus: chat.status,
      client: chat.client,
      assignedMembers: chat.assignments.map((a) => a.member),
      totalMessages: chat._count.messages,
      lastMessage: chat.messages[0] || null,
    }));
  }
}
