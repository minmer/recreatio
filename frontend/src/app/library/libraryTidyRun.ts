/**
 * DIE UMSTELLUNG AUSFÜHREN (2026-10-22) — die zwei Schritte des Plans aus
 * `libraryMigrate.ts`: erst Komentarze anlegen (die alten Werte bleiben),
 * dann — nach ausdrücklicher Bestätigung — aufräumen, umziehen, die alten
 * offenen Fassungen zurückziehen, die Bibliotheken als durchgesehen melden.
 */

import { ensurePrivateArea } from '../calendar/agenda';
import type { AreaRow } from '../areas/area';
import type { Me } from '../core/me';
import { blockData, legacyBlocks } from './comment';
import { createLibrary, settleLibrary, withdrawEntries } from './library';
import { legacyFields, PERSONAL, stripped, type TidyLibrary, type TidyPlan } from './libraryMigrate';
import { storeOf, type LibraryStore } from './libraryStore';

export interface TidyContext {
  readonly me: Me;
  readonly areas: readonly AreaRow[];
  readonly libs: readonly TidyLibrary[];
  readonly progress: (line: string) => void;
}

/** Die private Bibliothek — die vorhandene, oder eine neue im privaten Bereich. */
async function personalStore(ctx: TidyContext, plan: TidyPlan): Promise<LibraryStore> {
  if (plan.personal !== PERSONAL) return ctx.libs.find((l) => l.library.libraryId === plan.personal)!.store;
  const area = await ensurePrivateArea(ctx.me.ring, ctx.me.person, ctx.areas);
  const libraryId = await createLibrary(ctx.me.ring, area, 'Prywatna biblioteka');
  const store = storeOf(ctx.me.ring, { libraryId, areaId: area });
  await store.sync();
  return store;
}

/** SCHRITT 1 — die Komentarze entstehen (Kopien); an den alten Werten ändert sich nichts. */
export async function prepare(plan: TidyPlan, ctx: TidyContext): Promise<{ made: number; failed: string[] }> {
  const todo = plan.comments.filter((c) => c.existing === null);
  const storeFor = new Map(ctx.libs.map((l) => [l.library.libraryId, l.store]));
  let personal: LibraryStore | null = null;
  let made = 0;
  const failed: string[] = [];
  for (const [index, c] of todo.entries()) {
    ctx.progress(`Komentarz ${index + 1} z ${todo.length}…`);
    try {
      let store = storeFor.get(c.target === 'with-entry' ? c.from : c.target);
      if (c.target === PERSONAL) store = personal ??= await personalStore(ctx, plan);
      if (store === undefined) throw new Error('Nie ma biblioteki docelowej.');
      await store.save({
        kind: 'comment',
        data: { subjects: [{ ref: c.entryId, ...(c.point === '' ? {} : { point: c.point }) }], blocks: legacyBlocks(c.value).map(blockData) }
      });
      made += 1;
    } catch (e) {
      failed.push(`${c.key}: ${e instanceof Error ? e.message : 'nie udało się'}`);
    }
  }
  return { made, failed };
}

/**
 * SCHRITT 2 — erst wenn jeder alte Wert einen Komentarz hat: die alten
 * Felder gehen, Einträge ziehen um (die Komentarze aus ihrer description
 * mit), die alten offenen Fassungen kommen zurück, die Bibliotheken gelten
 * als durchgesehen. Jeder Teil lässt sich wiederholen.
 */
export async function finish(plan: TidyPlan, choices: ReadonlyMap<string, string | null>, ctx: TidyContext): Promise<string[]> {
  const missing = plan.comments.filter((c) => c.existing === null);
  if (missing.length > 0) throw new Error(`Najpierw krok 1 — ${missing.length} wartości nie ma jeszcze w komentarzach.`);
  const storeFor = new Map(ctx.libs.map((l) => [l.library.libraryId, l.store]));
  const done: string[] = [];

  /* 1. Die alten Felder weg — vor jedem Umzug: in eine öffentliche Bibliothek geht nichts Altes mit. */
  for (const [index, one] of plan.strip.entries()) {
    ctx.progress(`Porządkowanie ${index + 1} z ${plan.strip.length}…`);
    const store = storeFor.get(one.libraryId);
    const entry = store?.own(one.entryId);
    if (store === undefined || entry === undefined || legacyFields(entry).length === 0) continue;
    await store.save({ id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: stripped(entry) });
  }
  done.push(`Usunięto stare pola z ${plan.strip.length} wpisów.`);

  /* 2. Umzüge — und mit dem Eintrag die Komentarze aus seiner description. */
  let moved = 0;
  const keyNotes: string[] = [];
  let personal: LibraryStore | null = null;
  for (const move of plan.moves) {
    const target = choices.has(move.entryId) ? choices.get(move.entryId)! : move.target;
    if (target === null) continue;
    const from = storeFor.get(move.from);
    const into = target === PERSONAL ? (personal ??= await personalStore(ctx, plan)) : storeFor.get(target);
    if (from === undefined || into === undefined || from.own(move.entryId) === undefined) continue;
    ctx.progress(`Przenoszenie ${moved + 1}…`);
    const result = await from.moveTo(move.entryId, into);
    /* 2026-10-22 — drüben war der Schlüssel vergeben: sagen, nicht verschweigen (Texte zeigen über die Kennung, der alte bleibt als zweiter). */
    if (result.keyChanged) keyNotes.push(`Klucz „${result.from ?? ''}” był w tamtej bibliotece zajęty — wpis ma teraz „${result.entry.key ?? ''}”; stary zostaje przy nim, a teksty wskazują go stałym odnośnikiem.`);
    moved += 1;
    for (const c of plan.comments) {
      if (c.entryId !== move.entryId || c.target !== 'with-entry' || c.existing === null) continue;
      if (from.own(c.existing) !== undefined) await from.moveTo(c.existing, into);
    }
  }
  done.push(`Przeniesiono ${moved} wpisów.`, ...keyNotes);

  /* 3. Die alten offenen Fassungen zurückziehen. */
  for (const [libraryId, ids] of plan.unpublish) {
    for (let i = 0; i < ids.length; i += 400) await withdrawEntries(libraryId, ids.slice(i, i + 400));
  }
  done.push(`Wycofano stare publiczne kopie: ${[...plan.unpublish.values()].reduce((n, ids) => n + ids.length, 0)}.`);

  /* 4. Durchgesehen — erst jetzt liest ein öffentlicher Bereich seine Bibliothek offen. */
  for (const libraryId of plan.settle) await settleLibrary(libraryId);
  done.push(`Przejrzane biblioteki: ${plan.settle.length}.`);
  return done;
}
