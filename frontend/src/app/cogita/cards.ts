/**
 * COGITA — KARTEN AUS VORLAGEN (COGITA.md §5).
 *
 * <b>Wie eine Frage entsteht, sagt der Mensch</b> [D1]. Eine Vorlage gehört zu
 * einer Art (oder mehreren) und ist ein Graph aus kleinen Bausteinen — das
 * Vorbild ist der Vorlageneditor von Cogita Graph (`legacy/pages/cg`):
 *
 * <code>
 *   Daten      pole · odwołanie (kilka kroków) · lista · ten wpis
 *   Tekst      wzór „Kto napisał {0}?" · maska (początek, koniec, losowo) · fragmenty cytatu
 *   Wybór      wybierz jeden (wybrany i reszta) · dystraktory · dla każdej wartości
 *   Liczby     losowa wartość · działanie · porównanie (prawda/fałsz) · warunek · Python
 *   Karta      pytanie (tekst, obraz, dźwięk) · odpowiedź w jednej z dwunastu form · wyjaśnienie · karta
 * </code>
 *
 * Für jeden Eintrag der Art läuft der Graph einmal — oder, mit „dla każdej
 * wartości", einmal je Wert (jede Übersetzung, jedes Isotop, jeder Teil eines
 * Zitats) [D11] — und gibt je Lauf eine Karte. Was auf den Leitungen fliesst,
 * sind immer Listen von Stücken (`Item`): ein Text, wofür er steht (ein
 * Eintrag, eine Zahl, ein Datum, eine Datei) und wie sicher er ist.
 *
 * <b>Die Kennung einer Karte ist die Frage UND die Richtung</b> (COGITA.md §7):
 * `vorlage:eintrag[:wert]` und die Richtung der Vorlage (`a→b`, `b→a`). Unter
 * ihr liegen Antworten und Kenntnis. Ändert sich, was als richtig gilt, beginnt
 * die Geschichte der Karte neu [D7] — dafür trägt sie einen Fingerabdruck der
 * erwarteten Antwort. Eine Vorlage mit Zufall (berechnete Fragen, ein zufällig
 * gewählter Wert) fragt jedes Mal anderes: ihr Fingerabdruck ist der der
 * Vorlage selbst, damit die Geschichte nicht bei jedem Würfeln endet.
 *
 * <b>Daneben gibt es von Hand geschriebene Fragen</b> (Systemart `question`)
 * und das Thema als Frage, dessen Wissen sich aufdecken lässt [C4].
 */

import { checkCode, checkDate, checkFlash, checkMany, checkMatch, checkNumber, checkOne, checkOrder, checkPoint, checkText, checkTrueFalse, GAP_RULE, readDateAnswer, readRule, TEXT_RULE, type AnswerForm, type FlashGrade, type Outcome, type PointExpected, type PointGiven, type TextRule } from './check';
import { ancestors, evaluate, paletteOf, readGraph, type Graph, type NodeKind, type Port, type RunOutput } from './graph';
import { dateKey, fieldOf, fieldsOf, labelOf, plainOf, readDate, readNumber, valuesOf, valueText, type DatePrecision, type Entity, type GeoPoint, type Lookup, type MediaRef, type ValueState } from './schema';

/* -- Was auf den Leitungen fliesst ------------------------------------------------- */

export interface Item {
  readonly text: string;
  /** Der Wert mit seinem Typ: Zahl, Datum, ja/nein, Ort … */
  readonly value?: unknown;
  /** Wofür das Stück steht, wenn es ein Eintrag ist. */
  readonly entity?: string;
  readonly media?: MediaRef;
  readonly state?: ValueState;
}

export interface TemplateContext {
  readonly look: Lookup;
  /** Der Eintrag, für den die Karte entsteht. */
  readonly entity: Entity;
  /** Die Einträge einer Art — woraus Dystraktoren kommen. */
  readonly pool: (kind: string) => readonly Entity[];
  /** Die aktuelle Sammlung: Dystraktoren „nur aus ihr" [D15]. */
  readonly scope?: ReadonlySet<string>;
  /** Der Same des Zufalls — je Versuch ein anderer, damit Wahlmöglichkeiten neu gemischt werden. */
  readonly seed: string;
  /** Pyodide im Browser [D10]; fehlt er, scheitert nur der Python-Baustein. */
  readonly python?: (code: string, args: readonly unknown[]) => Promise<unknown>;
  /** Der Wert der Schleife „dla każdej wartości" in diesem Lauf. */
  readonly variant?: string;
}

/* -- Zufall mit Samen -------------------------------------------------------------- */

