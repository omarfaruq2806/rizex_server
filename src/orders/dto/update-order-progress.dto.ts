import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for updating an Order's completion progress percentage (0 - 100%)
 */
export class UpdateOrderProgressDto {
  @IsInt({ message: 'Progress must be an integer percentage' })
  @Min(0, { message: 'Progress cannot be less than 0%' })
  @Max(100, { message: 'Progress cannot exceed 100%' })
  @Type(() => Number)
  progress: number;
}
