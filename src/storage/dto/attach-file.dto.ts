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
 * DTO for recording uploaded file metadata to an order
 */
export class AttachOrderFileDto {
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Storage key is required' })
  key: string;

  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  url: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  size?: number;

  @IsOptional()
  @IsEnum(FileCategory, { message: 'Invalid file category' })
  category?: FileCategory = FileCategory.OTHER;
}
