/**
 * 2026-11-03 — DER EINE GENERATOR für Aufgaben, die bei jedem Zeigen neu entstehen (COGITA-WORLD.md, Aufgabe 1).
 *
 * Dieselbe Beschreibung für eine von Hand geschriebene Frage (`params`, `let`, `require` am Pytanie) und für einen
 * Szablon (Knoten „Generator", `generate`, mit derselben Einstellung). Gerechnet wird in der Sprache der Rysunki
 * (`pages/motion/expr.ts`) mit Listen und Datensätzen.
 *
 * <code>
 *   "params": [
 *     {"name": "s", "random": [20, 500], "step": 10},                          eine Zahl aus einem Bereich
 *     {"name": "f", "values": ["sin", "cos"]},                                  eine von diesen
 *     {"name": "kation", "entry": {"kind": "@chem/jon", "where": "it.ladunek > 0"}},          ein Eintrag (Datensatz)
 *     {"name": "anion", "entry": {"kind": "@chem/jon", "where": "it.ladunek < 0"}},           — nie derselbe wie vorher
 *     {"name": "zd", "entries": {"kind": "@hist/zdarzenie", "count": 4, "rule": {…}}}         mehrere verschiedene
 *   ],
 *   "let":     [{"name": "n", "value": "lcm(kation.ladunek, -anion.ladunek)"}]
 *   "require": ["len(zd) == 4"]                       neu gezogen, bis alles gilt — höchstens 60-mal, sonst keine Karte
 * </code>
 *
 * <b>Einträge</b>: `kind` nennt die Art (Kennung, `@bleibender/name` oder Name), `rule` filtert wie ein Zbiór (die Regel
 * der Auswahl), `where` ist ein Ausdruck mit `it` (dem Kandidaten) — er darf frühere Werte lesen (der Anion, der zum
 * Kation passt). Ein Eintrag wird in einer Aufgabe nur einmal gezogen (`repeat: true` erlaubt es). Ein Datensatz hat
 * `id`, `label`, `kind` und je Feld seinen Wert: Zahlen (eine Grösse in der Einheit des Feldes, `_si` in SI, `_unit`),
 * Text, Wahl (`_label`), ja/nein als 1/0, Daten als Zahl `rrrrmmdd` (`_text` in Worten), Verweise als Datensatz eine
 * Stufe tief (darunter nur ihr Name).
 *
 * <b>Derselbe Same, dieselbe Aufgabe</b>: gezogen wird mit dem Zufall, den der Aufrufer gibt (`rngOf(same)`), auch
 * `shuffle`/`choose`/`pick` in `let`. Die Antwort nimmt die Werte mit (`storedValues`: Zahlen, Texte, Einträge als
 * `@kennung`, kurze Listen) und den Samen.
 *
 * Rein, ohne Oberfläche — geprüft in `app-generator-check` (und `app-lemma-check` für das Alte).
 */

import { compile, isExprError, isList, isRecord, makeRecord, newEnv, recordId, takeOverrun, truth, valueText, withRng, type Env, type Expr, type Val, type ValRecord } from '../pages/motion/expr';
import { texPieces, texSource } from '../core/tex';
import { appLang, tIn } from '../core/i18n';
import { dateOrdinal, dateText, fieldsOf, fieldUnit, labelOf, plainOf, readDate, valuesOf, type Entity, type Lookup, type Value } from './schema';
import { readRule, ruleMatches, type RuleGroup } from './selection';

/* -- Die Beschreibung ----------------------------------------------------------------------------------------- */

export interface EntryDraw {
  /** Die Art: Kennung, `@bleibender/name` oder ihr Name. */
  readonly kind: string;
  readonly rule: RuleGroup | null;
  /** Ein Ausdruck mit `it` — leer: jeder Eintrag der Art. */
  readonly where: string;
  /** Bei `entries`: so viele verschiedene, zufällig — `null`: alle passenden, in ihrer Reihenfolge. */
  readonly count: number | null;
  /** Darf ein Eintrag, der in dieser Aufgabe schon gezogen ist, noch einmal kommen? */
  readonly repeat: boolean;
}

