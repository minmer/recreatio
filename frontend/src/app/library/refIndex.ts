/**
 * 2026-10-22 — WER AUF WEN ZEIGT, über alle offenen Speicher (Schritt 4 des
 * Umbaus). Bisher kannte die Bibliothek nur Verweise zwischen Bibliotheken
 * (`LibraryStore.backlinks`) und Cogita nur ihre Verweisfelder (`refIndex`
 * in `cogita/schema.ts`). Hier entsteht EIN Verzeichnis über Bibliotheken
 * und Bazy wiedzy, die dieser Tab offen hat:
 *
 * <code>
 *   Felder         ein Verweis (`work`, ein Feld eines Rodzaj tekstu, ein Verweisfeld der Cogita)
 *   Zapis          [@x, Stelle], ![@x], [[Wort|@x]] — in jedem Text, auch im Plan
 *   Bausteine      Gegenstände eines Komentarza {ref, locator}, Stücke einer Zelle
 *   Quellen        die Quelle eines unsicheren Wertes {work, locator} (Cogita)
 *   Dokumente      Powtórki, Przebiegi, Widoki, Zbiory, Szablony — jede Kennung darin
 * </code>
 *
 * Gerechnet wird im Browser aus dem, was dieser Leser ohnehin lesen kann —
 * nichts wird gespeichert, nichts geht an den Dienst. Ein Ziel, das man nicht
 * lesen kann, steht als Kennung im Verzeichnis und wird nie gezeigt.
 *
 * Stellen der Schrift: ein Verweis auf ein Werk mit `workType: bible` trägt
 * seine Stelle mit (`locator`), `passageHits` sucht danach (`bible.ts`).
 */

