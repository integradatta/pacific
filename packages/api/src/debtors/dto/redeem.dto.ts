import { IsString, Matches } from 'class-validator';
import { ORG_CODE_REGEX } from '@pacific/shared';
export class RedeemDto {
  @IsString() @Matches(ORG_CODE_REGEX, { message: 'Código inválido' }) orgCode!: string;
}
