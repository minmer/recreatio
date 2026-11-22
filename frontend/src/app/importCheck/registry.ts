/**
 * 2026-11-22 (A1) — EINE PRÜFUNG FÜR JEDEN IMPORT. Je Format (die Kennungen von `list_import_formats`,
 * `frontend/scripts/import-formats.mjs`) ein Adapter, der den Planer der App aufruft — derselbe Code wie die Vorschau neben
 * dem Import. Gebraucht von:
 *   - der App und den Prüfskripten (`checkImport`),
 *   - der Vorschau-MCP (`frontend/mcp`),
 *   - dem Dienst: `frontend/scripts/import-check-bundle.mjs` bündelt `server.ts` (dieses Register) zu
 *     `backend/Api/Library/ImportCheck.js`; das MCP-Werkzeug `check_import` führt es mit Jint aus (AiMcp.ImportCheck.cs).
 *
 * <b>Ein neuer Import</b> = eine Zeile in `CHECKERS` (Kennung des Formats → Adapter). Ein Adapter gibt `RawCheck` zurück
 * (Zeilen der Vorschau, Löschungen, Fehler, Warnungen, ein Satz, wogegen geprüft wurde) und wirft nie; was er nicht
 * prüfen kann, sagt er im `note`. Dann `node scripts/import-check-bundle.mjs` (das Bündel des Dienstes) und
 * `node scripts/app-import-registry-check.mjs` (je Adapter ein gutes und ein schlechtes Dokument).
 */

import { t } from '../core/i18n';
import { finishCheck, thrown, type ImportCheck, type RawCheck } from './check';
import { checkKnowledge, checkKnowledgeForms, type KnowledgeSnapshot } from './knowledge';
import {
  checkAddresses, checkArea, checkBookings, checkCalendar, checkChat, checkCommunity, checkContacts, checkEntries, checkForm,
  checkLamps, checkLibrary, checkLiturgy, checkMasses, checkPage, checkPersons, checkPlan, checkProgress, checkQuotes,
  checkRegistry, checkRoles, checkScheme, checkScriptorium, checkSourceText, checkTasks, checkWorkspaceView, checkWorkWithText
} from './parts';

/** Was eine Prüfung ausser dem Dokument bekommen kann. */
export interface CheckContext {
  /** Die Abschrift der Baza wiedzy, in die importiert würde (nur `knowledge-base`, `knowledge-forms`). */
  readonly base?: KnowledgeSnapshot;
}

export type Checker = (doc: unknown, ctx: CheckContext) => RawCheck | Promise<RawCheck>;

/** Format → Adapter. Die Kennungen sind die von `list_import_formats` (ohne Leitfäden und Beispiele). */
export const CHECKERS: Readonly<Record<string, Checker>> = {
  'knowledge-base': (doc, ctx) => checkKnowledge(doc, ctx.base),
  'knowledge-forms': (doc, ctx) => checkKnowledgeForms(doc, ctx.base),
  'learn-progress': checkProgress,
  page: checkPage,
  form: checkForm,
  area: checkArea,
  community: checkCommunity,
  addresses: checkAddresses,
  library: checkLibrary,
  'work-with-text': checkWorkWithText,
  'source-text': checkSourceText,
  quotes: checkQuotes,
  liturgy: checkLiturgy,
  scriptorium: checkScriptorium,
  /* Der Plan eines Textes kommt als Dokument „scriptorium" zurück. */
  'text-plan': checkScriptorium,
  calendar: checkCalendar,
  'calendar-scheme': checkScheme,
  'calendar-plan': checkPlan,
  tasks: checkTasks,
  masses: checkMasses,
  bookings: checkBookings,
  registry: checkRegistry,
  'form-entries': checkEntries,
  contacts: checkContacts,
  roles: checkRoles,
  chat: checkChat,
  lamps: checkLamps,
  persons: checkPersons,
  'workspace-view': checkWorkspaceView
};

export const CHECK_FORMATS: readonly string[] = Object.keys(CHECKERS);

/** Die Beispiele und Schemata, die als „knowledge-base" (oder „page") importiert werden — dieselbe Prüfung. */
const ALIAS: Readonly<Record<string, string>> = {
  'example-world-page': 'page', 'example-story-page': 'page', 'example-liturgy': 'liturgy'
};

const formatOf = (id: string): string => {
  const clean = id.trim().toLowerCase();
  if (CHECKERS[clean] !== undefined) return clean;
  if (ALIAS[clean] !== undefined) return ALIAS[clean]!;
  if (clean.startsWith('scheme-') || (clean.startsWith('example-') && !clean.startsWith('example-community-'))) return 'knowledge-base';
  if (clean.startsWith('example-community-')) return 'community';
  return clean;
};

/**
 * DAS DOKUMENT PRÜFEN — ohne zu schreiben. `format`: eine Kennung aus `list_import_formats` (auch ein Beispiel oder ein
 * Schemat — sie werden geprüft wie ihr Format). Alle Fehler auf einmal; eine Ausnahme eines Planers ist ein Fehler des
 * Dokuments, keine der Prüfung.
 */
export async function checkImport(format: string, doc: unknown, ctx: CheckContext = {}): Promise<ImportCheck> {
  const id = formatOf(format);
  const checker = CHECKERS[id];
  if (checker === undefined) return finishCheck(format, { errors: [t('importCheck.unknownFormat', { format, known: CHECK_FORMATS.join(', ') })] });
  let raw: RawCheck;
  try {
    raw = await checker(doc, ctx);
  } catch (e) {
    raw = { errors: [thrown(e)] };
  }
  return finishCheck(id, raw);
}
