/**
 * DIE UMSTELLUNG (2026-10-22) — von „veröffentlichen + private Felder" auf
 * „der Bereich entscheidet" und Komentarze als eigene Einträge.
 *
 * Hier steht der Plan (ohne Browser prüfbar); ausgeführt wird er in
 * `libraryTidyRun.ts`. Sie läuft im Browser (nur dort sind die Schlüssel) und in zwei Schritten,
 * damit nichts verloren geht und nichts ungefragt sichtbar wird:
 *
 * <code>
 *   1 Przygotuj   aus jedem alten Wert wird ein Komentarz (eine Kopie) —
 *                 die alten Werte bleiben, wo sie sind
 *   — der Mensch sieht nach, was wohin kam —
 *   2 Zatwierdź   die alten Werte gehen (description, notes, die Notiz am
 *                 Punkt, „Nie publikuj"), Einträge ziehen um, wo es gewählt
 *                 ist, die alten offenen Fassungen werden zurückgezogen, und
 *                 jede Bibliothek gilt als durchgesehen (erst dann liest ein
 *                 öffentlicher Bereich sie offen — 0122)
 * </code>
 *
 * <b>Die harte Regel:</b> danach sieht niemand etwas, das er vorher nicht sah.
 *
 * <code>
 *   description (Zitat, Werk)        → Komentarz neben dem Eintrag; zieht er um, zieht er mit
 *   notes (jede Art), Notiz am Punkt → Komentarz in der PRIVATEN Bibliothek (nur ich) —
 *                                      ausser der Eintrag liegt schon dort
 *   nie veröffentlicht, aber im      → würde öffentlich: Vorgabe „in die private Bibliothek",
 *     öffentlichen Bereich             wählbar „zostaw — niech będzie publiczny"
 *   veröffentlicht, aber im nicht    → würde unsichtbar: Vorgabe „in die öffentliche Bibliothek"
 *     öffentlichen Bereich             (wenn es genau eine gibt), wählbar „zostaw"
 *   status, deadline, targetWords,   → bleiben, ohne Markierung (so entschieden)
 *     libraryNumber
 *   delivery.hidden                  → fällt weg (ein verborgenes lag nie offen; im
 *                                      öffentlichen Bereich fällt es unter „würde öffentlich")
 * </code>
 */

import { blockData, blocksOf, LEGACY_COMMENT_FIELDS, legacyBlocks, subjectsOf } from './comment';
import type { OpenLibrary } from './library';
import { itemsOf, str, type EntryData } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';

/** Die private Bibliothek, die es noch nicht gibt — sie entsteht beim ersten Schritt. */
export const PERSONAL = 'personal';

export interface TidyLibrary {
  readonly library: OpenLibrary;
  readonly store: LibraryStore;
}

/** Ein alter Wert, der ein Komentarz wird. */
export interface CommentMove {
  readonly key: string;
  readonly entryId: string;
  readonly from: string;
  readonly field: string;
  readonly point: string;
  readonly value: string;
  readonly private: boolean;
  /** Wohin: eine Bibliothek, \`PERSONAL\`, oder \`with-entry\` (geht mit dem Eintrag). */
  readonly target: string;
  /** Der Komentarz, den es dafür schon gibt (ein früherer erster Schritt). */
  readonly existing: string | null;
}

/** Ein Eintrag, der umziehen sollte, damit seine Sichtbarkeit bleibt, wie sie war. */
export interface EntryMove {
  readonly entryId: string;
  readonly from: string;
  readonly reason: 'exposure' | 'publicity';
  /** Die Vorgabe — \`null\`: bleiben. */
  readonly target: string | null;
  readonly options: readonly (string | null)[];
}

export interface TidyPlan {
  readonly comments: readonly CommentMove[];
  readonly moves: readonly EntryMove[];
  /** Einträge mit alten Feldern, die im zweiten Schritt gehen. */
  readonly strip: readonly { readonly entryId: string; readonly libraryId: string; readonly fields: readonly string[] }[];
  /** Je Bibliothek die Einträge, die noch eine alte offene Fassung haben. */
  readonly unpublish: ReadonlyMap<string, readonly string[]>;
  /** Bibliotheken, die noch nicht durchgesehen sind (und die ich schreiben darf). */
  readonly settle: readonly string[];
  /** Bibliotheken mit Altem, die ich nur lesen kann — jemand mit Schreibrecht muss sie umstellen. */
  readonly blocked: readonly string[];
  /** Die private Bibliothek: ihre Kennung, oder \`PERSONAL\`, wenn sie erst entsteht. */
  readonly personal: string;
}

const sameBlocks = (data: EntryData, value: string): boolean =>
  JSON.stringify(blocksOf(data).map(blockData)) === JSON.stringify(legacyBlocks(value).map(blockData));

