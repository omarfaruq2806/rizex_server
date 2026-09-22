import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { FileCategory } from '@prisma/client';

export enum UploadContext {
  ORDER_ASSET = 'ORDER_ASSET',
  SERVICE_ASSET = 'SERVICE_ASSET',
  AVATAR = 'AVATAR',
  GENERAL = 'GENERAL',
}

/**
 * DTO for requesting a secure Presigned PUT Upload URL
 */
export class GetUploadUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty({ message: 'Content type (MIME type) is required' })
  contentType: string;

  @IsOptional()
  @IsEnum(FileCategory, { message: 'Invalid file category' })
  category?: FileCategory = FileCategory.OTHER;

  @IsOptional()
  @IsEnum(UploadContext, { message: 'Invalid upload context' })
  context?: UploadContext = UploadContext.ORDER_ASSET;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;
}