export interface ParamSpec {
  readonly name: string;
  /** Gezogen aus [von, bis] mit `step` (ganze Grenzen: 1) — oder aus `values` — oder Einträge. */
  readonly random?: readonly [number, number];
  readonly step?: number;
  readonly values?: readonly Val[];
  readonly entry?: EntryDraw;
  readonly entries?: EntryDraw;
}

export interface LetSpec {
  readonly name: string;
  readonly value: string;
}

export interface ParamsSpec {
  readonly params: readonly ParamSpec[];
  readonly lets: readonly LetSpec[];
  readonly require: readonly string[];
  /** Nur im Szablon: Texte mit Platzhaltern, je einer ein Ausgang („Pytanie: Ile to {a} + {b}?"). */
  readonly texts: readonly LetSpec[];
}

/** Wie oft neu gezogen wird, bis `require` gilt. */
export const PARAM_TRIES = 60;

const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;
/** Namen, die die Aufgabe selbst setzt. */
const RESERVED = new Set(['it', 'i', 'this']);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const finite = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Ein JSON-Feld, auch als Text gekommen. */
const jsonList = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    try { const v = JSON.parse(raw) as unknown; return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
};

/** Ein Wert aus `values`: Zahl, Text — oder eine kurze Liste von ihnen. */
function readValue(v: unknown): Val | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const items = v.slice(0, 50).filter((x): x is number | string => (typeof x === 'number' && Number.isFinite(x)) || typeof x === 'string');
    return items;
  }
  return null;
}

function readDraw(raw: unknown): EntryDraw | null {
  if (typeof raw === 'string' && raw.trim() !== '') return { kind: raw.trim(), rule: null, where: '', count: null, repeat: false };
  if (!isObject(raw)) return null;
  const kind = str(raw.kind).trim();
  if (kind === '') return null;
  const rule = readRule(raw.rule);
  const count = finite(raw.count);
  return {
    kind,
    rule: rule !== null && rule.items.length > 0 ? rule : null,
    where: str(raw.where).trim().slice(0, 1200),
    count: count === null ? null : Math.max(1, Math.min(200, Math.round(count))),
    repeat: raw.repeat === true
  };
}

/** `params`, `let`, `require` (und im Szablon `texts`) — `null`: nichts, was gezogen oder gerechnet würde. */
export function readParamsSpec(d: Readonly<Record<string, unknown>>): ParamsSpec | null {
  const params: ParamSpec[] = [];
  const taken = new Set<string>();
  for (const one of jsonList(d.params).slice(0, 24)) {
    if (!isObject(one) || typeof one.name !== 'string' || !NAME.test(one.name.trim())) continue;
    const name = one.name.trim();
    if (taken.has(name) || RESERVED.has(name)) continue;
    const entry = one.entry === undefined ? null : readDraw(one.entry);
    const entries = one.entries === undefined ? null : readDraw(one.entries);
    const values = Array.isArray(one.values) ? one.values.map(readValue).filter((x): x is Val => x !== null).slice(0, 200) : [];
    const lo = Array.isArray(one.random) ? finite(one.random[0]) : null;
    const hi = Array.isArray(one.random) ? finite(one.random[1]) : null;
    const step = finite(one.step);
    if (entry !== null) params.push({ name, entry });
    else if (entries !== null) params.push({ name, entries });
    else if (values.length > 0) params.push({ name, values });
    else if (lo !== null && hi !== null) params.push({ name, random: [Math.min(lo, hi), Math.max(lo, hi)], ...(step !== null && step > 0 ? { step } : {}) });
    else continue;
    taken.add(name);
  }
  const named = (list: unknown): LetSpec[] => {
    const out: LetSpec[] = [];
    for (const one of jsonList(list).slice(0, 24)) {
      if (!isObject(one) || typeof one.name !== 'string' || !NAME.test(one.name.trim())) continue;
      const value = typeof one.value === 'string' ? one.value : typeof one.value === 'number' ? String(one.value) : '';
      if (value.trim() === '' || RESERVED.has(one.name.trim())) continue;
      out.push({ name: one.name.trim(), value: value.trim() });
    }
    return out;
  };
  const lets = named(d.let);
  const texts = named(d.texts);
  const require = (Array.isArray(d.require) ? d.require : typeof d.require === 'string' ? jsonList(d.require).length > 0 ? jsonList(d.require) : d.require.split('\n') : [])
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, 16);
  return params.length === 0 && lets.length === 0 && texts.length === 0 ? null : { params, lets, require, texts };
}

