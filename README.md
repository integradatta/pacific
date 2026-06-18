# Pacific

Pacific é uma plataforma SaaS multi-tenant de monitoramento e gestão de empréstimos privados. O objetivo é oferecer a credores (pessoas físicas ou jurídicas) uma ferramenta centralizada para acompanhar carteiras de crédito, registrar devedores e monitorar o status dos vínculos — sem caráter de cobrança automatizada. Trata-se de um projeto acadêmico fictício desenvolvido para fins de aprendizado e demonstração de arquitetura.

---

## Arquitetura

Monorepo gerenciado com **Turborepo**, composto por três pacotes principais:

| Pacote | Descrição |
|---|---|
| `packages/shared` | Tipos, utilitários e contratos compartilhados (ex.: `generateOrgCode`, tipos de autenticação) |
| `packages/database` | Schema Prisma, migrações e cliente PostgreSQL/Supabase |
| `packages/api` | Aplicação NestJS — módulos de autenticação, tenants, usuários e devedores |

A plataforma opera com três papéis de usuário:

- **super-admin** — administrador geral da plataforma
- **credor (tenant)** — empresa ou pessoa que gerencia uma carteira; cada credor é um tenant isolado
- **devedor** — usuário vinculado a um tenant pelo `orgCode`

O isolamento de dados é garantido por `tenantId` em todas as entidades relevantes, por uma camada de serviços tenant-scoped na API e por políticas de **Row Level Security (RLS)** aplicadas diretamente no banco.

---

## Onboarding

1. O credor cria uma conta → o sistema gera automaticamente um `orgCode` único para o tenant.
2. O devedor cria sua própria conta e informa o `orgCode` do credor.
3. O vínculo ao tenant é estabelecido automaticamente — sem necessidade de pré-cadastro pelo credor.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Web (fases futuras) | Next.js 14 |
| Mobile (futuro) | Expo (React Native) |
| API | NestJS |
| ORM / Migrações | Prisma |
| Banco de dados | PostgreSQL via Supabase |
| Orquestração de monorepo | Turborepo |

---

## Pré-requisitos

- **Node.js** 20+
- **npm**
- **Docker** (para PostgreSQL + Redis local) **ou** uma instância Supabase

---

## Setup

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure as variáveis de ambiente:
   ```bash
   cp .env.example packages/database/.env
   ```
   Edite `packages/database/.env` e preencha `DATABASE_URL` com a string de conexão do PostgreSQL local (Docker) ou do Supabase.

3. Suba os serviços locais (Postgres + Redis):
   ```bash
   docker compose up -d
   ```

4. Aplique a migração inicial:
   ```bash
   npm run db:migrate   # desenvolvimento
   # ou
   npm run db:deploy    # produção / CI
   ```
   Isso executa a migração `0_init` contra o banco configurado.

5. Popule dados de exemplo:
   ```bash
   npm run db:seed
   ```
   O comando imprime o `orgCode` da carteira demo ao final.

6. Aplique as políticas de RLS **por último** (a RLS com `WITH CHECK` bloquearia os inserts do seed, que roda sem contexto de tenant):
   ```bash
   psql "$DATABASE_URL" -f packages/database/src/rls.sql
   ```
   Ou cole o conteúdo de `packages/database/src/rls.sql` no SQL Editor do Supabase. A API define o tenant por request (`set_config` dentro de uma transação, via `TenantScopedService.withTenant`), então as queries continuam funcionando com a RLS ativa.

---

## Testes

```bash
npm test       # executa vitest em packages/shared e packages/api
npm run lint   # lint em todos os workspaces (inclui validação do schema Prisma)
```

---

## Notas

- **Localização:** o módulo de localização **não está implementado** nesta fase. Existem apenas pontos de extensão — o namespace `@pacific/shared/location` e `LocationModule.register` — preparados para fases futuras. Consulte `docs/superpowers/specs/2026-06-16-pacific-design.md` para detalhes.
- **Variáveis de ambiente:** veja `.env.example` na raiz do repositório para a lista completa de variáveis necessárias.
