import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryCategoryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  includeInactive?: boolean = false;
}
