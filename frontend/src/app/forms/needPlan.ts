/**
 * 0086 / 2026-10-24 — WAS EIN EINGESCHALTETES WYMAGANIE HÄLT, und der PLAN,
 * wie es hineinkommt, umgestellt oder aus einem Dokument übernommen wird. Was
 * ein Wymaganie ist (Wortlaute, Einstellungen, Gestalt), steht in `needs.ts`;
 * ausgeführt wird der Plan in `formTemplates.ts`. Alles ohne Netz — geprüft
 * in `app-platform-check` und `app-json-check`.
 */

import type { FormContent, QuestionJson } from './formJson';
import { EMPTY_DESIGN, layoutWith, type FormDesign, type LayoutItem, type LogicEdge, type LogicNode } from './formDesign';
import { newId } from '../core/ids';
import { choiceOf, NEED_SIGNER, needOf, type FormNeed, type NeedChoice, type NeedShape, type Q } from './needs';

/* -- Was ein eingeschaltetes Wymaganie hält (config.needs) ----------------------------- */

/**
 * In der Einstellung `needs` des Formulars — eine Liste, eine Zeile je
 * eingeschaltetem Wymaganie, mit den Kennungen dessen, was es hält.
 */
export interface NeedOn {
  readonly id: string;
  readonly label: string;
  /** ALLE seine Fragen — auch die weiterbenutzten. Gesperrt, solange es eingeschaltet ist. */
  readonly fields: readonly string[];
  /** Die, die es selbst angelegt hat — beim Ausschalten gehen nur sie. */
  readonly added: readonly string[];
  /** Seine Gruppen und Texte im Aufbau. */
  readonly items: readonly string[];
  /** Seine Logik. */
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
  /** Hat es die Regel „do podpisu” gesetzt? Dann nimmt es sie beim Ausschalten mit. */
  readonly paper?: boolean;
  /** 2026-10-24 — die gewählten Einstellungen. Fehlt: wie vor den Einstellungen (`was`). */
  readonly choice?: NeedChoice;
  /** 2026-10-24 — Schlüssel des Wzór → Kennung hier: so bleibt beim Umstellen, was beide Fassungen brauchen. */
  readonly keys?: Readonly<Record<string, string>>;
}

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : []);

function readChoice(v: unknown): NeedChoice | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const out: Record<string, readonly string[]> = {};
  for (const [key, one] of Object.entries(v as Record<string, unknown>)) {
    const list = (Array.isArray(one) ? one : [one]).filter((x): x is string => typeof x === 'string' && x !== '');
    if (list.length > 0) out[key] = list;
  }
  return out;
}

function readKeys(v: unknown): Record<string, string> | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, one] of Object.entries(v as Record<string, unknown>)) if (typeof one === 'string' && one !== '') out[key] = one;
  return Object.keys(out).length === 0 ? undefined : out;
}

/** Duldsam gelesen: Unlesbares heisst „nichts eingeschaltet". */
export function readNeeds(text: string | null | undefined): NeedOn[] {
  if (text == null || text.trim() === '') return [];
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(raw)) return [];
  const out: NeedOn[] = [];
  for (const one of raw) {
    if (typeof one !== 'object' || one === null) continue;
    const r = one as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id === '' || out.some((x) => x.id === r.id)) continue;
    const choice = readChoice(r.choice);
    const keys = readKeys(r.keys);
    out.push({
      id: r.id,
      label: typeof r.label === 'string' && r.label !== '' ? r.label : needOf(r.id)?.label ?? r.id,
      fields: ids(r.fields), added: ids(r.added), items: ids(r.items), nodes: ids(r.nodes), edges: ids(r.edges),
      ...(r.paper === true ? { paper: true } : {}),
      ...(choice === undefined ? {} : { choice }),
      ...(keys === undefined ? {} : { keys })
    });
  }
  return out;
}