import { anyOverlap, bibleKey, parseBible, type BibleSpan } from './bible';
import { markupRefs } from './libraryMarkup';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ein Eintrag, wie das Verzeichnis ihn braucht. */
export interface IndexedEntry {
  readonly id: string;
  readonly kind: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Ein Speicher, wie das Verzeichnis ihn braucht (`LibraryStore` ist einer). */
export interface IndexedStore {
  readonly libraryId: string;
  readonly revision: number;
  all(): readonly IndexedEntry[];
  ownByKey(key: string): IndexedEntry | undefined;
}

export interface Ref {
  /** Die Kennung des Ziels. */
  readonly target: string;
  /** Die Stelle im Ziel („Dz 1,14", „s. 23") — oder leer. */
  readonly locator: string;
  /** Wo im Zeigenden: das Feld (`body`, `plan`, `subjects`, `blocks`, `work`, …). */
  readonly field: string;
  /** Der Punkt, in dem der Verweis steht (ein Punkt des Plans, „co doszło"). */
  readonly at?: string;
}

/** Was nie als Verweis zählt: Buchhaltung der Cogita (Zusammenführungen, Einstellungen mit den Kennungen der Quellen). */
/* 2026-10-24 — und das Verzeichnis eines Quellentexts (`sourceText.ts`): es gehört zum Werk, es verweist nicht darauf. */
const SKIP_KINDS: ReadonlySet<string> = new Set(['merge', 'settings', 'sourcetext', 'sourcepart']);

const MARKUP = /\[@|\|@/;

/**
 * DIE VERWEISE EINES EINTRAGS — jeder Art, ohne die Art zu kennen: Kennungen
 * in Feldern, Verweise im Zapis (Schlüssel werden über `resolve` zu
 * Kennungen), `{ref, locator}`, `{work, locator}`. Felder mit `_` (Buchhaltung)
 * zählen nicht.
 */
export function refsOf(entry: Pick<IndexedEntry, 'data'>, resolve: (token: string) => string | undefined): Ref[] {
  const out: Ref[] = [];
  const seen = new Set<string>();
  const push = (target: string, locator: string, field: string, at: string | undefined) => {
    const key = `${target}\u0000${locator}\u0000${field}\u0000${at ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ target, locator, field, ...(at === undefined ? {} : { at }) });
  };
  const idOf = (token: string): string | undefined => {
    const bare = token.trim().replace(/^@/, '');
    return UUID.test(bare) ? bare.toLowerCase() : resolve(bare);
  };
  const walk = (value: unknown, field: string, at: string | undefined): void => {
    if (typeof value === 'string') {
      if (UUID.test(value)) { push(value.toLowerCase(), '', field, at); return; }
      if (MARKUP.test(value)) for (const one of markupRefs(value)) { const id = idOf(one.key); if (id !== undefined) push(id, one.locator, field, at); }
      return;
    }
    if (Array.isArray(value)) { for (const one of value) walk(one, field, at); return; }
    if (typeof value !== 'object' || value === null) return;
    const o = value as Record<string, unknown>;
    /* Ein Punkt eines Plans (oder eine Zeile von „co doszło") trägt seine eigene, kurze Kennung. */
    const here = typeof o.id === 'string' && !UUID.test(o.id) ? o.id : at;
    const locator = typeof o.locator === 'string' ? o.locator.trim() : '';
    if (typeof o.ref === 'string') { const id = idOf(o.ref); if (id !== undefined) push(id, locator, field === '' ? 'ref' : field, here); }
    /* 2026-10-22 (Schritt 11) — ein Wert eines Cogita-Feldes mit Stelle: { value, locator } (ein Psalm: Biblia, „Ps 110"). */
    const valuePlace = typeof o.value === 'string' && locator !== '' && UUID.test(o.value);
    if (valuePlace) push((o.value as string).toLowerCase(), locator, field === '' ? 'value' : field, here);
    const withWork = o.work !== undefined && typeof o.locator === 'string';
    if (withWork) {
      for (const w of Array.isArray(o.work) ? o.work : [o.work]) {
        if (typeof w !== 'string') continue;
        const id = idOf(w);
        if (id !== undefined) push(id, locator, field === '' ? 'work' : field, here);
      }
    }
    for (const [key, one] of Object.entries(o)) {
      if (key === 'ref' || key === 'id' || key.startsWith('_') || (key === 'work' && withWork) || (key === 'value' && valuePlace)) continue;
      walk(one, field === '' ? key : field, here);
    }
  };
  walk(entry.data, '', undefined);
  return out;
}

/* -- Das Verzeichnis ---------------------------------------------------------------------------- */

type EntryOf<S extends IndexedStore> = ReturnType<S['all']>[number];

export interface Hit<S extends IndexedStore> {
  /** Wer zeigt. */
  readonly from: EntryOf<S>;
  /** Wo der Zeigende liegt. */
  readonly store: S;
  readonly ref: Ref;
}

export class ReferenceIndex<S extends IndexedStore> {
  private readonly byTarget = new Map<string, Hit<S>[]>();

  /** `books`: welche Speicher Bibliotheken sind — ein Schlüssel gilt zuerst im eigenen Speicher, dann in den Bibliotheken. */
  constructor(readonly stores: readonly S[], books: (store: S) => boolean) {
    const order = [...stores.filter(books), ...stores.filter((s) => !books(s))];
    for (const store of stores) {
      const resolve = (token: string): string | undefined => {
        const here = store.ownByKey(token);
        if (here !== undefined) return here.id;
        for (const other of order) {
          if (other === store) continue;
          const there = other.ownByKey(token);
          if (there !== undefined) return there.id;
        }
        return undefined;
      };
      for (const entry of store.all() as EntryOf<S>[]) {
        if (SKIP_KINDS.has(entry.kind)) continue;
        for (const ref of refsOf(entry, resolve)) {
          if (ref.target === entry.id) continue;
          const list = this.byTarget.get(ref.target);
          if (list === undefined) this.byTarget.set(ref.target, [{ from: entry, store, ref }]);
          else list.push({ from: entry, store, ref });
        }
      }
    }
  }

  /** Wer auf einen Eintrag zeigt — jeder Verweis einzeln (ein Text, der ihn zweimal nennt, steht zweimal da). */
  to(id: string): readonly Hit<S>[] {
    return this.byTarget.get(id.toLowerCase()) ?? [];
  }

  /** Wer auf einen von mehreren zeigt. */
  toAny(ids: Iterable<string>): Hit<S>[] {
    return [...new Set(ids)].flatMap((id) => [...this.to(id)]);
  }
}

let memo: { readonly stamp: string; readonly index: ReferenceIndex<IndexedStore> } | null = null;

/** Das Verzeichnis über diese Speicher — neu gerechnet nur, wenn sich einer geändert hat. */
export function referenceIndex<S extends IndexedStore>(stores: readonly S[], books: (store: S) => boolean = () => true): ReferenceIndex<S> {
  const stamp = stores.map((s) => `${s.libraryId}:${s.revision}`).join('|');
  if (memo !== null && memo.stamp === stamp) return memo.index as unknown as ReferenceIndex<S>;
  const index = new ReferenceIndex(stores, books);
  memo = { stamp, index: index as unknown as ReferenceIndex<IndexedStore> };
  return index;
}

/* -- Stellen der Schrift ------------------------------------------------------------------------ */

const isBible = (entry: IndexedEntry): boolean => entry.kind === 'work' && entry.data.workType === 'bible';

export interface PassageHit<S extends IndexedStore> {
  readonly hit: Hit<S>;
  /** Die Ausgabe der Schrift, auf die verwiesen wird (Biblia Tysiąclecia, Vulgata …). */
  readonly work: EntryOf<S>;
  readonly spans: readonly BibleSpan[];
}

/**
 * WAS AUF EINE STELLE DER SCHRIFT ZEIGT — in jeder Ausgabe, die dieser Leser
 * offen hat: Zitate, Komentarze (ihre Gegenstände und Zellen), Punkte eines
 * Plans, Texte, Einträge der Bazy wiedzy. Geordnet nach dem Kanon.
 */
export function passageHits<S extends IndexedStore>(index: ReferenceIndex<S>, query: readonly BibleSpan[]): PassageHit<S>[] {
  if (query.length === 0) return [];
  const out: PassageHit<S>[] = [];
  for (const store of index.stores) {
    for (const work of store.all() as EntryOf<S>[]) {
      if (!isBible(work)) continue;
      for (const hit of index.to(work.id)) {
        if (hit.ref.locator === '') continue;
        const spans = parseBible(hit.ref.locator);
        if (anyOverlap(spans, query)) out.push({ hit, work, spans });
      }
    }
  }
  return out.sort((a, b) => bibleKey(a.hit.ref.locator).localeCompare(bibleKey(b.hit.ref.locator)));
}
