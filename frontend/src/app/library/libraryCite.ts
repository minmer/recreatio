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

import { unreadable } from './libraryMarkup';
import { t } from '../core/i18n';
import { entryTitle, ids, MUSIC_TYPES, personName, str, workTitle, type LibEntry, type Lookup } from './libraryKinds';
import { musicPeople, pieceBehind } from './music';

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
  if (people.length > 3) return t('libraryCite.etAl', { name: people[0]! });
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

const seg = (text: string): Seg[] => (text.trim() === '' ? [] : [{ text: text.trim() }]);
const title = (text: string): Seg[] => (text.trim() === '' ? [] : [{ text: text.trim(), italic: true }]);

const placeYear = (work: LibEntry, withPublisher: boolean): Seg[] => {
  const place = str(work.data, 'place').trim();
  const year = str(work.data, 'year').trim();
  const publisher = withPublisher ? str(work.data, 'publisher').trim() : '';
  return seg([publisher, [place, year].filter(Boolean).join(' ')].filter(Boolean).join(', '));
};

const volume = (work: LibEntry): Seg[] => seg(str(work.data, 'volume') === '' ? '' : t('libraryCite.volume', { n: str(work.data, 'volume') }));
const edition = (work: LibEntry): Seg[] => seg(str(work.data, 'edition') === '' ? '' : t('libraryCite.edition', { n: str(work.data, 'edition') }));

