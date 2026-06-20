# Pacific — API (NestJS) a partir da raiz do monorepo.
# Alvo de deploy: Railway / Render. O build context deve ser a RAIZ do repositório.
#
# Por que single-stage: o monorepo usa workspaces npm e o CMD roda `prisma migrate deploy`
# (CLI do Prisma, uma devDependency), então mantemos node_modules completo na imagem.
FROM node:20-slim

# OpenSSL: o engine do Prisma depende dele. ca-certificates: TLS até o Supabase.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia o repo (o .dockerignore exclui node_modules/.env/.git/.next/dist) e instala TUDO
# (precisamos de devDeps: nest-cli, tsc e o CLI do Prisma usado em runtime pelas migrations).
COPY . .
# --include=dev: garante nest-cli/tsc/prisma mesmo se NODE_ENV=production estiver setado no build.
RUN npm ci --include=dev --no-audit --no-fund

# 1) Gera o Prisma Client com o engine compilado para ESTE Linux (URLs dummy: generate não conecta).
RUN DATABASE_URL="postgresql://u:p@localhost:5432/db" DIRECT_URL="postgresql://u:p@localhost:5432/db" \
    npm run db:generate -w @pacific/database

# 2) Compila @pacific/shared para JS (a API usa funções dele em runtime).
RUN npm run build -w @pacific/shared

# 3) Build da API (nest/tsc; emite metadata de decorators p/ a injeção de dependência do Nest).
#    Resolve os TYPES de @pacific/shared e @pacific/database direto do código-fonte, como no dev local.
RUN npm run build -w @pacific/api

# 4) Torna os pacotes do workspace importáveis pelo Node em RUNTIME.
#    O `main` versionado aponta para .ts (necessário p/ Vercel/local); aqui apontamos para o JS
#    compilado SEM alterar os arquivos versionados — a mudança vive só dentro da imagem.
RUN node -e "const f='packages/shared/package.json',p=require('./'+f);p.main='./dist/index.js';p.types='./dist/index.d.ts';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"
# @pacific/database é um re-export fino do @prisma/client; geramos um shim ESM com interop CJS robusto.
RUN mkdir -p packages/database/dist \
 && printf '%s\n' \
    "import _prisma from '@prisma/client';" \
    "export const PrismaClient = _prisma.PrismaClient;" \
    "export const Prisma = _prisma.Prisma;" \
    "export const prisma = new _prisma.PrismaClient();" \
    "export default _prisma;" > packages/database/dist/client.js \
 && node -e "const f='packages/database/package.json',p=require('./'+f);p.type='module';p.main='./dist/client.js';require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

ENV NODE_ENV=production
# Railway/Render injetam PORT; a app lê PORT (fallback API_PORT/3333). EXPOSE é só documental.
EXPOSE 3333

# Aplica migrations pendentes (idempotente — usa DIRECT_URL/sessão) e sobe a API.
CMD ["sh","-c","npm run db:deploy -w @pacific/database && node packages/api/dist/main.js"]
