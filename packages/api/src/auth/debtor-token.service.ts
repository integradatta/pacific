import { Injectable, Optional } from '@nestjs/common';
import jwt from 'jsonwebtoken';

@Injectable()
export class DebtorTokenService {
  // @Optional: o Nest injeta undefined (não há provider de string); cai no APP_JWT_SECRET.
  // Em teste, instancia-se com `new DebtorTokenService('segredo')`.
  constructor(@Optional() private readonly secret?: string) {}

  sign(
    params: { debtorId: string; tenantId: string },
    expiresIn: jwt.SignOptions['expiresIn'] = '12h',
  ): string {
    const secret = this.secret ?? process.env.APP_JWT_SECRET ?? '';
    return jwt.sign(
      {
        sub: params.debtorId,
        app_metadata: { role: 'DEBTOR', tenantId: params.tenantId, debtorId: params.debtorId },
      },
      secret,
      { expiresIn },
    );
  }
}