/** FNV-1a, 32 Bit — für Samen und Fingerabdrücke, nicht für Geheimnisse. */
export function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** mulberry32 — dieselbe Folge für denselben Samen. */
export function rngOf(seed: string): () => number {
  let a = parseInt(hashOf(seed), 16) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Stabil serialisiert: gleiche Daten, gleicher Text, gleich in welcher Reihenfolge die Schlüssel kamen. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/* -- Die Karte --------------------------------------------------------------------- */

export interface PromptPart {
  readonly text: string;
  readonly media?: MediaRef;
}

export type AnswerSpec =
  | { readonly form: 'text'; readonly accepted: readonly string[]; readonly rule: TextRule }
  | { readonly form: 'gap'; readonly shown: string; readonly accepted: readonly string[]; readonly rule: TextRule }
  | { readonly form: 'number'; readonly values: readonly number[]; readonly tolerance: number; readonly relative: boolean; readonly unit: string }
  | { readonly form: 'date'; readonly values: readonly string[]; readonly precision: DatePrecision; readonly tolerance: number }
  | { readonly form: 'one'; readonly options: readonly string[]; readonly correct: number }
  | { readonly form: 'many'; readonly options: readonly string[]; readonly correct: readonly number[] }
  | { readonly form: 'truefalse'; readonly value: boolean }
  | { readonly form: 'order'; readonly items: readonly string[]; readonly shown: readonly string[] }
  | { readonly form: 'match'; readonly left: readonly string[]; readonly right: readonly string[]; readonly pairs: readonly (readonly [number, number])[] }
  | { readonly form: 'flash'; readonly back: readonly string[] }
  | { readonly form: 'code'; readonly task: string; readonly starter: string; readonly createInput: string; readonly reference: string; readonly cases: number }
  | { readonly form: 'point'; readonly on: 'map' | 'image'; readonly target: PointExpected };

export interface Card {
  /** Die Frage: eine von Hand geschriebene, oder `vorlage:eintrag[:wert]`. */
  readonly question: string;
  readonly direction: string;
  /** Unter diesem Schlüssel liegen Antworten und Kenntnis. */
  readonly key: string;
  readonly entity?: string;
  readonly template?: string;
  readonly prompt: readonly PromptPart[];
  readonly answer: AnswerSpec;
  /** Was nach der Antwort zur Erklärung erscheint — Wissen, Einträge [D14]. */
  readonly explain: readonly string[];
  /** Fingerabdruck dessen, was als richtig gilt [D7]. */
  readonly fingerprint: string;
  /** Fragt jedes Mal anderes (Zufall); der Fingerabdruck ist dann der der Vorlage. */
  readonly varies: boolean;
  /** Karten, die vorher sitzen müssen — die Teile eines Zitats vor dem Ganzen. */
  readonly requires: readonly string[];
}

export const cardKey = (question: string, direction: string): string => (direction === '' ? question : `${question}|${direction}`);

/** Was als richtig gilt, ohne die Reihenfolge, in der es gezeigt wird — gemischte Wahlmöglichkeiten ändern nichts. */
function expectedOf(answer: AnswerSpec): unknown {
  switch (answer.form) {
    case 'text': return { f: 'text', a: answer.accepted.map((a) => a.toLowerCase()).sort() };
    case 'gap': return { f: 'gap', a: answer.accepted.map((a) => a.toLowerCase()).sort(), s: answer.shown };
    case 'number': return { f: 'number', v: answer.values.slice().sort((a, b) => a - b), t: answer.tolerance, r: answer.relative };
    case 'date': return { f: 'date', v: answer.values.slice().sort(), p: answer.precision, t: answer.tolerance };
    case 'one': return { f: 'one', c: answer.options[answer.correct] };
    case 'many': return { f: 'many', c: answer.correct.map((i) => answer.options[i]).sort() };
    case 'truefalse': return { f: 'tf', v: answer.value };
    case 'order': return { f: 'order', i: answer.items };
    case 'match': return { f: 'match', p: answer.pairs.map(([l, r]) => `${answer.left[l]}→${answer.right[r]}`).sort() };
    case 'flash': return { f: 'flash', b: answer.back };
    case 'code': return { f: 'code', r: answer.reference, c: answer.createInput, n: answer.cases };
    case 'point': return { f: 'point', t: answer.target };
  }
}

/**
 * DIE PRÜFUNG EINER KARTE — die gegebene Antwort in der Form ihrer Karte:
 *
 * <code>
 *   text, gap, number, date   der eingegebene Text
 *   one / many                die Stelle / die Stellen in `options`
 *   truefalse                 true oder false
 *   order                     die Stücke in der gewählten Reihenfolge
 *   match                     Paare [links, rechts] als Stellen in `left` und `right`
 *   flash                     'knew' · 'partly' · 'not'
 *   code                      { passed, total } aus Pyodide
 *   point                     { x, y } auf dem Bild oder { lat, lon }
 * </code>
 *
 * `rule` ist, was eine Wiederholung an der Strenge der Vorlage ändert [D5].
 */
export function checkCard(card: Card, given: unknown, rule?: Partial<TextRule>): Outcome {
  const a = card.answer;
  switch (a.form) {
    case 'text': return checkText(a.accepted, typeof given === 'string' ? given : '', { ...a.rule, ...rule });
    case 'gap': return checkText(a.accepted, typeof given === 'string' ? given : '', { ...a.rule, ...rule });
    case 'number': return checkNumber(a, given);
    case 'date': return checkDate(a, typeof given === 'string' ? given : '');
    case 'one': return checkOne(a.correct, typeof given === 'number' ? given : null);
    case 'many': return checkMany(a.correct, Array.isArray(given) ? given.filter((g): g is number => typeof g === 'number') : []);
    case 'truefalse': return checkTrueFalse(a.value, typeof given === 'boolean' ? given : null);
    case 'order': return checkOrder(a.items, Array.isArray(given) ? given.map(String) : []);
    case 'match': return checkMatch(a.pairs, Array.isArray(given) ? given.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number')) : []);
    case 'flash': return checkFlash(given === 'knew' || given === 'partly' || given === 'not' ? (given as FlashGrade) : null);
    case 'code': return checkCode(isObject(given) && typeof given.passed === 'number' && typeof given.total === 'number' ? { passed: given.passed, total: given.total } : null);
    case 'point': return checkPoint(a.target, isObject(given) ? (given as unknown as PointGiven) : null);
  }
}

/* -- Bausteine --------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter((x) => x !== '') : typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter((x) => x !== '') : []);

/** Was an einem Eingang ankam — alle Kanten, alle Stücke, in einer Liste. */
const itemsAt = (inputs: Readonly<Record<string, readonly unknown[]>>, port: string): Item[] =>
  (inputs[port] ?? []).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((v): v is Item => isObject(v) && typeof (v as { text?: unknown }).text === 'string');

const texts = (items: readonly Item[]): string[] => items.map((i) => i.text).filter((t) => t.trim() !== '');

const port = (id: string, label: string, type = 'items', many = false): Port => ({ id, label, type, many });

type Kind = NodeKind<TemplateContext>;

const rngFor = (ctx: TemplateContext, nodeId: string) => rngOf(`${ctx.seed}:${nodeId}:${ctx.variant ?? ''}`);

/** Die Einträge, deren Feld gelesen wird: was ankommt, sonst der eigene. */
function sourcesOf(ctx: TemplateContext, items: readonly Item[]): Entity[] {
  if (items.length === 0) return [ctx.entity];
  return items.map((i) => (i.entity === undefined ? undefined : ctx.look.entity(i.entity))).filter((e): e is Entity => e !== undefined);
}

function readField(ctx: TemplateContext, entities: readonly Entity[], key: string): Item[] {
  const out: Item[] = [];
  for (const entity of entities) {
    const field = fieldOf(entity, ctx.look, key);
    if (field === undefined) continue;
    for (const v of valuesOf(entity, field)) {
      if (v.value === null) continue;
      const text = valueText(field, v.value, ctx.look);
      if (field.type === 'ref' && typeof v.value === 'string') out.push({ text, entity: v.value, state: v.state });
      else if (field.type === 'media' && isObject(v.value)) out.push({ text, media: v.value as unknown as MediaRef, state: v.state });
      else if (field.type === 'markup' && typeof v.value === 'string') out.push({ text: plainOf(v.value), value: v.value, state: v.state });
      else out.push({ text, value: v.value, state: v.state });
    }
  }
  return out;
}

const FIELD: Kind = {
  type: 'field', label: 'Pole', group: 'Dane',
  says: 'Wartości jednego pola — tego wpisu albo wpisów, które przychodzą z lewej.',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('values', 'Wartości')] }),
  run: ({ config, inputs, ctx }) => ({ values: readField(ctx, sourcesOf(ctx, itemsAt(inputs, 'of')), str(config.key)) })
};

const MEDIA: Kind = {
  type: 'media', label: 'Obraz albo dźwięk', group: 'Dane',
  says: 'Plik z pola — jako pytanie: pokaż obraz, odtwórz nagranie.',
  ports: () => ({ inputs: [port('of', 'Z wpisów', 'items', true)], outputs: [port('values', 'Pliki')] }),
  run: ({ config, inputs, ctx }) => ({ values: readField(ctx, sourcesOf(ctx, itemsAt(inputs, 'of')), str(config.key)).filter((i) => i.media !== undefined) })
};

/** Mehrere Schritte über Verweise: „autor → miejsce urodzenia". */
const FOLLOW: Kind = {
  type: 'follow', label: 'Przez odwołania', group: 'Dane',
  says: 'Idzie po odwołaniach, krok po kroku (np. autor, potem jego miejsce urodzenia), i daje wpisy na końcu drogi.',
  ports: () => ({ inputs: [port('of', 'Od wpisów', 'items', true)], outputs: [port('entities', 'Wpisy')] }),
  run: ({ config, inputs, ctx }) => {
    let current: Entity[] = sourcesOf(ctx, itemsAt(inputs, 'of'));
    let items: Item[] = [];
    for (const key of lines(config.path)) {
      items = readField(ctx, current, key).filter((i) => i.entity !== undefined);
      current = items.map((i) => ctx.look.entity(i.entity!)).filter((e): e is Entity => e !== undefined);
    }
    return { entities: items };
  }
};

