import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { QuoteRequestsService } from './quote-requests.service.js';
import { CreateQuoteRequestDto } from './dto/create-quote-request.dto.js';
import { UpdateQuoteRequestStatusDto } from './dto/update-quote-request-status.dto.js';
import { QueryQuoteRequestsDto } from './dto/query-quote-requests.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('quote-requests')
export class QuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  /**
   * Client or Guest submits requirement brief / inquiry
   * (Public rate-limited: Max 10 requests per minute)
   */
  @Post()
  @UseGuards(OptionalAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body() createDto: CreateQuoteRequestDto,
  ) {
    const clientId = user?.id || null;
    return this.quoteRequestsService.create(clientId, createDto);
  }

  /**
   * Client views their own requirement briefs
   */
  @Get('my')
  @UseGuards(AuthGuard)
  async findMyRequests(
    @CurrentUser() user: any,
    @Query() query: QueryQuoteRequestsDto,
  ) {
    return this.quoteRequestsService.findMyRequests(user.id, query);
  }

  /**
   * Admin views all submitted requirement briefs / inquiries
   */
  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(@Query() query: QueryQuoteRequestsDto) {
    return this.quoteRequestsService.findAll(query);
  }

  /**
   * View single requirement brief details (Owner Client or Admin)
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quoteRequestsService.findOne(id, user);
  }

  /**
   * Client cancels their own requirement brief
   */
  @Patch(':id/cancel')
  @UseGuards(AuthGuard)
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quoteRequestsService.cancel(id, user.id);
  }

  /**
   * Admin updates requirement brief status
   */
  @Patch(':id/status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateQuoteRequestStatusDto,
  ) {
    return this.quoteRequestsService.updateStatus(id, updateDto);
  }
}
