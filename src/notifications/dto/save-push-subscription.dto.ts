import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SavePushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class DeletePushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}
