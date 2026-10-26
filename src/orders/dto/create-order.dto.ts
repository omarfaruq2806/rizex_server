import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Service ID is required' })
  serviceId: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  // If client is new (creates or links automatically)
  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientEmail?: string;

  @IsString()
  @IsOptional()
  clientPhone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Order title is required' })
  title: string;

  @IsNumber()
  @Min(0, { message: 'Total amount must be greater than or equal to 0' })
  totalAmount: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  paidAmount?: number = 0;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus = OrderStatus.CONFIRMED;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsDateString()
  @IsOptional()
  expectedDelivery?: string;

  @IsString()
  @IsOptional()
  deliveryUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  quoteId?: string;

  @IsString()
  @IsOptional()
  inquiryId?: string;
}
