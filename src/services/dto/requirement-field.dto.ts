import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsArray,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequirementFieldType } from '@prisma/client';

export class CreateRequirementFieldDto {
  @IsString()
  @IsNotEmpty({ message: 'Field label is required' })
  label: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Field name must be alphanumeric and contain only letters, numbers, and underscores',
  })
  name?: string;

  @IsEnum(RequirementFieldType, {
    message: `type must be one of: ${Object.values(RequirementFieldType).join(', ')}`,
  })
  type: RequirementFieldType;

  @IsString()
  @IsOptional()
  placeholder?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isRequired?: boolean = false;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean = true;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number = 0;

  @IsOptional()
  options?: any;
}

export class UpdateRequirementFieldDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Field name must be alphanumeric and contain only letters, numbers, and underscores',
  })
  name?: string;

  @IsEnum(RequirementFieldType)
  @IsOptional()
  type?: RequirementFieldType;

  @IsString()
  @IsOptional()
  placeholder?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  options?: any;
}

export class ReorderFieldsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ message: 'fieldIds array is required' })
  fieldIds: string[];
}
