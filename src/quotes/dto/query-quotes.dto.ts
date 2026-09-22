import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { QuoteStatus } from '@prisma/client';

/**
 * Data Transfer Object for filtering and paginating Quotes
 */
export class QueryQuotesDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}
