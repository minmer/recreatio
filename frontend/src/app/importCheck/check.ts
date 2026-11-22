/**
 * 2026-11-22 (A1) — DIE PRÜFUNG EINES IMPORTS, OHNE ETWAS ZU SCHREIBEN: was ein Dokument täte (die Zeilen der Vorschau), was es
 * löschte, und ALLE Fehler und Warnungen auf einmal. Dieselbe Gestalt für jede Art von Import (`registry.ts`), im Browser, in
 * Prüfskripten, in der Vorschau-MCP und im Dienst (MCP `check_import`, der dasselbe Bündel mit Jint ausführt).
 */

import { groupMessages, type MessageGroup } from '../core/messageGroups';

export type CheckLevel = 'error' | 'warning';

export interface CheckMessage {
  readonly level: CheckLevel;
  readonly text: string;
}

/** Was ein Adapter sagt — roh, vor dem Zusammenfassen. */
export interface RawCheck {
  /** Die Zeilen der Vorschau: was angelegt, geändert würde. */
  readonly changes?: readonly string[];
  /** Was gelöscht würde, beim Namen. */
  readonly removals?: readonly string[];
  readonly errors?: readonly string[];
  readonly warnings?: readonly string[];
  /** Wogegen geprüft wurde (leerer Stand, die Abschrift einer Baza …) — ein Satz. */
  readonly note?: string;
}

export interface CheckGroup extends MessageGroup {
  readonly level: CheckLevel;
}

export interface ImportCheck {
  /** Die Kennung des Formats (wie in `list_import_formats`). */
  readonly format: string;
  /** Kein Fehler: der Import ginge so durch (Warnungen halten ihn nicht auf). */
  readonly ok: boolean;
  readonly changes: readonly string[];
  readonly removals: readonly string[];
  readonly messages: readonly CheckMessage[];
  /** Dieselben Meldungen, gleiche zusammen (Fehler zuerst). */
  readonly groups: readonly CheckGroup[];
  readonly note?: string;
}

const clean = (list: readonly string[] | undefined): string[] => (list ?? []).filter((x) => typeof x === 'string' && x.trim() !== '');

/** Aus dem, was ein Adapter sagt, das Ergebnis: Meldungen, Gruppen, ob es ginge. */
export function finishCheck(format: string, raw: RawCheck): ImportCheck {
  const errors = clean(raw.errors);
  const warnings = clean(raw.warnings);
  const messages: CheckMessage[] = [...errors.map((text) => ({ level: 'error' as const, text })), ...warnings.map((text) => ({ level: 'warning' as const, text }))];
  const groups: CheckGroup[] = [
    ...groupMessages(errors).map((g) => ({ ...g, level: 'error' as const })),
    ...groupMessages(warnings).map((g) => ({ ...g, level: 'warning' as const }))
  ];
  return {
    format, ok: errors.length === 0, changes: clean(raw.changes), removals: clean(raw.removals), messages, groups,
    ...(raw.note === undefined || raw.note === '' ? {} : { note: raw.note })
  };
}

/** Eine Ausnahme als Satz (ein Planer, der wirft, ist ein Fehler des Dokuments, keiner der Prüfung). */
export const thrown = (e: unknown): string => (e instanceof Error ? e.message : String(e));
