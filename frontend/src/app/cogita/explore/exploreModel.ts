/**
 * 2026-11-24 (Eigentümer: „als Lehrer schnell durchgehen — alle Folien nacheinander, die Fragen …, mit Befehl für die KI") — DER
 * PRZEGLĄD EINER BAZA: alles, was gelernt wird, als EIN Strom zum Durchlesen, geordnet wie die Welt es zeigt.
 *
 * <code>
 *   Gruppen   die oberen Tags der Weltkarte (sonst eine: alle Türme), darin die Türme in der Reihenfolge der Welt
 *   Turm      seine Pfade (die Linien, die bei ihm enden), je Pfad die Schritte in der Reihenfolge der Erzählung (`storyPath`:
 *             jeder Zweig einmal), danach, was der Pfad sonst zeigt (Nachhilfe, nur über Fehler erreichbar: `help`); dann was am
 *             Turm hängt, ohne in einem Pfad zu stehen (Fragen über ihn, Folien, die ihn erklären)
 *   Auswahl   alles · eine Gruppe · ein Turm · ein Pfad · alle Folien · alle Fragen · ein Weg zu einer Frage (qpath)
 * </code>
 *
 * Eine Teilwelt (die Klasse, `classes/subWorld.ts`) beschneidet den Eingang wie auf der Karte: Türme ausserhalb, ihre Pfade und
 * Fragen fehlen. Rein: keine Anfrage, kein DOM — `scripts/app-explore-check.mjs`.
 */

import { t } from '../../core/i18n';
import type { Card } from '../cardBasics';
import type { GraphNode } from '../graph';
import { nameIn } from '../json';
import { fieldsOf } from '../schema';
import type { CogitaLibrary } from '../store';
import { storyPath, type WorkOfStep } from '../storyPath';
import type { LandscapeOnly } from '../views';
import { readWorld } from '../worldmap/wmGraph';
import { placeKindsOf, worldInputOf } from '../worldmap/wmInput';
import { linesOf } from '../worldmap/wmLines';
import { readPath } from '../worldmap/wmPaths';
import { worldTags } from '../worldmap/wmTags';
import type { Lines, World, WorldInput } from '../worldmap/wmTypes';
import { baseWorldViewOf, restrictWorldInput, subWorldPlaces } from '../classes/subWorld';

export type ExploreKind = 'slide' | 'question';

export interface ExploreItem {
  /** Fest je Stelle im Strom (ein Ding kann in mehreren Pfaden stehen). */
  readonly key: string;
  readonly kind: ExploreKind;
  /** Der Eintrag (Folie oder Frage). */
  readonly id: string;
  readonly flow: string | null;
  readonly step: string | null;
  readonly tower: string | null;
  /** Nachhilfe: nur über eine falsche Antwort erreichbar (zählt nie). */
  readonly help: boolean;
  /** Eine Vorhersage (`predict: true` am Schritt). */
  readonly predict: boolean;
}

export interface ExploreSection {
  readonly key: string;
  readonly kind: 'tower' | 'path' | 'loose' | 'list';
  readonly title: string;
  /** Der Turm, zu dem der Abschnitt gehört (eine Überschrift darüber). */
  readonly tower: string | null;
  readonly flow: string | null;
  readonly items: readonly ExploreItem[];
}

export interface ExploreTower {
  readonly id: string;
  readonly label: string;
  readonly paths: readonly { readonly flow: string; readonly name: string }[];
}

export interface ExploreModel {
  readonly groups: readonly { readonly key: string; readonly label: string; readonly towers: readonly string[] }[];
  readonly towers: ReadonlyMap<string, ExploreTower>;
  /** Die Türme in der Reihenfolge der Welt (Grundlagen zuerst). */
  readonly order: readonly string[];
  /** Pfade ohne Turm (keine Einheit, kein Ziel). */
  readonly loosePaths: readonly { readonly flow: string; readonly name: string }[];
  readonly qpaths: readonly { readonly id: string; readonly title: string; readonly towers: readonly string[]; readonly flows: readonly string[] }[];
  /** Je Pfad seine Dinge in der Reihenfolge der Erzählung. */
  readonly pathItems: ReadonlyMap<string, readonly ExploreItem[]>;
  /** Je Turm, was ohne Pfad an ihm hängt. */
  readonly looseItems: ReadonlyMap<string, readonly ExploreItem[]>;
  /** Folien und Fragen, die zu keinem Turm und keinem Pfad gehören. */
  readonly orphans: readonly ExploreItem[];
  readonly slides: ReadonlySet<string>;
  readonly questions: ReadonlySet<string>;
  /** Der lesbare Name eines Dings. */
  readonly label: (id: string) => string;
  /** Sein bleibender Name (`@…`, wie ein Import ihn nennt). */
  readonly ref: (id: string) => string;
}

