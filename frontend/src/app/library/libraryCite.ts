/**
 * WIE EINE QUELLE GENANNT WIRD (0064) — in der Fussnote und in der
 * Bibliografie, nach dem Brauch polnischer geisteswissenschaftlicher Texte.
 *
 * <code>
 *   Fussnote, erstes Mal   J. Ratzinger, Jezus z Nazaretu, t. 1, Kraków 2007, s. 23.
 *   danach                 J. Ratzinger, Jezus z Nazaretu, dz. cyt., s. 40.
 *   gleich danach          Tamże, s. 41.
 *   Rozdział               A. Nowak, Modlitwa, w: Duchowość, red. B. Kowal, Lublin 2010, s. 45–60.
 *   Artykuł                A. Nowak, Tytuł, „Communio” 12 (2020), nr 3, s. 45.
 *   Dokument               Franciszek, Evangelii gaudium, 24.
 *   Pismo Święte           J 6,35 (BT).
 *   Bibliografia           Ratzinger J., Jezus z Nazaretu, t. 1, Wydawnictwo M, Kraków 2007.
 * </code>
 *
 * Heraus kommen Stücke mit Auszeichnung (`Seg`) — kursiv steht der Titel —,
 * keine Zeichenketten: gezeichnet wird anderswo, geprüft wird hier.
 */

import { ids, personName, str, workTitle, type LibEntry, type Lookup } from './libraryKinds';

export interface Seg {
  readonly text: string;
  readonly italic?: boolean;
  readonly href?: string;
}

/** Fussnoten zählen mit: was schon voll genannt war, und was gerade davor stand. */
export interface CiteState {
  readonly seen: Set<string>;
  last: string | null;
}

export const newCiteState = (): CiteState => ({ seen: new Set(), last: null });

export const segText = (segs: readonly Seg[]): string => segs.map((s) => s.text).join('');

/* -- Namen ------------------------------------------------------------------------------- */

const initials = (given: string): string =>
  given.split(/[\s-]+/).filter(Boolean).map((part) => `${part[0]!.toUpperCase()}.`).join(' ');

/** „J. Ratzinger" — oder der ganze Name, wo es keinen Nachnamen gibt („Franciszek"). */
export function personShort(person: LibEntry | undefined): string {
  if (person === undefined) return '';
  const surname = str(person.data, 'surname').trim();
  if (surname === '' || str(person.data, 'personType') === 'organization') return personName(person.data);
  const given = str(person.data, 'givenNames').trim();
  return given === '' ? surname : `${initials(given)} ${surname}`;
}

/** „Ratzinger J." — so steht er in der Bibliografie. */
export function personSorted(person: LibEntry | undefined): string {
  if (person === undefined) return '';
  const surname = str(person.data, 'surname').trim();
  if (surname === '' || str(person.data, 'personType') === 'organization') return personName(person.data);
  const given = str(person.data, 'givenNames').trim();
  return given === '' ? surname : `${surname} ${initials(given)}`;
}

function names(list: readonly string[], look: Lookup, form: (p: LibEntry | undefined) => string): string {
  const people = list.map((id) => form(look.get(id))).filter((n) => n !== '');
  if (people.length > 3) return `${people[0]} i in.`;
  return people.join(', ');
}

/* -- Bausteine einer Angabe -------------------------------------------------------------- */

const join = (parts: readonly (readonly Seg[])[], separator = ', '): Seg[] => {
  const out: Seg[] = [];
  for (const part of parts) {
    if (part.length === 0 || segText(part).trim() === '') continue;
    if (out.length > 0) out.push({ text: separator });
    out.push(...part);
  }
  return out;
};

const t = (text: string): Seg[] => (text.trim() === '' ? [] : [{ text: text.trim() }]);
const title = (text: string): Seg[] => (text.trim() === '' ? [] : [{ text: text.trim(), italic: true }]);

const placeYear = (work: LibEntry, withPublisher: boolean): Seg[] => {
  const place = str(work.data, 'place').trim();
  const year = str(work.data, 'year').trim();
  const publisher = withPublisher ? str(work.data, 'publisher').trim() : '';
  return t([publisher, [place, year].filter(Boolean).join(' ')].filter(Boolean).join(', '));
};

