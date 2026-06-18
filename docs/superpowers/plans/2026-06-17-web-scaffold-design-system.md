# Web Scaffold + Design System (Torre de Controle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/web` (Next.js 14 creditor dashboard) with design system tokens, Supabase auth, and the dashboard shell so that `next build` passes cleanly.

**Architecture:** Next.js 14 App Router with a dark-canvas design system (ink/sonar palette, Space Grotesk + Inter + IBM Plex Mono fonts). Auth is Supabase client-side only; all data fetching is client-side via TanStack Query against a REST API. The shell (left-rail nav + topbar) wraps page content; the dashboard page is a placeholder — data widgets come in a follow-up task.

**Tech Stack:** Next.js 14.2.5, React 18.3, Tailwind CSS 3.4, TanStack Query v5, Supabase JS v2, TypeScript 5 strict, @pacific/shared (ESM).

---

## File Map

| File | Role |
|------|------|
| `apps/web/package.json` | Workspace manifest with all deps |
| `apps/web/next.config.mjs` | Next config, transpilePackages for @pacific/shared |
| `apps/web/tsconfig.json` | Next-managed TS config (standalone, not extending base) |
| `apps/web/postcss.config.mjs` | PostCSS for Tailwind |
| `apps/web/tailwind.config.ts` | Design tokens, font families |
| `apps/web/.eslintrc.json` | ESLint next/core-web-vitals |
| `apps/web/app/globals.css` | Tailwind directives + body/html defaults |
| `apps/web/app/layout.tsx` | Root layout: fonts, metadata, Providers |
| `apps/web/app/providers.tsx` | TanStack Query provider (client component) |
| `apps/web/lib/supabase.ts` | Lazy Supabase client (build-safe, no env at build time) |
| `apps/web/lib/api.ts` | Typed apiGet helper with bearer token |
| `apps/web/app/(auth)/login/page.tsx` | Login page: email/password form → /dashboard |
| `apps/web/components/Shell.tsx` | Left-rail nav + topbar layout wrapper |
| `apps/web/app/dashboard/page.tsx` | Dashboard placeholder wrapped in Shell |
| `apps/web/next-env.d.ts` | Next.js type reference file |

---

### Task 1: Create `apps/web` directory and package.json

**Files:**
- Create: `apps/web/package.json`

- [ ] **Step 1: Create directory and package.json**

```bash
mkdir -p /Users/raylanborges/Pacific/apps/web
```

Then create `apps/web/package.json`:

```json
{
  "name": "@pacific/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@tanstack/react-query": "^5.51.0",
    "@supabase/supabase-js": "^2.45.0",
    "@pacific/shared": "*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.5"
  }
}
```

- [ ] **Step 2: Verify file was created**

```bash
cat /Users/raylanborges/Pacific/apps/web/package.json
```

Expected: JSON printed with name `@pacific/web`.

---

### Task 2: Create Next.js config files

**Files:**
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/.eslintrc.json`
- Create: `apps/web/next-env.d.ts`

- [ ] **Step 1: Create next.config.mjs**

`apps/web/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pacific/shared'],
};
export default nextConfig;
```

- [ ] **Step 2: Create tsconfig.json**

`apps/web/tsconfig.json` — standalone Next config, does NOT extend monorepo base:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create postcss.config.mjs**

`apps/web/postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

- [ ] **Step 4: Create .eslintrc.json**

`apps/web/.eslintrc.json`:
```json
{ "extends": "next/core-web-vitals" }
```

- [ ] **Step 5: Create next-env.d.ts**

`apps/web/next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
```

---

### Task 3: Create Tailwind config with design tokens

**Files:**
- Create: `apps/web/tailwind.config.ts`

- [ ] **Step 1: Create tailwind.config.ts**

