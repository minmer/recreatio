/**
 * 2026-10-26 — MUSIK IN DER BIBLIOTHEK: was die Bibliothek von einem Werk der Musik weiss, an einer Stelle.
 *
 * Ein Werk der Musik ist ein `work` mit einem Rodzaj der Musik (`libraryKinds.ts`): der Utwór als solcher
 * (`piece`), Nuty (`score`, mit ihren Dateien: Partitur, Stimmen, Notensatz), ein Nagranie (`recording`, eine
 * Datei oder mehrere Spuren — die Stimmen und Instrumente, die zusammen klingen) und die Płyta (`album`).
 * Nuty und Nagranie zeigen auf ihren Utwór (`piece`), das Nagranie auf seine Płyta (`album`).
 *
 * <b>Gebaut für das, was später kommt</b> (LIBRARY.md, „Muzyka"):
 * <code>
 *   ein Spieler auf einer öffentlichen Seite, der die Stimmen zusammen spielt   partsOf (zusammen), wholeOf (allein)
 *   eine Karte in Cogita: ein Nagranie ab einer Stelle hören, den Titel nennen   pieceBehind, titlesOf, Stellen `time`
 * </code>
 * Hier wird nichts davon gespielt; die Bibliothek speichert, was beides braucht.
 */

import { ids, itemsOf, str, type EntryData, type LibEntry, type Lookup } from './libraryKinds';
import type { MediaRef } from '../cogita/schema';