/** Zieht diese Aufgabe Einträge aus der Baza? (Dann braucht sie die Baza — ohne sie entsteht keine Karte.) */
export const drawsEntries = (spec: ParamsSpec): boolean => spec.params.some((p) => p.entry !== undefined || p.entries !== undefined);

/* -- Die Welt, aus der gezogen wird ----------------------------------------------------------------------------- */

/** Woraus Einträge gezogen werden — eine Baza (oder ein Speicher wie sie); ohne sie gehen nur Zahlen und Listen. */
export interface GenWorld {
  readonly look: Lookup;
  /** Die Einträge einer Art. */
  readonly pool: (kind: string) => readonly Entity[];
  /** Eine Art aus dem, was dasteht: Kennung, `@bleibender/name`, Name. */
  readonly kindOf?: (ref: string) => string | undefined;
  /** Der Eintrag der Karte eines Szablon — in Ausdrücken `this`. */
  readonly self?: Entity;
}

function kindIn(world: GenWorld, ref: string): string | undefined {
  const bare = ref.trim().replace(/^@/, '');
  if (world.look.kind(bare) !== undefined) return bare;
  return world.kindOf?.(ref.trim()) ?? world.kindOf?.(bare);
}

/* -- Datensätze aus Einträgen ------------------------------------------------------------------------------------ */

const RECORDS = new WeakMap<Lookup, WeakMap<Entity, ValRecord>>();

/** Was ein Wert eines Feldes im Datensatz ist — und was daneben steht (`_si`, `_text` …). */
function fieldValue(field: ReturnType<typeof fieldsOf>[number], v: Value, look: Lookup, depth: number): { value: Val; extra?: Readonly<Record<string, Val>> } | null {
  const raw = v.value;
  if (raw === null) return null;
  switch (field.type) {
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
      const unit = fieldUnit(field)?.symbol ?? field.unit ?? '';
      return { value: raw, extra: { ...(v.si === undefined ? {} : { si: v.si }), ...(unit === '' ? {} : { unit }) } };
    }
    case 'line':
    case 'text':
    case 'url':
      return typeof raw === 'string' && raw.trim() !== '' ? { value: raw.trim() } : null;
    case 'markup':
      return typeof raw === 'string' && raw.trim() !== '' ? { value: plainOf(raw) } : null;
    case 'choice': {
      if (typeof raw !== 'string' || raw === '') return null;
      const label = field.options?.find((o) => o.value === raw)?.label;
      return { value: raw, ...(label === undefined || label === raw ? {} : { extra: { label } }) };
    }
    case 'bool':
      return raw === true ? { value: 1 } : raw === false ? { value: 0 } : null;
    case 'date': {
      const date = readDate(raw);
      return date === null ? null : { value: dateOrdinal(date), extra: { text: dateText(date) } };
    }
    case 'ref': {
      if (typeof raw !== 'string' || raw === '') return null;
      const target = look.entity(raw);
      if (depth > 0) return target === undefined ? { value: makeRecord({ id: raw, label: raw }) } : { value: recordOf(target, look, depth - 1) };
      return { value: target === undefined ? raw : labelOf(target, look) };
    }
    case 'list':
      return Array.isArray(raw) ? { value: raw.filter((x): x is string => typeof x === 'string').slice(0, 200) } : null;
    default:
      return null;
  }
}

/**
 * EIN EINTRAG ALS DATENSATZ: `id`, `label`, `kind` (der Name seiner ersten Art) und je Feld der Wert — `depth` sagt,
 * wie weit Verweise als Datensatz kommen (1: die Ziele mit ihren Feldern, deren Verweise nur mit Namen).
 */
