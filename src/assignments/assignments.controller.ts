import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AssignmentsService } from './assignments.service.js';
import { AssignMemberDto } from './dto/assign-member.dto.js';
import { UnassignMemberDto } from './dto/unassign-member.dto.js';
import { QueryTeamMembersDto } from './dto/query-team.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller()
@UseGuards(AuthGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * Admin lists all team members and their active project workload
   */
  @Get('team-members')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getTeamMembers(@Query() query: QueryTeamMembersDto) {
    return this.assignmentsService.getTeamMembers(query);
  }

  /**
   * Admin assigns a team member to an order
   */
  @Post('orders/:orderId/assign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async assignMember(
    @Param('orderId') orderId: string,
    @Body() dto: AssignMemberDto,
    @CurrentUser() admin: any,
  ) {
    return this.assignmentsService.assignMember(orderId, dto, admin.id);
  }

  /**
   * Admin unassigns a team member from an order
   */
  @Post('orders/:orderId/unassign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async unassignMember(
    @Param('orderId') orderId: string,
    @Body() dto: UnassignMemberDto,
    @CurrentUser() admin: any,
  ) {
    return this.assignmentsService.unassignMember(orderId, dto, admin.id);
  }

  /**
   * View all assignments (active and previous) for an order
   */
  @Get('orders/:orderId/assignments')
  async getOrderAssignments(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
  ) {
    return this.assignmentsService.getOrderAssignments(orderId, user);
  }
}
