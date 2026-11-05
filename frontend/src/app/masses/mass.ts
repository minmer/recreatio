/**
 * Messen und Intentionen — die Browserseite.
 *
 * <b>Eine Messe IST ein Kalendereintrag</b> mit `kind: 'mass'`. Angelegt wird
 * sie über `addItem` aus `calendar.ts`, wie eine Scholaprobe auch. Was hier
 * steht, ist das, was NUR die Messe hat: die Intention — und der Aushang, der
 * über alle Kalender geht.
 *
 * <b>Der Aushang ist öffentlich.</b> `/masses` braucht kein Konto: wer den
 * Messplan sucht, soll sich dafür nicht anmelden müssen, und wir sollen nicht
 * erfahren, dass er geschaut hat. Sichtbar ist, was unter einem Bereich mit
 * offengelegter Epoche liegt. Die Kanzleisicht (`/workspace/masses`) ist
 * dieselbe Liste mit dem, was nur drinnen gilt: Stand, Kennung, Zelebrant, und
 * die versiegelten Felder, wie sie liegen.
 *
 * <b>Ohne Kalender wird gesammelt.</b> Ein Mensch, der eine Messe sucht, sucht
 * eine Messe — nicht den Kalender, in dem sie geführt wird. Deshalb steht bei
 * jedem Vorkommen, aus welchem Kalender und welchem Bereich es stammt.
 *
 * <b>Die Intention hängt am VORKOMMEN, nicht an der Reihe.</b> „Werktags 18
 * Uhr" ist ein Eintrag; am Dienstag wird eine andere gelesen als am Mittwoch.
 * Die Adresse ist deshalb (itemId, occurrenceAt), und `occurrenceAt` ist der
 * ursprüngliche Beginn — so verliert eine einmal verschobene Messe ihre
 * Intentionen nicht.
 *
 * <b>Gerechnet wird am Dienst.</b> Welche Tage aus einer Reihe werden, steht in
 * `Calendar.Occurrences` und nicht hier: zwei Fassungen derselben Rechnung
 * ergeben irgendwann zwei Pläne, und der gedruckte wäre ein anderer als der
 * ausgehängte.
 */

import { fmtDate, isLang, t, texts, tIn, type Lang } from '../core/i18n';
import { call } from '../core/session';
import type { SealedField } from '../calendar/calendar';

export const MASS = 'mass';
export const CONFESSION = 'confession';

/** 0079 — das Nabożeństwo: Różaniec, Droga Krzyżowa … Im Plan wie die Beichte: ohne Intentionen. */
export const DEVOTION = 'devotion';

/** Was der Plan unter einem Gottesdienst versteht — und wie es heisst. */
export const SERVICE_KINDS = [MASS, CONFESSION, DEVOTION] as const;
export const SERVICE_LABEL: Readonly<Record<string, string>> = texts({ mass: 'masses.service.mass', confession: 'masses.service.confession', devotion: 'masses.service.devotion' });

/**
 * Was man als Namen eines Nabożeństwo meistens schreibt — vorgeschlagen, nicht
 * vorgeschrieben. Der Name hängt im Schaukasten, wie er hier steht.
 */
const DEVOTION_KEYS = [
  'rosary', 'wayOfCross', 'bitterLaments', 'may', 'june', 'october', 'adoration', 'chaplet', 'novena', 'holyHour', 'jasnaGora', 'vespers'
] as const;

export const devotionNames = (): readonly string[] => DEVOTION_KEYS.map((k) => t(`masses.devotionNames.${k}`));

/** Dieselben Vorschläge als Liste wie früher — beim Lesen in der Sprache der App neu gefüllt. */
export const DEVOTION_NAMES: readonly string[] = new Proxy([] as string[], {
  get: (target, prop, receiver) => {
    if (prop === 'length' || typeof prop === 'string') target.splice(0, target.length, ...devotionNames());
    return Reflect.get(target, prop, receiver);
  }
});

/**
 * Zwei Arten von Intentionen — und das ist keine Beschriftung.
 *
 * <b>single</b>: mehrere in einer Messe heissen, dass JEDER PRIESTER seine
 * eigene hat — zwei einzelne sind also zwei Konzelebranten.
 *
 * <b>collective</b>: ein Priester liest mehrere zusammen.
 *
 * Wer beide als „mehrere Intentionen" führt, kann die Frage „brauche ich noch
 * einen Priester" nicht mehr beantworten — und genau dafür gibt es die
 * Unterscheidung.
 */
export const INTENTION_KINDS = ['single', 'collective'] as const;
export type IntentionKind = (typeof INTENTION_KINDS)[number];

