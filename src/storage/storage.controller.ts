import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { GetUploadUrlDto } from './dto/get-upload-url.dto.js';
import { AttachOrderFileDto } from './dto/attach-file.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { FileCategory } from '@prisma/client';

@Controller('storage')
@UseGuards(AuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * 1. Get secure Presigned PUT Upload URL for direct client-to-R2 upload
   */
  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async getUploadPresignedUrl(
    @Body() dto: GetUploadUrlDto,
    @CurrentUser() user: any,
  ) {
    return this.storageService.getUploadPresignedUrl(user, dto);
  }

  /**
   * 2. Get secure temporary Presigned GET Download URL for any private storage key
   */
  @Get('download-url')
  async getDownloadPresignedUrl(
    @Query('key') key: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const parsedExpires = expiresIn ? parseInt(expiresIn, 10) : 3600;
    const downloadUrl = await this.storageService.getDownloadPresignedUrl(
      key,
      parsedExpires,
    );
    return { downloadUrl };
  }

  /**
   * 3. Attach uploaded file metadata to an Order
   */
  @Post('orders/:orderId/attach')
  @HttpCode(HttpStatus.CREATED)
  async attachFileToOrder(
    @Param('orderId') orderId: string,
    @Body() dto: AttachOrderFileDto,
    @CurrentUser() user: any,
  ) {
    return this.storageService.attachFileToOrder(orderId, user.id, dto, user);
  }

  /**
   * 4. Get all order files with fresh signed download URLs
   */
  @Get('orders/:orderId/files')
  async getOrderFiles(
    @Param('orderId') orderId: string,
    @Query('category') category: FileCategory,
    @CurrentUser() user: any,
  ) {
    return this.storageService.getOrderFilesWithUrls(orderId, user, category);
  }

  /**
   * 5. Delete an uploaded file from R2 and database
   */
  @Delete('files/:fileId')
  async deleteFile(
    @Param('fileId') fileId: string,
    @CurrentUser() user: any,
  ) {
    return this.storageService.deleteOrderFile(fileId, user);
  }
}
