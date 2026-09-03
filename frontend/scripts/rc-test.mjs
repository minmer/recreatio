/**
 * Läufer für die rc-Prüfreihen im Browser-Teil.
 *
 * Bewusst kein Testrahmen: esbuild liegt ohnehin schon da, weil Vite es
 * mitbringt, und die Prüfungen selbst sind gewöhnliche Zusicherungen. Ein
 * weiteres Werkzeug mit eigener Konfiguration, eigenen Fallstricken und
 * eigenem Aktualisierungsbedarf wäre für ein paar reine Funktionen ein
 * schlechter Tausch — und es steht dem später nicht im Weg, wenn wirklich
 * einmal ein Browser gebraucht wird.
 */

import { build } from 'esbuild';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../src/rc/', import.meta.url);

/*
 * UNTERORDNER ZAEHLEN MIT.
 *
 * Vorher wurde nur src/rc/lib durchsucht. Eine Pruefreihe neben dem Bauteil,
 * das sie prueft, lief damit nie - sie lag da und niemand erfuhr, ob sie
 * bestand. Eine Pruefung, die stillschweigend nicht laeuft, ist schlechter
 * als keine: sie erzeugt Zuversicht ohne Deckung.
 */
const walk = async (dir) => {
  const found = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const at = new URL(item.name + (item.isDirectory() ? '/' : ''), dir);
    if (item.isDirectory()) found.push(...(await walk(at)));
    else if (item.name.endsWith('.test.ts')) {
      found.push(at.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
    }
  }
  return found;
};

const entries = (await walk(ROOT)).sort();

if (entries.length === 0) {
  console.error('Keine Prüfreihen gefunden.');
  process.exit(1);
}

const out = await mkdtemp(join(tmpdir(), 'rc-test-'));
let failed = 0;

try {
  for (const entry of entries) {
    const name = entry.split(/[\\/]/).pop();
    const bundle = join(out, name.replace(/\.ts$/, '.mjs'));

    await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      outfile: bundle,
      // `import.meta.env` gibt es nur unter Vite. Die geprüften Funktionen
      // brauchen es nicht, aber sie hängen über Modulgrenzen an Dateien, die
      // es beim Laden lesen — ein leeres Objekt genügt, und die Vorgabewerte
      // dahinter greifen dann genau wie im Browser ohne gesetzte Variable.
      define: { 'import.meta.env': '{}' },
      logLevel: 'warning'
    });

    process.stdout.write(`${name}: `);
    try {
      await import(pathToFileURL(bundle).href);
    } catch (e) {
      failed++;
      console.error(e);
    }
  }
} finally {
  await rm(out, { recursive: true, force: true });
}

// Die Prüfreihen melden Fehlschläge durch Werfen. Der Läufer fängt sie, damit
// eine kaputte Reihe die übrigen nicht verschluckt, und setzt am Ende den
// Rückgabewert — sonst hielte jede Fortsetzungsstrecke den Lauf für gelungen.
process.exit(failed === 0 ? 0 : 1);
