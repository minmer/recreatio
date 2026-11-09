/**
 * DIE ARTEN DER BIBLIOTHEK (0064) — was ein Eintrag sein kann, an EINER Stelle.
 *
 * <b>Wie die Bausteine einer Seite (`part.ts`):</b> eine Art sagt, welche
 * Felder sie hat, welche davon privat bleiben, worauf sie verweist, wie sie
 * heisst und wie sie sortiert wird. Der Editor zeichnet daraus sein Formular,
 * die Veröffentlichung ihre offene Fassung, der JSON-Import seine
 * Beschreibung. Eine neue Art (später für Cogita: Wort, Satz, Frage) ist ein
 * Eintrag in `KINDS` — nichts sonst muss sie kennen.
 *
 * <b>Ein Werk gibt es einmal.</b> Ein Zitat zeigt auf sein Werk, das Werk
 * auf seine Autoren, ein Text (eine Predigt, ein Kapitel) nennt Werke und
 * Zitate über ihren Zitierschlüssel (`[@ratzinger2007, s. 23]`). Wer den
 * Titel eines Werks berichtigt, berichtigt ihn überall, wo es genannt wird.
 *
 * <b>Wer einen Eintrag liest, entscheidet sein Bereich — und nur er</b>
 * (2026-10-22). Es gibt keine privaten Felder und kein einzelnes
 * Veröffentlichen.
 *
 * <b>2026-10-23 — DREI TEILE.</b> Die Bibliothek hält nur noch Quellen
 * (`LIBRARY_KINDS`: Werke, Zitate, Personen) und zeigt nur auf Quellen. Das
 * Schreiben (`WRITING_KINDS`: Texte, Wygłoszenia, Projekte) steht im
 * Skryptorium; Komentarze und alles Geordnete sind eigene Arten in Cogita.
 * Themen gibt es keine mehr. `kindOf` kennt beide Gruppen — gelesen und
 * zitiert wird über die Teile hinweg.
 */

import { LITURGY_KINDS } from './liturgy/kinds';
import { blockMarkups, blockRefs, blocksOf, blocksTitle, statementBlocks } from './blocks';
import { mapRefTokens } from './libraryMarkup';
import { TEXT_SCHEMES, workLocatorKey } from './locations';
import { t, texts } from '../core/i18n';

export type EntryData = Record<string, unknown>;

/** Was eine Art von einem Eintrag braucht — der ganze Eintrag oder seine offene Fassung. */
export interface LibEntry {
  readonly id: string;
  readonly kind: string;
  readonly key?: string;
  readonly data: EntryData;
}

/** Wie man einen Eintrag findet — im Speicher des Browsers oder in einer veröffentlichten Sammlung. */
export interface Lookup {
  get(id: string): LibEntry | undefined;
  byKey(key: string): LibEntry | undefined;
  /**
   * 2026-10-21 — wer auf einen Eintrag zeigt. Nur der Speicher im Browser
   * kennt es (die Wygłoszenia eines Textes); eine veröffentlichte Sammlung
   * nennt sie im Text selbst (`deliveries`).
   */
  backlinks?(id: string): readonly LibEntry[];
  /** 2026-10-22 — alles Lesbare, über die Bibliothek hinaus (für „Komentarze o tym wpisie"). */
  readable?(): readonly LibEntry[];
  /** 2026-10-22 — wie ein Eintrag heisst, wo die Bibliothek seine Art nicht kennt (ein Eintrag einer Baza wiedzy). */
  title?(entry: LibEntry): string;
  /**
   * 2026-10-23 — steigt, wenn sich hier oder bei einem Nachbarn etwas ändert (ein Speicher hat es).
   * Eine Zeichnung, die sich etwas merkt (Fussnoten), rechnet damit neu: auf einer Seite kommt die
   * Bibliothek, aus der ein Text des Skryptorium zitiert, oft erst nach dem Text an.
   */
  readonly revision?: number;
  /**
   * 2026-10-24 — die Texte eines Werks (ihre Verzeichnisse, `sourceText.ts`) und ein Teil davon,
   * geholt, wenn jemand liest. Nur ein Speicher kennt sie — und nur, was dieser Leser lesen darf.
   */
  texts?(workId: string): readonly LibEntry[];
  heavy?(id: string): Promise<LibEntry | null>;
  /**
   * 2026-10-25 — ist diese Frage beantwortet? Eine Baza wiedzy rechnet es für alle ihre Einträge
   * auf einmal (eine Aussage zeigt auf sie, oder ein Schritt liegt in der Struktur unter ihr);
   * `undefined`: weiss es nicht — dann rechnet `answersTo` aus `readable`.
   */
  answered?(id: string): boolean | undefined;
}

/**
 * `items` (2026-10-21): eine Liste von Objekten mit eigenen Feldern (`LibField.item`)
 * — die Punkte eines Plans, die Zeilen „co z planu" eines Wygłoszenia.
 * `blocks` (2026-10-22): der Inhalt eines Komentarza — Absätze, Listen,
 * Tabellen, in deren Zellen echte Verweise stehen (`comment.ts`).
 * `fields` (2026-10-23): die Felder eines Rodzaj tekstu — Felder wie die
 * eines Rodzaj in Nauka (`cogita/schema.ts`, `FieldDef`), mit demselben Editor.
 */
export type LibFieldType = 'line' | 'text' | 'markup' | 'number' | 'date' | 'select' | 'url' | 'ref' | 'refs' | 'outline' | 'items' | 'blocks' | 'fields' | 'media';

export interface LibField {
  readonly key: string;
  readonly label: string;
  readonly type: LibFieldType;
  /** Was das Feld im JSON bedeutet — für die Beschreibung neben dem Import. */
  readonly says: string;
  readonly hint?: string;
  /** 2026-10-26 — `group`: unter welcher Überschrift die Wahl steht (die Rodzaje: Texte, Musik). */
  readonly options?: readonly { readonly value: string; readonly label: string; readonly group?: string }[];
  /** Bei `ref`/`refs`: auf welche Arten es zeigen darf. */
  readonly to?: readonly string[];
  /**
   * 2026-10-26 — bei `ref`/`refs`: nur diese Einträge zur Wahl, und was ein dort neu angelegter bekommt
   * („Utwór" eines Nagrania: nur Utwory; ein neuer ist ein Utwór).
   */
  readonly pick?: { readonly only?: (entry: LibEntry) => boolean; readonly makeWith?: EntryData };
  /** Nur gezeigt, wenn — etwa Seitenzahlen nur bei Kapitel und Artikel. */
  readonly when?: (data: EntryData) => boolean;
  /**
   * 2026-10-21 — bei `items`: die Felder EINES Eintrags der Liste. Sie werden
   * beschrieben, importiert und durchsucht wie die Felder einer Art.
   */
  readonly item?: readonly LibField[];
}

export interface LibKind {
  readonly kind: string;
  readonly label: string;
  readonly plural: string;
  /** Wozu die Art da ist, in einem Satz. */
  readonly says: string;
  /** Trägt sie einen Zitierschlüssel (`[@schlüssel]`)? */
  readonly keyed: boolean;
  readonly fields: readonly LibField[];
  readonly title: (data: EntryData, look: Lookup) => string;
  /** Wonach sie in Listen und öffentlich geordnet wird. */
  readonly sort: (entry: LibEntry, look: Lookup) => string;
  /** Ein ausgefülltes Beispiel für die Beschreibung (Verweise als `@schlüssel`). */
  readonly example: { readonly key?: string; readonly data: EntryData };
  /** 2026-10-26 — weitere Beispiele mit einer Überschrift (ein Werk: auch Musik). */
  readonly more?: readonly { readonly label: string; readonly key?: string; readonly data: EntryData }[];
}

/* -- Duldsame Leser ------------------------------------------------------------------ */

export const str = (data: EntryData, key: string): string => {
  const value = data[key];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
};

export const ids = (data: EntryData, key: string): string[] => {
  const value = data[key];
  if (Array.isArray(value)) return value.filter((one): one is string => typeof one === 'string' && one !== '');
  return typeof value === 'string' && value !== '' ? [value] : [];
};

