/**
 * WAS EIN WIDOK UND EINE POWTÓRKA GEMEINSAM WÄHLEN (2026-10-22, Schritt 9).
 *
 * Bis hierher wählte jede Stelle auf ihre Art: die Powtórka mit Knoten über
 * Karten, „Wpisy" mit einer Art und einem Filter, die Seiten über Bündel.
 * Jetzt gibt es EINE Auswahl über Einträge — dieselben Schritte, dieselben
 * Einstellungen, dieselbe Rechnung —, die ein Widok der Reihe nach
 * durchläuft und die Powtórka als Knoten ihres Graphen trägt:
 *
 * <code>
 *   source.all          alles, was die Baza kennt (eigene Einträge und die ihrer Bazy-Quellen)
 *   source.kind         ein Rodzaj — auch einer der Bibliotheken, aus denen sie schöpft; `from`: nur aus einer
 *   source.collection   ein Zbiór (gespeicherter Filter oder Liste)
 *   source.topic        ein Temat mit Unterthemen — und allem, was auf sie zeigt
 *   source.list         genannte Einträge
 *   source.from         (Schritt 11) worauf ein Eintrag verweist: ein Kazanie — seine Cytaty, Komentarze,
 *                       Słowa, die Stellen seines Plans; eine Powtórka „z kazania"
 *   follow              weiter entlang eines Verweises: wohin sie zeigen (ein Feld oder alle) —
 *                       oder, rückwärts, wer auf sie zeigt (Felder und Zapis, auch in Bibliotheken)
 *   filter.rule         nur, was die Regel erfüllt (die Regel der Zbiory: Feld, Vergleich, Gruppen)
 * </code>
 *
 * <b>Quellen am Anfang zählen zusammen</b> (2026-10-22, Schritt 10): „Kazania"
 * und „Komentarze" in einem Widok sind zwei Quellen hintereinander; eine Quelle
 * nach einem anderen Schritt beginnt neu.
 *
 * Dazu, nur für Widoki: <b>Gruppen</b> (`groupsOf`) — nach Rodzaj, nach den
 * Werten eines Feldes oder nach einer Achse von Tematy (ein Temat-Aspekt, seine
 * Unterthemen sind die Werte). Ein Eintrag kann in mehreren Gruppen stehen.
 *
 * Die Regel der Zbiory (`RuleGroup`) steht jetzt hier; `store.ts` gibt sie
 * weiter, damit alte Importe gelten. Bedingungen über Menschen (`logic.ts`)
 * sind etwas anderes und bleiben dort.
 */

import { fieldKind, fieldsOf, fieldText, fieldUnit, labelOf, plainOf, valuesOf, type Entity, type FieldDef, type Lookup } from './schema';
import { convert, measures, parseQuantity } from '../core/quantities';

/**
 * 2026-10-23 (Schritt 13) — DIE ZAHL EINER REGEL in der Einheit des Feldes:
 * „> 1,5 kN" über einem Feld in N ist „> 1500"; eine Einheit einer anderen
 * Grösse vergleicht nichts. Ohne Einheit: die Zahl, wie sie dasteht.
 */
function ruleNumber(field: FieldDef | undefined, want: string): number | null {
  const read = parseQuantity(want);
  if (read === null) return null;
  if (read.unitText === '') return read.value;
  const kind = field === undefined ? undefined : fieldKind(field);
  const own = field === undefined ? undefined : fieldUnit(field);
  if (read.unit === undefined || kind === undefined || own === undefined || !measures(read.unit, kind)) return null;
  return convert(read.value, read.unit, own);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter((x) => x !== '') : typeof v === 'string' ? v.split('\n').map((x) => x.trim()).filter((x) => x !== '') : []);
const fold = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

/* -- Die Regel (aus den Zbiory) -------------------------------------------------------------- */

export type Compare = 'eq' | 'ne' | 'contains' | 'filled' | 'empty' | 'gt' | 'lt' | 'kind' | 'refers';

