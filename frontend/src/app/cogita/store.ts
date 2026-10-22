/**
 * COGITA — DIE BAZA WIEDZY ALS SCHEMA, Einträge und Karten (COGITA.md §2–6).
 *
 * <b>Eine Schicht über dem versiegelten Speicher</b> (`libraryStore.ts`, den
 * die Bibliothek ebenso benutzt): dort liegen die Hüllen, der Abgleich, das
 * Speichern mit `stale`. Hier wird daraus, was Cogita braucht — die Arten
 * (eingebaut, geändert, eigene), die Entitäten mit ihren Etiketten und
 * Rückverweisen, die Dokumente (Vorlagen, Wiederholungen, Abläufe, Zbiory,
 * Widoki, Ustawienia), und die Karten.
 *
 * <b>0110 — mit ihren Quellen.</b> Eine Baza wiedzy steht NEBEN der
 * Bibliothek, nicht in ihr, und verweist auf andere, auch in anderen
 * Bereichen: auf Bibliotheken nur zum Verweisen (ihre Werke, Zitate, Personen
 * in Verweisfeldern und Zitaten), auf andere Bazy wiedzy zum Wiederverwenden
 * (ihre Arten, Einträge, Vorlagen, Wiederholungen, Abläufe gelten mit).
 * Geschrieben wird nur in die eigene.
 *
 * Gerechnet wird je Stand der Speicher einmal (`revision`) und nur, wenn
 * jemand fragt.
 */