export type ExploreSelection =
  | { readonly kind: 'all' }
  | { readonly kind: 'group'; readonly key: string }
  | { readonly kind: 'tower'; readonly id: string }
  | { readonly kind: 'path'; readonly flow: string }
  | { readonly kind: 'slides' }
  | { readonly kind: 'questions' }
  | { readonly kind: 'qpath'; readonly id: string };

export type ExploreShow = 'both' | 'slides' | 'questions';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])
  .map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x !== null && typeof (x as { value?: unknown }).value === 'string' ? (x as { value: string }).value : ''))
  .map((x) => x.trim()).filter((x) => x !== '');

/** Der Widok der Weltkarte einer Baza (ohne Klassen-Widoki) und was er als Türme nennt. */
function worldKinds(lib: CogitaLibrary): string[] {
  const id = baseWorldViewOf(lib);
  const doc = id === null ? undefined : lib.docs('view').find((d) => d.id === id);
  if (doc === undefined) return [];
  const data = doc.data as { landscape?: { style?: unknown }; steps?: unknown };
  return data.landscape?.style === 'world' && Array.isArray(data.steps) ? placeKindsOf(data as never) : [];
}

/** Was ein Schritt zeigt oder fragt — die Einträge, in der Reihenfolge des Schritts. */
function stepThings(node: GraphNode, cardQuestion: (key: string) => string | undefined): { slides: string[]; questions: string[] } {
  switch (node.type) {
    case 'show': case 'expand': case 'opening': case 'line':
      return { slides: strings(node.config.of), questions: [] };
    case 'question': {
      const of = str(node.config.of);
      const viaCard = str(node.config.card);
      const q = of !== '' ? of : viaCard !== '' ? cardQuestion(viaCard) ?? '' : '';
      return { slides: [], questions: q === '' ? [] : [q] };
    }
    case 'scene':
      return node.config.question === true ? { slides: [], questions: strings(node.config.asks) } : { slides: strings(node.config.about), questions: [] };
    default:
      return { slides: [], questions: [] };
  }
}

/**
 * DAS MODELL: die Welt, wie die Karte sie liest (`worldInputOf` → `readWorld` → `linesOf`), beschnitten auf eine Teilwelt (`only`),
 * und daraus Türme, Pfade, Gruppen und die Dinge je Pfad in der Reihenfolge der Erzählung.
 */
