import { Injectable, Optional } from '@nestjs/common';
import jwt from 'jsonwebtoken';

@Injectable()
export class DebtorTokenService {
  // @Optional: o Nest injeta undefined (não há provider de string); cai no APP_JWT_SECRET.
  // Em teste, instancia-se com `new DebtorTokenService('segredo')`.
  constructor(@Optional() private readonly secret?: string) {}

  sign(
    params: { debtorId: string; tenantId: string; accessVersion?: number },
    expiresIn: jwt.SignOptions['expiresIn'] = '12h',
  ): string {
    const secret = this.secret ?? process.env.APP_JWT_SECRET ?? '';
    return jwt.sign(
      {
        sub: params.debtorId,
        // av = versão do link (DebtorAccess.rotatedAt em ms). Ao rotacionar, o guard rejeita o token antigo.
        app_metadata: { role: 'DEBTOR', tenantId: params.tenantId, debtorId: params.debtorId, av: params.accessVersion ?? 0 },
      },
      secret,
      { expiresIn, algorithm: 'HS256' },
    );
  }
}
