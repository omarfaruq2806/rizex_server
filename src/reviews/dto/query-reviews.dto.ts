import { IsOptional, IsInt, Min, Max, IsBooleanString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for querying and filtering reviews in admin panel
 */
export class QueryReviewsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsBooleanString()
  isPublished?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating?: number;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
