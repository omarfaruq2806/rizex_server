import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AssignMemberDto } from './dto/assign-member.dto.js';
import { UnassignMemberDto } from './dto/unassign-member.dto.js';
import { QueryTeamMembersDto } from './dto/query-team.dto.js';
import { Prisma, UserRole, OrderStatus } from '@prisma/client';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Admin views all available Team Members & their active project workload
   */
  async getTeamMembers(query: QueryTeamMembersDto) {
    const limit = query.limit ?? 10;
    const { cursor, search } = query;

    const where: Prisma.UserWhereInput = {
      role: {
        in: [UserRole.TEAM_MEMBER, UserRole.ADMIN],
      },
    };

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const totalCount = await this.prisma.user.count({ where });

    const members = await this.prisma.user.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        assignedOrders: {
          where: {
            unassignedAt: null,
            order: {
              status: {
                notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
              },
            },
          },
          select: {
            orderId: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const hasNextPage = members.length > limit;
    const paginatedMembers = hasNextPage ? members.slice(0, limit) : members;
    const nextCursor = hasNextPage
      ? paginatedMembers[paginatedMembers.length - 1].id
      : null;

    // Transform with workload summary
    const formattedMembers = paginatedMembers.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      image: m.image,
      role: m.role,
      joinedAt: m.createdAt,
      activeProjectsCount: m.assignedOrders.length,
      activeOrders: m.assignedOrders.map((a) => a.order),
    }));

    return {
      items: formattedMembers,
      nextCursor,
      hasNextPage,
      totalCount,
    };
  }

  /**
   * 2. Admin assigns a team member to an order (With full audit tracking)
   */
  async assignMember(
    orderId: string,
    dto: AssignMemberDto,
    adminId: string,
  ) {
    // Step 1: Verify Order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' does not exist.`);
    }

    // Step 2: Verify User exists and is eligible for assignments
    const member = await this.prisma.user.findUnique({
      where: { id: dto.memberId },
    });

    if (!member) {
      throw new NotFoundException(
        `Team Member with ID '${dto.memberId}' does not exist.`,
      );
    }

    if (member.role === UserRole.CLIENT) {
      throw new BadRequestException(
        'Clients cannot be assigned as project workers. Only TEAM_MEMBER or ADMIN users can be assigned.',
      );
    }

    // Step 3: Check if already actively assigned
    const existingAssignment = await this.prisma.orderAssignment.findFirst({
      where: {
        orderId,
        memberId: dto.memberId,
        unassignedAt: null,
      },
    });

    if (existingAssignment) {
      throw new ConflictException(
        `Team member '${member.name}' is already assigned to this order.`,
      );
    }

    // Step 4: Execute assignment in transaction and update order status if needed
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.orderAssignment.create({
        data: {
          orderId,
          memberId: dto.memberId,
          assignedById: adminId,
        },
        include: {
          member: {
            select: { id: true, name: true, email: true, image: true, role: true },
          },
          assignedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // If order is currently AWAITING_PAYMENT, move to ASSIGNED
      if (order.status === OrderStatus.AWAITING_PAYMENT) {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.ASSIGNED },
        });
      }

      return {
        message: `Team member '${member.name}' successfully assigned to order #${order.orderNumber}.`,
        assignment,
      };
    });
  }

  /**
   * 3. Admin unassigns a team member from an order
   */
  async unassignMember(
    orderId: string,
    dto: UnassignMemberDto,
    adminId: string,
  ) {
    const activeAssignment = await this.prisma.orderAssignment.findFirst({
      where: {
        orderId,
        memberId: dto.memberId,
        unassignedAt: null,
      },
      include: {
        member: { select: { id: true, name: true } },
      },
    });

    if (!activeAssignment) {
      throw new NotFoundException(
        `No active assignment found for team member with ID '${dto.memberId}' on this order.`,
      );
    }

    const updated = await this.prisma.orderAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        unassignedAt: new Date(),
      },
      include: {
        member: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      message: `Team member '${activeAssignment.member.name}' has been unassigned from order.`,
      assignment: updated,
    };
  }

  /**
   * 4. Get all assignments history (active & previous) for an order
   */
  async getOrderAssignments(
    orderId: string,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' does not exist.`);
    }

    // Role check: Client must own order, Worker must be assigned, or Admin
    if (currentUser.role === UserRole.CLIENT && order.clientId !== currentUser.id) {
      throw new ForbiddenException(
        'Access denied. You do not have permission to view assignments for this order.',
      );
    }

    return this.prisma.orderAssignment.findMany({
      where: { orderId },
      orderBy: { assignedAt: 'desc' },
      include: {
        member: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
        assignedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}
