import { IsInt, Min, Max, IsString, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for submitting a client review after project completion
 */
export class CreateReviewDto {
  @IsInt({ message: 'Rating must be an integer between 1 and 5' })
  @Min(1, { message: 'Rating must be at least 1 star' })
  @Max(5, { message: 'Rating cannot exceed 5 stars' })
  @Type(() => Number)
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Comment cannot exceed 1000 characters' })
  comment?: string;
}