/** „1 intencja", „3 intencje", „5 intencji". */
export const intentionsWord = (n: number, lang?: unknown): string =>
  (isLang(lang) ? tIn(lang, 'masses.intentions', { count: n }) : t('masses.intentions', { count: n }));

export const KIND_LABEL: Readonly<Record<IntentionKind, string>> = texts({
  single: 'masses.kind.single',
  collective: 'masses.kind.collective'
});

/** Der Stand einer Intention — wie `ck_mass_intention_status`. */
export const INTENTION_STATUS_LABEL: Readonly<Record<string, string>> = texts({
  accepted: 'masses.status.accepted',
  celebrated: 'masses.status.celebrated',
  cancelled: 'masses.status.cancelled'
});

/**
 * Die Tage einer Woche als Bits.
 *
 * <b>Dieselben Werte wie `Zones.BitOf` am Dienst</b>, Montag zuerst. Liefen sie
 * auseinander, fielen die Messen auf andere Tage als eingetragen — und das
 * sähe man beim Anlegen nicht, sondern eine Woche später, in einer leeren
 * Kirche.
 */
const dayBit = (bit: number, name: string): { readonly bit: number; readonly label: string } =>
  ({ bit, get label() { return t(`masses.weekdayBit.${name}`); } });

export const WEEKDAY_BITS: readonly { readonly bit: number; readonly label: string }[] = [
  dayBit(1, 'mon'), dayBit(2, 'tue'), dayBit(4, 'wed'), dayBit(8, 'thu'), dayBit(16, 'fri'), dayBit(32, 'sat'), dayBit(64, 'sun')
];

export interface PublicIntention {
  readonly ordinal: number;
  readonly text: string;
  readonly kind: string;
}

export interface PublicMass {
  readonly itemId: string;

  /** `mass` oder `confession` — die ART, nicht der Titel. */
  readonly kind: string;

  /** Der ursprüngliche Beginn: die Adresse der Intentionen. */
  readonly occurrenceAt: string;

  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: string;
  readonly title: string | null;

  /** WO sie ist. Ohne das ist ein Sammelplan eine Liste von Uhrzeiten. */
  readonly calendarId: string;
  readonly calendarTitle: string;
  readonly areaName: string;
  readonly timeZone: string;

  /** 0079 — nur dieses Vorkommen abgesagt (dann `status: 'cancelled'`), oder verlegt. Ältere Dienste nennen es nicht. */
  readonly skipped?: boolean;
  readonly moved?: boolean;

  readonly intentions: readonly PublicIntention[];

  /**
   * 0132 — was das Schema der Messe offen sagt (Obchód, Kolor szat …): Beschriftung
   * und Wert im Klartext. Ältere Dienste nennen es nicht.
   */
  readonly values?: readonly { readonly field: string; readonly label: string; readonly value: string }[];
}

export interface Plan {
  readonly fromUtc: string;
  readonly toUtc: string;
  readonly masses: readonly PublicMass[];
}

/** Was nur in der Kanzlei gilt. */
export interface OfficeIntention extends PublicIntention {
  readonly intentionId: string;
  readonly status: string;
  readonly celebrantRoleId: string | null;

  /** Geber und Gabe — versiegelt, je Feld unter SEINEM Bereich. */
  readonly fields: readonly SealedField[];
}

export interface OfficeMass extends Omit<PublicMass, 'intentions'> {
  readonly intentions: readonly OfficeIntention[];

  /** 0079 — der Bereich des Kalenders, und wer feiert (Kto odprawia). */
  readonly areaId?: string | null;
  readonly people?: readonly { readonly roleId: string; readonly duty: string }[] | null;
}

export interface OfficePlan extends Omit<Plan, 'masses'> {
  readonly masses: readonly OfficeMass[];
}

/*
 * NICHT `window` nennen. Der Name verdeckt in dieser Datei den globalen — heute
 * folgenlos, weil hier nichts aus dem Fenster gelesen wird, und lautlos kaputt
 * an dem Tag, an dem jemand es tut.
 */
const askFor = (calendar?: string, from?: Date, to?: Date): string => {
  const query = new URLSearchParams();

  // Ohne Kalender wird über alle lesbaren gesammelt — das ist kein Fehlerfall,
  // sondern der Sammelplan.
  if (calendar !== undefined && calendar.trim() !== '') query.set('calendar', calendar.trim());

  if (from !== undefined) query.set('from', from.toISOString());
  if (to !== undefined) query.set('to', to.toISOString());
  return query.toString();
};

export const loadPlan = (calendar?: string, from?: Date, to?: Date): Promise<Plan> =>
  call<Plan>(`/masses?${askFor(calendar, from, to)}`);

