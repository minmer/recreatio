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
  entrySort, entryTitle, ids, isAspect, itemsOf, kindOf, markupsOf, num, outline, personName, publicData, str, wordCount,
  type EntryData, type LibEntry, type Lookup
} from './libraryKinds';
import { citedKeys, excerpt } from './libraryMarkup';
import { addedOf, coverageCounts, coverageOf, deliveriesOf, lastHeld, planOf, pointLine, textsOf } from './sermon';

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

/** Die Themen über einem Thema — höchstens zwanzig Stufen. */
function topicAncestors(id: string, look: Lookup): string[] {
  const out: string[] = [];
  let at = look.get(id);
  for (let step = 0; step < 20 && at !== undefined; step += 1) {
    const parent = ids(at.data, 'parent')[0];
    if (parent === undefined || parent === id || out.includes(parent)) break;
    out.push(parent);
    at = look.get(parent);
  }
  return out;
}

/**
 * WORAUF EINE OFFENE FASSUNG ZEIGT — und was deshalb mit ihr hinausgeht.
 *
 * Die öffentlichen Verweisfelder, und bei einem Text die Schlüssel in seinem
 * Zapis. Nicht die Gliederung eines Projekts: wer einen Text eines Buches
 * veröffentlicht, veröffentlicht nicht das ganze Buch.
 *
 * 2026-10-21 — dazu:
 * - der Zapis in den Unterfeldern (die Punkte des Plans, „co doszło");
 * - bei Themen eines Eintrags (`topics`) auch die darüber: wer „Adwent" trägt,
 *   steht auch unter „Okres liturgiczny" — so findet ein Filter auf ein Thema
 *   alles darunter, und die Zahlen im Baum stimmen, ohne dass der Dienst den
 *   Baum kennt;
 * - bei einem Text seine Wygłoszenia (ohne die privaten): sie gehen mit ihm
 *   hinaus, und EINE Anfrage holt die Predigt samt Aufnahmen.
 */
export function publicRefs(entry: LibEntry, look: Lookup): string[] {
  const def = kindOf(entry.kind);
  if (def === undefined) return [];
  const out = new Set<string>();
  for (const field of def.fields) {
    if (field.private === true) continue;
    if (field.type === 'ref' || field.type === 'refs') {
      const found = ids(entry.data, field.key);
      found.forEach((one) => out.add(one));
      if (field.type === 'refs' && field.to?.length === 1 && field.to[0] === 'topic') for (const topic of found) topicAncestors(topic, look).forEach((one) => out.add(one));
    }
    if (field.type === 'items') {
      for (const item of itemsOf(entry.data, field.key)) {
        for (const sub of field.item ?? []) if (sub.private !== true && (sub.type === 'ref' || sub.type === 'refs')) ids(item, sub.key).forEach((one) => out.add(one));
      }
    }
  }
  for (const key of citedKeys(...markupsOf(entry, true))) {
    const target = look.byKey(key);
    if (target !== undefined) out.add(target.id);
  }
  if (entry.kind === 'text') for (const delivery of deliveriesOf(entry, look)) out.add(delivery.id);
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

/**
 * 0109 — COGITA: ein Eintrag einer anderen Art (eine Wiederholung, ein Ablauf,
 * eine Entität) trägt seine offene Fassung selbst — `data.public`, vom
 * Browser vor dem Veröffentlichen gerechnet (die Karten einer Wiederholung,
 * der Inhalt eines Ablaufs). Sonst geht von ihm nichts hinaus.
 */
const ownPublic = (entry: LibEntry): EntryData | null => {
  if (kindOf(entry.kind) !== undefined) return null;
  const value = entry.data.public;
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as EntryData : null;
};

/** Die offene Fassung: öffentliche Felder; die Gliederung eines Projekts nur mit veröffentlichten Texten. */
export function publicDoc(entry: LibEntry, look: Lookup, isPublic: (id: string) => boolean): PublicDoc {
  const own = ownPublic(entry);
  if (own !== null) {
    return { id: entry.id, kind: entry.kind, title: typeof own.title === 'string' ? own.title : entry.kind, data: own };
  }
  const data = publicData(entry);
  if (entry.kind === 'project' && Array.isArray(data.outline)) {
    data.outline = outline(entry.data).filter((item) => !('text' in item) || isPublic(item.text));
  }
  /*
   * 2026-10-21 — ein Text nennt seine Wygłoszenia (ohne die privaten), neueste
   * zuerst: die Seite liest sie aus der einen Anfrage, und ein neues
   * Wygłoszenie macht den Text „nicht aktuell" — „Zaktualizuj publikację"
   * nimmt es mit hinaus.
   */
  if (entry.kind === 'text') {
    const deliveries = deliveriesOf(entry, look).map((one) => one.id);
    if (deliveries.length > 0) data.deliveries = deliveries;
  }
  return { id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), title: entryTitle(entry, look), data };
}

const topicsOf = (entry: LibEntry, look: Lookup) =>
  ids(entry.data, 'topics').map((id) => look.get(id)).filter((t): t is LibEntry => t !== undefined)
    .map((t) => ({ id: t.id, name: str(t.data, 'name') }));