import { newId } from '../core/ids';
import type { Entry, LibraryStore } from '../library/libraryStore';
import { entryTitle, KINDS as LIBRARY_KINDS, type Lookup as MarkupLookup } from '../library/libraryKinds';
import { cardsOf, questionCard, readTemplate, templatesFor, topicCard, type Template } from './cards';
import { type Card } from './cardBasics';
import { baseKind, DOC_KINDS, entityOf, entryData, isBaseKind, kindDefs, kindDoc, overrideEntryOf, plainKindOf, type DocKind } from './kinds';
import { planKindRemoval, type KindRemoval } from './kindRemoval';
import type { Dependency, DependencyKind, Mark } from './knowness';
import type { RevisionContext } from './revision';
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
  /** Die Seite, auf der man einer Sitzung beitritt (mit dem Baustein „Dołącz do sesji"). */
  readonly joinPage?: string;
  /** 0110 — worauf diese Baza wiedzy verweist: Bibliotheken und andere Bazy wiedzy, auch in anderen Bereichen. */
  readonly sources: readonly SourceRef[];
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
    ...(str(d.joinPage).trim() === '' ? {} : { joinPage: str(d.joinPage).trim().replace(/^#?\/+/, '') }),
    sources: readSources(d.sources)
  };
}

/* -- 0110: die Quellen einer Baza wiedzy ---------------------------------------------------- */

/**
 * WIE EINE QUELLE GEBRAUCHT WIRD. Eine BIBLIOTHEK (`books`) nur zum
 * Verweisen: ihre Werke, Zitate, Personen und Themen stehen in Verweisfeldern
 * und Zitaten, nie als Karten. Eine andere BAZA WIEDZY (`knowledge`) zum
 * Wiederverwenden: ihre Arten, Einträge, Vorlagen, Wiederholungen und Abläufe
 * gelten hier mit — geändert werden sie dort.
 */
export type SourceKind = 'books' | 'knowledge';

export interface SourceRef {
  readonly id: string;
  readonly kind: SourceKind;
  /** Wie sie hiess, als sie dazukam — damit die Liste sie nennt, auch wenn sie gerade nicht lesbar ist. */
  readonly name: string;
}

/** Eine geöffnete Quelle: ihr Speicher (versiegelt unter ihrem eigenen Bereich), wie sie gebraucht wird, ihr Name. */
export interface Source {
  readonly store: LibraryStore;
  readonly kind: SourceKind;
  readonly name: string;
}

/** Woher ein Eintrag kommt — aus dieser Baza wiedzy oder aus einer ihrer Quellen. */
export interface Origin {
  readonly libraryId: string;
  readonly areaId: string;
  readonly name: string;
  readonly own: boolean;
  readonly kind: SourceKind;
}

export function readSources(raw: unknown): SourceRef[] {
  const out: SourceRef[] = [];
  for (const one of Array.isArray(raw) ? raw : []) {
    if (!isObject(one) || out.length >= 20) continue;
    const id = str(one.id).trim();
    if (id === '' || out.some((s) => s.id === id)) continue;
    const kind: SourceKind = one.kind === 'books' ? 'books' : 'knowledge';
    out.push({ id, kind, name: str(one.name).trim().slice(0, 120) || (kind === 'books' ? 'Biblioteka' : 'Baza wiedzy') });
  }
  return out;
}

/** Was eine Bibliothek ist und keine Baza wiedzy: diese Arten legt man in der Bibliothek an — hier verweist man auf sie. */
/** 2026-10-22 — die Arten der Bibliothek ausser dem Thema (Themen gehören beiden Seiten) — aus `libraryKinds.ts`, keine eigene Liste. */
export const BOOK_KINDS: ReadonlySet<string> = new Set(LIBRARY_KINDS.map((k) => k.kind).filter((k) => k !== 'topic'));

/** Was eine wiederverwendete Baza wiedzy mitbringt — Einstellungen, Widoki, Vorschläge und Arten (die kommen über das Schema) bleiben ihre. */
const SHARED_DOCS: ReadonlySet<string> = new Set<DocKind>(['template', 'revision', 'flow', 'look', 'rules', 'values', 'collection', 'merge', 'addform']);

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

/* -- Die Baza wiedzy --------------------------------------------------------------------- */

interface Memo {
  readonly stamp: string;
  readonly kinds: readonly KindDef[];
  /** Ohne die Arten der Bibliotheken — was man hier anlegt und lernt. */
  readonly contentKinds: readonly KindDef[];
  readonly entities: readonly Entity[];
  /** Was Bibliotheken beisteuern: nur zum Verweisen, nie zum Lernen. */
  readonly refs: readonly Entity[];
  readonly look: Lookup;
  readonly byKind: Map<string, Entity[]>;
  readonly docs: Map<DocKind, Entry[]>;
  readonly origin: Map<string, Origin>;
  backlinks: Map<string, Backlink[]> | null;
  search: Map<string, string> | null;
  refSearch: Map<string, string> | null;
  markup: MarkupLookup | null;
  /** 2026-10-22 — die eigenen Arten und die der Bibliotheken, aus denen Stoff kommt. */
  materialKinds: readonly KindDef[] | null;
}

/** Suchtext je Entität: Etikett, Unterscheidung, alle Textwerte — ohne Akzente. */
function searchIndex(entities: readonly Entity[], look: Lookup): Map<string, string> {
  const index = new Map<string, string>();
  for (const e of entities) {
    const parts = [labelOf(e, look), tellOf(e, look)];
    for (const v of Object.values(e.data)) if (typeof v === 'string') parts.push(plainOf(v));
    index.set(e.id, fold(parts.join(' ')));
  }
  return index;
}

export class CogitaLibrary {
  constructor(readonly store: LibraryStore, readonly writes: boolean) {}

  private memo: Memo | null = null;
  private cardMemo: { revision: number; seed: string; made: Promise<{ cards: Card[]; problems: Map<string, string[]> }> } | null = null;
  private sources: readonly Source[] = [];
  private round = 0;

  /** Ein Python-Läufer für die Vorlagen — von aussen hereingereicht, damit die Rechnung ohne Browser prüfbar bleibt. */
  python: ((code: string, args: readonly unknown[]) => Promise<unknown>) | undefined;

  get libraryId(): string { return this.store.libraryId; }
  get areaId(): string { return this.store.areaId; }

  /** Steigt mit jeder Änderung — der eigenen und der jeder Quelle (alle steigen nur). */
  get revision(): number {
    return this.store.revision + this.round + this.sources.reduce((sum, s) => sum + s.store.revision, 0);
  }

  /** 0110 — die geöffneten Quellen (`sources.ts` lädt sie); gerechnet wird beim nächsten Fragen. */
  setSources(list: readonly Source[]): void {
    this.sources = list.filter((s) => s.store.libraryId !== this.store.libraryId);
    this.round += 1;
  }

  sourceList(): readonly Source[] { return this.sources; }

  private stamp(): string {
    return `${this.store.revision}|${this.round}|${this.sources.map((s) => s.store.revision).join(',')}`;
  }

  private fresh(): Memo {
    const stamp = this.stamp();
    if (this.memo !== null && this.memo.stamp === stamp) return this.memo;
    const own = this.store.all();
    const theirs = this.sources.filter((s) => s.kind === 'knowledge').flatMap((s) => s.store.all());
    const books = this.sources.filter((s) => s.kind === 'books').flatMap((s) => s.store.all());
    const merged = new Set<string>();
    for (const e of [...own, ...theirs]) if (e.kind === 'merge' && typeof e.data.from === 'string') merged.add(e.data.from);
    /* Zuerst die Quellen, dann die eigenen: wer hier eine eingebaute Art ändert, gewinnt. */
    const kinds = kindDefs([...theirs, ...own]);
    const entities = [...own, ...theirs].map(entityOf).filter((e): e is Entity => e !== null && !merged.has(e.id));
    const refs = books.map(entityOf).filter((e): e is Entity => e !== null);
    const added = new Set([...theirs, ...own].flatMap((e) => (e.kind === 'kind' && typeof e.data.builtin === 'string' ? [e.data.builtin] : [])));
    const byKind = new Map<string, Entity[]>();
    for (const e of entities) for (const k of e.kinds) byKind.set(k, [...(byKind.get(k) ?? []), e]);
    const docs = new Map<DocKind, Entry[]>(DOC_KINDS.map((k) => [k, []]));
    for (const e of own) if (docs.has(e.kind as DocKind)) docs.get(e.kind as DocKind)!.push(e);
    for (const e of theirs) if (SHARED_DOCS.has(e.kind)) docs.get(e.kind as DocKind)!.push(e);
    const origin = new Map<string, Origin>();
    const mark = (store: LibraryStore, name: string, kind: SourceKind, mine: boolean) => {
      const from: Origin = { libraryId: store.libraryId, areaId: store.areaId, name, own: mine, kind };
      for (const e of store.all()) if (!origin.has(e.id)) origin.set(e.id, from);
    };
    mark(this.store, 'ta baza wiedzy', 'knowledge', true);
    for (const s of this.sources) mark(s.store, s.name, s.kind, false);
    this.memo = {
      /*
        2026-10-18 — KEIN RODZAJ VON SICH AUS: die eingebauten (Temat, Wiedza,
        Pytanie) stehen nur da, wo man sie hinzugefügt (oder geändert) hat oder
        wo es Einträge von ihnen gibt. Die Maschine kennt sie trotzdem (`look`).
      */
      stamp, kinds, contentKinds: kinds.filter((k) => !BOOK_KINDS.has(k.id) && (!isBaseKind(k.id) || byKind.has(k.id) || added.has(k.id))), entities, refs,
      look: lookupOf(kinds, [...entities, ...refs]), byKind, docs, origin, backlinks: null, search: null, refSearch: null, markup: null, materialKinds: null
    };
    return this.memo;
  }

  /** Die Arten dieser Baza wiedzy — eingebaut, geändert, eigene, aus wiederverwendeten Quellen; ohne die der Bibliotheken. */
  get kinds(): readonly KindDef[] { return this.fresh().contentKinds; }
  /** Dazu die Arten der Bibliotheken — als Ziele eines Verweises. */
  get refKinds(): readonly KindDef[] { return this.fresh().kinds; }

  /**
   * 2026-10-22 — STOFF ZUM LERNEN (Schritt 5): die eigenen Arten und die Arten
   * der Bibliotheken, aus denen diese Baza wiedzy schöpft — sofern dort
   * Einträge stehen (Cytaty, Dzieła, Teksty, Komentarze …). Szablony und
   * Powtórki dürfen sie wählen; „Wpisy" listet weiter nur das Eigene.
   */
  get materialKinds(): readonly KindDef[] {
    const m = this.fresh();
    m.materialKinds ??= [...m.contentKinds, ...m.kinds.filter((k) => BOOK_KINDS.has(k.id) && m.refs.some((r) => r.kinds.includes(k.id)))];
    return m.materialKinds;
  }

  /** Die Einträge einer Art als Stoff: die eigenen (und die der Bazy wiedzy) — bei einer Art der Bibliotheken auch deren Einträge. */
  material(kindId: string): readonly Entity[] {
    const own = this.ofKind(kindId);
    if (!BOOK_KINDS.has(kindId)) return own;
    return [...own, ...this.fresh().refs.filter((r) => r.kinds.includes(kindId))];
  }

  /** Woraus die Wpisy rodzaju und Dystraktory eines Szablons schöpfen: für Stoff einer Bibliothek aus dem Stoff, sonst aus dem Eigenen. */
  poolFor(entity: Entity): (kindId: string) => readonly Entity[] {
    return this.fresh().refs.includes(entity) ? (k) => this.material(k) : (k) => this.ofKind(k);
  }

  /**
   * Was eine Powtórka zum Wählen braucht — die Karten, die Arten eines
   * Eintrags (auch eines aus einer Bibliothek), Zbiory, Themen, den
   * Fortschritt, und (2026-10-22) woher ein Eintrag kommt.
   */
  revisionContext(cards: readonly Card[], marks: (key: string) => readonly Mark[], now: number): RevisionContext {
    return {
      cards,
      kindsOf: (id) => this.entity(id)?.kinds ?? [],
      collection: (id) => this.members(id),
      topic: (id, depth) => this.topicTree(id, depth),
      marks,
      now,
      from: (id) => this.origin(id)?.libraryId
    };
  }
  get look(): Lookup { return this.fresh().look; }
  kind(id: string): KindDef | undefined { return this.fresh().look.kind(id); }
  entities(): readonly Entity[] { return this.fresh().entities; }
  entity(id: string): Entity | undefined { return this.fresh().look.entity(id); }
  entry(id: string): Entry | undefined {
    return this.store.get(id) ?? this.sources.map((s) => s.store.get(id)).find((e) => e !== undefined);
  }

  /** Gehört der Eintrag dieser Baza wiedzy (und lässt sich hier ändern)? */
  isOwn(id: string): boolean { return this.store.get(id) !== undefined; }
  /** Woher er kommt — `undefined`: es gibt ihn hier nicht. */
  origin(id: string): Origin | undefined { return this.fresh().origin.get(id); }
  /** In welchem Bereich eine Bibliothek liegt (diese oder eine Quelle) — für ihre Schlüssel und Dateien. */
  areaOf(libraryId: string): string | undefined {
    if (libraryId === this.store.libraryId) return this.store.areaId;
    return this.sources.find((s) => s.store.libraryId === libraryId)?.store.areaId;
  }

  /** Ein Verweis im Zapis nennt eine Kennung oder einen Zitierschlüssel — hier wird es eine Kennung (auch aus einer Quelle). */
  resolve(token: string): string | undefined {
    for (const store of [this.store, ...this.sources.map((s) => s.store)]) {
      if (store.get(token) !== undefined) return token;
      const found = store.byKey(token);
      if (found !== undefined) return found.id;
    }
    return undefined;
  }
  ofKind(kindId: string): readonly Entity[] { return this.fresh().byKind.get(kindId) ?? []; }
  docs(kind: DocKind): readonly Entry[] { return this.fresh().docs.get(kind) ?? []; }
  label(entity: Entity): string { return labelOf(entity, this.look); }

  /**
   * 2026-10-22 — DER ZAPIS EINES WISSENS liest mit denselben Bausteinen wie ein
   * Text der Bibliothek (`markupView.tsx`): eine Kennung oder ein Schlüssel
   * wird ein Eintrag — hier oder in einer Quelle. Ein Werk, ein Zitat, eine
   * Person werden Fussnoten, alles andere ein Link mit dem Etikett.
   */
  get markupLook(): MarkupLookup {
    const m = this.fresh();
    if (m.markup === null) {
      const look: MarkupLookup = {
        get: (id) => this.entry(id),
        byKey: (key) => { const id = this.resolve(key); return id === undefined ? undefined : this.entry(id); },
        title: (entry) => { const e = this.entity(entry.id); return e === undefined ? entryTitle(entry, look) : this.label(e); }
      };
      m.markup = look;
    }
    return m.markup;
  }
  tell(entity: Entity): string { return tellOf(entity, this.look); }

  /** Wer auf wen zeigt — mit dem Namen der Gegenseite [B9, B10]. */
  backlinks(id: string): readonly Backlink[] {
    const m = this.fresh();
    m.backlinks ??= refIndex(m.entities, m.look);
    return m.backlinks.get(id) ?? [];
  }

  /**
   * Suchen in Etiketten und Textwerten, ohne Rücksicht auf Akzente. `refs`:
   * auch in dem, worauf man nur verweist (die Bücher der Bibliotheken) — für
   * ein Verweisfeld, nicht für das, was man lernt.
   */
  search(query: string, kinds?: readonly string[], refs = false): Entity[] {
    const m = this.fresh();
    const pool = refs ? [...m.entities, ...m.refs] : m.entities;
    const index = refs ? (m.refSearch ??= searchIndex(pool, m.look)) : (m.search ??= searchIndex(m.entities, m.look));
    const words = fold(query).split(/\s+/).filter(Boolean);
    return pool.filter((e) => (kinds === undefined || kinds.some((k) => e.kinds.includes(k)))
      && words.every((w) => (index.get(e.id) ?? '').includes(w)));
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

  /** Die eigenen Einstellungen — die einer Quelle gelten dort. */
  settingsEntry(): Entry | undefined { return this.docs('settings')[0]; }
  settings(): CogitaSettings { return readSettings(this.settingsEntry()?.data); }

  /**
   * Die bestätigten Abhängigkeiten — was die Kenntnis weitergibt und sperrt.
   * 0110: die wiederverwendeter Bazy wiedzy gelten mit; die eigene gewinnt.
   */
  dependencies(): Dependency[] {
    const out = new Map<string, Dependency>();
    const add = (list: readonly DependencyEdge[]) => {
      for (const d of list) if (d.proposed !== true) out.set(`${d.parent}>${d.child}`, { parent: d.parent, child: d.child, kind: d.kind, impact: d.impact });
    };
    for (const s of this.sources) if (s.kind === 'knowledge') add(readSettings(s.store.all().find((e) => e.kind === 'settings')?.data).dependencies);
    add(this.settings().dependencies);
    return [...out.values()];
  }

  /** Zusammengeführt [B16]: wer in wen aufging. */
  merges(): ReadonlyMap<string, string> {
    const out = new Map<string, string>();
    for (const e of this.docs('merge')) if (typeof e.data.from === 'string' && typeof e.data.to === 'string') out.set(e.data.from, e.data.to);
    return out;
  }

  /* -- Schreiben ------------------------------------------------------------------------------ */

  /** 0110 — was aus einer Quelle kommt, wird dort geändert: hier geht nur die eigene Baza wiedzy. */
  private ownOnly(id: string | undefined): void {
    if (id === undefined || this.store.get(id) !== undefined) return;
    const from = this.origin(id);
    if (from !== undefined) throw new Error(`To pochodzi z „${from.name}" — zmień to tam.`);
  }

  /** Eine Entität speichern — die Arten in ihrer Reihenfolge, die Daten wie sie sind. */
  async saveEntity(input: { readonly id?: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }): Promise<Entry> {
    this.ownOnly(input.id);
    const before = input.id === undefined ? undefined : this.store.get(input.id);
    const plain = before?.kind ?? plainKindOf(input.kinds);
    const data = entryData({ kinds: input.kinds, data: input.data }, plain, before?.data ?? {});
    return this.store.save({ ...(input.id === undefined ? {} : { id: input.id }), kind: plain, ...(before?.key === undefined ? {} : { key: before.key }), data });
  }

  /**
   * 2026-10-17 — VIELE ENTITÄTEN AUF EINMAL (Formularze dodawania): neue mit
   * ihrer schon vergebenen Kennung, vorhandene ergänzt. Was aus einer Quelle
   * kommt, wird vorher abgelehnt — dann geht nichts.
   */
  async saveMany(
    list: readonly { readonly id: string; readonly kinds: readonly string[]; readonly data: Readonly<Record<string, unknown>> }[],
    progress?: (done: number, total: number) => void
  ): Promise<{ saved: number; failed: { id: string; error: string }[] }> {
    for (const one of list) this.ownOnly(one.id);
    const inputs = list.map((one) => {
      const before = this.store.get(one.id);
      const plain = before?.kind ?? plainKindOf(one.kinds);
      return { id: one.id, kind: plain, ...(before?.key === undefined ? {} : { key: before.key }), data: entryData({ kinds: one.kinds, data: one.data }, plain, before?.data ?? {}) };
    });
    const done = await this.store.saveMany(inputs, progress);
    return { saved: done.saved.length, failed: done.failed };
  }

  /** Eine Art speichern — eine eingebaute als Änderung (`builtin`), eine eigene als ihr Eintrag. */
  async saveKind(kind: KindDef): Promise<Entry> {
    if (isBaseKind(kind.id)) {
      const had = overrideEntryOf(this.store.all(), kind.id);
      return this.store.save({ ...(had === undefined ? {} : { id: had.id }), kind: 'kind', data: kindDoc(kind) });
    }
    this.ownOnly(kind.id);
    /* Die Kennung des Entwurfs bleibt — sonst zeigen ein Verweis auf sich selbst, die Auswahl danach und importierte Einträge ins Leere. */
    return this.store.save({ id: kind.id, kind: 'kind', data: kindDoc(kind) });
  }

  saveDoc(kind: DocKind, data: Readonly<Record<string, unknown>>, id?: string): Promise<Entry> {
    this.ownOnly(id);
    return this.store.save({ ...(id === undefined ? {} : { id }), kind, data: { ...data } });
  }

  async saveSettings(patch: Partial<Record<keyof CogitaSettings, unknown>>): Promise<Entry> {
    const had = this.settingsEntry();
    return this.saveDoc('settings', { ...(had?.data ?? {}), ...patch }, had?.id);
  }

  async remove(id: string): Promise<void> {
    this.ownOnly(id);
    return this.store.remove(id);
  }

  /** Die eingebauten Rodzaje, die hier (noch) nicht stehen — zum Hinzufügen. */
  missingBuiltins(): KindDef[] {
    /* 2026-10-22 — „Wiedza" nicht mehr: Aussagen sind Komentarze einer Bibliothek (Schritt 6). */
    return ['topic', 'question'].filter((id) => !this.kinds.some((k) => k.id === id)).map((id) => baseKind(id)).filter((k): k is KindDef => k !== undefined);
  }

  /** Einen eingebauten Rodzaj hinzufügen — er steht dann da, auch ohne Einträge. */
  async addBuiltin(id: string): Promise<void> {
    const kind = baseKind(id);
    if (kind !== undefined) await this.saveKind(kind);
  }

  /** 2026-10-18 — was es heisst, diesen Rodzaj zu entfernen (`kindRemoval.ts`). */
  planKindRemoval(kindId: string): KindRemoval | null {
    const kind = this.kind(kindId);
    if (kind === undefined) return null;
    const docs = (k: DocKind) => this.docs(k).map((e) => ({ id: e.id, data: e.data }));
    return planKindRemoval({
      kind, isBase: isBaseKind(kindId), kinds: this.kinds, entities: this.entities(), look: this.look, isOwn: (id) => this.isOwn(id),
      templates: docs('template'), forms: docs('addform'), collections: docs('collection')
    });
  }

  /** Den Plan ausführen: erst was bleibt umschreiben, dann löschen, zuletzt den Rodzaj selbst. */
  async removeKind(plan: KindRemoval, progress?: (text: string) => void): Promise<void> {
    if (plan.blocked !== null) throw new Error(plan.blocked);
    const rewrite = [...plan.unlink, ...plan.narrow];
    if (rewrite.length > 0) {
      progress?.(`Poprawianie odwołań… (${rewrite.length})`);
      const done = await this.saveMany(rewrite.map((c) => ({ id: c.id, kinds: c.kinds, data: c.data })));
      if (done.failed.length > 0) throw new Error(`Nie zapisano ${done.failed.length} wpisów: ${done.failed[0].error}`);
    }
    for (const k of plan.kinds) await this.saveKind(k);
    for (const d of [...plan.templates.map((x) => ['template', x] as const), ...plan.forms.map((x) => ['addform', x] as const), ...plan.collections.map((x) => ['collection', x] as const)]) {
      const [kind, change] = d;
      if (change.data === null) await this.store.remove(change.id); else await this.saveDoc(kind, change.data, change.id);
    }
    let n = 0;
    for (const id of plan.remove) {
      await this.store.remove(id);
      n += 1;
      if (n % 10 === 0 || n === plan.remove.length) progress?.(`Usuwanie wpisów… ${n} z ${plan.remove.length}`);
    }
    if (isBaseKind(plan.kind.id)) {
      const override = overrideEntryOf(this.store.all(), plan.kind.id);
      if (override !== undefined) await this.store.remove(override.id);
    } else {
      await this.store.remove(plan.kind.id);
    }
  }

  /**
   * ZUSAMMENFÜHREN [B16]: jeder Verweis auf `drop` zeigt danach auf `keep`;
   * was `drop` hatte und `keep` nicht, geht mit; `drop` wird gelöscht und ein
   * Vermerk „połączony z" bleibt (für Seiten und Fortschritte, die ihn nennen).
   * Beide müssen dieser Baza wiedzy gehören; umgeschrieben werden ihre eigenen
   * Einträge. Gibt zurück, wie viele Einträge umgeschrieben wurden.
   */
  async merge(keepId: string, dropId: string): Promise<number> {
    const keep = this.entity(keepId);
    const drop = this.entity(dropId);
    if (keep === undefined || drop === undefined || keepId === dropId) return 0;
    this.ownOnly(keepId);
    this.ownOnly(dropId);
    let rewritten = 0;
    for (const other of this.entities()) {
      if (other.id === dropId || !this.isOwn(other.id)) continue;
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
    this.ownOnly(id);
    const entry = this.store.get(id);
    if (entry === undefined) return;
    const entity = this.entity(id);
    if (entity === undefined) return;
    const checked: Record<string, string> = {};
    for (const token of linkedOf(entity, this.look)) {
      const linked = this.resolve(token);
      const at = linked === undefined ? undefined : this.entry(linked)?.updatedAt;
      if (linked !== undefined && at !== undefined) checked[linked] = at;
    }
    await this.store.save({ id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: { ...entry.data, _checked: checked } });
  }

  /* -- Karten -------------------------------------------------------------------------------- */

  /**
   * ALLE KARTEN dieser Baza wiedzy: jede Vorlage für jede Entität ihrer Arten,
   * jede von Hand geschriebene Frage, jedes Thema mit Antworten — die eigenen
   * und die wiederverwendeter Quellen. 2026-10-22: dazu der Stoff der
   * Bibliotheken — ein Szablon für eine ihrer Arten (Cytat, Dzieło, Tekst,
   * Komentarz …) gibt Karten ihrer Einträge, mit Schlüsseln `szablon:wpis` wie
   * sonst; ihre Themen geben (noch) keine. Je Stand der Speicher und Samen
   * einmal gerechnet.
   */
  cards(seed = ''): Promise<{ cards: Card[]; problems: Map<string, string[]> }> {
    const revision = this.revision;
    if (this.cardMemo !== null && this.cardMemo.revision === revision && this.cardMemo.seed === seed) return this.cardMemo.made;
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
      const material = (kind: string) => this.material(kind);
      for (const entity of this.fresh().refs) {
        for (const template of templatesFor(entity, templates).filter((t) => t.kinds.some((k) => BOOK_KINDS.has(k) && entity.kinds.includes(k)))) {
          const done = await cardsOf(template, { look, entity, pool: material, seed, ...(this.python === undefined ? {} : { python: this.python }) });
          cards.push(...done.cards);
          if (done.problems.length > 0) problems.set(template.id, [...(problems.get(template.id) ?? []), ...done.problems]);
        }
      }
      return { cards, problems };
    })();
    this.cardMemo = { revision, seed, made };
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
