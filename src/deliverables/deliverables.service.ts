import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmitDeliveryDto } from './dto/submit-delivery.dto.js';
import { RequestRevisionDto } from './dto/request-revision.dto.js';
import { UploadFileMetadataDto } from './dto/upload-file-metadata.dto.js';
import {
  UserRole,
  OrderStatus,
  DeliveryStatus,
  RevisionStatus,
  FileCategory,
  Prisma,
} from '@prisma/client';

@Injectable()
export class DeliverablesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Team Member or Admin submits work deliverables for client review
   */
  async submitDelivery(
    orderId: string,
    user: { id: string; role: UserRole },
    dto: SubmitDeliveryDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        assignments: { where: { unassignedAt: null } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' does not exist.`);
    }

    if (user.role === UserRole.TEAM_MEMBER) {
      const isAssigned = order.assignments.some((a) => a.memberId === user.id);
      if (!isAssigned) {
        throw new ForbiddenException(
          'Access denied. You can only submit deliverables for projects assigned to you.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Upsert Delivery record
      const delivery = await tx.delivery.upsert({
        where: { orderId },
        create: {
          orderId,
          message: dto.message,
          status: DeliveryStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        update: {
          message: dto.message,
          status: DeliveryStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      // Update Order Status to REVIEW
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.REVIEW,
        },
      });

      // Insert deliverable files if provided
      if (dto.files && dto.files.length > 0) {
        const filesToInsert = dto.files.map((file) => ({
          orderId,
          uploaderId: user.id,
          name: file.name,
          url: file.url,
          mimeType: file.mimeType,
          size: file.size,
          category: FileCategory.DELIVERABLE,
        }));

        await tx.projectFile.createMany({
          data: filesToInsert,
        });
      }

      return {
        message: 'Deliverables successfully submitted for client review.',
        delivery,
      };
    });
  }

  /**
   * 2. Client approves delivery -> Marks Order as COMPLETED (100% progress)
   */
  async approveDelivery(orderId: string, clientId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { delivery: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' was not found.`);
    }

    if (order.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied. You can only approve deliveries for your own projects.',
      );
    }

    if (!order.delivery || order.delivery.status !== DeliveryStatus.SUBMITTED) {
      throw new BadRequestException(
        'No active submitted delivery found to approve for this order.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const approvedDelivery = await tx.delivery.update({
        where: { orderId },
        data: {
          status: DeliveryStatus.APPROVED,
          approvedAt: new Date(),
        },
      });

      const completedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          progress: 100,
        },
      });

      return {
        message: 'Delivery approved! Project is now marked as Completed.',
        delivery: approvedDelivery,
        order: completedOrder,
      };
    });
  }

  /**
   * 3. Client requests changes/revisions on submitted deliverables
   */
  async requestRevision(
    orderId: string,
    clientId: string,
    dto: RequestRevisionDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        quote: true,
        revisions: true,
        delivery: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' was not found.`);
    }

    if (order.clientId !== clientId) {
      throw new ForbiddenException(
        'Access denied. You can only request revisions for your own projects.',
      );
    }

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException(
        'This order is already completed and cannot accept revisions.',
      );
    }

    // Check revision limits if configured
    const allowedRevisions = order.quote?.revisions ?? 0;
    const currentRevisionsCount = order.revisions.length;

    if (allowedRevisions > 0 && currentRevisionsCount >= allowedRevisions) {
      throw new BadRequestException(
        `You have used all ${allowedRevisions} allowed revisions for this quote. Please contact the team administrator for extra revisions.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const revision = await tx.revision.create({
        data: {
          orderId,
          clientId,
          reason: dto.reason,
          description: dto.description,
          section: dto.section,
          status: RevisionStatus.PENDING,
        },
      });

      // Update Order Status to REVISION
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.REVISION,
        },
      });

      // If delivery exists, mark it as CHANGES_REQUESTED
      if (order.delivery) {
        await tx.delivery.update({
          where: { orderId },
          data: {
            status: DeliveryStatus.CHANGES_REQUESTED,
          },
        });
      }

      return {
        message: 'Revision request successfully submitted.',
        revision,
      };
    });
  }

  /**
   * 4. Get all revision requests and history for an Order
   */
  async getOrderRevisions(
    orderId: string,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { assignments: { where: { unassignedAt: null } } },
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

    return this.prisma.revision.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });
  }

  /**
   * 5. Record file metadata for an Order
   */
  async addFileMetadata(
    orderId: string,
    uploaderId: string,
    dto: UploadFileMetadataDto,
    currentUser: { id: string; role: UserRole },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { assignments: { where: { unassignedAt: null } } },
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

    return this.prisma.projectFile.create({
      data: {
        orderId,
        uploaderId,
        name: dto.name,
        url: dto.url,
        key: dto.key,
        mimeType: dto.mimeType,
        size: dto.size,
        category: dto.category ?? FileCategory.OTHER,
      },
      include: {
        uploader: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  /**
   * 6. Get all files associated with an Order
   */
  async getOrderFiles(
    orderId: string,
    currentUser: { id: string; role: UserRole },
    category?: FileCategory,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { assignments: { where: { unassignedAt: null } } },
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

    const where: Prisma.ProjectFileWhereInput = { orderId };
    if (category) {
      where.category = category;
    }

    return this.prisma.projectFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }
}