export function recordOf(entity: Entity, look: Lookup, depth = 1): ValRecord {
  if (depth === 1) {
    const hit = RECORDS.get(look)?.get(entity);
    if (hit !== undefined) return hit;
  }
  const out: Record<string, Val> = {
    id: entity.id,
    label: labelOf(entity, look),
    kind: look.kind(entity.kinds[0] ?? '')?.name ?? entity.kinds[0] ?? ''
  };
  for (const field of fieldsOf(entity, look)) {
    const read = valuesOf(entity, field).map((v) => fieldValue(field, v, look, depth)).filter((x): x is NonNullable<typeof x> => x !== null);
    if (read.length === 0) continue;
    if (field.multi) {
      out[field.key] = read.map((r) => r.value);
      for (const key of new Set(read.flatMap((r) => Object.keys(r.extra ?? {})))) out[`${field.key}_${key}`] = read.map((r) => r.extra?.[key] ?? '');
    } else {
      out[field.key] = read[0]!.value;
      for (const [key, value] of Object.entries(read[0]!.extra ?? {})) out[`${field.key}_${key}`] = value;
    }
  }
  const made = makeRecord(out);
  if (depth === 1) {
    let byEntity = RECORDS.get(look);
    if (byEntity === undefined) { byEntity = new WeakMap(); RECORDS.set(look, byEntity); }
    byEntity.set(entity, made);
  }
  return made;
}

/* -- Ziehen --------------------------------------------------------------------------------------------------- */

export interface Instance {
  /** Alle Werte: die gezogenen und die gerechneten (und `texts`). */
  readonly values: Record<string, Val>;
  /** Die gezogenen Einträge, in der Reihenfolge des Ziehens. */
  readonly picked: readonly string[];
  /** Wie viele Züge es brauchte (1: der erste galt). */
  readonly tries: number;
  readonly held: boolean;
  /** Warum keine Aufgabe zustande kam — für den Autor. */
  readonly problem: string | null;
}

/** Wie gross ein Schritt ist, wenn keiner gesagt ist: ganze Grenzen — 1, sonst ein Hundertstel des Bereichs. */
const stepOf = (p: ParamSpec): number => {
  if (p.step !== undefined) return p.step;
  const [lo, hi] = p.random ?? [0, 0];
  return Number.isInteger(lo) && Number.isInteger(hi) ? 1 : Math.max(1e-9, (hi - lo) / 100);
};

function drawNumber(p: ParamSpec, rng: () => number): Val {
  if (p.values !== undefined && p.values.length > 0) return p.values[Math.floor(rng() * p.values.length)]!;
  const [lo, hi] = p.random ?? [0, 0];
  const step = stepOf(p);
  const steps = Math.floor((hi - lo) / step + 1e-9);
  return Number((lo + Math.floor(rng() * (steps + 1)) * step).toPrecision(12));
}

/** Höchstens `k` verschiedene, zufällig. */
function sample<T>(list: readonly T[], k: number, rng: () => number): T[] {
  const idx = list.map((_x, i) => i);
  const n = Math.min(k, idx.length);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(rng() * (idx.length - i));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, n).map((i) => list[i]!);
}

/** Übersetzt — mit den Schreibweisen des Generators; `null` und der Fehler, wenn es nicht geht. */
function compiled(source: string, names: ReadonlySet<string>): Expr | string {
  const e = compile(source, { known: (name) => names.has(name), lists: true });
  return isExprError(e) ? e.error : e;
}

/** Was in einer Beschreibung nicht übersetzt — für den Editor, die Vorschau des Imports und den Autor. */
export function specErrors(spec: ParamsSpec): string[] {
  const out: string[] = [];
  const names = new Set<string>(['this']);
  for (const p of spec.params) {
    const draw = p.entry ?? p.entries;
    if (draw !== undefined && draw.where !== '') {
      const e = compiled(draw.where, new Set([...names, 'it']));
      if (typeof e === 'string') out.push(`„${p.name}”, warunek „${draw.where}”: ${e}.`);
    }
    names.add(p.name);
  }
  for (const l of spec.lets) {
    const e = compiled(l.value, names);
    if (typeof e === 'string') out.push(`„${l.name} = ${l.value}”: ${e}.`);
    names.add(l.name);
  }
  for (const r of spec.require) {
    const e = compiled(r, names);
    if (typeof e === 'string') out.push(`Warunek „${r}”: ${e}.`);
  }
  return out;
}

