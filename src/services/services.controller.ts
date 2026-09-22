import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ServicesService } from './services.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { QueryServiceDto } from './dto/query-service.dto.js';
import {
  CreateRequirementFieldDto,
  UpdateRequirementFieldDto,
  ReorderFieldsDto,
} from './dto/requirement-field.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async findAll(@Query() query: QueryServiceDto) {
    return this.servicesService.findAll(query);
  }

  @Get(':idOrSlug')
  async findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.servicesService.findOne(idOrSlug);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createServiceDto: CreateServiceDto) {
    return this.servicesService.create(createServiceDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, updateServiceDto);
  }

  @Patch(':id/toggle-status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async toggleActiveStatus(@Param('id') id: string) {
    return this.servicesService.toggleActiveStatus(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }

  // ========================================================
  // REQUIREMENT FIELDS ENDPOINTS
  // ========================================================

  @Get(':serviceId/fields')
  async getRequirementFields(
    @Param('serviceId') serviceId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    return this.servicesService.getRequirementFields(
      serviceId,
      includeInactive === true || (includeInactive as any) === 'true',
    );
  }

  @Post(':serviceId/fields')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createRequirementField(
    @Param('serviceId') serviceId: string,
    @Body() createDto: CreateRequirementFieldDto,
  ) {
    return this.servicesService.createRequirementField(serviceId, createDto);
  }

  @Patch(':serviceId/fields/:fieldId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateRequirementField(
    @Param('serviceId') serviceId: string,
    @Param('fieldId') fieldId: string,
    @Body() updateDto: UpdateRequirementFieldDto,
  ) {
    return this.servicesService.updateRequirementField(
      serviceId,
      fieldId,
      updateDto,
    );
  }

  @Delete(':serviceId/fields/:fieldId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteRequirementField(
    @Param('serviceId') serviceId: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.servicesService.deleteRequirementField(serviceId, fieldId);
  }

  @Put(':serviceId/fields/reorder')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reorderRequirementFields(
    @Param('serviceId') serviceId: string,
    @Body() reorderDto: ReorderFieldsDto,
  ) {
    return this.servicesService.reorderRequirementFields(
      serviceId,
      reorderDto.fieldIds,
    );
  }
}