/** Gibt es diesen Komentarz schon (über diesen Eintrag, diesen Punkt, mit genau diesem Wortlaut)? */
function existingComment(all: readonly Entry[], entryId: string, point: string, value: string): string | null {
  for (const e of all) {
    if (e.kind !== 'comment') continue;
    const subjects = subjectsOf(e.data);
    if (subjects.length === 1 && subjects[0].ref === entryId && subjects[0].point === point && sameBlocks(e.data, value)) return e.id;
  }
  return null;
}

/** Die alten Felder eines Eintrags, die der zweite Schritt entfernt. */
export function legacyFields(entry: Entry): string[] {
  const out = (LEGACY_COMMENT_FIELDS[entry.kind] ?? []).map((f) => f.key).filter((key) => entry.data[key] !== undefined);
  if (entry.kind === 'text' && itemsOf(entry.data, 'plan').some((item) => item.note !== undefined)) out.push('plan.note');
  if (entry.kind === 'delivery' && entry.data.hidden !== undefined) out.push('hidden');
  return out;
}

/** Was die Umstellung tun würde — ohne etwas zu tun. */
export function planTidy(libs: readonly TidyLibrary[], personalAreaId: string | null): TidyPlan {
  const all = libs.flatMap((l) => l.store.all());
  const personalLib = libs.find((l) => l.library.areaId === personalAreaId)?.library.libraryId ?? PERSONAL;
  const publicLibs = libs.filter((l) => l.library.areaPublic === true && l.library.writes);
  const nonPublic = libs.filter((l) => l.library.areaPublic !== true && l.library.writes).map((l) => l.library.libraryId);

  const comments: CommentMove[] = [];
  const moves: EntryMove[] = [];
  const strip: { entryId: string; libraryId: string; fields: string[] }[] = [];
  const unpublish = new Map<string, string[]>();
  const blocked: string[] = [];

  for (const { library, store } of libs) {
    const from = library.libraryId;
    const own = from === personalLib;
    const settled = library.areaRuleAt != null;
    let legacy = false;

    for (const entry of store.all()) {
      const fields = legacyFields(entry);
      if (fields.length > 0) legacy = true;
      if (!library.writes) continue;
      if (fields.length > 0) strip.push({ entryId: entry.id, libraryId: from, fields });

      for (const { key, private: secret } of LEGACY_COMMENT_FIELDS[entry.kind] ?? []) {
        const value = str(entry.data, key);
        if (value.trim() === '') continue;
        comments.push({
          key: `${entry.id}:${key}`, entryId: entry.id, from, field: key, point: '', value, private: secret,
          target: secret ? (own ? from : personalLib) : 'with-entry', existing: existingComment(all, entry.id, '', value)
        });
      }
      if (entry.kind === 'text') {
        for (const item of itemsOf(entry.data, 'plan')) {
          const value = str(item, 'note');
          const point = str(item, 'id');
          if (value.trim() === '' || point === '') continue;
          comments.push({
            key: `${entry.id}:plan:${point}`, entryId: entry.id, from, field: 'plan.note', point, value, private: true,
            target: own ? from : personalLib, existing: existingComment(all, entry.id, point, value)
          });
        }
      }

      if (entry.publishedAs !== null) unpublish.set(from, [...(unpublish.get(from) ?? []), entry.id]);

      /* Die Sichtbarkeit soll bleiben, wie sie war — nicht weiter, und wo möglich nicht enger. */
      if (settled) continue;
      if (library.areaPublic === true && entry.publishedAs === null) {
        moves.push({ entryId: entry.id, from, reason: 'exposure', target: personalLib, options: [personalLib, ...nonPublic.filter((id) => id !== personalLib), null] });
      } else if (library.areaPublic !== true && entry.publishedAs !== null) {
        const targets = publicLibs.map((l) => l.library.libraryId);
        moves.push({ entryId: entry.id, from, reason: 'publicity', target: targets.length === 1 ? targets[0] : null, options: [...targets, null] });
      }
    }
    if (legacy && !library.writes) blocked.push(from);
  }

  const settle = libs.filter((l) => l.library.writes && l.library.areaRuleAt == null).map((l) => l.library.libraryId);
  return { comments, moves, strip, unpublish, settle, blocked, personal: personalLib };
}

/** Ein Eintrag ohne seine alten Felder. */
export function stripped(entry: Entry): EntryData {
  const data: EntryData = { ...entry.data };
  for (const { key } of LEGACY_COMMENT_FIELDS[entry.kind] ?? []) delete data[key];
  if (entry.kind === 'delivery') delete data.hidden;
  if (entry.kind === 'text' && Array.isArray(data.plan)) {
    data.plan = itemsOf(entry.data, 'plan').map((item) => { const { note: _gone, ...rest } = item; return rest; });
  }
  return data;
}
