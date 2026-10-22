/**
 * VERÖFFENTLICHEN — NUR NOCH FÜR DIE BAZY WIEDZY (Cogita).
 *
 * <b>Eine Bibliothek veröffentlicht nichts mehr</b> (2026-10-22): wer ihre
 * Einträge liest, entscheidet allein ihr Bereich — Mitglieder lesen, und ein
 * öffentlicher Bereich legt seinen Schlüssel offen (`Library.Areas.cs`,
 * `libraryOpen.ts`). Das einzelne Hinausstellen, die privaten Felder und die
 * „Schliesse" (was mit einem Text hinausging) sind fort; der Dienst nimmt für
 * eine Bibliothek nur noch das Zurückziehen alter offener Fassungen an.
 *
 * <b>Was bleibt:</b> eine Baza wiedzy stellt ihre Bündel hinaus — eine
 * Powtórka, einen Przebieg, eine Entität —, jedes mit seiner offenen Fassung
 * in `data.public` (vom Browser gerechnet, `cogita/publish.ts`). Diese Datei
 * plant das: was hinausgeht, was zurückkommt. Ein Eintrag ohne eigene offene
 * Fassung geht nicht hinaus und zieht nichts mit.
 */

import { entrySort, entryTitle, kindOf, type EntryData, type LibEntry, type Lookup } from './libraryKinds';

export type PublishedAs = 'explicit' | 'implicit';

export interface PubEntry extends LibEntry {
  readonly publishedAs: PublishedAs | null;
}

/** Was in der offenen Fassung eines Eintrags steht. */
export interface PublicDoc {
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly title: string;
  readonly data: EntryData;
}

/** Was der Dienst zum Veröffentlichen bekommt (`Library.PublicEntry`). */
export interface PublicEntryIn {
  readonly entryId: string;
  readonly as: PublishedAs;
  readonly key: string | null;
  readonly sort: string;
  readonly summary: string;
  readonly json: string;
  readonly refs: readonly string[];
}

