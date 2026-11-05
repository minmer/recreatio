/**
 * 2026-11-03 — DIE VORSCHAU EINER BAZA WIEDZY AUS JSON (`preview_knowledge`, frontend/mcp/): ein Dokument im Format
 * „knowledge-base", importiert in einen Speicher ohne Dienst (`cogita/memoryBase.ts`), und ein gespeicherter Widok
 * daraus — gezeichnet von der echten Liste der Nauka (`EntityList`: Tabela, Drzewo, Macierz, Mapa postępów, Krajobraz …),
 * mit einem erfundenen Fortschritt (`none`, `partial`, `all`). Dazu Proben der Generatoren: je Pytanie mit `params` und
 * je Szablon mit zufälligen Knoten einige Fassungen mit ihren Antworten. Nichts wird gespeichert.
 */

import { useMemo, useState } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';

import { EntityList } from '../cogita/EntityList';
import { LandscapeView } from '../cogita/LandscapeView';
import { hashOf } from '../cogita/cardBasics';
import { Loading } from '../ui/Loading';
import {
  CARD_MOODS, generatorReport, memoryBase, PREVIEW_PROGRESS, PREVIEW_PROGRESS_LABEL, previewLearner,
  type CardMood, type GeneratorReport, type MemoryBase, type PreviewProgress
} from '../cogita/memoryBase';
import { CogitaContext, useAsync, type CogitaCtx } from '../cogita/ui';
import { LIST_MODE_LABEL, readView, type ListMode } from '../cogita/views';
import type { Learner } from '../cogita/learn';
import '../cogita/cogita.css';
import { t } from '../core/i18n';
import { drawingSamples, type DrawingSample } from '../cogita/interactiveCheck';

export interface KnowledgeInput {
  /** Das Dokument (`recreatio.cogita.course` oder `…schema`) — Objekt oder Text. */
  readonly doc: unknown;
  /** Welcher Widok: Kennung, bleibender Name (`@kurs/w-landschaft`) oder Name — leer: der erste mit Krajobraz, sonst der erste. */
  readonly view?: string | null;
  /** Eine andere Gestalt als gespeichert: `landscape`, `quilt`, `table`, `tree`, `matrix`, `map`, `outline` — oder die Wörter der Seite (`krajobraz`, `postepy` …). */
  readonly mode?: string | null;
  readonly progress?: string | null;
}

export interface ViewSummary {
  readonly id: string;
  readonly ref: string | null;
  readonly name: string;
  readonly mode: string;
}

