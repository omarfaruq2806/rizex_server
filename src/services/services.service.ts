import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { QueryServiceDto } from './dto/query-service.dto.js';
import { slugify } from '../common/utils/slug.util.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all services with cursor-based infinite pagination, search, and category filters
   */
  async findAll(query: QueryServiceDto) {
    const limit = query.limit ?? 10;
    const { cursor, search, categoryId, categorySlug, includeInactive } = query;

    const where: Prisma.ServiceWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    } else if (categorySlug) {
      where.category = {
        slug: categorySlug,
      };
    }

    if (search && search.trim()) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Fetch total matching count
    const totalCount = await this.prisma.service.count({ where });

    // Fetch items with cursor (take limit + 1 to check for next page)
    const items = await this.prisma.service.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            requirementFields: {
              where: { isActive: true },
            },
            orders: true,
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
   * Find single service by ID or Slug with category and requirement fields
   */
  async findOne(idOrSlug: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      include: {
        category: true,
        requirementFields: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            orders: true,
            quoteRequests: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service '${idOrSlug}' not found`);
    }

    return service;
  }

  /**
   * Create new service (Admin)
   */
  async create(dto: CreateServiceDto) {
    // Validate category exists
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${dto.categoryId}' not found`);
    }

    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    if (!slug) {
      throw new BadRequestException('A valid name or slug must be provided');
    }

    const existingSlug = await this.prisma.service.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw new ConflictException(
        `Service with slug '${slug}' already exists. Please choose a different name or slug.`,
      );
    }

    return this.prisma.service.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        showPrice: dto.showPrice ?? false,
        startingPrice: dto.startingPrice !== undefined ? new Prisma.Decimal(dto.startingPrice) : null,
        currency: dto.currency ?? 'BDT',
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Update service (Admin)
   */
  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID '${id}' not found`);
    }

    if (dto.categoryId && dto.categoryId !== service.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Category with ID '${dto.categoryId}' not found`);
      }
    }

    let slug = service.slug;
    if (dto.slug) {
      slug = slugify(dto.slug);
      if (slug !== service.slug) {
        const existingSlug = await this.prisma.service.findUnique({
          where: { slug },
        });
        if (existingSlug && existingSlug.id !== id) {
          throw new ConflictException(`Service with slug '${slug}' already exists.`);
        }
      }
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        categoryId: dto.categoryId ?? service.categoryId,
        name: dto.name ?? service.name,
        slug,
        description: dto.description !== undefined ? dto.description : service.description,
        image: dto.image !== undefined ? dto.image : service.image,
        isActive: dto.isActive !== undefined ? dto.isActive : service.isActive,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : service.sortOrder,
        showPrice: dto.showPrice !== undefined ? dto.showPrice : service.showPrice,
        startingPrice:
          dto.startingPrice !== undefined
            ? dto.startingPrice !== null
              ? new Prisma.Decimal(dto.startingPrice)
              : null
            : service.startingPrice,
        currency: dto.currency ?? service.currency,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Toggle service active/inactive status (Admin)
   */
  async toggleActiveStatus(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID '${id}' not found`);
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        isActive: !service.isActive,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Delete service (Admin)
   */
  async remove(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: {
              where: {
                status: {
                  notIn: ['COMPLETED', 'CANCELLED'],
                },
              },
            },
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID '${id}' not found`);
    }

    if (service._count.orders > 0) {
      throw new BadRequestException(
        `Cannot delete service '${service.name}' because it has ${service._count.orders} active order(s). Consider deactivating the service instead.`,
      );
    }

    return this.prisma.service.delete({
      where: { id },
    });
  }

  // ========================================================
  // DYNAMIC REQUIREMENT FIELDS MANAGEMENT
  // ========================================================

  /**
   * Get all requirement fields for a service
   */
  async getRequirementFields(serviceId: string, includeInactive = false) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID '${serviceId}' not found`);
    }

    const where: Prisma.RequirementFieldWhereInput = { serviceId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.requirementField.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Add dynamic requirement field to a service (Admin)
   */
  async createRequirementField(
    serviceId: string,
    dto: import('./dto/requirement-field.dto.js').CreateRequirementFieldDto,
  ) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID '${serviceId}' not found`);
    }

    // Auto-generate field name if not provided
    const fieldName = dto.name
      ? dto.name.toLowerCase()
      : dto.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

    if (!fieldName) {
      throw new BadRequestException('A valid field name or label must be provided');
    }

    const existingField = await this.prisma.requirementField.findUnique({
      where: {
        serviceId_name: {
          serviceId,
          name: fieldName,
        },
      },
    });

    if (existingField) {
      throw new ConflictException(
        `A requirement field with name '${fieldName}' already exists for this service.`,
      );
    }

    return this.prisma.requirementField.create({
      data: {
        serviceId,
        label: dto.label,
        name: fieldName,
        type: dto.type,
        placeholder: dto.placeholder,
        description: dto.description,
        isRequired: dto.isRequired ?? false,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        options: dto.options ? (dto.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  /**
   * Update dynamic requirement field (Admin)
   */
  async updateRequirementField(
    serviceId: string,
    fieldId: string,
    dto: import('./dto/requirement-field.dto.js').UpdateRequirementFieldDto,
  ) {
    const field = await this.prisma.requirementField.findFirst({
      where: { id: fieldId, serviceId },
    });

    if (!field) {
      throw new NotFoundException(
        `Requirement field with ID '${fieldId}' not found for this service`,
      );
    }

    let fieldName = field.name;
    if (dto.name) {
      fieldName = dto.name.toLowerCase();
      if (fieldName !== field.name) {
        const existingField = await this.prisma.requirementField.findUnique({
          where: {
            serviceId_name: {
              serviceId,
              name: fieldName,
            },
          },
        });

        if (existingField && existingField.id !== fieldId) {
          throw new ConflictException(
            `A requirement field with name '${fieldName}' already exists for this service.`,
          );
        }
      }
    }

    return this.prisma.requirementField.update({
      where: { id: fieldId },
      data: {
        label: dto.label ?? field.label,
        name: fieldName,
        type: dto.type ?? field.type,
        placeholder: dto.placeholder !== undefined ? dto.placeholder : field.placeholder,
        description: dto.description !== undefined ? dto.description : field.description,
        isRequired: dto.isRequired !== undefined ? dto.isRequired : field.isRequired,
        isActive: dto.isActive !== undefined ? dto.isActive : field.isActive,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : field.sortOrder,
        options:
          dto.options !== undefined
            ? dto.options === null
              ? Prisma.JsonNull
              : (dto.options as Prisma.InputJsonValue)
            : (field.options as Prisma.InputJsonValue),
      },
    });
  }

  /**
   * Delete dynamic requirement field (Admin)
   */
  async deleteRequirementField(serviceId: string, fieldId: string) {
    const field = await this.prisma.requirementField.findFirst({
      where: { id: fieldId, serviceId },
    });

    if (!field) {
      throw new NotFoundException(
        `Requirement field with ID '${fieldId}' not found for this service`,
      );
    }

    return this.prisma.requirementField.delete({
      where: { id: fieldId },
    });
  }

  /**
   * Reorder requirement fields (Admin)
   */
  async reorderRequirementFields(serviceId: string, fieldIds: string[]) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID '${serviceId}' not found`);
    }

    const updates = fieldIds.map((id, index) =>
      this.prisma.requirementField.updateMany({
        where: { id, serviceId },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.getRequirementFields(serviceId, true);
  }
}
