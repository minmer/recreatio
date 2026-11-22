/**
 * COGITA — DIE EINE LOGIK (COGITA.md §4, [G6]).
 *
 * <b>Eine Maschine für Formulare, Seiten, Abläufe, Gestalten, Aufgaben und
 * Spiele.</b> Was sie kann, steht hier einmal: die Tore (I, LUB, NIE, ALBO),
 * der Vergleich zweier Werte (als Zahl, wo beide Zahlen sind, sonst als Text),
 * und wann ein Wert als „ja" gilt. Die Logik eines Formulars (0043) und die
 * Karte einer Seite (0048) rechnen damit; die Abläufe, Gestalten und Spiele
 * von Cogita auch — mit ihren eigenen Eingängen:
 *
 * <code>
 *   wartość     ein Wert des Lernenden (Punkte, Nähe einer Gestalt) [H4, H7]
 *   znajomość   wie gut eine Karte, ein Eintrag, ein Thema sitzt
 *   odpowiedź   ob eine Frage (richtig) beantwortet wurde
 *   odwiedzone  ob ein Schritt schon gesehen wurde
 *   czas        vor / nach einem Datum, zwischen zwei Uhrzeiten
 *   miejsce     in einer Zone (Spiel) oder nahe einem Punkt
 * </code>
 *
 * Und Aktionen: einen Wert setzen oder ändern, zu einem Schritt gehen.
 *
 * <b>Synchron</b>, anders als die Graphen der Karten: eine Bedingung
 * entscheidet, was JETZT zu sehen ist, und wartet auf nichts.
 */

import { levelOfKnowness } from './knowness';
import { readMode, type PlayMode } from './modeWords';
import { t, texts } from '../core/i18n';

/* -- Werte, Vergleich, Tore — für alle ------------------------------------------- */

export type Value = string | boolean;

export const COMPARE_OPS = ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'contains', 'filled', 'empty'] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const COMPARE_LABEL: Readonly<Record<CompareOp, string>> = texts({
  eq: 'cogitaData.logic.compare.eq', ne: 'cogitaData.logic.compare.ne', gt: 'cogitaData.logic.compare.gt', ge: 'cogitaData.logic.compare.ge',
  lt: 'cogitaData.logic.compare.lt', le: 'cogitaData.logic.compare.le',
  contains: 'cogitaData.logic.compare.contains', filled: 'cogitaData.logic.compare.filled', empty: 'cogitaData.logic.compare.empty'
});

/** Die Vergleiche, die nur EINEN Eingang brauchen. */
export const UNARY: readonly CompareOp[] = ['filled', 'empty'];

/**
 * Wann ein Wert als „ja" gilt: nicht leer — und nicht eines der Wörter, mit
 * denen ein Mensch „nein" sagt. Eine Frage „Tak / nie" hängt sich direkt an
 * ein UND, ohne Vergleich dazwischen.
 */
export function truthy(v: Value): boolean {
  if (typeof v === 'boolean') return v;
  const t = v.trim().toLocaleLowerCase('pl');
  return t !== '' && !['nie', 'false', '0', 'no', 'n'].includes(t);
}

const asText = (v: Value): string => (typeof v === 'boolean' ? (v ? 'tak' : 'nie') : v);

