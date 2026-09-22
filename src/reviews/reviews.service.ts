import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { QueryReviewsDto } from './dto/query-reviews.dto.js';
import { UserRole, OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Client submits a 1-5 star review and comment for a COMPLETED order
   */
  async submitReview(orderId: string, clientId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        review: true,
        service: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' was not found.`);
    }

    if (order.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied. You can only submit reviews for your own orders.',
      );
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException(
        'Reviews can only be submitted for completed orders.',
      );
    }

    if (order.review) {
      throw new ConflictException(
        'A review has already been submitted for this order.',
      );
    }

    const review = await this.prisma.review.create({
      data: {
        orderId,
        clientId,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
        isPublished: true, // Automatically visible, admin can moderate/hide if needed
      },
      include: {
        client: {
          select: { id: true, name: true, image: true },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            title: true,
            service: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return {
      message: 'Thank you for your feedback! Your review has been submitted successfully.',
      review,
    };
  }

  /**
   * 2. Get review for a specific order (Client, Assigned Worker, or Admin)
   */
  async getOrderReview(
    orderId: string,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        assignments: { where: { unassignedAt: null } },
        review: {
          include: {
            client: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' was not found.`);
    }

    if (currentUser.role === UserRole.CLIENT && order.clientId !== currentUser.id) {
      throw new ForbiddenException('Access denied.');
    }

    if (currentUser.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some(
        (a) => a.memberId === currentUser.id,
      );
      if (!isAssigned) {
        throw new ForbiddenException('Access denied.');
      }
    }

    return order.review;
  }

  /**
   * 3. Public: Get featured / top published reviews for Landing Page
   */
  async getFeaturedReviews(limit: number = 6) {
    const safeLimit = Math.min(Math.max(1, limit), 20);

    const reviews = await this.prisma.review.findMany({
      where: { isPublished: true },
      take: safeLimit,
      orderBy: [
        { rating: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        client: {
          select: { id: true, name: true, image: true },
        },
        order: {
          select: {
            id: true,
            title: true,
            service: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    return reviews;
  }

  /**
   * 4. Public: Get published reviews for a specific Service with aggregate rating stats
   */
  async getPublicServiceReviews(
    serviceId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    // Check service existence
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, slug: true },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID '${serviceId}' was not found.`);
    }

    const where: Prisma.ReviewWhereInput = {
      isPublished: true,
      order: { serviceId },
    };

    const [reviews, totalCount, aggregateStats] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, name: true, image: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const averageRating = aggregateStats._avg.rating
      ? Number(aggregateStats._avg.rating.toFixed(1))
      : 0;

    return {
      service,
      stats: {
        totalReviews: totalCount,
        averageRating,
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      data: reviews,
    };
  }

  /**
   * 5. Admin: List all reviews with search, filter, and pagination
   */
  async getAllReviewsAdmin(query: QueryReviewsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};

    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished === 'true';
    }

    if (query.rating) {
      where.rating = query.rating;
    }

    if (query.serviceId) {
      where.order = { serviceId: query.serviceId };
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { comment: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { client: { email: { contains: search, mode: 'insensitive' } } },
        { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, name: true, email: true, image: true },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              title: true,
              service: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: reviews,
    };
  }

  /**
   * 6. Admin: Toggle publish status of a review
   */
  async updatePublishStatus(id: string, isPublished: boolean) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID '${id}' was not found.`);
    }

    const updated = await this.prisma.review.update({
      where: { id },
      data: { isPublished },
      include: {
        client: { select: { id: true, name: true, email: true } },
        order: { select: { id: true, orderNumber: true, title: true } },
      },
    });

    return {
      message: `Review has been ${isPublished ? 'published' : 'hidden'}.`,
      review: updated,
    };
  }

  /**
   * 7. Admin: Delete an inappropriate review
   */
  async deleteReview(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID '${id}' was not found.`);
    }

    await this.prisma.review.delete({
      where: { id },
    });

    return {
      message: 'Review successfully deleted.',
    };
  }
}