/**
 * EINE AUFGABE ZIEHEN: die Parameter der Reihe nach (Einträge aus der Baza, die `where` erfüllen und noch nicht gezogen
 * sind), dann die `let` der Reihe nach — so oft, bis jede Bedingung von `require` gilt (höchstens `tries`-mal).
 */
export function drawInstance(spec: ParamsSpec, rng: () => number, world?: GenWorld, tries = PARAM_TRIES): Instance {
  const errors = specErrors(spec);
  if (errors.length > 0) return { values: {}, picked: [], tries: 0, held: false, problem: errors.join(' ') };
  /* Übersetzt einmal für alle Züge. */
  const names = new Set<string>(['this']);
  const wheres = new Map<string, { expr: Expr; fixed: boolean }>();
  for (const p of spec.params) {
    const draw = p.entry ?? p.entries;
    if (draw !== undefined && draw.where !== '') {
      const e = compiled(draw.where, new Set([...names, 'it'])) as Expr;
      /* Liest er nur den Kandidaten (und `this`), gilt dieselbe Auswahl in jedem Zug. */
      wheres.set(p.name, { expr: e, fixed: e.reads.every((r) => r === 'it' || r === 'this') });
    }
    names.add(p.name);
  }
  const lets = spec.lets.map((l) => { const e = compiled(l.value, names) as Expr; names.add(l.name); return { name: l.name, expr: e }; });
  const requires = spec.require.map((r) => ({ source: r, expr: compiled(r, names) as Expr }));
  const self = world?.self === undefined ? undefined : recordOf(world.self, world.look);
  /* Was ein fester Filter durchlässt, je Parameter einmal gerechnet. */
  const fixedPools = new Map<string, readonly Entity[]>();

  let last: Instance = { values: {}, picked: [], tries: 0, held: false, problem: null };
  const total = Math.max(1, tries);
  for (let t = 1; t <= total; t += 1) {
    const env: Env = withRng(newEnv(), rng);
    if (self !== undefined) env.this = self;
    const picked: string[] = [];
    let problem: string | null = null;
    /* Ein Fehler, den kein neuer Zug behebt (keine Baza, keine solche Art). */
    let fatal = false;
    for (const p of spec.params) {
      const draw = p.entry ?? p.entries;
      if (draw === undefined) { env[p.name] = drawNumber(p, rng); continue; }
      if (world === undefined) { problem = `„${p.name}”: losuje wpisy z bazy wiedzy — tutaj bazy nie ma.`; fatal = true; break; }
      const kind = kindIn(world, draw.kind);
      if (kind === undefined) { problem = `„${p.name}”: nie ma rodzaju „${draw.kind}” w tej bazie wiedzy.`; fatal = true; break; }
      const where = wheres.get(p.name);
      let pool: readonly Entity[] | undefined = fixedPools.get(p.name);
      if (pool === undefined) {
        pool = world.pool(kind);
        if (draw.rule !== null) pool = pool.filter((e) => ruleMatches(e, world.look, draw.rule!));
        if (where !== undefined && where.fixed) {
          const base = env;
          pool = pool.filter((e) => { const child = Object.create(base) as Env; child.it = recordOf(e, world.look); return truth(where.expr.run(child)); });
        }
        if (where === undefined || where.fixed) fixedPools.set(p.name, pool);
      }
      let candidates = draw.repeat ? pool : pool.filter((e) => !picked.includes(e.id));
      if (where !== undefined && !where.fixed) {
        const base = env;
        candidates = candidates.filter((e) => { const child = Object.create(base) as Env; child.it = recordOf(e, world.look); return truth(where.expr.run(child)); });
      }
      if (p.entry !== undefined) {
        if (candidates.length === 0) { problem = draw.where === '' ? tIn(appLang(), 'cogitaLearnLogic.generator.noEntry', { name: p.name, kind: world.look.kind(kind)?.name ?? draw.kind }) : tIn(appLang(), 'cogitaLearnLogic.generator.noEntryWhere', { name: p.name, kind: world.look.kind(kind)?.name ?? draw.kind, where: draw.where }); break; }
        const one = candidates[Math.floor(rng() * candidates.length)]!;
        env[p.name] = recordOf(one, world.look);
        picked.push(one.id);
      } else {
        const want = draw.count;
        if (want !== null && candidates.length < want) { problem = tIn(appLang(), 'cogitaLearnLogic.generator.tooFew', { name: p.name, want, n: candidates.length }); break; }
        const list = want === null ? candidates : sample(candidates, want, rng);
        env[p.name] = list.map((e) => recordOf(e, world.look));
        picked.push(...list.map((e) => e.id));
      }
    }
    if (problem === null) {
      for (const l of lets) {
        env[l.name] = l.expr.run(env);
        if (takeOverrun()) { problem = tIn(appLang(), 'cogitaLearnLogic.generator.overrun', { name: l.name }); break; }
      }
    }
    const values: Record<string, Val> = {};
    for (const key of Object.keys(env)) values[key] = env[key]!;
    if (problem !== null) {
      last = { values, picked, tries: t, held: false, problem };
      /* Ein anderer Zug hilft, wenn das Ziehen vom Zufall abhing (was schon gezogen ist, frühere Werte) — sonst nicht. */
      if (fatal) break;
      continue;
    }
    const failing = requires.find((r) => !truth(r.expr.run(env)));
    if (failing === undefined) {
      /* 2026-11-03 — im Szablon: Texte mit den Werten dieser Aufgabe (je einer ein Ausgang). */
      for (const tx of spec.texts) values[tx.name] = fillParams(tx.value, values);
      return { values, picked, tries: t, held: true, problem: null };
    }
    last = { values, picked, tries: t, held: false, problem: tIn(appLang(), 'cogitaLearnLogic.generator.unmet', { source: failing.source, total }) };
  }
  return last;
}

