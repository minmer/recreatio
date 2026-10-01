/**
 * WAS AUS DER BIBLIOTHEK HINAUSGEHT (0064) — und was mit ihm.
 *
 * <b>Veröffentlicht wird ausdrücklich.</b> Wer eine Predigt hinausstellt,
 * stellt mit ihr hinaus, was sie nennt: die Zitate, ihre Werke, deren
 * Autoren, die Themen, das Projekt — sonst stünden auf der Seite Fussnoten
 * ins Leere. Diese gehen als `implicit` hinaus; was man selbst hinausstellt
 * (eine Predigt, ein Zitat für die Sammlung), als `explicit`.
 *
 * <b>Zurückgezogen wird nur, was niemand mehr braucht.</b> Wer ein Zitat
 * aus der Sammlung nimmt, das eine veröffentlichte Predigt nennt, nimmt es
 * aus der Sammlung — öffentlich bleibt es, bis auch die Predigt geht.
 *
 * Alles hier ist reine Rechnung über den Bestand im Browser: wer was
 * braucht, wie die offene Fassung aussieht, wie die Kurzfassung für Listen.
 * Gesendet wird in `libraryStore.ts`.
 */

import { authorOf, originOf, personShort, segText, workSegs } from './libraryCite';
import {
  entrySort, entryTitle, ids, kindOf, outline, personName, publicData, str, wordCount,
  type EntryData, type LibEntry, type Lookup
} from './libraryKinds';
import { citedKeys, excerpt } from './libraryMarkup';

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

const clip = (text: string, length: number): { text: string; truncated: boolean } =>
  text.length <= length ? { text, truncated: false } : { text: `${text.slice(0, length - 1).trimEnd()}…`, truncated: true };

/**
 * WORAUF EINE OFFENE FASSUNG ZEIGT — und was deshalb mit ihr hinausgeht.
 *
 * Die öffentlichen Verweisfelder, und bei einem Text die Schlüssel in seinem
 * Zapis. Nicht die Gliederung eines Projekts: wer einen Text eines Buches
 * veröffentlicht, veröffentlicht nicht das ganze Buch.
 */
export function publicRefs(entry: LibEntry, look: Lookup): string[] {
  const def = kindOf(entry.kind);
  if (def === undefined) return [];
  const out = new Set<string>();
  for (const field of def.fields) {
    if (field.private === true) continue;
    if (field.type === 'ref' || field.type === 'refs') ids(entry.data, field.key).forEach((one) => out.add(one));
    if (field.type === 'markup') {
      for (const key of citedKeys(str(entry.data, field.key))) {
        const target = look.byKey(key);
        if (target !== undefined) out.add(target.id);
      }
    }
  }
  out.delete(entry.id);
  return [...out].filter((id) => look.get(id) !== undefined);
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

/** Die offene Fassung: öffentliche Felder; die Gliederung eines Projekts nur mit veröffentlichten Texten. */
export function publicDoc(entry: LibEntry, look: Lookup, isPublic: (id: string) => boolean): PublicDoc {
  const data = publicData(entry);
  if (entry.kind === 'project' && Array.isArray(data.outline)) {
    data.outline = outline(entry.data).filter((item) => !('text' in item) || isPublic(item.text));
  }
  return { id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), title: entryTitle(entry, look), data };
}

const topicsOf = (entry: LibEntry, look: Lookup) =>
  ids(entry.data, 'topics').map((id) => look.get(id)).filter((t): t is LibEntry => t !== undefined)
    .map((t) => ({ id: t.id, name: str(t.data, 'name') }));

/** Die Kurzfassung für Listen (und die öffentliche Suche) — je Art, was eine Liste zeigt. */
export function publicSummary(entry: LibEntry, look: Lookup, isPublic: (id: string) => boolean): EntryData {
  const d = entry.data;
  switch (entry.kind) {
    case 'text': {
      const project = look.get(ids(d, 'project')[0] ?? '');
      const lead = str(d, 'summary').trim() || excerpt(str(d, 'body'), 320);
      return {
        title: str(d, 'title'), subtitle: str(d, 'subtitle'), textType: str(d, 'textType'),
        date: str(d, 'date'), occasion: str(d, 'occasion'), place: str(d, 'place'), readings: str(d, 'readings'),
        summary: clip(lead, 600).text, topics: topicsOf(entry, look),
        project: project === undefined ? null : { id: project.id, title: str(project.data, 'title') },
        words: wordCount(str(d, 'body')), audio: str(d, 'audio'), video: str(d, 'video'),
        further: str(d, 'further').trim() !== ''
      };
    }
    case 'quote': {
      const text = clip(str(d, 'text').trim(), 1200);
      const work = look.get(ids(d, 'work')[0] ?? '');
      return {
        text: text.text, truncated: text.truncated, locator: str(d, 'locator'), origin: originOf(entry, look),
        author: personShort(authorOf(entry, look)),
        work: work === undefined ? null : { id: work.id, title: str(work.data, 'title') },
        description: clip(str(d, 'description').trim(), 700).text, translation: clip(str(d, 'translation').trim(), 600).text,
        topics: topicsOf(entry, look)
      };
    }
    case 'work':
      return {
        title: str(d, 'title'), workType: str(d, 'workType'), cite: segText(workSegs(entry, look, 'bib')),
        authors: ids(d, 'authors').map((id) => personName(look.get(id)?.data ?? {})), year: str(d, 'year'),
        description: clip(str(d, 'description').trim(), 400).text
      };
    case 'person':
      return { name: personName(d), years: str(d, 'years'), description: clip(str(d, 'description').trim(), 300).text };
    case 'topic': {
      const parent = look.get(ids(d, 'parent')[0] ?? '');
      return { name: str(d, 'name'), parent: parent === undefined ? null : { id: parent.id, name: str(parent.data, 'name') } };
    }
    case 'project':
      return {
        title: str(d, 'title'), subtitle: str(d, 'subtitle'), projectType: str(d, 'projectType'),
        description: clip(str(d, 'description').trim(), 600).text,
        texts: outline(d).filter((item) => 'text' in item && isPublic(item.text)).length
      };
    default:
      return { title: entryTitle(entry, look) };
  }
}

