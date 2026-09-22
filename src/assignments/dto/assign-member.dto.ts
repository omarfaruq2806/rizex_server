import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object for Admin assigning a team member to an Order
 */
export class AssignMemberDto {
  @IsString()
  @IsNotEmpty({ message: 'memberId (Team Member User ID) is required' })
  memberId: string;
}