/** Eine Datei der Musik: eine Spur eines Nagrania oder eine Datei der Nuty. */
export interface MusicFile {
  /** Fest in der Liste (die Prüfung des Imports vergibt sie, die App beim Hinzufügen). */
  readonly id: string;
  readonly label: string;
  /** Bei Spuren: `part` klingt mit den anderen zusammen, `whole` ist das ganze Nagranie allein. */
  readonly role: 'part' | 'whole';
  readonly file: MediaRef | null;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const mediaOf = (value: unknown): MediaRef | null =>
  isObject(value) && typeof value.file === 'string' && value.file !== '' ? value as unknown as MediaRef : null;

/** Was „das Ganze" heisst — eine Spur mit diesem Namen klingt allein. */
const WHOLE = /^(?:całość|calosc|całe(?: nagranie)?|tutti|full|mix|razem|wszystkie(?: głosy)?|all(?: parts)?|komplet)$/i;

export const isWholeLabel = (label: string): boolean => WHOLE.test(label.trim());

/** Die Spuren eines Nagrania, in ihrer Reihenfolge. Ohne gesagte Rolle: eine einzige Spur ist das Ganze. */
export function tracksOf(data: EntryData): MusicFile[] {
  const items = itemsOf(data, 'tracks');
  return items.map((item, i) => {
    const label = str(item, 'label').trim();
    const role = item.role === 'whole' || item.role === 'part' ? item.role : items.length === 1 || isWholeLabel(label) ? 'whole' : 'part';
    return { id: str(item, 'id') || `t${i + 1}`, label, role, file: mediaOf(item.file) };
  });
}

/** Die Dateien der Nuty, in ihrer Reihenfolge. */
export function filesOf(data: EntryData): MusicFile[] {
  return itemsOf(data, 'files').map((item, i) => ({ id: str(item, 'id') || `f${i + 1}`, label: str(item, 'label').trim(), role: 'part' as const, file: mediaOf(item.file) }));
}

/** Was zusammen klingt: die Stimmen und Instrumente mit Datei (für den Spieler mehrerer Spuren). */
export const partsOf = (data: EntryData): MusicFile[] => tracksOf(data).filter((t) => t.role === 'part' && t.file !== null);

/** Das ganze Nagranie allein — oder `null`, wenn es nur Stimmen gibt (dann klingen sie zusammen). */
export const wholeOf = (data: EntryData): MusicFile | null => tracksOf(data).find((t) => t.role === 'whole' && t.file !== null) ?? null;

/** Der Utwór hinter Nuty oder einem Nagranie (ohne Verweis: das Werk selbst) — was man meint, wenn man fragt „was ist das?". */
export function pieceBehind(entry: LibEntry, look: Lookup): LibEntry {
  if (str(entry.data, 'workType') === 'piece') return entry;
  const piece = look.get(ids(entry.data, 'piece')[0] ?? '');
  return piece !== undefined && piece.kind === 'work' && str(piece.data, 'workType') === 'piece' ? piece : entry;
}

/**
 * Die Namen, unter denen man ein Stück kennt: der Titel, der Titel des Originals, die anderen Titel und der
 * Incipit — des Utwór und des Werks selbst, jeder einmal. Die erste ist der Titel des Utwór.
 */
export function titlesOf(entry: LibEntry, look: Lookup): string[] {
  const piece = pieceBehind(entry, look);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (text: string) => {
    const t = text.replace(/\s+/g, ' ').trim();
    const low = t.toLowerCase();
    if (t !== '' && !seen.has(low)) { seen.add(low); out.push(t); }
  };
  for (const one of piece.id === entry.id ? [entry] : [piece, entry]) {
    add(str(one.data, 'title'));
    add(str(one.data, 'originalTitle'));
    for (const line of str(one.data, 'otherTitles').split(/\n+/)) add(line);
  }
  return out;
}

/** Wer bei einem Werk der Musik vorn steht: der Komponist — beim Nagranie ohne ihn die Ausführenden; der Utwór hilft aus. */
export function musicPeople(entry: LibEntry, look: Lookup): string[] {
  const own = ids(entry.data, 'composers');
  if (own.length > 0) return own;
  const piece = pieceBehind(entry, look);
  const theirs = piece.id === entry.id ? [] : ids(piece.data, 'composers');
  return theirs.length > 0 ? theirs : ids(entry.data, 'performers');
}

/* -- Namen der Spuren ------------------------------------------------------------------------- */

/** Stimmen und Instrumente zur Auswahl (und was ein Dateiname meint). */
export const VOICES: readonly string[] = [
  'Sopran', 'Sopran I', 'Sopran II', 'Mezzosopran', 'Alt', 'Alt I', 'Alt II', 'Tenor', 'Tenor I', 'Tenor II', 'Baryton', 'Bas', 'Bas I', 'Bas II',
  'Solo', 'Chór', 'Organy', 'Fortepian', 'Gitara', 'Skrzypce', 'Altówka', 'Wiolonczela', 'Kontrabas', 'Flet', 'Obój', 'Klarnet', 'Fagot',
  'Trąbka', 'Puzon', 'Róg', 'Perkusja', 'Akompaniament', 'Całość'
];

/** Wonach eine Datei der Nuty heisst. */
export const SCORE_LABELS: readonly string[] = ['Partytura', 'Głosy', 'Sopran', 'Alt', 'Tenor', 'Bas', 'Organy', 'Tekst', 'MusicXML', 'MIDI'];

const fold = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/* Längere zuerst: „kontrabas" vor „bas", „mezzosopran" vor „sopran", „altowka" vor „alt", „bassoon" vor „bass". */
const VOICE_WORDS: readonly [RegExp, string][] = [
  [/kontrabas|contrabass|double ?bass/, 'Kontrabas'], [/fagot|bassoon/, 'Fagot'], [/mezzo/, 'Mezzosopran'], [/baryton|bariton/, 'Baryton'],
  [/sopran/, 'Sopran'], [/altowka|\bviola\b/, 'Altówka'], [/\balt(?:o|a|us)?\b/, 'Alt'], [/tenor/, 'Tenor'], [/\bbas(?:s|so|sus)?\b/, 'Bas'],
  [/organy|\borgan\b/, 'Organy'], [/fortepian|\bpiano\b/, 'Fortepian'], [/gitara|guitar/, 'Gitara'], [/skrzypce|violin/, 'Skrzypce'],
  [/wiolonczela|\bcello\b/, 'Wiolonczela'], [/\bflet\b|\bflute\b/, 'Flet'], [/\boboj\b|\boboe\b/, 'Obój'], [/klarnet|clarinet/, 'Klarnet'],
  [/trabka|trumpet/, 'Trąbka'], [/puzon|trombone/, 'Puzon'], [/\brog\b|\bhorn\b/, 'Róg'], [/perkusja|percussion|\bdrums\b/, 'Perkusja'],
  [/akompaniament|podklad|accompaniment|instrumental/, 'Akompaniament'], [/\bsolo\b/, 'Solo'], [/\bchor\b|\bchoir\b/, 'Chór'],
  [/calosc|tutti|\bfull\b|\bmix\b|razem|wszystkie glosy/, 'Całość']
];

/** Eine geteilte Stimme: „Sopran 2", „Tenor_II", „Alto1" — die römische Zahl nur gross („Tenor i Bas" ist keine). */
const SPLIT = /(?:[Ss]opran[oa]?|SOPRAN[OA]?|[Aa]lt[oa]?|ALT[OA]?|[Tt]enor|TENOR|[Bb]as(?:s|so)?|BAS(?:S|SO)?)[\s_.-]*(II|I|[12])(?![A-Za-z0-9])/;

/**
 * WAS EINE DATEI IST, NACH IHREM NAMEN: „Barka - Sopran.mp3" → Sopran, „ave_verum_Tenor2.ogg" → Tenor II,
 * „Barka S.mp3" → Sopran, „Mozart full mix.wav" → Całość (das Ganze). Was nichts verrät, heisst wie die Datei
 * ohne Endung (`known: false`).
 */
export function guessVoice(fileName: string): { label: string; role: 'part' | 'whole'; known: boolean } {
  const base = fileName.replace(/\.[a-z0-9]{1,5}$/i, '');
  const words = fold(base).replace(/[_\-.()[\]]+/g, ' ');
  for (const [pattern, label] of VOICE_WORDS) {
    if (!pattern.test(words)) continue;
    if (label === 'Całość') return { label, role: 'whole', known: true };
    const n = ['Sopran', 'Alt', 'Tenor', 'Bas'].includes(label) ? SPLIT.exec(base) : null;
    return { label: `${label}${n === null ? '' : n[1] === 'II' || n[1] === '2' ? ' II' : ' I'}`, role: 'part', known: true };
  }
  /* Ein einzelner Buchstabe der Partitur am Ende: „Barka S.mp3", „ave-verum_T2" (S, A, T, B). */
  const letter = /(?:^|\s)([satb])([12])?\s*$/.exec(words);
  if (letter !== null) {
    const label = ({ s: 'Sopran', a: 'Alt', t: 'Tenor', b: 'Bas' } as const)[letter[1] as 's' | 'a' | 't' | 'b'];
    return { label: `${label}${letter[2] === undefined ? '' : letter[2] === '2' ? ' II' : ' I'}`, role: 'part', known: true };
  }
  return { label: base.trim().slice(0, 80), role: 'part', known: false };
}
