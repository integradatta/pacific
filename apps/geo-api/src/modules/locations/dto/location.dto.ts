import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { LocationSource } from '@pacific/geo-shared';

export class LocationPointDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsNumber() @Min(0) accuracy_meters!: number;
  @IsOptional() @IsNumber() altitude_meters?: number;
  @IsOptional() @IsNumber() speed_mps?: number;
  @IsOptional() @IsNumber() heading_degrees?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) battery_level?: number;
  @IsIn(['gps', 'network', 'fused']) source!: LocationSource;
  @IsISO8601() timestamp!: string;
}

export class IngestLocationDto extends LocationPointDto {
  @IsString() device_id!: string;
}

export class BatchLocationDto {
  @IsString() device_id!: string;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => LocationPointDto) points!: LocationPointDto[];
}
