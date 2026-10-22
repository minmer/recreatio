/**
 * DAS ARCHIV AUF EINER SEITE, GERECHNET (2026-10-21) — ohne Browser prüfbar:
 * welches Layout, welche Zeile aus welchem Text, welcher Filter zu welcher
 * Achse gehört, und wie der Zustand in der Adresse steht (ein gefiltertes
 * Archiv lässt sich als Link weitergeben).
 *
 * 2026-10-22 — gesucht, gefiltert und gezählt wird HIER, an den geöffneten
 * Einträgen (`browseLocal`): der Dienst sieht keine Kurzfassungen mehr, nur
 * Hüllen; die Seite öffnet die ganze Bibliothek eines öffentlichen Bereichs.
 *
 * <code>
 *   ?t=<text>       ein Text ist offen          ?tw=<wygłoszenie>  … mit diesem Wygłoszenie auf dem Plan
 *   ?tu=tabela      Lista · Tabela · Drzewo      ?tq=…              die Suche
 *   ?tf=<a>,<b>     gewählte Werte (Themen, Projekte) — je Achse einer
 *   ?to=-sort       Reihenfolge: sort / -sort (Datum), key / -key (Titel)
 * </code>
 */

import { ids, str, type LibEntry, type Lookup } from './libraryKinds';
import { deliveriesOf, lastHeld, planOf, pointLine } from './sermon';
import { facetOf, type TopicTree } from './topics';

/* Lista · Tabela · Drzewo stehen in `archiveLayout.ts` — ohne Importe, für die Beschreibung des Bausteins. */

export type Order = 'sort' | '-sort' | 'key' | '-key';

export const orderOf = (word: string | null | undefined): Order | null =>
  word === 'sort' || word === '-sort' || word === 'key' || word === '-key' ? word : null;

/** Die Achse der Projekte (Cykle kazań, Bücher) — neben den Aspekten. */
export const PROJECTS = '#cykle';

/* -- Eine Zeile aus einem Text ------------------------------------------------------------------- */

export interface ArchiveRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** Wann zuletzt gehalten — sonst das Datum des Textes. */
  readonly date: string;
  readonly occasion: string;
  readonly summary: string;
  /** Wie oft gehalten (veröffentlichte Wygłoszenia). */
  readonly held: number;
  /** Ob es eine Aufnahme gibt — beim Text selbst oder bei einem Wygłoszenie. */
  readonly recorded: boolean;
  readonly topics: readonly { readonly id: string; readonly name: string }[];
  readonly project: { readonly id: string; readonly title: string } | null;
  /** Die Hauptgedanken des Plans. */
  readonly plan: readonly string[];
}

export function archiveRow(entry: LibEntry, look: Lookup): ArchiveRow {
  const d = entry.data;
  const held = deliveriesOf(entry, look);
  const topics = ids(d, 'topics').flatMap((id) => { const t = look.get(id); return t === undefined ? [] : [{ id, name: str(t.data, 'name') }]; });
  const projectEntry = look.get(ids(d, 'project')[0] ?? '');
  return {
    id: entry.id,
    title: str(d, 'title') || 'Bez tytułu',
    subtitle: str(d, 'subtitle'),
    date: lastHeld(entry, look),
    occasion: str(held[0]?.data ?? {}, 'occasion') || str(d, 'occasion'),
    summary: str(d, 'summary'),
    held: held.length,
    recorded: str(d, 'audio') !== '' || str(d, 'video') !== '' || held.some((one) => str(one.data, 'audio') !== '' || str(one.data, 'video') !== ''),
    topics,
    project: projectEntry === undefined ? null : { id: projectEntry.id, title: str(projectEntry.data, 'title') },
    plan: planOf(d).filter((p) => p.depth === 0).map((p) => pointLine(p.text, look, 140)).filter((s) => s !== '').slice(0, 6)
  };
}

/* -- Suchen, filtern, zählen ---------------------------------------------------------------------- */

export interface LocalQuery {
  /** Die Filter: innerhalb einer Gruppe ODER, zwischen den Gruppen UND; ein Thema trifft auch seine Unterthemen. */
  readonly groups: readonly (readonly string[])[];
  /** Die Treffer der Suche (Kennungen) — `null`: keine Suche. */
  readonly matching: ReadonlySet<string> | null;
  readonly order: Order;
}

export interface LocalResult {
  readonly rows: readonly ArchiveRow[];
  /** Je Wert (Thema, Projekt): wie viele der gefundenen Texte ihn tragen — ein Thema zählt auch für seine Oberthemen. */
  readonly counts: ReadonlyMap<string, number>;
}

/** Wofür ein Text steht: seine Themen mit ihren Oberthemen, und sein Projekt. */
function marks(row: ArchiveRow, tree: TopicTree | null): Set<string> {
  const out = new Set<string>();
  for (const t of row.topics) {
    out.add(t.id);
    for (const a of tree?.ancestors(t.id) ?? []) out.add(a.id);
  }
  if (row.project !== null) out.add(row.project.id);
  return out;
}

export function browseLocal(rows: readonly ArchiveRow[], tree: TopicTree | null, query: LocalQuery): LocalResult {
  const groups = query.groups.map((g) => g.filter((one) => one !== '')).filter((g) => g.length > 0);
  const found = rows.filter((row) => {
    if (query.matching !== null && !query.matching.has(row.id)) return false;
    const has = marks(row, tree);
    return groups.every((g) => g.some((id) => has.has(id)));
  });
  const counts = new Map<string, number>();
  for (const row of found) for (const id of marks(row, tree)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const by = query.order === 'key' || query.order === '-key'
    ? (a: ArchiveRow, b: ArchiveRow) => a.title.localeCompare(b.title, 'pl')
    : (a: ArchiveRow, b: ArchiveRow) => (a.date || '0000').localeCompare(b.date || '0000') || a.title.localeCompare(b.title, 'pl');
  const sorted = [...found].sort(by);
  if (query.order.startsWith('-')) sorted.reverse();
  return { rows: sorted, counts };
}

/** Zu welcher Achse ein gewählter Wert gehört — ein Projekt, sonst der Aspekt seines Themas. */
export function facetKey(id: string, tree: TopicTree | null, projects: ReadonlySet<string>): string {
  if (projects.has(id)) return PROJECTS;
  return tree === null ? '' : facetOf(tree, id);
}

/** Einen Wert wählen: je Achse einer — der neue ersetzt den alten derselben Achse; derselbe noch einmal nimmt ihn weg. */
export function choose(chosen: readonly string[], id: string, key: (id: string) => string, single: boolean): string[] {
  if (chosen.includes(id)) return chosen.filter((one) => one !== id);
  if (single) return [id];
  const facet = key(id);
  return [...chosen.filter((one) => key(one) !== facet), id];
}

/** Das Jahr eines Datums — für die Zwischenüberschriften der Liste. */
export const yearOf = (date: string): string => (/^\d{4}/.exec(date)?.[0] ?? '');

/* -- Die Adresse ---------------------------------------------------------------------------------- */

export function hashParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const at = window.location.hash.indexOf('?');
  if (at < 0) return null;
  return new URLSearchParams(window.location.hash.slice(at + 1)).get(name);
}

/** Schlüssel der Adresse ersetzen (`null`: weg) — ohne einen Schritt in der Geschichte. */
export function setHashParams(patch: Readonly<Record<string, string | null>>): void {
  if (typeof window === 'undefined') return;
  const [base, query = ''] = window.location.hash.split('?');
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
  }
  const next = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${base}${next === '' ? '' : `?${next}`}`);
}