const volume = (work: LibEntry): Seg[] => t(str(work.data, 'volume') === '' ? '' : `t. ${str(work.data, 'volume')}`);
const edition = (work: LibEntry): Seg[] => t(str(work.data, 'edition') === '' ? '' : `wyd. ${str(work.data, 'edition')}`);

const roles = (work: LibEntry, look: Lookup): { editors: Seg[]; translators: Seg[] } => ({
  editors: t(ids(work.data, 'editors').length === 0 ? '' : `red. ${names(ids(work.data, 'editors'), look, personShort)}`),
  translators: t(ids(work.data, 'translators').length === 0 ? '' : `tłum. ${names(ids(work.data, 'translators'), look, personShort)}`)
});

const titleOf = (work: LibEntry): Seg[] => {
  const main = str(work.data, 'title').trim();
  const sub = str(work.data, 'subtitle').trim();
  return title(sub === '' ? main : `${main}. ${sub}`);
};

const shortTitle = (work: LibEntry): Seg[] => {
  const words = str(work.data, 'title').trim().split(/\s+/);
  return title(words.length <= 4 ? words.join(' ') : `${words.slice(0, 4).join(' ')}…`);
};

/** Die Angabe eines Werks — ganz (`full`), kurz (`short`) oder für die Bibliografie (`bib`). */
export function workSegs(work: LibEntry, look: Lookup, mode: 'full' | 'short' | 'bib', locator = ''): Seg[] {
  const type = str(work.data, 'workType');
  const authors = names(ids(work.data, 'authors'), look, mode === 'bib' ? personSorted : personShort);
  const where = t(locator);

  if (type === 'bible') {
    const siglum = str(work.data, 'siglum').trim();
    if (mode !== 'bib' && locator !== '') return t(siglum === '' ? locator : `${locator} (${siglum})`);
    const head: Seg[] = [...titleOf(work), ...(siglum === '' ? [] : [{ text: ` (${siglum})` }])];
    return join([head, edition(work), placeYear(work, mode === 'bib')]);
  }

  if (mode === 'short') return join([t(authors), shortTitle(work), t('dz. cyt.'), where]);

  const { editors, translators } = roles(work, look);
  const container = look.get(ids(work.data, 'container')[0] ?? '');

  if (type === 'chapter' && container !== undefined) {
    const host = roles(container, look);
    return join([
      t(authors), titleOf(work),
      [{ text: 'w: ' }, ...titleOf(container)], host.editors, volume(container),
      placeYear(container, mode === 'bib'),
      mode === 'bib' ? t(str(work.data, 'pages') === '' ? '' : `s. ${str(work.data, 'pages')}`) : where
    ]);
  }

  if (type === 'article') {
    const journal = container === undefined ? '' : str(container.data, 'title').trim();
    const year = str(work.data, 'year').trim();
    const vol = str(work.data, 'volume').trim();
    const issue = str(work.data, 'issue').trim();
    const host: Seg[] = journal === '' ? [] : [{ text: `„${journal}”${vol === '' ? '' : ` ${vol}`}${year === '' ? '' : ` (${year})`}` }];
    return join([
      t(authors), titleOf(work), host, t(issue === '' ? '' : `nr ${issue}`),
      mode === 'bib' ? t(str(work.data, 'pages') === '' ? '' : `s. ${str(work.data, 'pages')}`) : where
    ]);
  }

  if (type === 'document') {
    return join([t(authors), titleOf(work), mode === 'bib' ? placeYear(work, false) : where]);
  }

  if (type === 'web') {
    const url = str(work.data, 'url').trim();
    const accessed = str(work.data, 'accessed').trim();
    return join([
      t(authors), titleOf(work),
      url === '' ? [] : [{ text: url, href: url }],
      t(accessed === '' ? '' : `(dostęp: ${accessed})`),
      mode === 'bib' ? [] : where
    ]);
  }

  /* Buch, Vortrag, anderes. */
  const head = authors === '' ? [titleOf(work), editors] : [t(authors), titleOf(work), editors];
  return join([
    ...head, volume(work), translators, edition(work), placeYear(work, mode === 'bib'),
    mode === 'bib' ? [] : where
  ]);
}

