/**
 * 2026-11-05 — DIE SPRACHE IN NODE. Prüfskripte und Erzeuger bündeln Module der Anwendung mit esbuild; deren
 * Texte kommen aus `src/locales/` (core/i18n.tsx). Hier werden die Dateien einer Sprache (und Englisch als
 * Rückfall) in den gemeinsamen Speicher auf `globalThis` gelegt — VOR dem Import der Bündel aufrufen:
 *
 *   import { useLocale } from './i18n-node.mjs';
 *   await useLocale('pl');
 *
 * Die Prüfungen vergleichen polnische Texte, deshalb wählen sie 'pl'.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES = fileURLToPath(new URL('../src/locales/', import.meta.url));

/** Alle Dateien einer Sprache: { datei: inhalt }. */
export async function readLang(lang) {
  const dir = join(LOCALES, lang);
  const out = {};
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
    out[name.slice(0, -'.json'.length)] = JSON.parse(await readFile(join(dir, name), 'utf8'));
  }
  return out;
}

export async function useLocale(lang = 'pl') {
  const store = (globalThis.__recreatioI18n ??= { app: 'en', dicts: {}, loading: {}, loader: null, version: 0, listeners: new Set() });
  store.dicts.en = await readLang('en');
  if (lang !== 'en') store.dicts[lang] = await readLang(lang);
  store.app = lang;
  store.version += 1;
  return store;
}
