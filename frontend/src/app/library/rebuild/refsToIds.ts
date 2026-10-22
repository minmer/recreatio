/**
 * UMBAU 2 — ODWOŁANIA: KLUCZE → STAŁE ODNOŚNIKI (Kennungen).
 *
 * Seit 2026-10-22 speichert jeder Text die Kennung eines zitierten Eintrags,
 * nicht seinen Schlüssel (`storedMarkup`): ein Schlüssel ist eine
 * Schreibhilfe und darf sich ändern. Was vorher gespeichert wurde, steht noch
 * mit Schlüsseln da — dieser Umbau schreibt es um, Eintrag für Eintrag unter
 * derselben Kennung. Was nicht aufgeht (ein Schlüssel, den kein lesbarer
 * Eintrag hat), bleibt, wie es ist, und steht im Plan.
 *
 * Auch die Bazy wiedzy: ihr Zapis `[[Wort|@token]]` bekommt die Kennung, wo
 * das Token ein Schlüssel einer lesbaren Bibliothek ist.
 */

import { kindOf, mapMarkups, type EntryData, type LibEntry, type Lookup } from '../libraryKinds';
import { mapRefTokens } from '../libraryMarkup';
import { libraryKindOf } from '../library';
import type { LibraryStore } from '../libraryStore';
import { libraryName, writes, type Change, type Rebuild, type RebuildCtx, type RebuildPlan } from './rebuild';

/** Jede Zeichenkette eines Eintrags einer Baza wiedzy (ausser den inneren `_…`) — ihre Arten stehen nicht in `KINDS`. */
function mapAllStrings(data: EntryData, fn: (text: string) => string): EntryData {
  let changed = false;
  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') { const next = fn(value); if (next !== value) changed = true; return next; }
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === 'object' && value !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = k.startsWith('_') ? v : walk(v);
      return out;
    }
    return value;
  };
  const out = walk(data) as EntryData;
  return changed ? out : data;
}

/** Wie ein Token von dieser Bibliothek aus aufgeht: eine Bibliothek fragt sich und ihre Nachbarn, eine Baza wiedzy dazu alle Bibliotheken. */
function lookFor(ctx: RebuildCtx, store: LibraryStore): Lookup {
  if (libraryKindOf(ctx.libraries.find((l) => l.libraryId === store.libraryId) ?? {}) === 'books') return store;
  const books = [...ctx.stores.values()].filter((s) => libraryKindOf(ctx.libraries.find((l) => l.libraryId === s.libraryId) ?? {}) === 'books');
  return {
    get: (id) => store.get(id) ?? books.map((b) => b.own(id)).find((e) => e !== undefined),
    byKey: (key) => store.byKey(key) ?? books.map((b) => b.ownByKey(key)).find((e) => e !== undefined)
  };
}

interface Converted { readonly data: EntryData; readonly pinned: number; readonly lost: readonly string[] }

function convert(entry: LibEntry, look: Lookup): Converted {
  let pinned = 0;
  const lost = new Set<string>();
  const map = (text: string) => mapRefTokens(text, (token) => {
    if (look.get(token) !== undefined) return token;
    const id = look.byKey(token)?.id;
    if (id === undefined) { lost.add(token); return token; }
    pinned += 1;
    return id;
  });
  const data = kindOf(entry.kind) === undefined ? mapAllStrings(entry.data, map) : mapMarkups(entry.kind, entry.data, map);
  return { data, pinned, lost: [...lost] };
}

export const refsToIds: Rebuild = {
  id: 'odwolania',
  title: 'Odwołania w tekstach',
  says: 'Teksty zapisują odtąd stały odnośnik do wpisu (kennungę) zamiast klucza cytowania — klucz zostaje do pisania i można go zmieniać bez psucia tekstów. Tu przepisuje się teksty zapisane wcześniej, w każdej bibliotece i bazie wiedzy, w której możesz pisać.',

  plan(ctx: RebuildCtx): RebuildPlan {
    const changes: Change[] = [];
    for (const store of ctx.stores.values()) {
      const look = lookFor(ctx, store);
      const may = writes(ctx, store.libraryId);
      for (const entry of store.all()) {
        const done = convert(entry, look);
        const where = `${libraryName(ctx, store.libraryId)} · ${store.title(entry)}`;
        if (done.pinned > 0) {
          changes.push({
            key: `${entry.id}:pin`, libraryId: store.libraryId, entryId: entry.id, where, ok: may,
            what: may ? `${done.pinned} ${done.pinned === 1 ? 'odwołanie' : 'odwołań'}: klucz → stały odnośnik` : 'tylko do odczytu — zostaje przy kluczach (działają dalej)'
          });
        }
        for (const token of done.lost) {
          changes.push({ key: `${entry.id}:lost:${token}`, libraryId: store.libraryId, entryId: entry.id, where, ok: false, what: `„@${token}” nie wskazuje żadnego wpisu, który widzisz — zostaje, jak jest` });
        }
      }
    }
    return { changes, notes: [] };
  },

  async run(plan: RebuildPlan, ctx: RebuildCtx): Promise<readonly string[]> {
    let done = 0;
    let failed = 0;
    const todo = plan.changes.filter((c) => c.ok && c.entryId !== undefined && c.key.endsWith(':pin'));
    for (const [index, change] of todo.entries()) {
      const store = ctx.stores.get(change.libraryId);
      const entry = store?.own(change.entryId!);
      if (store === undefined || entry === undefined) continue;
      ctx.progress(`Przepisywanie ${index + 1} z ${todo.length}…`);
      const next = convert(entry, lookFor(ctx, store));
      if (next.pinned === 0) continue;
      try {
        await store.save({ id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: next.data });
        done += 1;
      } catch {
        failed += 1;
      }
    }
    return [`Przepisano wpisów: ${done}.`, ...(failed > 0 ? [`Nie udało się: ${failed} — spróbuj jeszcze raz.`] : [])];
  }
};
