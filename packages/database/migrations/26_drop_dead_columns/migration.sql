-- Limpeza de colunas mortas: Debt.status nunca era atualizada (ficava sempre GREEN) e o status é
-- derivado em runtime (deriveStatus); Debtor.lastLocation era um ponto de extensão inerte (ninguém
-- lê/grava). Remove ambas + o enum DebtStatus (sem mais uso).

ALTER TABLE "Debt" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Debtor" DROP COLUMN IF EXISTS "lastLocation";
DROP TYPE IF EXISTS "DebtStatus";
