/**
 * 2026-10-27 — DIE VORSCHAU EINES DOKUMENTS DER SEITE (`preview.html`): so,
 * wie die Seite nach dem Import aussähe — gezeichnet von der echten
 * Anwendung, nicht von einem Nachbau.
 *
 * <b>Der Weg ist der der Besucher.</b> Aus dem Dokument entsteht der Plan des
 * Imports und daraus die Antwort von `GET /page/<pfad>` (`previewDoc.ts`);
 * dieses Stück legt sie zwischen die Anwendung und den Dienst
 * (`previewFetch.ts`) und startet die Anwendung unter `#/<pfad>` — dieselbe
 * Kopfleiste, dasselbe Menü, dieselben Bausteine, dieselben Slajdy und Szenen
 * wie auf recreatio.pl. Was die Seite sonst vom Dienst holt (öffentliche
 * Kalender, Messen, Bibliotheken), kommt von dort, lesend; geschrieben wird
 * nichts.
 *
 * <b>Zwei, die es benutzen.</b> Der MCP-Dienst für Assistenten
 * (`frontend/mcp/`) öffnet die Seite mit `?driver` in einem Browser ohne
 * Fenster und steuert sie über `window.recreatioPreview`: laden, warten, messen,
 * Slajdy und Szenen an eine genaue Stelle stellen, Bewegungen anhalten, ein
 * Modul in jeder Grösse zeigen. Ein Mensch öffnet sie ohne `?driver` und fügt
 * das JSON ein.
 *
 * <b>Nur aus derselben Herkunft.</b> Ein Dokument kommt von der Hand dessen,
 * der davorsitzt, vom Treiber, oder als Nachricht von derselben Herkunft —
 * nie aus der Adresse: sonst liesse sich unter recreatio.pl fremder Inhalt
 * zeigen.
 */

