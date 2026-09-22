import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object for Admin removing a team member from an Order
 */
export class UnassignMemberDto {
  @IsString()
  @IsNotEmpty({ message: 'memberId (Team Member User ID) is required' })
  memberId: string;
}