/**
 * EINE FUSSNOTE für einen Verweis `[@schlüssel, Stelle]` — beim ersten Mal
 * ganz, danach kurz mit „dz. cyt.", unmittelbar wiederholt „Tamże".
 */
export function citeSegs(target: LibEntry | undefined, locator: string, look: Lookup, state: CiteState, href?: (e: LibEntry) => string | undefined): Seg[] {
  if (target === undefined) return t(locator === '' ? '[brak źródła]' : `[brak źródła], ${locator}`);

  /* Ein Zitat nennt sein Werk, an seiner Stelle (oder an der, die der Verweis sagt). */
  if (target.kind === 'quote') {
    const work = look.get(ids(target.data, 'work')[0] ?? '');
    const where = locator !== '' ? locator : str(target.data, 'locator');
    if (work === undefined) return t(where === '' ? 'Cytat' : `Cytat, ${where}`);
    return citeSegs(work, where, look, state, href);
  }

  if (target.kind === 'work') {
    if (str(target.data, 'workType') === 'bible') {
      state.last = target.id;
      return workSegs(target, look, 'full', locator);
    }
    if (state.last === target.id) return join([t('Tamże'), t(locator)]);
    const mode = state.seen.has(target.id) ? 'short' : 'full';
    state.seen.add(target.id);
    state.last = target.id;
    return workSegs(target, look, mode, locator);
  }

  state.last = target.id;
  if (target.kind === 'text') {
    const date = str(target.data, 'date');
    const link = href?.(target);
    return join([
      [{ text: str(target.data, 'title') || 'Tekst', italic: true, ...(link === undefined ? {} : { href: link }) }],
      t(date === '' ? '' : `(${date})`), t(locator)
    ], ' ');
  }
  if (target.kind === 'person') return join([t(personName(target.data)), t(locator)]);
  return join([title(str(target.data, 'title') || str(target.data, 'name') || target.kind), t(locator)]);
}

/** Das Werk hinter einem Verweis — für die Bibliografie. */
export function workBehind(target: LibEntry | undefined, look: Lookup): LibEntry | undefined {
  if (target === undefined) return undefined;
  if (target.kind === 'work') return target;
  if (target.kind === 'quote') return look.get(ids(target.data, 'work')[0] ?? '');
  return undefined;
}

/** Die Bibliografie: jedes Werk einmal, nach Autor und Titel. */
export function bibliography(works: readonly LibEntry[], look: Lookup): { work: LibEntry; segs: Seg[] }[] {
  const unique = [...new Map(works.map((w) => [w.id, w])).values()];
  return unique
    .map((work) => ({ work, segs: workSegs(work, look, 'bib'), sort: `${segText(workSegs(work, look, 'bib'))}`.toLowerCase() }))
    .sort((a, b) => a.sort.localeCompare(b.sort, 'pl'))
    .map(({ work, segs }) => ({ work, segs }));
}

/** Eine kurze Herkunft für eine Liste: „J. Ratzinger, Jezus z Nazaretu, s. 168". */
export function originOf(quote: LibEntry, look: Lookup): string {
  const work = look.get(ids(quote.data, 'work')[0] ?? '');
  if (work === undefined) return str(quote.data, 'locator');
  if (str(work.data, 'workType') === 'bible') return segText(workSegs(work, look, 'full', str(quote.data, 'locator')));
  const authors = names(ids(work.data, 'authors'), look, personShort);
  return [authors, workTitle(work.data), str(quote.data, 'locator')].filter((s) => s.trim() !== '').join(', ');
}

/** Wer hinter einem Zitat steht — für Filter und Sortierung. */
export function authorOf(quote: LibEntry, look: Lookup): LibEntry | undefined {
  const work = look.get(ids(quote.data, 'work')[0] ?? '');
  return work === undefined ? undefined : look.get(ids(work.data, 'authors')[0] ?? '');
}