import { StrictMode, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { API, call } from '../core/session';
import { mountApp } from '../mount';
import { parsePath } from '../routes';
import { PublicFrame } from '../shell/Frame';
import type { PageContent } from '../pages/page';
import { PageAccessContext } from '../pages/pageAccess';
import { pageDescription, partDescription } from '../pages/pageJsonText';
import { PageLogicProvider } from '../pages/PageLogicView';
import { PersonProvider } from '../pages/pagePerson';
import { PageSubjectProvider } from '../pages/pageSubject';
import { breakpointFor, COLUMNS } from '../pages/layout';
import { partSize } from '../pages/part';
import { PARTS, partOf, standIn } from '../pages/parts/registry';
import { PreviewControlContext, type PreviewControl } from '../pages/previewControl';
import type { DriveControl } from '../pages/presentation/usePresentationDrive';
import type { DeckControl, DeckTrack } from '../pages/slides/SlideDeck';
import { showPreviewFiles } from '../pages/slides/slideLook';
import { ModuleMatrix } from './ModuleMatrix';
import { PreviewForm } from './PreviewForm';
import {
  cleanPath, deckPlanOf, modulesOf, pickModule, planPreview, PREVIEW_PATH, readDoc, showPlanOf, sizesFor,
  type DeckPlan, type ModuleSummary, type PreviewInput, type PreviewPlan
} from './previewDoc';
import { installPreviewFetch, type FetchEntry, type PreviewFetch } from './previewFetch';
import { previewFileMap, type GivenFiles } from './previewFiles';
import { lintDocument, type LintItem } from './previewLint';
import { animatedItems, measureView, nextFrames, seek, settle, type Settled, type ViewKind, type ViewMeasure } from './previewProbe';
import './preview.css';

/* -- Was der Treiber bekommt --------------------------------------------------------- */

export interface LoadInput extends PreviewInput {
  /** Schlüssel einer Bitte aus "images" → eine `data:`-Adresse (die Datei, die der Assistent mitgibt). */
  readonly files?: GivenFiles | null;
  /** Öffentliche Daten vom Dienst holen (Kalender, Messen …) — sonst bleiben solche Bausteine leer. */
  readonly live?: boolean;
  /**
   * Auf DIESE bestehende Seite importieren (ihr Pfad): sie wird vom Dienst geholt,
   * wie ein Besucher sie sieht, und das Dokument geht darauf — Bausteine mit
   * bekannter Kennung ändern sich an Ort und Stelle, wie beim echten Import.
   */
  readonly basePath?: string | null;
}

export interface CheckResult {
  readonly kind: string;
  readonly path: string;
  readonly mode: string;
  readonly title: string | null;
  readonly lead: string | null;
  /** `auto` (folgt dem Gerät), `light`, `dark`, `light+night` … */
  readonly theme: string;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  readonly notes: readonly string[];
  readonly lint: readonly LintItem[];
  readonly needs: readonly { readonly key: string; readonly label: string; readonly description: string; readonly kind: string; readonly uses: number; readonly declared: boolean }[];
  readonly modules: readonly ModuleSummary[];
  readonly deck: DeckPlan | null;
  readonly show: {
    readonly route: readonly string[];
    readonly offRoute: readonly string[];
    readonly unreachable: readonly string[];
    readonly zones: readonly { readonly key: string; readonly at: number; readonly to: number }[];
    readonly scenes: readonly {
      readonly key: string; readonly label: string; readonly steps: number; readonly change: string; readonly next: string | null;
      readonly hint: string; readonly layers: number; readonly pieces: readonly number[];
    }[];
    readonly format: string;
    readonly nav: string;
    readonly backdrop: number;
    readonly story: boolean;
  } | null;
  readonly menu: { readonly items: number; readonly from: string | null } | null;
}

export interface LoadResult {
  readonly check: CheckResult;
  readonly view: ViewKind;
  readonly settled: Settled;
}

export interface PreviewApi {
  /** Was zeichnet: die Quellen (Entwicklung) oder ein Bau, und von wo. */
  readonly renderer: { readonly dev: boolean; readonly origin: string; readonly api: string };
  readonly check: (input: LoadInput) => Promise<CheckResult | { error: string }>;
  /** Welche Bausteine sich gerade nach der Uhr bewegen (Kennung → längste Dauer in ms). */
  readonly animated: () => Record<string, number>;
  readonly load: (input: LoadInput) => Promise<LoadResult | { error: string }>;
  readonly matrix: (input: LoadInput, which?: string | number | null) => Promise<{
    check: CheckResult; module: ModuleSummary; settled: Settled;
    cells: readonly { size: string; width: string; height: string; folded: boolean; shows: string }[];
  } | { error: string }>;
  readonly settle: (timeout?: number) => Promise<Settled>;
  readonly measure: () => ViewMeasure & { readonly view: ViewKind; readonly labels: Record<string, string> };
  readonly deck: () => DeckTrack | null;
  readonly holdDeck: (at: number | null) => Promise<DeckTrack | null>;
  readonly show: () => { readonly route: readonly string[]; readonly at: number } | null;
  readonly goShow: (s: number) => Promise<number | null>;
  readonly seek: (t: number | null) => void;
  readonly fetches: () => readonly FetchEntry[];
  readonly format: (kind?: string | null) => { readonly text: string; readonly kinds: readonly { kind: string; label: string; use: string; box: string; retired: boolean }[] };
}

declare global {
  interface Window { recreatioPreview?: PreviewApi }
}

/* -- Der Zustand dieser Seite -------------------------------------------------------- */

interface State {
  fetches: PreviewFetch;
  controls: PreviewControl;
  root: Root | null;
  current: PreviewPlan | null;
  view: ViewKind;
  node: HTMLElement;
}

const themeWord = (pp: PreviewPlan): string => {
  const theme = (pp.plan.look ?? pp.now.look).theme;
  if (theme === null) return 'auto';
  return theme.night != null ? `${theme.mode}+night` : theme.mode;
};

function checkOf(pp: PreviewPlan, doc: unknown): CheckResult {
  const modules = modulesOf(pp);
  const number = new Map(modules.map((m) => [m.id, m.n] as const));
  const mode = pp.content.mode ?? 'page';
  const showPlan = mode === 'presentation' ? showPlanOf(pp) : null;
  const menu = pp.content.menu ?? null;
  return {
    kind: pp.kind,
    path: pp.path,
    mode,
    title: pp.content.title,
    lead: pp.content.lead,
    theme: themeWord(pp),
    lines: pp.lines,
    warnings: pp.warnings,
    notes: pp.notes,
    lint: lintDocument(doc),
    needs: pp.needs.map((n) => ({ key: n.key, label: n.label, description: n.description, kind: n.kind, uses: n.uses, declared: n.declared })),
    modules,
    deck: mode === 'slides' ? deckPlanOf(pp) : null,
    show: showPlan === null ? null : {
      route: showPlan.route,
      offRoute: showPlan.offRoute,
      unreachable: showPlan.unreachable,
      zones: showPlan.zones,
      scenes: showPlan.show.scenes.map((scene) => ({
        key: scene.key, label: scene.label, steps: scene.steps, change: scene.change, next: scene.next, hint: scene.hint,
        layers: scene.layers.length,
        pieces: (showPlan.pieces[scene.key] ?? []).map((id) => number.get(id) ?? 0)
      })),
      format: showPlan.show.format,
      nav: showPlan.show.nav,
      backdrop: showPlan.show.backdrop.length,
      story: showPlan.show.story !== null
    },
    menu: menu === null ? null : { items: menu.items.length, from: pp.menuFrom }
  };
}

/** Eine Adresse, die die Anwendung als Seite liest — sonst die der Vorschau. */
function pagePath(path: string): string {
  const clean = cleanPath(path);
  return clean !== '' && parsePath(`#/${clean}`).page === clean ? clean : PREVIEW_PATH;
}

/** Der Plan — und, wenn das Menü von einer anderen Seite kommt, deren Menü. */
async function prepare(state: State, input: LoadInput): Promise<{ pp: PreviewPlan; doc: unknown } | { error: string }> {
  const read = readDoc(input.doc);
  if ('error' in read) return read;
  const doc = read.value;
  state.fetches.setLive(input.live !== false);

  /* Die Seite, auf die importiert wird — vom Dienst, wie ein Besucher sie bekommt. */
  let base = input.base ?? null;
  const basePath = cleanPath(input.basePath ?? '');
  if (base === null && basePath !== '') {
    state.fetches.serve('', null);
    try {
      base = await call<PageContent>(`/page/${basePath.split('/').map(encodeURIComponent).join('/')}`);
    } catch (e) {
      return { error: `Strony „${basePath}” nie da się pobrać (${e instanceof Error ? e.message : 'błąd'}) — tylko strony publiczne, i tylko z danymi na żywo.` };
    }
    if (base.locked === true) return { error: `Strona „${basePath}” jest zaszyfrowana — podgląd jej nie otworzy.` };
  }

  const first = planPreview({ ...input, doc, base, path: input.path ?? (basePath || null) });
  if ('error' in first) return first;
  const path = pagePath(first.path);
  const pp = path === first.path ? first : planPreview({ ...input, doc, base, path });
  if ('error' in pp) return pp;
  let content: PageContent = pp.content;
  if (pp.menuFrom !== null && input.live !== false) {
    try {
      const other = await call<PageContent>(`/page/${pp.menuFrom.split('/').map(encodeURIComponent).join('/')}`);
      content = { ...content, menu: { from: pp.menuFrom, items: other.menu?.items ?? [] } };
    } catch { /* ohne fremdes Menü */ }
  }
  showPreviewFiles(previewFileMap(pp.needs, pp.files, input.files ?? {}));
  state.fetches.serve(pp.path, content);
  standInForms(pp);
  return { pp: { ...pp, content }, doc };
}

/** Das Formular, wie es die Seite ohne Vorschau zeichnet. */
const FORM = PARTS.find((one) => one.kind === 'form');

/**
 * FORMULARE MIT FRAGEN IM DOKUMENT: was der Import aus ihnen macht, zeichnet
 * die Vorschau aus dem Dokument (`PreviewForm.tsx`) — ein Formular, auf das
 * das Dokument nur zeigt, bleibt das echte.
 */
function standInForms(pp: PreviewPlan): void {
  const wished = new Map<string, { questions: unknown; design: unknown }>();
  for (const [partId, wish] of pp.plan.forms) {
    if (wish.questions === undefined && wish.design === undefined) continue;
    const part = pp.plan.parts.find((one) => one.id === partId);
    if (part !== undefined) wished.set(part.moduleId ?? part.id, { questions: wish.questions ?? [], design: wish.design ?? null });
  }
  if (FORM === undefined || wished.size === 0) { standIn('form', null); return; }
  const Real = FORM.View;
  const View: typeof FORM.View = ({ raw, ctx }) => {
    const one = wished.get(ctx.moduleId);
    return one === undefined ? <Real raw={raw} ctx={ctx} /> : <PreviewForm title={(raw.title ?? '').trim()} questions={one.questions} design={one.design} />;
  };
  standIn('form', { ...FORM, View });
}

function unmount(state: State): void {
  seek(null);
  state.root?.unmount();
  state.root = null;
}

/** Die Steuerung von Folge und Bühne um die Anwendung — und für den Menschen eine kleine Leiste. */
function wrapApp(state: State, extra: ReactNode): (app: ReactNode) => ReactNode {
  return (app) => (
    <PreviewControlContext.Provider value={state.controls}>
      {app}
      {extra}
    </PreviewControlContext.Provider>
  );
}

function viewOf(mode: string): ViewKind {
  return mode === 'slides' ? 'slides' : mode === 'presentation' ? 'presentation' : 'page';
}

async function loadInto(state: State, input: LoadInput, bar: ReactNode): Promise<LoadResult | { error: string }> {
  const ready = await prepare(state, input);
  if ('error' in ready) return ready;
  const { pp, doc } = ready;
  unmount(state);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${pp.path}`);
  state.current = pp;
  state.view = viewOf(pp.content.mode ?? 'page');
  state.root = mountApp(state.node, wrapApp(state, bar));
  const settled = await settle(state.fetches);
  return { check: checkOf(pp, doc), view: state.view, settled };
}

async function matrixInto(state: State, input: LoadInput, which: string | number | null | undefined) {
  const ready = await prepare(state, input);
  if ('error' in ready) return ready;
  const { pp, doc } = ready;
  const part = pickModule(pp, which);
  if (part === null) return { error: `Nie ma takiego modułu: ${String(which ?? '')} — podaj M1…M${pp.plan.parts.length}, "modules[i]", id albo rodzaj.` };
  const modules = modulesOf(pp);
  const module = modules.find((m) => m.id === part.id)!;
  unmount(state);
  state.current = pp;
  state.view = 'matrix';
  const root = createRoot(state.node);
  root.render(
    <StrictMode>
      <PublicFrame>
        <PageAccessContext.Provider value={null}>
          <PersonProvider path={pp.path}>
            <PageSubjectProvider subject={pp.content.subject ?? null} path={pp.path}>
              <PageLogicProvider logic={pp.content.logic ?? null}>
                <ModuleMatrix part={part} n={module.n} />
              </PageLogicProvider>
            </PageSubjectProvider>
          </PersonProvider>
        </PageAccessContext.Provider>
      </PublicFrame>
    </StrictMode>
  );
  state.root = root;
  const settled = await settle(state.fetches);
  /* Je Grösse der Satz des Editors (`shows`) — wie über den Kacheln. */
  const def = partOf(part.kind);
  const cells = sizesFor(COLUMNS[breakpointFor(window.innerWidth)]).map((box) => {
    const size = partSize(box);
    return {
      size: `${box.colSpan}x${box.rowSpan}`, width: size.width, height: size.height,
      folded: def !== undefined && def.strip !== null && size.height === 'strip',
      shows: def?.shows(part.config, size) ?? ''
    };
  });
  return { check: checkOf(pp, doc), module, cells, settled };
}

function labelsOf(state: State): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.current === null) return out;
  state.current.plan.parts.forEach((part, i) => { out[part.id] = `M${i + 1} ${part.kind}`; });
  return out;
}

/* -- Für den Menschen: einfügen und ansehen ------------------------------------------- */

const KEEP = 'recreatio.preview.doc';

function PasteForm({ onShow, problem }: { onShow: (text: string, live: boolean) => void; problem: string | null }) {
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(KEEP) ?? ''; } catch { return ''; }
  });
  const [live, setLive] = useState(true);
  return (
    <div className="wk-root wk-public">
      <main className="wk-main pv-paste">
        <h1 className="wk-h1">Podgląd strony z JSON</h1>
        <p>Wklej dokument strony (<code>recreatio/page</code>, moduł albo stary dokument wydarzenia) — zobaczysz stronę tak, jak będzie wyglądała po imporcie. Nic nie jest zapisywane.</p>
        {problem !== null && <p className="wk-error" role="alert">{problem}</p>}
        <textarea className="wk-json-text" rows={18} value={text} spellCheck={false} aria-label="Dokument JSON" onChange={(e) => setText(e.target.value)} />
        <label className="pv-paste-live"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Dane na żywo (kalendarze, msze — tylko odczyt)</label>
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={text.trim() === ''} onClick={() => onShow(text, live)}>Pokaż stronę</button>
        </div>
      </main>
    </div>
  );
}

function Bar({ onBack, problem }: { onBack: () => void; problem: string | null }) {
  return (
    <div className="pv-bar" role="status">
      <span>Podgląd · nic nie jest zapisane{problem === null ? '' : ` · ${problem}`}</span>
      <button type="button" className="wk-link-btn" onClick={onBack}>Zmień JSON</button>
    </div>
  );
}

function showForm(state: State, problem: string | null = null): void {
  unmount(state);
  const root = createRoot(state.node);
  state.root = root;
  root.render(
    <StrictMode>
      <PasteForm problem={problem} onShow={(text, live) => {
        try { sessionStorage.setItem(KEEP, text); } catch { /* ohne Speicher */ }
        void loadInto(state, { doc: text, live }, <Bar onBack={() => showForm(state)} problem={null} />).then((done) => {
          if ('error' in done) showForm(state, done.error);
        });
      }} />
    </StrictMode>
  );
}

/* -- Der Einstieg ------------------------------------------------------------------------ */

export function startPreview(node: HTMLElement): void {
  const fetches = installPreviewFetch(API);
  const deck = { current: null as DeckControl | null };
  const show = { current: null as DriveControl | null };
  const state: State = { fetches, controls: { deck, show }, root: null, current: null, view: 'page', node };

  const api: PreviewApi = {
    renderer: { dev: import.meta.env.DEV, origin: window.location.origin, api: new URL(API, window.location.href).href },
    check: async (input) => {
      const ready = await prepare(state, input);
      return 'error' in ready ? ready : checkOf(ready.pp, ready.doc);
    },
    load: (input) => loadInto(state, input, null),
    matrix: (input, which) => matrixInto(state, input, which),
    settle: (timeout) => settle(fetches, timeout),
    measure: () => ({ ...measureView(state.view), view: state.view, labels: labelsOf(state) }),
    deck: () => deck.current?.track?.() ?? null,
    holdDeck: async (at) => {
      const control = deck.current;
      if (control?.hold === undefined) return null;
      control.hold(at);
      await nextFrames(3);
      return control.track?.() ?? null;
    },
    show: () => {
      const control = show.current;
      return control === null ? null : { route: control.route?.() ?? [], at: control.at() };
    },
    goShow: async (s) => {
      const control = show.current;
      if (control === null) return null;
      control.go(s, 0);
      await nextFrames(3);
      return control.at();
    },
    animated: () => animatedItems(state.view),
    seek,
    fetches: () => fetches.log(),
    format: (kind) => ({
      text: kind != null && kind !== '' && partOf(kind) !== undefined ? partDescription(kind) : pageDescription(),
      kinds: PARTS.map((def) => ({ kind: def.kind, label: def.label, use: def.use, box: `${def.box.colSpan}×${def.box.rowSpan}`, retired: def.retired !== undefined }))
    })
  };
  window.recreatioPreview = api;

  /* Ein Dokument von derselben Herkunft (ein anderes Fenster der Plattform, ein Werkzeug auf localhost). */
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { recreatioPreview?: LoadInput } | null;
    if (data?.recreatioPreview === undefined) return;
    void loadInto(state, data.recreatioPreview, <Bar onBack={() => showForm(state)} problem={null} />);
  });

  /*
   * Der Treiber lädt selbst; ein Mensch fügt ein — oder öffnet den Link aus dem
   * Bericht (`?doc=<id>`): das Dokument liegt dann beim Dienst der Vorschau auf
   * DIESER Herkunft (`/__preview/doc/<id>`, frontend/mcp/host.mjs). Auf
   * recreatio.pl gibt es den Pfad nicht — dort bleibt nur das Einfügen.
   */
  const params = new URLSearchParams(window.location.search);
  const docId = params.get('doc');
  if (docId !== null) {
    void fetch(`/__preview/doc/${encodeURIComponent(docId)}`)
      .then((response) => (response.ok ? response.json() as Promise<LoadInput> : Promise.reject(new Error('gone'))))
      .then((input) => loadInto(state, input, <Bar onBack={() => showForm(state)} problem={null} />))
      .then((done) => { if ('error' in done) showForm(state, done.error); })
      .catch(() => showForm(state, 'Tego podglądu już nie ma (serwer podglądu został zamknięty) — wklej JSON.'));
  } else if (!params.has('driver')) showForm(state);
}