export function buildExplore(lib: CogitaLibrary, cards: readonly Card[], only: LandscapeOnly | null = null): ExploreModel {
  const kinds = worldKinds(lib);
  const fullInput: WorldInput = worldInputOf(lib, cards, kinds.length === 0 ? {} : { placeKinds: kinds });
  const fullWorld = readWorld(fullInput);
  const allowed = subWorldPlaces(fullWorld, worldTags(fullWorld), only);
  const input = allowed === null ? fullInput : restrictWorldInput(fullInput, fullWorld, linesOf(fullWorld, fullInput.flows), allowed);
  const world: World = allowed === null ? fullWorld : readWorld(input);
  const lines: Lines = linesOf(world, input.flows);
  const named = nameIn(lib);
  const label = (id: string): string => { const e = lib.entity(id); return e === undefined ? id : lib.label(e) || id; };
  const ref = (id: string): string => `@${named(id)}`;
  const isPlace = (id: string) => world.places.has(id);
  const questionKinds = new Set(input.questionKinds ?? ['question']);
  const isQuestion = (id: string) => (lib.entity(id)?.kinds ?? []).some((k) => questionKinds.has(k));
  const cardQuestion = (key: string) => cards.find((c) => c.key === key)?.question;

  /* Folien: was Schritte zeigen, und jeder eigene Eintrag mit einem Feld „blocks" (keine Frage, kein Turm). */
  const slides = new Set<string>();
  const questions = new Set<string>();
  for (const f of input.flows) for (const n of f.graph.nodes) { const th = stepThings(n, cardQuestion); th.slides.forEach((s) => slides.add(s)); th.questions.forEach((q) => questions.add(q)); }
  for (const e of lib.entities()) {
    if (!lib.isOwn(e.id) || isPlace(e.id)) continue;
    if (allowed !== null && !world.entries.has(e.id)) continue;
    if (isQuestion(e.id)) questions.add(e.id);
    else if (fieldsOf(e, lib.look).some((f) => f.type === 'blocks')) slides.add(e.id);
  }
  for (const id of [...slides]) if (isQuestion(id) || isPlace(id) || lib.entity(id) === undefined) slides.delete(id);
  for (const id of [...questions]) if (!isQuestion(id) || lib.entity(id) === undefined) questions.delete(id);

  /* Wo eine Folie steht (wie `worldChecks` / `linesOf`), welche Türme eine Frage hat. */
  const explainOf = new Map<string, string[]>();
  for (const c of world.cards.values()) for (const x of c.explain ?? []) explainOf.set(x, [...(explainOf.get(x) ?? []), c.key]);
  const towerOfSlide = (id: string): string | null => {
    for (const r of world.entries.get(id)?.refs ?? []) if (r.prerequisite === undefined && r.part === undefined && isPlace(r.to)) return r.to;
    for (const k of explainOf.get(id) ?? []) { const p = world.cardPlaces.get(k)?.[0]; if (p !== undefined) return p; }
    return null;
  };
  const towerOfQuestion = (id: string): string | null => {
    for (const k of world.questionCards.get(id) ?? []) { const p = world.cardPlaces.get(k)?.[0]; if (p !== undefined) return p; }
    return null;
  };

  /* Pfade: der Turm einer Linie ist ihr letzter Halt, der ein Turm ist (eine Linie endet bei EINEM Turm). */
  const towerOfFlow = new Map<string, string>();
  for (const line of lines.lines.values()) {
    const towers = [...line.stops, ...line.sections.map((s) => lines.sections.get(s)?.to ?? '')].filter(isPlace);
    const last = line.stops.filter(isPlace).pop() ?? towers[towers.length - 1];
    if (last !== undefined) towerOfFlow.set(line.id, last);
  }
  const workOf: WorkOfStep = (node) => {
    const th = stepThings(node, cardQuestion);
    return { slides: th.slides.length, questions: th.questions.length, shown: th.slides, asked: th.questions };
  };
  const pathItems = new Map<string, ExploreItem[]>();
  const inPath = new Set<string>();
  for (const flow of input.flows) {
    if (flow.graph.nodes.length === 0) continue;
    const tower = towerOfFlow.get(flow.id) ?? null;
    let order: string[] = [];
    try {
      const sp = storyPath(flow, workOf, label);
      order = sp.parts.flatMap((p) => p.steps);
    } catch { order = []; }
    const seen = new Set<string>();
    const steps: { id: string; help: boolean }[] = [];
    for (const s of order) if (!seen.has(s)) { seen.add(s); steps.push({ id: s, help: false }); }
    /* Was die Erzählung sonst zeigt: Nachhilfe, Vorhersagen ausserhalb des Gezählten — als Hilfe, in der Folge des Graphen. */
    for (const n of flow.graph.nodes) if (!seen.has(n.id)) { seen.add(n.id); steps.push({ id: n.id, help: true }); }
    const nodes = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
    const items: ExploreItem[] = [];
    const once = new Set<string>();
    for (const s of steps) {
      const node = nodes.get(s.id);
      if (node === undefined) continue;
      const th = stepThings(node, cardQuestion);
      const predict = node.config.predict === true;
      const help = s.help || node.config.remedial === true;
      for (const [kind, ids] of [['slide', th.slides], ['question', th.questions]] as const) {
        for (const id of ids) {
          if (kind === 'slide' ? !slides.has(id) : !questions.has(id)) continue;
          const key = `${flow.id}:${s.id}:${id}`;
          if (once.has(key)) continue;
          once.add(key);
          inPath.add(id);
          items.push({ key, kind, id, flow: flow.id, step: s.id, tower, help, predict });
        }
      }
    }
    if (items.length > 0) pathItems.set(flow.id, items);
  }

  /* Türme in der Reihenfolge der Welt, mit ihren Pfaden; was ohne Pfad an ihnen hängt. */
  const flowName = new Map(input.flows.map((f) => [f.id, f.name || f.id] as const));
  const order = world.order.filter(isPlace);
  const towers = new Map<string, ExploreTower>();
  for (const id of order) {
    const paths = [...towerOfFlow.entries()].filter(([f, tw]) => tw === id && pathItems.has(f)).map(([f]) => ({ flow: f, name: flowName.get(f) ?? f }));
    towers.set(id, { id, label: world.places.get(id)?.label || label(id), paths });
  }
  const looseItems = new Map<string, ExploreItem[]>();
  const orphans: ExploreItem[] = [];
  const addLoose = (kind: ExploreKind, id: string, tower: string | null) => {
    const item: ExploreItem = { key: `~${tower ?? 'none'}:${id}`, kind, id, flow: null, step: null, tower, help: false, predict: false };
    /* In einer Teilwelt gehört nur dazu, was an einem ihrer Türme hängt (oder in einem ihrer Pfade steht). */
    if (tower === null || !towers.has(tower)) { if (allowed === null) orphans.push({ ...item, tower: null }); return; }
    looseItems.set(tower, [...(looseItems.get(tower) ?? []), item]);
  };
  for (const id of slides) if (!inPath.has(id)) addLoose('slide', id, towerOfSlide(id));
  for (const id of questions) if (!inPath.has(id)) addLoose('question', id, towerOfQuestion(id));
  /* Am Turm: erst die Folien, dann die Fragen. */
  for (const [tw, list] of looseItems) looseItems.set(tw, [...list.filter((i) => i.kind === 'slide'), ...list.filter((i) => i.kind === 'question')]);

  /* Gruppen: die oberen Tags (mit allen Türmen darunter), sonst eine. */
  const net = worldTags(world);
  const groups = net.roots.length === 0
    ? [{ key: '*', label: t('cogitaExplore.allTowers'), towers: order }]
    : [
        ...net.roots.map((r) => ({ key: r, label: net.tags.get(r)?.label ?? r, towers: order.filter((p) => net.below(r).has(p)) })).filter((g) => g.towers.length > 0),
        ...(() => { const tagged = new Set(net.roots.flatMap((r) => [...net.below(r)])); const rest = order.filter((p) => !tagged.has(p)); return rest.length === 0 ? [] : [{ key: '~', label: t('cogitaExplore.untagged'), towers: rest }]; })()
      ];

  const loosePaths = [...pathItems.keys()].filter((f) => !towerOfFlow.has(f) || !towers.has(towerOfFlow.get(f)!)).map((f) => ({ flow: f, name: flowName.get(f) ?? f }));
  const qpaths = lib.docs('qpath').filter((d) => lib.isOwn(d.id)).map((d) => {
    const p = readPath(d.id, d.data as Record<string, unknown>);
    const tw = p.steps.flatMap((s) => (s.kind === 'place' ? [s.place] : [])).filter((x) => towers.has(x));
    const fl = p.steps.flatMap((s) => (s.kind === 'flow' ? [s.flow] : [])).filter((x) => pathItems.has(x));
    return { id: d.id, title: p.title || d.id, towers: tw, flows: fl };
  }).filter((q) => q.towers.length + q.flows.length > 0);

  return { groups, towers, order, loosePaths, qpaths, pathItems, looseItems, orphans, slides, questions, label, ref };
}