/** ZGODNIE ZE STARYM: ein Zug der Parameter — `values` und ob die Bedingungen galten (`tries`: wie viele Züge). */
export function drawParams(spec: ParamsSpec, rng: () => number, tries = PARAM_TRIES, world?: GenWorld): { readonly values: Record<string, Val>; readonly held: boolean; readonly tries: number; readonly problem: string | null; readonly picked: readonly string[] } {
  const made = drawInstance(spec, rng, world, tries);
  return { values: made.values, held: made.held || (spec.require.length === 0 && made.problem === null), tries: made.tries, problem: made.problem, picked: made.picked };
}

/** Was in einer Beschreibung nicht stimmt — für den Editor (leer: alles gut). Mit Proben: auch, wenn das Ziehen nicht gelingt. */
export function paramsProblems(spec: ParamsSpec, rng: () => number = Math.random, world?: GenWorld): string[] {
  const out = specErrors(spec);
  if (out.length > 0) return out;
  if (drawsEntries(spec) && world === undefined) return [];
  const made = drawInstance(spec, rng, world);
  if (!made.held && made.problem !== null) out.push(made.problem);
  return out;
}

/** Proben einer Beschreibung: `n` Aufgaben mit festen Samen — wie viele gelangen, und wie oft im Schnitt gezogen wurde. */
export function sampleInstances(spec: ParamsSpec, seeds: readonly string[], rngOf: (seed: string) => () => number, world?: GenWorld): { readonly list: readonly (Instance & { readonly seed: string })[]; readonly held: number; readonly tries: number } {
  const list = seeds.map((seed) => ({ ...drawInstance(spec, rngOf(seed), world), seed }));
  const held = list.filter((x) => x.held).length;
  const tries = list.reduce((s, x) => s + Math.max(1, x.tries), 0) / Math.max(1, list.length);
  return { list, held, tries };
}

/* -- Was mit der Antwort geht -------------------------------------------------------------------------------- */

export type Stored = number | string | readonly (number | string)[];

const clip = (text: string, n: number): string => (text.length <= n ? text : `${text.slice(0, n - 1)}…`); // i18n-ignore

