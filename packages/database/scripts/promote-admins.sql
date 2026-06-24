-- ─────────────────────────────────────────────────────────────────────────────
-- Pacific · Bootstrap de administradores (rodar no SQL Editor do Supabase)
--
-- OWNER       = Admin Supremo (pode revogar super-admins). Crie 1.
-- SUPER_ADMIN = Admin 1 (revogável pelo OWNER). Crie quantos quiser.
--
-- Para um admin NOVO (sem conta): Authentication → Users → Add user (e-mail + senha,
-- marque "Auto Confirm User") e copie o User UID. Cole no v_uid abaixo.
-- Para um usuário que JÁ existe (ex.: já se cadastrou): o UID é ignorado, atualiza por e-mail.
-- ─────────────────────────────────────────────────────────────────────────────

-- ===== 1) OWNER (Admin Supremo) =====
do $$
declare
  v_uid   text := 'COLE_O_UID_DO_OWNER';
  v_email text := 'dono@seudominio.com';
  v_role  "UserRole" := 'OWNER';
begin
  if exists (select 1 from "User" where email = v_email) then
    update "User" set role = v_role, "tenantId" = null where email = v_email;
  else
    insert into "User"(id, "supabaseId", email, role)
      values (gen_random_uuid(), v_uid, v_email, v_role);
  end if;
end $$;

-- ===== 2) SUPER_ADMIN (Admin 1) — duplique este bloco p/ cada admin =====
do $$
declare
  v_uid   text := 'COLE_O_UID_DO_ADMIN';
  v_email text := 'admin@seudominio.com';
  v_role  "UserRole" := 'SUPER_ADMIN';
begin
  if exists (select 1 from "User" where email = v_email) then
    update "User" set role = v_role, "tenantId" = null where email = v_email;
  else
    insert into "User"(id, "supabaseId", email, role)
      values (gen_random_uuid(), v_uid, v_email, v_role);
  end if;
end $$;

-- ===== 3) Conferir =====
select email, role, "tenantId", "createdAt"
from "User"
where role in ('OWNER', 'SUPER_ADMIN')
order by role, "createdAt";
