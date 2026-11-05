/**
 * 2026-11-05 (Prompt 23, A1–A5) — FRAGEN ↔ FOLIEN AUS EINER BAZA: was eine Folie ist, der Index der Erzählungen, die Fragen
 * mit ihren Erklärungen (`slideLinks.ts` rechnet; hier nur das Lesen aus `CogitaLibrary`, einmal je Stand der Baza).
 */

import { lines } from './cardBasics';
import { readFlow, resolveFlow } from './flow';
import { questionGroups, questionsOfSlide, storyIndex, type QuestionGroup, type QuestionLike, type StoryIndex } from './slideLinks';
import type { CogitaLibrary } from './store';

interface Memo {
  readonly revision: number;
  readonly index: StoryIndex;
  readonly questions: readonly QuestionLike[];
  readonly slides: Map<string, boolean>;
  groups: QuestionGroup[] | null;
}
const MEMO = new WeakMap<CogitaLibrary, Memo>();

const resolveEntry = (lib: CogitaLibrary) => (ref: string): string | null => {
  const r = ref.trim();
  if (r.startsWith('@')) return lib.byImportRef(r.slice(1))?.id ?? null;
  return lib.entity(r) !== undefined ? r : null;
};
const resolveFlowRef = (lib: CogitaLibrary) => (ref: string): string | null => {
  const r = ref.trim();
  if (r.startsWith('@')) return lib.byImportRef(r.slice(1), 'flow')?.id ?? null;
  return lib.docs('flow').some((d) => d.id === r) ? r : null;
};

function memoOf(lib: CogitaLibrary): Memo {
  const had = MEMO.get(lib);
  if (had !== undefined && had.revision === lib.revision) return had;
  const docs = lib.docs('flow');
  const find = (x: string) => { const f = docs.find((one) => one.id === x); return f === undefined ? undefined : readFlow(f.id, f.data); };
  const flows = docs.map((d) => { try { return resolveFlow(readFlow(d.id, d.data), find); } catch { return readFlow(d.id, d.data); } })
    .filter((f) => f.presentation === undefined);
  const entry = resolveEntry(lib);
  const index = storyIndex(flows.map((f) => ({ id: f.id, name: f.name, ...(f.unit === undefined ? {} : { unit: f.unit }), graph: { nodes: f.graph.nodes } })), entry, resolveFlowRef(lib));
  const questions: QuestionLike[] = lib.entities().filter((e) => e.kinds.includes('question'))
    .map((e) => ({ id: e.id, explain: lines(e.data.explain).map((x) => entry(x) ?? x) }));
  const memo: Memo = { revision: lib.revision, index, questions, slides: new Map(), groups: null };
  MEMO.set(lib, memo);
  return memo;
}

/** Eine Folie: ein Eintrag (keine Frage) einer Art mit einem Feld „blocks“. */
export function isSlideEntity(lib: CogitaLibrary, id: string): boolean {
  const m = memoOf(lib);
  const had = m.slides.get(id);
  if (had !== undefined) return had;
  const e = lib.entity(id);
  const yes = e !== undefined && !e.kinds.includes('question') && e.kinds.some((k) => lib.kind(k)?.fields.some((f) => f.type === 'blocks') === true);
  m.slides.set(id, yes);
  return yes;
}

export const libStoryIndex = (lib: CogitaLibrary): StoryIndex => memoOf(lib).index;
export const libQuestions = (lib: CogitaLibrary): readonly QuestionLike[] => memoOf(lib).questions;

/** Die Fragen zu einer Folie (ihre Erklärung nennt sie). */
export const slideQuestionIds = (lib: CogitaLibrary, slide: string): string[] => questionsOf(lib, slide);
const questionsOf = (lib: CogitaLibrary, slide: string) => questionsOfSlide(memoOf(lib).questions, slide);

/** Die Gruppen der Landschaft „Pytania“ (einmal je Stand der Baza). */
export function libQuestionGroups(lib: CogitaLibrary): QuestionGroup[] {
  const m = memoOf(lib);
  if (m.groups === null) m.groups = questionGroups(m.questions, m.index, (id) => isSlideEntity(lib, id));
  return m.groups;
}

/** Ist dieser Eintrag die Einheit einer Erzählung (die Erklärung „Część opowieści“)? Ihre Erzählung — sonst `null`. */
export const storyOfUnit = (lib: CogitaLibrary, id: string): string | null => memoOf(lib).index.unitFlow.get(id) ?? null;
