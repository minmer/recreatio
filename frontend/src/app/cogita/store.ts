/**
 * COGITA — DIE BIBLIOTHEK ALS SCHEMA, Einträge und Karten (COGITA.md §2–6).
 *
 * <b>Eine Schicht über dem Speicher der Bibliothek</b> (`libraryStore.ts`):
 * dort liegen die Hüllen, der Abgleich, das Speichern mit `stale`. Hier wird
 * daraus, was Cogita braucht — die Arten (eingebaut, geändert, eigene), die
 * Entitäten mit ihren Etiketten und Rückverweisen, die Dokumente (Vorlagen,
 * Wiederholungen, Abläufe, Zbiory, Widoki, Ustawienia), und die Karten.
 *
 * Gerechnet wird je Stand des Speichers einmal (`revision`) und nur, wenn
 * jemand fragt.
 */

import { newId } from '../ids';
import type { Entry, LibraryStore } from '../libraryStore';
import { cardsOf, questionCard, readTemplate, templatesFor, topicCard, type Card, type Template } from './cards';
import { DOC_KINDS, ENTITY, entityOf, entryData, isBaseKind, kindDefs, kindDoc, overrideEntryOf, plainKindOf, type DocKind } from './kinds';
import type { Dependency, DependencyKind } from './knowness';
import { DEPENDENCY_KINDS } from './knowness';
import { labelOf, lookupOf, plainOf, refIndex, replaceRef, tellOf, valuesOf, fieldsOf, type Backlink, type Entity, type KindDef, type Lookup } from './schema';

/* -- Einstellungen einer Bibliothek als Kurs -------------------------------------------- */

export const MOTIVATIONS = ['none', 'progress', 'streaks', 'exploration'] as const;
export type Motivation = (typeof MOTIVATIONS)[number];

export const MOTIVATION_LABEL: Record<Motivation, string> = {
  none: 'Bez dodatków',
  progress: 'Paski postępu',
  streaks: 'Serie dni nauki',
  exploration: 'Mapa odkrywania'
};

export interface DependencyEdge extends Dependency {
  /** Vorgeschlagen (aus Abläufen, Übergaben) und noch nicht bestätigt [E5]. */
  readonly proposed?: boolean;
}

export interface CogitaSettings {
  /** Wohin die Antworten der Lernenden gehen [E10]; fehlt: der eigene private Bereich (oder der der Bibliothek). */
  readonly storageAreaId?: string;
  /** Die Bibliothek, in die Lesende Vorschläge schreiben, bevor ein Autor sie annimmt [K2]. */
  readonly contributionLibraryId?: string;
  readonly motivation: Motivation;
  /** Die Perspektiven der Bibliothek [C8]. */
  readonly tags: readonly string[];
  /** Voraussetzungen, Vertiefungen, Zusammenhänge zwischen Einträgen [E3]. */
  readonly dependencies: readonly DependencyEdge[];
  /** Welche Wiederholungen das Gerät ohne Netz bereithält [E9]. */
  readonly offline: readonly string[];
  /** Die Seite, auf der man einer Sitzung beitritt (mit dem Baustein „Sesja — uczestnik"). */
  readonly joinPage?: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []);

