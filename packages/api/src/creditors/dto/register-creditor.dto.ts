import { IsEmail, IsString, MinLength } from 'class-validator';
export class RegisterCreditorDto {
  @IsString() @MinLength(2) orgName!: string;
  @IsString() supabaseId!: string;
  @IsEmail() email!: string;
}
