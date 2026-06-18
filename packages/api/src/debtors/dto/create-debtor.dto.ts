import { IsString, MinLength } from 'class-validator';

export class CreateDebtorDto {
  @IsString() @MinLength(1) name!: string;
}
