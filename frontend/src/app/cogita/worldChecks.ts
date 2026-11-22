/**
 * 2026-11-22 (Eigentümer, „Gute Welten", I2) — DIE KONTROLLE EINER WELT: was eine Welt nach dem Leitfaden „guide-good-world"
 * noch braucht — je Baza, Turm und Pfad ein Befund mit Code, Gewicht (`must` / `should` / `info`), dem Eintrag (mit seinem
 * bleibenden Namen) und einem Satz, was ihn behebt. Sie blockiert nie etwas: der Import geht trotzdem; die Befunde sind die
 * Arbeitsliste für den, der die Welt baut (die App: Wiedza → „Do zrobienia"; MCP `get_world_checks`, derselbe Code im Dienst,
 * `importCheck/server.ts`).
 *
 * <b>Eine Rechnung, wiederverwendet:</b> Türme, Pfade und Fahrkarten sind die der Weltkarte (`worldInputOf` → `readWorld` →
 * `linesOf`, die Arten der Orte aus dem Widok mit `"style": "world"`); Folien und Fragen je Teil eines Pfades die der Ścieżka
 * (`storyPath`, Nachhilfe zählt nie); die Meldungen der Vorschau des Imports (Abläufe samt Nachhilfe, Wege zu einer Frage,
 * Folien, Generatoren, Zeichnungen, Krajobraz, andere Welten) und die Meldungen der Karte für Autoren kommen unverändert mit.
 * Neu gerechnet wird nur, was der Leitfaden verlangt und es noch nicht gab: Fragen ohne Bewertung durch die App, Fragen ohne
 * Folie in ihrer Kette, Pfade über mehrere Türme, zu viele Folien oder Fragen hintereinander, lange Folien, die richtige Antwort
 * als längste und an derselben Stelle, Rückmeldungen je Möglichkeit, Schlüsselfragen, Fragen für die Abstimmung, Fehler-Tags
 * ohne Nachhilfe, lange Namen und Hinweise an Gabelungen, Fahrkarten über den ersten Turm hinaus, die Stufen, offene Uwagi, Tags
 * (einmal benutzt, fast gleich).
 *
 * Rein: keine Anfrage, kein DOM. Die Texte kommen aus `locales/<sprache>/worldChecks.json`.
 */

import { t } from '../core/i18n';
import type { Card } from './cardBasics';
import { feedbackOf, type Feedback } from './feedback';
import type { Flow } from './flow';
import type { GraphNode } from './graph';
import { generatorImportWarnings } from './generatorImport';
import { interactiveImportWarnings } from './interactiveCheck';
import { flowIssues, HINT_MAX, nameIn, OPTION_LABEL_MAX, pathWarnings, type ImportPlan } from './json';
import { isBaseKind, type DocKind } from './kinds';
import { landscapeImportWarnings } from './landscapeImport';
import { choicesOf } from './questionTypes';
import { fieldsOf } from './schema';
import { slideImportWarnings } from './slideLint';
import type { CogitaLibrary } from './store';
import { storyPath, type WorkOfStep } from './storyPath';
import { DIMENSIONS_FROM, worldDimensions } from './worldDimensions';
import { crossImportWarnings } from './worldsImport';
import { readWorld } from './worldmap/wmGraph';
import { readPath } from './worldmap/wmPaths';
import { placeKindsOf, worldInputOf } from './worldmap/wmInput';
import { linesOf } from './worldmap/wmLines';
import { worldTags } from './worldmap/wmTags';
import { RECOMMENDED_LEVELS } from './worldmap/wmRuns';
import type { Lines, World, WmIssue } from './worldmap/wmTypes';

export type CheckWeight = 'must' | 'should' | 'info';

/** Ein Ding der Baza in einem Befund: seine Kennung, sein bleibender Name (`@…`, sonst die Kennung) und wie es heisst. */
export interface CheckRef {
  readonly id: string;
  readonly name: string;
  readonly label: string;
}

export interface WorldFinding {
  /** Fest, englisch, für Filter und Bots: `question.flash`, `path.severalTowers`, `map.cycle`, `preview.slides` … */
  readonly code: string;
  readonly weight: CheckWeight;
  /** Was nicht stimmt — ein Satz in der Sprache der App. */
  readonly message: string;
  /** Was es behebt — ein Satz. */
  readonly fix: string;
  /** Was zu ändern ist (eine Frage, eine Folie, ein Turm, ein Ablauf, ein Tag). */
  readonly entity?: CheckRef;
  /** Der Turm, zu dem es gehört (wo bekannt). */
  readonly tower?: CheckRef;
  /** Der Pfad (Ablauf), in dem es steht (wo bekannt). */
  readonly path?: CheckRef;
  /** Der Schritt im Ablauf (wo bekannt). */
  readonly step?: string;
}

export interface WorldCheckReport {
  readonly findings: readonly WorldFinding[];
  readonly counts: { readonly must: number; readonly should: number; readonly info: number };
  /** Je Code, wie oft — in der Reihenfolge der Befunde. */
  readonly codes: readonly { readonly code: string; readonly weight: CheckWeight; readonly count: number }[];
  readonly size: { readonly towers: number; readonly paths: number; readonly questions: number; readonly slides: number; readonly feedbackOpen: number };
  /** Der Widok, der sagt, welche Einträge Türme sind (`"style": "world"`) — `null`: abgeleitet. */
  readonly view: string | null;
}