/** Ein Wert, wie ihn die Antwort mitnimmt: Zahlen, Texte (gekürzt), Einträge als `@kennung`, kurze Listen davon. */
export function storedValue(v: Val): Stored | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toPrecision(12)) : undefined;
  if (typeof v === 'string') return clip(v, 80);
  if (isRecord(v)) return `@${recordId(v)}`;
  return v.slice(0, 12).map((x) => (typeof x === 'number' ? (Number.isFinite(x) ? Number(x.toPrecision(12)) : 0) : isRecord(x) ? `@${recordId(x)}` : clip(typeof x === 'string' ? x : valueText(x), 40)));
}

/** DIE WERTE EINER AUFGABE FÜR DIE ANTWORT — zuerst die gezogenen, dann die gerechneten; höchstens 24. */
export function storedValues(spec: ParamsSpec, values: Readonly<Record<string, Val>>): Record<string, Stored> {
  const out: Record<string, Stored> = {};
  for (const name of [...spec.params.map((p) => p.name), ...spec.lets.map((l) => l.name)]) {
    if (Object.keys(out).length >= 24) break;
    const v = values[name];
    if (v === undefined) continue;
    const s = storedValue(v);
    if (s !== undefined) out[name] = s;
  }
  return out;
}

/* -- Wstawianie wartości ------------------------------------------------------------------------------------- */

/** Eine Zahl, wie sie im Text steht: mit Komma, einfachem Minus, ohne Rundungsreste; im Wzór das Komma als `{,}`. */
export function numberText(n: number, math = false): string {
  if (!Number.isFinite(n)) return math ? (n > 0 ? '\\infty' : n < 0 ? '-\\infty' : '?') : n > 0 ? '∞' : n < 0 ? '-∞' : '?';
  const r = Number(n.toPrecision(12));
  let s = String(r);
  if (/e/i.test(s)) s = r.toFixed(12).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', math ? '{,}' : ',');
}

/** Ein gerechneter Wert als Text — eine Zahl (siehe `numberText`), ein Text mit einfachem Minus, eine Liste mit Kommas, ein Eintrag mit seinem Namen. */
export function valText(v: Val, math = false): string {
  if (typeof v === 'number') return numberText(v, math);
  if (typeof v === 'string') {
    const plain = v.replace(/−/g, '-');
    return math ? plain.replace(/(\d),(\d)/g, '$1{,}$2') : plain;
  }
  if (isRecord(v)) return valText(valueText(v), math);
  return v.map((x) => valText(x, math)).join(', ');
}

/** `{…}` ohne Leerzeichen am Rand, nicht `\{`. */
const PLACE = /(?<!\\)\{([^{}\s](?:[^{}]*[^{}\s])?)\}/g;

/** Der Wert eines Platzhalters — `null`: kein Platzhalter (LaTeX, ein unbekannter Name, ein Fehler). */
function placeValue(inner: string, values: Readonly<Record<string, Val>>): Val | null {
  const known = (name: string) => Object.prototype.hasOwnProperty.call(values, name);
  const e = compile(inner, { known, lists: true });
  if (isExprError(e) || e.reads.length === 0) return null;
  const env: Env = Object.assign(newEnv(), values);
  return e.run(env);
}

function fillPiece(text: string, values: Readonly<Record<string, Val>>, math: boolean): string {
  if (!text.includes('{')) return text;
  let out = '';
  let from = 0;
  for (const m of text.matchAll(PLACE)) {
    const at = m.index ?? 0;
    out += text.slice(from, at);
    from = at + m[0].length;
    const v = placeValue(m[1]!, values);
    /*
     * 2026-11-03 — im Wzór, wo die Klammern ein Argument sind (`\frac{s}{t}`, `x^{n}`, `\sqrt{d}`), bleiben sie um den
     * Wert: sonst würde aus `\frac{250}{58}` ein `\frac25058`. Sonst (`{a}x {znak} {b}`) ohne — die Abstände bleiben.
     */
    out += v === null ? m[0] : math && ARGUMENT_BEFORE.test(out) ? `{${valText(v, math)}}` : valText(v, math);
  }
  return out + text.slice(from);
}
/** Dicht davor (im schon Gefüllten) ein Befehl (`\frac`, `\sqrt`), `^`, `_` oder ein voriges Argument (`}`, `]`); `\cdot {n}` nicht. */
const ARGUMENT_BEFORE = /(?:\\[A-Za-z]+|[\^_}\]])$/;

