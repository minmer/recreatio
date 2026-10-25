/**
 * WEJŚCIA Z BIBLIOTEKI (2026-10-25, Wywód) — ein Dokument der Baza (`anchor`): dieses Werk der
 * Bibliothek, ganz oder in diesen Teilen, wird HIER erklärt — von diesem Eintrag aus, in diesem
 * Sposób wyświetlania.
 *
 * <code>
 *   { name, work: &lt;Werk&gt;, locator: "s. 45–60" | "s. 1–3; 10–12; 20" | "I q. 2 a. 3" | "" (das ganze Werk),
 *     entry: &lt;Eintrag&gt;, view: &lt;Widok&gt;, note }
 * </code>
 *
 * Die Bibliothek speichert davon nichts. Ihre Seite eines Werks findet die Wejścia unter dem, was
 * dieser Leser ohnehin öffnen kann (`library/anchorHits.ts` über das Verzeichnis der Verweise —
 * `{work, locator}` liest es wie jede Stelle), und zeigt sie als Knöpfe „W Wiedzy". Mehrere
 * Wejścia für ein Werk sind gewollt: die Struktur des Ganzen, eine des Anfangs, eine des Endes;
 * eines darf auch Anfang, Mitte und Ende zusammen nennen. Sie dürfen sich überschneiden.
 */

import { cogitaPath } from './parts';
import { formatPlace, parsePlace, workOptions, workScheme } from '../library/locations';
import type { CogitaLibrary } from './store';

export interface Anchor {
  readonly id: string;
  readonly name: string;
  /** Das Werk der Bibliothek (Kennung). */
  readonly work: string;
  /** Welche Teile: eine Stelle im Układ des Werks, auch mehrere („s. 1–3; 10–12; 20"); leer: das ganze Werk. */
  readonly locator: string;
  /** Wo man ankommt: ein Eintrag (die Wurzel der Struktur oder ein Knoten darin) … */
  readonly entry: string;
  /** … in diesem Sposób wyświetlania (leer: die Seite des Eintrags). */
  readonly view: string;
  readonly note: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function readAnchor(id: string, data: Readonly<Record<string, unknown>>): Anchor {
  return { id, name: str(data.name).slice(0, 160), work: str(data.work), locator: str(data.locator).slice(0, 240), entry: str(data.entry), view: str(data.view), note: str(data.note).slice(0, 600) };
}

/** Was ein Wejście in seinem Dokument trägt (leere Teile fallen weg). */
export function anchorData(a: Omit<Anchor, 'id'>): Record<string, unknown> {
  return {
    name: a.name.trim() || 'Wejście',
    work: a.work,
    ...(a.locator.trim() === '' ? {} : { locator: a.locator.trim() }),
    ...(a.entry === '' ? {} : { entry: a.entry }),
    ...(a.view === '' ? {} : { view: a.view }),
    ...(a.note.trim() === '' ? {} : { note: a.note.trim() })
  };
}

/** Wohin ein Wejście führt: der Widok, geöffnet an seinem Eintrag — oder die Seite des Eintrags. */
export function anchorPath(libraryId: string, a: Pick<Anchor, 'entry' | 'view'>): string {
  if (a.view !== '') return cogitaPath(libraryId, 'wpisy', 'widok', a.view, ...(a.entry === '' ? [] : [a.entry]));
  if (a.entry !== '') return cogitaPath(libraryId, 'wpisy', a.entry);
  return cogitaPath(libraryId, 'wpisy');
}

/** Die Wejścia dieser Baza (nur die eigenen — die einer Quelle zeigt deren Bibliothek selbst). */
export const anchorsOf = (lib: CogitaLibrary): Anchor[] =>
  lib.docs('anchor').filter((e) => lib.isOwn(e.id)).map((e) => readAnchor(e.id, e.data));

/** Die Wejścia, die an diesem Eintrag ankommen. */
export const anchorsAt = (lib: CogitaLibrary, entityId: string): Anchor[] => anchorsOf(lib).filter((a) => a.entry === entityId);

/** Die Stelle eines Wejście, einheitlich geschrieben — im Układ des Werks, wenn es lesbar ist. */
export function anchorPlace(lib: CogitaLibrary, a: Pick<Anchor, 'work' | 'locator'>): string {
  if (a.locator === '') return 'całe dzieło';
  const work = lib.entity(a.work);
  if (work === undefined) return a.locator;
  return formatPlace(parsePlace(a.locator, workScheme(work.data), workOptions(work.data)), a.locator);
}

/** Was an einem Wejście nicht stimmt — für die Liste und das Formular. */
export function anchorProblems(lib: CogitaLibrary, a: Omit<Anchor, 'id'>): string[] {
  const out: string[] = [];
  const work = a.work === '' ? undefined : lib.entity(a.work);
  if (a.work === '') out.push('Wybierz dzieło.');
  else if (work === undefined) out.push('Tego dzieła nie ma w bibliotekach, z których korzysta ta baza (Więcej → Ustawienia → Źródła) — przycisk w Bibliotece i tak się pojawi, ale miejsca nie da się sprawdzić.');
  else if (!work.kinds.includes('work')) out.push('To nie jest dzieło z biblioteki.');
  if (work !== undefined && a.locator !== '') {
    const place = parsePlace(a.locator, workScheme(work.data), workOptions(work.data));
    if (place.spans.length === 0 && place.pages.length === 0) out.push(`Miejsca „${a.locator}” nie da się odczytać w układzie tego dzieła.`);
    /* 2026-10-25: auch ein Teil, den keine Regel liest („rozdz. 3; przypis 2"), wird genannt — er verbindet nichts. */
    else if (/[\p{L}\p{N}]/u.test(place.rest)) out.push(`Część „${place.rest}” nie została odczytana w układzie tego dzieła — ta część niczego nie wskaże.`);
  }
  if (a.entry === '' && a.view === '') out.push('Wskaż wpis albo sposób wyświetlania, do którego prowadzi wejście.');
  if (a.entry !== '' && lib.entity(a.entry) === undefined) out.push('Tego wpisu już nie ma.');
  if (a.view !== '' && !lib.docs('view').some((e) => e.id === a.view)) out.push('Tego sposobu wyświetlania już nie ma.');
  return out;
}
