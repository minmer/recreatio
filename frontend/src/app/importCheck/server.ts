/**
 * 2026-11-22 (A1) — DIE PRÜFUNG IM DIENST. `frontend/scripts/import-check-bundle.mjs` bündelt diese Datei (mit den Planern
 * aller Importe) zu `backend/Api/Library/ImportCheck.js`; der Dienst führt sie mit Jint aus (`AiMcp.ImportCheck.cs`, MCP
 * `check_import`) — derselbe Code wie die Vorschau der App, kein zweiter in C#.
 *
 * Eine Funktion auf `globalThis`: `recreatioImportCheck(input, dicts)` — `input` ist JSON
 * `{format, document, base?, lang?}` (`base`: die Abschrift einer Baza wiedzy, wie `AiAccess` sie hat), `dicts` die Texte
 * der Sprache und Englisch als Rückfall (`{"pl": {datei: {…}}, "en": {…}}`); zurück kommt JSON (`ImportCheck`, check.ts).
 * Nichts wird geschrieben: die Baza ist ein Speicher ohne Dienst (`MemoryStore`).
 */

import { isLang, type Dictionary, type Lang } from '../core/i18n';
import { checkImport } from './registry';
import { restoreBase, type KnowledgeSnapshot } from './knowledge';
import { worldChecks } from '../cogita/worldChecks';

interface Input {
  readonly format?: unknown;
  readonly document?: unknown;
  readonly base?: unknown;
  readonly lang?: unknown;
}

interface I18nStore {
  app: Lang;
  dicts: Partial<Record<Lang, Record<string, Dictionary>>>;
  version: number;
}

/** Die Texte dieser Sprache (und Englisch) in den gemeinsamen Speicher von `core/i18n.tsx`. */
function useDicts(lang: Lang, dicts: Partial<Record<Lang, Record<string, Dictionary>>>): void {
  const store = (globalThis as { __recreatioI18n?: I18nStore }).__recreatioI18n;
  if (store === undefined) return;
  for (const [one, files] of Object.entries(dicts)) if (isLang(one) && files !== undefined) store.dicts[one] = files;
  store.app = lang;
  store.version += 1;
}

export async function recreatioImportCheck(input: string, dicts: string): Promise<string> {
  const req = JSON.parse(input) as Input;
  const lang: Lang = isLang(req.lang) ? req.lang : 'pl';
  useDicts(lang, JSON.parse(dicts) as Partial<Record<Lang, Record<string, Dictionary>>>);
  const base = typeof req.base === 'object' && req.base !== null ? req.base as KnowledgeSnapshot : undefined;
  const result = await checkImport(typeof req.format === 'string' ? req.format : '', req.document, base === undefined ? {} : { base });
  return JSON.stringify(result);
}

(globalThis as { recreatioImportCheck?: typeof recreatioImportCheck }).recreatioImportCheck = recreatioImportCheck;

/**
 * 2026-11-22 (I2) — DIE KONTROLLE EINER WELT IM DIENST (MCP `get_world_checks`): die Baza aus ihrer Abschrift (`restoreBase`,
 * mit ihren Uwagi), ihre Karten, dann `worldChecks` — dieselbe Rechnung wie in der App (Wiedza → „Do zrobienia").
 * `input`: JSON `{base, lang?}`; zurück: JSON (`WorldCheckReport`, cogita/worldChecks.ts).
 */
export async function recreatioWorldChecks(input: string, dicts: string): Promise<string> {
  const req = JSON.parse(input) as Input;
  const lang: Lang = isLang(req.lang) ? req.lang : 'pl';
  useDicts(lang, JSON.parse(dicts) as Partial<Record<Lang, Record<string, Dictionary>>>);
  if (typeof req.base !== 'object' || req.base === null) throw new Error('no base');
  const made = await restoreBase(req.base as KnowledgeSnapshot);
  const { cards } = await made.lib.cards();
  return JSON.stringify({ ...worldChecks(made.lib, { cards }), restored: { entries: made.entries, kinds: made.kinds, docs: made.docs, missing: made.missing } });
}

(globalThis as { recreatioWorldChecks?: typeof recreatioWorldChecks }).recreatioWorldChecks = recreatioWorldChecks;