/** Eine Zahl — mit Komma oder Punkt —, sonst `null`. */
export function asNumber(v: Value): number | null {
  const t = asText(v).trim().replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Zwei Werte vergleichen — als Zahlen, wenn beide welche sind, sonst als Text.
 * Ein Datum (`2011-04-02`) vergleicht sich als Text richtig; „10" und „9" nur
 * als Zahl. Grösser/kleiner mit einer leeren Seite ist nie wahr.
 */
export function compare(op: CompareOp, a: Value, b: Value): boolean {
  const x = asText(a).trim();
  const y = asText(b).trim();

  if (op === 'filled') return x !== '';
  if (op === 'empty') return x === '';
  if (op === 'contains') return y !== '' && x.toLocaleLowerCase('pl').includes(y.toLocaleLowerCase('pl'));

  const nx = asNumber(x);
  const ny = asNumber(y);

  if (op === 'eq' || op === 'ne') {
    const same = nx !== null && ny !== null ? nx === ny : x.toLocaleLowerCase('pl') === y.toLocaleLowerCase('pl');
    return op === 'eq' ? same : !same;
  }

  if (x === '' || y === '') return false;

  const order = nx !== null && ny !== null ? Math.sign(nx - ny) : Math.sign(x.localeCompare(y, 'pl', { numeric: true }));
  switch (op) {
    case 'gt': return order > 0;
    case 'ge': return order >= 0;
    case 'lt': return order < 0;
    default: return order <= 0;
  }
}

export type GateKind = 'and' | 'or' | 'not' | 'xor';

/** Ein Tor: I braucht mindestens einen Eingang und alle wahr; NIE nimmt den ersten. */
export function gate(kind: GateKind, inputs: readonly Value[]): boolean {
  switch (kind) {
    case 'and': return inputs.length > 0 && inputs.every(truthy);
    case 'or': return inputs.some(truthy);
    case 'xor': return inputs.filter(truthy).length % 2 === 1;
    case 'not': return !truthy(inputs[0] ?? false);
  }
}

/* -- Die Bedingungen von Cogita -------------------------------------------------------- */

/** Was über den Lernenden gerade bekannt ist. */
export interface Facts {
  /** Die Werte des Kurses (Gestalten, Punkte). */
  readonly values: Readonly<Record<string, number>>;
  /** Wie gut etwas sitzt — eine Karte (ihr Schlüssel), ein Eintrag, ein Thema; 0, solange nie gefragt. */
  readonly knowness: (id: string) => number;
  /** Ob eine Frage beantwortet wurde — und wie richtig (0–1); `null`: nie. */
  readonly answered: (id: string) => number | null;
  /** 2026-11-10 — wann zuletzt beantwortet (ms); `null`/fehlt: nie bekannt. Für „in den letzten N Tagen" (`within`). */
  readonly answeredAt?: (id: string) => number | null;
  readonly visited: ReadonlySet<string>;
  readonly now: Date;
  /** Wo er ist (im Spiel) — `null`: unbekannt. */
  readonly place?: { readonly lat: number; readonly lon: number } | null;
  /** In welchen Zonen er steht (sagt der Dienst im Spiel). */
  readonly zones?: ReadonlySet<string>;
  /**
   * 2026-11-03 (G) — WO ER IN EINER ERZÄHLUNG STEHT (ein Ablauf der Baza; eine Präsentation über ihren Ablauf): begonnen,
   * zu Ende, welche Ziele erreicht. Fehlt es: nichts begonnen.
   */
  readonly flow?: (id: string) => FlowFacts | undefined;
  /**
   * 2026-10-30 — WESSEN Kenntnis eine Bedingung mit `rel` prüft, gesehen von dem, was gerade geprüft wird (ein Eintrag
   * in einem Widok, eine Karte in einer Powtórka, `knowing.ts`): die Kennungen (Einträge; Karten mit „#"). Fehlt es,
   * ist die Menge leer.
   */
  readonly related?: (rel: string) => readonly string[];
  /**
   * 2026-11-20 (adaptive Abläufe) — DIE ANTWORTEN DIESES LAUFS (`adaptive.ts`): wie viele falsch/richtig/teilweise seit einem
   * Schritt, dem Anfang der Erzählung oder dem Anfang des Laufs, die letzte Antwort, die Serie am Ende. Fehlt es (ausserhalb des
   * Spielers): keine Antworten.
   */
  readonly session?: SessionFacts;
  /**
   * 2026-11-22 (I4) — WIE GERADE GESPIELT WIRD: allein (`self`, Vorgabe) oder in einer Stunde (`lesson`) — die Bedingung „mode"
   * und was die Schritte mit "use" spielen (`modes.ts`).
   */
  readonly mode?: PlayMode;
}

/** 2026-11-20 — eine Antwort in einem Lauf eines Ablaufs (nur im Spieler, nie gespeichert). */
export interface SessionAnswer {
  readonly flow: string;
  readonly step: string;
  /** 0–1, Podpowiedzi und Teilrichtigkeit eingerechnet. */
  readonly score: number;
  readonly correct: boolean;
  readonly partial: boolean;
  readonly tags: readonly string[];
  readonly hints: number;
  readonly ms: number;
  /** Der wievielte Versuch derselben Frage (0: der erste). */
  readonly attempt: number;
}

export interface SessionFacts {
  readonly log: readonly SessionAnswer[];
  /** Ab welcher Stelle des Logs gezählt wird: "flowStart" (die laufende Erzählung) oder ein Schritt ("unit": 0). */
  readonly from: (since: string) => number;
}

/** 2026-11-20 — was „session" zählt und „lastAnswer" vergleicht. */
export const SESSION_MEASURES = ['wrong', 'right', 'partial', 'hintsUsed'] as const;
export type SessionMeasure = (typeof SESSION_MEASURES)[number];
export const LAST_MEASURES = ['hintsUsed', 'timeMs'] as const;
export type LastMeasure = (typeof LAST_MEASURES)[number];

/**
 * 2026-10-30 — DIE BEZIEHUNGEN einer Bedingung „Znajomość" in Widoki und Powtórki (`rel`): der Eintrag selbst, seine
 * Karten, was vorher zu können ist, worunter er in der Struktur liegt — oder (jeder andere Wert) der Schlüssel eines
 * Verweisfeldes: worauf es zeigt.
 */
export const RELATIONS = ['self', 'cards', 'before', 'up', 'chain', 'core'] as const;
export type Relation = (typeof RELATIONS)[number];

export const RELATION_LABEL: Readonly<Record<Relation, string>> = texts({
  self: 'cogitaData.logic.relation.self',
  cards: 'cogitaData.logic.relation.cards',
  before: 'cogitaData.logic.relation.before',
  up: 'cogitaData.logic.relation.up',
  /*
   * 2026-11-03 — DIE GANZE KETTE DAVOR (Krajobraz, `knowing.ts`): die schon beantworteten Karten aller Einträge, die
   * (über Stufen, auch durch Einträge ohne Karten und durch Kreise) vorher zu können sind. Nie gefragte zählen nicht.
   * „Każda znana" — die Sperre des Krajobraz: erst wiederholen, was in der Kette verblasst oder falsch war.
   */
  chain: 'cogitaData.logic.relation.chain',
  /* 2026-11-05 (Prompt 23, C3) — die Kernfragen (`"core": true`) des Themas (bei einer Karte: der Themen ihres „O czym"). */
  core: 'cogitaData.logic.relation.core'
});

/** Eine Beziehung in Worten — `field`: der Name eines Feldes. */
export function relationText(rel: string, each: 'all' | 'any' | undefined, field: (key: string) => string = (key) => key): string {
  const how = each === 'any' ? 'any' : 'all';
  switch (rel) {
    case 'self': return t('cogitaData.logic.of.self');
    case 'cards':
    case 'before':
    case 'up':
    case 'chain':
    case 'core': return t(`cogitaData.logic.of.${rel}.${how}`);
    default: return t(`cogitaData.logic.of.field.${how}`, { field: field(rel) });
  }
}

/**
 * 2026-11-01 — DIE BÄNDER DER KENNTNIS in einer Bedingung, statt einer Zahl (`knowness.ts` legt sie fest): `learned`
 * „poznane" — gewusst, ob gerade zu wiederholen oder nicht (der Termin einer Wiederholung heisst NICHT „unbekannt");
 * `known` „znane" — ab 1; `due` „do powtórki"; `unknown` „nieznane" — nie gefragt, zuletzt falsch, vergessen.
 */
export const KNOWNESS_BANDS = ['learned', 'known', 'due', 'unknown'] as const;
export type KnownessBand = (typeof KNOWNESS_BANDS)[number];

export const KNOWNESS_BAND_LABEL: Readonly<Record<KnownessBand, string>> = texts({
  learned: 'cogitaData.logic.band.learned',
  known: 'cogitaData.logic.band.known',
  due: 'cogitaData.logic.band.due',
  unknown: 'cogitaData.logic.band.unknown'
});

/** Liegt eine Kenntnis in dem Band? */
export function inBand(knowness: number, band: KnownessBand): boolean {
  const level = levelOfKnowness(knowness);
  switch (band) {
    case 'learned': return level !== 'unseen';
    case 'known': return level === 'known';
    case 'due': return level === 'learning';
    default: return level === 'unseen';
  }
}

export const NO_FACTS: Facts = {
  values: {}, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date(0)
};

export const CONDITION_TYPES = ['value', 'knowness', 'answered', 'visited', 'flow', 'session', 'lastAnswer', 'streak', 'mode', 'time', 'place', 'zone', 'and', 'or', 'not', 'xor'] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export const CONDITION_LABEL: Readonly<Record<ConditionType, string>> = texts({
  value: 'cogitaData.logic.condition.value', knowness: 'cogitaData.logic.condition.knowness', answered: 'cogitaData.logic.condition.answered',
  visited: 'cogitaData.logic.condition.visited', flow: 'cogitaData.logic.condition.flow',
  session: 'cogitaData.logic.condition.session', lastAnswer: 'cogitaData.logic.condition.lastAnswer', streak: 'cogitaData.logic.condition.streak', mode: 'cogitaData.logic.condition.mode', time: 'cogitaData.logic.condition.time',
  place: 'cogitaData.logic.condition.place', zone: 'cogitaData.logic.condition.zone', and: 'cogitaData.logic.condition.and',
  or: 'cogitaData.logic.condition.or', not: 'cogitaData.logic.condition.not', xor: 'cogitaData.logic.condition.xor'
});

/** 2026-11-03 (G) — was über eine Erzählung bekannt ist: begonnen, zu Ende (ein Ende erreicht), welche Ziele erreicht. */
export interface FlowFacts {
  readonly started: boolean;
  readonly done: boolean;
  readonly goals: readonly string[];
}

/** 2026-11-03 (G) — was eine Bedingung „Przebieg" prüft: begonnen, zu Ende, ein Ziel (ohne `goal`: irgendeins) erreicht. */
export const FLOW_CHECKS = ['started', 'done', 'goal'] as const;
export type FlowCheck = (typeof FLOW_CHECKS)[number];
export const FLOW_CHECK_LABEL: Readonly<Record<FlowCheck, string>> = texts({ started: 'cogitaData.logic.flowCheck.started', done: 'cogitaData.logic.flowCheck.done', goal: 'cogitaData.logic.flowCheck.goal' });

/**
 * EINE BEDINGUNG als kleiner Baum — so steht sie in einem Ablauf, an einer
 * Zeile einer Gestalt, an einem Auslöser:
 *
 * <code>
 *   { "type": "value", "value": "zaufanie", "op": "ge", "than": 3 }
 *   { "type": "knowness", "of": "<id>", "op": "ge", "than": 1 }
 *   { "type": "knowness", "rel": "before", "op": "ge", "than": 1 }      (2026-10-30) relativ: self · cards · before · up · chain · <pole>
 *   { "type": "knowness", "rel": "chain", "band": "known" }             (2026-11-03) jede schon gefragte Karte der ganzen Kette davor sitzt
 *   { "type": "knowness", "rel": "okres", "each": "any", "than": 1 }    — mehrere: alle (Vorgabe) oder einer genügt
 *   { "type": "knowness", "rel": "before", "band": "learned" }          (2026-11-01) ein Band statt einer Zahl
 *   { "type": "answered", "of": "<pytanie>", "correct": true }
 *   { "type": "answered", "of": "<pytanie>", "correct": true, "within": 7 }   (2026-11-10) … und zuletzt in den letzten 7 Tagen
 *   { "type": "visited", "of": "<krok>" }
 *   { "type": "flow", "flow": "<przebieg>", "state": "done" }          (2026-11-03) started · done · goal (mit "goal": ein bestimmtes)
 *   { "type": "time", "after": "2026-12-24", "before": "2026-12-27", "from": "18:00", "to": "23:00" }
 *   { "type": "place", "lat": 50.06, "lon": 19.94, "radius": 100 }
 *   { "type": "zone", "of": "<strefa>" }
 *   { "type": "session", "since": "q1" | "flowStart" | "unit", "wrong": { "op": "ge", "than": 3 } }   (2026-11-20) right · partial · hintsUsed
 *   { "type": "lastAnswer", "correct": false } · "partial": true · "tag": "<tag>" · "hintsUsed"/"timeMs": { "op", "than" }
 *   { "type": "streak", "right": 3 } · { "wrong": 2 }                  die letzten N Antworten des Laufs alle richtig / alle falsch
 *   { "type": "mode", "is": "lesson" }                                 (2026-11-22) gespielt in einer Stunde · "self": allein (`modes.ts`)
 *   { "type": "and", "items": [ … ] }   or · xor · not (ein Element)
 * </code>
 */
export interface Condition {
  readonly type: ConditionType;
  readonly value?: string;
  readonly of?: string;
  readonly op?: CompareOp;
  readonly than?: number;
  readonly correct?: boolean;
  /** 2026-11-10 — bei „answered": nur, wenn die letzte Antwort höchstens so viele Tage her ist. */
  readonly within?: number;
  readonly after?: string;
  readonly before?: string;
  readonly from?: string;
  readonly to?: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly radius?: number;
  readonly items?: readonly Condition[];
  /** 2026-10-30 — relativ zu dem, was geprüft wird (`RELATIONS` oder ein Feld); statt `of`. */
  readonly rel?: string;
  /** Bei mehreren: alle müssen (Vorgabe) — oder einer genügt; über einer leeren Menge gilt „alle", „einer" nicht. */
  readonly each?: 'all' | 'any';
  /** 2026-11-01 — „Znajomość" als Band (`KNOWNESS_BANDS`) statt `op`/`than`. */
  readonly band?: KnownessBand;
  /** 2026-11-03 (G) — „Przebieg": welcher (ein Ablauf der Baza), was gelten soll, und welches Ziel (bei `goal`). */
  readonly flow?: string;
  readonly state?: FlowCheck;
  readonly goal?: string;
  /** 2026-11-20 — „session": ab wo gezählt wird (Vorgabe "unit"); „session"/„lastAnswer"/„streak": was gezählt oder verglichen wird. */
  readonly since?: string;
  readonly measure?: SessionMeasure | LastMeasure;
  /** 2026-11-20 — „lastAnswer": teilweise richtig; ein Fehler-Tag der letzten Antwort. */
  readonly partial?: boolean;
  readonly tag?: string;
  /** 2026-11-22 — „mode": in welchem Modus sie gilt. */
  readonly is?: PlayMode;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : undefined);

/** Duldsam gelesen: Unbekanntes fällt weg, ein Tor ohne gültige Teile bleibt leer (und ist dann für I falsch). */
export function readCondition(raw: unknown, depth = 0): Condition | null {
  if (!isObject(raw) || depth > 12) return null;
  const type = (CONDITION_TYPES as readonly string[]).includes(String(raw.type)) ? (raw.type as ConditionType) : null;
  if (type === null) return null;
  if (type === 'and' || type === 'or' || type === 'not' || type === 'xor') {
    const items = (Array.isArray(raw.items) ? raw.items : []).map((one) => readCondition(one, depth + 1)).filter((c): c is Condition => c !== null);
    return { type, items: type === 'not' ? items.slice(0, 1) : items };
  }
  /* 2026-11-03 (G) — eine Erzählung: begonnen, zu Ende, ein Ziel erreicht ("of" geht auch statt "flow"). */
  if (type === 'flow') {
    const flow = str(raw.flow) ?? str(raw.of);
    const state = (FLOW_CHECKS as readonly string[]).includes(String(raw.state)) ? (raw.state as FlowCheck) : 'done';
    return { type, ...(flow === undefined ? {} : { flow }), state, ...(state === 'goal' && str(raw.goal) !== undefined ? { goal: str(raw.goal) } : {}) };
  }
  const op = (COMPARE_OPS as readonly string[]).includes(String(raw.op)) ? (raw.op as CompareOp) : undefined;
  /* 2026-11-22 (I4) — der Modus: "is" lesson oder self (auch „lekcja", „samodzielnie" …); fehlt es: lesson (so legt der Editor sie an), ein unbekanntes: keine Bedingung (der Import warnt). */
  if (type === 'mode') {
    if (raw.is === undefined) return { type, is: 'lesson' };
    const is = readMode(raw.is);
    return is === null ? null : { type, is };
  }
  /* 2026-11-20 — die Bedingungen des Laufs: „wrong": {"op","than"} (oder eine Zahl: ≥) — gelesen auch in der Form des Editors ("measure"). */
  if (type === 'session' || type === 'lastAnswer' || type === 'streak') return readSessionCondition(type, raw, op);
  /*
   * 2026-11-01 — „TO, CO WCZEŚNIEJ / TO, POD CZYM LEŻY ≥ 1" (so legten es die Vorlagen der Powtórki und Widoki an) heisst
   * jetzt „poznane": was vorher kommt, muss gewusst sein — nicht gerade nicht fällig. Sonst verschwand alles Spätere,
   * sobald das Frühere an der Reihe war, wiederholt zu werden. Wer wirklich „ab 1" will, wählt das Band „znane".
   */
  if (type === 'knowness' && (raw.rel === 'before' || raw.rel === 'up') && raw.band === undefined && (op === undefined || op === 'ge') && num(raw.than) === 1) {
    return { type, rel: raw.rel, band: 'learned', ...(raw.each === 'any' ? { each: 'any' as const } : {}) };
  }
  return {
    type,
    ...(str(raw.value) === undefined ? {} : { value: str(raw.value) }),
    ...(str(raw.of) === undefined ? {} : { of: str(raw.of) }),
    ...(op === undefined ? {} : { op }),
    ...(num(raw.than) === undefined ? {} : { than: num(raw.than) }),
    ...(typeof raw.correct === 'boolean' ? { correct: raw.correct } : {}),
    ...(type === 'answered' && num(raw.within) !== undefined && num(raw.within)! > 0 ? { within: Math.min(3650, num(raw.within)!) } : {}),
    ...(str(raw.after) === undefined ? {} : { after: str(raw.after) }),
    ...(str(raw.before) === undefined ? {} : { before: str(raw.before) }),
    ...(str(raw.from) === undefined ? {} : { from: str(raw.from) }),
    ...(str(raw.to) === undefined ? {} : { to: str(raw.to) }),
    ...(num(raw.lat) === undefined ? {} : { lat: num(raw.lat) }),
    ...(num(raw.lon) === undefined ? {} : { lon: num(raw.lon) }),
    ...(num(raw.radius) === undefined ? {} : { radius: num(raw.radius) }),
    ...(type === 'knowness' && str(raw.rel) !== undefined ? { rel: str(raw.rel)!.slice(0, 80) } : {}),
    ...(type === 'knowness' && (raw.each === 'any' || raw.each === 'all') ? { each: raw.each } : {}),
    ...(type === 'knowness' && (KNOWNESS_BANDS as readonly string[]).includes(String(raw.band)) ? { band: raw.band as KnownessBand } : {})
  };
}

function readSessionCondition(type: 'session' | 'lastAnswer' | 'streak', raw: Record<string, unknown>, op: CompareOp | undefined): Condition {
  const keys: readonly string[] = type === 'session' ? SESSION_MEASURES : type === 'streak' ? ['right', 'wrong'] : LAST_MEASURES;
  let measure = keys.includes(String(raw.measure)) ? String(raw.measure) : undefined;
  let cmp = op;
  let than = num(raw.than);
  for (const k of keys) {
    if (measure !== undefined && measure !== k) continue;
    const v = raw[k];
    if (isObject(v)) { measure = k; cmp = (COMPARE_OPS as readonly string[]).includes(String(v.op)) ? (v.op as CompareOp) : cmp; than = num(v.than) ?? than; break; }
    if (num(v) !== undefined) { measure = k; than = num(v); break; }
  }
  if (type === 'lastAnswer') {
    return {
      type,
      ...(typeof raw.correct === 'boolean' ? { correct: raw.correct } : {}),
      ...(typeof raw.partial === 'boolean' ? { partial: raw.partial } : {}),
      ...(str(raw.tag) === undefined ? {} : { tag: str(raw.tag)!.slice(0, 80) }),
      ...(measure === undefined ? {} : { measure: measure as LastMeasure, op: cmp ?? 'ge', than: than ?? 1 })
    };
  }
  const since = type === 'session' ? str(raw.since) : undefined;
  return {
    type, measure: (measure ?? (type === 'streak' ? 'right' : 'wrong')) as SessionMeasure,
    ...(type === 'session' ? { op: cmp ?? 'ge' } : {}), than: Math.max(0, than ?? 1),
    ...(since === undefined ? {} : { since: since.slice(0, 120) })
  };
}

/**
 * 2026-11-20 — schaut die Bedingung (irgendwo in ihr) auf die Antworten des Laufs? Dann entscheidet sie sich erst unterwegs.
 * 2026-11-22 — auch der Modus (allein / Stunde) gehört dem Lauf: so eine Bedingung ist nie eine Fahrkarte und kein Tor.
 */
export function usesSession(c: Condition | null): boolean {
  if (c === null) return false;
  if (c.type === 'session' || c.type === 'lastAnswer' || c.type === 'streak' || c.type === 'mode') return true;
  return (c.items ?? []).some(usesSession);
}

/** 2026-11-20 — was eine Bedingung des Laufs über die Antworten sagt (`facts.session`). */
function holdsSession(c: Condition, facts: Facts): boolean {
  const s = facts.session;
  const log = s?.log ?? [];
  if (c.type === 'session') {
    const from = s === undefined || c.since === undefined || c.since === 'unit' ? 0 : s.from(c.since);
    const part = log.slice(Math.max(0, from));
    const m = c.measure ?? 'wrong';
    const n = m === 'hintsUsed' ? part.reduce((sum, a) => sum + a.hints, 0) : part.filter((a) => (m === 'right' ? a.correct : m === 'partial' ? a.partial : !a.correct)).length;
    return compare(c.op ?? 'ge', String(n), String(c.than ?? 1));
  }
  if (c.type === 'streak') {
    const want = c.measure !== 'wrong';
    const n = Math.max(1, Math.round(c.than ?? 1));
    return log.length >= n && log.slice(-n).every((a) => a.correct === want);
  }
  const last = log[log.length - 1];
  if (last === undefined) return false;
  if (c.correct !== undefined && last.correct !== c.correct) return false;
  if (c.partial !== undefined && last.partial !== c.partial) return false;
  if (c.tag !== undefined && !last.tags.includes(c.tag)) return false;
  if (c.measure !== undefined) return compare(c.op ?? 'ge', String(c.measure === 'timeMs' ? last.ms : last.hints), String(c.than ?? 1));
  return true;
}

function metres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const minutesOf = (hhmm: string | undefined): number | null => {
  const m = hhmm === undefined ? null : /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m === null ? null : Number(m[1]) * 60 + Number(m[2]);
};

/** Ein Wert in Worten: was die Bedingung prüft — für den Editor und die Beschreibung. */
/** `field`: der Name eines Feldes einer Beziehung (2026-10-30) — sonst steht sein Schlüssel da. */
export function conditionText(c: Condition, name: (id: string) => string = (id) => id, field: (key: string) => string = (key) => key): string {
  const op = c.op === undefined ? '≥' : COMPARE_LABEL[c.op];
  switch (c.type) {
    case 'value': return t('cogitaData.logic.text.value', { value: c.value ?? '?', op, than: c.than ?? 0 });
    case 'knowness': {
      const who = c.rel !== undefined ? relationText(c.rel, c.each, field) : t('cogitaData.logic.text.quoted', { name: name(c.of ?? '') });
      return c.band !== undefined ? t('cogitaData.logic.text.knownessBand', { who, band: KNOWNESS_BAND_LABEL[c.band] }) : t('cogitaData.logic.text.knowness', { who, op, than: c.than ?? 1 });
    }
    case 'answered': {
      const text = t(c.correct === true ? 'cogitaData.logic.text.answeredRight' : c.correct === false ? 'cogitaData.logic.text.answeredWrong' : 'cogitaData.logic.text.answered', { name: name(c.of ?? '') });
      return c.within === undefined ? text : t('cogitaData.logic.text.within', { text, days: c.within });
    }
    case 'visited': return t('cogitaData.logic.text.visited', { name: name(c.of ?? '') });
    case 'flow': return c.state === 'goal'
      ? (c.goal === undefined ? t('cogitaData.logic.text.flowGoal', { name: name(c.flow ?? '') }) : t('cogitaData.logic.text.flowGoalNamed', { name: name(c.flow ?? ''), goal: c.goal }))
      : t('cogitaData.logic.text.flowState', { name: name(c.flow ?? ''), state: FLOW_CHECK_LABEL[c.state ?? 'done'] });
    case 'time': return [t('cogitaData.logic.text.time'), c.after === undefined ? '' : t('cogitaData.logic.text.timeAfter', { at: c.after }), c.before === undefined ? '' : t('cogitaData.logic.text.timeBefore', { at: c.before }), c.from === undefined ? '' : t('cogitaData.logic.text.timeHours', { from: c.from, to: c.to ?? '24:00' })].filter(Boolean).join(' ');
    case 'place': return t('cogitaData.logic.text.place', { radius: c.radius ?? 50, lat: c.lat ?? '?', lon: c.lon ?? '?' });
    case 'zone': return t('cogitaData.logic.text.zone', { name: name(c.of ?? '') });
    case 'session': return t('cogitaData.logic.text.session', {
      measure: t(`cogitaData.logic.measure.${c.measure ?? 'wrong'}`), op, than: c.than ?? 1,
      since: c.since === undefined || c.since === 'unit' ? t('cogitaData.logic.since.unit') : c.since === 'flowStart' ? t('cogitaData.logic.since.flowStart') : t('cogitaData.logic.since.step', { name: name(c.since) })
    });
    case 'streak': return t(c.measure === 'wrong' ? 'cogitaData.logic.text.streakWrong' : 'cogitaData.logic.text.streakRight', { n: c.than ?? 1 });
    case 'mode': return t(c.is === 'self' ? 'cogitaData.logic.text.modeSelf' : 'cogitaData.logic.text.modeLesson');
    case 'lastAnswer': return [
      t('cogitaData.logic.text.lastAnswer'),
      c.correct === undefined ? '' : t(c.correct ? 'cogitaData.logic.text.lastRight' : 'cogitaData.logic.text.lastWrong'),
      c.partial === true ? t('cogitaData.logic.text.lastPartial') : '',
      c.tag === undefined ? '' : t('cogitaData.logic.text.lastTag', { tag: c.tag }),
      c.measure === undefined ? '' : t('cogitaData.logic.text.lastMeasure', { measure: t(`cogitaData.logic.measure.${c.measure}`), op, than: c.than ?? 1 })
    ].filter(Boolean).join(' ');
    case 'not': return t('cogitaData.logic.text.not', { inner: c.items?.[0] === undefined ? '…' : conditionText(c.items[0], name, field) });
    default: return (c.items ?? []).map((i) => `(${conditionText(i, name, field)})`).join(` ${CONDITION_LABEL[c.type]} `) || CONDITION_LABEL[c.type];
  }
}

/** Gilt die Bedingung? Eine fehlende (`null`) gilt immer. */
export function holds(c: Condition | null | undefined, facts: Facts): boolean {
  if (c === null || c === undefined) return true;
  const op = c.op ?? 'ge';
  switch (c.type) {
    case 'value': return compare(op, String(facts.values[c.value ?? ''] ?? 0), String(c.than ?? 0));
    case 'knowness': {
      const than = String(c.than ?? 1);
      /* 2026-11-01 — ein Band (poznane, znane, do powtórki, nieznane) oder ein Vergleich mit einer Zahl. */
      const band = c.band;
      const test = (id: string) => (band !== undefined ? inBand(facts.knowness(id), band) : compare(op, String(facts.knowness(id)), than));
      if (c.rel === undefined) return test(c.of ?? '');
      /* 2026-10-30 — relativ: über alle (Vorgabe) oder einen von dem, worauf die Beziehung führt. */
      const ids = facts.related?.(c.rel) ?? [];
      return c.each === 'any' ? ids.some(test) : ids.every(test);
    }
    case 'answered': {
      const got = facts.answered(c.of ?? '');
      if (got === null) return false;
      /* 2026-11-10 — „in den letzten N Tagen": ohne bekannten Zeitpunkt gilt es nicht. */
      if (c.within !== undefined) {
        const at = facts.answeredAt?.(c.of ?? '') ?? null;
        if (at === null || facts.now.getTime() - at > c.within * 86_400_000) return false;
      }
      return c.correct === undefined ? true : c.correct ? got >= 0.999 : got < 0.999;
    }
    case 'visited': return facts.visited.has(c.of ?? '');
    case 'flow': {
      const f = facts.flow?.(c.flow ?? '');
      if (f === undefined) return false;
      if (c.state === 'started') return f.started;
      if (c.state === 'goal') return c.goal === undefined ? f.goals.length > 0 : f.goals.includes(c.goal);
      return f.done;
    }
    case 'time': {
      const now = facts.now;
      if (c.after !== undefined && now < new Date(c.after.length <= 10 ? `${c.after}T00:00:00` : c.after)) return false;
      if (c.before !== undefined && now > new Date(c.before.length <= 10 ? `${c.before}T23:59:59` : c.before)) return false;
      const from = minutesOf(c.from);
      const to = minutesOf(c.to);
      if (from !== null || to !== null) {
        const at = now.getHours() * 60 + now.getMinutes();
        const lo = from ?? 0;
        const hi = to ?? 24 * 60;
        if (lo <= hi ? at < lo || at > hi : at < lo && at > hi) return false;
      }
      return true;
    }
    case 'place': {
      if (facts.place == null || c.lat === undefined || c.lon === undefined) return false;
      return metres(facts.place, { lat: c.lat, lon: c.lon }) <= (c.radius ?? 50);
    }
    case 'zone': return facts.zones?.has(c.of ?? '') === true;
    case 'session':
    case 'lastAnswer':
    case 'streak': return holdsSession(c, facts);
    case 'mode': return (facts.mode ?? 'self') === (c.is ?? 'lesson');
    case 'and': return gate('and', (c.items ?? []).map((i) => holds(i, facts)));
    case 'or': return gate('or', (c.items ?? []).map((i) => holds(i, facts)));
    case 'xor': return gate('xor', (c.items ?? []).map((i) => holds(i, facts)));
    case 'not': return gate('not', (c.items ?? []).slice(0, 1).map((i) => holds(i, facts)));
  }
}

/* -- Aktionen ------------------------------------------------------------------------- */

export const ACTION_TYPES = ['set', 'add', 'go'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** `set`/`add` ändern einen Wert, `go` springt zu einem Schritt. */
export interface Action {
  readonly type: ActionType;
  readonly value?: string;
  readonly to?: number;
  readonly by?: number;
  readonly step?: string;
}

export function readAction(raw: unknown): Action | null {
  if (!isObject(raw) || !(ACTION_TYPES as readonly string[]).includes(String(raw.type))) return null;
  const type = raw.type as ActionType;
  return {
    type,
    ...(str(raw.value) === undefined ? {} : { value: str(raw.value) }),
    ...(num(raw.to) === undefined ? {} : { to: num(raw.to) }),
    ...(num(raw.by) === undefined ? {} : { by: num(raw.by) }),
    ...(str(raw.step) === undefined ? {} : { step: str(raw.step) })
  };
}

/** Wertgrenzen (eine Nähe zwischen −5 und 5) — aus den Werten des Kurses. */
export interface ValueLimit {
  readonly min?: number;
  readonly max?: number;
}

/** Aktionen anwenden: die neuen Werte und, falls eine springt, wohin. */
export function apply(actions: readonly Action[], values: Readonly<Record<string, number>>, limits: (id: string) => ValueLimit = () => ({})): { values: Record<string, number>; go: string | null } {
  const next: Record<string, number> = { ...values };
  let go: string | null = null;
  for (const a of actions) {
    if (a.type === 'go') { if (a.step !== undefined) go = a.step; continue; }
    if (a.value === undefined) continue;
    const before = next[a.value] ?? 0;
    let after = a.type === 'set' ? a.to ?? before : before + (a.by ?? 0);
    const lim = limits(a.value);
    if (lim.min !== undefined) after = Math.max(lim.min, after);
    if (lim.max !== undefined) after = Math.min(lim.max, after);
    next[a.value] = after;
  }
  return { values: next, go };
}
