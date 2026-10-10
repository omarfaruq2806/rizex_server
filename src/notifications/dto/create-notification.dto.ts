import { IsString, IsOptional, IsEnum } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