const LIST: Kind = {
  type: 'list', label: 'Lista', group: 'Dane',
  says: 'Stała lista wpisana przez autora — np. dodatkowe poprawne odpowiedzi albo własne dystraktory.',
  ports: () => ({ inputs: [], outputs: [port('values', 'Pozycje')] }),
  run: ({ config }) => ({ values: lines(config.items).map((text) => ({ text })) })
};

const SELF: Kind = {
  type: 'entity', label: 'Ten wpis', group: 'Dane',
  says: 'Wpis, dla którego powstaje karta — z jego etykietą.',
  ports: () => ({ inputs: [], outputs: [port('entities', 'Wpis')] }),
  run: ({ ctx }) => ({ entities: [{ text: labelOf(ctx.entity, ctx.look), entity: ctx.entity.id }] })
};

const PATTERN: Kind = {
  type: 'pattern', label: 'Wzór tekstu', group: 'Tekst',
  says: 'Składa tekst z wejść: „Kto napisał {0}?". Kilka wartości na jednym wejściu łączy przecinkiem.',
  ports: (config) => {
    const count = Math.max(1, Math.min(10, Math.round(num(config.inputs, 1))));
    return { inputs: Array.from({ length: count }, (_, i) => port(`p${i}`, `{${i}}`, 'items', true)), outputs: [port('text', 'Tekst')] };
  },
  run: ({ config, inputs }) => {
    const joiner = typeof config.joiner === 'string' ? config.joiner : ', ';
    const text = str(config.text).replace(/\{(\d)\}/g, (_w, i: string) => texts(itemsAt(inputs, `p${i}`)).join(joiner)).replace(/\s+/g, ' ').trim();
    return { text: text === '' ? [] : [{ text }] };
  }
};

/** Wörter — die Lücke fällt auf Wortgrenzen, nie mitten in ein Wort. */
const words = (text: string): string[] => text.split(/(\s+)/).filter((w) => w !== '');

const MASK: Kind = {
  type: 'mask', label: 'Maska', group: 'Tekst',
  says: 'Zakrywa część tekstu: koniec, początek albo losowe słowa. Daje tekst z luką, zakrytą część i całość.',
  ports: () => ({ inputs: [port('text', 'Tekst')], outputs: [port('shown', 'Z luką'), port('hidden', 'Zakryte'), port('full', 'Całość')] }),
  run: ({ node, config, inputs, ctx }) => {
    const text = texts(itemsAt(inputs, 'text')).join(' ');
    const keep = Math.max(0, Math.min(1, num(config.keep, 0.3)));
    const gap = str(config.gap) || '…';
    const parts = words(text);
    const solid = parts.map((w, i) => ({ w, i })).filter((p) => p.w.trim() !== '');
    const visible = Math.max(0, Math.min(solid.length - 1, Math.round(solid.length * keep)));
    let hideIdx: Set<number>;
    if (config.mode === 'suffix') hideIdx = new Set(solid.slice(0, solid.length - visible).map((p) => p.i));
    else if (config.mode === 'random') hideIdx = new Set(shuffle(solid, rngFor(ctx, node.id)).slice(0, solid.length - visible).map((p) => p.i));
    else hideIdx = new Set(solid.slice(visible).map((p) => p.i));
    const shown: string[] = [];
    const hidden: string[] = [];
    parts.forEach((w, i) => {
      if (!hideIdx.has(i)) { shown.push(w); return; }
      hidden.push(w);
      shown.push(gap);
    });
    /* Nebeneinander verdeckte Wörter sind EINE Lücke, nicht mehrere. */
    const escaped = gap.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const joined = shown.join('').replace(new RegExp(`${escaped}(\\s+${escaped})+`, 'g'), gap).replace(/\s+/g, ' ').trim();
    return {
      shown: text === '' ? [] : [{ text: joined }],
      hidden: hidden.length === 0 ? [] : [{ text: hidden.join(' ') }],
      full: text === '' ? [] : [{ text }]
    };
  }
};

/* -- Die Teile eines Zitats (der Baum des Altbestands, features/revision/quote.ts) --- */

export interface Fragment {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly depth: number;
  /** Die beiden Hälften, falls das Stück geteilt wurde — sie sitzen zuerst. */
  readonly parts: readonly string[];
}

const isSpace = (c: string) => /\s/.test(c);
const isWord = (c: string) => /[\p{L}\p{N}]/u.test(c);

function boundary(text: string, at: number): number {
  const left = at > 0 ? text[at - 1] : '';
  const right = at < text.length ? text[at] : '';
  if (left === '' || right === '') return 0;
  if (isSpace(left) || isSpace(right)) return 3;
  if (isWord(left) !== isWord(right)) return 2;
  return !isWord(left) && !isWord(right) ? 1 : 0;
}

function splitAt(text: string, start: number, end: number, min: number): number | null {
  const lo = start + min;
  const hi = end - min;
  if (end - start <= min * 2 || hi <= lo) return null;
  const target = Math.floor((start + end) / 2);
  for (const need of [3, 2, 1]) {
    for (let off = 0; off <= Math.max(target - lo, hi - target); off += 1) {
      for (const at of [target - off, target + off]) {
        if (at < lo || at > hi || boundary(text, at) < need) continue;
        const l = text[at - 1] ?? '';
        const r = text[at] ?? '';
        if (l === '' || r === '' || isWord(l) !== isWord(r)) return at;
      }
    }
  }
  return null;
}

/**
 * Ein Zitat als Baum: halbiert an Wortgrenzen, bis die Stücke kurz genug sind
 * (7–13 Zeichen wie im Altbestand). Gefragt wird von unten: erst die kleinen
 * Stücke, dann das, was sie zusammen ergeben.
 */
export function fragmentTree(text: string, min = 7, max = 13): Fragment[] {
  const lo = Math.max(1, min);
  const hi = Math.max(lo, max);
  const out: Fragment[] = [];
  const build = (start: number, end: number, depth: number, id: string): void => {
    const at = end - start > hi ? splitAt(text, start, end, lo) : null;
    const parts = at === null || at <= start || at >= end ? [] : [`${id}0`, `${id}1`];
    out.push({ id, start, end, text: text.slice(start, end), depth, parts });
    if (parts.length === 2) {
      build(start, at!, depth + 1, parts[0]);
      build(at!, end, depth + 1, parts[1]);
    }
  };
  if (text.trim() !== '') build(0, text.length, 0, 'f');
  return out.sort((a, b) => b.depth - a.depth || a.start - b.start);
}

const FRAGMENTS: Kind = {
  type: 'fragments', label: 'Fragmenty cytatu', group: 'Tekst',
  says: 'Dzieli cytat na kawałki (7–13 znaków) i układa je w drzewo: najpierw kawałki, potem to, co razem tworzą. Podłącz „Dla każdej wartości".',
  ports: () => ({ inputs: [port('text', 'Cytat')], outputs: [port('fragments', 'Fragmenty')] }),
  run: ({ config, inputs }) => {
    const text = texts(itemsAt(inputs, 'text')).join(' ');
    const tree = fragmentTree(text, num(config.min, 7), num(config.max, 13));
    return { fragments: tree.map((f) => ({ text: f.text, value: { fragment: f, full: text } })) };
  }
};