export const num = (data: EntryData, key: string): number | null => {
  const value = data[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Die Einträge eines `items`-Feldes — duldsam: was kein Objekt ist, fällt weg. */
export function itemsOf(data: EntryData, key: string): Record<string, unknown>[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.filter((one): one is Record<string, unknown> => typeof one === 'object' && one !== null && !Array.isArray(one));
}

/** Ein Punkt der Gliederung eines Projekts: eine Überschrift oder ein Text. */
export type OutlineItem = { readonly heading: string } | { readonly text: string };

export function outline(data: EntryData, key = 'outline'): OutlineItem[] {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  const out: OutlineItem[] = [];
  for (const one of value) {
    if (typeof one !== 'object' || one === null) continue;
    const item = one as Record<string, unknown>;
    if (typeof item.text === 'string' && item.text !== '') out.push({ text: item.text });
    else if (typeof item.heading === 'string') out.push({ heading: item.heading });
  }
  return out;
}

const clip = (text: string, length: number): string =>
  text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`; // i18n-ignore

/** Polnisch nach ASCII, für Schlüssel: „Świętość” → „swietosc”. */
export function slug(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l') // i18n-ignore
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* -- Personen ---------------------------------------------------------------------------- */

export const personName = (data: EntryData): string =>
  str(data, 'name').trim() || [str(data, 'givenNames'), str(data, 'surname')].map((s) => s.trim()).filter(Boolean).join(' ') || t('libraryKinds.person.label');

const PERSON: LibKind = {
  kind: 'person',
  label: 'libraryKinds.person.label',
  plural: 'libraryKinds.person.plural',
  says: 'libraryKinds.person.says',
  keyed: true,
  fields: [
    {
      key: 'personType', label: 'libraryKinds.person.fields.personType.label', type: 'select', says: 'libraryKinds.person.fields.personType.says',
      options: [{ value: 'person', label: 'libraryKinds.person.type.person' }, { value: 'organization', label: 'libraryKinds.person.type.organization' }]
    },
    { key: 'name', label: 'libraryKinds.person.fields.name.label', type: 'line', says: 'libraryKinds.person.fields.name.says', hint: 'libraryKinds.person.fields.name.hint' },
    { key: 'givenNames', label: 'libraryKinds.person.fields.givenNames.label', type: 'line', says: 'libraryKinds.person.fields.givenNames.says', hint: 'libraryKinds.person.fields.givenNames.hint' },
    { key: 'surname', label: 'libraryKinds.person.fields.surname.label', type: 'line', says: 'libraryKinds.person.fields.surname.says', hint: 'libraryKinds.person.fields.surname.hint' },
    { key: 'years', label: 'libraryKinds.person.fields.years.label', type: 'line', says: 'libraryKinds.person.fields.years.says', hint: 'libraryKinds.person.fields.years.hint' },
    { key: 'description', label: 'libraryKinds.person.fields.description.label', type: 'text', says: 'libraryKinds.person.fields.description.says' },
    { key: 'url', label: 'libraryKinds.person.fields.url.label', type: 'url', says: 'libraryKinds.person.fields.url.says' }
  ],
  title: (data) => personName(data),
  sort: (entry) => (str(entry.data, 'surname') || personName(entry.data)).toLowerCase(),
  example: {
    key: 'ratzinger',
    data: { personType: 'person', givenNames: 'Joseph', surname: 'Ratzinger', years: '1927–2022', description: 'Papież Benedykt XVI.' } // i18n-ignore
  },
  /* 2026-10-26 — der Komponist und der Chor der Musikbeispiele (beim Werk). */
  more: [
    { label: 'libraryKinds.person.more.composer', key: 'mozart', data: { personType: 'person', givenNames: 'Wolfgang Amadeus', surname: 'Mozart', years: '1756–1791' } },
    { label: 'libraryKinds.person.more.choir', key: 'schola-katedralna', data: { personType: 'organization', name: 'Schola Katedralna' } }
  ]
};

/* -- Werke (Quellen) --------------------------------------------------------------------- */

/** Die Überschriften der Rodzaje in der Auswahl (2026-10-26) — 2026-11-09 als Schlüssel; gezeichnet übersetzt (`LibraryFields.tsx`). */
export const TEXT_GROUP = 'libraryKinds.group.texts';
export const MUSIC_GROUP = 'libraryKinds.group.music';

export const WORK_TYPES = [
  { value: 'book', label: 'libraryKinds.workTypes.book', group: TEXT_GROUP },
  { value: 'chapter', label: 'libraryKinds.workTypes.chapter', group: TEXT_GROUP },
  { value: 'article', label: 'libraryKinds.workTypes.article', group: TEXT_GROUP },
  { value: 'periodical', label: 'libraryKinds.workTypes.periodical', group: TEXT_GROUP },
  { value: 'document', label: 'libraryKinds.workTypes.document', group: TEXT_GROUP },
  { value: 'bible', label: 'libraryKinds.workTypes.bible', group: TEXT_GROUP },
  { value: 'web', label: 'libraryKinds.workTypes.web', group: TEXT_GROUP },
  { value: 'talk', label: 'libraryKinds.workTypes.talk', group: TEXT_GROUP },
  { value: 'other', label: 'libraryKinds.workTypes.other', group: TEXT_GROUP },
  /*
    2026-10-26 — MUSIK, ein eigener Teil der Bibliothek („Muzyka"): der Utwór als solcher, Nuty (eine Ausgabe,
    mit ihren Dateien), ein Nagranie (eine Aufführung: eine Datei oder mehrere — die Stimmen, die Instrumente,
    die zusammen spielen) und die Płyta, auf der Nagrania stehen. Was der Rodzaj ist, entscheidet, welche Felder es gibt.
  */
  { value: 'piece', label: 'libraryKinds.workTypes.piece', group: MUSIC_GROUP },
  { value: 'score', label: 'libraryKinds.workTypes.score', group: MUSIC_GROUP },
  { value: 'recording', label: 'libraryKinds.workTypes.recording', group: MUSIC_GROUP },
  { value: 'album', label: 'libraryKinds.workTypes.album', group: MUSIC_GROUP }
] as const;

/** Was ein Rodzaj im JSON heisst und bedeutet. */
const MUSIC_SAYS: Readonly<Record<string, string>> = texts({
  piece: 'libraryKinds.musicSays.piece',
  score: 'libraryKinds.musicSays.score',
  recording: 'libraryKinds.musicSays.recording',
  album: 'libraryKinds.musicSays.album'
});

export const MUSIC_TYPES: ReadonlySet<string> = new Set(['piece', 'score', 'recording', 'album']);

/** Ein Werk der Musik — es steht unter „Muzyka", nicht unter „Źródła". */
export const isMusic = (data: EntryData): boolean => MUSIC_TYPES.has(str(data, 'workType'));

const typeIs = (...types: readonly string[]) => (data: EntryData): boolean => types.includes(str(data, 'workType'));
const typeIsNot = (...types: readonly string[]) => (data: EntryData): boolean => !types.includes(str(data, 'workType'));
const notMusic = (data: EntryData): boolean => !isMusic(data);
const ofType = (type: string) => (entry: LibEntry): boolean => entry.kind === 'work' && str(entry.data, 'workType') === type;

const PSALMS = [
  { value: 'hebrew', label: 'libraryKinds.psalms.hebrew' },
  { value: 'greek', label: 'libraryKinds.psalms.greek' }
] as const;

const isPart = (data: EntryData) =>['chapter', 'article'].includes(str(data, 'workType'));

/** Was man in die Hand nimmt und ins Regal stellt — Seiten, Einband, Masse, eine eigene Nummer (auch Nuty). */
const isVolume = typeIsNot('chapter', 'article', 'web', 'talk', 'piece', 'recording', 'album');

/** Eine Datei der Nuty: was sie ist (die Partitur, eine Stimme) und die Datei. */
const SCORE_FILE_ITEM: readonly LibField[] = [
  { key: 'id', label: 'libraryKinds.scoreFileItem.id.label', type: 'line', says: 'libraryKinds.scoreFileItem.id.says' },
  { key: 'label', label: 'libraryKinds.scoreFileItem.label.label', type: 'line', says: 'libraryKinds.scoreFileItem.label.says', hint: 'libraryKinds.scoreFileItem.label.hint' },
  { key: 'file', label: 'libraryKinds.scoreFileItem.file.label', type: 'media', says: 'libraryKinds.scoreFileItem.file.says' }
];

/** Eine Spur eines Nagrania: die Stimme oder das Instrument (oder das Ganze) und die Datei. */
export const TRACK_ROLES = [
  { value: 'part', label: 'libraryKinds.trackRoles.part' },
  { value: 'whole', label: 'libraryKinds.trackRoles.whole' }
] as const;

const TRACK_ITEM: readonly LibField[] = [
  { key: 'id', label: 'libraryKinds.trackItem.id.label', type: 'line', says: 'libraryKinds.trackItem.id.says' },
  { key: 'label', label: 'libraryKinds.trackItem.label.label', type: 'line', says: 'libraryKinds.trackItem.label.says', hint: 'libraryKinds.trackItem.label.hint' },
  {
    key: 'role', label: 'libraryKinds.trackItem.role.label', type: 'select', options: TRACK_ROLES,
    says: 'libraryKinds.trackItem.role.says'
  },
  { key: 'file', label: 'libraryKinds.trackItem.file.label', type: 'media', says: 'libraryKinds.trackItem.file.says' }
];

export const BINDINGS = [
  { value: 'soft', label: 'libraryKinds.bindings.soft' },
  { value: 'soft-flaps', label: 'libraryKinds.bindings.softFlaps' },
  { value: 'hard', label: 'libraryKinds.bindings.hard' },
  { value: 'integrated', label: 'libraryKinds.bindings.integrated' },
  { value: 'cloth', label: 'libraryKinds.bindings.cloth' },
  { value: 'leather', label: 'libraryKinds.bindings.leather' },
  { value: 'spiral', label: 'libraryKinds.bindings.spiral' },
  { value: 'ebook', label: 'libraryKinds.bindings.ebook' },
  { value: 'other', label: 'libraryKinds.bindings.other' }
] as const;

export const workTitle = (data: EntryData): string => {
  const title = str(data, 'title').trim();
  const sub = str(data, 'subtitle').trim();
  return title === '' ? t('libraryKinds.untitled') : sub === '' ? title : `${title}. ${sub}`; // i18n-ignore
};

const WORK: LibKind = {
  kind: 'work',
  label: 'libraryKinds.work.label',
  plural: 'libraryKinds.work.plural',
  says: 'libraryKinds.work.says',
  keyed: true,
  fields: [
    {
      key: 'workType', label: 'libraryKinds.work.fields.workType.label', type: 'select', options: WORK_TYPES,
      get says() {
        return t('libraryKinds.work.fields.workType.says', {
          types: WORK_TYPES.filter((w) => !MUSIC_TYPES.has(w.value)).map((w) => `"${w.value}" (${w.label})`).join(', '),
          music: WORK_TYPES.filter((w) => MUSIC_TYPES.has(w.value)).map((w) => `"${w.value}" (${w.label} — ${MUSIC_SAYS[w.value]})`).join(', ')
        });
      }
    },
    { key: 'title', label: 'libraryKinds.work.fields.title.label', type: 'line', says: 'libraryKinds.work.fields.title.says' },
    { key: 'subtitle', label: 'libraryKinds.work.fields.subtitle.label', type: 'line', says: 'libraryKinds.work.fields.subtitle.says' },
    { key: 'originalTitle', label: 'libraryKinds.work.fields.originalTitle.label', type: 'line', says: 'libraryKinds.work.fields.originalTitle.says', when: typeIsNot('score', 'album') },
    /* 2026-10-26 — wonach man einen Utwór kennt: der Incipit, ein Titel in einer anderen Sprache (auch eine Antwort, die später gelten soll). */
    {
      key: 'otherTitles', label: 'libraryKinds.work.fields.otherTitles.label', type: 'text', when: typeIs('piece', 'recording'),
      says: 'libraryKinds.work.fields.otherTitles.says', hint: 'libraryKinds.work.fields.otherTitles.hint'
    },
    { key: 'authors', label: 'libraryKinds.work.fields.authors.label', type: 'refs', to: ['person'], says: 'libraryKinds.work.fields.authors.says', when: notMusic },
    { key: 'composers', label: 'libraryKinds.work.fields.composers.label', type: 'refs', to: ['person'], says: 'libraryKinds.work.fields.composers.says', when: typeIs('piece', 'score', 'recording') },
    { key: 'lyricists', label: 'libraryKinds.work.fields.lyricists.label', type: 'refs', to: ['person'], says: 'libraryKinds.work.fields.lyricists.says', when: typeIs('piece', 'score', 'recording') },
    { key: 'arrangers', label: 'libraryKinds.work.fields.arrangers.label', type: 'refs', to: ['person'], says: 'libraryKinds.work.fields.arrangers.says', when: typeIs('piece', 'score', 'recording') },
    { key: 'editors', label: 'libraryKinds.work.fields.editors.label', type: 'refs', to: ['person'], says: 'libraryKinds.work.fields.editors.says', when: typeIsNot('piece', 'recording', 'album') },
    { key: 'translators', label: 'libraryKinds.work.fields.translators.label', type: 'refs', to: ['person'], says: 'libraryKinds.work.fields.translators.says', when: typeIsNot('score', 'recording', 'album') },
    { key: 'performers', label: 'libraryKinds.work.fields.performers.label', type: 'refs', to: ['person'], says: 'libraryKinds.work.fields.performers.says', when: typeIs('recording', 'album') },
    {
      key: 'piece', label: 'libraryKinds.work.fields.piece.label', type: 'ref', to: ['work'], when: typeIs('score', 'recording'),
      says: 'libraryKinds.work.fields.piece.says',
      pick: { only: ofType('piece'), makeWith: { workType: 'piece' } }
    },
    {
      key: 'album', label: 'libraryKinds.work.fields.album.label', type: 'ref', to: ['work'], when: typeIs('recording'),
      says: 'libraryKinds.work.fields.album.says',
      pick: { only: ofType('album'), makeWith: { workType: 'album' } }
    },
    { key: 'track', label: 'libraryKinds.work.fields.track.label', type: 'line', says: 'libraryKinds.work.fields.track.says', hint: 'libraryKinds.work.fields.track.hint', when: typeIs('recording') },
    { key: 'container', label: 'libraryKinds.work.fields.container.label', type: 'ref', to: ['work'], says: 'libraryKinds.work.fields.container.says', when: isPart },
    { key: 'volume', label: 'libraryKinds.work.fields.volume.label', type: 'line', says: 'libraryKinds.work.fields.volume.says', hint: 'libraryKinds.work.fields.volume.hint', when: typeIsNot('piece', 'recording', 'album') },
    { key: 'issue', label: 'libraryKinds.work.fields.issue.label', type: 'line', says: 'libraryKinds.work.fields.issue.says', when: (d) => str(d, 'workType') === 'article' },
    { key: 'edition', label: 'libraryKinds.work.fields.edition.label', type: 'line', says: 'libraryKinds.work.fields.edition.says', hint: 'libraryKinds.work.fields.edition.hint', when: typeIsNot('piece', 'recording', 'album') },
    { key: 'catalogue', label: 'libraryKinds.work.fields.catalogue.label', type: 'line', says: 'libraryKinds.work.fields.catalogue.says', hint: 'libraryKinds.work.fields.catalogue.hint', when: typeIs('piece', 'score', 'album') },
    { key: 'musicKey', label: 'libraryKinds.work.fields.musicKey.label', type: 'line', says: 'libraryKinds.work.fields.musicKey.says', hint: 'libraryKinds.work.fields.musicKey.hint', when: typeIs('piece', 'score', 'recording') },
    { key: 'voicing', label: 'libraryKinds.work.fields.voicing.label', type: 'line', says: 'libraryKinds.work.fields.voicing.says', hint: 'libraryKinds.work.fields.voicing.hint', when: typeIs('piece', 'score', 'recording') },
    /* 2026-10-27 — auch bei Büchern: eine Powieść biograficzna erzählt Wirkliches anders als eine Biografia, ein Mszał ist ein Zbiór numerierter Teile. */
    { key: 'genre', label: 'libraryKinds.work.fields.genre.label', type: 'line', says: 'libraryKinds.work.fields.genre.says', hint: 'libraryKinds.work.fields.genre.hint', when: typeIs('piece', 'book') },
    { key: 'duration', label: 'libraryKinds.work.fields.duration.label', type: 'line', says: 'libraryKinds.work.fields.duration.says', hint: 'libraryKinds.work.fields.duration.hint', when: typeIs('recording', 'album') },
    { key: 'publisher', label: 'libraryKinds.work.fields.publisher.label', type: 'line', says: 'libraryKinds.work.fields.publisher.says', when: typeIsNot('piece') },
    { key: 'place', label: 'libraryKinds.work.fields.place.label', type: 'line', says: 'libraryKinds.work.fields.place.says', hint: 'libraryKinds.work.fields.place.hint', when: typeIsNot('piece') },
    { key: 'year', label: 'libraryKinds.work.fields.year.label', type: 'line', says: 'libraryKinds.work.fields.year.says', hint: 'libraryKinds.work.fields.year.hint' },
    { key: 'series', label: 'libraryKinds.work.fields.series.label', type: 'line', says: 'libraryKinds.work.fields.series.says', hint: 'libraryKinds.work.fields.series.hint', when: isVolume },
    { key: 'pages', label: 'libraryKinds.work.fields.pages.label', type: 'line', says: 'libraryKinds.work.fields.pages.says', hint: 'libraryKinds.work.fields.pages.hint', when: isPart },
    { key: 'pageCount', label: 'libraryKinds.work.fields.pageCount.label', type: 'number', says: 'libraryKinds.work.fields.pageCount.says', hint: 'libraryKinds.work.fields.pageCount.hint', when: isVolume },
    { key: 'binding', label: 'libraryKinds.work.fields.binding.label', type: 'select', options: BINDINGS, get says() { return t('libraryKinds.work.fields.binding.says', { list: BINDINGS.map((b) => `"${b.value}" (${b.label})`).join(', ') }); }, when: isVolume },
    { key: 'height', label: 'libraryKinds.work.fields.height.label', type: 'number', says: 'libraryKinds.work.fields.height.says', hint: 'libraryKinds.work.fields.height.hint', when: isVolume },
    { key: 'width', label: 'libraryKinds.work.fields.width.label', type: 'number', says: 'libraryKinds.work.fields.width.says', hint: 'libraryKinds.work.fields.width.hint', when: isVolume },
    { key: 'length', label: 'libraryKinds.work.fields.length.label', type: 'number', says: 'libraryKinds.work.fields.length.says', hint: 'libraryKinds.work.fields.length.hint', when: isVolume },
    { key: 'siglum', label: 'libraryKinds.work.fields.siglum.label', type: 'line', says: 'libraryKinds.work.fields.siglum.says', hint: 'libraryKinds.work.fields.siglum.hint', when: (d) => str(d, 'workType') === 'bible' },
    { key: 'isbn', label: 'libraryKinds.work.fields.isbn.label', type: 'line', says: 'libraryKinds.work.fields.isbn.says', when: notMusic },
    { key: 'ismn', label: 'libraryKinds.work.fields.ismn.label', type: 'line', says: 'libraryKinds.work.fields.ismn.says', hint: 'libraryKinds.work.fields.ismn.hint', when: typeIs('score') },
    { key: 'libraryNumber', label: 'libraryKinds.work.fields.libraryNumber.label', type: 'line', says: 'libraryKinds.work.fields.libraryNumber.says', hint: 'libraryKinds.work.fields.libraryNumber.hint', when: (d) => isVolume(d) || typeIs('album')(d) },
    { key: 'doi', label: 'libraryKinds.work.fields.doi.label', type: 'line', says: 'libraryKinds.work.fields.doi.says', when: notMusic },
    { key: 'url', label: 'libraryKinds.work.fields.url.label', type: 'url', says: 'libraryKinds.work.fields.url.says' },
    { key: 'accessed', label: 'libraryKinds.work.fields.accessed.label', type: 'date', says: 'libraryKinds.work.fields.accessed.says', when: (d) => str(d, 'workType') === 'web' || str(d, 'url') !== '' },
    { key: 'language', label: 'libraryKinds.work.fields.language.label', type: 'line', says: 'libraryKinds.work.fields.language.says', when: typeIsNot('album') },
    { key: 'lyrics', label: 'libraryKinds.work.fields.lyrics.label', type: 'text', says: 'libraryKinds.work.fields.lyrics.says', when: typeIs('piece') },
    /* 2026-10-24 — wie Stellen in diesem Werk gelesen werden, und wovon es eine Ausgabe ist (`locations.ts`, `sourceText.ts`). */
    {
      key: 'scheme', label: 'libraryKinds.work.fields.scheme.label', type: 'select', options: TEXT_SCHEMES.map((s) => ({ value: s.id, get label() { return s.label; } })),
      get says() { return t('libraryKinds.work.fields.scheme.says', { list: TEXT_SCHEMES.map((s) => `"${s.id}" (${s.label})`).join(', ') }); },
      hint: 'libraryKinds.work.fields.scheme.hint', when: notMusic
    },
    /*
     * 2026-10-27 — Seiten in Serien, für jedes Buch: in welcher Reihenfolge sie im Buch stehen — je eine Beispielseite
     * (`locations.ts` readSeries). Welche Zeichen eine Serie hat, sagt die Seite selbst; hier nur die Reihenfolge.
     */
    {
      key: 'pageSeries', label: 'libraryKinds.work.fields.pageSeries.label', type: 'line',
      says: 'libraryKinds.work.fields.pageSeries.says',
      hint: "np. xii 12* 1 3'", when: (d) => notMusic(d) && ['', 'pages', 'outline'].includes(str(d, 'scheme'))
    },
    {
      key: 'psalms', label: 'libraryKinds.work.fields.psalms.label', type: 'select', options: PSALMS,
      says: 'libraryKinds.work.fields.psalms.says',
      when: (d) => str(d, 'workType') === 'bible' || str(d, 'scheme') === 'bible'
    },
    { key: 'editionOf', label: 'libraryKinds.work.fields.editionOf.label', type: 'ref', to: ['work'], says: 'libraryKinds.work.fields.editionOf.says', when: notMusic },
    /* 2026-10-26 — die Dateien der Musik: die Seiten der Nuty, die Spuren eines Nagrania (`MusicFiles.tsx`). */
    { key: 'files', label: 'libraryKinds.work.fields.files.label', type: 'items', item: SCORE_FILE_ITEM, says: 'libraryKinds.work.fields.files.says', when: typeIs('score') },
    { key: 'tracks', label: 'libraryKinds.work.fields.tracks.label', type: 'items', item: TRACK_ITEM, says: 'libraryKinds.work.fields.tracks.says', when: typeIs('recording') }
  ],
  title: (data) => workTitle(data),
  sort: (entry, look) => {
    /* 2026-10-26 — Musik nach dem Komponisten, sonst nach den Ausführenden. */
    const people = isMusic(entry.data) ? [...ids(entry.data, 'composers'), ...ids(entry.data, 'performers')] : ids(entry.data, 'authors');
    const first = people[0];
    const author = first === undefined ? undefined : look.get(first);
    const by = author === undefined ? '' : `${(str(author.data, 'surname') || personName(author.data)).toLowerCase()} `;
    return clip(`${by}${str(entry.data, 'title').toLowerCase()} ${str(entry.data, 'year')}`, 64);
  },
  example: {
    key: 'ratzinger2007',
    data: {
      workType: 'book', title: 'Jezus z Nazaretu', subtitle: 'Część 1: Od chrztu w Jordanie do Przemienienia', // i18n-ignore
      originalTitle: 'Jesus von Nazareth', authors: ['@ratzinger'], volume: '1', publisher: 'Wydawnictwo M', place: 'Kraków', year: '2007', // i18n-ignore
      series: 'Dzieła wybrane, t. 1', pageCount: 384, binding: 'hard', height: 24, width: 16.5, length: 3, // i18n-ignore
      isbn: '978-83-7595-061-8', libraryNumber: 'B-0042'
    }
  },
  /* 2026-10-26 — Musik: der Utwór und ein Nagranie davon in Stimmen (die Dateien kommen in der App dazu). */
  more: [
    {
      label: 'libraryKinds.work.more.piece', key: 'mozart-ave-verum',
      data: {
        workType: 'piece', title: 'Ave verum corpus', otherTitles: 'Witaj, Ciało prawdziwe', composers: ['@mozart'], // i18n-ignore
        catalogue: 'KV 618', musicKey: 'D-dur', voicing: 'chór mieszany, smyczki i organy', genre: 'motet', year: '1791', language: 'la' // i18n-ignore
      }
    },
    {
      label: 'libraryKinds.work.more.recording', key: 'ave-verum-schola2024',
      data: {
        workType: 'recording', title: 'Ave verum corpus', piece: '@mozart-ave-verum', performers: ['@schola-katedralna'], year: '2024', duration: '3:05', // i18n-ignore
        tracks: [{ label: 'Sopran', role: 'part' }, { label: 'Alt', role: 'part' }, { label: 'Tenor', role: 'part' }, { label: 'Bas', role: 'part' }, { label: 'Całość', role: 'whole' }] // i18n-ignore
      }
    }
  ]
};

/* -- Zitate ------------------------------------------------------------------------------- */

const QUOTE: LibKind = {
  kind: 'quote',
  label: 'libraryKinds.quote.label',
  plural: 'libraryKinds.quote.plural',
  says: 'libraryKinds.quote.says',
  keyed: true,
  fields: [
    { key: 'text', label: 'libraryKinds.quote.fields.text.label', type: 'text', says: 'libraryKinds.quote.fields.text.says' },
    { key: 'work', label: 'libraryKinds.quote.fields.work.label', type: 'ref', to: ['work'], says: 'libraryKinds.quote.fields.work.says' },
    { key: 'locator', label: 'libraryKinds.quote.fields.locator.label', type: 'line', says: 'libraryKinds.quote.fields.locator.says', hint: 'libraryKinds.quote.fields.locator.hint' },
    { key: 'language', label: 'libraryKinds.quote.fields.language.label', type: 'line', says: 'libraryKinds.quote.fields.language.says' },
    { key: 'translation', label: 'libraryKinds.quote.fields.translation.label', type: 'text', says: 'libraryKinds.quote.fields.translation.says' }
  ],
  title: (data) => clip(str(data, 'text').replace(/\s+/g, ' ').trim() || t('libraryKinds.quote.label'), 90),
  sort: (entry, look) => quoteOrder(entry, look).slice(0, 64),
  example: {
    key: 'ratzinger2007-1',
    data: {
      text: 'Modlitwa jest rozmową z Bogiem, w której człowiek staje się sobą.', // i18n-ignore
      work: '@ratzinger2007', locator: 's. 168'
    }
  }
};

/**
 * 2026-10-22 — WIE ZITATE STEHEN: nach dem Werk, dann nach der Stelle — in der
 * Schrift nach dem Kanon („Dz 1,8" vor „Dz 1,14", „Rdz" vor „Mt"), sonst mit
 * Zahlen als Zahlen („s. 9" vor „s. 10").
 */
export function quoteOrder(entry: LibEntry, look: Lookup): string {
  const work = look.get(ids(entry.data, 'work')[0] ?? '');
  /* 2026-10-24 — nach der Regel des Werks (`locations.ts`): Seiten, Verse, Nummern, Quaestionen, Propositionen. */
  return `${work === undefined ? '~' : WORK.sort(work, look).slice(0, 36)}|${workLocatorKey(str(entry.data, 'locator'), work?.data)}`;
}

/* -- Eigene Texte ------------------------------------------------------------------------- */

/** 2026-10-23 — der Name des Rodzaj tekstu eines Textes (leer: ein einfacher Text). */
export function textTypeName(data: EntryData, look: Lookup): string {
  const type = look.get(ids(data, 'textType')[0] ?? '');
  return type !== undefined && type.kind === 'texttype' ? str(type.data, 'name').trim() : '';
}

export const TEXT_STATUS = [
  { value: 'idea', label: 'libraryKinds.textStatus.idea' },
  { value: 'draft', label: 'libraryKinds.textStatus.draft' },
  { value: 'revision', label: 'libraryKinds.textStatus.revision' },
  { value: 'final', label: 'libraryKinds.textStatus.final' }
] as const;

/*
 * 2026-10-21 — DER PLAN EINES TEXTES: die Hauptgedanken der Reihe nach, unter
 * ihnen Zitate, Beispiele, Fragen, Anwendungen. Jeder Punkt hat eine feste
 * Kennung — ein Wygłoszenie sagt über sie, was gesagt wurde und was nicht.
 * Der Punkt selbst ist Zapis: `[@klucz, s. 12]` wird zur Fussnote, ein
 * `![@cytat]` allein ist ein Zitat aus der Bibliothek.
 */
export const POINT_KINDS = [
  { value: 'thought', label: 'libraryKinds.pointKinds.thought' },
  { value: 'quote', label: 'libraryKinds.pointKinds.quote' },
  { value: 'example', label: 'libraryKinds.pointKinds.example' },
  { value: 'question', label: 'libraryKinds.pointKinds.question' },
  { value: 'application', label: 'libraryKinds.pointKinds.application' }
] as const;

const PLAN_ITEM: readonly LibField[] = [
  { key: 'id', label: 'libraryKinds.planItem.id.label', type: 'line', says: 'libraryKinds.planItem.id.says' },
  { key: 'text', label: 'libraryKinds.planItem.text.label', type: 'markup', says: 'libraryKinds.planItem.text.says' },
  { key: 'depth', label: 'libraryKinds.planItem.depth.label', type: 'number', says: 'libraryKinds.planItem.depth.says' },
  { key: 'kind', label: 'libraryKinds.planItem.kind.label', type: 'select', options: POINT_KINDS, get says() { return t('libraryKinds.planItem.kind.says', { list: POINT_KINDS.map((k) => `"${k.value}" (${k.label})`).join(', ') }); } }
];

/*
 * 2026-10-21 — WAS EIN WYGŁOSZENIE ÜBER DEN PLAN SAGT: Punkt für Punkt, ob er
 * gesagt, nur gestreift oder ausgelassen wurde (mit der Stelle im Nagranie),
 * und was dazukam, das nicht im Plan stand.
 */
export const COVERAGE_STATES = [
  { value: 'said', label: 'libraryKinds.coverageStates.said' },
  { value: 'short', label: 'libraryKinds.coverageStates.short' },
  { value: 'skipped', label: 'libraryKinds.coverageStates.skipped' }
] as const;

const COVERAGE_ITEM: readonly LibField[] = [
  { key: 'point', label: 'libraryKinds.coverageItem.point.label', type: 'line', says: 'libraryKinds.coverageItem.point.says' },
  { key: 'state', label: 'libraryKinds.coverageItem.state.label', type: 'select', options: COVERAGE_STATES, says: 'libraryKinds.coverageItem.state.says' },
  { key: 'at', label: 'libraryKinds.coverageItem.at.label', type: 'line', says: 'libraryKinds.coverageItem.at.says' },
  { key: 'note', label: 'libraryKinds.coverageItem.note.label', type: 'text', says: 'libraryKinds.coverageItem.note.says' }
];

/*
 * 0134 — EINE LEKCJA IN EINER KLASSE ist ein Wygłoszenie des Textes (der Lekcja aus dem Programm):
 * mit der Klasse, ihrem Stand — geplant, gehalten, teilweise, nicht gehalten — und dem Zadanie für
 * die Klasse. Ohne Klasse ist es ein gewöhnliches Wygłoszenie (ein Kazanie), und der Stand fehlt.
 */
export const LESSON_STATES = [
  { value: 'planned', label: 'libraryKinds.lessonStates.planned' },
  { value: 'done', label: 'libraryKinds.lessonStates.done' },
  { value: 'partial', label: 'libraryKinds.lessonStates.partial' },
  { value: 'skipped', label: 'libraryKinds.lessonStates.skipped' }
] as const;

const CLASS_ITEM: readonly LibField[] = [
  { key: 'area', label: 'libraryKinds.classItem.area.label', type: 'line', says: 'libraryKinds.classItem.area.says' }
];

const ADDED_ITEM: readonly LibField[] = [
  { key: 'text', label: 'libraryKinds.addedItem.text.label', type: 'markup', says: 'libraryKinds.addedItem.text.says' },
  { key: 'at', label: 'libraryKinds.addedItem.at.label', type: 'line', says: 'libraryKinds.addedItem.at.says' },
  { key: 'after', label: 'libraryKinds.addedItem.after.label', type: 'line', says: 'libraryKinds.addedItem.after.says' }
];

const TEXT: LibKind = {
  kind: 'text',
  label: 'libraryKinds.text.label',
  plural: 'libraryKinds.text.plural',
  says: 'libraryKinds.text.says',
  keyed: true,
  fields: [
    /* 2026-10-23 — der Rodzaj gehört dem Besitzer (ein Eintrag „Rodzaj tekstu" mit eigenen Feldern); ohne ihn ist es ein einfacher Text. */
    { key: 'textType', label: 'libraryKinds.text.fields.textType.label', type: 'ref', to: ['texttype'], says: 'libraryKinds.text.fields.textType.says' },
    { key: 'title', label: 'libraryKinds.text.fields.title.label', type: 'line', says: 'libraryKinds.text.fields.title.says' },
    { key: 'subtitle', label: 'libraryKinds.text.fields.subtitle.label', type: 'line', says: 'libraryKinds.text.fields.subtitle.says' },
    { key: 'project', label: 'libraryKinds.text.fields.project.label', type: 'ref', to: ['project'], says: 'libraryKinds.text.fields.project.says' },
    { key: 'status', label: 'libraryKinds.text.fields.status.label', type: 'select', options: TEXT_STATUS, get says() { return t('libraryKinds.text.fields.status.says', { list: TEXT_STATUS.map((s) => `"${s.value}"`).join(', ') }); } },
    { key: 'date', label: 'libraryKinds.text.fields.date.label', type: 'date', says: 'libraryKinds.text.fields.date.says' },
    { key: 'occasion', label: 'libraryKinds.text.fields.occasion.label', type: 'line', says: 'libraryKinds.text.fields.occasion.says', hint: 'libraryKinds.text.fields.occasion.hint' },
    { key: 'place', label: 'libraryKinds.text.fields.place.label', type: 'line', says: 'libraryKinds.text.fields.place.says' },
    { key: 'readings', label: 'libraryKinds.text.fields.readings.label', type: 'line', says: 'libraryKinds.text.fields.readings.says', hint: 'libraryKinds.text.fields.readings.hint' },
    { key: 'summary', label: 'libraryKinds.text.fields.summary.label', type: 'text', says: 'libraryKinds.text.fields.summary.says' },
    {
      key: 'plan', label: 'libraryKinds.text.fields.plan.label', type: 'items', item: PLAN_ITEM,
      says: 'libraryKinds.text.fields.plan.says'
    },
    { key: 'body', label: 'libraryKinds.text.fields.body.label', type: 'markup', says: 'libraryKinds.text.fields.body.says' },
    { key: 'further', label: 'libraryKinds.text.fields.further.label', type: 'markup', says: 'libraryKinds.text.fields.further.says' },
    { key: 'audio', label: 'libraryKinds.text.fields.audio.label', type: 'url', says: 'libraryKinds.text.fields.audio.says' },
    { key: 'video', label: 'libraryKinds.text.fields.video.label', type: 'url', says: 'libraryKinds.text.fields.video.says' },
    { key: 'targetWords', label: 'libraryKinds.text.fields.targetWords.label', type: 'number', says: 'libraryKinds.text.fields.targetWords.says' }
  ],
  title: (data) => str(data, 'title').trim() || t('libraryKinds.untitled'),
  sort: (entry) => (str(entry.data, 'date') || '0000-00-00') + ' ' + str(entry.data, 'title').toLowerCase().slice(0, 50),
  example: {
    key: 'kazanie-chleb',
    data: {
      textType: '@kazanie-maryjne', title: 'Chleb, który daje życie', date: '2026-08-02', occasion: 'XVIII Niedziela zwykła', // i18n-ignore
      readings: 'Wj 16,2-4.12-15; Ef 4,17.20-24; J 6,24-35', status: 'final',
      summary: 'O głodzie, którego nie nasyci chleb.', // i18n-ignore
      plan: [
        { id: 'p1', text: 'Głód, którego nie nasyci chleb', depth: 0 }, // i18n-ignore
        { id: 'p2', text: 'Prośba o chleb sięga dalej niż pokarm [@ratzinger2007, s. 183]', depth: 1, kind: 'quote' }, // i18n-ignore
        { id: 'p3', text: '![@ratzinger2007-1]', depth: 1, kind: 'quote' }, // i18n-ignore
        { id: 'p4', text: 'Chleb dzielony przy stole w domu', depth: 1, kind: 'example' }, // i18n-ignore
        { id: 'p5', text: 'Gdzie w tym tygodniu będę szukać chleba?', depth: 0, kind: 'question' } // i18n-ignore
      ],
      body: '## Głód\nJezus mówi, że jest chlebem życia — a prośba o chleb sięga dalej niż pokarm [@ratzinger2007, s. 183].\n\n![@ratzinger2007-1]\n\nModlitwa to nie technika^[Por. też Katechizm, nr 2559.].', // i18n-ignore
      further: 'Do czytania: [@ratzinger2007].', project: '@niedziele-2026'
    }
  }
};

/* -- Wygłoszenia: ein Text, gesagt (2026-10-21) --------------------------------------------- */

/** Der erste Text eines Wygłoszenia — sein Titel nennt es in Listen. */
const deliveredText = (data: EntryData, look: Lookup): LibEntry | undefined => look.get(ids(data, 'texts')[0] ?? '');

const DELIVERY: LibKind = {
  kind: 'delivery',
  label: 'libraryKinds.delivery.label',
  plural: 'libraryKinds.delivery.plural',
  says: 'libraryKinds.delivery.says',
  keyed: false,
  fields: [
    { key: 'texts', label: 'libraryKinds.delivery.fields.texts.label', type: 'refs', to: ['text'], says: 'libraryKinds.delivery.fields.texts.says' },
    { key: 'date', label: 'libraryKinds.delivery.fields.date.label', type: 'date', says: 'libraryKinds.delivery.fields.date.says' },
    { key: 'occasion', label: 'libraryKinds.delivery.fields.occasion.label', type: 'line', says: 'libraryKinds.delivery.fields.occasion.says', hint: 'libraryKinds.delivery.fields.occasion.hint' },
    { key: 'place', label: 'libraryKinds.delivery.fields.place.label', type: 'line', says: 'libraryKinds.delivery.fields.place.says', hint: 'libraryKinds.delivery.fields.place.hint' },
    { key: 'audience', label: 'libraryKinds.delivery.fields.audience.label', type: 'line', says: 'libraryKinds.delivery.fields.audience.says', hint: 'libraryKinds.delivery.fields.audience.hint' },
    { key: 'readings', label: 'libraryKinds.delivery.fields.readings.label', type: 'line', says: 'libraryKinds.delivery.fields.readings.says' },
    { key: 'audio', label: 'libraryKinds.delivery.fields.audio.label', type: 'url', says: 'libraryKinds.delivery.fields.audio.says' },
    { key: 'video', label: 'libraryKinds.delivery.fields.video.label', type: 'url', says: 'libraryKinds.delivery.fields.video.says' },
    { key: 'duration', label: 'libraryKinds.delivery.fields.duration.label', type: 'line', says: 'libraryKinds.delivery.fields.duration.says', hint: 'libraryKinds.delivery.fields.duration.hint' },
    { key: 'summary', label: 'libraryKinds.delivery.fields.summary.label', type: 'text', says: 'libraryKinds.delivery.fields.summary.says' },
    {
      key: 'coverage', label: 'libraryKinds.delivery.fields.coverage.label', type: 'items', item: COVERAGE_ITEM,
      says: 'libraryKinds.delivery.fields.coverage.says'
    },
    {
      key: 'added', label: 'libraryKinds.delivery.fields.added.label', type: 'items', item: ADDED_ITEM,
      says: 'libraryKinds.delivery.fields.added.says'
    },
    { key: 'transcript', label: 'libraryKinds.delivery.fields.transcript.label', type: 'markup', says: 'libraryKinds.delivery.fields.transcript.says' },
    /* 0134 — eine Lekcja in einer Klasse. */
    { key: 'classArea', label: 'libraryKinds.delivery.fields.classArea.label', type: 'line', says: 'libraryKinds.delivery.fields.classArea.says' },
    { key: 'state', label: 'libraryKinds.delivery.fields.state.label', type: 'select', options: LESSON_STATES, get says() { return t('libraryKinds.delivery.fields.state.says', { list: LESSON_STATES.map((s) => `"${s.value}" (${s.label})`).join(', ') }); } },
    { key: 'homework', label: 'libraryKinds.delivery.fields.homework.label', type: 'text', says: 'libraryKinds.delivery.fields.homework.says' }
  ],
  title: (data, look) => {
    const text = deliveredText(data, look);
    return [text === undefined ? '' : str(text.data, 'title').trim(), str(data, 'date'), str(data, 'occasion')].filter((s) => s !== '').join(' · ') || t('libraryKinds.delivery.label');
  },
  sort: (entry, look) => clip(`${str(entry.data, 'date') || '0000-00-00'} ${str(deliveredText(entry.data, look)?.data ?? {}, 'title').toLowerCase()}`, 64),
  example: {
    data: {
      texts: ['@kazanie-chleb'], date: '2026-08-02', occasion: 'XVIII Niedziela zwykła', place: 'Kraków, Msza o 10:30', // i18n-ignore
      audio: 'https://example.pl/kazania/2026-08-02.mp3', duration: '14:30', summary: 'Tym razem mocniej o niedzielnej Eucharystii.',
      coverage: [
        { point: 'p1', state: 'said', at: '0:40' },
        { point: 'p2', state: 'said', at: '2:05' },
        { point: 'p3', state: 'short', at: '4:30', note: 'Bez całego cytatu.' }, // i18n-ignore
        { point: 'p4', state: 'skipped' },
        { point: 'p5', state: 'said', at: '11:20' }
      ],
      added: [{ text: 'Zaproszenie na czwartkową adorację.', at: '13:05', after: 'p5' }] // i18n-ignore
    }
  }
};

export const PROJECT_TYPES = [
  { value: 'book', label: 'libraryKinds.projectTypes.book' },
  { value: 'series', label: 'libraryKinds.projectTypes.series' },
  { value: 'collection', label: 'libraryKinds.projectTypes.collection' },
  { value: 'article', label: 'libraryKinds.projectTypes.article' },
  /* 0134 — das Programm einer Schule: seine Lekcje in der Gliederung, die Klassen, die es verwirklichen. */
  { value: 'program', label: 'libraryKinds.projectTypes.program' },
  { value: 'other', label: 'libraryKinds.projectTypes.other' }
] as const;

export const PROJECT_STATUS = [
  { value: 'planned', label: 'libraryKinds.projectStatus.planned' },
  { value: 'writing', label: 'libraryKinds.projectStatus.writing' },
  { value: 'editing', label: 'libraryKinds.projectStatus.editing' },
  { value: 'done', label: 'libraryKinds.projectStatus.done' }
] as const;

const PROJECT: LibKind = {
  kind: 'project',
  label: 'libraryKinds.project.label',
  plural: 'libraryKinds.project.plural',
  says: 'libraryKinds.project.says',
  keyed: true,
  fields: [
    { key: 'projectType', label: 'libraryKinds.project.fields.projectType.label', type: 'select', options: PROJECT_TYPES, get says() { return t('libraryKinds.project.fields.projectType.says', { list: PROJECT_TYPES.map((p) => `"${p.value}" (${p.label})`).join(', ') }); } },
    { key: 'title', label: 'libraryKinds.project.fields.title.label', type: 'line', says: 'libraryKinds.project.fields.title.says' },
    { key: 'subtitle', label: 'libraryKinds.project.fields.subtitle.label', type: 'line', says: 'libraryKinds.project.fields.subtitle.says' },
    { key: 'description', label: 'libraryKinds.project.fields.description.label', type: 'text', says: 'libraryKinds.project.fields.description.says' },
    { key: 'outline', label: 'libraryKinds.project.fields.outline.label', type: 'outline', says: 'libraryKinds.project.fields.outline.says' },
    { key: 'status', label: 'libraryKinds.project.fields.status.label', type: 'select', options: PROJECT_STATUS, get says() { return t('libraryKinds.project.fields.status.says', { list: PROJECT_STATUS.map((p) => `"${p.value}"`).join(', ') }); } },
    { key: 'deadline', label: 'libraryKinds.project.fields.deadline.label', type: 'date', says: 'libraryKinds.project.fields.deadline.says' },
    { key: 'targetWords', label: 'libraryKinds.project.fields.targetWords.label', type: 'number', says: 'libraryKinds.project.fields.targetWords.says' },
    /* 0134 — ein Programm (der Projekt einer Schule) und die Klassen, die es verwirklichen. */
    { key: 'classes', label: 'libraryKinds.project.fields.classes.label', type: 'items', item: CLASS_ITEM, says: 'libraryKinds.project.fields.classes.says' }
  ],
  title: (data) => str(data, 'title').trim() || t('libraryKinds.project.label'),
  sort: (entry) => str(entry.data, 'title').toLowerCase(),
  example: {
    key: 'niedziele-2026',
    data: {
      projectType: 'series', title: 'Niedziele 2026', description: 'Kazania niedzielne roku B.', // i18n-ignore
      outline: [{ heading: 'Lipiec' }, { text: '@kazanie-chleb' }], status: 'writing' // i18n-ignore
    }
  }
};

/* 2026-10-23 (Schritt 5) — KEINE THEMEN MEHR, nirgends: Ordnung geben eigene Rodzaje in Nauka
 * („Tajemnica", „Obszar"), verbunden über Verweisfelder. Alte Einträge der Art `topic` stehen
 * unter „Stare wpisy" (Bibliothek, Skryptorium, Nauka). Den Komentarz gibt es seit Schritt 4
 * nicht mehr: er ist ein eigener Rodzaj in Nauka mit einem Feld `blocks`. */

/* -- Rodzaje tekstów (2026-10-23): eigene Felder eines Textes ------------------------------------
 * Ein Rodzaj tekstu (Art `texttype`) gehört dem Besitzer des Skryptorium: ein Name und die
 * Felder, die jeder Text dieses Rodzaju zusätzlich hat — beschrieben wie die
 * Felder eines Rodzaj in Nauka (`FieldDef`) und mit DEMSELBEN Editor bearbeitet
 * (`cogita/KindForm.tsx`). Ein Feld kann auf Einträge in Nauka zeigen („Kazanie
 * maryjne": Tajemnica, Obszar). Die festen Felder eines Textes bleiben; ihre
 * Schlüssel sind vergeben (`scriptorium/textTypes.ts`). */

const TEXT_TYPE: LibKind = {
  /* Gespeichert als Wort aus Kleinbuchstaben — wie jede Art beim Dienst (`IsKind`). */
  kind: 'texttype',
  label: 'libraryKinds.textType.label',
  plural: 'libraryKinds.textType.plural',
  says: 'libraryKinds.textType.says',
  keyed: true,
  fields: [
    { key: 'name', label: 'libraryKinds.textType.fields.name.label', type: 'line', says: 'libraryKinds.textType.fields.name.says' },
    { key: 'description', label: 'libraryKinds.textType.fields.description.label', type: 'text', says: 'libraryKinds.textType.fields.description.says' },
    {
      key: 'fields', label: 'libraryKinds.textType.fields.fields.label', type: 'fields',
      says: 'libraryKinds.textType.fields.fields.says'
    }
  ],
  title: (data) => str(data, 'name').trim() || t('libraryKinds.textType.label'),
  sort: (entry) => str(entry.data, 'name').toLowerCase(),
  example: {
    key: 'kazanie-maryjne',
    data: {
      name: 'Kazanie maryjne',
      description: 'Kazania o tajemnicach różańca w obszarach życia Maryi.', // i18n-ignore
      fields: [
        { key: 'tajemnica', label: 'Tajemnica', type: 'ref', to: ['Tajemnica'], says: 'Która tajemnica różańca' }, // i18n-ignore
        { key: 'obszar', label: 'Obszar', type: 'ref', to: ['Obszar'], says: 'Który obszar życia Maryi' } // i18n-ignore
      ]
    }
  }
};

/*
 * 2026-11-05 — DIE TEXTE DER ARTEN stehen in `locales/<lang>/libraryKinds.json`: oben steht je ein Schlüssel
 * ('libraryKinds.…'), hier wird daraus ein Getter, der beim Lesen übersetzt — `kind.label`, `field.says`,
 * `option.label` bleiben Texte für jeden, der sie liest.
 */
const LOCALIZED = new Set(['label', 'plural', 'says', 'hint']);
function localize(node: unknown, seen = new Set<object>()): void {
  if (typeof node !== 'object' || node === null || seen.has(node)) return;
  seen.add(node);
  for (const [prop, desc] of Object.entries(Object.getOwnPropertyDescriptors(node))) {
    if (!('value' in desc)) continue;
    const value: unknown = desc.value;
    if (LOCALIZED.has(prop) && typeof value === 'string' && value.startsWith('libraryKinds.')) {
      Object.defineProperty(node, prop, { get: () => t(value), enumerable: true, configurable: true });
    } else if (typeof value === 'object' && prop !== 'data') localize(value, seen);
  }
}
localize([PERSON, WORK, QUOTE, TEXT, DELIVERY, PROJECT, TEXT_TYPE, WORK_TYPES, TRACK_ROLES, BINDINGS, TEXT_STATUS, POINT_KINDS, COVERAGE_STATES, LESSON_STATES, PROJECT_TYPES, PROJECT_STATUS]);

/** Die Bibliothek (2026-10-23): nur Quellen — in dieser Reihenfolge stehen ihre Reiter. */
export const LIBRARY_KINDS: readonly LibKind[] = [WORK, QUOTE, PERSON];

/** Das Skryptorium (2026-10-23): das Schreiben — Texte, Wygłoszenia, Projekte und die eigenen Rodzaje tekstów. */
export const WRITING_KINDS: readonly LibKind[] = [TEXT, DELIVERY, PROJECT, TEXT_TYPE];

/** Alle Arten, die diese Fassung kennt — gelesen, zitiert und gezeigt wird über die Teile hinweg. */
export const KINDS: readonly LibKind[] = [...WRITING_KINDS, ...LIBRARY_KINDS, ...LITURGY_KINDS];

export const isLibraryKind = (kind: string): boolean => LIBRARY_KINDS.some((k) => k.kind === kind);
export const isWritingKind = (kind: string): boolean => WRITING_KINDS.some((k) => k.kind === kind);

const BY_KIND = new Map(KINDS.map((one) => [one.kind, one]));

export const kindOf = (kind: string): LibKind | undefined => BY_KIND.get(kind);

/** Der Name eines Eintrags — gleich welcher Art. */
export function entryTitle(entry: LibEntry, look: Lookup): string {
  const def = kindOf(entry.kind);
  if (def !== undefined) return def.title(entry.data, look);
  /* 2026-10-22 (Schritt 11) — ein Eintrag einer Baza wiedzy (ein Słowo, ein Widok): sein Name aus den Daten. */
  for (const key of ['name', 'title', 'tekst', 'text', 'nazwa', 'word', 'slowo']) {
    const value = str(entry.data, key).trim();
    if (value !== '') return value.length > 80 ? `${value.slice(0, 79)}…` : value;
  }
  /* 2026-10-23 — eine Aussage (ein Rodzaj mit Feld `blocks`, z. B. ein Komentarz): ihre Teza. */
  const said = blocksTitle(statementBlocks(entry, look));
  if (said !== '') return said;
  return entry.kind;
}

export function entrySort(entry: LibEntry, look: Lookup): string {
  return (kindOf(entry.kind)?.sort(entry, look) ?? '').slice(0, 64);
}

/** Worauf ein Eintrag in seinen Feldern zeigt (Verweise in einem Text kommen aus `libraryMarkup`). */
export function fieldRefs(entry: LibEntry): string[] {
  if (entry.kind.startsWith('lit_')) return Array.isArray(entry.data._refs) ? entry.data._refs.filter((id): id is string => typeof id === 'string') : [];
  const def = kindOf(entry.kind);
  if (def === undefined) return [];
  const out: string[] = [];
  for (const field of def.fields) {
    if (field.type === 'ref' || field.type === 'refs') out.push(...ids(entry.data, field.key));
    if (field.type === 'outline') for (const item of outline(entry.data, field.key)) if ('text' in item) out.push(item.text);
    if (field.type === 'items') {
      for (const item of itemsOf(entry.data, field.key)) {
        for (const sub of field.item ?? []) if (sub.type === 'ref' || sub.type === 'refs') out.push(...ids(item, sub.key));
      }
    }
    if (field.type === 'blocks') out.push(...blockRefs(blocksOf(entry.data, field.key)).map((r) => r.ref));
  }
  return [...new Set(out)];
}

/**
 * 2026-10-21 — ALLES, WAS EIN EINTRAG IM ZAPIS TRÄGT: die Felder und die
 * Unterfelder (die Punkte eines Plans, „co doszło" eines Wygłoszenia). Wer
 * Quellen sucht — Rückverweise, Veröffentlichung, Bibliografie, LaTeX —,
 * liest hier, nicht Feld für Feld.
 */
export function markupsOf(entry: LibEntry): string[] {
  const def = kindOf(entry.kind);
  if (def === undefined) return [];
  const out: string[] = [];
  for (const field of def.fields) {
    if (field.type === 'markup') out.push(str(entry.data, field.key));
    if (field.type === 'blocks') out.push(...blockMarkups(blocksOf(entry.data, field.key)));
    if (field.type !== 'items') continue;
    for (const item of itemsOf(entry.data, field.key)) {
      for (const sub of field.item ?? []) if (sub.type === 'markup') out.push(str(item, sub.key));
    }
  }
  return out.filter((one) => one.trim() !== '');
}

/* -- 2026-10-22: Kennungen im Speicher, Schlüssel im Editor ----------------------------------- */

/**
 * Wohin ein Verweis im Zapis zeigt. Gespeichert steht eine Kennung (sie
 * ändert sich nie); getippt, im JSON und in alten Texten ein Schlüssel. Beide
 * gelten — die Kennung zuerst.
 */
export function refTarget(look: Lookup, token: string): LibEntry | undefined {
  return look.get(token) ?? look.byKey(token);
}

/**
 * 2026-10-22 — ZITIERT WIRD NUR, WAS VON AUSSEN KOMMT: ein Werk (auch ein
 * Lexikon: ein Werk mit dem Stichwort als Stelle), ein Zitat, eine Person —
 * das wird eine Fussnote. Die eigenen Einträge (Texte, Komentarze, Themen,
 * Projekte, Wygłoszenia, Einträge der Bazy wiedzy) werden verlinkt oder
 * eingebettet, nie zitiert. Ein Ziel, das dieser Leser nicht lesen kann,
 * bleibt eine Fussnote „[brak źródła]" (man sieht, dass da etwas ist — mehr nicht).
 */
export const SOURCE_KINDS: ReadonlySet<string> = new Set(['work', 'quote', 'person']);

export const isSource = (entry: LibEntry | undefined): boolean => entry === undefined || SOURCE_KINDS.has(entry.kind);

/** Wie ein eigener Eintrag im Text heisst (der Link). */
export const ownTitle = (entry: LibEntry, look: Lookup): string => look.title?.(entry) ?? entryTitle(entry, look);

/** Für den Speicher: ein Schlüssel, der aufgeht, wird seine Kennung; was nicht aufgeht, bleibt, wie es getippt ist. */
export const storedText = (text: string, look: Lookup): string =>
  mapRefTokens(text, (token) => (look.get(token) !== undefined ? token : (look.byKey(token)?.id ?? token)));

/**
 * Für den Editor, das JSON, die Polecenia: eine Kennung wird ihr Schlüssel —
 * aber nur, wenn dieser Schlüssel von hier aus wieder genau diesen Eintrag
 * findet (zwei Bibliotheken können denselben Schlüssel haben). Sonst bleibt
 * die Kennung stehen; der Text zeigt dann weiter genau dorthin.
 */
export const shownText = (text: string, look: Lookup): string =>
  mapRefTokens(text, (token) => {
    const entry = look.get(token);
    if (entry?.key === undefined) return token;
    return look.byKey(entry.key)?.id === entry.id ? entry.key : token;
  });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Jeder Zapis eines Eintrags durch `fn`: die Felder, die Unterfelder (die
 * Punkte eines Plans, „co doszło"), die Absätze und Textstücke eines
 * Komentarza. Was sich nicht ändert, bleibt dasselbe Objekt.
 */
export function mapMarkups(kind: string, data: EntryData, fn: (text: string) => string): EntryData {
  const def = kindOf(kind);
  if (def === undefined) return data;
  let out: EntryData | null = null;
  const set = (key: string, value: unknown) => { out ??= { ...data }; out[key] = value; };

  for (const field of def.fields) {
    const value = data[field.key];
    if (field.type === 'markup' && typeof value === 'string') {
      const next = fn(value);
      if (next !== value) set(field.key, next);
    } else if (field.type === 'items' && Array.isArray(value)) {
      const subs = (field.item ?? []).filter((sub) => sub.type === 'markup');
      if (subs.length === 0) continue;
      let changed = false;
      const items = value.map((raw) => {
        if (!isRecord(raw)) return raw;
        let item = raw;
        for (const sub of subs) {
          const text = item[sub.key];
          if (typeof text !== 'string') continue;
          const next = fn(text);
          if (next !== text) { item = { ...item, [sub.key]: next }; changed = true; }
        }
        return item;
      });
      if (changed) set(field.key, items);
    } else if (field.type === 'blocks' && Array.isArray(value)) {
      let changed = false;
      const run = (raw: unknown): unknown => {
        if (typeof raw === 'string') { const next = fn(raw); if (next !== raw) changed = true; return next; }
        if (isRecord(raw) && typeof raw.text === 'string') { const next = fn(raw.text); if (next !== raw.text) { changed = true; return { ...raw, text: next }; } }
        return raw;
      };
      const cell = (raw: unknown): unknown => (Array.isArray(raw) ? raw.map(run) : run(raw));
      const blocks = value.map((raw) => {
        if (!isRecord(raw)) return raw;
        if (typeof raw.text === 'string' && raw.type === 'paragraph') { const next = fn(raw.text); if (next !== raw.text) { changed = true; return { ...raw, text: next }; } return raw; }
        if (Array.isArray(raw.items)) return { ...raw, items: raw.items.map(cell) };
        if (Array.isArray(raw.rows)) return { ...raw, rows: raw.rows.map((row) => (Array.isArray(row) ? row.map(cell) : cell(row))) };
        return raw;
      });
      if (changed) set(field.key, blocks);
    }
  }
  return out ?? data;
}

/** Ein ganzer Eintrag für den Speicher (Kennungen) … */
export const storedMarkup = (kind: string, data: EntryData, look: Lookup): EntryData => mapMarkups(kind, data, (text) => storedText(text, look));

/** … und für den Editor und das JSON (Schlüssel, wo sie eindeutig sind). */
export const shownMarkup = (kind: string, data: EntryData, look: Lookup): EntryData => mapMarkups(kind, data, (text) => shownText(text, look));

/**
 * ALTE SCHLÜSSEL (2026-10-22): wer einen Schlüssel ändert, behält den alten als
 * zweiten (`_aliases` in den Daten). Ein Text, der noch den alten nennt (aus
 * einer JSON-Datei, aus der Zeit vor den Kennungen, aus einer Bibliothek, die
 * man nicht ändern darf), findet den Eintrag weiter.
 */
export const ALIASES = '_aliases';

export function aliasesOf(data: EntryData): string[] {
  const value = data[ALIASES];
  return Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string' && isKey(one)) : [];
}

/** Die alten Schlüssel nach einer Änderung: der bisherige kommt dazu, der neue nicht; jeder einmal, höchstens zehn. */
export function nextAliases(previousKey: string | undefined, nextKey: string | undefined, given: readonly string[]): string[] {
  const all = [...given, ...(previousKey !== undefined && previousKey !== nextKey ? [previousKey] : [])];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const one of all) {
    const low = one.toLowerCase();
    if ((nextKey !== undefined && low === nextKey.toLowerCase()) || seen.has(low)) continue;
    seen.add(low);
    out.push(one);
  }
  return out.slice(-10);
}

/** Wörter eines Textes — ohne Zeichen des Zapis, ohne Verweise. */
export function wordCount(text: string): number {
  const plain = text.replace(/\[\[([^\]|]*)\|@[^\]]*\]\]/g, ' $1 ').replace(/\[@[^\]]*\]/g, ' ').replace(/!\[@[^\]]*\]/g, ' ').replace(/[#>*_`[\]()^-]/g, ' ');
  const words = plain.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu);
  return words === null ? 0 : words.length;
}

