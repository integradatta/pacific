-- Papel OWNER (admin supremo / proprietário) — superconjunto do SUPER_ADMIN. Aditivo e idempotente.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OWNER';
