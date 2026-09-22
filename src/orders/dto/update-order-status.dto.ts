import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

/**
 * Data Transfer Object for updating an Order's lifecycle status
 */
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, {
    message: `status must be one of: ${Object.values(OrderStatus).join(', ')}`,
  })
  @IsNotEmpty({ message: 'status is required' })
  status: OrderStatus;

  @IsString()
  @IsOptional()
  note?: string;
}
