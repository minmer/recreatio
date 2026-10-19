/*
 * Vitest — kopflose Prüfungen in Node (zuerst die Partikel-Engine,
 * documentation/particles/ARCHITECTURE.md §11). Eigene Datei, damit die
 * Prüfungen nicht die Bau-Einstellungen von vite.config.ts erben.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 120_000
  }
});