/* -- Zitierschlüssel ------------------------------------------------------------------------- */

const firstWord = (text: string): string => slug(text).split('-').find((w) => w.length > 2) ?? slug(text).split('-')[0] ?? '';

/** Ein Vorschlag für den Schlüssel — noch nicht eindeutig gemacht. */
export function suggestKey(entry: LibEntry, look: Lookup): string {
  const data = entry.data;
  switch (entry.kind) {
    case 'person':
      return slug(str(data, 'surname') || personName(data)).slice(0, 40) || 'osoba';
    case 'work': {
      if (str(data, 'workType') === 'bible') return slug(str(data, 'siglum')) || 'biblia';
      /* 2026-10-26 — Musik nach dem Komponisten (ein Nagranie ohne ihn nach dem Titel). */
      const author = look.get(ids(data, isMusic(data) ? 'composers' : 'authors')[0] ?? '');
      const who = author === undefined ? firstWord(str(data, 'title')) : slug(str(author.data, 'surname') || personName(author.data)).split('-').pop() ?? '';
      const year = (str(data, 'year').match(/\d{4}/) ?? [''])[0];
      return `${who || 'zrodlo'}${year}`.slice(0, 40);
    }
    case 'quote': {
      const work = look.get(ids(data, 'work')[0] ?? '');
      return `${work?.key ?? 'cytat'}-1`;
    }
    case 'text':
      return slug(str(data, 'title')).slice(0, 40) || 'tekst';
    case 'project':
      return slug(str(data, 'title')).slice(0, 40) || 'projekt';
    default:
      return entry.kind;
  }
}

/** Den Vorschlag eindeutig machen: `ratzinger2007`, `ratzinger2007b`, …; bei Zitaten `…-1`, `…-2`. */
export function uniqueKey(wanted: string, taken: (key: string) => boolean): string {
  const base = wanted.replace(/[^a-z0-9_.:-]/gi, '').slice(0, 60) || 'wpis';
  if (!taken(base)) return base;
  const numbered = /^(.*-)(\d+)$/.exec(base);
  if (numbered !== null) {
    for (let n = Number(numbered[2]) + 1; n < 10000; n += 1) if (!taken(`${numbered[1]}${n}`)) return `${numbered[1]}${n}`;
  }
  for (let i = 1; i < 26; i += 1) {
    const next = `${base}${String.fromCharCode(97 + i)}`;
    if (!taken(next)) return next;
  }
  for (let n = 2; n < 100000; n += 1) if (!taken(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now()}`;
}

/** Ein Schlüssel, wie er in `[@…]` stehen darf. */
export const isKey = (key: string): boolean => /^[a-z0-9][a-z0-9_.:-]{0,59}$/i.test(key);

