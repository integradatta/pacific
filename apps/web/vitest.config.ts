import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Testes de lógica do front (formatação financeira, roteamento por papel, outbox de localização).
// jsdom fornece localStorage/window para os testes que precisam.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts?(x)'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
});
