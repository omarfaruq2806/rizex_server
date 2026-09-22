import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OrdersService } from './orders.service.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { UpdateOrderProgressDto } from './dto/update-order-progress.dto.js';
import { QueryOrdersDto } from './dto/query-orders.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Client views their own orders
   */
  @Get('my')
  async findMyOrders(
    @CurrentUser() user: any,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findMyOrders(user.id, query);
  }

  /**
   * Team Member views orders assigned to them
   */
  @Get('assigned')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEAM_MEMBER, UserRole.ADMIN)
  async findAssignedOrders(
    @CurrentUser() user: any,
    @Query() query: QueryOrdersDto,
  ) {
    return this.ordersService.findAssignedOrders(user.id, query);
  }

  /**
   * Admin views overall orders metrics and counts
   */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getOrderStats() {
    return this.ordersService.getOrderStats();
  }

  /**
   * Admin views all client orders across the platform
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  /**
   * View single order details by ID or Order Number (RZ-YYMM-XXXX)
   */
  @Get(':idOrOrderNumber')
  async findOne(
    @Param('idOrOrderNumber') idOrOrderNumber: string,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.findOne(idOrOrderNumber, user);
  }

  /**
   * Update Order status (Admin or Assigned Team Member)
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEAM_MEMBER)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, updateDto, user);
  }

  /**
   * Update Order progress percentage (Admin or Assigned Team Member)
   */
  @Patch(':id/progress')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEAM_MEMBER)
  async updateProgress(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderProgressDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateProgress(id, updateDto, user);
  }
}
