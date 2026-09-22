import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Data Transfer Object for Client requesting modifications to a Quote
 */
export class RequestQuoteChangesDto {
  @IsString()
  @IsNotEmpty({ message: 'Notes explaining requested changes are required' })
  notes: string;
}
