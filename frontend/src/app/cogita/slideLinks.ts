/**
 * 2026-11-05 (Prompt 23, A2–A5) — FRAGEN ↔ FOLIEN, rein (ohne Oberfläche; geprüft in `scripts/app-slide-links-check.mjs`).
 * <code>
 *   Folie        ein Eintrag einer Art mit einem Feld „blocks“ (z. B. „Slajd opowieści“, „Folie“), den ein Schritt "show" einer
 *                Erzählung zeigt ("config.of"; die Kennung des Schrittes meist "s<key>")
 *   Führend      die Folien am Anfang der Erklärung ("explain") einer Frage — bis zum ersten Eintrag, der keine Folie ist
 *   Erzählung    wo eine Folie steht: zuerst eine begonnene, sonst die tiefere vor dem Überblick (die längere Leiter), sonst
 *                die erste; die Leiter über die Abstecher ("detour"), die in sie führen („Etap 1 › Sen dziewięciolatka“)
 *   Gruppe       die Fragen mit DENSELBEN führenden Folien (eine Gruppe = ein Feld der Landschaft „Pytania“), bei ihrer
 *                Erzählung, nach der Folge ihrer ersten Folie; eine Frage, deren Erklärung die Einheit einer Erzählung nennt
 *                (und keine Folie führt): die Gruppe „Cała opowieść“ dieser Erzählung, zuletzt
 *   Stand        aus der Kenntnis der Karten der Gruppe: alle gekonnt — Tal; alle schon beantwortet, manche nicht gekonnt —
 *                zu wiederholen; sonst lernbar, wenn die Gruppe davor (in derselben Erzählung) beantwortet ist, sonst ein Berg
 *                mit so vielen Stufen, wie offene Gruppen davor stehen (wie die Höhe der Säulen sonst)
 * </code>
 */

