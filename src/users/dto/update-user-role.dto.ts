import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(UserRole, { message: 'Role must be CLIENT, TEAM_MEMBER, or ADMIN' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;
}