export const COMPARE_LABEL: Record<Compare, string> = {
  eq: 'równe', ne: 'różne od', contains: 'zawiera', filled: 'wypełnione', empty: 'puste',
  gt: 'większe niż / po', lt: 'mniejsze niż / przed', kind: 'jest rodzaju', refers: 'odwołuje się do'
};

export interface Condition {
  readonly field?: string;
  readonly cmp: Compare;
  readonly value?: string;
}

export interface RuleGroup {
  readonly op: 'and' | 'or';
  readonly items: readonly (Condition | RuleGroup)[];
}

const isGroup = (v: Condition | RuleGroup): v is RuleGroup => 'items' in v;

export function readRule(raw: unknown, depth = 0): RuleGroup | null {
  if (!isObject(raw) || depth > 6) return null;
  const items: (Condition | RuleGroup)[] = [];
  for (const one of Array.isArray(raw.items) ? raw.items : []) {
    if (!isObject(one)) continue;
    if (Array.isArray(one.items)) {
      const inner = readRule(one, depth + 1);
      if (inner !== null) items.push(inner);
      continue;
    }
    const cmp = str(one.cmp) as Compare;
    if (!(cmp in COMPARE_LABEL)) continue;
    items.push({ ...(str(one.field) !== '' ? { field: str(one.field) } : {}), cmp, ...(one.value !== undefined ? { value: str(one.value) } : {}) });
  }
  return { op: raw.op === 'or' ? 'or' : 'and', items };
}

/** Gilt eine Bedingung für diese Entität? Texte ohne Rücksicht auf Akzente; Zahlen und Daten als solche. */
export function matches(entity: Entity, look: Lookup, cond: Condition): boolean {
  if (cond.cmp === 'kind') return entity.kinds.includes(cond.value ?? '');
  if (cond.cmp === 'refers') {
    const target = cond.value ?? '';
    return fieldsOf(entity, look).some((f) => f.type === 'ref' && valuesOf(entity, f).some((v) => v.value === target));
  }
  const field = fieldsOf(entity, look).find((f) => f.key === cond.field);
  const values = field === undefined ? [] : valuesOf(entity, field).map((v) => v.value).filter((v) => v !== null);
  const texts = values.map((v) => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v)));
  const want = cond.value ?? '';
  switch (cond.cmp) {
    case 'filled': return values.length > 0;
    case 'empty': return values.length === 0;
    case 'eq':
    case 'ne': {
      /* Zahlen als Zahlen — auch mit Einheit (Schritt 13). */
      const n = field?.type === 'number' ? ruleNumber(field, want) : null;
      const same = (v: unknown, t: string) => (n !== null && typeof v === 'number' ? Math.abs(v - n) <= 1e-9 * Math.max(1, Math.abs(n)) : fold(t) === fold(want));
      return cond.cmp === 'eq' ? values.some((v, i) => same(v, texts[i])) : values.every((v, i) => !same(v, texts[i]));
    }
    case 'contains': return texts.some((t) => fold(plainOf(t)).includes(fold(want)));
    case 'gt':
    case 'lt': {
      const number = field?.type === 'number' ? ruleNumber(field, want) ?? Number.NaN : Number(want.replace(',', '.'));
      return values.some((v) => {
        if (typeof v === 'number' && Number.isFinite(number)) return cond.cmp === 'gt' ? v > number : v < number;
        if (typeof v === 'string') return cond.cmp === 'gt' ? v > want : v < want;
        return false;
      });
    }
    default: return false;
  }
}

