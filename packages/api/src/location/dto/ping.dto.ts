import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

// Posição enviada pelo PRÓPRIO devedor (app nativo, APIs oficiais de GPS do SO).
export interface PingInput {
  lat: number;
  lng: number;
  accuracy?: number;
  battery?: number;
}

export class PingDto implements PingInput {
  @IsNumber() @Min(-90) @Max(90) lat!: number;
  @IsNumber() @Min(-180) @Max(180) lng!: number;
  @IsOptional() @IsNumber() @Min(0) accuracy?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) battery?: number;
}