/** Die Abschnitte eines Turms: seine Pfade, dann was ohne Pfad an ihm hängt. */
function towerSections(m: ExploreModel, id: string): ExploreSection[] {
  const tw = m.towers.get(id);
  if (tw === undefined) return [];
  const out: ExploreSection[] = tw.paths.map((p) => ({ key: `p:${id}:${p.flow}`, kind: 'path', title: p.name, tower: id, flow: p.flow, items: m.pathItems.get(p.flow) ?? [] }));
  const loose = m.looseItems.get(id) ?? [];
  if (loose.length > 0) out.push({ key: `l:${id}`, kind: 'loose', title: t('cogitaExplore.atTower'), tower: id, flow: null, items: loose });
  return out;
}

const filtered = (items: readonly ExploreItem[], show: ExploreShow, keep: ((it: ExploreItem) => boolean) | null): ExploreItem[] =>
  items.filter((i) => (show === 'both' || (show === 'slides' ? i.kind === 'slide' : i.kind === 'question')) && (keep === null || keep(i)));

/**
 * DER STROM einer Auswahl: Abschnitte (je Turm und Pfad), gefiltert nach Art und — `keep` — nach Problemen. Leere Abschnitte
 * fallen weg. „Alle Folien" / „Alle Fragen": jedes Ding einmal, in der Reihenfolge, in der es zuerst erscheint.
 */
