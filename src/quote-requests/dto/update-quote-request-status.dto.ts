import { IsEnum, IsNotEmpty } from 'class-validator';
import { QuoteRequestStatus } from '@prisma/client';

export class UpdateQuoteRequestStatusDto {
  @IsEnum(QuoteRequestStatus, {
    message: `status must be one of: ${Object.values(QuoteRequestStatus).join(', ')}`,
  })
  @IsNotEmpty({ message: 'status is required' })
  status: QuoteRequestStatus;
}
