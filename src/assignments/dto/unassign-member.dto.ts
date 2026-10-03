import { IsString, IsOptional } from 'class-validator';

/**
 * Data Transfer Object for Admin removing a team member from an Order
 */
export class UnassignMemberDto {
  @IsString()
  @IsOptional()
  memberId?: string;
}
