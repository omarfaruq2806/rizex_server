import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { FileCategory } from '@prisma/client';

export enum UploadContext {
  ORDER_ASSET = 'ORDER_ASSET',
  SERVICE_ASSET = 'SERVICE_ASSET',
  AVATAR = 'AVATAR',
  GENERAL = 'GENERAL',
}

/**
 * Whitelist of safe MIME types allowed for upload across the system
 */
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
  'image/x-icon',
  // Documents
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/json',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/gzip',
  // Media / Audio / Video (for project deliverables)
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
];

/**
 * Dangerous file extensions that must NEVER be uploaded
 */
export const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.bash',
  '.php',
  '.phtml',
  '.jsp',
  '.asp',
  '.aspx',
  '.py',
  '.pl',
  '.cgi',
  '.jar',
  '.vbs',
  '.scr',
  '.hta',
  '.dll',
  '.com',
];

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
  @IsNumber()
  @Min(1, { message: 'File size must be greater than 0' })
  @Max(25 * 1024 * 1024, { message: 'File size cannot exceed 25MB' }) // 25 MB max limit
  fileSize?: number;

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
