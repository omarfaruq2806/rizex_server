import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { PublishReviewDto } from './dto/publish-review.dto.js';
import { QueryReviewsDto } from './dto/query-reviews.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ==========================================
  // PUBLIC ENDPOINTS
  // ==========================================

  /**
   * Public: Get top/featured published reviews for homepage
   */
  @Get('reviews/featured')
  async getFeaturedReviews(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 6;
    return this.reviewsService.getFeaturedReviews(parsedLimit);
  }

  /**
   * Public: Get reviews for a specific service catalog item
   */
  @Get('reviews/service/:serviceId')
  async getPublicServiceReviews(
    @Param('serviceId') serviceId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.reviewsService.getPublicServiceReviews(
      serviceId,
      parsedPage,
      parsedLimit,
    );
  }

  // ==========================================
  // CLIENT / ORDER REVIEW ENDPOINTS
  // ==========================================

  /**
   * Client: Submit review for a completed order
   */
  @Post('orders/:orderId/review')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitReview(
    @Param('orderId') orderId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: any,
  ) {
    return this.reviewsService.submitReview(orderId, user.id, dto);
  }

  /**
   * Get review for a specific order
   */
  @Get('orders/:orderId/review')
  @UseGuards(AuthGuard)
  async getOrderReview(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
  ) {
    return this.reviewsService.getOrderReview(orderId, user);
  }

  // ==========================================
  // ADMIN MODERATION ENDPOINTS
  // ==========================================

  /**
   * Admin: List all platform reviews with search and filter
   */
  @Get('admin/reviews')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAllReviewsAdmin(@Query() query: QueryReviewsDto) {
    return this.reviewsService.getAllReviewsAdmin(query);
  }

  /**
   * Admin: Publish or unpublish/hide a review
   */
  @Patch('admin/reviews/:id/publish')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updatePublishStatus(
    @Param('id') id: string,
    @Body() dto: PublishReviewDto,
  ) {
    return this.reviewsService.updatePublishStatus(id, dto.isPublished);
  }

  /**
   * Admin: Delete a review
   */
  @Delete('admin/reviews/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteReview(@Param('id') id: string) {
    return this.reviewsService.deleteReview(id);
  }
}
