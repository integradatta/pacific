-- ── Aceite único do PADRINHO (credor): termos de responsabilidade + aviso legal ──────────────
-- Unificado numa tela só (/termos). Null = ainda não aceitou → o gate manda para /termos no
-- primeiro acesso. Só CREDITOR vê a tela; OWNER/SUPER_ADMIN/DEBTOR nunca. Colunas aditivas e
-- nuláveis: registros existentes ficam NULL e serão solicitados a aceitar no próximo login.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
