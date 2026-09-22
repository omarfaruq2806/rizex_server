import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole, FileCategory } from '@prisma/client';
import { DeliverablesService } from './deliverables.service.js';
import { SubmitDeliveryDto } from './dto/submit-delivery.dto.js';
import { RequestRevisionDto } from './dto/request-revision.dto.js';
import { UploadFileMetadataDto } from './dto/upload-file-metadata.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller()
@UseGuards(AuthGuard)
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  /**
   * Worker or Admin submits work deliverables for client review
   */
  @Post('orders/:orderId/delivery')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEAM_MEMBER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async submitDelivery(
    @Param('orderId') orderId: string,
    @Body() dto: SubmitDeliveryDto,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.submitDelivery(orderId, user, dto);
  }

  /**
   * Client approves delivery -> Marks Order as Completed
   */
  @Post('orders/:orderId/delivery/approve')
  @HttpCode(HttpStatus.OK)
  async approveDelivery(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.approveDelivery(orderId, user.id);
  }

  /**
   * Client requests changes/revisions on submitted work
   */
  @Post('orders/:orderId/revisions')
  @HttpCode(HttpStatus.CREATED)
  async requestRevision(
    @Param('orderId') orderId: string,
    @Body() dto: RequestRevisionDto,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.requestRevision(orderId, user.id, dto);
  }

  /**
   * View revision history for an order
   */
  @Get('orders/:orderId/revisions')
  async getOrderRevisions(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.getOrderRevisions(orderId, user);
  }

  /**
   * Record uploaded file metadata for an order
   */
  @Post('orders/:orderId/files')
  @HttpCode(HttpStatus.CREATED)
  async addFileMetadata(
    @Param('orderId') orderId: string,
    @Body() dto: UploadFileMetadataDto,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.addFileMetadata(orderId, user.id, dto, user);
  }

  /**
   * Get all files attached to an order
   */
  @Get('orders/:orderId/files')
  async getOrderFiles(
    @Param('orderId') orderId: string,
    @Query('category') category: FileCategory,
    @CurrentUser() user: any,
  ) {
    return this.deliverablesService.getOrderFiles(orderId, user, category);
  }
}
