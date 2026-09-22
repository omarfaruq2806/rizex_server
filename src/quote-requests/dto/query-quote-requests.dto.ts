import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { QuoteRequestStatus } from '@prisma/client';

export class QueryQuoteRequestsDto {
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
  @IsEnum(QuoteRequestStatus)
  status?: QuoteRequestStatus;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
