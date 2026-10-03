import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { AuthGuard } from '../common/guards/auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Platform user stats & role breakdown
   */
  @Get('stats')
  async getStats() {
    return this.usersService.getStats();
  }

  /**
   * Admin lists all platform users with role filter and search
   */
  @Get()
  async getUsers(@Query() query: QueryUsersDto) {
    return this.usersService.getUsers(query);
  }

  /**
   * Get single user detailed profile
   */
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  /**
   * Update a user's role (CLIENT, TEAM_MEMBER, ADMIN)
   */
  @Patch(':id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: any,
  ) {
    return this.usersService.updateUserRole(id, dto, admin.id);
  }

  /**
   * Delete a user account
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @Param('id') id: string,
    @CurrentUser() admin: any,
  ) {
    return this.usersService.deleteUser(id, admin.id);
  }
}
