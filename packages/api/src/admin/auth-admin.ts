import { Logger } from '@nestjs/common';

// Abstração da administração de auth (Supabase). O super-admin NÃO vê senhas (hash, irrecuperável);
// dispara RESET. SupabaseAuthAdmin chama o endpoint de recovery; NoopAuthAdmin loga (dev/test).
export interface AuthAdmin {
  sendPasswordReset(email: string): Promise<void>;
}
export const AUTH_ADMIN = Symbol('AUTH_ADMIN');

export class NoopAuthAdmin implements AuthAdmin {
  private readonly log = new Logger('NoopAuthAdmin');
  async sendPasswordReset(email: string): Promise<void> {
    this.log.debug(`(noop) reset de senha para ${email}`);
  }
}

export class SupabaseAuthAdmin implements AuthAdmin {
  async sendPasswordReset(email: string): Promise<void> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    const res = await fetch(`${url}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`Falha ao enviar reset (${res.status})`);
  }
}

export function createAuthAdmin(): AuthAdmin {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseAuthAdmin() : new NoopAuthAdmin();
}
