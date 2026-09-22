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

  @IsNotEmpty({ message: 'value is required' })
  value: any;
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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RequirementValueItemDto)
  requirements?: RequirementValueItemDto[] = [];
}
