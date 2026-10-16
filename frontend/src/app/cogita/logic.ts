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

/* -- Werte, Vergleich, Tore — für alle ------------------------------------------- */

export type Value = string | boolean;

export const COMPARE_OPS = ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'contains', 'filled', 'empty'] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

export const COMPARE_LABEL: Record<CompareOp, string> = {
  eq: '=', ne: '≠', gt: '>', ge: '≥', lt: '<', le: '≤',
  contains: 'zawiera', filled: 'wypełnione', empty: 'puste'
};

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
  readonly visited: ReadonlySet<string>;
  readonly now: Date;
  /** Wo er ist (im Spiel) — `null`: unbekannt. */
  readonly place?: { readonly lat: number; readonly lon: number } | null;
  /** In welchen Zonen er steht (sagt der Dienst im Spiel). */
  readonly zones?: ReadonlySet<string>;
}

export const NO_FACTS: Facts = {
  values: {}, knowness: () => 0, answered: () => null, visited: new Set(), now: new Date(0)
};

export const CONDITION_TYPES = ['value', 'knowness', 'answered', 'visited', 'time', 'place', 'zone', 'and', 'or', 'not', 'xor'] as const;
export type ConditionType = (typeof CONDITION_TYPES)[number];

export const CONDITION_LABEL: Record<ConditionType, string> = {
  value: 'Wartość', knowness: 'Znajomość', answered: 'Odpowiedź', visited: 'Odwiedzone',
  time: 'Czas', place: 'Miejsce', zone: 'Strefa', and: 'I', or: 'LUB', not: 'NIE', xor: 'ALBO'
};

/**
 * EINE BEDINGUNG als kleiner Baum — so steht sie in einem Ablauf, an einer
 * Zeile einer Gestalt, an einem Auslöser:
 *
 * <code>
 *   { "type": "value", "value": "zaufanie", "op": "ge", "than": 3 }
 *   { "type": "knowness", "of": "<id>", "op": "ge", "than": 1 }
 *   { "type": "answered", "of": "<pytanie>", "correct": true }
 *   { "type": "visited", "of": "<krok>" }
 *   { "type": "time", "after": "2026-12-24", "before": "2026-12-27", "from": "18:00", "to": "23:00" }
 *   { "type": "place", "lat": 50.06, "lon": 19.94, "radius": 100 }
 *   { "type": "zone", "of": "<strefa>" }
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
  readonly after?: string;
  readonly before?: string;
  readonly from?: string;
  readonly to?: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly radius?: number;
  readonly items?: readonly Condition[];
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
  const op = (COMPARE_OPS as readonly string[]).includes(String(raw.op)) ? (raw.op as CompareOp) : undefined;
  return {
    type,
    ...(str(raw.value) === undefined ? {} : { value: str(raw.value) }),
    ...(str(raw.of) === undefined ? {} : { of: str(raw.of) }),
    ...(op === undefined ? {} : { op }),
    ...(num(raw.than) === undefined ? {} : { than: num(raw.than) }),
    ...(typeof raw.correct === 'boolean' ? { correct: raw.correct } : {}),
    ...(str(raw.after) === undefined ? {} : { after: str(raw.after) }),
    ...(str(raw.before) === undefined ? {} : { before: str(raw.before) }),
    ...(str(raw.from) === undefined ? {} : { from: str(raw.from) }),
    ...(str(raw.to) === undefined ? {} : { to: str(raw.to) }),
    ...(num(raw.lat) === undefined ? {} : { lat: num(raw.lat) }),
    ...(num(raw.lon) === undefined ? {} : { lon: num(raw.lon) }),
    ...(num(raw.radius) === undefined ? {} : { radius: num(raw.radius) })
  };
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
export function conditionText(c: Condition, name: (id: string) => string = (id) => id): string {
  const op = c.op === undefined ? '≥' : COMPARE_LABEL[c.op];
  switch (c.type) {
    case 'value': return `wartość „${c.value ?? '?'}" ${op} ${c.than ?? 0}`;
    case 'knowness': return `znajomość „${name(c.of ?? '')}" ${op} ${c.than ?? 1}`;
    case 'answered': return c.correct === true ? `dobrze odpowiedziano na „${name(c.of ?? '')}"` : c.correct === false ? `źle odpowiedziano na „${name(c.of ?? '')}"` : `odpowiedziano na „${name(c.of ?? '')}"`;
    case 'visited': return `widziano krok „${name(c.of ?? '')}"`;
    case 'time': return ['czas', c.after === undefined ? '' : `od ${c.after}`, c.before === undefined ? '' : `do ${c.before}`, c.from === undefined ? '' : `godz. ${c.from}–${c.to ?? '24:00'}`].filter(Boolean).join(' ');
    case 'place': return `w promieniu ${c.radius ?? 50} m od ${c.lat ?? '?'}, ${c.lon ?? '?'}`;
    case 'zone': return `w strefie „${name(c.of ?? '')}"`;
    case 'not': return `NIE (${c.items?.[0] === undefined ? '…' : conditionText(c.items[0], name)})`;
    default: return (c.items ?? []).map((i) => `(${conditionText(i, name)})`).join(c.type === 'and' ? ' I ' : c.type === 'or' ? ' LUB ' : ' ALBO ') || CONDITION_LABEL[c.type];
  }
}

/** Gilt die Bedingung? Eine fehlende (`null`) gilt immer. */
export function holds(c: Condition | null | undefined, facts: Facts): boolean {
  if (c === null || c === undefined) return true;
  const op = c.op ?? 'ge';
  switch (c.type) {
    case 'value': return compare(op, String(facts.values[c.value ?? ''] ?? 0), String(c.than ?? 0));
    case 'knowness': return compare(op, String(facts.knowness(c.of ?? '')), String(c.than ?? 1));
    case 'answered': {
      const got = facts.answered(c.of ?? '');
      if (got === null) return false;
      return c.correct === undefined ? true : c.correct ? got >= 0.999 : got < 0.999;
    }
    case 'visited': return facts.visited.has(c.of ?? '');
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