export function streamOf(m: ExploreModel, sel: ExploreSelection, show: ExploreShow = 'both', keep: ((it: ExploreItem) => boolean) | null = null): ExploreSection[] {
  const pathOnly = (flow: string, tower: string | null): ExploreSection => ({ key: `p:${tower ?? '-'}:${flow}`, kind: 'path', title: m.loosePaths.find((p) => p.flow === flow)?.name ?? [...m.towers.values()].flatMap((x) => x.paths).find((p) => p.flow === flow)?.name ?? flow, tower, flow, items: m.pathItems.get(flow) ?? [] });
  let sections: ExploreSection[];
  switch (sel.kind) {
    case 'all':
      sections = [...m.order.flatMap((id) => towerSections(m, id)), ...m.loosePaths.map((p) => pathOnly(p.flow, null)),
        ...(m.orphans.length === 0 ? [] : [{ key: 'orphans', kind: 'list' as const, title: t('cogitaExplore.orphans'), tower: null, flow: null, items: m.orphans }])];
      break;
    case 'group':
      sections = (m.groups.find((g) => g.key === sel.key)?.towers ?? []).flatMap((id) => towerSections(m, id));
      break;
    case 'tower':
      sections = towerSections(m, sel.id);
      break;
    case 'path': {
      const tower = [...m.towers.values()].find((x) => x.paths.some((p) => p.flow === sel.flow))?.id ?? null;
      sections = [pathOnly(sel.flow, tower)];
      break;
    }
    case 'qpath': {
      const q = m.qpaths.find((x) => x.id === sel.id);
      sections = q === undefined ? [] : [...q.towers.flatMap((id) => towerSections(m, id)), ...q.flows.map((f) => pathOnly(f, null))];
      break;
    }
    case 'slides': case 'questions': {
      const kind: ExploreKind = sel.kind === 'slides' ? 'slide' : 'question';
      const seen = new Set<string>();
      const items: ExploreItem[] = [];
      for (const s of streamOf(m, { kind: 'all' })) for (const i of s.items) if (i.kind === kind && !seen.has(i.id)) { seen.add(i.id); items.push(i); }
      sections = [{ key: sel.kind, kind: 'list', title: sel.kind === 'slides' ? t('cogitaExplore.allSlides') : t('cogitaExplore.allQuestions'), tower: null, flow: null, items }];
      break;
    }
  }
  return sections.map((s) => ({ ...s, items: filtered(s.items, show, keep) })).filter((s) => s.items.length > 0);
}

/** Alle Dinge eines Stroms der Reihe nach (für Zähler, Tastatur, Seiten). */
export const flatItems = (sections: readonly ExploreSection[]): ExploreItem[] => sections.flatMap((s) => s.items);

/* -- Für die KI ------------------------------------------------------------------------------------------------------------ */

export interface PromptItem {
  readonly ref: string;
  readonly kind: ExploreKind;
  readonly label: string;
  readonly where: string;
  /** Offene Uwagi zu ihm (Text). */
  readonly notes: readonly string[];
  /** Befunde der Kontrolle der Welt (Satz). */
  readonly findings: readonly string[];
}

/**
 * DAS POLECENIE FÜR DIE KI: die Baza (Name, Handle), die Dinge mit ihren bleibenden Namen, was die Lehrerin dazu schrieb und was
 * die Kontrolle der Welt fand — und wie die KI es behebt (über MCP: get_feedback, get_world_checks, check_import). Nie ein Aufruf
 * einer KI aus der App: nur ein Text zum Kopieren.
 */
export function aiPrompt(input: { readonly base: string; readonly handle: string | null; readonly items: readonly PromptItem[]; readonly note: string }): string {
  const lines: string[] = [];
  lines.push(t('cogitaExplore.prompt.head', { base: input.base, handle: input.handle === null ? '' : t('cogitaExplore.prompt.handle', { handle: input.handle }) }));
  if (input.note.trim() !== '') lines.push('', t('cogitaExplore.prompt.note'), input.note.trim());
  if (input.items.length > 0) {
    lines.push('', t('cogitaExplore.prompt.items'));
    for (const it of input.items) {
      lines.push(`- ${it.ref} (${it.kind === 'slide' ? t('cogitaExplore.slide') : t('cogitaExplore.question')}: „${it.label}”${it.where === '' ? '' : `, ${it.where}`})`);
      for (const n of it.notes) lines.push(`  · ${t('cogitaExplore.prompt.noteLine', { text: n })}`);
      for (const f of it.findings) lines.push(`  · ${t('cogitaExplore.prompt.findingLine', { text: f })}`);
    }
  }
  lines.push('', t('cogitaExplore.prompt.how'));
  return lines.join('\n');
}
