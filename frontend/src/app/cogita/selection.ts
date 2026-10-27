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
 * Werten eines Feldes oder (2026-10-23, Schritt 5) nach einer ACHSE: einem
 * Rodzaj, dessen Einträge die Werte sind (`Axis`). Ein Eintrag kann in
 * mehreren Gruppen stehen. Themen (`source.topic`, Achsen von Tematy) gibt es
 * nicht mehr; ein alter Schritt „Temat" wird zu einer leeren Liste mit Hinweis.
 *
 * Die Regel der Zbiory (`RuleGroup`) steht jetzt hier; `store.ts` gibt sie
 * weiter, damit alte Importe gelten. Bedingungen über Menschen (`logic.ts`)
 * sind etwas anderes und bleiben dort.
 */

import { fieldKind, fieldsOf, fieldText, fieldUnit, labelOf, plainOf, valuesOf, type Entity, type FieldDef, type Lookup } from './schema';
import { convert, measures, parseQuantity } from '../core/quantities';
import { childrenOf, parentsOf } from './structure';
import { levelLabel, type PrerequisiteGraph } from './prerequisites';

/** 2026-10-25 — wie viele Einträge „Idź po strukturze" höchstens erreicht (ein Kreis endet ohnehin). */
const STRUCTURE_CAP = 5000;

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
  /** Wer auf einen Eintrag zeigt — Felder und Zapis, in der Baza und im Stoff der Bibliotheken. */
  readonly pointing: (id: string) => ReadonlySet<string>;
  /** Woher ein Eintrag kommt (die Kennung seiner Bibliothek oder Baza). */
  readonly from?: (id: string) => string | undefined;
  /** 2026-10-22 (Schritt 11) — worauf ein Eintrag verweist (Felder, Zapis, Plan, Gegenstände), auch einer aus einer Bibliothek. */
  readonly refsOf?: (id: string) => readonly string[];
  /** 2026-10-27 — die Voraussetzungen als Graph (`prerequisites.ts`): die Gruppierung nach Ebenen. */
  readonly prerequisites?: () => PrerequisiteGraph;
}

/* -- Die Schritte ------------------------------------------------------------------------------ */