/* -- Grenzen des Leitfadens ------------------------------------------------------------------------------------------------ */

/** Höchstens so viele Wörter auf einer Folie (1.5: „usually 1–4 sentences, never more than about 130 words"). */
export const SLIDE_WORDS = 130;
/** Höchstens so viele Folien und Fragen hintereinander (ausser im Abschluss), der Abschluss 2–4 Fragen (1.5, 1.6). */
export const SLIDES_IN_ROW = 3;
export const QUESTIONS_IN_ROW = 2;
export const CLOSING_MAX = 4;
/** Eine Frage für die Abstimmung: eine Entscheidung, vier Möglichkeiten, jede falsche ein benannter Fehler (1.3). */
export const VOTE_OPTIONS = 4;
export const VOTE_READY_MIN = 2;
/** Die richtige Möglichkeit ist die längste in höchstens 3 von 10 Wahlfragen (1.4); erst ab so vielen Fragen beurteilt. */
export const LONGEST_SHARE = 0.3;
export const JUDGE_FROM = 4;
/** Name einer Möglichkeit an einer Gabelung, ihr Hinweis (1.6) — dieselben Grenzen wie die Vorschau des Imports. */
export const FORK_LABEL_MAX = OPTION_LABEL_MAX;
export const FORK_HINT_MAX = HINT_MAX;
/** Die empfohlenen Stufen jeder Welt (1.3, I7) — dieselben wie für eine neue Baza (`RECOMMENDED_LEVELS`). */
const STANDARD_LEVELS = RECOMMENDED_LEVELS;

const WEIGHT_ORDER: Readonly<Record<CheckWeight, number>> = { must: 0, should: 1, info: 2 };

/* -- Hilfen ------------------------------------------------------------------------------------------------------------------ */

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown): string[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])
  .map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x !== null && typeof (x as { value?: unknown }).value === 'string' ? (x as { value: string }).value : ''))
  .map((x) => x.trim()).filter((x) => x !== '');
const quoted = (s: string) => t('worldChecks.quoted', { name: s.length > 70 ? `${s.slice(0, 69)}…` : s });
const listOf = (names: readonly string[], max = 6): string => {
  const list = [...new Set(names)];
  return list.length > max ? t('worldChecks.listMore', { list: list.slice(0, max).join(', '), count: list.length - max }) : list.join(', ');
};

/** Die Texte eines Feldes „blocks" (Absätze, Listen, Tabellen, Zitate) — ohne eingezäunte Grafiken (```chart …```). */
function blockTexts(v: unknown): string[] {
  const out: string[] = [];
  const cell = (c: unknown): string => (Array.isArray(c) ? c.map((x) => (typeof x === 'object' && x !== null && typeof (x as { text?: unknown }).text === 'string' ? (x as { text: string }).text : '')).join(' ') : typeof c === 'string' ? c : '');
  for (const b of Array.isArray(v) ? v : typeof v === 'string' ? [{ text: v }] : []) {
    if (typeof b !== 'object' || b === null) continue;
    const o = b as Record<string, unknown>;
    if (typeof o.text === 'string') out.push(o.text);
    if (Array.isArray(o.items)) out.push(o.items.map(cell).join(' '));
    if (Array.isArray(o.rows)) for (const r of o.rows) if (Array.isArray(r)) out.push(r.map(cell).join(' '));
  }
  return out;
}

