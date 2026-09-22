import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for Admin editing a draft Quote
 */
export class UpdateQuoteDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Total amount must be greater than or equal to 0' })
  @IsOptional()
  @Type(() => Number)
  amount?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Advance amount must be greater than or equal to 0' })
  @IsOptional()
  @Type(() => Number)
  advanceAmount?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @Min(1, { message: 'Estimated days must be at least 1 day' })
  @IsOptional()
  @Type(() => Number)
  estimatedDays?: number;

  @IsInt()
  @Min(0, { message: 'Revisions count cannot be negative' })
  @IsOptional()
  @Type(() => Number)
  revisions?: number;

  @IsArray()
  @IsOptional()
  includedItems?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
