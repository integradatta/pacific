import { apiGet } from './api';

export interface Me {
  role: string;
  tenantId: string | null;
  approved: boolean;
  termsAccepted: boolean; // padrinho que ainda não aceitou termos+aviso legal → /termos
}

/**
 * Destino pós-login por papel — fonte única da verdade (login e auto-redirect usam isto).
 * OWNER/SUPER_ADMIN → painel; credor sem carteira → concluir cadastro; pendente → análise;
 * credor aprovado sem aceite → /termos; senão → dashboard. O devedor (DEBTOR) não passa
 * por aqui: entra por /d/[token]. `termsAccepted` vem true p/ não-credores (não veem a tela).
 */
export function pathForMe(me: Me): string {
  if (me.role === 'SUPER_ADMIN' || me.role === 'OWNER') return '/admin';
  if (!me.tenantId) return '/register';
  if (!me.approved) return '/pendente';
  if (!me.termsAccepted) return '/termos';
  return '/dashboard';
}

/**
 * Busca /auth/me com algumas tentativas — uma falha transitória de rede não deve
 * misroutar (ex.: jogar um admin no dashboard de credor). Em falha persistente, propaga o erro
 * para o chamador decidir (mostrar mensagem em vez de redirecionar para o lugar errado).
 */
export async function fetchMe(retries = 2): Promise<Me> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiGet<Me>('/auth/me');
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}
