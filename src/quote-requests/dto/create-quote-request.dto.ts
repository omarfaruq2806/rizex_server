import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RequirementValueItemDto {
  @IsString()
  @IsNotEmpty({ message: 'fieldId is required' })
  fieldId: string;

  @IsOptional()
  value?: any;
}

export class CreateQuoteRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'serviceId is required' })
  serviceId: string;

  @IsString()
  @IsOptional()
  projectName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Guest inquiry fields
  @IsString()
  @IsOptional()
  guestName?: string;

  @IsString()
  @IsOptional()
  guestEmail?: string;

  @IsString()
  @IsOptional()
  guestPhone?: string;

  @IsString()
  @IsOptional()
  budget?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RequirementValueItemDto)
  requirements?: RequirementValueItemDto[] = [];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RequirementValueItemDto)
  requirementValues?: RequirementValueItemDto[] = [];
}