`apps/web/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0E17',
        surface: '#121826',
        line: '#1F2837',
        text: '#E8ECF4',
        muted: '#7E899D',
        sonar: '#2BE5C2',
        status: {
          green: '#36B37E',
          yellow: '#E5C04B',
          orange: '#F08A3C',
          red: '#F0556A',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### Task 4: Create global CSS

**Files:**
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: Create app directory and globals.css**

```bash
mkdir -p /Users/raylanborges/Pacific/apps/web/app
```

`apps/web/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }
html, body { background: #0A0E17; color: #E8ECF4; }
body { font-family: var(--font-sans); }
::selection { background: #2BE5C2; color: #0A0E17; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

---

### Task 5: Create Root Layout and Providers

**Files:**
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/providers.tsx`

- [ ] **Step 1: Create app/layout.tsx**

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Space_Grotesk, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Pacific — Torre de Controle',
  description: 'Monitoramento de carteira de empréstimos privados.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create app/providers.tsx**

`apps/web/app/providers.tsx`:
```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

---

### Task 6: Create lib utilities (Supabase client + API helper)

**Files:**
- Create: `apps/web/lib/supabase.ts`
- Create: `apps/web/lib/api.ts`

- [ ] **Step 1: Create lib directory and supabase.ts**

```bash
mkdir -p /Users/raylanborges/Pacific/apps/web/lib
```

`apps/web/lib/supabase.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    );
  }
  return client;
}
```

- [ ] **Step 2: Create lib/api.ts**

`apps/web/lib/api.ts`:
```ts
import { supabase } from './supabase';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export async function apiGet<T>(path: string): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
  return (await res.json()) as T;
}
```

---

### Task 7: Create Login page

**Files:**
- Create: `apps/web/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create directory and login page**

```bash
mkdir -p /Users/raylanborges/Pacific/apps/web/app/\(auth\)/login
```

`apps/web/app/(auth)/login/page.tsx`:
```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase().auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Não foi possível entrar. Verifique e-mail e senha.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-xl p-8 space-y-6">
        {/* Brand */}
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted uppercase tracking-widest">torre de controle</p>
          <h1 className="font-display text-3xl font-semibold text-text tracking-tight">PACIFIC</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="block font-mono text-xs text-muted uppercase tracking-wider">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sonar focus:border-sonar transition-colors"
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block font-mono text-xs text-muted uppercase tracking-wider">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-3 py-2.5 text-text font-sans text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sonar focus:border-sonar transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="font-mono text-xs text-status-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sonar text-ink font-mono text-sm font-medium uppercase tracking-widest py-2.5 rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sonar focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
```

---

### Task 8: Create Shell component

**Files:**
- Create: `apps/web/components/Shell.tsx`

- [ ] **Step 1: Create components directory and Shell.tsx**

```bash
mkdir -p /Users/raylanborges/Pacific/apps/web/components
```

`apps/web/components/Shell.tsx`:
```tsx
'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string; // emoji/glyph for mobile-collapsed icon
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Torre de Controle', icon: '⊕' },
  { href: '/carteira', label: 'Carteira', icon: '◈' },
  { href: '/vencimentos', label: 'Vencimentos', icon: '◷' },
  { href: '/notificacoes', label: 'Notificações', icon: '◎' },
];

interface ShellProps {
  title: string;
  orgCode?: string;
  children: ReactNode;
}

export function Shell({ title, orgCode = 'ORG-000', children }: ShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-ink flex">
      {/* Left Rail */}
      <nav
        aria-label="Navegação principal"
        className="hidden md:flex flex-col w-56 shrink-0 bg-surface border-r border-line"
      >
        {/* Brand */}
        <div className="px-5 py-6 border-b border-line">
          <p className="font-mono text-[10px] text-muted uppercase tracking-widest mb-0.5">torre de controle</p>
          <span className="font-display text-lg font-semibold text-text tracking-tight">PACIFIC</span>
        </div>

        {/* Nav Items */}
        <ul className="flex-1 py-4 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-sonar border-l-2 ${
                    isActive
                      ? 'border-sonar text-sonar bg-sonar/5'
                      : 'border-transparent text-muted hover:text-text hover:bg-line/50'
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile Top Bar (narrow screens) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-surface border-b border-line flex items-center gap-4 px-4 h-12">
        <span className="font-display text-sm font-semibold text-text">PACIFIC</span>
        <nav aria-label="Navegação principal" className="flex gap-1 ml-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`p-2 rounded-md text-base leading-none focus:outline-none focus:ring-2 focus:ring-sonar transition-colors ${
                  isActive ? 'text-sonar' : 'text-muted hover:text-text'
                }`}
              >
                {item.icon}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-surface border-b border-line px-6 py-4 flex items-center justify-between md:mt-0 mt-12">
          <h1 className="font-display text-xl font-semibold text-text">{title}</h1>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted bg-line px-2.5 py-1 rounded-md tracking-wider uppercase">
              {orgCode}
            </span>
            <div
              aria-label="Usuário"
              className="w-8 h-8 rounded-full bg-line flex items-center justify-center text-muted text-sm"
            >
              ◉
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

### Task 9: Create Dashboard page

**Files:**
- Create: `apps/web/app/dashboard/page.tsx`

- [ ] **Step 1: Create directory and dashboard page**

```bash
mkdir -p /Users/raylanborges/Pacific/apps/web/app/dashboard
```

`apps/web/app/dashboard/page.tsx`:
```tsx
'use client';

import { Shell } from '@/components/Shell';

export default function DashboardPage() {
  return (
    <Shell title="Torre de Controle">
      <div className="bg-surface border border-line rounded-xl p-8 flex items-center justify-center min-h-48">
        <p className="font-mono text-sm text-muted tracking-wider">Conectando à carteira…</p>
      </div>
    </Shell>
  );
}
```

---

### Task 10: Install dependencies

**Files:** none (installs to node_modules)

- [ ] **Step 1: Run npm install from monorepo root**

```bash
cd /Users/raylanborges/Pacific && npm install
```

Expected: exits 0, installs Next.js 14 and other deps into `apps/web/node_modules` and root `node_modules`.

- [ ] **Step 2: Verify @pacific/web is in workspaces**

```bash
cd /Users/raylanborges/Pacific && npm ls --depth=0 -w @pacific/web 2>&1 | head -20
```

Expected: lists `@pacific/web` deps.

---

### Task 11: Build verification

**Files:** none (build artifacts in .next)

- [ ] **Step 1: Run next build**

```bash
cd /Users/raylanborges/Pacific && npm run build -w @pacific/web 2>&1
```

Expected: `✓ Compiled successfully` and `Route (app)` table printed, exit code 0.

If build fails with a TS error about `@pacific/shared` ESM imports, the fix is to ensure `transpilePackages: ['@pacific/shared']` is set in `next.config.mjs` (already done in Task 2).

If build fails with "Cannot find module 'next/font/google'", verify the `next` version is exactly `14.2.5` in `package.json` and re-run `npm install`.

- [ ] **Step 2: Run lint**

```bash
cd /Users/raylanborges/Pacific && npm run lint -w @pacific/web 2>&1
```

Expected: exit 0 with no errors (warnings about missing env vars are acceptable).

---

### Task 12: Commit

- [ ] **Step 1: Stage and commit**

```bash
cd /Users/raylanborges/Pacific && git add apps/web package-lock.json && git commit -m "feat(web): scaffold Next 14 + design system (torre de controle), login e shell"
```

Expected: commit created on `feat/fase-1` branch.

- [ ] **Step 2: Verify git status**

```bash
cd /Users/raylanborges/Pacific && git status -s
```

Expected: clean working tree (no untracked or modified files related to `apps/web`).
