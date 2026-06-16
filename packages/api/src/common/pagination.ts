import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  offset = 0;
}

export interface Page<T> { items: T[]; total: number; limit: number; offset: number; }