/** Zurück in die Einstellung — leer, wenn keines eingeschaltet ist (dann fällt der Schlüssel weg). */
export const needsJson = (needs: readonly NeedOn[]): string => (needs.length === 0 ? '' : JSON.stringify(needs));

/** Die Einstellungen eines eingeschalteten Wymaganie — ein Eintrag ohne sie gilt wie damals. */
export const choiceOfOn = (on: NeedOn): NeedChoice => {
  const need = needOf(on.id);
  return need === undefined ? {} : choiceOf(need, on.choice, 'was');
};

/** Die Kennungen der Gruppen und Texte eines Aufbaus (ohne die Fragen) — in der Reihenfolge, in der sie dastehen. */
export const itemIds = (layout: readonly LayoutItem[]): string[] =>
  layout.flatMap((one) => (one.type === 'field' ? [] : one.type === 'group' ? [one.id, ...itemIds(one.items)] : [one.id]));

/**
 * WAS EIN EINGESCHALTETES WYMAGANIE HÄLT, je Schlüssel des Wzór. Ein Eintrag
 * von vor den Einstellungen hat keine `keys` — er hält seine Fragen, Gruppen,
 * Knoten und Kanten in der Reihenfolge des Wzór (so legte `applyNeed` sie an);
 * passt die Zahl nicht, wird eine Frage an ihrer Angabe oder ihrem Wortlaut
 * erkannt, und was sich nicht zuordnen lässt, fehlt (es wird dann neu angelegt).
 */
export function keysOfOn(
  on: NeedOn, content?: Pick<FormContent, 'questions' | 'removed'>
): Record<string, string> {
  if (on.keys !== undefined) return { ...on.keys };
  const need = needOf(on.id);
  if (need === undefined) return {};
  const shape = need.shape(choiceOfOn(on));
  const out: Record<string, string> = {};
  const zip = (keys: readonly string[], values: readonly string[]) => {
    if (keys.length !== values.length) return false;
    keys.forEach((k, i) => { out[k] = values[i]; });
    return true;
  };
  if (!zip(shape.questions.map((q) => q.id), on.fields) && content !== undefined) {
    const all = [...content.questions, ...(content.removed ?? [])].filter((f) => on.fields.includes(f.id));
    for (const q of shape.questions) {
      const found = all.find((f) => ((q.identity ?? 'none') !== 'none' && f.identity === q.identity)
        || (f.kind === q.kind && (f.label ?? '').trim() === q.label));
      if (found !== undefined && !Object.values(out).includes(found.id)) out[q.id] = found.id;
    }
  }
  zip(itemIds(shape.layout), on.items);
  zip(shape.nodes.map((n) => n.id), on.nodes);
  zip(shape.edges.map((e) => e.id), on.edges);
  return out;
}

/** Was gesperrt ist — Frage, Knoten → der Name des Wymaganie; Kanten als Menge; Fragen, deren Möglichkeiten es festhält. */
export function lockedOf(needs: readonly NeedOn[]): {
  readonly fields: ReadonlyMap<string, string>;
  readonly nodes: ReadonlyMap<string, string>;
  readonly edges: ReadonlySet<string>;
  /** 2026-10-24 — eine Wahl, an deren Wortlaut die Logik hängt: ihre Möglichkeiten ändert nur das Wymaganie. */
  readonly options: ReadonlyMap<string, string>;
} {
  const fields = new Map<string, string>();
  const nodes = new Map<string, string>();
  const edges = new Set<string>();
  const options = new Map<string, string>();
  for (const need of needs) {
    for (const id of need.fields) if (!fields.has(id)) fields.set(id, need.label);
    for (const id of need.nodes) if (!nodes.has(id)) nodes.set(id, need.label);
    for (const id of need.edges) edges.add(id);
    const def = needOf(need.id);
    if (def === undefined) continue;
    const keys = keysOfOn(need);
    for (const q of def.shape(choiceOfOn(need)).questions) {
      const id = keys[q.id];
      if (q.options !== undefined && id !== undefined && !options.has(id)) options.set(id, need.label);
    }
  }
  return { fields, nodes, edges, options };
}

