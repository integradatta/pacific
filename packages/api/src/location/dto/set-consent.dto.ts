import { IsBoolean } from 'class-validator';

export class SetConsentDto {
  // true = concede o compartilhamento (GRANTED); false = revoga (REVOKED).
  @IsBoolean() granted!: boolean;
}
