import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { QueryCategoryDto } from './dto/query-category.dto.js';
import { slugify } from '../common/utils/slug.util.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findAll(query?: QueryCategoryDto) {
    const isPublicDefault = !query?.includeInactive;
    const cacheKey = isPublicDefault ? 'categories:public:all' : null;

    if (cacheKey) {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return cached;
    }

    const where: any = {};
    if (!query?.includeInactive) {
      where.isActive = true;
    }

    const categories = await this.prisma.serviceCategory.findMany({
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

    if (cacheKey) {
      await this.cacheManager.set(cacheKey, categories, 300000); // 5 minutes cache
    }

    return categories;
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

    const created = await this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        image: dto.image || dto.icon || undefined,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.cacheManager.del('categories:public:all');
    return created;
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

    const imageVal = dto.image !== undefined ? dto.image : (dto.icon !== undefined ? dto.icon : category.image);

    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        name: dto.name ?? category.name,
        slug,
        description: dto.description !== undefined ? dto.description : category.description,
        image: imageVal,
        isActive: dto.isActive !== undefined ? dto.isActive : category.isActive,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : category.sortOrder,
      },
    });

    await this.cacheManager.del('categories:public:all');
    return updated;
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

    const deleted = await this.prisma.serviceCategory.delete({
      where: { id },
    });

    await this.cacheManager.del('categories:public:all');
    return deleted;
  }
}
