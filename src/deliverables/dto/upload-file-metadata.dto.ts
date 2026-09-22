import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FileCategory } from '@prisma/client';

/**
 * Data Transfer Object for recording file metadata attached to an Order
 */
export class UploadFileMetadataDto {
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  url: string;

  @IsString()
  @IsOptional()
  key?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  size?: number;

  @IsEnum(FileCategory)
  @IsOptional()
  category?: FileCategory = FileCategory.OTHER;
}
