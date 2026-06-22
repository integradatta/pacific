import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AlertType, Schedule } from '@pacific/geo-shared';

export class LatLngDto {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
}

export class CreateGeofenceDto {
  @IsString() @MinLength(1) name!: string;
  @ValidateNested() @Type(() => LatLngDto) center!: LatLngDto;
  @IsNumber() @Min(100) @Max(5000) radiusMeters!: number;
  @IsIn(['on_enter', 'on_exit', 'both']) alertType!: AlertType;
  @IsOptional() @IsArray() @IsString({ each: true }) monitoredMembers?: string[];
  // schedule validado livremente (jsonb); shape conferido em runtime pela lógica de isWithinSchedule.
  @IsOptional() schedule?: Schedule | null;
}
