/**
 * 2026-10-22 — DIE BIBLIOTHEK EINES BEREICHS für die Umbauten, die etwas aus
 * einer Baza wiedzy in eine Bibliothek tragen (Wiedza → komentarze, Tematy):
 * immer in DENSELBEN Bereich — der Dienst erlaubt den Umzug aus einer Baza
 * nur so, und niemand liest danach, was er vorher nicht lesen durfte. Ist dort
 * keine Bibliothek, in der ich schreiben darf, wird eine angelegt; die
 * Bibliothek wird Quelle der Baza (Ustawienia → źródła), damit sie sieht, was
 * hinübergezogen ist.
 */

import { createLibrary, libraryKindOf, loadLibraries, openLibraries } from '../library';
import { str } from '../libraryKinds';
import { storeOf, type LibraryStore } from '../libraryStore';
import type { RebuildCtx } from './rebuild';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const areaName = (ctx: RebuildCtx, areaId: string): string => ctx.areas.find((a) => a.areaId === areaId)?.name ?? 'obszar';

/** Wie eine neue Bibliothek des Bereichs heisst. */
export const newLibraryName = (ctx: RebuildCtx, areaId: string): string => `Komentarze — ${areaName(ctx, areaId)}`;

/** Die Bibliothek des Bereichs einer Baza: eine ihrer Quellen dort zuerst, dann jede, in der ich schreiben darf — sonst `null`. */
export function targetIn(ctx: RebuildCtx, base: LibraryStore): string | null {
  const settings = base.all().find((e) => e.kind === 'settings');
  const sources = new Set((Array.isArray(settings?.data.sources) ? settings!.data.sources : []).map((s) => (isObject(s) ? str(s, 'id') : '')));
  const candidates = ctx.libraries.filter((l) => libraryKindOf(l) === 'books' && l.areaId === base.areaId && l.writes);
  return (candidates.find((l) => sources.has(l.libraryId)) ?? candidates[0])?.libraryId ?? null;
}

/**
 * Den Speicher der Bibliothek des Bereichs — angelegt, wenn es keine gibt
 * (einmal je Bereich: \`made\` merkt sich, was dieser Lauf schon angelegt hat).
 */
export async function libraryFor(ctx: RebuildCtx, base: LibraryStore, made: Map<string, LibraryStore>, report: string[]): Promise<LibraryStore> {
  const known = made.get(base.areaId);
  if (known !== undefined) return known;
  let targetId = targetIn(ctx, base);
  const opened = targetId === null ? undefined : ctx.stores.get(targetId);
  if (opened !== undefined) { made.set(base.areaId, opened); return opened; }
  if (targetId === null) {
    const name = newLibraryName(ctx, base.areaId);
    ctx.progress(`Zakładanie biblioteki „${name}”…`);
    targetId = await createLibrary(ctx.me.ring, base.areaId, name);
    report.push(`Założono bibliotekę „${name}” w obszarze „${areaName(ctx, base.areaId)}”.`);
  }
  const rows = await openLibraries(ctx.me.ring, (await loadLibraries()).libraries);
  const row = rows.find((r) => r.libraryId === targetId);
  if (row === undefined) throw new Error('nie widać biblioteki docelowej');
  const store = storeOf(ctx.me.ring, row);
  await store.sync();
  made.set(base.areaId, store);
  return store;
}

/** Die Bibliothek als Quelle der Baza — wenn sie es noch nicht ist. */
export async function linkSource(ctx: RebuildCtx, base: LibraryStore, target: LibraryStore, report: string[]): Promise<void> {
  const settings = base.all().find((e) => e.kind === 'settings');
  const sources = Array.isArray(settings?.data.sources) ? settings!.data.sources.filter(isObject) : [];
  if (sources.some((s) => str(s, 'id') === target.libraryId)) return;
  const name = ctx.libraries.find((l) => l.libraryId === target.libraryId)?.name ?? newLibraryName(ctx, base.areaId);
  await base.save({ ...(settings === undefined ? {} : { id: settings.id }), kind: 'settings', data: { ...(settings?.data ?? {}), sources: [...sources, { id: target.libraryId, kind: 'books', name }] } });
  report.push(`„${ctx.libraries.find((l) => l.libraryId === base.libraryId)?.name ?? 'Baza wiedzy'}” korzysta teraz z biblioteki „${name}”.`);
}