/**
 * Ein Aufbau ohne die Gruppen und Texte eines Wymaganie. Was in einer seiner
 * Gruppen steht und nicht ihm gehört (jemand hat eine eigene Frage
 * hineingeschoben), rückt an die Stelle der Gruppe — es geht nichts verloren.
 */
export function layoutWithout(layout: readonly LayoutItem[], items: ReadonlySet<string>, fields: ReadonlySet<string>): LayoutItem[] {
  return layout.flatMap((item): LayoutItem[] => {
    if (item.type === 'field') return fields.has(item.id) ? [] : [item];
    if (item.type === 'group') {
      const inner = layoutWithout(item.items, items, fields);
      return items.has(item.id) ? inner : [{ ...item, items: inner }];
    }
    return items.has(item.id) ? [] : [item];
  });
}

/**
 * 2026-10-24 — DASSELBE, ABER AN SEINER STELLE: die neue Fassung kommt dorthin,
 * wo die erste Gruppe der alten stand (vor das, was aus ihr nachrückt), und
 * nicht ans Ende. Stand dort nichts von ihr, kommt sie ans Ende.
 */
export function layoutReplacing(
  layout: readonly LayoutItem[], items: ReadonlySet<string>, fields: ReadonlySet<string>, insert: readonly LayoutItem[]
): LayoutItem[] {
  let placed = false;
  const walk = (list: readonly LayoutItem[]): LayoutItem[] => list.flatMap((item): LayoutItem[] => {
    if (item.type === 'field') return fields.has(item.id) ? [] : [item];
    if (items.has(item.id)) {
      const inner = item.type === 'group' ? walk(item.items) : [];
      if (placed) return inner;
      placed = true;
      return [...insert, ...inner];
    }
    return item.type === 'group' ? [{ ...item, items: walk(item.items) }] : [item];
  });
  const out = walk(layout);
  return placed ? out : [...out, ...insert];
}

/** Eine Logik ohne die Knoten und Kanten eines Wymaganie — und ohne Kanten, die an einem davon hingen. */
export function logicWithout(
  design: { readonly nodes: readonly LogicNode[]; readonly edges: readonly LogicEdge[] },
  nodes: ReadonlySet<string>, edges: ReadonlySet<string>
): { nodes: LogicNode[]; edges: LogicEdge[] } {
  return {
    nodes: design.nodes.filter((n) => !nodes.has(n.id)),
    edges: design.edges.filter((e) => !edges.has(e.id) && !nodes.has(e.from) && !nodes.has(e.to))
  };
}

/* -- Der Plan: ein Wymaganie hinein (oder umgestellt) ----------------------------------- */

