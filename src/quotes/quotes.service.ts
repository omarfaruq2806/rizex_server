import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { RequestQuoteChangesDto } from './dto/request-changes.dto.js';
import { QueryQuotesDto } from './dto/query-quotes.dto.js';
import { generateOrderNumber } from '../common/utils/order-number.util.js';
import {
  Prisma,
  UserRole,
  QuoteStatus,
  QuoteRequestStatus,
  OrderStatus,
} from '@prisma/client';

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Admin creates a custom quote for a client's requirement brief
   */
  async createQuote(adminId: string, dto: CreateQuoteDto) {
    // Step 1: Verify the QuoteRequest exists
    const quoteRequest = await this.prisma.quoteRequest.findUnique({
      where: { id: dto.requestId },
      include: { quote: true },
    });

    if (!quoteRequest) {
      throw new NotFoundException(
        `Quote Request with ID '${dto.requestId}' does not exist.`,
      );
    }

    // Step 2: Prevent creating multiple quotes for the same request
    if (quoteRequest.quote) {
      throw new ConflictException(
        'A quote has already been created for this request. Please update the existing quote instead.',
      );
    }

    // Step 3: Determine initial status (SENT or DRAFT)
    const initialStatus = dto.sendImmediately
      ? QuoteStatus.SENT
      : QuoteStatus.DRAFT;

    // Step 4: Create Quote and update Request status in a safe transaction
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.create({
        data: {
          requestId: dto.requestId,
          createdById: adminId,
          amount: new Prisma.Decimal(dto.amount),
          advanceAmount: new Prisma.Decimal(dto.advanceAmount ?? 0),
          currency: dto.currency ?? 'BDT',
          estimatedDays: dto.estimatedDays,
          revisions: dto.revisions ?? 0,
          includedItems: dto.includedItems
            ? (dto.includedItems as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          notes: dto.notes,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          status: initialStatus,
        },
        include: {
          request: {
            include: {
              client: {
                select: { id: true, name: true, email: true },
              },
              service: {
                select: { id: true, name: true, slug: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Update QuoteRequest status accordingly
      if (dto.sendImmediately) {
        await tx.quoteRequest.update({
          where: { id: dto.requestId },
          data: { status: QuoteRequestStatus.QUOTE_SENT },
        });
      } else {
        await tx.quoteRequest.update({
          where: { id: dto.requestId },
          data: { status: QuoteRequestStatus.UNDER_REVIEW },
        });
      }

      return quote;
    });
  }

  /**
   * 2. Admin updates an existing draft quote
   */
  async updateQuote(id: string, dto: UpdateQuoteDto) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID '${id}' was not found.`);
    }

    if (quote.status === QuoteStatus.APPROVED) {
      throw new BadRequestException(
        'This quote has already been approved by the client and cannot be modified.',
      );
    }

    return this.prisma.quote.update({
      where: { id },
      data: {
        amount: dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : quote.amount,
        advanceAmount:
          dto.advanceAmount !== undefined
            ? new Prisma.Decimal(dto.advanceAmount)
            : quote.advanceAmount,
        currency: dto.currency ?? quote.currency,
        estimatedDays:
          dto.estimatedDays !== undefined ? dto.estimatedDays : quote.estimatedDays,
        revisions: dto.revisions !== undefined ? dto.revisions : quote.revisions,
        includedItems:
          dto.includedItems !== undefined
            ? (dto.includedItems as Prisma.InputJsonValue)
            : (quote.includedItems as Prisma.InputJsonValue),
        notes: dto.notes !== undefined ? dto.notes : quote.notes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : quote.expiresAt,
      },
      include: {
        request: {
          include: {
            client: { select: { id: true, name: true, email: true } },
            service: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
  }

  /**
   * 3. Admin sends the draft quote to the client
   */
  async sendQuote(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID '${id}' was not found.`);
    }

    if (quote.status === QuoteStatus.APPROVED) {
      throw new BadRequestException('Quote is already approved.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedQuote = await tx.quote.update({
        where: { id },
        data: {
          status: QuoteStatus.SENT,
        },
        include: {
          request: {
            include: {
              client: { select: { id: true, name: true, email: true } },
              service: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });

      await tx.quoteRequest.update({
        where: { id: quote.requestId },
        data: { status: QuoteRequestStatus.QUOTE_SENT },
      });

      return updatedQuote;
    });
  }

  /**
   * 4. View single quote details with permissions check
   */
  async findOne(id: string, currentUser: { id: string; role: UserRole }) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            client: {
              select: { id: true, name: true, email: true, image: true },
            },
            service: {
              include: { category: true },
            },
            requirementValues: {
              include: { field: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID '${id}' was not found.`);
    }

    // RBAC: Client can only view their own quotes, Admin can view all
    if (
      currentUser.role !== UserRole.ADMIN &&
      quote.request.clientId !== currentUser.id
    ) {
      throw new ForbiddenException(
        'Access denied. You do not have permission to view this quote.',
      );
    }

    return quote;
  }

  /**
   * 5. Client accepts quote -> Converts automatically into an active Order
   */
  async acceptQuote(id: string, clientId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            service: true,
          },
        },
        order: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID '${id}' was not found.`);
    }

    // Verify client ownership
    if (quote.request.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied. You can only accept quotes addressed to you.',
      );
    }

    // Check if already approved
    if (quote.status === QuoteStatus.APPROVED || quote.order) {
      throw new BadRequestException(
        `This quote is already accepted. Order #${quote.order?.orderNumber || ''} is active.`,
      );
    }

    // Check expiration date
    if (quote.expiresAt && new Date() > new Date(quote.expiresAt)) {
      throw new BadRequestException(
        'This quote has expired. Please request a new or revised quote.',
      );
    }

    // Execute Order creation and Quote approval in an atomic transaction
    return this.prisma.$transaction(async (tx) => {
      // 1. Mark quote as APPROVED
      const approvedQuote = await tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.APPROVED },
      });

      // 2. Calculate dates
      const startDate = new Date();
      let expectedDelivery: Date | null = null;
      if (quote.estimatedDays && quote.estimatedDays > 0) {
        expectedDelivery = new Date();
        expectedDelivery.setDate(expectedDelivery.getDate() + quote.estimatedDays);
      }

      // 3. Generate unique Order number
      const orderNumber = generateOrderNumber();
      const orderTitle =
        quote.request.projectName || `${quote.request.service.name} Project`;

      // 4. Create Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          clientId,
          serviceId: quote.request.serviceId,
          quoteId: quote.id,
          title: orderTitle,
          status: OrderStatus.AWAITING_PAYMENT,
          progress: 0,
          startDate,
          expectedDelivery,
        },
        include: {
          service: {
            select: { id: true, name: true, slug: true },
          },
          quote: {
            select: { id: true, amount: true, advanceAmount: true, currency: true },
          },
        },
      });

      return {
        message: 'Quote successfully accepted! Order has been generated.',
        quote: approvedQuote,
        order: newOrder,
      };
    });
  }

  /**
   * 6. Client requests modifications to the quote
   */
  async requestChanges(
    id: string,
    clientId: string,
    dto: RequestQuoteChangesDto,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { request: true },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID '${id}' was not found.`);
    }

    if (quote.request.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied. You can only request changes on your own quotes.',
      );
    }

    if (quote.status === QuoteStatus.APPROVED) {
      throw new BadRequestException('Cannot request changes on an approved quote.');
    }

    const updatedNotes = quote.notes
      ? `${quote.notes}\n[Client Change Request]: ${dto.notes}`
      : `[Client Change Request]: ${dto.notes}`;

    return this.prisma.$transaction(async (tx) => {
      const updatedQuote = await tx.quote.update({
        where: { id },
        data: {
          status: QuoteStatus.CHANGES_REQUESTED,
          notes: updatedNotes,
        },
      });

      await tx.quoteRequest.update({
        where: { id: quote.requestId },
        data: { status: QuoteRequestStatus.UNDER_REVIEW },
      });

      return updatedQuote;
    });
  }

  /**
   * 7. Client rejects the quote
   */
  async rejectQuote(id: string, clientId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: { request: true },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID '${id}' was not found.`);
    }

    if (quote.request.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied. You can only reject quotes addressed to you.',
      );
    }

    if (quote.status === QuoteStatus.APPROVED) {
      throw new BadRequestException('Cannot reject an already approved quote.');
    }

    return this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.REJECTED },
    });
  }

  /**
   * 8. Admin lists all quotes with cursor pagination
   */
  async findAll(query: QueryQuotesDto) {
    const limit = query.limit ?? 10;
    const { cursor, status } = query;

    const where: Prisma.QuoteWhereInput = {};
    if (status) {
      where.status = status;
    }

    const totalCount = await this.prisma.quote.count({ where });

    const items = await this.prisma.quote.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        request: {
          include: {
            client: { select: { id: true, name: true, email: true } },
            service: { select: { id: true, name: true, slug: true } },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        order: {
          select: { id: true, orderNumber: true, status: true },
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
}