/** Wie viele Wörter ein Text hat — Verweise zählen mit ihrem sichtbaren Wort, Zitierschlüssel und Grafiken nicht. */
export function wordCount(text: string): number {
  const plain = text
    .replace(/(```|~~~)[\s\S]*?\1/g, ' ')
    .replace(/\[\[([^\]|]*)\|[^\]]*\]\]/g, '$1')
    .replace(/\[\^?@[^\]]*\]/g, ' ')
    .replace(/\[\^\d+\]/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' x ')
    .replace(/\$[^$\n]*\$/g, ' x ');
  return plain.split(/\s+/).filter((w) => /[0-9A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-׿]/.test(w)).length;
}

/** Ohne Akzente, klein, nur Buchstaben und Ziffern — für fast gleiche Tags. */
const folded = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const wordsOf = (s: string): string[] => folded(s).split(/[^a-z0-9]+/).filter((w) => w !== '');
const prefixLen = (a: string, b: string): number => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i += 1; return i; };
/** Dasselbe Wort in einer anderen Form („narrator" / „narratora", „myli-autora" / „myli-autor")? Gleiche Wörter zählen nicht. */
export function nearSame(a: string, b: string): boolean {
  if (folded(a) === folded(b)) return a !== b;
  const x = wordsOf(a);
  const y = wordsOf(b);
  if (x.length === 0 || x.length !== y.length) return false;
  let differs = false;
  for (let i = 0; i < x.length; i += 1) {
    const p = x[i]!;
    const q = y[i]!;
    if (p === q) continue;
    const short = Math.min(p.length, q.length);
    if (short < 4 || Math.abs(p.length - q.length) > 3 || prefixLen(p, q) < Math.max(3, short - 2)) return false;
    differs = true;
  }
  return differs;
}

/** Der Name eines Ablaufs, wie `readFlow` ihn liest (die Vorschau nennt ihn so). */
const readName = (data: Readonly<Record<string, unknown>>, fallback: string): string => (typeof data.name === 'string' && data.name.trim() !== '' ? data.name : fallback);

/* -- Die Kontrolle ------------------------------------------------------------------------------------------------------------ */

export interface WorldCheckInput {
  /** Die Karten der Baza (`lib.cards()`): woraus die Karte Türme und ihre Fragen liest. */
  readonly cards: readonly Card[];
}

/** Der Widok, der die Türme nennt: der erste mit `"style": "world"`, sonst keiner (dann abgeleitet, wie die Karte). */
function worldView(lib: CogitaLibrary): { id: string; kinds: string[] } | null {
  for (const d of lib.docs('view')) {
    const data = d.data as { landscape?: { style?: unknown }; steps?: unknown };
    if (data.landscape?.style === 'world' && Array.isArray(data.steps)) return { id: d.id, kinds: placeKindsOf(data as never) };
  }
  return null;
}

export function worldChecks(lib: CogitaLibrary, input: WorldCheckInput): WorldCheckReport {
  const findings: WorldFinding[] = [];
  const look = lib.look;
  const named = nameIn(lib);
  const own = lib.entities().filter((e) => lib.isOwn(e.id));
  const byId = new Map(own.map((e) => [e.id, e] as const));
  const labelOf = (id: string): string => { const e = lib.entity(id); return e === undefined ? id : lib.label(e) || id; };
  const ref = (id: string): CheckRef => ({ id, name: `@${named(id)}`, label: labelOf(id) });
  const add = (f: WorldFinding) => { findings.push(f); };

  /* Die Welt, wie die Karte sie liest. */
  const view = worldView(lib);
  const winput = worldInputOf(lib, input.cards, view === null || view.kinds.length === 0 ? {} : { placeKinds: view.kinds });
  const world: World = readWorld(winput);
  const lines: Lines = linesOf(world, winput.flows);
  const flows = new Map(winput.flows.map((f) => [f.id, f] as const));
  const flowDoc = new Map(lib.docs('flow').map((d) => [d.id, d] as const));
  const flowRef = (id: string): CheckRef => {
    const f = flows.get(id);
    const lasting = str(flowDoc.get(id)?.data._ref);
    return { id, name: `@${lasting === '' ? id : lasting}`, label: f?.name || str(flowDoc.get(id)?.data.name) || id };
  };
  const isPlace = (id: string) => world.places.has(id);
  const questionKinds = new Set(winput.questionKinds ?? ['question']);
  const isQuestion = (id: string) => (byId.get(id)?.kinds ?? lib.entity(id)?.kinds ?? []).some((k) => questionKinds.has(k));
  const questions = own.filter((e) => e.kinds.some((k) => questionKinds.has(k)));
  /*
    Folien: was ein Schritt „show"/„scene" zeigt (wie die Karte sie zählt) und jeder Eintrag mit einem Feld „blocks" — keine Frage,
    kein Turm. Ihre Wörter: die Felder „blocks" und „markup".
  */
  const shown = new Set<string>();
  for (const f of winput.flows) for (const n of f.graph.nodes) if (n.type === 'show' || (n.type === 'scene' && n.config.question !== true)) for (const id of n.type === 'show' ? strings(n.config.of) : strings(n.config.about)) shown.add(id);
  const slides = own.filter((e) => !e.kinds.some((k) => questionKinds.has(k)) && !isPlace(e.id) && (shown.has(e.id) || fieldsOf(e, look).some((f) => f.type === 'blocks')));
  /* Präsentationen (`look: "scenes"`) haben ihre Szenen in ihrer Seite — die sieht diese Kontrolle nicht (der Dienst schon gar nicht). */
  const scenes = lib.docs('flow').some((d) => str(d.data.presentation) !== '' || str(d.data.look) === 'scenes');

  /* Wo eine Folie steht — wie `linesOf` (R1): sie selbst ein Turm, sonst ihr erster Verweis auf einen Turm, sonst über „explain". */
  const explainOf = new Map<string, string[]>();
  for (const c of world.cards.values()) for (const x of c.explain ?? []) explainOf.set(x, [...(explainOf.get(x) ?? []), c.key]);
  const towerOfSlide = (id: string): string | null => {
    if (isPlace(id)) return id;
    for (const r of world.entries.get(id)?.refs ?? []) if (r.prerequisite === undefined && r.part === undefined && isPlace(r.to)) return r.to;
    for (const k of explainOf.get(id) ?? []) { const p = world.cardPlaces.get(k)?.[0]; if (p !== undefined) return p; }
    return null;
  };
  const taught = new Set<string>();
  for (const s of slides) { const p = towerOfSlide(s.id); if (p !== null) taught.add(p); }
  const towersOfQuestion = (id: string): string[] => [...new Set((world.questionCards.get(id) ?? []).flatMap((k) => world.cardPlaces.get(k) ?? []))];

  /* -- Fragen ----------------------------------------------------------------------------------------------------------------- */
  for (const q of questions) {
    const d = q.data;
    const form = str(d.form) || 'text';
    const towers = towersOfQuestion(q.id);
    const tower = towers[0] === undefined ? undefined : ref(towers[0]);
    const at = { entity: ref(q.id), ...(tower === undefined ? {} : { tower }) };
    if (form === 'flash') {
      add({ code: 'question.flash', weight: 'must', message: t('worldChecks.question.flash.message', { name: quoted(labelOf(q.id)) }), fix: t('worldChecks.question.flash.fix'), ...at });
    }
    if (towers.length === 0) {
      add({ code: 'question.noTower', weight: 'should', message: t('worldChecks.question.noTower.message', { name: quoted(labelOf(q.id)) }), fix: t('worldChecks.question.noTower.fix'), ...at });
    } else if (strings(d.explain).length === 0 && !towers.some((p) => taught.has(p) || [...world.base(p)].some((b) => taught.has(b)))) {
      const message = t('worldChecks.question.untaught.message', { name: quoted(labelOf(q.id)), tower: quoted(labelOf(towers[0]!)) });
      add({ code: 'question.untaught', weight: scenes ? 'info' : 'should', message: scenes ? `${message} ${t('worldChecks.question.untaught.scenes')}` : message, fix: t('worldChecks.question.untaught.fix'), ...at });
    }
    if (form === 'one' || form === 'many') {
      const c = choicesOf(d);
      const without = c.feedback.filter((x) => x === '').length;
      if (c.options.length > 0 && without > 0) {
        add({ code: 'question.noFeedback', weight: 'should', message: t('worldChecks.question.noFeedback.message', { name: quoted(labelOf(q.id)), count: without, total: c.options.length }), fix: t('worldChecks.question.noFeedback.fix'), ...at });
      }
    }
  }

  /* -- Türme: Schlüsselfragen, Abstimmung, die längste und die Stelle der richtigen Möglichkeit ---------------------------------- */
  const questionOfCard = (key: string): string | undefined => world.cards.get(key)?.question;
  for (const place of world.places.values()) {
    const qs = [...new Set(place.cards.map(questionOfCard).filter((x): x is string => x !== undefined && byId.has(x) && isQuestion(x)))];
    if (qs.length === 0) continue;
    const tower = ref(place.id);
    const at = { entity: tower, tower };
    const core = place.cards.some((k) => world.cards.get(k)?.core === true);
    if (!core) add({ code: 'tower.noCore', weight: 'should', message: t('worldChecks.tower.noCore.message', { name: quoted(tower.label) }), fix: t('worldChecks.tower.noCore.fix'), ...at });
    let vote = 0;
    const ones: { correct: number; longest: number; options: number }[] = [];
    for (const id of qs) {
      const d = byId.get(id)!.data;
      if (str(d.form) !== 'one') continue;
      const c = choicesOf(d);
      if (c.options.length < 2 || c.correct.length !== 1) continue;
      const right = c.correct[0]!;
      const lengths = c.options.map((o) => o.length);
      const max = Math.max(...lengths);
      const longest = lengths.filter((n) => n === max).length === 1 ? lengths.indexOf(max) : -1;
      ones.push({ correct: right, longest, options: c.options.length });
      if (c.options.length >= VOTE_OPTIONS && c.options.every((_, i) => i === right || (c.tags[i] ?? '') !== '')) vote += 1;
    }
    if (vote < VOTE_READY_MIN) add({ code: 'tower.fewVote', weight: 'should', message: t('worldChecks.tower.fewVote.message', { name: quoted(tower.label), count: vote, min: VOTE_READY_MIN }), fix: t('worldChecks.tower.fewVote.fix', { options: VOTE_OPTIONS }), ...at });
    if (ones.length >= JUDGE_FROM) {
      const longest = ones.filter((o) => o.longest === o.correct).length;
      if (longest / ones.length > LONGEST_SHARE) {
        add({ code: 'tower.longestCorrect', weight: 'should', message: t('worldChecks.tower.longestCorrect.message', { name: quoted(tower.label), count: longest, total: ones.length, share: Math.round((longest / ones.length) * 100) }), fix: t('worldChecks.tower.longestCorrect.fix'), ...at });
      }
      const at4 = new Map<number, number>();
      for (const o of ones) at4.set(o.correct, (at4.get(o.correct) ?? 0) + 1);
      const [pos, count] = [...at4.entries()].sort((a, b) => b[1] - a[1])[0]!;
      const options = Math.round(ones.reduce((n, o) => n + o.options, 0) / ones.length);
      /* Mehr als die Hälfte an derselben Stelle (bei vier Möglichkeiten wäre ein Viertel der Zufall). */
      if (count / ones.length > 0.5 && options >= 3) {
        add({ code: 'tower.positions', weight: 'should', message: t('worldChecks.tower.positions.message', { name: quoted(tower.label), position: pos + 1, count, total: ones.length }), fix: t('worldChecks.tower.positions.fix'), ...at });
      }
    }
  }

  /* -- Folien: ein Gedanke ----------------------------------------------------------------------------------------------------- */
  for (const s of slides) {
    const fields = fieldsOf(s, look).filter((f) => f.type === 'blocks' || f.type === 'markup');
    const words = fields.reduce((n, f) => n + (f.type === 'blocks' ? blockTexts(s.data[f.key]) : [str(s.data[f.key])]).reduce((m, text) => m + wordCount(text), 0), 0);
    if (words > SLIDE_WORDS) {
      const p = towerOfSlide(s.id);
      add({ code: 'slide.long', weight: 'should', message: t('worldChecks.slide.long.message', { name: quoted(labelOf(s.id)), count: words, max: SLIDE_WORDS }), fix: t('worldChecks.slide.long.fix'), entity: ref(s.id), ...(p === null ? {} : { tower: ref(p) }) });
    }
  }

  /* -- Pfade: ein Turm je Pfad, Fahrkarte, Folien und Fragen hintereinander, Gabelungen --------------------------------------------- */
  for (const line of lines.lines.values()) {
    const path = flowRef(line.id);
    for (const br of line.branches) {
      const towers: string[] = [];
      for (const sid of br.sections) {
        const s = lines.sections.get(sid);
        if (s === undefined || s.kind === 'return' || !isPlace(s.to)) continue;
        if (!towers.includes(s.to)) towers.push(s.to);
      }
      if (towers.length > 1) {
        add({ code: 'path.severalTowers', weight: 'should', message: t('worldChecks.path.severalTowers.message', { name: quoted(path.label), count: towers.length, list: listOf(towers.map(labelOf)) }), fix: t('worldChecks.path.severalTowers.fix'), entity: path, path, ...(br.fork === null ? {} : { step: br.fork.step }) });
      }
    }
    /* Eine Fahrkarte verlangt nie mehr als der erste Turm der Linie (1.6). */
    const first = line.stops.find(isPlace);
    if (line.unit !== undefined && first !== undefined) {
      const base = world.base(first);
      const extra = world.requires(line.unit).filter((r) => isPlace(r) && !base.has(r) && r !== line.unit);
      if (extra.length > 0) {
        add({ code: 'line.ticket', weight: 'should', message: t('worldChecks.line.ticket.message', { name: quoted(path.label), list: listOf(extra.map(labelOf)), tower: quoted(labelOf(first)) }), fix: t('worldChecks.line.ticket.fix'), entity: ref(line.unit), tower: ref(first), path });
      }
    }
  }
  const workOf: WorkOfStep = (node: GraphNode) => {
    switch (node.type) {
      case 'show': case 'expand': case 'opening': case 'line':
        return { slides: 1, questions: 0, shown: strings(node.config.of), asked: [] };
      case 'question':
        return { slides: 0, questions: 1, shown: [], asked: [str(node.config.of) || str(node.config.card)].filter(Boolean) };
      case 'scene':
        return node.config.question === true ? { slides: 0, questions: 1, shown: [], asked: strings(node.config.asks) } : { slides: 1, questions: 0, shown: strings(node.config.about), asked: [] };
      default:
        return { slides: 0, questions: 0, shown: [], asked: [] };
    }
  };
  /* Was die Vorschau zu Name und Hinweis einer Gabelung sagt, steht hier mit eigenem Code — ihr Satz fällt unten weg. */
  const coveredByFork = new Set<string>();
  for (const flow of winput.flows) {
    if (flow.graph.nodes.length === 0) continue;
    const path = flowRef(flow.id);
    checkRuns(flow, path, workOf, labelOf, add);
    for (const n of flow.graph.nodes) {
      if (n.type !== 'choice') continue;
      for (const o of Array.isArray(n.config.options) ? n.config.options : []) {
        if (typeof o !== 'object' || o === null) continue;
        const label = str((o as Record<string, unknown>).label);
        const hint = str((o as Record<string, unknown>).hint);
        const name = flowDoc.get(flow.id) === undefined ? flow.name : readName(flowDoc.get(flow.id)!.data, flow.name);
        if (hint.length > FORK_HINT_MAX) coveredByFork.add(t('cogitaData.import.flowIssue', { name, text: t('cogitaData.import.hintLong', { label, count: hint.length, max: FORK_HINT_MAX }) }));
        if (label.length > FORK_LABEL_MAX) coveredByFork.add(t('cogitaData.import.flowIssue', { name, text: t('cogitaData.import.labelLong', { label, count: label.length, max: FORK_LABEL_MAX }) }));
        if (label.length > FORK_LABEL_MAX) add({ code: 'fork.labelLong', weight: 'should', message: t('worldChecks.fork.labelLong.message', { name: quoted(path.label), label: quoted(label), count: label.length, max: FORK_LABEL_MAX }), fix: t('worldChecks.fork.labelLong.fix', { max: FORK_LABEL_MAX }), entity: path, path, step: n.id });
        if (hint.length > FORK_HINT_MAX) add({ code: 'fork.hintLong', weight: 'should', message: t('worldChecks.fork.hintLong.message', { name: quoted(path.label), label: quoted(label || n.id), count: hint.length, max: FORK_HINT_MAX }), fix: t('worldChecks.fork.hintLong.fix', { max: FORK_HINT_MAX }), entity: path, path, step: n.id });
      }
    }
  }

  /* -- Fehler-Tags: Nachhilfe in den Pfaden, die die Frage stellen; einmal benutzt; fast gleich ------------------------------------- */
  const helped = new Map<string, Set<string>>();
  const askedIn = new Map<string, string>();
  for (const flow of winput.flows) {
    for (const n of flow.graph.nodes) {
      if (n.type !== 'question') continue;
      const of = str(n.config.of) || str(n.config.card);
      if (of === '') continue;
      if (!askedIn.has(of)) askedIn.set(of, flow.id);
      const set = helped.get(of) ?? new Set<string>();
      const ow = n.config.onWrong;
      if (typeof ow === 'object' && ow !== null && typeof (ow as { byTag?: unknown }).byTag === 'object' && (ow as { byTag?: unknown }).byTag !== null) for (const tag of Object.keys((ow as { byTag: Record<string, unknown> }).byTag)) set.add(tag);
      for (const e of flow.graph.edges) if (e.from === n.id && e.out.startsWith('wrong:')) set.add(e.out.slice(6));
      helped.set(of, set);
    }
  }
  const tagUse = new Map<string, number>();
  for (const q of questions) {
    const tags = [...new Set(strings(q.data.tags))];
    for (const tag of tags) tagUse.set(tag, (tagUse.get(tag) ?? 0) + 1);
    const flowId = askedIn.get(q.id);
    if (flowId === undefined || tags.length === 0) continue;
    const missing = tags.filter((tag) => !(helped.get(q.id)?.has(tag) ?? false));
    if (missing.length > 0) {
      const towers = towersOfQuestion(q.id);
      add({ code: 'mistakeTag.noHelp', weight: 'should', message: t('worldChecks.mistakeTag.noHelp.message', { name: quoted(labelOf(q.id)), list: listOf(missing.map(quoted)), path: quoted(flowRef(flowId).label), count: missing.length }), fix: t('worldChecks.mistakeTag.noHelp.fix'), entity: ref(q.id), path: flowRef(flowId), ...(towers[0] === undefined ? {} : { tower: ref(towers[0]) }) });
    }
  }
  const once = [...tagUse.entries()].filter(([, n]) => n === 1).map(([tag]) => tag);
  const tagList = [...tagUse.keys()].sort();
  for (let i = 0; i < tagList.length; i += 1) {
    for (let j = i + 1; j < tagList.length; j += 1) {
      const a = tagList[i]!;
      const b = tagList[j]!;
      if (nearSame(a, b)) add({ code: 'mistakeTag.nearDuplicate', weight: 'should', message: t('worldChecks.mistakeTag.nearDuplicate.message', { a: quoted(a), b: quoted(b), ca: tagUse.get(a) ?? 0, cb: tagUse.get(b) ?? 0 }), fix: t('worldChecks.mistakeTag.nearDuplicate.fix') });
    }
  }
  if (once.length > 0) add({ code: 'mistakeTag.usedOnce', weight: 'info', message: t('worldChecks.mistakeTag.usedOnce.message', { count: once.length, list: listOf(once.map(quoted), 12) }), fix: t('worldChecks.mistakeTag.usedOnce.fix') });

  /* Tags der Karte („tag": "up"): einmal benutzt, fast gleich. */
  const net = worldTags(world);
  for (const id of net.order) {
    const tag = net.tags.get(id)!;
    if (net.below(id).size === 1 && tag.children.length === 0) add({ code: 'tag.usedOnce', weight: 'info', message: t('worldChecks.tag.usedOnce.message', { name: quoted(tag.label), tower: quoted(labelOf([...net.below(id)][0]!)) }), fix: t('worldChecks.tag.usedOnce.fix'), entity: ref(id) });
  }
  const mapTags = net.order.map((id) => net.tags.get(id)!);
  for (let i = 0; i < mapTags.length; i += 1) {
    for (let j = i + 1; j < mapTags.length; j += 1) {
      const a = mapTags[i]!;
      const b = mapTags[j]!;
      if (nearSame(a.label, b.label)) add({ code: 'tag.nearDuplicate', weight: 'should', message: t('worldChecks.tag.nearDuplicate.message', { a: quoted(a.label), b: quoted(b.label) }), fix: t('worldChecks.tag.nearDuplicate.fix'), entity: ref(a.id) });
    }
  }

  /*
    -- 2026-11-22 (Eigentümer) — EINE WELT IST KEIN TEXT: neben der Folge der Quelle Ebenen der Ausführlichkeit und Fäden quer
    zur Folge (einer Figur folgen, einem Thema von Szene zu Szene) — über dieselben Türme (Leitfaden 1.2a, `worldDimensions.ts`).
  */
  const dims = worldDimensions(world, lines, net, lib.docs('qpath').filter((d) => lib.isOwn(d.id)).map((d) => readPath(d.id, d.data as Record<string, unknown>)));
  if (dims.towers >= DIMENSIONS_FROM) {
    const threads = dims.threads.questionPaths.length + dims.threads.crossTags.length + dims.threads.joins.length;
    if (dims.linear) add({ code: 'world.linear', weight: 'should', message: t('worldChecks.world.linear.message', { count: dims.inChain, total: dims.towers }), fix: t('worldChecks.world.linear.fix') });
    if (dims.depth.levels === 1) add({ code: 'world.oneLevel', weight: 'should', message: t('worldChecks.world.oneLevel.message', { total: dims.towers }), fix: t('worldChecks.world.oneLevel.fix') });
    if (threads === 0) add({ code: 'world.noThreads', weight: 'should', message: t('worldChecks.world.noThreads.message', { total: dims.towers }), fix: t('worldChecks.world.noThreads.fix') });
    add({
      code: 'world.dimensions', weight: 'info',
      message: t('worldChecks.world.dimensions.message', {
        levels: dims.depth.levels, blocks: dims.depth.blocks, deepenings: dims.depth.deepenings, overviews: dims.depth.overviews.length,
        paths: dims.threads.questionPaths.length, tags: dims.threads.crossTags.length, joins: dims.threads.joins.length,
        chain: dims.inChain, total: dims.towers
      }),
      fix: t('worldChecks.world.dimensions.fix')
    });
  }

  /* -- Die Stufen (I7: die Empfehlung, keine Regel) ----------------------------------------------------------------------------------- */
  const setup = lib.settings().levelsSetup;
  const standard = setup !== undefined && setup.levels === STANDARD_LEVELS.levels
    && STANDARD_LEVELS.rules.every((r, i) => setup.rules[i]?.pct === r.pct && setup.rules[i]?.attempts === r.attempts)
    && setup.openAt === STANDARD_LEVELS.openAt;
  if (!standard && world.places.size > 0) {
    const now = setup === undefined || setup.levels === 0
      ? t('worldChecks.levels.none')
      : setup.rules.slice(0, setup.levels).map((r) => t('worldChecks.levels.rule', { pct: r.pct, attempts: t(`worldChecks.levels.attempts.${r.attempts}`) })).join(' · ') + (setup.openAt === undefined ? '' : ` · ${t('worldChecks.levels.openAt', { level: setup.openAt })}`);
    add({ code: 'levels.standard', weight: 'info', message: t('worldChecks.levels.standard.message', { now }), fix: t('worldChecks.levels.standard.fix') });
  }

  /* -- Offene Uwagi zu Einträgen dieser Baza ------------------------------------------------------------------------------------------ */
  const open = feedbackOf(lib).filter((f) => f.state === 'open');
  const byEntity = new Map<string, Feedback[]>();
  for (const f of open) {
    const key = f.target.entity ?? f.target.card ?? f.target.label;
    byEntity.set(key, [...(byEntity.get(key) ?? []), f]);
  }
  for (const [key, list] of byEntity) {
    const onlyGood = list.every((f) => f.category === 'good');
    const entity = list[0]!.target.entity;
    const name = entity !== undefined && lib.entity(entity) !== undefined ? labelOf(entity) : list[0]!.target.label || key;
    const cats = [...new Set(list.map((f) => t(`cogitaFeedback.kind.${f.category}`)))].join(', ');
    add({
      code: 'feedback.open', weight: onlyGood ? 'info' : 'should',
      message: t('worldChecks.feedback.open.message', { name: quoted(name), count: list.length, categories: cats, ids: list.map((f) => f.id).join(', ') }),
      fix: t('worldChecks.feedback.open.fix'),
      ...(entity !== undefined && lib.entity(entity) !== undefined ? { entity: ref(entity) } : {})
    });
  }

  /* -- Die Meldungen der Vorschau des Imports (für die ganze Baza) ---------------------------------------------------------------------- */
  const planKinds: ImportPlan['kinds'] = lib.kinds.filter((k) => !isBaseKind(k.id)).map((k) => ({ id: k.id, def: k, isNew: false }));
  const planEntities: ImportPlan['entities'] = own.map((e) => ({ id: e.id, kinds: [...e.kinds], data: e.data as Record<string, unknown>, isNew: false }));
  const docKinds: readonly DocKind[] = ['flow', 'qpath', 'view', 'template', 'revision', 'settings', 'reward', 'collection', 'anchor', 'addform', 'look', 'rules', 'values'];
  const planDocs: ImportPlan['docs'] = docKinds.flatMap((kind) => lib.docs(kind).filter((d) => lib.isOwn(d.id)).map((d) => ({ id: d.id, kind, data: d.data as Record<string, unknown>, isNew: false })));
  /* Ohne Einträge des Plans: alle stehen in der Baza (dort sucht die Prüfung über Kennungen, nicht durch eine Liste). */
  for (const issue of flowIssues(lib, planDocs, [])) {
    if (coveredByFork.has(issue.text)) continue;
    add({ code: 'flow.preview', weight: issue.level === 'error' ? 'must' : 'should', message: issue.text, fix: t('worldChecks.flow.preview.fix'), ...(issue.flow === undefined ? {} : { entity: flowRef(issue.flow), path: flowRef(issue.flow) }), ...(issue.step === undefined ? {} : { step: issue.step }) });
  }
  const preview = (code: string, list: readonly string[]) => { for (const text of list) add({ code, weight: 'should', message: text, fix: t(`worldChecks.${code}.fix`) }); };
  const qpaths = planDocs.filter((d) => d.kind === 'qpath');
  if (qpaths.length > 0) preview('preview.paths', pathWarnings(lib, qpaths, []));
  preview('preview.slides', slideImportWarnings(lib, { kinds: planKinds, entities: planEntities }));
  preview('preview.generators', generatorImportWarnings(lib, { kinds: planKinds, entities: planEntities, docs: planDocs }));
  preview('preview.drawings', interactiveImportWarnings({ entities: planEntities }));
  preview('preview.landscape', landscapeImportWarnings(lib, { kinds: planKinds, entities: planEntities, docs: planDocs }));
  preview('preview.worlds', crossImportWarnings(lib, { kinds: planKinds, entities: planEntities, docs: planDocs }));

  /* -- Die Meldungen der Karte für Autoren (§11, wie unter der Karte) ------------------------------------------------------------------- */
  const nameOf = (id: string): string => (byId.has(id) || lib.entity(id) !== undefined ? labelOf(id) : flows.get(id)?.name ?? id);
  const mapIssue = (i: WmIssue) => {
    const names = listOf(i.ids.map(nameOf));
    const message = t(`cogitaWorld.issue.${i.code}`, { ...(i.data ?? {}), count: typeof i.data?.count === 'number' ? i.data.count : i.ids.length, names: i.code === 'mislabelledRegion' ? nameOf(i.ids[0] ?? '') : names });
    const first = i.ids[0];
    const what = first === undefined ? undefined : flows.has(first) ? flowRef(first) : byId.has(first) ? ref(first) : undefined;
    add({ code: `map.${i.code}`, weight: i.level === 'error' ? 'must' : i.level === 'warning' ? 'should' : 'info', message, fix: t('worldChecks.map.fix'), ...(what === undefined ? {} : { entity: what }) });
  };
  for (const i of [...world.issues, ...lines.issues]) mapIssue(i);

  /* Ordnung: must, should, info; darin nach Code; je Code in der Reihenfolge der Welt. */
  const order = new Map<string, number>();
  findings.forEach((f, i) => { if (!order.has(f.code)) order.set(f.code, i); });
  const sorted = findings.map((f, i) => ({ f, i })).sort((a, b) => WEIGHT_ORDER[a.f.weight] - WEIGHT_ORDER[b.f.weight] || a.f.code.localeCompare(b.f.code) || a.i - b.i).map((x) => x.f);
  const codes: { code: string; weight: CheckWeight; count: number }[] = [];
  for (const f of sorted) {
    const last = codes[codes.length - 1];
    if (last !== undefined && last.code === f.code && last.weight === f.weight) last.count += 1;
    else codes.push({ code: f.code, weight: f.weight, count: 1 });
  }
  return {
    findings: sorted,
    counts: { must: sorted.filter((f) => f.weight === 'must').length, should: sorted.filter((f) => f.weight === 'should').length, info: sorted.filter((f) => f.weight === 'info').length },
    codes,
    size: { towers: world.places.size, paths: lines.lines.size, questions: questions.length, slides: slides.length, feedbackOpen: open.length },
    view: view?.id ?? null
  };
}

/** Folien und Fragen hintereinander je Teil der Ścieżka (Nachhilfe zählt nie) — der Abschluss (die letzten Fragen) darf mehr. */
function checkRuns(flow: Flow, path: CheckRef, workOf: WorkOfStep, label: (id: string) => string, add: (f: WorldFinding) => void): void {
  let sp;
  try { sp = storyPath(flow, workOf, label); } catch { return; }
  const parts = sp.parts;
  if (parts.length === 0) return;
  const asks = (i: number) => parts[i]!.kind === 'learn' || parts[i]!.kind === 'mixed';
  /* Kommt nach diesem Teil noch einer, der fragt? (über die Wege der Ścieżka, ohne Schleifen) */
  const memo = new Map<number, boolean>();
  const asksAfter = (i: number, seen = new Set<number>()): boolean => {
    if (memo.has(i)) return memo.get(i)!;
    if (seen.has(i)) return false;
    seen.add(i);
    let any = false;
    for (const j of sp.model.nodes[i]?.builds ?? []) if (asks(j) || asksAfter(j, seen)) { any = true; break; }
    memo.set(i, any);
    return any;
  };
  const anyQuestion = parts.some((p, i) => asks(i) && p.questions > 0);
  parts.forEach((p, i) => {
    const step = p.steps[0];
    const at = { entity: path, path, ...(step === undefined ? {} : { step }) };
    const stepName = step === undefined ? p.label : p.label || step;
    if (p.kind === 'read' && p.slides > SLIDES_IN_ROW && !(anyQuestion && !asksAfter(i) && i > 0 && parts.slice(0, i).some((_, k) => asks(k)))) {
      add({ code: 'path.slidesInRow', weight: 'should', message: t('worldChecks.path.slidesInRow.message', { name: quoted(path.label), count: p.slides, step: quoted(stepName), max: SLIDES_IN_ROW }), fix: t('worldChecks.path.slidesInRow.fix', { max: SLIDES_IN_ROW }), ...at });
    }
    if (p.kind === 'learn' && p.questions > QUESTIONS_IN_ROW) {
      const closing = !asksAfter(i);
      if (!closing) add({ code: 'path.questionsInRow', weight: 'should', message: t('worldChecks.path.questionsInRow.message', { name: quoted(path.label), count: p.questions, step: quoted(stepName), max: QUESTIONS_IN_ROW }), fix: t('worldChecks.path.questionsInRow.fix', { max: QUESTIONS_IN_ROW }), ...at });
      else if (p.questions > CLOSING_MAX) add({ code: 'path.longClosing', weight: 'should', message: t('worldChecks.path.longClosing.message', { name: quoted(path.label), count: p.questions, max: CLOSING_MAX }), fix: t('worldChecks.path.longClosing.fix', { max: CLOSING_MAX }), ...at });
    }
  });
  if (!anyQuestion && parts.some((p) => p.kind === 'read')) {
    add({ code: 'path.noQuestions', weight: 'should', message: t('worldChecks.path.noQuestions.message', { name: quoted(path.label) }), fix: t('worldChecks.path.noQuestions.fix'), entity: path, path });
  }
}

/** Die Befunde, die zu einem Eintrag gehören (für die Marke an einem Eintrag): als Ding, als Turm oder als Pfad. */
export const findingsOf = (report: WorldCheckReport, id: string): WorldFinding[] =>
  report.findings.filter((f) => f.entity?.id === id || f.tower?.id === id || f.path?.id === id);