export const SOURCE_TYPES = ['source.all', 'source.kind', 'source.collection', 'source.list', 'source.from'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
/** 2026-10-25 (Wywód) — `structure`: entlang der Felder, die der Rodzaj als Verbindung einer Struktur erklärt (`structure.ts`). */
export type StepType = SourceType | 'follow' | 'structure' | 'filter.rule';

export interface Step {
  readonly type: StepType;
  readonly config: Readonly<Record<string, unknown>>;
}

/** Wie ein Schritt heisst und was er tut — derselbe Satz im Widok und am Knoten der Powtórka. */
export const STEP_WORDS: Readonly<Record<StepType, { readonly label: string; readonly says: string }>> = {
  'source.all': { label: 'Wszystko', says: 'Każdy wpis tej bazy wiedzy (i baz, z których korzysta).' },
  'source.kind': { label: 'Rodzaj', says: 'Wpisy jednego rodzaju — także z biblioteki albo skryptorium, z których korzysta ta baza (np. cytaty, kazania jednego rodzaju tekstu); „Skąd" zawęża do jednego źródła.' },
  'source.collection': { label: 'Zbiór', says: 'Wpisy zapisanego zbioru — filtra albo listy.' },
  'source.list': { label: 'Lista', says: 'Wybrane wpisy (identyfikatory, jeden w wierszu).' },
  'source.from': { label: 'Z wpisu', says: 'To, na co wskazuje wybrany wpis — np. kazanie: jego cytaty, komentarze, słowa, miejsca z planu.' },
  follow: { label: 'Idź po odwołaniu', says: 'Od wybranych wpisów dalej: do tego, na co wskazują (jedno pole albo wszystkie) — albo wstecz: do tego, co wskazuje na nie.' },
  structure: { label: 'Idź po strukturze', says: 'Od wybranych wpisów w dół struktury — po polach, które ich rodzaje oznaczają jako „połączenie w strukturze” — do samego końca albo o jeden poziom; albo w górę, do wpisów, pod którymi leżą. W „Strukturze” rysuje drzewo w kolejności miejsc w dziele.' },
  'filter.rule': { label: 'Filtr', says: 'Zostawia wpisy spełniające regułę: pole, porównanie, grupy warunków (I / LUB).' }
};

const STEP_TYPES: readonly StepType[] = [...SOURCE_TYPES, 'follow', 'structure', 'filter.rule'];
export const isSource = (type: string): type is SourceType => (SOURCE_TYPES as readonly string[]).includes(type);

/** 2026-10-23 (Schritt 5) — ein Schritt, den es nicht mehr gibt: was er war, für den Hinweis. */
export const RETIRED_STEP = 'retired';

export function readSteps(raw: unknown): Step[] {
  const out: Step[] = [];
  for (const one of Array.isArray(raw) ? raw : []) {
    /* Ein alter Schritt „Temat": eine leere Liste — er wählt nichts mehr, und der Widok sagt, warum. */
    if (isObject(one) && one.type === 'source.topic') { out.push({ type: 'source.list', config: { ids: [], [RETIRED_STEP]: 'source.topic' } }); continue; }
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
    case 'structure': {
      /* 2026-10-25 (Wywód) — unter (oder über) den gewählten Einträgen, so weit die Struktur reicht. */
      const up = c.dir === 'up';
      /* „Tylko jeden poziom" (`one`) — ein Häkchen kann nur `true` speichern; ein altes `deep: false` gilt weiter. */
      const deep = !(c.one === true || c.deep === false);
      const src = { entity: ctx.entity, look: ctx.look, pointing: ctx.pointing };
      const out = new Set<string>();
      /* Was schon aufgeklappt wurde (gegen Kreise) — getrennt vom Ergebnis: ein gewählter Eintrag unter einem anderen gewählten gehört dazu. */
      const expanded = new Set(input ?? []);
      let layer = [...expanded];
      while (layer.length > 0 && out.size < STRUCTURE_CAP) {
        const next: string[] = [];
        for (const id of layer) {
          for (const x of up ? parentsOf(id, src) : childrenOf(id, src).map((k) => k.id)) {
            out.add(x);
            if (!expanded.has(x)) { expanded.add(x); next.push(x); }
          }
        }
        if (!deep) break;
        layer = next;
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

/** Was ein alter Schritt „Temat" sagt. */
export const RETIRED_TOPIC = 'Źródło „Temat” już nie istnieje — tematów nie ma. Wybierz rodzaj, zbiór albo listę.';

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
    if (step.config[RETIRED_STEP] === 'source.topic') problems.push(RETIRED_TOPIC);
    const got = pick(ctx, step, now);
    if (leading && isSource(step.type) && now !== null) { for (const id of got) now.add(id); continue; }
    if (!isSource(step.type)) leading = false;
    now = got;
  }
  const ids = [...(now ?? [])].filter((id) => ctx.entity(id) !== undefined);
  return { ids, problems };
}

/* -- Gruppen (nur Widoki) ----------------------------------------------------------------------- */

/**
 * 2026-10-23 (Schritt 5) — DIE REIHENFOLGE DER WERTE EINER ACHSE: nach einem
 * Zahlenfeld der Werte (`field`) — oder nach der Reihenfolge, in der ein
 * Eintrag sie in einem Verweisfeld nennt (`list` + `field`: „Różaniec" →
 * „Tajemnice"). Ohne: nach dem Namen.
 */
export interface AxisSort {
  readonly field: string;
  readonly list?: string;
}

/**
 * EINE ACHSE IST EIN RODZAJ: seine Einträge sind die Werte (Tajemnica: 20
 * Tajemnice). Ein Eintrag gehört zu einem Wert, wenn er über ein gewähltes
 * Verweisfeld auf ihn zeigt (`via`; leer: über irgendeines) — direkt oder über
 * EINEN Schritt (`through`: erst über dieses Feld zu einem anderen Eintrag,
 * der dann auf den Wert zeigt; `*`: über irgendeines). `group`: ein
 * Verweisfeld der Werte, nach dem sie unter Überschriften stehen
 * (Tajemnica → „część": radosne, światła, bolesne, chwalebne).
 */
export interface Axis {
  readonly kind: string;
  readonly via: readonly string[];
  readonly through?: string;
  readonly sort?: AxisSort;
  readonly group?: string;
}

export type Grouping =
  | { readonly by: 'kind' }
  | { readonly by: 'field'; readonly field: string }
  | ({ readonly by: 'axis' } & Axis)
  /* 2026-10-27 — nach der Ebene in der Reihenfolge des Lernens (`prerequisites.ts`): Poziom 1 — podstawy, 2, 3 … */
  | { readonly by: 'level' };

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((x) => x !== '') : str(v) === '' ? [] : [str(v)]);

export function readAxis(raw: Record<string, unknown>): Axis | null {
  const kind = str(raw.kind);
  if (kind === '') return null;
  const sort = isObject(raw.sort) && str(raw.sort.field) !== '' ? { field: str(raw.sort.field), ...(str(raw.sort.list) !== '' ? { list: str(raw.sort.list) } : {}) } : undefined;
  return {
    kind,
    via: strings(raw.via),
    ...(str(raw.through) !== '' ? { through: str(raw.through) } : {}),
    ...(sort === undefined ? {} : { sort }),
    ...(str(raw.group) !== '' ? { group: str(raw.group) } : {})
  };
}

/** Eine Gruppierung aus ihrem JSON — eine alte nach einer Achse von Tematy (`by: "topic"`) gibt es nicht mehr: `null`. */
export function readGrouping(raw: unknown): Grouping | null {
  if (!isObject(raw)) return null;
  if (raw.by === 'kind') return { by: 'kind' };
  if (raw.by === 'level') return { by: 'level' };
  if (raw.by === 'field' && str(raw.field) !== '') return { by: 'field', field: str(raw.field) };
  if (raw.by === 'axis') { const axis = readAxis(raw); return axis === null ? null : { by: 'axis', ...axis }; }
  return null;
}

/** War das eine Gruppierung nach Tematy (bis 2026-10-23)? — für den Hinweis in Widok und Macierz. */
export const wasTopicGrouping = (raw: unknown): boolean => isObject(raw) && raw.by === 'topic';

export interface Group {
  readonly key: string;
  readonly label: string;
  readonly ids: readonly string[];
  /** 2026-10-23 — die Überschrift, unter der die Gruppe steht (der Wert ihres Feldes `group`). */
  readonly head?: { readonly key: string; readonly label: string };
}

/** Wohin ein Eintrag über ein Feld zeigt — mehrere Felder, keins: über alle Verweisfelder. */
const targetsVia = (entity: Entity, look: Lookup, fields: readonly string[]): string[] =>
  fields.length === 0 ? targetsOf(entity, look, '') : fields.flatMap((f) => targetsOf(entity, look, f));

/**
 * DIE WERTE EINER ACHSE in ihrer Reihenfolge: die Einträge des Rodzaj, nach
 * dem Zahlenfeld, nach der Liste eines Eintrags oder nach dem Namen — und,
 * mit `group`, unter ihren Überschriften (in der Reihenfolge, in der die
 * erste ihrer Werte steht).
 */
export function axisValues(ctx: SelectContext, axis: Axis): { value: Entity; head: { key: string; label: string } | null }[] {
  const look = ctx.look;
  const values = [...ctx.material(axis.kind)];
  const name = (e: Entity) => labelOf(e, look);
  let rank: (e: Entity) => number = () => 0;
  if (axis.sort !== undefined && axis.sort.list !== undefined) {
    const holder = ctx.entity(axis.sort.list);
    const order = holder === undefined ? [] : targetsOf(holder, look, axis.sort.field);
    rank = (e) => { const i = order.indexOf(e.id); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  } else if (axis.sort !== undefined) {
    const key = axis.sort.field;
    rank = (e) => {
      const f = fieldsOf(e, look).find((x) => x.key === key);
      const v = f === undefined ? undefined : valuesOf(e, f)[0]?.value;
      return typeof v === 'number' && Number.isFinite(v) ? v : Number.MAX_SAFE_INTEGER;
    };
  }
  values.sort((a, b) => rank(a) - rank(b) || name(a).localeCompare(name(b), 'pl', { numeric: true }));
  const headOf = (e: Entity): { key: string; label: string } | null => {
    if (axis.group === undefined) return null;
    const target = targetsOf(e, look, axis.group)[0];
    const head = target === undefined ? undefined : ctx.entity(target);
    return head === undefined ? { key: '', label: 'bez grupy' } : { key: head.id, label: labelOf(head, look) };
  };
  const placed = values.map((value) => ({ value, head: headOf(value) }));
  if (axis.group === undefined) return placed;
  /* Unter Überschriften: in der Reihenfolge ihres ersten Wertes, die Werte darin wie sortiert. */
  const heads: string[] = [];
  for (const p of placed) if (!heads.includes(p.head!.key)) heads.push(p.head!.key);
  return heads.flatMap((h) => placed.filter((p) => p.head!.key === h));
}

/**
 * ZU WELCHEN WERTEN EINER ACHSE EIN EINTRAG GEHÖRT: er zeigt über `via` auf
 * sie — oder (mit `through`) über ein Feld auf einen anderen Eintrag, der über
 * `via` auf sie zeigt. Ein Wert gehört zu sich selbst.
 */
export function axisMembers(ctx: SelectContext, entity: Entity, axis: Axis, values: ReadonlySet<string>): string[] {
  const look = ctx.look;
  const out = new Set<string>();
  if (values.has(entity.id)) out.add(entity.id);
  for (const t of targetsVia(entity, look, axis.via)) if (values.has(t)) out.add(t);
  if (axis.through !== undefined) {
    for (const mid of targetsOf(entity, look, axis.through === '*' ? '' : axis.through)) {
      const between = ctx.entity(mid);
      if (between === undefined || between.id === entity.id) continue;
      for (const t of targetsVia(between, look, axis.via)) if (values.has(t)) out.add(t);
    }
  }
  return [...out];
}

/**
 * IN GRUPPEN: nach Rodzaj (der erste), nach den Werten eines Feldes (ein
 * Verweis mit dem Etikett seines Ziels), nach einer Achse (einem Rodzaj). Was
 * in keine passt, steht zuletzt unter „bez …". Die Reihenfolge der Werte: nach
 * dem Etikett — eine Achse, wie ihre Werte geordnet sind (mit Überschriften).
 */
export function groupsOf(ctx: SelectContext, ids: readonly string[], grouping: Grouping, options: { readonly all?: boolean } = {}): Group[] {
  const look = ctx.look;
  const groups = new Map<string, { label: string; ids: string[] }>();
  const rest: string[] = [];
  const put = (key: string, label: string, id: string) => {
    const g = groups.get(key) ?? { label, ids: [] };
    if (!g.ids.includes(id)) g.ids.push(id);
    groups.set(key, g);
  };
  /* 2026-10-27 — die Ebenen der Reihenfolge des Lernens, von den Grundlagen her; wer in keiner Voraussetzung steht, zuletzt. */
  if (grouping.by === 'level') {
    const graph = ctx.prerequisites?.();
    const levels = new Map<number, string[]>();
    for (const id of ids) {
      const at = graph?.level.get(id);
      if (at === undefined) { rest.push(id); continue; }
      levels.set(at, [...(levels.get(at) ?? []), id]);
    }
    return [
      ...[...levels.keys()].sort((a, b) => a - b).map((at) => ({ key: `level:${at}`, label: levelLabel(at), ids: levels.get(at)! })),
      ...(rest.length > 0 ? [{ key: '', label: 'poza kolejnością nauki', ids: rest }] : [])
    ];
  }
  if (grouping.by === 'axis') {
    const values = axisValues(ctx, grouping);
    const known = new Set(values.map((v) => v.value.id));
    for (const id of ids) {
      const e = ctx.entity(id);
      const hits = e === undefined ? [] : axisMembers(ctx, e, grouping, known);
      for (const hit of hits) put(hit, labelOf(ctx.entity(hit)!, look), id);
      if (hits.length === 0) rest.push(id);
    }
    /* `all`: auch die Werte ohne Einträge — eine Macierz zeigt alle Zeilen ihrer Achse (20 × 12, auch leere Felder). */
    const shown = values.filter((v) => options.all === true || groups.has(v.value.id));
    return [
      ...shown.map(({ value, head }) => ({ key: value.id, label: labelOf(value, look), ids: groups.get(value.id)?.ids ?? [], ...(head === null ? {} : { head }) })),
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
