/**
 * DAS ARCHIV AUF EINER SEITE, GERECHNET (2026-10-21) — ohne Browser prüfbar:
 * welches Layout, welche Zeile aus welcher Kurzfassung, welcher Filter zu
 * welcher Achse gehört, und wie der Zustand in der Adresse steht (ein
 * gefiltertes Archiv lässt sich als Link weitergeben).
 *
 * <code>
 *   ?t=<text>       ein Text ist offen          ?tw=<wygłoszenie>  … mit diesem Wygłoszenie auf dem Plan
 *   ?tu=tabela      Lista · Tabela · Drzewo      ?tq=…              die Suche
 *   ?tf=<a>,<b>     gewählte Werte (Themen, Projekte) — je Achse einer
 *   ?to=-sort       Reihenfolge: sort / -sort (Datum), key / -key (Titel)
 * </code>
 */

import { summaryOf, type PublishedItem } from './library';
import { facetOf, type TopicTree } from './topics';

/* Lista · Tabela · Drzewo stehen in `archiveLayout.ts` — ohne Importe, für die Beschreibung des Bausteins. */

export type Order = 'sort' | '-sort' | 'key' | '-key';

export const orderOf = (word: string | null | undefined): Order | null =>
  word === 'sort' || word === '-sort' || word === 'key' || word === '-key' ? word : null;

/** Die Achse der Projekte (Cykle kazań, Bücher) — neben den Aspekten. */
export const PROJECTS = '#cykle';

/* -- Eine Zeile aus der Kurzfassung -------------------------------------------------------------- */

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

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function archiveRow(item: PublishedItem): ArchiveRow {
  const s = summaryOf(item);
  const held = Array.isArray(s.held) ? s.held.filter((one): one is Record<string, unknown> => typeof one === 'object' && one !== null) : [];
  const topics = Array.isArray(s.topics) ? s.topics.flatMap((t) => {
    const o = t as { id?: unknown; name?: unknown };
    return typeof o?.id === 'string' && typeof o.name === 'string' ? [{ id: o.id, name: o.name }] : [];
  }) : [];
  const project = typeof s.project === 'object' && s.project !== null && typeof (s.project as { id?: unknown }).id === 'string'
    ? { id: (s.project as { id: string }).id, title: text((s.project as { title?: unknown }).title) } : null;
  return {
    id: item.entryId,
    title: text(s.title) || 'Bez tytułu',
    subtitle: text(s.subtitle),
    date: text(s.last) || text(s.date),
    occasion: text(held[0]?.occasion) || text(s.occasion),
    summary: text(s.summary),
    held: typeof s.deliveries === 'number' ? s.deliveries : held.length,
    recorded: text(s.audio) !== '' || text(s.video) !== '' || held.some((one) => one.recorded === true),
    topics,
    project,
    plan: Array.isArray(s.plan) ? s.plan.filter((one): one is string => typeof one === 'string') : []
  };
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
