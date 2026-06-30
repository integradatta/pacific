import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class SetConsentDto {
  @IsIn(['GRANTED', 'DECLINED', 'REVOKED']) state!: 'GRANTED' | 'DECLINED' | 'REVOKED';
  @IsOptional() @IsString() @MaxLength(2000) consentText?: string;
}

export class PingPointDto {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100000) accuracy?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) battery?: number;
  @IsISO8601() recordedAt!: string;
}
export class PingDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => PingPointDto) points!: PingPointDto[];
}

export class GeofenceDto {
  @IsString() @MinLength(1) @MaxLength(80) label!: string;
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsNumber() @Min(10) @Max(50000) radiusM!: number;
}