const PICK: Kind = {
  type: 'pick', label: 'Wybierz jeden', group: 'Wybór',
  says: 'Bierze jedną wartość z listy (losowo, pierwszą albo ostatnią) i oddaje osobno ją i resztę.',
  ports: () => ({ inputs: [port('items', 'Lista', 'items', true)], outputs: [port('chosen', 'Wybrany'), port('rest', 'Reszta')] }),
  run: ({ node, config, inputs, ctx }) => {
    const list = itemsAt(inputs, 'items');
    if (list.length === 0) return { chosen: [], rest: [] };
    const at = config.position === 'first' ? 0 : config.position === 'last' ? list.length - 1 : Math.floor(rngFor(ctx, node.id)() * list.length);
    return { chosen: [list[at]], rest: list.filter((_x, i) => i !== at) };
  }
};

/** Wie nah sich zwei Werte sind — für Dystraktoren „podobne wartości". */
function nearness(a: Item, b: Item): number {
  const x = typeof a.value === 'number' ? a.value : readNumber(a.text);
  const y = typeof b.value === 'number' ? b.value : readNumber(b.text);
  if (x !== null && y !== null) return Math.abs(x - y);
  const p = a.text.toLowerCase();
  const q = b.text.toLowerCase();
  let common = 0;
  while (common < p.length && common < q.length && p[common] === q[common]) common += 1;
  return Math.abs(p.length - q.length) + (Math.max(p.length, q.length) - common);
}

