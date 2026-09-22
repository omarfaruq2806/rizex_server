import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { UpdateOrderProgressDto } from './dto/update-order-progress.dto.js';
import { QueryOrdersDto } from './dto/query-orders.dto.js';
import { Prisma, UserRole, OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Client views their own orders with cursor-based infinite scroll
   */
  async findMyOrders(clientId: string, query: QueryOrdersDto) {
    const limit = query.limit ?? 10;
    const { cursor, status, serviceId, search } = query;

    // Build filter criteria
    const where: Prisma.OrderWhereInput = {
      clientId,
    };

    if (status) {
      where.status = status;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { title: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const totalCount = await this.prisma.order.count({ where });

    // Fetch items (limit + 1 for next cursor determination)
    const items = await this.prisma.order.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
            image: true,
          },
        },
        quote: {
          select: {
            id: true,
            amount: true,
            advanceAmount: true,
            currency: true,
            estimatedDays: true,
            revisions: true,
          },
        },
        delivery: {
          select: {
            id: true,
            status: true,
            submittedAt: true,
          },
        },
        _count: {
          select: {
            messages: true,
            files: true,
            revisions: true,
          },
        },
      },
    });

    const hasNextPage = items.length > limit;
    const paginatedItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? paginatedItems[paginatedItems.length - 1].id : null;

    return {
      items: paginatedItems,
      nextCursor,
      hasNextPage,
      totalCount,
    };
  }

  /**
   * 2. Admin views all client orders across the platform
   */
  async findAll(query: QueryOrdersDto) {
    const limit = query.limit ?? 10;
    const { cursor, status, serviceId, search } = query;

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { client: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const totalCount = await this.prisma.order.count({ where });

    const items = await this.prisma.order.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        quote: {
          select: {
            id: true,
            amount: true,
            advanceAmount: true,
            currency: true,
          },
        },
        assignments: {
          where: { unassignedAt: null },
          include: {
            member: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        delivery: {
          select: { id: true, status: true },
        },
      },
    });

    const hasNextPage = items.length > limit;
    const paginatedItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? paginatedItems[paginatedItems.length - 1].id : null;

    return {
      items: paginatedItems,
      nextCursor,
      hasNextPage,
      totalCount,
    };
  }

  /**
   * 3. Team Member views orders assigned to them
   */
  async findAssignedOrders(memberId: string, query: QueryOrdersDto) {
    const limit = query.limit ?? 10;
    const { cursor, status, search } = query;

    const where: Prisma.OrderWhereInput = {
      assignments: {
        some: {
          memberId,
          unassignedAt: null,
        },
      },
    };

    if (status) {
      where.status = status;
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { orderNumber: { contains: searchTerm, mode: 'insensitive' } },
        { title: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const totalCount = await this.prisma.order.count({ where });

    const items = await this.prisma.order.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        service: {
          select: { id: true, name: true, slug: true },
        },
        delivery: true,
        _count: {
          select: { messages: true, files: true, revisions: true },
        },
      },
    });

    const hasNextPage = items.length > limit;
    const paginatedItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage ? paginatedItems[paginatedItems.length - 1].id : null;

    return {
      items: paginatedItems,
      nextCursor,
      hasNextPage,
      totalCount,
    };
  }

  /**
   * 4. View detailed Order information with role authorization check
   */
  async findOne(
    idOrOrderNumber: string,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: idOrOrderNumber },
          { orderNumber: idOrOrderNumber },
        ],
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        service: {
          include: {
            category: true,
          },
        },
        quote: {
          include: {
            request: {
              include: {
                requirementValues: {
                  include: { field: true },
                },
              },
            },
          },
        },
        assignments: {
          where: { unassignedAt: null },
          include: {
            member: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        delivery: true,
        revisions: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        review: true,
        _count: {
          select: {
            messages: true,
            files: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order '${idOrOrderNumber}' was not found.`);
    }

    // Role-based Access Control:
    // - Admin can access all orders
    // - Client can only access their own order
    // - Team member can only access orders they are actively assigned to
    if (currentUser.role === UserRole.CLIENT && order.clientId !== currentUser.id) {
      throw new ForbiddenException(
        'Access denied. You do not have permission to view this order.',
      );
    }

    if (currentUser.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some(
        (a) => a.member.id === currentUser.id,
      );
      if (!isAssigned) {
        throw new ForbiddenException(
          'Access denied. You are not assigned to this project.',
        );
      }
    }

    return order;
  }

  /**
   * 5. Update Order status (Admin or Assigned Team Member)
   */
  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        assignments: { where: { unassignedAt: null } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' was not found.`);
    }

    // Check permissions
    if (currentUser.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some(
        (a) => a.memberId === currentUser.id,
      );
      if (!isAssigned) {
        throw new ForbiddenException(
          'Access denied. You can only update orders assigned to you.',
        );
      }
    }

    // Prepare update data
    const updateData: Prisma.OrderUpdateInput = {
      status: dto.status,
    };

    // If status moves to COMPLETED, record completion time and 100% progress
    if (dto.status === OrderStatus.COMPLETED) {
      updateData.completedAt = new Date();
      updateData.progress = 100;
    } else if (dto.status === OrderStatus.IN_PROGRESS && !order.startDate) {
      updateData.startDate = new Date();
    }

    return this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true } },
        service: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * 6. Update Order progress percentage (Admin or Assigned Team Member)
   */
  async updateProgress(
    id: string,
    dto: UpdateOrderProgressDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        assignments: { where: { unassignedAt: null } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${id}' was not found.`);
    }

    if (currentUser.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some(
        (a) => a.memberId === currentUser.id,
      );
      if (!isAssigned) {
        throw new ForbiddenException(
          'Access denied. You can only update orders assigned to you.',
        );
      }
    }

    return this.prisma.order.update({
      where: { id },
      data: {
        progress: dto.progress,
      },
    });
  }

  /**
   * 7. Get platform order statistics summary (Admin)
   */
  async getOrderStats() {
    const [
      totalOrders,
      awaitingPayment,
      inProgress,
      inReview,
      completed,
      cancelled,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: OrderStatus.AWAITING_PAYMENT } }),
      this.prisma.order.count({ where: { status: OrderStatus.IN_PROGRESS } }),
      this.prisma.order.count({
        where: {
          status: { in: [OrderStatus.REVIEW, OrderStatus.REVISION, OrderStatus.FINAL_DELIVERY] },
        },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
      this.prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    ]);

    return {
      totalOrders,
      awaitingPayment,
      inProgress,
      inReview,
      completed,
      cancelled,
    };
  }
}
