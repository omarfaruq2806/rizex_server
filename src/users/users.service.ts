import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UserRole, Prisma } from '@prisma/client';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user analytics & role distribution stats
   */
  async getStats() {
    const [total, clients, teamMembers, admins] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.CLIENT } }),
      this.prisma.user.count({ where: { role: UserRole.TEAM_MEMBER } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
    ]);

    return {
      total,
      clients,
      teamMembers,
      admins,
    };
  }

  /**
   * Admin lists all platform users with role filter and search
   */
  async getUsers(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              clientOrders: true,
              assignedOrders: {
                where: { unassignedAt: null },
              },
              quoteRequests: true,
              reviews: true,
            },
          },
        },
      }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get detailed profile of a single user
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clientOrders: true,
            assignedOrders: true,
            quoteRequests: true,
            reviews: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }

  /**
   * Admin updates a user's platform role (CLIENT, TEAM_MEMBER, ADMIN)
   */
  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    currentAdminId: string,
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    // Protect against self-demotion if the admin is the only admin
    if (targetUser.id === currentAdminId && dto.role !== UserRole.ADMIN) {
      const adminCount = await this.prisma.user.count({
        where: { role: UserRole.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last administrator on the platform.',
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Admin removes a user account
   */
  async deleteUser(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException('You cannot delete your own admin account.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { success: true, message: `User '${targetUser.name}' removed successfully.` };
  }
}