export interface StoryNodeLike {
  readonly id: string;
  readonly type: string;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface StoryFlowLike {
  readonly id: string;
  readonly name: string;
  readonly unit?: string;
  readonly graph: { readonly nodes: readonly StoryNodeLike[] };
}

export interface SlideAt {
  readonly flow: string;
  readonly step: string;
  /** Die wievielte Folie dieser Erzählung (0 zuerst). */
  readonly order: number;
}

export interface StoryIndex {
  readonly flows: ReadonlyMap<string, StoryFlowLike>;
  /** Die Erzählungen in der gegebenen Folge. */
  readonly order: readonly string[];
  /** Folie → wo sie gezeigt wird. */
  readonly shows: ReadonlyMap<string, readonly SlideAt[]>;
  /** Erzählung → die Erzählungen, deren Abstecher in sie führen. */
  readonly callers: ReadonlyMap<string, readonly string[]>;
  /** Einheit → ihre Erzählung. */
  readonly unitFlow: ReadonlyMap<string, string>;
  /** Erzählung → ihre Folien in der Folge ihrer Schritte. */
  readonly slidesOf: ReadonlyMap<string, readonly string[]>;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Der Index aller Erzählungen: welche Folie wo steht, wer in wen abbiegt, welche Einheit wem gehört. `entry` und `flow`
 * lösen Kennungen und @Namen auf (wie der Spieler: `contentOfLibrary(…).resolve` / `flowRef`).
 */
export function storyIndex(flows: readonly StoryFlowLike[], entry: (ref: string) => string | null, flow: (ref: string) => string | null): StoryIndex {
  const byId = new Map(flows.map((f) => [f.id, f] as const));
  const shows = new Map<string, SlideAt[]>();
  const callers = new Map<string, string[]>();
  const unitFlow = new Map<string, string>();
  const slidesOf = new Map<string, string[]>();
  for (const f of flows) {
    if (f.unit !== undefined && f.unit !== '') { const u = entry(f.unit) ?? f.unit; if (!unitFlow.has(u)) unitFlow.set(u, f.id); }
    const mine: string[] = [];
    for (const n of f.graph.nodes) {
      if (n.type === 'show' || n.type === 'expand') {
        const raw = str(n.config.of);
        const id = raw === '' ? null : entry(raw) ?? raw;
        if (id === null || mine.includes(id)) continue;
        const list = shows.get(id) ?? [];
        list.push({ flow: f.id, step: n.id, order: mine.length });
        shows.set(id, list);
        mine.push(id);
      } else if (n.type === 'detour') {
        const raw = str(n.config.flow);
        const to = raw === '' ? null : flow(raw);
        if (to === null || to === f.id) continue;
        const list = callers.get(to) ?? [];
        if (!list.includes(f.id)) list.push(f.id);
        callers.set(to, list);
      }
    }
    slidesOf.set(f.id, mine);
  }
  return { flows: byId, order: flows.map((f) => f.id), shows, callers, unitFlow, slidesOf };
}

/** Die Leiter einer Erzählung: vom obersten Überblick bis zu ihr (über den ersten Abstecher, der in sie führt; nie im Kreis). */
export function ladderOf(ix: StoryIndex, flow: string): string[] {
  const out = [flow];
  for (let at = flow, k = 0; k < 8; k += 1) {
    const up = (ix.callers.get(at) ?? []).find((c) => !out.includes(c));
    if (up === undefined) break;
    out.unshift(up);
    at = up;
  }
  return out;
}

/**
 * Wo eine Folie zu sehen ist: eine begonnene Erzählung zuerst, sonst die tiefere (die längere Leiter: die vertiefende vor dem
 * Überblick), sonst die erste in der Folge. `null`: keine Erzählung zeigt sie.
 */
export function storyForSlide(ix: StoryIndex, slide: string, started: (flow: string) => boolean = () => false): { readonly flow: string; readonly step: string; readonly ladder: readonly string[] } | null {
  const list = ix.shows.get(slide) ?? [];
  if (list.length === 0) return null;
  let best: SlideAt | null = null;
  let bestScore = -Infinity;
  for (const at of list) {
    const pos = ix.order.indexOf(at.flow);
    const score = (started(at.flow) ? 1000 : 0) + ladderOf(ix, at.flow).length * 10 - (pos < 0 ? 999 : pos) / 1000;
    if (score > bestScore) { bestScore = score; best = at; }
  }
  return best === null ? null : { flow: best.flow, step: best.step, ladder: ladderOf(ix, best.flow) };
}

/** Die führenden Folien einer Erklärung (bis zum ersten Eintrag, der keine Folie ist). */
export function leadingSlides(explain: readonly string[], isSlide: (id: string) => boolean): string[] {
  const out: string[] = [];
  for (const id of explain) { if (!isSlide(id)) break; if (!out.includes(id)) out.push(id); }
  return out;
}

export interface QuestionLike {
  readonly id: string;
  readonly explain: readonly string[];
}

/** Die Fragen, deren Erklärung diese Folie nennt (an irgendeiner Stelle), in der gegebenen Folge. */
export function questionsOfSlide(questions: readonly QuestionLike[], slide: string): string[] {
  return questions.filter((q) => q.explain.includes(slide)).map((q) => q.id);
}

export interface QuestionGroup {
  /** `s:<folie>+<folie>` oder `whole:<erzählung>`. */
  readonly key: string;
  readonly slides: readonly string[];
  readonly questions: readonly string[];
  /** Die Erzählung, bei der die Gruppe steht (`null`: keine zeigt ihre Folien). */
  readonly flow: string | null;
  /** Die wievielte Folie dieser Erzählung die erste der Gruppe ist (die ganze Erzählung: nach allen). */
  readonly order: number;
  /** Eine Frage über die ganze Erzählung (ihre Erklärung nennt die Einheit). */
  readonly whole: boolean;
}

/** DIE GRUPPEN DER LANDSCHAFT „PYTANIA“: je Satz führender Folien eine, bei ihrer Erzählung; „Cała opowieść“ zuletzt. */
export function questionGroups(questions: readonly QuestionLike[], ix: StoryIndex, isSlide: (id: string) => boolean): QuestionGroup[] {
  const groups = new Map<string, { key: string; slides: string[]; questions: string[]; flow: string | null; order: number; whole: boolean }>();
  for (const q of questions) {
    const lead = leadingSlides(q.explain, isSlide);
    let key: string;
    let slides: string[];
    let flow: string | null;
    let order: number;
    let whole = false;
    if (lead.length > 0) {
      key = `s:${lead.join('+')}`;
      slides = lead;
      const at = storyForSlide(ix, lead[0]);
      flow = at?.flow ?? null;
      order = at === null ? 0 : (ix.slidesOf.get(at.flow) ?? []).indexOf(lead[0]);
    } else {
      const unit = q.explain.find((id) => ix.unitFlow.has(id));
      if (unit === undefined) continue;
      flow = ix.unitFlow.get(unit)!;
      key = `whole:${flow}`;
      slides = [];
      order = Number.MAX_SAFE_INTEGER;
      whole = true;
    }
    const g = groups.get(key);
    if (g === undefined) groups.set(key, { key, slides, questions: [q.id], flow, order, whole });
    else if (!g.questions.includes(q.id)) g.questions.push(q.id);
  }
  const rank = (flow: string | null) => { const i = flow === null ? -1 : ix.order.indexOf(flow); return i < 0 ? Number.MAX_SAFE_INTEGER : i; };
  return [...groups.values()].sort((a, b) => rank(a.flow) - rank(b.flow) || a.order - b.order || a.key.localeCompare(b.key));
}

export type GroupBand = 'known' | 'due' | 'ring' | 'mountain';

export interface GroupStand {
  readonly band: GroupBand;
  /** Die Höhe in Stufen (Tal 0, lernbar 1, ein Berg 1 + offene Gruppen davor). */
  readonly steps: number;
  /** Die mittlere Kenntnis der Karten (0–1). */
  readonly share: number;
  readonly known: number;
  readonly total: number;
  /** Die Gruppe davor in derselben Erzählung (Index; −1: keine). */
  readonly before: number;
}

/** Wie eine Karte steht: ihre Kenntnis (0–1+) und ob sie je beantwortet wurde. */
export interface CardStand { readonly k: number; readonly seen: boolean }

/** Der Stand jeder Gruppe (in der Folge von `questionGroups`). `cardsOf`: der Stand der Karten einer Frage. */
export function groupStands(groups: readonly QuestionGroup[], cardsOf: (question: string) => readonly CardStand[]): GroupStand[] {
  const out: GroupStand[] = [];
  const openBefore = new Map<string, number>();
  const lastOf = new Map<string, number>();
  groups.forEach((g, i) => {
    const cards = g.questions.flatMap((q) => cardsOf(q));
    const total = cards.length;
    const known = cards.filter((c) => c.k >= 1 - 1e-9).length;
    const share = total === 0 ? 0 : cards.reduce((s, c) => s + Math.max(0, Math.min(1, c.k)), 0) / total;
    const flowKey = g.flow ?? `~${g.key}`;
    const before = lastOf.get(flowKey) ?? -1;
    const open = openBefore.get(flowKey) ?? 0;
    let band: GroupBand;
    if (total > 0 && known === total) band = 'known';
    else if (total > 0 && cards.every((c) => c.seen)) band = 'due';
    else band = open === 0 ? 'ring' : 'mountain';
    const steps = band === 'known' || band === 'due' ? 0 : band === 'ring' ? 1 : 1 + open;
    out.push({ band, steps, share, known, total, before });
    if (band === 'ring' || band === 'mountain') openBefore.set(flowKey, open + 1);
    lastOf.set(flowKey, i);
  });
  return out;
}
