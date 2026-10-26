import {
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class UpdateOrderPaymentDto {
  @IsNumber()
  @IsNotEmpty({ message: 'Paid amount is required' })
  @Min(0, { message: 'Paid amount must be at least 0' })
  paidAmount: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod = PaymentMethod.MANUAL;

  @IsString()
  @IsOptional()
  transactionId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
