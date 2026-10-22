/**
 * DIE UMBAUTEN (2026-10-22 →) — Migrationen versiegelter Daten, im Browser.
 *
 * Der Dienst kann versiegelte Einträge nicht lesen; jede Umstellung, die ihren
 * Inhalt ändert, läuft deshalb hier, mit den Schlüsseln des Menschen, der sie
 * auslöst — auf dem Bildschirm „Porządki" (`RebuildView.tsx`). Jede hat
 * dieselbe Gestalt:
 *
 * <code>
 *   plan(ctx)        was sich ändern würde („Co się zmieni") — ohne etwas zu tun
 *   run(plan, ctx)   tun, Eintrag für Eintrag unter derselben Kennung; der Bericht
 * </code>
 *
 * Regeln (aus dem Auftrag): nichts wird gelöscht, was nicht vorher an seinem
 * neuen Platz steht; jede Umstellung lässt sich wiederholen und fortsetzen
 * (was schon umgestellt ist, steht im nächsten Plan nicht mehr); was nicht
 * aufgeht, wird gemeldet, nicht geraten.
 */

import type { AreaRow } from '../../areas/area';
import type { Me } from '../../core/me';
import type { OpenLibrary } from '../library';
import type { LibraryStore } from '../libraryStore';

export interface RebuildCtx {
  readonly me: Me;
  readonly areas: readonly AreaRow[];
  /** Alle lesbaren Bibliotheken UND Bazy wiedzy. */
  readonly libraries: readonly OpenLibrary[];
  /** Ihre Speicher, abgeglichen. */
  readonly stores: ReadonlyMap<string, LibraryStore>;
  readonly progress: (line: string) => void;
}

/** Eine Zeile des Plans: wo, was — und ob es geht. */
export interface Change {
  readonly key: string;
  readonly libraryId: string;
  readonly entryId?: string;
  /** Wo: „Biblioteka X · Kazanie Y". */
  readonly where: string;
  /** Was sich ändert, in Worten. */
  readonly what: string;
  /** `false`: das geht nicht (nur lesen dürfen, etwas geht nicht auf) — steht im Plan, wird nicht getan. */
  readonly ok: boolean;
}

export interface RebuildPlan {
  readonly changes: readonly Change[];
  /** Sätze über dem Plan (was nicht geht und warum, was zu prüfen ist). */
  readonly notes: readonly string[];
}

export interface Rebuild {
  readonly id: string;
  readonly title: string;
  /** Ein, zwei Sätze: was diese Umstellung tut und warum. */
  readonly says: string;
  plan(ctx: RebuildCtx): RebuildPlan | Promise<RebuildPlan>;
  /** Tut, was im Plan geht; gibt den Bericht zurück (Zeilen). */
  run(plan: RebuildPlan, ctx: RebuildCtx): Promise<readonly string[]>;
}

/** Der Name einer Bibliothek oder Bazy wiedzy, für Plan und Bericht. */
export const libraryName = (ctx: RebuildCtx, libraryId: string): string =>
  ctx.libraries.find((l) => l.libraryId === libraryId)?.name ?? 'biblioteka';

/** Wer darf hier schreiben? */
export const writes = (ctx: RebuildCtx, libraryId: string): boolean =>
  ctx.libraries.find((l) => l.libraryId === libraryId)?.writes === true;
