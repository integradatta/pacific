import { Logger } from '@nestjs/common';

// Abstração da administração de auth (Supabase). O super-admin NÃO vê senhas (hash, irrecuperável);
// dispara RESET. SupabaseAuthAdmin chama o endpoint de recovery; NoopAuthAdmin loga (dev/test).
export interface AuthAdmin {
  sendPasswordReset(email: string): Promise<void>;
  /** Bloqueia/desbloqueia (ban) o usuário no Supabase — impede novos logins/refresh.
   *  Efetivo como "force logout": o access token atual expira no TTL (~1h) e não renova. */
  setBlocked(supabaseId: string, blocked: boolean): Promise<void>;
  /** Remove o usuário do Supabase Auth (ao excluir um credor). */
  deleteUser(supabaseId: string): Promise<void>;
}
export const AUTH_ADMIN = Symbol('AUTH_ADMIN');

export class NoopAuthAdmin implements AuthAdmin {
  private readonly log = new Logger('NoopAuthAdmin');
  async sendPasswordReset(email: string): Promise<void> {
    this.log.debug(`(noop) reset de senha para ${email}`);
  }
  async setBlocked(supabaseId: string, blocked: boolean): Promise<void> {
    this.log.debug(`(noop) ${blocked ? 'bloquear' : 'desbloquear'} ${supabaseId}`);
  }
  async deleteUser(supabaseId: string): Promise<void> {
    this.log.debug(`(noop) excluir usuário ${supabaseId}`);
  }
}

export class SupabaseAuthAdmin implements AuthAdmin {
  private cfg(): { url: string; key: string } {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    return { url, key };
  }

  /** fetch com timeout (não pendura o request se o Supabase admin demorar). */
  private async req(input: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async sendPasswordReset(email: string): Promise<void> {
    const { url, key } = this.cfg();
    const res = await this.req(`${url}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`Falha ao enviar reset (${res.status})`);
  }

  async setBlocked(supabaseId: string, blocked: boolean): Promise<void> {
    const { url, key } = this.cfg();
    // ban_duration "none" desbloqueia; um valor longo bloqueia (admin API do GoTrue).
    const res = await this.req(`${url}/auth/v1/admin/users/${supabaseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ban_duration: blocked ? '876000h' : 'none' }),
    });
    if (!res.ok) throw new Error(`Falha ao ${blocked ? 'bloquear' : 'desbloquear'} (${res.status})`);
  }

  async deleteUser(supabaseId: string): Promise<void> {
    const { url, key } = this.cfg();
    const res = await this.req(`${url}/auth/v1/admin/users/${supabaseId}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`Falha ao excluir usuário (${res.status})`);
  }
}

export function createAuthAdmin(): AuthAdmin {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? new SupabaseAuthAdmin() : new NoopAuthAdmin();
}
