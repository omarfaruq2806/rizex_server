import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Data Transfer Object for Client requesting changes/revisions on submitted work
 */
export class RequestRevisionDto {
  @IsString()
  @IsNotEmpty({ message: 'Revision reason is required' })
  reason: string;

  @IsString()
  @IsNotEmpty({ message: 'Detailed description of changes is required' })
  description: string;

  @IsString()
  @IsOptional()
  section?: string;
}