/**
 * Der Plan der Kanzlei.
 *
 * <b>`kinds` fehlt meistens</b>, und dann bleibt es beim Gottesdienst — Messe
 * und Beichte. Wer Termine sucht (Firmung), sagt es ausdrücklich: sie stehen
 * in derselben Reihe von Vorkommen, haben aber nichts mit Intentionen zu tun
 * und gehören deshalb nicht ungefragt in dieselbe Liste.
 */
export const loadOffice = (
  calendar?: string, from?: Date, to?: Date, kinds?: readonly string[]
): Promise<OfficePlan> =>
  call<OfficePlan>(`/workspace/masses?${askFor(calendar, from, to)}`
    + (kinds === undefined ? '' : `&kinds=${encodeURIComponent(kinds.join(','))}`));

export const addIntention = (
  itemId: string,
  occurrenceAt: string,
  body: {
    text: string;
    kind: IntentionKind;
    ordinal?: number;
    /** Geber und Gabe, schon versiegelt. */
    fields?: readonly SealedField[];
  }
): Promise<{ intentionId: string; ordinal: number; fields: number }> =>
  call(
    `/workspace/mass/${encodeURIComponent(itemId)}/intention`,
    { method: 'POST', body: JSON.stringify({ occurrenceAt, ...body }) }
  );

export const updateIntention = (
  intentionId: string,
  body: {
    text?: string;
    status?: string;
    ordinal?: number;
    kind?: IntentionKind;
    /** Leer (`''`): niemand mehr. */
    celebrantRoleId?: string;
    fields?: readonly SealedField[];
    /** 0079 — an eine andere Messe verlegen. */
    itemId?: string;
    occurrenceAt?: string;
  }
): Promise<{ intentionId: string; updated: boolean }> =>
  call(
    `/workspace/intention/${encodeURIComponent(intentionId)}`,
    { method: 'POST', body: JSON.stringify(body) }
  );

/** 0079 — eine Intention löschen (ein Tippfehler, doppelt eingetragen). Eine odprawiona nicht. */
export const deleteIntention = (intentionId: string): Promise<{ intentionId: string; deleted: boolean }> =>
  call(`/workspace/intention/${encodeURIComponent(intentionId)}/delete`, { method: 'POST' });

/* -- Messe oder Beichte ---------------------------------------------------- */

/**
 * Die Beichte ist dasselbe Gebilde wie die Messe — wiederkehrend, öffentlich,
 * in der Kirche — mit einem Unterschied: sie hat KEINE Intentionen. Nicht
 * „meistens nicht", sondern gar nicht, weil es nichts vorzulesen gibt.
 *
 * Unterschieden wird deshalb an der Art und nicht am Titel: ein Titel ist Text,
 * den jemand morgen anders schreibt, und dann stünde die Beichte im Aushang
 * zwischen den Messen.
 */
/*
 * Durchlaessig fuer die Art: die Kanzlei reicht `OfficeMass` herein und bekommt
 * `OfficeMass` zurueck, der Aushang `PublicMass`. Ohne das muesste eine der
 * beiden Seiten das Ergebnis zurueckcasten — und ein Cast ist genau die Stelle,
 * an der die Regel „was ist eine Messe" ein zweites Mal getippt wird.
 */
/*
 * 0079 — EINE MESSE IST `mass`, nicht „alles ausser der Beichte". Mit dem
 * Nabożeństwo gibt es eine dritte Art; die alte Regel hätte den Rosenkranz zu
 * einer Messe gemacht — mit Intentionen, im Bogen, bei „następna msza".
 */
export const isMass = (m: { readonly kind: string }): boolean => m.kind === MASS;

export const massesOnly = <T extends PublicMass>(masses: readonly T[]): readonly T[] =>
  masses.filter(isMass);

/** Beichte und Nabożeństwa — was neben den Messen im Plan steht. */
export const othersOnly = <T extends PublicMass>(masses: readonly T[]): readonly T[] =>
  masses.filter((m) => !isMass(m));

/* -- Stunde und Tag -------------------------------------------------------- */

/**
 * Die Uhrzeit, wie sie im Messplan steht.
 *
 * Ohne Sekunden und ohne führende Null: „7:00", nicht „07:00:00". So schreibt
 * man den Plan auf den Zettel, und so liest man ihn.
 */