export interface KnowledgeSummary {
  readonly name: string;
  readonly format: string;
  readonly entries: number;
  readonly questions: number;
  readonly kinds: readonly { readonly name: string; readonly count: number }[];
  readonly templates: number;
  readonly revisions: number;
  readonly cards: number;
  /** Wie viele Ebenen die Reihenfolge des Lernens hat; welche Kanten einen Kreis schlossen (weggelassen). */
  readonly levels: number;
  readonly circles: readonly string[];
  readonly views: readonly ViewSummary[];
  /** Die Gestalten, die dieser Bau kennt. */
  readonly modes: readonly string[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

export interface KnowledgeResult extends KnowledgeSummary {
  readonly shown: ViewSummary & { readonly asked: string | null; readonly note: string | null; readonly entries: number };
  readonly progress: { readonly name: PreviewProgress; readonly label: string; readonly counts: Readonly<Record<CardMood, number>> };
}

export interface SamplesResult {
  readonly name: string;
  readonly generators: readonly GeneratorReport[];
  /** 2026-11-05 (Prompt 23, D3) — die Rysunki do poruszania: unbekannte Namen, erreicht die Lösung ihr Ziel? */
  readonly drawings?: readonly DrawingSample[];
}

/* -- Die Baza, einmal je Dokument --------------------------------------------------------------------------------- */

let cached: { readonly key: string; readonly base: MemoryBase; readonly copies: Map<string, string> } | null = null;

async function baseFor(doc: unknown): Promise<{ base: MemoryBase; copies: Map<string, string> } | { error: string }> {
  const text = typeof doc === 'string' ? doc : JSON.stringify(doc ?? null);
  const key = `${text.length}:${hashOf(text)}`;
  if (cached !== null && cached.key === key) return cached;
  const base = await memoryBase(doc);
  if ('error' in base) return base;
  cached = { key, base, copies: new Map() };
  return cached;
}

/* -- Welcher Widok, welche Gestalt -------------------------------------------------------------------------------- */

const MODE_WORDS: Readonly<Record<string, string>> = {
  tabela: 'table', drzewo: 'tree', macierz: 'matrix', mapa: 'map', 'postępy': 'quilt', postepy: 'quilt', 'mapa postępów': 'quilt', // i18n-ignore: Wörter der Seite, Eingabe
  kafelki: 'quilt', krajobraz: 'landscape', struktura: 'outline', 'płótno': 'canvas', plotno: 'canvas' // i18n-ignore
};

/** Die Gestalten, die dieser Bau kennt (was `readView` nicht kennt, wird Tabela). */
export const knownModes = (): string[] => Object.keys(LIST_MODE_LABEL);

const refOf = (base: MemoryBase, id: string): string | null => {
  const r = base.lib.entry(id)?.data._ref;
  return typeof r === 'string' && r !== '' ? `@${r}` : null;
};

function viewsOf(base: MemoryBase): ViewSummary[] {
  return base.lib.docs('view').filter((e) => !e.data._previewCopy).map((e) => {
    const v = readView(e.data);
    return { id: e.id, ref: refOf(base, e.id), name: v.name, mode: typeof e.data.mode === 'string' ? e.data.mode : v.mode };
  });
}

interface Picked {
  readonly id: string;
  readonly summary: ViewSummary;
  readonly asked: string | null;
  readonly note: string | null;
}

async function pickView(base: MemoryBase, copies: Map<string, string>, said: string | null, askedMode: string | null): Promise<Picked | { error: string }> {
  const views = viewsOf(base);
  const want = (said ?? '').trim().replace(/^@/, '').toLowerCase();
  let chosen: ViewSummary | undefined;
  if (want !== '') {
    chosen = views.find((v) => v.id.toLowerCase() === want) ?? views.find((v) => (v.ref ?? '').replace(/^@/, '').toLowerCase() === want)
      ?? views.find((v) => v.name.trim().toLowerCase() === want);
    if (chosen === undefined) return { error: t('preview.knowledge.noView', { view: said ?? '', list: views.map((v) => `${v.ref ?? v.id} („${v.name}”, ${v.mode})`).join('; ') || t('preview.knowledge.none') }) };
  } else {
    chosen = views.find((v) => v.mode === 'landscape') ?? views[0];
  }
  const asked = askedMode === null || askedMode.trim() === '' ? null : askedMode.trim().toLowerCase();
  const mode = asked === null ? null : (MODE_WORDS[asked] ?? asked);
  const knows = (m: string) => readView({ mode: m }).mode === m;
  const notes: string[] = [];
  if (mode !== null && !knows(mode)) notes.push(t('preview.knowledge.unknownAsked', { mode: asked ?? '' }));
  if (chosen === undefined) {
    /* Ohne Widok: alle Einträge, in der gewünschten Gestalt (sonst als Tabela). */
    const fallback = mode !== null && knows(mode) ? mode : 'table';
    const key = `*:${fallback}`;
    let id = copies.get(key);
    if (id === undefined) {
      id = (await base.writer.saveDoc('view', { name: t('preview.knowledge.allEntries'), mode: fallback, steps: [{ type: 'source.all', config: {} }], _previewCopy: true })).id;
      copies.set(key, id);
    }
    notes.push(t('preview.knowledge.noSavedView'));
    return { id, summary: { id, ref: null, name: t('preview.knowledge.allEntries'), mode: fallback }, asked, note: notes.join(' ') || null };
  }
  if (!knows(chosen.mode)) notes.push(t('preview.knowledge.unknownSaved', { mode: chosen.mode }));
  if (mode === null || !knows(mode) || mode === chosen.mode) return { id: chosen.id, summary: chosen, asked, note: notes.join(' ') || null };
  /* Eine andere Gestalt: eine Abschrift des Widoku, nur in diesem Speicher. */
  const key = `${chosen.id}:${mode}`;
  let id = copies.get(key);
  if (id === undefined) {
    const data = base.lib.docs('view').find((e) => e.id === chosen!.id)?.data ?? {};
    id = (await base.writer.saveDoc('view', { ...data, mode, _previewCopy: true })).id;
    copies.set(key, id);
  }
  return { id, summary: { ...chosen, mode }, asked, note: notes.join(' ') || null };
}

const progressOf = (said: string | null | undefined): PreviewProgress =>
  (PREVIEW_PROGRESS as readonly string[]).includes(String(said ?? '').trim()) ? (String(said).trim() as PreviewProgress) : 'none';

/* -- Was die Baza ist --------------------------------------------------------------------------------------------- */

async function summaryOf(base: MemoryBase, doc: unknown): Promise<KnowledgeSummary> {
  const lib = base.lib;
  const own = lib.entities();
  const counts = new Map<string, number>();
  for (const e of own) for (const k of e.kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  const graph = lib.prerequisites();
  const name = (id: string) => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
  const format = typeof doc === 'object' && doc !== null && typeof (doc as { format?: unknown }).format === 'string' ? (doc as { format: string }).format
    : typeof doc === 'string' ? (/"format"\s*:\s*"([^"]+)"/.exec(doc)?.[1] ?? '') : '';
  const { cards } = await lib.cards('podglad');
  return {
    name: base.name,
    format,
    entries: own.filter((e) => !e.kinds.includes('question')).length,
    questions: own.filter((e) => e.kinds.includes('question')).length,
    kinds: [...counts].map(([id, count]) => ({ name: id === 'question' ? t('preview.knowledge.question') : lib.kind(id)?.name ?? id, count })).sort((a, b) => b.count - a.count),
    templates: lib.docs('template').length,
    revisions: lib.docs('revision').length,
    cards: new Set(cards.map((c) => c.key)).size,
    levels: graph.level.size === 0 ? 0 : Math.max(...graph.level.values()) + 1,
    circles: graph.circles.map((d) => `${name(d.child)} → ${name(d.parent)}`),
    views: viewsOf(base),
    modes: knownModes(),
    lines: base.lines,
    warnings: base.warnings
  };
}

/* -- Das Bild ----------------------------------------------------------------------------------------------------- */

function KnowledgeFrame({ base, viewId, learner, title, sub }: { base: MemoryBase; viewId: string; learner: Learner; title: string; sub: string }) {
  const [opened, setOpened] = useState<string | null>(null);
  const ctx = useMemo<CogitaCtx>(() => ({
    lib: base.lib, name: base.name, writes: false,
    keyOf: () => Promise.resolve(undefined), keyIn: () => Promise.resolve(undefined),
    me: null, who: null, learner, href: () => '#'
  }), [base, learner]);
  const entity = opened === null ? undefined : base.lib.entity(opened);
  /* Ein Krajobraz: die Ansicht der Nauka selbst (`LandscapeView`), mit allen Karten der Baza; jede andere Gestalt in der Liste der Nauka. */
  const doc = base.lib.docs('view').find((e) => e.id === viewId);
  const view = useMemo(() => readView(doc?.data), [doc]);
  const landscape = view.mode === 'landscape';
  const cards = useAsync(landscape ? () => base.lib.cards('podglad').then((r) => r.cards) : null, [base, landscape]);
  return (
    <div className="wk-root wk-plain pv-knowledge" data-pv-knowledge="">
      <main className="wk-main">
        <header className="pv-k-head">
          <h1 className="wk-h1">{title}</h1>
          <p className="pv-k-sub">{sub}</p>
        </header>
        <section className="pv-k-view" data-pv-part="view">
          <CogitaContext.Provider value={ctx}>
            {!landscape ? <EntityList viewId={viewId} onOpen={setOpened} onView={() => undefined} />
              : cards == null ? <Loading lines={3} />
                : <LandscapeView view={view} cards={cards} learner={learner} onOpen={setOpened} viewKey={`podglad:${viewId}`} />}
          </CogitaContext.Provider>
        </section>
        {entity !== undefined && <p className="pv-k-open" data-pv-opened={entity.id}>{t('preview.knowledge.clicked', { label: base.lib.label(entity) })}</p>}
      </main>
    </div>
  );
}

/**
 * DIE BAZA ZEICHNEN — in `node` (der Wurzel der Vorschau) statt der Seite. Zurück: was die Baza ist, welcher Widok in
 * welcher Gestalt zu sehen ist, und wie viele Karten in welchem Zustand sind.
 */
export async function renderKnowledge(node: HTMLElement, root: Root | null, input: KnowledgeInput): Promise<{ root: Root; result: KnowledgeResult } | { error: string }> {
  const built = await baseFor(input.doc);
  if ('error' in built) return built;
  const { base, copies } = built;
  const picked = await pickView(base, copies, input.view ?? null, input.mode ?? null);
  if ('error' in picked) return picked;
  const progress = progressOf(input.progress);
  const pl = await previewLearner(base.lib, progress);
  const summary = await summaryOf(base, input.doc);
  const shownEntries = base.lib.entities().length;
  root?.unmount();
  const next = createRoot(node);
  const counted = CARD_MOODS.filter((m) => pl.counts[m] > 0).map((m) => `${t(MOOD_WORD[m])} ${pl.counts[m]}`).join(' · ');
  /* Ohne StrictMode — wie die gebaute Seite: Effekte laufen einmal. */
  next.render(
    <KnowledgeFrame base={base} viewId={picked.id} learner={pl.learner} title={base.name}
      sub={`${t('preview.knowledge.view', { name: picked.summary.name })} · ${LIST_MODE_LABEL[picked.summary.mode as ListMode] ?? picked.summary.mode} · ${PREVIEW_PROGRESS_LABEL[progress]}${counted === '' ? '' : ` — ${t('preview.knowledge.cards', { list: counted })}`}`} />
  );
  return {
    root: next,
    result: {
      ...summary,
      shown: { ...picked.summary, asked: picked.asked, note: picked.note, entries: shownEntries },
      progress: { name: progress, label: PREVIEW_PROGRESS_LABEL[progress], counts: pl.counts }
    }
  };
}

const MOOD_WORD: Readonly<Record<CardMood, string>> = { known: 'preview.knowledge.mood.known', due: 'preview.knowledge.mood.due', forgotten: 'preview.knowledge.mood.forgotten', wrong: 'preview.knowledge.mood.wrong', new: 'preview.knowledge.mood.new' };

/** PROBEN DER GENERATOREN — ohne zu zeichnen. */
export async function knowledgeSamples(input: KnowledgeInput & { readonly count?: number | null }): Promise<SamplesResult | { error: string }> {
  const built = await baseFor(input.doc);
  if ('error' in built) return built;
  const lib = built.base.lib;
  const refOf = (id: string): string | null => { const r = lib.entry(id)?.data._ref; return typeof r === 'string' && r !== '' ? `@${r}` : null; };
  return { name: built.base.name, generators: await generatorReport(lib, input.count ?? 10), drawings: drawingSamples(lib.entities(), refOf) };
}

/** Was die Baza ist — ohne zu zeichnen (schnell, für den Bericht ohne Bilder). */
export async function knowledgeSummary(input: KnowledgeInput): Promise<KnowledgeSummary | { error: string }> {
  const built = await baseFor(input.doc);
  if ('error' in built) return built;
  return summaryOf(built.base, input.doc);
}