/** Ein Eintrag, wie er zum Dienst geht. */
export function publicEntry(entry: LibEntry, as: PublishedAs, look: Lookup, isPublic: (id: string) => boolean): PublicEntryIn {
  return {
    entryId: entry.id,
    as,
    key: entry.key ?? null,
    sort: entrySort(entry, look),
    summary: JSON.stringify(publicSummary(entry, look, isPublic)),
    json: JSON.stringify(publicDoc(entry, look, isPublic)),
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
 * DER PLAN EINER ÄNDERUNG DER ÖFFENTLICHKEIT.
 *
 * <code>
 *   add       ausdrücklich hinausstellen (eine Predigt, ein Zitat)
 *   remove    ausdrücklich zurückziehen
 *   refresh   geändert — ihre offene Fassung neu schreiben, wenn sie draussen sind
 * </code>
 *
 * Neu geschrieben wird, was sich geändert hat, was erst jetzt hinausgeht, was
 * seine Art (explicit/implicit) wechselt, und wessen Kurzfassung das Geänderte
 * nennt (ein Zitat nennt den Autor seines Werks). Zurückgezogen wird, was
 * draussen ist und niemand mehr braucht.
 */
export function plan(
  entries: readonly PubEntry[], look: Lookup,
  change: { readonly add?: readonly string[]; readonly remove?: readonly string[]; readonly refresh?: readonly string[] }
): PublishPlan {
  const published = new Map(entries.filter((e) => e.publishedAs !== null).map((e) => [e.id, e.publishedAs!]));
  const explicit = new Set([...published].filter(([, as]) => as === 'explicit').map(([id]) => id));
  for (const id of change.add ?? []) explicit.add(id);
  for (const id of change.remove ?? []) explicit.delete(id);

  const live = (id: string) => look.get(id) !== undefined;
  const roots = [...explicit].filter(live);
  const needed = new Set([...roots, ...closure(roots, look)]);

  const edited = new Set(change.refresh ?? []);
  const fresh = new Set<string>();
  const unpublish = [...published.keys()].filter((id) => !needed.has(id));

  /* Was neu hinausgeht, seine Art wechselt oder geändert wurde. */
  for (const id of needed) {
    const as: PublishedAs = explicit.has(id) ? 'explicit' : 'implicit';
    if (!published.has(id) || published.get(id) !== as || edited.has(id)) fresh.add(id);
  }

  /*
   * Wessen Kurzfassung den geänderten INHALT nennt — zwei Stufen (ein Zitat
   * nennt sein Werk und dessen Autor). Wer nur seine Öffentlichkeit wechselt,
   * ändert keine Kurzfassung eines anderen.
   */
  if (edited.size > 0) {
    const direct = new Map([...needed].map((id) => [id, new Set(publicRefs(look.get(id)!, look))]));
    for (const id of needed) {
      const refs = direct.get(id)!;
      const second = [...refs].some((r) => [...(direct.get(r) ?? [])].some((s) => edited.has(s)));
      if ([...refs].some((r) => edited.has(r)) || second) fresh.add(id);
    }
  }

  /* Ein Projekt zeigt öffentlich nur seine veröffentlichten Texte — es folgt, wenn ein Text hinaus- oder hereingeht. */
  const moved = [...needed].filter((id) => !published.has(id)).concat(unpublish);
  for (const id of moved) {
    const entry = look.get(id);
    if (entry?.kind !== 'text') continue;
    for (const project of ids(entry.data, 'project')) if (needed.has(project)) fresh.add(project);
  }

  const alsoNew = [...needed].filter((id) => !published.has(id) && !(change.add ?? []).includes(id));

  return {
    publish: [...fresh].map((id) => ({ id, as: explicit.has(id) ? 'explicit' as const : 'implicit' as const })),
    unpublish,
    alsoNew
  };
}

/** Ob ein Eintrag (noch) draussen gebraucht wird, obwohl man ihn zurückziehen will — und von wem. */
export function neededBy(id: string, entries: readonly PubEntry[], look: Lookup): string[] {
  const roots = entries.filter((e) => e.publishedAs === 'explicit' && e.id !== id).map((e) => e.id);
  return roots.filter((root) => closure([root], look).has(id));
}

