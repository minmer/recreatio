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
    /* Lange Läufe (zehn simulierte Minuten) nur mit `npm run test:particles:slow`. */
    exclude: ['**/node_modules/**', 'src/**/*.slow.test.ts'],
    testTimeout: 120_000
  }
});