const clip = (text: string, length: number): string => (text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`);

/** Die offene Fassung, die ein Bündel selbst trägt (`data.public`) — oder `null`: es geht nicht hinaus (eine Art der Bibliothek nie). */
const ownPublic = (entry: LibEntry): EntryData | null => {
  if (kindOf(entry.kind) !== undefined) return null;
  const value = entry.data.public;
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as EntryData : null;
};

/** Worauf eine offene Fassung zeigt: was sie selbst nennt (`data.public.refs`). */
export function publicRefs(entry: LibEntry, look: Lookup): string[] {
  const own = ownPublic(entry);
  const refs = own !== null && Array.isArray(own.refs) ? own.refs.filter((r): r is string => typeof r === 'string') : [];
  return [...new Set(refs)].filter((id) => id !== entry.id && look.get(id) !== undefined && ownPublic(look.get(id)!) !== null);
}

/** Alles, was mit diesen Einträgen hinausgeht — Stufe um Stufe, ohne sie selbst. */
export function closure(start: Iterable<string>, look: Lookup): Set<string> {
  const seen = new Set<string>();
  const queue = [...start];
  const roots = new Set(queue);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const entry = look.get(id);
    if (entry === undefined) continue;
    for (const ref of publicRefs(entry, look)) {
      if (seen.has(ref) || roots.has(ref)) continue;
      seen.add(ref);
      queue.push(ref);
    }
  }
  return seen;
}

export function publicDoc(entry: LibEntry, look: Lookup): PublicDoc {
  const own = ownPublic(entry) ?? {};
  return { id: entry.id, kind: entry.kind, title: typeof own.title === 'string' ? own.title : entryTitle(entry, look), data: own };
}

/** Die Kurzfassung für Listen: die Arten und einige Felder in Worten (wie das Bündel sie trägt). */
export function publicSummary(entry: LibEntry, look: Lookup): EntryData {
  const own = ownPublic(entry);
  if (own === null) return { title: entryTitle(entry, look) };
  const kinds = Array.isArray(own.kinds) ? own.kinds.filter((k): k is string => typeof k === 'string').slice(0, 6) : [];
  const list = Array.isArray(own.list) ? own.list.slice(0, 8).flatMap((one) => {
    if (typeof one !== 'object' || one === null) return [];
    const { label, text } = one as { label?: unknown; text?: unknown };
    return typeof label === 'string' && typeof text === 'string' ? [{ label: label.slice(0, 80), text: clip(text, 240) }] : [];
  }) : [];
  return {
    title: typeof own.title === 'string' ? own.title : entry.kind,
    ...(typeof own.summary === 'string' ? { summary: clip(own.summary, 600) } : {}),
    ...(typeof own.format === 'string' ? { format: own.format } : {}),
    ...(kinds.length > 0 ? { kinds } : {}),
    ...(list.length > 0 ? { list } : {})
  };
}

/** Ein Eintrag, wie er zum Dienst geht. */
export function publicEntry(entry: LibEntry, as: PublishedAs, look: Lookup): PublicEntryIn {
  return {
    entryId: entry.id,
    as,
    key: entry.key ?? null,
    sort: entrySort(entry, look),
    summary: JSON.stringify(publicSummary(entry, look)),
    json: JSON.stringify(publicDoc(entry, look)),
    refs: publicRefs(entry, look)
  };
}

/* -- Der Plan --------------------------------------------------------------------------- */

export interface PublishPlan {
  readonly publish: readonly { readonly id: string; readonly as: PublishedAs }[];
  readonly unpublish: readonly string[];
  /** Was neu hinausgeht, ohne ausdrücklich gewählt zu sein — für die Rückfrage vor dem Veröffentlichen. */
  readonly alsoNew: readonly string[];
}

/**
 * DER PLAN EINER ÄNDERUNG DER ÖFFENTLICHKEIT — `add` hinausstellen,
 * `remove` zurückziehen, `refresh` neu schreiben. Hinaus geht nur, was eine
 * eigene offene Fassung trägt; was draussen steht und niemand mehr braucht
 * (auch jeder alte Eintrag einer Bibliothek), kommt zurück.
 */
export function plan(
  entries: readonly PubEntry[], look: Lookup,
  change: { readonly add?: readonly string[]; readonly remove?: readonly string[]; readonly refresh?: readonly string[] }
): PublishPlan {
  const published = new Map(entries.filter((e) => e.publishedAs !== null).map((e) => [e.id, e.publishedAs!]));
  const explicit = new Set([...published].filter(([, as]) => as === 'explicit').map(([id]) => id));
  for (const id of change.add ?? []) explicit.add(id);
  for (const id of change.remove ?? []) explicit.delete(id);

  const live = (id: string) => { const e = look.get(id); return e !== undefined && ownPublic(e) !== null; };
  const roots = [...explicit].filter(live);
  const needed = new Set([...roots, ...closure(roots, look)]);
  const edited = new Set(change.refresh ?? []);
  const unpublish = [...published.keys()].filter((id) => !needed.has(id));
  const fresh = [...needed].filter((id) => {
    const as: PublishedAs = explicit.has(id) ? 'explicit' : 'implicit';
    return !published.has(id) || published.get(id) !== as || edited.has(id);
  });

  return {
    publish: fresh.map((id) => ({ id, as: explicit.has(id) ? 'explicit' as const : 'implicit' as const })),
    unpublish,
    alsoNew: [...needed].filter((id) => !published.has(id) && !(change.add ?? []).includes(id))
  };
}

/** Ob ein Eintrag (noch) draussen gebraucht wird, obwohl man ihn zurückziehen will — und von wem. */
export function neededBy(id: string, entries: readonly PubEntry[], look: Lookup): string[] {
  const roots = entries.filter((e) => e.publishedAs === 'explicit' && e.id !== id).map((e) => e.id);
  return roots.filter((root) => closure([root], look).has(id));
}