export function ruleMatches(entity: Entity, look: Lookup, rule: RuleGroup): boolean {
  if (rule.items.length === 0) return true;
  const results = rule.items.map((one) => (isGroup(one) ? ruleMatches(entity, look, one) : matches(entity, look, one)));
  return rule.op === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/* -- Was eine Auswahl von der Baza braucht ------------------------------------------------------ */

export interface SelectContext {
  /** Was die Baza kennt und lehrt: ihre Einträge und die ihrer Bazy-Quellen. */
  readonly entities: () => readonly Entity[];
  /** Die Einträge einer Art — bei einer Art der Bibliotheken auch deren Einträge (Cytaty, Komentarze …). */
  readonly material: (kind: string) => readonly Entity[];
  /** Ein Eintrag — auch einer aus einer Bibliothek. */
  readonly entity: (id: string) => Entity | undefined;
  readonly look: Lookup;
  readonly collection: (id: string) => ReadonlySet<string> | undefined;
  /** Ein Thema und seine Unterthemen, mit allem, was auf sie zeigt. */
  readonly topic: (id: string, depth: number) => ReadonlySet<string>;
  /** Wer auf einen Eintrag zeigt — Felder und Zapis, in der Baza und im Stoff der Bibliotheken. */
  readonly pointing: (id: string) => ReadonlySet<string>;
  /** Woher ein Eintrag kommt (die Kennung seiner Bibliothek oder Baza). */
  readonly from?: (id: string) => string | undefined;
  /** 2026-10-22 (Schritt 11) — worauf ein Eintrag verweist (Felder, Zapis, Plan, Gegenstände), auch einer aus einer Bibliothek. */
  readonly refsOf?: (id: string) => readonly string[];
}

/* -- Die Schritte ------------------------------------------------------------------------------ */

export const SOURCE_TYPES = ['source.all', 'source.kind', 'source.collection', 'source.topic', 'source.list', 'source.from'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export type StepType = SourceType | 'follow' | 'filter.rule';

export interface Step {
  readonly type: StepType;
  readonly config: Readonly<Record<string, unknown>>;
}

/** Wie ein Schritt heisst und was er tut — derselbe Satz im Widok und am Knoten der Powtórka. */
export const STEP_WORDS: Readonly<Record<StepType, { readonly label: string; readonly says: string }>> = {
  'source.all': { label: 'Wszystko', says: 'Każdy wpis tej bazy wiedzy (i baz, z których korzysta).' },
  'source.kind': { label: 'Rodzaj', says: 'Wpisy jednego rodzaju — także z biblioteki, z której korzysta ta baza (np. cytaty, komentarze); „Skąd" zawęża do jednej biblioteki albo bazy.' },
  'source.collection': { label: 'Zbiór', says: 'Wpisy zapisanego zbioru — filtra albo listy.' },
  'source.topic': { label: 'Temat', says: 'Temat i jego podtematy do wybranej głębokości — z tym, co na nie wskazuje (pytania, komentarze, kazania).' },
  'source.list': { label: 'Lista', says: 'Wybrane wpisy (identyfikatory, jeden w wierszu).' },
  'source.from': { label: 'Z wpisu', says: 'To, na co wskazuje wybrany wpis — np. kazanie: jego cytaty, komentarze, słowa, miejsca z planu.' },
  follow: { label: 'Idź po odwołaniu', says: 'Od wybranych wpisów dalej: do tego, na co wskazują (jedno pole albo wszystkie) — albo wstecz: do tego, co wskazuje na nie.' },
  'filter.rule': { label: 'Filtr', says: 'Zostawia wpisy spełniające regułę: pole, porównanie, grupy warunków (I / LUB).' }
};

const STEP_TYPES: readonly StepType[] = [...SOURCE_TYPES, 'follow', 'filter.rule'];
export const isSource = (type: string): type is SourceType => (SOURCE_TYPES as readonly string[]).includes(type);

export function readSteps(raw: unknown): Step[] {
  const out: Step[] = [];
  for (const one of Array.isArray(raw) ? raw : []) {
    if (!isObject(one) || !(STEP_TYPES as readonly string[]).includes(str(one.type))) continue;
    out.push({ type: str(one.type) as StepType, config: isObject(one.config) ? one.config : {} });
    if (out.length >= 24) break;
  }
  return out;
}

/** Wohin ein Eintrag zeigt — über ein Feld (oder alle Verweisfelder). */
function targetsOf(entity: Entity, look: Lookup, field: string): string[] {
  const out: string[] = [];
  for (const f of fieldsOf(entity, look)) {
    if (f.type !== 'ref' || (field !== '' && f.key !== field)) continue;
    for (const v of valuesOf(entity, f)) if (typeof v.value === 'string' && v.value !== entity.id) out.push(v.value);
  }
  return out;
}

/**
 * EIN SCHRITT: eine Quelle beginnt neu (was hereinkommt, zählt nicht), `follow`
 * und `filter.rule` arbeiten an dem, was hereinkommt. Die Reihenfolge bleibt
 * die, in der die Einträge gefunden werden.
 */
export function pick(ctx: SelectContext, step: Step, input: ReadonlySet<string> | null): Set<string> {
  const c = step.config;
  switch (step.type) {
    case 'source.all': return new Set(ctx.entities().map((e) => e.id));
    case 'source.kind': {
      const from = str(c.from);
      return new Set(ctx.material(str(c.kind)).filter((e) => from === '' || ctx.from?.(e.id) === from).map((e) => e.id));
    }
    case 'source.collection': return new Set(ctx.collection(str(c.collection)) ?? []);
    case 'source.topic': {
      const depth = typeof c.depth === 'number' && Number.isFinite(c.depth) ? Math.max(0, Math.round(c.depth)) : 9;
      return str(c.topic) === '' ? new Set() : new Set(ctx.topic(str(c.topic), depth));
    }
    case 'source.list': return new Set(lines(c.ids));
    case 'source.from': return new Set(str(c.entry) === '' ? [] : ctx.refsOf?.(str(c.entry)) ?? []);
    case 'follow': {
      const out = new Set<string>();
      const field = str(c.field);
      for (const id of input ?? []) {
        if (c.back === true) {
          for (const from of ctx.pointing(id)) {
            const pointer = ctx.entity(from);
            if (field === '' || (pointer !== undefined && targetsOf(pointer, ctx.look, field).includes(id))) out.add(from);
          }
        } else {
          const entity = ctx.entity(id);
          if (entity !== undefined) for (const target of targetsOf(entity, ctx.look, field)) out.add(target);
        }
      }
      return out;
    }
    case 'filter.rule': {
      const rule = readRule(c.rule);
      if (rule === null || rule.items.length === 0) return new Set(input ?? []);
      return new Set([...(input ?? [])].filter((id) => { const e = ctx.entity(id); return e !== undefined && ruleMatches(e, ctx.look, rule); }));
    }
    default: return new Set(input ?? []);
  }
}

/**
 * Die Schritte der Reihe nach — ohne Quelle beginnt es bei allem. Quellen am
 * Anfang zählen zusammen (Kazania UND Komentarze); eine spätere beginnt neu.
 * Was keiner kennt, fällt weg (und wird genannt).
 */
export function runSteps(ctx: SelectContext, steps: readonly Step[]): { ids: string[]; problems: string[] } {
  const problems: string[] = [];
  let now: Set<string> | null = steps.length > 0 && isSource(steps[0].type) ? null : pick(ctx, { type: 'source.all', config: {} }, null);
  let leading = true;
  for (const step of steps) {
    if (step.type === 'source.collection' && ctx.collection(str(step.config.collection)) === undefined) problems.push('Nie ma takiego zbioru.');
    const got = pick(ctx, step, now);
    if (leading && isSource(step.type) && now !== null) { for (const id of got) now.add(id); continue; }
    if (!isSource(step.type)) leading = false;
    now = got;
  }
  const ids = [...(now ?? [])].filter((id) => ctx.entity(id) !== undefined);
  return { ids, problems };
}

/* -- Gruppen (nur Widoki) ----------------------------------------------------------------------- */

export type Grouping =
  | { readonly by: 'kind' }
  | { readonly by: 'field'; readonly field: string }
  /** Eine Achse: ein Temat-Aspekt; seine direkten Unterthemen sind die Werte (mit ihren Unterthemen). */
  | { readonly by: 'topic'; readonly axis: string };

export function readGrouping(raw: unknown): Grouping | null {
  if (!isObject(raw)) return null;
  if (raw.by === 'kind') return { by: 'kind' };
  if (raw.by === 'field' && str(raw.field) !== '') return { by: 'field', field: str(raw.field) };
  if (raw.by === 'topic' && str(raw.axis) !== '') return { by: 'topic', axis: str(raw.axis) };
  return null;
}

export interface Group {
  readonly key: string;
  readonly label: string;
  readonly ids: readonly string[];
}

/** Die Unterthemen eines Themas (über `parent`) — nach `order`, dann nach dem Namen, wie in der Bibliothek. */
export function childTopics(ctx: Pick<SelectContext, 'look'>, topics: readonly Entity[], parent: string): Entity[] {
  const orderOf = (t: Entity): number => (typeof t.data.order === 'number' && Number.isFinite(t.data.order) ? t.data.order : Number.MAX_SAFE_INTEGER);
  return topics.filter((t) => {
    const f = fieldsOf(t, ctx.look).find((x) => x.key === 'parent');
    return f !== undefined && valuesOf(t, f).some((v) => v.value === parent);
  }).sort((a, b) => orderOf(a) - orderOf(b) || labelOf(a, ctx.look).localeCompare(labelOf(b, ctx.look), 'pl'));
}

/**
 * IN GRUPPEN: nach Rodzaj (der erste), nach den Werten eines Feldes (ein
 * Verweis mit dem Etikett seines Ziels), nach einer Achse von Tematy. Was in
 * keine passt, steht zuletzt unter „bez …". Die Reihenfolge der Werte: nach dem
 * Etikett (eine Achse: wie ihre Unterthemen stehen).
 */
export function groupsOf(ctx: SelectContext, ids: readonly string[], grouping: Grouping, topics: readonly Entity[] = [], options: { readonly all?: boolean } = {}): Group[] {
  const look = ctx.look;
  const groups = new Map<string, { label: string; ids: string[] }>();
  const rest: string[] = [];
  const put = (key: string, label: string, id: string) => {
    const g = groups.get(key) ?? { label, ids: [] };
    if (!g.ids.includes(id)) g.ids.push(id);
    groups.set(key, g);
  };
  if (grouping.by === 'topic') {
    const values = childTopics(ctx, topics, grouping.axis);
    const inValue = values.map((v) => ({ v, members: ctx.topic(v.id, 9) }));
    for (const id of ids) {
      let placed = false;
      for (const { v, members } of inValue) if (members.has(id) && id !== v.id) { put(v.id, labelOf(v, look), id); placed = true; }
      if (!placed) rest.push(id);
    }
    /* `all`: auch die Werte ohne Einträge — eine Macierz zeigt alle Zeilen ihrer Achse (20 × 12, auch leere Felder). */
    if (options.all === true) for (const v of values) if (!groups.has(v.id)) groups.set(v.id, { label: labelOf(v, look), ids: [] });
    const order = new Map(values.map((v, i) => [v.id, i]));
    return [
      ...[...groups.entries()].sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0)).map(([key, g]) => ({ key, label: g.label, ids: g.ids })),
      ...(rest.length > 0 ? [{ key: '', label: 'bez wartości na tej osi', ids: rest }] : [])
    ];
  }
  for (const id of ids) {
    const e = ctx.entity(id);
    if (e === undefined) continue;
    if (grouping.by === 'kind') {
      const kind = e.kinds[0] ?? '';
      put(kind, look.kind(kind)?.name ?? (kind || 'bez rodzaju'), id);
      continue;
    }
    const field = fieldsOf(e, look).find((f) => f.key === grouping.field);
    const values = field === undefined ? [] : valuesOf(e, field).map((v) => v.value).filter((v) => v !== null && v !== '');
    if (field === undefined || values.length === 0) { rest.push(id); continue; }
    if (field.type === 'ref') {
      for (const v of values) {
        if (typeof v !== 'string') continue;
        const target = ctx.entity(v);
        put(v, target === undefined ? '[odwołanie niedostępne]' : labelOf(target, look), id);
      }
    } else {
      const text = fieldText(e, field, look);
      put(`t:${fold(text)}`, text, id);
    }
  }
  const sorted = [...groups.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'pl', { numeric: true }));
  return [
    ...sorted.map(([key, g]) => ({ key, label: g.label, ids: g.ids })),
    ...(rest.length > 0 ? [{ key: '', label: grouping.by === 'field' ? 'bez wartości' : 'bez rodzaju', ids: rest }] : [])
  ];
}