export interface NeedPlan {
  readonly shape: NeedShape;
  /** Neue Fragen (Kennung aus `makeId`) und vorhandene Wahlen, deren Möglichkeiten das Wymaganie festhält. */
  readonly questions: readonly QuestionJson[];
  /** Vom Formular genommene Fragen, die zurückkommen. */
  readonly restore: readonly string[];
  /** Fragen, die gehen: es hat sie angelegt, braucht sie nicht mehr, und kein anderes hält sie. */
  readonly leaving: readonly string[];
  /** Der ganze Aufbau danach — neue Fragen noch mit ihrer vorläufigen Kennung. */
  readonly design: FormDesign;
  /** Schlüssel des Wzór → Kennung danach (neue Fragen vorläufig). */
  readonly keys: Readonly<Record<string, string>>;
  /** Was es danach selbst angelegt hat. */
  readonly added: readonly string[];
  /** Neu angelegte Fragen (vorläufige Kennungen). */
  readonly created: readonly string[];
  /** Vorhandene Fragen, die es zum ersten Mal mitbenutzt. */
  readonly reused: number;
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * WIE EIN WYMAGANIE IN DIESES FORMULAR KOMMT — eingeschaltet (`now: null`) oder
 * umgestellt (`now`: was es bisher hält). Ein Plan, noch ohne etwas zu ändern.
 *
 * <b>Fragen:</b> was es schon hält, bleibt (vom Formular genommen: kommt
 * zurück); sonst eine genormte Angabe, eine Frage mit demselben Wortlaut, eine
 * zurückgeholte — und erst dann eine neue. Was es angelegt hat und nicht mehr
 * braucht, geht, wenn kein anderes Wymaganie es hält.
 *
 * <b>Aufbau:</b> seine neuen Gruppen stehen, wo seine alten standen. Eine
 * Frage, die jemand aus seinen Gruppen hinausgeschoben hat, bleibt draussen.
 *
 * <b>Logik:</b> seine Knoten und Kanten werden ersetzt; eigene Kanten an einem
 * Knoten, den es behält, bleiben.
 */
export function planNeed(input: {
  readonly need: FormNeed;
  readonly choice: NeedChoice;
  readonly content: Pick<FormContent, 'questions' | 'removed' | 'design'>;
  readonly now: NeedOn | null;
  readonly others: readonly NeedOn[];
  readonly makeId?: () => string;
}): NeedPlan {
  const { need, choice, content, now, others } = input;
  const makeId = input.makeId ?? (() => `tpl-${newId()}`);
  const shape = need.shape(choice);
  const was = now === null ? {} : keysOfOn(now, content);

  const active = new Map(content.questions.map((q) => [q.id, q]));
  const removed = content.removed ?? [];
  const gone = new Map(removed.map((q) => [q.id, q]));
  const othersHold = new Set(others.filter((o) => o.id !== need.id).flatMap((o) => o.fields));

  const keys: Record<string, string> = {};
  const restore: string[] = [];
  const created: string[] = [];
  const fresh: QuestionJson[] = [];
  const edits: QuestionJson[] = [];
  const added = new Set(now?.added ?? []);
  const taken = new Set<string>();
  let reused = 0;

  const sameWords = (f: QuestionJson, q: Q) => f.kind === q.kind && (f.label ?? '').trim() === q.label;
  const sameIdentity = (f: QuestionJson, q: Q) => (q.identity ?? 'none') !== 'none' && f.identity === q.identity;

  for (const q of shape.questions) {
    let id: string | undefined;
    const mine = was[q.id];
    if (mine !== undefined && !taken.has(mine) && (active.has(mine) || gone.has(mine))) {
      id = mine;
      if (gone.has(mine)) restore.push(mine);
    }
    if (id === undefined) {
      const there = content.questions.find((f) => !taken.has(f.id) && sameIdentity(f, q))
        ?? content.questions.find((f) => !taken.has(f.id) && (q.identity ?? 'none') === 'none' && sameWords(f, q));
      if (there !== undefined) { id = there.id; reused += 1; }
    }
    if (id === undefined) {
      const back = removed.find((f) => !taken.has(f.id) && (sameIdentity(f, q) || sameWords(f, q)));
      if (back !== undefined) { id = back.id; restore.push(back.id); added.add(back.id); }
    }
    if (id === undefined) {
      id = makeId();
      created.push(id);
      added.add(id);
      fresh.push({
        id, kind: q.kind, label: q.label, help: q.help ?? null, options: q.options ?? [],
        required: q.required ?? false, halfWidth: q.half ?? false, identity: q.identity ?? 'none',
        selfEdit: q.selfEdit ?? true, answersTo: ''
      });
    }
    taken.add(id);
    keys[q.id] = id;

    /* Eine Wahl, an deren Wortlaut die Logik hängt: ihre Möglichkeiten sind die des Wymaganie. */
    const there = active.get(id) ?? gone.get(id);
    if (q.options !== undefined && there !== undefined && !sameList(there.options, q.options)) edits.push({ ...there, options: [...q.options] });
  }

  const held = new Set(shape.questions.map((q) => keys[q.id]));
  const leaving = [...(now?.added ?? [])].filter((id) => !held.has(id) && !othersHold.has(id) && active.has(id));

  /* -- Aufbau ------------------------------------------------------------------------- */
  const base = content.design ?? EMPTY_DESIGN;
  const oldItems = new Set(now?.items ?? []);
  const oldNodes = new Set(now?.nodes ?? []);
  const oldEdges = new Set(now?.edges ?? []);
  const materialized = layoutWith(base.layout, content.questions.map((q) => q.id));

  /* Was jemand ausserhalb seiner Gruppen hingestellt hat, bleibt dort. */
  const outside = new Set<string>();
  const walk = (items: readonly LayoutItem[], within: boolean) => {
    for (const item of items) {
      const inside = within || oldItems.has(item.id);
      if (item.type === 'field') { if (!inside) outside.add(item.id); }
      else if (item.type === 'group') walk(item.items, inside);
    }
  };
  walk(materialized, false);

  const reuse = (key: string, pool: ReadonlySet<string>) => {
    const old = was[key];
    keys[key] = old !== undefined && pool.has(old) ? old : makeId();
  };
  for (const key of itemIds(shape.layout)) reuse(key, oldItems);
  for (const n of shape.nodes) reuse(n.id, oldNodes);
  for (const e of shape.edges) reuse(e.id, oldEdges);

  const mapItem = (item: LayoutItem): LayoutItem[] => {
    if (item.type === 'field') {
      const id = keys[item.id];
      return outside.has(id) ? [] : [{ ...item, id }];
    }
    if (item.type === 'group') return [{ ...item, id: keys[item.id], items: item.items.flatMap(mapItem) }];
    return [{ ...item, id: keys[item.id] }];
  };
  const insert = shape.layout.flatMap(mapItem);
  const leavingSet = new Set(leaving);
  const replaced = layoutReplacing(materialized, oldItems, leavingSet, insert);
  const after = [...content.questions.map((q) => q.id).filter((id) => !leavingSet.has(id)), ...restore, ...created];
  const layout = [...layoutWith(replaced, after)];

  /* -- Logik -------------------------------------------------------------------------- */
  const keptNodes = new Set(shape.nodes.map((n) => keys[n.id]).filter((id) => oldNodes.has(id)));
  const goneNodes = new Set([...oldNodes].filter((id) => !keptNodes.has(id)));
  const rest = logicWithout(base, goneNodes, oldEdges);
  const nodes: LogicNode[] = [
    ...rest.nodes.filter((n) => !keptNodes.has(n.id)),
    ...shape.nodes.map((n): LogicNode => ({
      ...n,
      id: keys[n.id],
      ...(n.fieldId === undefined ? {} : { fieldId: keys[n.fieldId] ?? n.fieldId }),
      ...(n.target === undefined ? {} : { target: keys[n.target] ?? n.target })
    }))
  ];
  const edges: LogicEdge[] = [
    ...rest.edges,
    ...shape.edges.map((e): LogicEdge => ({ ...e, id: keys[e.id], from: keys[e.from], to: keys[e.to] }))
  ];

  return {
    shape,
    questions: [...fresh, ...edits],
    restore,
    leaving,
    design: { version: 1, layout, nodes, edges },
    keys,
    added: [...added].filter((id) => held.has(id)),
    created,
    reused
  };
}

/**
 * 2026-10-24 — WAS EIN DOKUMENT MITBRACHTE (`holds`: Schlüssel → Kennung im
 * Dokument), als hielte das Wymaganie es schon — damit `planNeed` es
 * weiterbenutzt, statt es ein zweites Mal anzulegen. Eine Frage zählt über ihre
 * Kennung hier (`ids`: Dokument → hier); Gruppen, Texte, Knoten und Kanten
 * behalten ihre. Was im Formular nicht steht, fällt weg — das legt das
 * Wymaganie dann neu an. `created`: was der Import eben anlegte; nur das darf
 * das Wymaganie später wieder nehmen. `null`: nichts davon ist da.
 */
export function adoptedOf(
  need: FormNeed, holds: Readonly<Record<string, string>>, ids: ReadonlyMap<string, string>,
  created: ReadonlySet<string>, content: Pick<FormContent, 'questions' | 'removed' | 'design'>
): NeedOn | null {
  const design = content.design ?? EMPTY_DESIGN;
  const questions = new Set([...content.questions, ...(content.removed ?? [])].map((q) => q.id));
  const items = new Set(itemIds(design.layout));
  const nodes = new Set(design.nodes.map((n) => n.id));
  const edges = new Set(design.edges.map((e) => e.id));
  const keys: Record<string, string> = {};
  const held = { fields: [] as string[], items: [] as string[], nodes: [] as string[], edges: [] as string[] };
  for (const [key, doc] of Object.entries(holds)) {
    const id = ids.get(doc) ?? doc;
    if (questions.has(id)) { keys[key] = id; held.fields.push(id); }
    else if (items.has(doc)) { keys[key] = doc; held.items.push(doc); }
    else if (nodes.has(doc)) { keys[key] = doc; held.nodes.push(doc); }
    else if (edges.has(doc)) { keys[key] = doc; held.edges.push(doc); }
  }
  if (Object.keys(keys).length === 0) return null;
  return { id: need.id, label: need.label, ...held, added: held.fields.filter((id) => created.has(id)), keys };
}

/**
 * WAS ES DANACH HÄLT — aus dem Plan, mit den echten Kennungen der neuen Fragen
 * (`real`: vorläufig → echt; was fehlt, ist nicht entstanden und fällt weg).
 */
export function holdingOf(need: FormNeed, choice: NeedChoice, plan: Pick<NeedPlan, 'shape' | 'keys' | 'added'>,
  real: (id: string) => string | undefined, paper: boolean): NeedOn {
  const keys: Record<string, string> = {};
  for (const [key, id] of Object.entries(plan.keys)) {
    const now = real(id);
    if (now !== undefined) keys[key] = now;
  }
  const list = (wanted: readonly string[]) => wanted.map((k) => keys[k]).filter((id): id is string => id !== undefined);
  return {
    id: need.id,
    label: need.label,
    fields: list(plan.shape.questions.map((q) => q.id)),
    added: plan.added.map(real).filter((id): id is string => id !== undefined),
    items: list(itemIds(plan.shape.layout)),
    nodes: list(plan.shape.nodes.map((n) => n.id)),
    edges: list(plan.shape.edges.map((e) => e.id)),
    ...(paper ? { paper: true } : {}),
    ...(need.settings.length === 0 ? {} : { choice }),
    keys
  };
}

/**
 * DIE REGEL „DO PODPISU" nach dem Einschalten oder Umstellen: eine Fassung mit
 * Papier setzt ihre Regel (ausser „zawsze" — das ist mehr); eine ohne Papier
 * nimmt die Regel zurück, die das Wymaganie selbst gesetzt hatte.
 */
export function paperAfter(need: FormNeed, shape: NeedShape, now: NeedOn | null, config: Readonly<Record<string, string>>): {
  readonly set: Record<string, string>;
  readonly paper: boolean;
} {
  const rule = (config.paper ?? '').trim();
  if (shape.paper !== undefined) {
    if (rule === 'always') return { set: {}, paper: now?.paper === true };
    return { set: { paper: shape.paper, ...(shape.signer === undefined ? {} : { paperSigner: shape.signer }) }, paper: true };
  }
  if (now?.paper === true && need.papers.includes(rule)) {
    return { set: { paper: '', ...((config.paperSigner ?? '') === NEED_SIGNER ? { paperSigner: '' } : {}) }, paper: false };
  }
  return { set: {}, paper: false };
}
