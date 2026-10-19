/*
 * Vitest — die langen Prüfungen der Partikel-Engine (Tor 1 über zehn
 * simulierte Minuten, documentation/particles/ARCHITECTURE.md §11):
 * `npm run test:particles:slow`.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.slow.test.ts'],
    testTimeout: 900_000
  }
});