const DISTRACTORS: Kind = {
  type: 'distractors', label: 'Dystraktory', group: 'Wybór',
  says: 'Błędne odpowiedzi do wyboru: to samo pole innych wpisów tego rodzaju, tylko z bieżącego zbioru, lista autora albo wartości najbliższe poprawnej.',
  ports: () => ({ inputs: [port('expected', 'Poprawne', 'items', true), port('list', 'Lista autora', 'items', true)], outputs: [port('distractors', 'Dystraktory')] }),
  run: ({ node, config, inputs, ctx }) => {
    const count = Math.max(1, Math.min(20, Math.round(num(config.count, 3))));
    const from = new Set(lines(config.from).length > 0 ? lines(config.from) : ['field']);
    const expected = itemsAt(inputs, 'expected');
    const banned = new Set(expected.map((e) => e.text.trim().toLowerCase()));
    const key = str(config.key);
    let candidates: Item[] = [];
    if ((from.has('field') || from.has('scope')) && key !== '') {
      const others = new Map<string, Entity>();
      for (const kind of ctx.entity.kinds) for (const e of ctx.pool(kind)) if (e.id !== ctx.entity.id) others.set(e.id, e);
      const pool = [...others.values()].filter((e) => !from.has('scope') || ctx.scope === undefined || ctx.scope.has(e.id));
      candidates = readField(ctx, pool, key);
    }
    if (from.has('list')) candidates = [...candidates, ...itemsAt(inputs, 'list'), ...lines(config.list).map((text) => ({ text }))];
    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      const k = c.text.trim().toLowerCase();
      if (k === '' || banned.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const ordered = from.has('near') && expected.length > 0
      ? unique.slice().sort((a, b) => nearness(a, expected[0]) - nearness(b, expected[0]))
      : shuffle(unique, rngFor(ctx, node.id));
    return { distractors: ordered.slice(0, count) };
  }
};

/** Der Knoten der Schleife — sein Ausgang wird je Lauf vorgegeben (`cardsOf`). */
const EACH: Kind = {
  type: 'each', label: 'Dla każdej wartości', group: 'Wybór',
  says: 'Robi osobną kartę dla każdej wartości z lewej — każde tłumaczenie, każdy fragment cytatu.',
  ports: () => ({ inputs: [port('items', 'Wartości', 'items', true)], outputs: [port('item', 'Wartość')] }),
  run: ({ inputs }) => ({ item: itemsAt(inputs, 'items').slice(0, 1) })
};

const RANDOM: Kind = {
  type: 'random', label: 'Losowa wartość', group: 'Liczby',
  says: 'Losuje liczbę z przedziału (z krokiem) albo jedną pozycję z listy — dla pytań, które za każdym razem liczą co innego.',
  ports: () => ({ inputs: [port('items', 'Z listy', 'items', true)], outputs: [port('value', 'Wartość')] }),
  run: ({ node, config, inputs, ctx }) => {
    const rng = rngFor(ctx, node.id);
    const list = itemsAt(inputs, 'items');
    if (list.length > 0) return { value: [list[Math.floor(rng() * list.length)]] };
    const min = num(config.min, 1);
    const max = Math.max(min, num(config.max, 10));
    const step = Math.max(1e-9, num(config.step, 1));
    const steps = Math.floor((max - min) / step + 1e-9);
    const value = Number((min + Math.floor(rng() * (steps + 1)) * step).toFixed(10));
    return { value: [{ text: String(value).replace('.', ','), value }] };
  }
};

const OPS = ['add', 'sub', 'mul', 'div', 'pow', 'exp', 'log', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'mod'] as const;
type Op = (typeof OPS)[number];
const MANY_OPS: ReadonlySet<Op> = new Set<Op>(['add', 'mul', 'min', 'max']);
const ONE_OPS: ReadonlySet<Op> = new Set<Op>(['exp', 'log', 'abs', 'floor', 'ceil', 'round']);

const numbersOf = (items: readonly Item[]): number[] =>
  items.map((i) => (typeof i.value === 'number' ? i.value : readNumber(i.text))).filter((n): n is number => n !== null);

const MATH: Kind = {
  type: 'math', label: 'Działanie', group: 'Liczby',
  says: 'Liczy: dodawanie, odejmowanie, mnożenie, dzielenie, potęga, logarytm, zaokrąglanie, reszta z dzielenia.',
  ports: (config) => {
    const op = (OPS as readonly string[]).includes(str(config.op)) ? (str(config.op) as Op) : 'add';
    if (MANY_OPS.has(op)) return { inputs: [port('a', 'Liczby', 'items', true)], outputs: [port('value', 'Wynik')] };
    if (ONE_OPS.has(op)) return { inputs: [port('a', 'Liczba')], outputs: [port('value', 'Wynik')] };
    return { inputs: [port('a', 'a'), port('b', 'b')], outputs: [port('value', 'Wynik')] };
  },
  run: ({ config, inputs }) => {
    const op = (OPS as readonly string[]).includes(str(config.op)) ? (str(config.op) as Op) : 'add';
    const a = numbersOf(itemsAt(inputs, 'a'));
    const b = numbersOf(itemsAt(inputs, 'b'));
    const x = a[0];
    const y = b[0];
    let r: number;
    switch (op) {
      case 'add': r = a.reduce((s, n) => s + n, 0); break;
      case 'mul': r = a.reduce((s, n) => s * n, 1); break;
      case 'min': r = a.length === 0 ? Number.NaN : Math.min(...a); break;
      case 'max': r = a.length === 0 ? Number.NaN : Math.max(...a); break;
      case 'sub': r = x - y; break;
      case 'div': r = x / y; break;
      case 'pow': r = Math.pow(x, y); break;
      case 'mod': r = ((x % y) + y) % y; break;
      case 'exp': r = Math.exp(x); break;
      case 'log': r = Math.log(x); break;
      case 'abs': r = Math.abs(x); break;
      case 'floor': r = Math.floor(x); break;
      case 'ceil': r = Math.ceil(x); break;
      case 'round': r = Math.round(x); break;
    }
    if (!Number.isFinite(r)) throw new Error('Tego nie da się policzyć (brak liczby albo dzielenie przez zero).');
    const decimals = Math.max(0, Math.min(10, Math.round(num(config.decimals, 6))));
    const value = Number(r.toFixed(decimals));
    return { value: [{ text: String(value).replace('.', ','), value }] };
  }
};

/** Eine Zahl oder ein Datum als Zahl zum Vergleichen. */
function ordinal(item: Item | undefined): number | null {
  if (item === undefined) return null;
  if (typeof item.value === 'number') return item.value;
  const date = readDate(item.value) ?? readDateAnswer(item.text);
  if (date !== null && /\d{3,}/.test(item.text + str(item.value))) return date.y * 10000 + (date.m ?? 0) * 100 + (date.d ?? 0);
  return readNumber(item.text);
}

const COMPARE: Kind = {
  type: 'compare', label: 'Porównanie', group: 'Liczby',
  says: 'Prawda albo fałsz z porównania dwóch liczb lub dat: „urodził się przed …?".',
  ports: () => ({ inputs: [port('a', 'a'), port('b', 'b')], outputs: [port('result', 'Prawda / fałsz')] }),
  run: ({ config, inputs }) => {
    const a = ordinal(itemsAt(inputs, 'a')[0]);
    const b = ordinal(itemsAt(inputs, 'b')[0]);
    if (a === null || b === null) throw new Error('Do porównania potrzeba dwóch liczb albo dat.');
    const op = str(config.op) || 'lt';
    const result = op === 'gt' ? a > b : op === 'eq' ? a === b : op === 'ne' ? a !== b : op === 'le' ? a <= b : op === 'ge' ? a >= b : a < b;
    return { result: [{ text: result ? 'prawda' : 'fałsz', value: result }] };
  }
};

const WHEN: Kind = {
  type: 'when', label: 'Warunek', group: 'Liczby',
  says: 'Karta powstaje tylko wtedy, gdy warunek jest spełniony — np. gdy pole jest wypełnione.',
  ports: () => ({ inputs: [port('items', 'Wartości', 'items', true)], outputs: [port('items', 'Dalej')] }),
  run: ({ config, inputs }) => {
    const items = itemsAt(inputs, 'items');
    const want = str(config.value).trim().toLowerCase();
    const has = items.some((i) => i.text.trim().toLowerCase() === want);
    const test = str(config.test) || 'filled';
    const pass = test === 'empty' ? items.length === 0 : test === 'equals' ? has : test === 'differs' ? !has : items.length > 0;
    return { items, pass };
  }
};

const PYTHON: Kind = {
  type: 'python', label: 'Python', group: 'Liczby',
  says: 'Liczy w Pythonie, w przeglądarce (Pyodide): funkcja run(*wejścia) zwraca wartość albo listę wartości.',
  ports: (config) => {
    const count = Math.max(0, Math.min(6, Math.round(num(config.inputs, 1))));
    return { inputs: Array.from({ length: count }, (_, i) => port(`p${i}`, `wejście ${i + 1}`, 'items', true)), outputs: [port('value', 'Wynik')] };
  },
  run: async ({ config, inputs, ctx }) => {
    if (ctx.python === undefined) throw new Error('Python nie jest tu dostępny.');
    const count = Math.max(0, Math.min(6, Math.round(num(config.inputs, 1))));
    const args = Array.from({ length: count }, (_, i) => itemsAt(inputs, `p${i}`).map((it) => it.value ?? it.text));
    const result = await ctx.python(str(config.code), args.map((a) => (a.length === 1 ? a[0] : a)));
    const list = Array.isArray(result) ? result : [result];
    return { value: list.filter((v) => v !== null && v !== undefined).map((v) => ({ text: typeof v === 'number' ? String(v).replace('.', ',') : str(v) || JSON.stringify(v), value: v })) };
  }
};

/* -- Frage und Antwort ------------------------------------------------------------- */

const PROMPT: Kind = {
  type: 'prompt', label: 'Pytanie', group: 'Karta',
  says: 'To, co widzi uczący się: teksty, obrazy, nagrania — w kolejności połączeń z góry na dół.',
  ports: () => ({ inputs: [port('parts', 'Części', 'items', true)], outputs: [port('prompt', 'Pytanie', 'prompt')] }),
  run: ({ inputs }) => ({ prompt: itemsAt(inputs, 'parts').map((i): PromptPart => (i.media ? { text: i.text, media: i.media } : { text: i.text })) })
};

interface Draft {
  readonly answer: AnswerSpec;
}

const answerPort = [port('answer', 'Odpowiedź', 'answer')];

const ANSWER_TEXT: Kind = {
  type: 'answer.text', label: 'Odpowiedź: tekst', group: 'Odpowiedź',
  says: 'Uczący się wpisuje tekst. Pierwsza wartość jest wzorcowa, kolejne i „inne poprawne" też się liczą.',
  ports: () => ({ inputs: [port('expected', 'Poprawna', 'items', true), port('accepted', 'Inne poprawne', 'items', true)], outputs: answerPort }),
  run: ({ config, inputs }) => {
    const accepted = [...texts(itemsAt(inputs, 'expected')), ...texts(itemsAt(inputs, 'accepted'))];
    if (accepted.length === 0) return {};
    return { answer: { answer: { form: 'text', accepted: unique(accepted), rule: readRule(config.rule, TEXT_RULE) } } satisfies Draft };
  }
};

const unique = (list: readonly string[]): string[] => {
  const seen = new Set<string>();
  return list.filter((t) => {
    const k = t.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const ANSWER_GAP: Kind = {
  type: 'answer.gap', label: 'Odpowiedź: luka w cytacie', group: 'Odpowiedź',
  says: 'Uczący się uzupełnia lukę. Przyjmuje tekst z luką i zakrytą część (z maski) albo fragment cytatu.',
  ports: () => ({ inputs: [port('shown', 'Tekst z luką'), port('hidden', 'Zakryte', 'items', true), port('fragment', 'Fragment')], outputs: answerPort }),
  run: ({ config, inputs }) => {
    const fragment = itemsAt(inputs, 'fragment')[0];
    const rule = readRule(config.rule, GAP_RULE);
    if (fragment !== undefined && isObject(fragment.value) && isObject(fragment.value.fragment)) {
      const f = fragment.value.fragment as unknown as Fragment;
      const full = str(fragment.value.full);
      const shown = `${full.slice(0, f.start)}…${full.slice(f.end)}`.replace(/\s+/g, ' ').trim();
      return { answer: { answer: { form: 'gap', shown, accepted: [f.text.trim()], rule } } satisfies Draft };
    }
    const hidden = texts(itemsAt(inputs, 'hidden'));
    const shown = texts(itemsAt(inputs, 'shown'))[0] ?? '';
    if (hidden.length === 0 || shown === '') return {};
    return { answer: { answer: { form: 'gap', shown, accepted: unique(hidden), rule } } satisfies Draft };
  }
};

const ANSWER_NUMBER: Kind = {
  type: 'answer.number', label: 'Odpowiedź: liczba', group: 'Odpowiedź',
  says: 'Uczący się wpisuje liczbę; tolerancja bezwzględna albo w procentach, jednostka do wpisania obok.',
  ports: () => ({ inputs: [port('expected', 'Poprawna', 'items', true)], outputs: answerPort }),
  run: ({ config, inputs }) => {
    const values = numbersOf(itemsAt(inputs, 'expected'));
    if (values.length === 0) return {};
    return { answer: { answer: { form: 'number', values, tolerance: Math.max(0, num(config.tolerance, 0)), relative: config.relative === true, unit: str(config.unit) } } satisfies Draft };
  }
};

const ANSWER_DATE: Kind = {
  type: 'answer.date', label: 'Odpowiedź: data', group: 'Odpowiedź',
  says: 'Uczący się wpisuje datę z wymaganą dokładnością (rok, miesiąc, dzień); tolerancja w tych jednostkach.',
  ports: () => ({ inputs: [port('expected', 'Poprawna', 'items', true)], outputs: answerPort }),
  run: ({ config, inputs }) => {
    const values = itemsAt(inputs, 'expected')
      .map((i) => readDate(i.value) ?? readDateAnswer(i.text))
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map(dateKey);
    if (values.length === 0) return {};
    const precision: DatePrecision = config.precision === 'day' || config.precision === 'month' ? config.precision : 'year';
    return { answer: { answer: { form: 'date', values, precision, tolerance: Math.max(0, Math.round(num(config.tolerance, 0))) } } satisfies Draft };
  }
};

const ANSWER_ONE: Kind = {
  type: 'answer.one', label: 'Odpowiedź: jeden wybór', group: 'Odpowiedź',
  says: 'Uczący się wybiera jedną odpowiedź spośród poprawnej i dystraktorów, w losowej kolejności.',
  ports: () => ({ inputs: [port('expected', 'Poprawna'), port('distractors', 'Dystraktory', 'items', true)], outputs: answerPort }),
  run: ({ node, inputs, ctx }) => {
    const right = texts(itemsAt(inputs, 'expected'))[0];
    if (right === undefined) return {};
    const wrong = unique(texts(itemsAt(inputs, 'distractors'))).filter((t) => t.toLowerCase() !== right.toLowerCase());
    const options = shuffle([right, ...wrong], rngFor(ctx, node.id));
    return { answer: { answer: { form: 'one', options, correct: options.indexOf(right) } } satisfies Draft };
  }
};

const ANSWER_MANY: Kind = {
  type: 'answer.many', label: 'Odpowiedź: kilka wyborów', group: 'Odpowiedź',
  says: 'Uczący się zaznacza wszystkie poprawne spośród poprawnych i dystraktorów.',
  ports: () => ({ inputs: [port('expected', 'Poprawne', 'items', true), port('distractors', 'Dystraktory', 'items', true)], outputs: answerPort }),
  run: ({ node, inputs, ctx }) => {
    const right = unique(texts(itemsAt(inputs, 'expected')));
    if (right.length === 0) return {};
    const lower = new Set(right.map((r) => r.toLowerCase()));
    const wrong = unique(texts(itemsAt(inputs, 'distractors'))).filter((t) => !lower.has(t.toLowerCase()));
    const options = shuffle([...right, ...wrong], rngFor(ctx, node.id));
    const correct = options.map((o, i) => (lower.has(o.toLowerCase()) ? i : -1)).filter((i) => i >= 0);
    return { answer: { answer: { form: 'many', options, correct } } satisfies Draft };
  }
};

function truth(item: Item | undefined): boolean | null {
  if (item === undefined) return null;
  if (typeof item.value === 'boolean') return item.value;
  const t = item.text.trim().toLowerCase();
  if (['tak', 'prawda', 'true', 'yes'].includes(t)) return true;
  if (['nie', 'fałsz', 'false', 'no'].includes(t)) return false;
  return null;
}

const ANSWER_TRUEFALSE: Kind = {
  type: 'answer.truefalse', label: 'Odpowiedź: prawda albo fałsz', group: 'Odpowiedź',
  says: 'Uczący się mówi „prawda" albo „fałsz"; wartość przychodzi np. z porównania.',
  ports: () => ({ inputs: [port('expected', 'Prawda / fałsz')], outputs: answerPort }),
  run: ({ inputs }) => {
    const value = truth(itemsAt(inputs, 'expected')[0]);
    return value === null ? {} : { answer: { answer: { form: 'truefalse', value } } satisfies Draft };
  }
};

const ANSWER_ORDER: Kind = {
  type: 'answer.order', label: 'Odpowiedź: kolejność', group: 'Odpowiedź',
  says: 'Uczący się układa pozycje w kolejności — tej, w której przychodzą.',
  ports: () => ({ inputs: [port('items', 'W dobrej kolejności', 'items', true)], outputs: answerPort }),
  run: ({ node, inputs, ctx }) => {
    const items = texts(itemsAt(inputs, 'items'));
    if (items.length < 2) return {};
    return { answer: { answer: { form: 'order', items, shown: shuffle(items, rngFor(ctx, node.id)) } } satisfies Draft };
  }
};

const ANSWER_MATCH: Kind = {
  type: 'answer.match', label: 'Odpowiedź: dopasowanie par', group: 'Odpowiedź',
  says: 'Uczący się łączy w pary: pozycje z lewej z pozycjami z prawej (te same miejsca na listach tworzą parę).',
  ports: () => ({ inputs: [port('left', 'Lewa strona', 'items', true), port('right', 'Prawa strona', 'items', true)], outputs: answerPort }),
  run: ({ node, inputs, ctx }) => {
    const left = texts(itemsAt(inputs, 'left'));
    const right = texts(itemsAt(inputs, 'right'));
    const n = Math.min(left.length, right.length);
    if (n < 2) return {};
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rngFor(ctx, node.id));
    const shownRight = order.map((i) => right[i]);
    const pairs = Array.from({ length: n }, (_, i): [number, number] => [i, order.indexOf(i)]);
    return { answer: { answer: { form: 'match', left: left.slice(0, n), right: shownRight, pairs } } satisfies Draft };
  }
};

const ANSWER_FLASH: Kind = {
  type: 'answer.flash', label: 'Odpowiedź: fiszka', group: 'Odpowiedź',
  says: 'Uczący się odwraca kartę i sam ocenia: umiałem, częściowo, nie umiałem.',
  ports: () => ({ inputs: [port('back', 'Druga strona', 'items', true)], outputs: answerPort }),
  run: ({ inputs }) => {
    const back = texts(itemsAt(inputs, 'back'));
    return back.length === 0 ? {} : { answer: { answer: { form: 'flash', back } } satisfies Draft };
  }
};

const ANSWER_CODE: Kind = {
  type: 'answer.code', label: 'Odpowiedź: kod (Python)', group: 'Odpowiedź',
  says: 'Uczący się pisze funkcję w Pythonie; sprawdza ją Pyodide w przeglądarce na losowych przypadkach.',
  ports: () => ({ inputs: [], outputs: answerPort }),
  run: ({ config }) => ({
    answer: {
      answer: {
        form: 'code',
        task: str(config.task),
        starter: str(config.starter) || 'def transform(x):\n    return x',
        createInput: str(config.createInput) || 'def create_input(seed):\n    return seed',
        reference: str(config.reference) || 'def reference(x):\n    return x',
        cases: Math.max(1, Math.min(200, Math.round(num(config.cases, 5))))
      }
    } satisfies Draft
  })
};

const ANSWER_POINT: Kind = {
  type: 'answer.point', label: 'Odpowiedź: punkt', group: 'Odpowiedź',
  says: 'Uczący się wskazuje miejsce na mapie (z pola „miejsce") albo punkt na obrazie.',
  ports: () => ({ inputs: [port('expected', 'Miejsce')], outputs: answerPort }),
  run: ({ config, inputs }) => {
    if (config.on === 'image') {
      const x = num(config.x, Number.NaN);
      const y = num(config.y, Number.NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return {};
      return { answer: { answer: { form: 'point', on: 'image', target: { x, y, r: Math.max(0.005, num(config.r, 0.05)) } } } satisfies Draft };
    }
    const place = itemsAt(inputs, 'expected').find((i) => isObject(i.value) && typeof i.value.lat === 'number');
    if (place === undefined) return {};
    const geo = place.value as GeoPoint;
    return { answer: { answer: { form: 'point', on: 'map', target: { lat: geo.lat, lon: geo.lon, r: Math.max(1, num(config.r, 1000)) } } } satisfies Draft };
  }
};

const CARD: Kind = {
  type: 'card', label: 'Karta', group: 'Karta',
  says: 'Składa kartę: pytanie, odpowiedź i (po odpowiedzi) wyjaśnienie z połączonych wpisów.',
  ports: () => ({ inputs: [port('prompt', 'Pytanie', 'prompt'), port('answer', 'Odpowiedź', 'answer'), port('explain', 'Wyjaśnienie', 'items', true)], outputs: [port('card', 'Karta', 'card')] }),
  run: ({ inputs }) => ({
    card: {
      prompt: (inputs.prompt ?? [])[0] ?? [],
      draft: (inputs.answer ?? [])[0],
      explain: itemsAt(inputs, 'explain').map((i) => i.entity).filter((e): e is string => e !== undefined)
    }
  })
};

/** Die Bausteine einer Kartenvorlage — die Palette, die der Editor zeigt [D2, D3]. */
export const TEMPLATE_PALETTE = paletteOf<TemplateContext>('card-template', [
  FIELD, MEDIA, FOLLOW, LIST, SELF,
  PATTERN, MASK, FRAGMENTS,
  PICK, DISTRACTORS, EACH,
  RANDOM, MATH, COMPARE, WHEN, PYTHON,
  PROMPT, ANSWER_TEXT, ANSWER_GAP, ANSWER_NUMBER, ANSWER_DATE, ANSWER_ONE, ANSWER_MANY, ANSWER_TRUEFALSE, ANSWER_ORDER, ANSWER_MATCH, ANSWER_FLASH, ANSWER_CODE, ANSWER_POINT,
  CARD
]);

/** Bausteine, deren Ergebnis bei jedem Lauf anders ausfallen darf. */
const CHANCE = new Set(['random']);

/** Was eine Vorlage TUT — ohne die Plätze im Bild: wer einen Knoten verschiebt, ändert keine Frage. */
const definitionOf = (graph: Graph) => ({
  nodes: graph.nodes.map((n) => ({ id: n.id, type: n.type, config: n.config })),
  edges: graph.edges
});

/* -- Die Vorlage ------------------------------------------------------------------- */

export interface Template {
  readonly id: string;
  readonly name: string;
  /** Für welche Arten sie Karten macht [D8]. */
  readonly kinds: readonly string[];
  /** Die Richtung ihrer Karten, etwa „a→b" — Teil der Kennung (COGITA.md §7). */
  readonly direction: string;
  readonly graph: Graph;
}

export function readTemplate(id: string, raw: unknown): Template {
  const doc = isObject(raw) ? raw : {};
  return {
    id,
    name: str(doc.name).trim().slice(0, 120) || 'Szablon',
    kinds: lines(doc.kinds),
    direction: str(doc.direction).trim().slice(0, 40),
    graph: readGraph(doc.graph)
  };
}

/** Was eine Vorlage braucht, um Karten zu machen: genau eine Karte, höchstens eine Schleife. */
export function templateProblems(template: Template): string[] {
  const cards = template.graph.nodes.filter((n) => n.type === 'card').length;
  const loops = template.graph.nodes.filter((n) => n.type === 'each').length;
  const out: string[] = [];
  if (cards === 0) out.push('Szablon nie ma kroku „Karta".');
  if (cards > 1) out.push('Szablon ma więcej niż jeden krok „Karta".');
  if (loops > 1) out.push('Szablon może mieć najwyżej jedną pętlę „Dla każdej wartości".');
  return out;
}

export interface Made {
  readonly cards: Card[];
  /** Warum für diesen Eintrag (teilweise) keine Karte entstand. */
  readonly problems: string[];
}

/**
 * DIE KARTEN EINES EINTRAGS AUS EINER VORLAGE. Ohne Schleife eine, mit
 * Schleife eine je Wert; keine, wo ein Warunek nicht erfüllt ist oder der
 * Antwort etwas fehlt (ein leeres Feld macht keine Frage).
 */
export async function cardsOf(template: Template, ctx: TemplateContext): Promise<Made> {
  const problems = templateProblems(template);
  if (problems.length > 0) return { cards: [], problems };
  const graph = template.graph;
  const cardNode = graph.nodes.find((n) => n.type === 'card')!;
  const loop = graph.nodes.find((n) => n.type === 'each');
  const varies = [...ancestors(graph, cardNode.id)].some((id) => {
    const node = graph.nodes.find((n) => n.id === id);
    return node !== undefined && (CHANCE.has(node.type) || (node.type === 'pick' && node.config.position !== 'first' && node.config.position !== 'last') || (node.type === 'mask' && node.config.mode === 'random'));
  });

  type Run = { readonly variant?: string; readonly item?: Item; readonly requires?: readonly string[] };
  let runs: Run[] = [{}];
  if (loop !== undefined) {
    const before = ancestors(graph, loop.id);
    before.delete(loop.id);
    const probe = await evaluate(graph, TEMPLATE_PALETTE, ctx, { only: before });
    const items = graph.edges
      .filter((e) => e.to === loop.id && e.in === 'items')
      .flatMap((e) => {
        const produced = probe.outputs.get(e.from);
        const value = produced === undefined ? undefined : produced[e.out];
        return Array.isArray(value) ? (value as Item[]) : [];
      });
    const seen = new Map<string, number>();
    runs = items.map((item) => {
      const fragment = isObject(item.value) && isObject(item.value.fragment) ? (item.value.fragment as unknown as Fragment) : null;
      let variant = fragment ? fragment.id : hashOf(item.text);
      const n = seen.get(variant) ?? 0;
      seen.set(variant, n + 1);
      if (n > 0) variant = `${variant}.${n}`;
      return { variant, item, requires: fragment ? fragment.parts : [] };
    });
  }

  const cards: Card[] = [];
  for (const run of runs) {
    const fixed = loop !== undefined && run.item !== undefined ? new Map<string, RunOutput>([[loop.id, { item: [run.item] }]]) : undefined;
    const result = await evaluate(graph, TEMPLATE_PALETTE, { ...ctx, variant: run.variant }, { fixed });
    if (graph.nodes.some((n) => n.type === 'when' && result.outputs.get(n.id)?.pass === false)) continue;
    const error = result.errors.get(cardNode.id);
    if (error !== undefined) {
      const first = [...result.errors.entries()].find(([, text]) => text !== 'Poprzedni krok się nie udał.');
      problems.push(first ? first[1] : error);
      continue;
    }
    const made = result.outputs.get(cardNode.id)?.card as { prompt: PromptPart[]; draft?: Draft; explain: string[] } | undefined;
    if (made === undefined || made.draft === undefined) continue;
    const question = run.variant === undefined ? `${template.id}:${ctx.entity.id}` : `${template.id}:${ctx.entity.id}:${run.variant}`;
    const direction = template.direction;
    const prefix = `${template.id}:${ctx.entity.id}`;
    cards.push({
      question,
      direction,
      key: cardKey(question, direction),
      entity: ctx.entity.id,
      template: template.id,
      prompt: made.prompt,
      answer: made.draft.answer,
      explain: made.explain,
      fingerprint: hashOf(varies ? stable(definitionOf(graph)) : stable(expectedOf(made.draft.answer))),
      varies,
      requires: (run.requires ?? []).map((part) => cardKey(`${prefix}:${part}`, direction))
    });
  }
  return { cards, problems };
}

/** Die Vorlagen, die für einen Eintrag gelten — über alle seine Arten. */
export const templatesFor = (entity: Entity, templates: readonly Template[]): Template[] =>
  templates.filter((t) => t.kinds.some((k) => entity.kinds.includes(k)));

/* -- Von Hand geschriebene Fragen und das Thema als Frage ---------------------------- */

const FORMS: readonly AnswerForm[] = ['text', 'number', 'date', 'one', 'many', 'truefalse', 'order', 'match', 'gap', 'flash', 'code', 'point'];

/**
 * EINE VON HAND GESCHRIEBENE FRAGE (Systemart `question`, [C4, D1]). Ihre
 * Felder:
 *
 * <code>
 *   prompt      die Frage (Auszeichnung)          form        eine der zwölf Formen
 *   answers     die richtigen Antworten (Text, Zahl, Datum, Lücke; die erste ist die Vorlage)
 *   options     zur Wahl (one, many)              correct     die richtigen Stellen in options
 *   items       in richtiger Reihenfolge (order)  left/right  Paare (match), gleiche Stelle = Paar
 *   value       wahr oder falsch                  back        die Rückseite (flash)
 *   tolerance, relative, unit, precision, rule    wie streng
 *   explain     Wissen und Einträge zur Erklärung
 * </code>
 */
export function questionCard(entity: Entity, seed = ''): Card | null {
  const d = entity.data;
  const form = FORMS.find((f) => f === d.form) ?? 'text';
  const rng = rngOf(`${seed}:${entity.id}`);
  const answers = lines(d.answers);
  let answer: AnswerSpec | null = null;
  switch (form) {
    case 'text': answer = answers.length === 0 ? null : { form, accepted: answers, rule: readRule(d.rule, TEXT_RULE) }; break;
    case 'gap': answer = answers.length === 0 ? null : { form, shown: plainOf(str(d.prompt)), accepted: answers, rule: readRule(d.rule, GAP_RULE) }; break;
    case 'number': {
      const values = answers.map(readNumber).filter((n): n is number => n !== null);
      answer = values.length === 0 ? null : { form, values, tolerance: Math.max(0, num(d.tolerance, 0)), relative: d.relative === true, unit: str(d.unit) };
      break;
    }
    case 'date': {
      const values = answers.map(readDateAnswer).filter((x): x is NonNullable<typeof x> => x !== null).map(dateKey);
      const precision: DatePrecision = d.precision === 'day' || d.precision === 'month' ? d.precision : 'year';
      answer = values.length === 0 ? null : { form, values, precision, tolerance: Math.max(0, Math.round(num(d.tolerance, 0))) };
      break;
    }
    case 'one':
    case 'many': {
      const options = lines(d.options);
      const correct = (Array.isArray(d.correct) ? d.correct : [d.correct]).filter((i): i is number => typeof i === 'number' && i >= 0 && i < options.length);
      if (options.length < 2 || correct.length === 0) break;
      const order = shuffle(options.map((_o, i) => i), rng);
      const shown = order.map((i) => options[i]);
      answer = form === 'one'
        ? { form, options: shown, correct: order.indexOf(correct[0]) }
        : { form, options: shown, correct: correct.map((c) => order.indexOf(c)).sort((a, b) => a - b) };
      break;
    }
    case 'truefalse': answer = typeof d.value === 'boolean' ? { form, value: d.value } : null; break;
    case 'order': {
      const items = lines(d.items);
      answer = items.length < 2 ? null : { form, items, shown: shuffle(items, rng) };
      break;
    }
    case 'match': {
      const left = lines(d.left);
      const right = lines(d.right);
      const n = Math.min(left.length, right.length);
      if (n < 2) break;
      const order = shuffle(Array.from({ length: n }, (_, i) => i), rng);
      answer = { form, left: left.slice(0, n), right: order.map((i) => right[i]), pairs: Array.from({ length: n }, (_, i): [number, number] => [i, order.indexOf(i)]) };
      break;
    }
    case 'flash': {
      const back = lines(d.back).length > 0 ? lines(d.back) : answers;
      answer = back.length === 0 ? null : { form, back };
      break;
    }
    case 'code': answer = { form, task: str(d.task), starter: str(d.starter), createInput: str(d.createInput), reference: str(d.reference), cases: Math.max(1, Math.round(num(d.cases, 5))) }; break;
    case 'point': {
      const geo = isObject(d.place) ? d.place : null;
      const lat = geo === null ? null : readNumber(geo.lat);
      const lon = geo === null ? null : readNumber(geo.lon);
      answer = lat === null || lon === null ? null : { form, on: 'map', target: { lat, lon, r: Math.max(1, num(d.radius, 1000)) } };
      break;
    }
  }
  if (answer === null) return null;
  const prompt = plainOf(str(d.prompt));
  return {
    question: entity.id,
    direction: '',
    key: cardKey(entity.id, ''),
    entity: entity.id,
    prompt: form === 'gap' || prompt === '' ? [] : [{ text: prompt }],
    answer,
    explain: lines(d.explain),
    fingerprint: hashOf(stable(expectedOf(answer))),
    varies: false,
    requires: []
  };
}

/**
 * DAS THEMA ALS FRAGE [C4]: sein Text vorn, das Wissen, das es beantwortet,
 * auf der Rückseite — selbst bewertet.
 */
export function topicCard(topic: Entity, look: Lookup): Card | null {
  const field = fieldsOf(topic, look).find((f) => f.key === 'answers');
  const back = field === undefined ? [] : valuesOf(topic, field)
    .map((v) => (typeof v.value === 'string' ? look.entity(v.value) : undefined))
    .filter((e): e is Entity => e !== undefined)
    .map((e) => labelOf(e, look));
  if (back.length === 0) return null;
  const text = labelOf(topic, look);
  const answer: AnswerSpec = { form: 'flash', back };
  return {
    question: topic.id,
    direction: 'topic',
    key: cardKey(topic.id, 'topic'),
    entity: topic.id,
    prompt: [{ text }],
    answer,
    explain: [],
    fingerprint: hashOf(stable(expectedOf(answer))),
    varies: false,
    requires: []
  };
}
