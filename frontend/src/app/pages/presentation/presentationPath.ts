/**
 * 2026-11-03 (G) — DIE ŚCIEŻKA EINER PRÄSENTATION (einer Erzählung aus Szenen): welche Einträge der Baza jede Szene
 * zählt — ihre Fragen, die eine echte Frage der Baza nennen (`question`: worüber sie ist) oder `about`, und Labore und
 * Bilder mit Ziel ebenso —, über den Graphen des Storyboards (`storyFlow.ts`) als Ścieżka (`cogita/flowPath.ts`):
 * ihre Gabeln sind Szenen mit Knöpfen, ihre Zusammenführungen die Szenen, zu denen die Wege wieder führen. Rein.
 */

import type { Flow } from '../../cogita/flow';
import { flowPath, type FlowPath } from '../../cogita/flowPath';
import type { PathModel } from '../../cogita/pathLayout';
import { storyPath, type StoryPath } from '../../cogita/storyPath';
import type { DraftPart } from '../page';
import { readPiece, type Show } from './presentation';
import { aboutOf } from './storyCard';
import type { StoryFlow } from './storyFlow';

/** Was der Weg aus Namen und Kennungen braucht — aus der Baza der Erzählung. */
export interface StoryRefs {
  readonly resolve: (ref: string) => string | null;
  /** Worüber eine Frage der Baza ist (leer: sie selbst). */
  readonly aboutOf: (questionId: string) => readonly string[];
  readonly label: (id: string) => string;
  readonly needsOf: (id: string) => readonly string[];
}

/** Die Bausteine, deren Antworten zählen können. */
const COUNTING = new Set(['question', 'physics', 'animation']);

/**
 * Je Szene die Einträge der Baza: worüber sie ist (`about` der Szene) und wofür ihre Bausteine zählen. Die Einheit der
 * Erzählung selbst (`skip`, das Ganze) ist kein Schritt.
 */
export function sceneEntries(parts: readonly DraftPart[], refs: StoryRefs, show?: Show, skip: ReadonlySet<string> = new Set()): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const sc of show?.scenes ?? []) {
    const ids = (sc.about ?? []).map((a) => refs.resolve(a)).filter((x): x is string => x !== null && !skip.has(x));
    if (ids.length > 0) out.set(sc.key, [...new Set(ids)]);
  }
  for (const part of parts) {
    if (!COUNTING.has(part.kind)) continue;
    const config = part.config as Readonly<Record<string, string | undefined>>;
    const ids: string[] = [];
    const q = (config.question ?? '').trim();
    if (q !== '') {
      const id = refs.resolve(q);
      if (id !== null) { const about = refs.aboutOf(id); ids.push(...(about.length > 0 ? about : [id])); }
    }
    for (const a of aboutOf(config.about)) { const id = refs.resolve(a); if (id !== null) ids.push(id); }
    const kept = ids.filter((x) => !skip.has(x));
    if (kept.length === 0) continue;
    for (const key of Object.keys(readPiece(part.layout).places)) {
      const list = out.get(key) ?? [];
      for (const id of kept) if (!list.includes(id)) list.push(id);
      out.set(key, list);
    }
  }
  return out;
}

export interface PresentationPath {
  readonly fp: FlowPath;
  /** 2026-11-04 — die Teile der Erzählung (Szenen zum Lesen, Szenen mit Fragen, Wahl auf einer Szene). */
  readonly sp: StoryPath;
  readonly model: PathModel;
  /** Die Szene (Index wie `show.scenes`), die einen Eintrag zuerst zeigt — −1: keine. */
  readonly sceneOf: (entry: string) => number;
}

export function presentationPath(story: StoryFlow, show: Show, parts: readonly DraftPart[], refs: StoryRefs, id: string, unit?: string | null): PresentationPath {
  const unitId = unit === undefined || unit === null ? null : refs.resolve(unit);
  const entries = sceneEntries(parts, refs, show, new Set(unitId === null ? [] : [unitId]));
  const flow: Flow = { id, name: '', look: 'scenes', start: story.start, graph: story.graph, slots: [], fill: {}, overrides: {}, goals: [], lines: [], narrators: [] };
  const fp = flowPath(flow, (node) => (node.id.startsWith('s:') ? entries.get(node.id.slice(2)) ?? [] : []), refs.label);
  /* Je Szene: wie viele Bausteine fragen (zählen) und ob sonst etwas zu lesen ist. */
  const asks = new Map<string, number>();
  const reads = new Set<string>();
  for (const part of parts) for (const key of Object.keys(readPiece(part.layout).places)) {
    if (COUNTING.has(part.kind)) asks.set(key, (asks.get(key) ?? 0) + 1); else reads.add(key);
  }
  const title = new Map(show.scenes.map((s) => [s.key, s.label || s.key] as const));
  const sp = storyPath(flow, (node) => {
    if (!node.id.startsWith('s:')) return { slides: 0, questions: 0, shown: [], asked: [] };
    const key = node.id.slice(2);
    const q = asks.get(key) ?? 0;
    const of = entries.get(key) ?? [];
    return { slides: q === 0 || reads.has(key) ? 1 : 0, questions: q, shown: q === 0 ? of : [], asked: q > 0 ? of : [] };
  }, (id) => (id.startsWith('s:') ? title.get(id.slice(2)) ?? id : refs.label(id)));
  const model = sp.model;

  const sceneOf = (entry: string): number => {
    const step = fp.stepOf.get(entry);
    return step === undefined || !step.startsWith('s:') ? -1 : show.scenes.findIndex((s) => s.key === step.slice(2));
  };
  return { fp, sp, model, sceneOf };
}