/** Die Kurzfassung für Listen (und die öffentliche Suche) — je Art, was eine Liste zeigt. */
export function publicSummary(entry: LibEntry, look: Lookup, isPublic: (id: string) => boolean): EntryData {
  const d = entry.data;
  const own = ownPublic(entry);
  if (own !== null) {
    /* 0109 — ein Eintrag als Bündel trägt für Listen und Tabellen seine Arten und einige Felder in Worten. */
    const kinds = Array.isArray(own.kinds) ? own.kinds.filter((k): k is string => typeof k === 'string').slice(0, 6) : [];
    const list = Array.isArray(own.list) ? own.list.slice(0, 8).flatMap((one) => {
      if (typeof one !== 'object' || one === null) return [];
      const { label, text } = one as { label?: unknown; text?: unknown };
      return typeof label === 'string' && typeof text === 'string' ? [{ label: label.slice(0, 80), text: clip(text, 240).text }] : [];
    }) : [];
    return {
      title: typeof own.title === 'string' ? own.title : entry.kind,
      ...(typeof own.summary === 'string' ? { summary: clip(own.summary, 600).text } : {}),
      ...(typeof own.format === 'string' ? { format: own.format } : {}),
      ...(kinds.length > 0 ? { kinds } : {}),
      ...(list.length > 0 ? { list } : {})
    };
  }
  switch (entry.kind) {
    case 'text': {
      const project = look.get(ids(d, 'project')[0] ?? '');
      const plan = planOf(d);
      const lead = str(d, 'summary').trim() || excerpt(str(d, 'body'), 320)
        || plan.filter((p) => p.depth === 0).map((p) => pointLine(p.text)).filter(Boolean).join(' · ');
      /* 2026-10-21 — für Listen und Tabellen: die Hauptgedanken und wann der Text gehalten wurde. */
      const held = deliveriesOf(entry, look);
      return {
        title: str(d, 'title'), subtitle: str(d, 'subtitle'), textType: str(d, 'textType'),
        date: str(d, 'date'), occasion: str(d, 'occasion'), place: str(d, 'place'), readings: str(d, 'readings'),
        summary: clip(lead, 600).text, topics: topicsOf(entry, look),
        project: project === undefined ? null : { id: project.id, title: str(project.data, 'title') },
        words: wordCount(str(d, 'body')), audio: str(d, 'audio'), video: str(d, 'video'),
        further: str(d, 'further').trim() !== '',
        ...(plan.length === 0 ? {} : {
          points: plan.length,
          plan: plan.filter((p) => p.depth === 0).map((p) => clip(pointLine(p.text), 160).text).filter((s) => s !== '').slice(0, 8)
        }),
        ...(held.length === 0 ? {} : {
          deliveries: held.length,
          last: lastHeld(entry, look),
          held: held.slice(0, 12).map((one) => ({
            id: one.id, date: str(one.data, 'date'), occasion: str(one.data, 'occasion'), place: str(one.data, 'place'),
            recorded: str(one.data, 'audio') !== '' || str(one.data, 'video') !== ''
          }))
        })
      };
    }
    case 'delivery': {
      const texts = textsOf(entry, look);
      const counts = coverageCounts(texts.flatMap((t) => planOf(t.data)), coverageOf(d), addedOf(d));
      return {
        title: entryTitle(entry, look), date: str(d, 'date'), occasion: str(d, 'occasion'), place: str(d, 'place'),
        audience: str(d, 'audience'), duration: str(d, 'duration'), audio: str(d, 'audio'), video: str(d, 'video'),
        summary: clip(str(d, 'summary').trim(), 600).text, topics: topicsOf(entry, look),
        texts: texts.map((t) => ({ id: t.id, title: str(t.data, 'title') })),
        counts
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
      const order = num(d, 'order');
      return {
        name: str(d, 'name'), parent: parent === undefined ? null : { id: parent.id, name: str(parent.data, 'name') },
        /* 2026-10-21 — eine Achse der Seite (Spalte, Filter, Baum) und der Platz unter Geschwistern. */
        ...(isAspect(d) ? { aspect: true } : {}),
        ...(order === null ? {} : { order })
      };
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

/**
 * Wonach öffentlich geordnet wird. 2026-10-21 — ein Text, der gehalten
 * wurde, steht dort, wo er ZULETZT gehalten wurde: „neueste zuerst" zeigt,
 * was am letzten Sonntag gesagt wurde, auch wenn der Text älter ist.
 */
function publicSort(entry: LibEntry, look: Lookup): string {
  if (entry.kind !== 'text' || deliveriesOf(entry, look).length === 0) return entrySort(entry, look);
  return `${lastHeld(entry, look) || '0000-00-00'} ${str(entry.data, 'title').toLowerCase()}`.slice(0, 64);
}

/** Ein Eintrag, wie er zum Dienst geht. */
export function publicEntry(entry: LibEntry, as: PublishedAs, look: Lookup, isPublic: (id: string) => boolean): PublicEntryIn {
  return {
    entryId: entry.id,
    as,
    key: entry.key ?? null,
    sort: publicSort(entry, look),
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

  /*
   * 2026-10-21 — ein Text nennt seine Wygłoszenia (Liste, Daten, Zahlen in
   * seiner Kurzfassung): er folgt, wenn eines geändert wird, hinaus- oder
   * hereingeht — auch ein privat gestelltes („Nie publikuj").
   */
  for (const id of [...edited, ...moved]) {
    const entry = look.get(id);
    if (entry?.kind !== 'delivery') continue;
    for (const text of ids(entry.data, 'texts')) if (needed.has(text)) fresh.add(text);
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