export function hour(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** Der Tag als Schlüssel — zum Gruppieren unter einem Datum. */
export function dayKey(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
    + `-${String(at.getDate()).padStart(2, '0')}`;
}

/** Heute, morgen — oder keins von beiden. */
function nearDay(iso: string, today: Date): 'today' | 'tomorrow' | null {
  if (dayKey(iso) === dayKey(today.toISOString())) return 'today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dayKey(iso) === dayKey(tomorrow.toISOString()) ? 'tomorrow' : null;
}

/** „wtorek, 8 września" — Wochentag und Monat aus `Intl` (im Polnischen schon im Genitiv). */
const longDay = (at: Date, lang?: Lang): string => fmtDate(at, { weekday: 'long', day: 'numeric', month: 'long' }, lang);

/**
 * Die Überschrift eines Tages: „wtorek, 8 września".
 *
 * Ohne Jahr — der Messplan zeigt die nächsten Tage, und ein Jahr an jedem Datum
 * ist Rauschen. Bei heute und morgen weicht der Wochentag dem Wort, das man
 * sucht.
 */
export function dayLabel(iso: string, today: Date = new Date(), lang?: Lang): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const near = nearDay(iso, today);
  if (near !== null) return lang === undefined ? t(`masses.day.${near}`) : tIn(lang, `masses.day.${near}`);

  return longDay(at, lang);
}

/**
 * Kurz, für eine Zeile Uhrzeiten: „dziś", „jutro", „śr. 1.10". In eine
 * schmale Kachel passt „środa, 1 października" nicht neben drei Uhrzeiten.
 */
export function shortDayLabel(iso: string, today: Date = new Date(), lang?: Lang): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime()) || nearDay(iso, today) !== null) return dayLabel(iso, today, lang);
  return `${fmtDate(at, { weekday: 'short' }, lang)} ${fmtDate(at, { day: 'numeric', month: 'numeric' }, lang)}`;
}

/**
 * Mit Wochentag und Datum auch bei heute und morgen: „dziś, wtorek, 29
 * września". Über einer ganzen Tagesspalte ist Platz dafür, und wer am
 * Aushang eine Intention sucht, sucht sie nach dem Datum.
 */
export function fullDayLabel(iso: string, today: Date = new Date(), lang?: Lang): string {
  const at = new Date(iso);
  const near = Number.isNaN(at.getTime()) ? null : nearDay(iso, today);
  if (near === null) return dayLabel(iso, today, lang);
  const params = { date: longDay(at, lang) };
  return lang === undefined ? t(`masses.day.${near}Full`, params) : tIn(lang, `masses.day.${near}Full`, params);
}

/** Die Messen nach Tagen gruppiert, in der Reihenfolge, in der sie kommen. */
export function byDay(
  masses: readonly PublicMass[]
): readonly { readonly day: string; readonly masses: readonly PublicMass[] }[] {
  const days = new Map<string, PublicMass[]>();

  for (const mass of masses) {
    const key = dayKey(mass.startsAt);
    if (key === '') continue;

    const found = days.get(key);
    if (found === undefined) days.set(key, [mass]);
    else found.push(mass);
  }

  return [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, list]) => ({ day, masses: list }));
}

/**
 * Die erste Messe dieses Tages oder eines der folgenden.
 *
 * <b>Warum „oder der folgenden".</b> Die Kanzlei tippt die Intentionen von
 * einem Zettel der Reihe nach ab — und der Zettel endet nicht mit dem Tag. Nach
 * der letzten Messe des Dienstags soll die erste des Mittwochs kommen. An der
 * Tagesgrenze stehenzubleiben hiesse: greif zur Maus und stell das Datum um.
 *
 * Gibt `-1`, wenn im ganzen Fenster nichts mehr kommt. Das ist kein Fehler,
 * sondern das Ende.
 */
export function firstOnOrAfter(masses: readonly PublicMass[], day: string): number {
  for (let i = 0; i < masses.length; i += 1) {
    if (dayKey(masses[i].startsAt) >= day) return i;
  }
  return -1;
}

/**
 * Die wievielte Messe an ihrem Tag — „2 z 7".
 *
 * Innerhalb des TAGES gezählt, nicht des Fensters. „14 z 96" sagt niemandem
 * etwas; „2 z 7" sagt, wie viel bis zum Ende des Tages noch abzutippen ist.
 */
export function positionInDay(
  masses: readonly PublicMass[], index: number
): { readonly at: number; readonly of: number } {
  if (index < 0 || index >= masses.length) return { at: 0, of: 0 };

  const day = dayKey(masses[index].startsAt);
  const sameDay = masses.filter((m) => dayKey(m.startsAt) === day);
  const before = masses.slice(0, index).filter((m) => dayKey(m.startsAt) === day);

  return { at: before.length + 1, of: sameDay.length };
}
