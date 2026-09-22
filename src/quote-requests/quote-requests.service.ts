import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto.js';
import { UpdateQuoteRequestStatusDto } from './dto/update-quote-request-status.dto.js';
import { QueryQuoteRequestsDto } from './dto/query-quote-requests.dto.js';
import { Prisma, UserRole, QuoteRequestStatus } from '@prisma/client';

@Injectable()
export class QuoteRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Client submits a project requirement brief & quote request
   */
  async create(clientId: string, dto: CreateQuoteRequestDto) {
    // 1. Validate service
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      include: {
        requirementFields: {
          where: { isActive: true },
        },
      },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found or is currently inactive');
    }

    // 2. Validate required fields
    const requiredFields = service.requirementFields.filter((f) => f.isRequired);
    const providedRequirements = dto.requirements || [];

    for (const reqField of requiredFields) {
      const match = providedRequirements.find(
        (r) =>
          r.fieldId === reqField.id &&
          r.value !== undefined &&
          r.value !== null &&
          r.value !== '',
      );

      if (!match) {
        throw new BadRequestException(
          `Required field '${reqField.label}' is missing.`,
        );
      }
    }

    // 3. Create QuoteRequest and RequirementValues in transaction
    return this.prisma.$transaction(async (tx) => {
      const quoteRequest = await tx.quoteRequest.create({
        data: {
          clientId,
          serviceId: dto.serviceId,
          projectName: dto.projectName,
          description: dto.description,
          status: QuoteRequestStatus.SUBMITTED,
        },
      });

      // Filter valid requirements mapped to fields in this service
      const validFieldIds = new Set(service.requirementFields.map((f) => f.id));
      const valuesToInsert = providedRequirements
        .filter((r) => validFieldIds.has(r.fieldId))
        .map((r) => ({
          fieldId: r.fieldId,
          requestId: quoteRequest.id,
          value: r.value as Prisma.InputJsonValue,
        }));

      if (valuesToInsert.length > 0) {
        await tx.requirementValue.createMany({
          data: valuesToInsert,
        });
      }

      return tx.quoteRequest.findUnique({
        where: { id: quoteRequest.id },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          requirementValues: {
            include: {
              field: true,
            },
          },
        },
      });
    });
  }

  /**
   * Client views their own submitted quote requests with cursor pagination
   */
  async findMyRequests(clientId: string, query: QueryQuoteRequestsDto) {
    const limit = query.limit ?? 10;
    const { cursor, status, serviceId, search } = query;

    const where: Prisma.QuoteRequestWhereInput = {
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
        { projectName: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const totalCount = await this.prisma.quoteRequest.count({ where });

    const items = await this.prisma.quoteRequest.findMany({
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
            status: true,
            estimatedDays: true,
            revisions: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            requirementValues: true,
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
   * Admin views all quote requests across all clients with cursor pagination & search
   */
  async findAll(query: QueryQuoteRequestsDto) {
    const limit = query.limit ?? 10;
    const { cursor, status, serviceId, search } = query;

    const where: Prisma.QuoteRequestWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (serviceId) {
      where.serviceId = serviceId;
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { projectName: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { client: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { client: { email: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const totalCount = await this.prisma.quoteRequest.count({ where });

    const items = await this.prisma.quoteRequest.findMany({
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
            status: true,
            estimatedDays: true,
          },
        },
        _count: {
          select: {
            requirementValues: true,
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
   * Get single quote request details with full requirement values
   */
  async findOne(id: string, currentUser: { id: string; role: UserRole }) {
    const quoteRequest = await this.prisma.quoteRequest.findUnique({
      where: { id },
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
        requirementValues: {
          include: {
            field: true,
          },
          orderBy: {
            field: {
              sortOrder: 'asc',
            },
          },
        },
        quote: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!quoteRequest) {
      throw new NotFoundException(`Quote request with ID '${id}' not found`);
    }

    // Access control: Only Admin or the owner client can view
    if (currentUser.role !== UserRole.ADMIN && quoteRequest.clientId !== currentUser.id) {
      throw new ForbiddenException(
        'Access denied. You do not have permission to view this requirement brief.',
      );
    }

    return quoteRequest;
  }

  /**
   * Admin updates quote request status
   */
  async updateStatus(id: string, dto: UpdateQuoteRequestStatusDto) {
    const quoteRequest = await this.prisma.quoteRequest.findUnique({
      where: { id },
    });

    if (!quoteRequest) {
      throw new NotFoundException(`Quote request with ID '${id}' not found`);
    }

    return this.prisma.quoteRequest.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        service: true,
      },
    });
  }

  /**
   * Client cancels their own quote request
   */
  async cancel(id: string, clientId: string) {
    const quoteRequest = await this.prisma.quoteRequest.findUnique({
      where: { id },
      include: {
        quote: true,
      },
    });

    if (!quoteRequest) {
      throw new NotFoundException(`Quote request with ID '${id}' not found`);
    }

    if (quoteRequest.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied. You can only cancel your own quote request.',
      );
    }

    if (quoteRequest.status === QuoteRequestStatus.CANCELLED) {
      throw new BadRequestException('This quote request is already cancelled.');
    }

    if (quoteRequest.quote && quoteRequest.quote.status === 'APPROVED') {
      throw new BadRequestException(
        'Cannot cancel a request with an accepted quote. Please contact support.',
      );
    }

    return this.prisma.quoteRequest.update({
      where: { id },
      data: {
        status: QuoteRequestStatus.CANCELLED,
      },
    });
  }
}
