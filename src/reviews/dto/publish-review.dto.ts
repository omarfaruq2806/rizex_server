import { IsBoolean } from 'class-validator';

/**
 * DTO for Admin publishing or unpublishing a review
 */
export class PublishReviewDto {
  @IsBoolean({ message: 'isPublished must be a boolean value' })
  isPublished: boolean;
}
