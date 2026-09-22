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
import { UserRole } from '@prisma/client';
import { QuotesService } from './quotes.service.js';
import { CreateQuoteDto } from './dto/create-quote.dto.js';
import { UpdateQuoteDto } from './dto/update-quote.dto.js';
import { RequestQuoteChangesDto } from './dto/request-changes.dto.js';
import { QueryQuotesDto } from './dto/query-quotes.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('quotes')
@UseGuards(AuthGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  /**
   * Admin creates a custom quote for a requirement brief
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async createQuote(
    @CurrentUser() user: any,
    @Body() createDto: CreateQuoteDto,
  ) {
    return this.quotesService.createQuote(user.id, createDto);
  }

  /**
   * Admin lists all quotes with cursor pagination and status filters
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(@Query() query: QueryQuotesDto) {
    return this.quotesService.findAll(query);
  }

  /**
   * View single quote details (Accessible by Owner Client or Admin)
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.findOne(id, user);
  }

  /**
   * Admin updates a draft quote
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateQuote(
    @Param('id') id: string,
    @Body() updateDto: UpdateQuoteDto,
  ) {
    return this.quotesService.updateQuote(id, updateDto);
  }

  /**
   * Admin sends the draft quote to client
   */
  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async sendQuote(@Param('id') id: string) {
    return this.quotesService.sendQuote(id);
  }

  /**
   * Client accepts quote -> Converts automatically into active Order
   */
  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async acceptQuote(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.acceptQuote(id, user.id);
  }

  /**
   * Client requests modifications to the quote
   */
  @Post(':id/request-changes')
  @HttpCode(HttpStatus.OK)
  async requestChanges(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RequestQuoteChangesDto,
  ) {
    return this.quotesService.requestChanges(id, user.id, dto);
  }

  /**
   * Client rejects the quote
   */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectQuote(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.rejectQuote(id, user.id);
  }
}