export function readSettings(raw: unknown): CogitaSettings {
  const d = isObject(raw) ? raw : {};
  const dependencies: DependencyEdge[] = [];
  for (const one of Array.isArray(d.dependencies) ? d.dependencies : []) {
    if (!isObject(one)) continue;
    const parent = str(one.parent);
    const child = str(one.child);
    const kind = (DEPENDENCY_KINDS as readonly string[]).includes(str(one.kind)) ? (one.kind as DependencyKind) : 'prerequisite';
    const impact = typeof one.impact === 'number' && Number.isFinite(one.impact) ? Math.max(0, Math.min(1, one.impact)) : 0.5;
    if (parent === '' || child === '' || parent === child) continue;
    dependencies.push({ parent, child, kind, impact, ...(one.proposed === true ? { proposed: true } : {}) });
  }
  return {
    storageAreaId: str(d.storageAreaId) || undefined,
    contributionLibraryId: str(d.contributionLibraryId) || undefined,
    motivation: (MOTIVATIONS as readonly string[]).includes(str(d.motivation)) ? (d.motivation as Motivation) : 'progress',
    tags: strings(d.tags),
    dependencies,
    offline: strings(d.offline),
    ...(str(d.joinPage).trim() === '' ? {} : { joinPage: str(d.joinPage).trim().replace(/^#?\/+/, '') })
  };
}

/* -- Zbiory: gespeicherte Filter und Listen [F1, F19] -------------------------------------- */

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

export interface Collection {
  readonly id: string;
  readonly name: string;
  readonly rule: RuleGroup | null;
  readonly list: readonly string[];
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

export const readCollection = (id: string, raw: unknown): Collection => {
  const d = isObject(raw) ? raw : {};
  return { id, name: str(d.name).trim() || 'Zbiór', rule: readRule(d.rule), list: strings(d.list) };
};

const fold = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

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
    case 'eq': return texts.some((t) => fold(t) === fold(want));
    case 'ne': return texts.every((t) => fold(t) !== fold(want));
    case 'contains': return texts.some((t) => fold(plainOf(t)).includes(fold(want)));
    case 'gt':
    case 'lt': {
      const number = Number(want.replace(',', '.'));
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

/* -- Die Bibliothek als Kurs ---------------------------------------------------------------- */

interface Memo {
  readonly revision: number;
  readonly kinds: readonly KindDef[];
  readonly entities: readonly Entity[];
  readonly look: Lookup;
  readonly byKind: Map<string, Entity[]>;
  readonly docs: Map<DocKind, Entry[]>;
  backlinks: Map<string, Backlink[]> | null;
  search: Map<string, string> | null;
}

export class CogitaLibrary {
  constructor(readonly store: LibraryStore, readonly writes: boolean) {}

  private memo: Memo | null = null;
  private cardMemo: { revision: number; seed: string; made: Promise<{ cards: Card[]; problems: Map<string, string[]> }> } | null = null;

  /** Ein Python-Läufer für die Vorlagen — von aussen hereingereicht, damit die Rechnung ohne Browser prüfbar bleibt. */
  python: ((code: string, args: readonly unknown[]) => Promise<unknown>) | undefined;

  get libraryId(): string { return this.store.libraryId; }
  get areaId(): string { return this.store.areaId; }
  get revision(): number { return this.store.revision; }

  private fresh(): Memo {
    if (this.memo !== null && this.memo.revision === this.store.revision) return this.memo;
    const all = this.store.all();
    const merged = new Set<string>();
    for (const e of all) if (e.kind === 'merge' && typeof e.data.from === 'string') merged.add(e.data.from);
    const kinds = kindDefs(all);
    const entities = all.map(entityOf).filter((e): e is Entity => e !== null && !merged.has(e.id));
    const byKind = new Map<string, Entity[]>();
    for (const e of entities) for (const k of e.kinds) byKind.set(k, [...(byKind.get(k) ?? []), e]);
    const docs = new Map<DocKind, Entry[]>(DOC_KINDS.map((k) => [k, []]));
    for (const e of all) if (docs.has(e.kind as DocKind)) docs.get(e.kind as DocKind)!.push(e);
    this.memo = { revision: this.store.revision, kinds, entities, look: lookupOf(kinds, entities), byKind, docs, backlinks: null, search: null };
    return this.memo;
  }

  get kinds(): readonly KindDef[] { return this.fresh().kinds; }
  get look(): Lookup { return this.fresh().look; }
  kind(id: string): KindDef | undefined { return this.fresh().look.kind(id); }
  entities(): readonly Entity[] { return this.fresh().entities; }
  entity(id: string): Entity | undefined { return this.fresh().look.entity(id); }
  entry(id: string): Entry | undefined { return this.store.get(id); }

  /** Ein Verweis im Zapis nennt eine Kennung oder einen Zitierschlüssel — hier wird es eine Kennung. */
  resolve(token: string): string | undefined {
    return this.store.get(token) !== undefined ? token : this.store.byKey(token)?.id;
  }
  ofKind(kindId: string): readonly Entity[] { return this.fresh().byKind.get(kindId) ?? []; }
  docs(kind: DocKind): readonly Entry[] { return this.fresh().docs.get(kind) ?? []; }
  label(entity: Entity): string { return labelOf(entity, this.look); }
  tell(entity: Entity): string { return tellOf(entity, this.look); }

  /** Wer auf wen zeigt — mit dem Namen der Gegenseite [B9, B10]. */
  backlinks(id: string): readonly Backlink[] {
    const m = this.fresh();
    m.backlinks ??= refIndex(m.entities, m.look);
    return m.backlinks.get(id) ?? [];
  }

  /** Suchen in Etiketten und Textwerten, ohne Rücksicht auf Akzente. */
  search(query: string, kinds?: readonly string[]): Entity[] {
    const m = this.fresh();
    if (m.search === null) {
      const index = new Map<string, string>();
      for (const e of m.entities) {
        const parts = [labelOf(e, m.look), tellOf(e, m.look)];
        for (const v of Object.values(e.data)) if (typeof v === 'string') parts.push(plainOf(v));
        index.set(e.id, fold(parts.join(' ')));
      }
      m.search = index;
    }
    const words = fold(query).split(/\s+/).filter(Boolean);
    return m.entities.filter((e) => (kinds === undefined || kinds.some((k) => e.kinds.includes(k)))
      && words.every((w) => (m.search!.get(e.id) ?? '').includes(w)));
  }

  templates(): Template[] { return this.docs('template').map((e) => readTemplate(e.id, e.data)); }

  collections(): Collection[] { return this.docs('collection').map((e) => readCollection(e.id, e.data)); }

  /** Die Einträge eines Zbiór: die Liste, und wer zum Filter passt. */
  members(collectionId: string): ReadonlySet<string> | undefined {
    const doc = this.docs('collection').find((e) => e.id === collectionId);
    if (doc === undefined) return undefined;
    const c = readCollection(doc.id, doc.data);
    const out = new Set(c.list);
    if (c.rule !== null && c.rule.items.length > 0) for (const e of this.entities()) if (ruleMatches(e, this.look, c.rule)) out.add(e.id);
    return out;
  }

  /** Ein Thema und seine Unterthemen bis zur Tiefe — mit dem, was sie beantworten und woran sie hängen. */
  topicTree(topicId: string, depth: number): ReadonlySet<string> {
    const out = new Set<string>();
    const look = this.look;
    const children = new Map<string, string[]>();
    for (const t of this.ofKind('topic')) {
      const field = fieldsOf(t, look).find((f) => f.key === 'parent');
      for (const v of field === undefined ? [] : valuesOf(t, field)) if (typeof v.value === 'string') children.set(v.value, [...(children.get(v.value) ?? []), t.id]);
    }
    const walk = (id: string, left: number) => {
      if (out.has(id)) return;
      out.add(id);
      const topic = this.entity(id);
      if (topic !== undefined) {
        for (const key of ['answers', 'entity']) {
          const field = fieldsOf(topic, look).find((f) => f.key === key);
          for (const v of field === undefined ? [] : valuesOf(topic, field)) if (typeof v.value === 'string') out.add(v.value);
        }
      }
      if (left <= 0) return;
      for (const child of children.get(id) ?? []) walk(child, left - 1);
    };
    walk(topicId, depth);
    return out;
  }

  settingsEntry(): Entry | undefined { return this.docs('settings')[0]; }
  settings(): CogitaSettings { return readSettings(this.settingsEntry()?.data); }

  /** Die bestätigten Abhängigkeiten — was die Kenntnis weitergibt und sperrt. */
  dependencies(): Dependency[] { return this.settings().dependencies.filter((d) => d.proposed !== true); }

  /** Zusammengeführt [B16]: wer in wen aufging. */
  merges(): ReadonlyMap<string, string> {
    const out = new Map<string, string>();
    for (const e of this.docs('merge')) if (typeof e.data.from === 'string' && typeof e.data.to === 'string') out.set(e.data.from, e.data.to);
    return out;
  }

  /* -- Schreiben ------------------------------------------------------------------------------ */

  /** Eine Entität speichern — die Arten in ihrer Reihenfolge, die Daten wie sie sind. */
  async saveEntity(input: { readonly id?: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }): Promise<Entry> {
    const before = input.id === undefined ? undefined : this.store.get(input.id);
    const plain = before?.kind ?? plainKindOf(input.kinds);
    const data = entryData({ kinds: input.kinds, data: input.data }, plain, before?.data ?? {});
    return this.store.save({ ...(input.id === undefined ? {} : { id: input.id }), kind: plain, ...(before?.key === undefined ? {} : { key: before.key }), data });
  }

  /** Eine Art speichern — eine eingebaute als Änderung (`builtin`), eine eigene als ihr Eintrag. */
  async saveKind(kind: KindDef): Promise<Entry> {
    if (isBaseKind(kind.id)) {
      const had = overrideEntryOf(this.store.all(), kind.id);
      return this.store.save({ ...(had === undefined ? {} : { id: had.id }), kind: 'kind', data: kindDoc(kind) });
    }
    const exists = this.store.get(kind.id) !== undefined;
    return this.store.save({ ...(exists ? { id: kind.id } : {}), kind: 'kind', data: kindDoc(kind) });
  }

  saveDoc(kind: DocKind, data: Readonly<Record<string, unknown>>, id?: string): Promise<Entry> {
    return this.store.save({ ...(id === undefined ? {} : { id }), kind, data: { ...data } });
  }

  async saveSettings(patch: Partial<Record<keyof CogitaSettings, unknown>>): Promise<Entry> {
    const had = this.settingsEntry();
    return this.saveDoc('settings', { ...(had?.data ?? {}), ...patch }, had?.id);
  }

  remove(id: string): Promise<void> { return this.store.remove(id); }

  /**
   * ZUSAMMENFÜHREN [B16]: jeder Verweis auf `drop` zeigt danach auf `keep`;
   * was `drop` hatte und `keep` nicht, geht mit; `drop` wird gelöscht und ein
   * Vermerk „połączony z" bleibt (für Seiten und Fortschritte, die ihn nennen).
   * Gibt zurück, wie viele Einträge umgeschrieben wurden.
   */
  async merge(keepId: string, dropId: string): Promise<number> {
    const keep = this.entity(keepId);
    const drop = this.entity(dropId);
    if (keep === undefined || drop === undefined || keepId === dropId) return 0;
    let rewritten = 0;
    for (const other of this.entities()) {
      if (other.id === dropId) continue;
      const changed = replaceRef(other, this.look, dropId, keepId);
      if (changed === null) continue;
      await this.saveEntity({ id: other.id, kinds: changed.kinds, data: changed.data });
      rewritten += 1;
    }
    const data: Record<string, unknown> = { ...keep.data };
    for (const [key, value] of Object.entries(drop.data)) if (data[key] === undefined || data[key] === '' || (Array.isArray(data[key]) && (data[key] as unknown[]).length === 0)) data[key] = value;
    const kinds = [...keep.kinds, ...drop.kinds.filter((k) => !keep.kinds.includes(k))];
    await this.saveEntity({ id: keepId, kinds, data });
    await this.saveDoc('merge', { from: dropId, to: keepId, at: new Date().toISOString(), label: this.label(drop) });
    await this.store.remove(dropId);
    return rewritten;
  }

  /** Ein Autor hat nachgesehen [C7]: die verbundenen Einträge gelten als geprüft, so wie sie jetzt sind. */
  async markChecked(id: string): Promise<void> {
    const entry = this.store.get(id);
    if (entry === undefined) return;
    const entity = this.entity(id);
    if (entity === undefined) return;
    const checked: Record<string, string> = {};
    for (const token of linkedOf(entity, this.look)) {
      const linked = this.resolve(token);
      const at = linked === undefined ? undefined : this.store.get(linked)?.updatedAt;
      if (linked !== undefined && at !== undefined) checked[linked] = at;
    }
    await this.store.save({ id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: { ...entry.data, _checked: checked } });
  }

  /* -- Karten -------------------------------------------------------------------------------- */

  /**
   * ALLE KARTEN dieser Bibliothek: jede Vorlage für jede Entität ihrer Arten,
   * jede von Hand geschriebene Frage, jedes Thema mit Antworten. Je Stand des
   * Speichers und Samen einmal gerechnet.
   */
  cards(seed = ''): Promise<{ cards: Card[]; problems: Map<string, string[]> }> {
    if (this.cardMemo !== null && this.cardMemo.revision === this.store.revision && this.cardMemo.seed === seed) return this.cardMemo.made;
    const made = (async () => {
      const look = this.look;
      const templates = this.templates();
      const cards: Card[] = [];
      const problems = new Map<string, string[]>();
      const pool = (kind: string) => this.ofKind(kind);
      for (const entity of this.entities()) {
        for (const template of templatesFor(entity, templates)) {
          const done = await cardsOf(template, { look, entity, pool, seed, ...(this.python === undefined ? {} : { python: this.python }) });
          cards.push(...done.cards);
          if (done.problems.length > 0) problems.set(template.id, [...(problems.get(template.id) ?? []), ...done.problems]);
        }
        if (entity.kinds.includes('question')) {
          const card = questionCard(entity, seed);
          if (card !== null) cards.push(card);
        }
        if (entity.kinds.includes('topic')) {
          const card = topicCard(entity, look);
          if (card !== null) cards.push(card);
        }
      }
      return { cards, problems };
    })();
    this.cardMemo = { revision: this.store.revision, seed, made };
    return made;
  }

  /** Die Karten eines Eintrags — für seine Seite und die Vorschau einer Vorlage. */
  async cardsFor(entityId: string, seed = ''): Promise<Card[]> {
    return (await this.cards(seed)).cards.filter((c) => c.entity === entityId);
  }

  newId(): string { return newId(); }
}

/** Woran ein Wissenssatz oder Thema hängt: Verweisfelder und die Verweise im Zapis (`[[…|@id]]`). */
export function linkedOf(entity: Entity, look: Lookup): string[] {
  const out = new Set<string>();
  for (const field of fieldsOf(entity, look)) {
    if (field.type === 'ref') for (const v of valuesOf(entity, field)) if (typeof v.value === 'string') out.add(v.value);
    if (field.type === 'markup') for (const v of valuesOf(entity, field)) if (typeof v.value === 'string') for (const m of v.value.matchAll(/\[\[[^\]|]+\|@([^\]]+)\]\]/g)) out.add(m[1].trim());
  }
  out.delete(entity.id);
  return [...out];
}

/** Ein Eintrag als Zeile einer Liste: Etikett und, was Gleichnamige unterscheidet. */
export const lineOf = (lib: CogitaLibrary, entity: Entity): string => {
  const tell = lib.tell(entity);
  return tell === '' ? lib.label(entity) : `${lib.label(entity)} · ${tell}`;
};

export { ENTITY };
