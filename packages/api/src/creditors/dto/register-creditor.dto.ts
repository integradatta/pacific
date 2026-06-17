import { IsString, MinLength } from 'class-validator';

// Identidade (supabaseId, email) NÃO vem do body — é derivada do JWT verificado.
export class RegisterCreditorDto {
  @IsString() @MinLength(2) orgName!: string;
}
