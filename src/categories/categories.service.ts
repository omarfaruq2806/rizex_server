import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { QueryCategoryDto } from './dto/query-category.dto.js';
import { slugify } from '../common/utils/slug.util.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: QueryCategoryDto) {
    const where: any = {};
    if (!query?.includeInactive) {
      where.isActive = true;
    }

    return this.prisma.serviceCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            services: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async findOne(idOrSlug: string) {
    const isCuid = idOrSlug.startsWith('c') && idOrSlug.length > 20;

    const category = await this.prisma.serviceCategory.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { services: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category '${idOrSlug}' not found`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);

    if (!slug) {
      throw new BadRequestException('A valid name or slug must be provided');
    }

    const existingSlug = await this.prisma.serviceCategory.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw new ConflictException(
        `Category with slug '${slug}' already exists. Please choose a different name or slug.`,
      );
    }

    return this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    let slug = category.slug;
    if (dto.slug) {
      slug = slugify(dto.slug);
      if (slug !== category.slug) {
        const existingSlug = await this.prisma.serviceCategory.findUnique({
          where: { slug },
        });
        if (existingSlug && existingSlug.id !== id) {
          throw new ConflictException(
            `Category with slug '${slug}' already exists.`,
          );
        }
      }
    }

    return this.prisma.serviceCategory.update({
      where: { id },
      data: {
        name: dto.name ?? category.name,
        slug,
        description: dto.description !== undefined ? dto.description : category.description,
        image: dto.image !== undefined ? dto.image : category.image,
        isActive: dto.isActive !== undefined ? dto.isActive : category.isActive,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : category.sortOrder,
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID '${id}' not found`);
    }

    if (category._count.services > 0) {
      throw new BadRequestException(
        `Cannot delete category '${category.name}' because it contains ${category._count.services} associated service(s). Please delete or reassign them first.`,
      );
    }

    return this.prisma.serviceCategory.delete({
      where: { id },
    });
  }
}
