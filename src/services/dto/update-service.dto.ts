import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  showPrice?: boolean;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  startingPrice?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
