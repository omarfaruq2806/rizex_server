import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeliverableFileItemDto {
  @IsString()
  @IsNotEmpty({ message: 'File name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'File URL is required' })
  url: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsOptional()
  size?: number;
}

/**
 * Data Transfer Object for Worker or Admin submitting completed deliverables
 */
export class SubmitDeliveryDto {
  @IsString()
  @IsOptional()
  message?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DeliverableFileItemDto)
  files?: DeliverableFileItemDto[];
}