/** EIN TEXT MIT DEN GEZOGENEN WERTEN — in Wzory als Zahl für LaTeX, sonst als Zahl zum Lesen und Tippen. */
export function fillParams(text: string, values: Readonly<Record<string, Val>>): string {
  if (!text.includes('{')) return text;
  if (!text.includes('$')) return fillPiece(text, values, false);
  return texPieces(text).map((p) => (p.t === 'math' ? texSource(fillPiece(p.tex, values, true), p.display) : fillPiece(p.v, values, false).split('$').join('\\$'))).join('');
}

/** Die Schlüssel einer Frage, deren Texte Platzhalter tragen dürfen. 2026-11-03: auch `correct`, `value`, `tolerance`, `unit`. */
export const PARAM_KEYS = ['prompt', 'answers', 'options', 'items', 'left', 'right', 'leftLabel', 'rightLabel', 'back', 'hints', 'explanation', 'feedback', 'extra', 'alternatives', 'choices', 'task', 'correct', 'value', 'tolerance', 'unit'] as const;

/** Ein ganzer Platzhalter in einer Liste: `"{distraktory}"`. */
const WHOLE = /^\s*\{([^{}\s](?:[^{}]*[^{}\s])?)\}\s*$/;

/**
 * Alle Texte darin (auch in Listen von Listen) mit den Werten. 2026-11-03: steht in einer Liste ein ganzer Platzhalter,
 * dessen Wert eine Liste ist (`"options": ["{dobra}", "{zle}"]`), kommt an seine Stelle jedes ihrer Elemente.
 */
function fillDeep(v: unknown, values: Readonly<Record<string, Val>>): unknown {
  if (typeof v === 'string') return fillParams(v, values);
  if (Array.isArray(v)) {
    return v.flatMap((x) => {
      if (typeof x === 'string' && !x.includes('$')) {
        const whole = WHOLE.exec(x);
        const value = whole === null ? null : placeValue(whole[1]!, values);
        if (value !== null && isList(value)) return value.map((y) => valText(y));
      }
      return [fillDeep(x, values)];
    });
  }
  return v;
}

const TRUE_WORDS = new Set(['1', 'true', 'prawda', 'tak', 'yes']);
const FALSE_WORDS = new Set(['0', 'false', 'fałsz', 'falsz', 'nie', 'no', '']); // i18n-ignore
const numberOf = (x: unknown): unknown => {
  if (typeof x !== 'string') return x;
  const n = Number(x.trim().replace(',', '.').replace(/^-/, '-'));
  return x.trim() !== '' && Number.isFinite(n) ? n : x;
};

/** DIE FRAGE MIT DEN WERTEN DIESES VERSUCHS: jedes Feld aus `PARAM_KEYS` ausgefüllt, die anderen bleiben. */
export function withParams(d: Readonly<Record<string, unknown>>, values: Readonly<Record<string, Val>>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...d };
  for (const key of PARAM_KEYS) {
    const raw = d[key];
    if (raw === undefined) continue;
    /* „alternatives", „choices" dürfen als JSON-Text kommen. */
    const parsed = (key === 'alternatives' || key === 'choices') && typeof raw === 'string' ? (() => { try { return JSON.parse(raw) as unknown; } catch { return raw; } })() : raw;
    const filled = fillDeep(parsed, values);
    /* Gerechnete Zahlen und Wahrheiten: „correct": "{k}", „value": "{a.data < b.data}", „tolerance": "{tol}". */
    if (key === 'correct') out[key] = Array.isArray(filled) ? filled.map(numberOf) : typeof filled === 'string' ? [numberOf(filled)] : filled;
    else if (key === 'value' && typeof filled === 'string') {
      const word = filled.trim().toLowerCase();
      out[key] = TRUE_WORDS.has(word) ? true : FALSE_WORDS.has(word) ? false : filled;
    } else if (key === 'tolerance') out[key] = numberOf(filled);
    else out[key] = filled;
  }
  return out;
}