const roles = (work: LibEntry, look: Lookup): { editors: Seg[]; translators: Seg[] } => ({
  editors: seg(ids(work.data, 'editors').length === 0 ? '' : t('libraryCite.editors', { names: names(ids(work.data, 'editors'), look, personShort) })),
  translators: seg(ids(work.data, 'translators').length === 0 ? '' : t('libraryCite.translators', { names: names(ids(work.data, 'translators'), look, personShort) }))
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

/**
 * 2026-10-26 — MUSIK, wie man sie nennt:
 * <code>
 *   Utwór      W. A. Mozart, Ave verum corpus, KV 618, sł. …, oprac. ….
 *   Nuty       W. A. Mozart, Ave verum corpus [nuty], oprac. …, red. …, Stuttgart 2005, s. 3.
 *   Nagranie   Ave verum corpus (W. A. Mozart), wyk. Schola Katedralna, [nagranie], w: Kolędy, nr 5, Dux, 2024, 1:23.
 *   Płyta      Kolędy polskie, wyk. Schola Katedralna, [płyta], Dux, 2010.
 * </code>
 * Nuty und Nagranie ohne eigenen Titel oder Komponisten nehmen die ihres Utwór.
 */
function musicSegs(work: LibEntry, look: Lookup, mode: 'full' | 'short' | 'bib', locator: string): Seg[] {
  const type = str(work.data, 'workType');
  const form = mode === 'bib' ? personSorted : personShort;
  const piece = pieceBehind(work, look);
  const named = str(work.data, 'title').trim() !== '' ? work : piece;
  const people = (key: string, prefix: string) => {
    const list = ids(work.data, key).length > 0 ? ids(work.data, key) : piece.id === work.id ? [] : ids(piece.data, key);
    return seg(list.length === 0 ? '' : `${prefix}${names(list, look, form)}`);
  };
  const where = mode === 'bib' ? [] : seg(locator);
  if (mode === 'short') return join([seg(names(musicPeople(work, look), look, personShort)), shortTitle(named), seg(t('libraryCite.opCit')), where]);
  const performers = seg(ids(work.data, 'performers').length === 0 ? '' : t('libraryCite.performers', { names: names(ids(work.data, 'performers'), look, form) }));
  const label = seg([str(work.data, 'publisher'), str(work.data, 'year')].map((x) => x.trim()).filter(Boolean).join(', '));
  if (type === 'piece') {
    return join([people('composers', ''), titleOf(work), seg(str(work.data, 'catalogue')), people('lyricists', t('libraryCite.lyricsBy')), people('arrangers', t('libraryCite.arrangedBy')), where]);
  }
  if (type === 'score') {
    const { editors } = roles(work, look);
    return join([
      people('composers', ''), [...titleOf(named), { text: t('libraryCite.score') }], seg(str(work.data, 'catalogue')), people('lyricists', t('libraryCite.lyricsBy')), people('arrangers', t('libraryCite.arrangedBy')),
      editors, volume(work), edition(work), placeYear(work, mode === 'bib'), where
    ]);
  }
  if (type === 'recording') {
    const composers = names(ids(work.data, 'composers').length > 0 ? ids(work.data, 'composers') : piece.id === work.id ? [] : ids(piece.data, 'composers'), look, personShort);
    const album = look.get(ids(work.data, 'album')[0] ?? '');
    const track = str(work.data, 'track').trim();
    return join([
      [...titleOf(named), ...(composers === '' ? [] : [{ text: ` (${composers})` }])], performers, people('arrangers', t('libraryCite.arrangedBy')), seg(t('libraryCite.recording')), // i18n-ignore
      album === undefined ? [] : [{ text: t('libraryCite.in') }, ...titleOf(album)], seg(track === '' ? '' : t('libraryCite.number', { n: track })),
      album === undefined ? label : seg([str(album.data, 'publisher'), str(work.data, 'year') || str(album.data, 'year')].map((x) => x.trim()).filter(Boolean).join(', ')),
      where
    ]);
  }
  /* Płyta. */
  return join([titleOf(work), performers, seg(t('libraryCite.album')), label, seg(str(work.data, 'catalogue')), where]);
}

/** Die Angabe eines Werks — ganz (`full`), kurz (`short`) oder für die Bibliografie (`bib`). */
export function workSegs(work: LibEntry, look: Lookup, mode: 'full' | 'short' | 'bib', locator = ''): Seg[] {
  const type = str(work.data, 'workType');
  if (MUSIC_TYPES.has(type)) return musicSegs(work, look, mode, locator);
  const authors = names(ids(work.data, 'authors'), look, mode === 'bib' ? personSorted : personShort);
  const where = seg(locator);

  if (type === 'bible') {
    const siglum = str(work.data, 'siglum').trim();
    if (mode !== 'bib' && locator !== '') return seg(siglum === '' ? locator : `${locator} (${siglum})`);
    const head: Seg[] = [...titleOf(work), ...(siglum === '' ? [] : [{ text: ` (${siglum})` }])]; // i18n-ignore
    return join([head, edition(work), placeYear(work, mode === 'bib')]);
  }

  if (mode === 'short') return join([seg(authors), shortTitle(work), seg(t('libraryCite.opCit')), where]);

  const { editors, translators } = roles(work, look);
  const container = look.get(ids(work.data, 'container')[0] ?? '');

  if (type === 'chapter' && container !== undefined) {
    const host = roles(container, look);
    return join([
      seg(authors), titleOf(work),
      [{ text: t('libraryCite.in') }, ...titleOf(container)], host.editors, volume(container),
      placeYear(container, mode === 'bib'),
      mode === 'bib' ? seg(str(work.data, 'pages') === '' ? '' : t('libraryCite.pages', { pages: str(work.data, 'pages') })) : where
    ]);
  }

  if (type === 'article') {
    const journal = container === undefined ? '' : str(container.data, 'title').trim();
    const year = str(work.data, 'year').trim();
    const vol = str(work.data, 'volume').trim();
    const issue = str(work.data, 'issue').trim();
    const host: Seg[] = journal === '' ? [] : [{ text: `„${journal}”${vol === '' ? '' : ` ${vol}`}${year === '' ? '' : ` (${year})`}` }];
    return join([
      seg(authors), titleOf(work), host, seg(issue === '' ? '' : t('libraryCite.number', { n: issue })),
      mode === 'bib' ? seg(str(work.data, 'pages') === '' ? '' : t('libraryCite.pages', { pages: str(work.data, 'pages') })) : where
    ]);
  }

  if (type === 'document') {
    return join([seg(authors), titleOf(work), mode === 'bib' ? placeYear(work, false) : where]);
  }

  if (type === 'web') {
    const url = str(work.data, 'url').trim();
    const accessed = str(work.data, 'accessed').trim();
    return join([
      seg(authors), titleOf(work),
      url === '' ? [] : [{ text: url, href: url }],
      seg(accessed === '' ? '' : t('libraryCite.accessed', { date: accessed })),
      mode === 'bib' ? [] : where
    ]);
  }

  /* Buch, Vortrag, anderes. */
  const head = authors === '' ? [titleOf(work), editors] : [seg(authors), titleOf(work), editors];
  return join([
    ...head, volume(work), translators, edition(work), placeYear(work, mode === 'bib'),
    mode === 'bib' ? [] : where
  ]);
}

/**
 * EINE FUSSNOTE für einen Verweis `[@schlüssel, Stelle]` — beim ersten Mal
 * ganz, danach kurz mit „dz. cyt.", unmittelbar wiederholt „Tamże".
 */
export function citeSegs(target: LibEntry | undefined, locator: string, look: Lookup, state: CiteState): Seg[] {
  if (target === undefined) return seg(locator === '' ? t('libraryCite.missing') : t('libraryCite.missingAt', { locator }));

  /* Ein Zitat nennt sein Werk, an seiner Stelle (oder an der, die der Verweis sagt). */
  if (target.kind === 'quote') {
    const work = look.get(ids(target.data, 'work')[0] ?? '');
    const where = locator !== '' ? locator : str(target.data, 'locator');
    if (work === undefined) return seg(where === '' ? t('libraryCite.quote') : t('libraryCite.quoteAt', { where }));
    return citeSegs(work, where, look, state);
  }

  if (target.kind === 'work') {
    if (str(target.data, 'workType') === 'bible') {
      state.last = target.id;
      return workSegs(target, look, 'full', locator);
    }
    if (state.last === target.id) return join([seg(t('libraryCite.ibid')), seg(locator)]);
    const mode = state.seen.has(target.id) ? 'short' : 'full';
    state.seen.add(target.id);
    state.last = target.id;
    return workSegs(target, look, mode, locator);
  }

  state.last = target.id;
  /* 2026-10-22 — ein eigener Text kommt hier nur noch an, wenn jemand ihn ausdrücklich als Quelle nennt (Druck eines Zitats). */
  if (target.kind === 'text') {
    const date = str(target.data, 'date');
    return join([[{ text: str(target.data, 'title') || t('libraryCite.text'), italic: true }], seg(date === '' ? '' : `(${date})`), seg(locator)], ' ');
  }
  if (target.kind === 'person') return join([seg(personName(target.data)), seg(locator)]);
  return join([title(str(target.data, 'title') || str(target.data, 'name') || target.kind), seg(locator)]);
}

/**
 * 2026-10-22 — WIE EIN VERWEIS IN EINER ZELLE HEISST (einer Aussage): beim
 * Pismo die Stelle allein („Łk 1,35"), sonst der Titel mit der Stelle — und
 * über ein Ziel, das dieser Leser nicht lesen darf, nichts.
 */
export function refLabel(ref: string, locator: string, look: Lookup): string {
  const target = look.get(ref);
  if (target === undefined) return unreadable();
  if (target.kind === 'work' && str(target.data, 'workType') === 'bible' && locator !== '') return locator;
  /* Eine Aussage (2026-10-23: ein Eintrag mit Feld blocks) heisst nach ihrer Teza — das tut entryTitle. */
  const title = target.kind === 'quote' ? originOf(target, look) : entryTitle(target, look);
  return [title, locator].filter(Boolean).join(', ');
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
  /* 2026-10-26 — ein Zitat aus Musik (die Worte eines Liedes): nach dem Komponisten. */
  const authors = names(MUSIC_TYPES.has(str(work.data, 'workType')) ? musicPeople(work, look) : ids(work.data, 'authors'), look, personShort);
  return [authors, workTitle(work.data), str(quote.data, 'locator')].filter((s) => s.trim() !== '').join(', ');
}

/** Wer hinter einem Zitat steht — für Filter und Sortierung. */
export function authorOf(quote: LibEntry, look: Lookup): LibEntry | undefined {
  const work = look.get(ids(quote.data, 'work')[0] ?? '');
  return work === undefined ? undefined : look.get(ids(work.data, 'authors')[0] ?? '');
}
