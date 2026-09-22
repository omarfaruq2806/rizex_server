import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for Admin creating a custom Quote for a client's request
 */
export class CreateQuoteDto {
  @IsString()
  @IsNotEmpty({ message: 'Quote Request ID is required' })
  requestId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Total amount must be greater than or equal to 0' })
  @Type(() => Number)
  amount: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Advance amount must be greater than or equal to 0' })
  @IsOptional()
  @Type(() => Number)
  advanceAmount?: number = 0;

  @IsString()
  @IsOptional()
  currency?: string = 'BDT';

  @IsInt()
  @Min(1, { message: 'Estimated days must be at least 1 day' })
  @IsOptional()
  @Type(() => Number)
  estimatedDays?: number;

  @IsInt()
  @Min(0, { message: 'Revisions count cannot be negative' })
  @IsOptional()
  @Type(() => Number)
  revisions?: number = 0;

  @IsArray()
  @IsOptional()
  includedItems?: string[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  sendImmediately?: boolean = false;
}
