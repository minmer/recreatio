/**
 * 2026-10-27 — WAS DER IMPORT AUS EINEM DOKUMENT MACHT, als Seite, wie der
 * Dienst sie danach ausliefert — ohne etwas zu speichern.
 *
 * <b>Derselbe Weg wie der Import.</b> Der Plan entsteht in `planImport`, wie im
 * Panel „JSON strony"; die Dateien, um die das Dokument bittet
 * (`page-image:@schlüssel`), werden vorher eingesetzt, wie es `placeImages`
 * tut — nur mit Kennungen, die es beim Dienst nicht gibt (`previewFileId`): die
 * Vorschau zeigt dort einen Platzhalter oder die Datei, die der Assistent
 * mitgegeben hat. Aus dem Plan wird dann genau das, was `GET /page/<pfad>`
 * nach dem Import liefern würde (`contentOf`) — und die echte öffentliche Seite
 * zeichnet es (`PreviewApp.tsx`).
 *
 * <b>Was danach in der Vorschau fehlt, sagt sie</b>: Titel ohne Speichern,
 * Termine, die erst beim Import entstehen, Formulare, deren Fragen erst dann
 * angelegt werden (`notes`).
 *
 * Rein, ohne Browser — `scripts/app-preview-check.mjs` prüft es.
 */

import { asArray, asRecord, asText } from '../pages/event/kit';
import { BREAKPOINTS, COLUMNS, frameFor, snapColSpan, snapRowSpan, type Breakpoint } from '../pages/layout';
import { pageModeOf, toDraft, type DraftPart, type PageContent, type PagePart } from '../pages/page';
import { DEFAULT_IMPORT, documentKind, planImport, type ImportOptions, type PageNow, type PagePlan } from '../pages/pageJson';
import { readImageNeeds, resolveImageNeeds, type ImageNeed } from '../pages/pageImageNeeds';
import { partSize, text, type PartHeight, type PartWidth } from '../pages/part';
import { partOf } from '../pages/parts/registry';
import { readPiece, readShow, type Show } from '../pages/presentation/presentation';
import { reachable, routeOf } from '../pages/presentation/showPaths';
import { zonesOf } from '../pages/presentation/presentationMotion';
import { deckParts, slideLabelOf } from '../pages/slides/PageSlides';
import { COVER_KEY, readSlide } from '../pages/slides/slides';
import { deckOf, NO_LOOK, readLook, writeLook, type Look } from '../pages/slides/slideLook';

/** Wo eine Seite ohne eigene Adresse in der Vorschau steht. */
export const PREVIEW_PATH = 'podglad';

/** Die Kennung der Seite in der Vorschau — es gibt sie beim Dienst nicht (ein Przebieg merkt sich darunter Antworten im Browser). */
export const PREVIEW_PAGE_ID = '00000000-0000-4000-a000-0000000000ff';

/** Die Kennung der n-ten erbetenen Datei in der Vorschau (ab 0) — in der Gestalt einer Datei der Seite, damit kein Leser sie verwirft. */
export const previewFileId = (n: number): string => `00000000-0000-4000-a000-${(n + 1).toString(16).padStart(12, '0')}`;

export interface PreviewInput {
  /** Das Dokument (recreatio/page, ein Modul, ein Baustein oder der Altbestand) — als Objekt oder als Text. */
  readonly doc: unknown;
  /** Unter welcher Adresse es stünde — sonst "path" des Dokuments, sonst `podglad`. */
  readonly path?: string | null;
  /** Die Seite, wie sie heute ist (ein Import auf eine bestehende Seite) — sonst eine leere. */
  readonly base?: PageContent | null;
  readonly options?: Partial<ImportOptions> | null;
}

export interface PreviewPlan {
  readonly path: string;
  readonly kind: ReturnType<typeof documentKind>;
  readonly plan: PagePlan;
  readonly now: PageNow;
  /** Die Dateien, um die das Dokument bittet — in der Reihenfolge ihrer Kennungen (`previewFileId`). */
  readonly needs: readonly ImageNeed[];
  /** Schlüssel einer Bitte → die Kennung der Datei in der Vorschau. */
  readonly files: ReadonlyMap<string, string>;
  /** Was `GET /page/<pfad>` nach dem Import liefern würde. */
  readonly content: PageContent;
  /** Ein Menü von einer anderen Seite (`"menu": { "from": … }`) — das holt die Vorschau von dort. */
  readonly menuFrom: string | null;
  /** Was der Import sagen würde (wie im Panel) und was er warnen würde. */
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  /** Was die Vorschau anders zeigt als die Seite nach dem Import — und warum. */
  readonly notes: readonly string[];
}

/** Ein Dokument als Text oder schon gelesen. */
export function readDoc(doc: unknown): { value: unknown } | { error: string } {
  if (typeof doc !== 'string') return doc === undefined || doc === null ? { error: 'Brak dokumentu JSON.' } : { value: doc };
  if (doc.trim() === '') return { error: 'Brak dokumentu JSON.' };
  try {
    return { value: JSON.parse(doc) as unknown };
  } catch (e) {
    return { error: `Nieprawidłowy JSON: ${e instanceof Error ? e.message : 'nie da się odczytać'}` };
  }
}

/** Eine Adresse, wie sie das Register schreibt: Teile mit Schrägstrichen, ohne die am Rand. */
export function cleanPath(path: string): string {
  return path.trim().replace(/^#?\/*/, '').replace(/\/+$/, '').split('/').map((one) => one.trim()).filter((one) => one !== '').join('/');
}

/** Die Seite, wie sie gerade ist — so, wie der Editor sie dem Import gibt (ohne Menü, Namen und Fragen). */
export function nowOf(base: PageContent | null, path: string): PageNow {
  if (base === null) return { path, title: '', lead: '', mode: 'page', look: NO_LOOK, parts: [], logic: null, subject: null, menu: null };
  return {
    path,
    title: base.title ?? '',
    lead: base.lead ?? '',
    mode: pageModeOf(base.mode),
    look: readLook(base.theme ?? null),
    parts: base.parts.map(toDraft),
    logic: base.logic ?? null,
    subject: base.subject ?? null,
    menu: null
  };
}

/** Ein Baustein, wie ihn der Dienst nach dem Speichern liefert. */
const storedPart = (part: DraftPart, config: Record<string, string>): PagePart => ({
  id: part.id,
  kind: part.kind,
  layout: JSON.stringify(part.layout),
  config: JSON.stringify(config),
  /* Eine neue Stelle legt ihr Modul unter DERSELBEN Kennung an (0036). */
  moduleId: part.moduleId ?? part.id,
  ...(part.audienceAreaId == null ? {} : { audienceAreaId: part.audienceAreaId })
});

/** WAS `GET /page/<pfad>` NACH DEM IMPORT LIEFERN WÜRDE — in den Schritten von `runPageImport`. */
export function contentOf(plan: PagePlan, now: PageNow, base: PageContent | null, path: string): { content: PageContent; menuFrom: string | null } {
  /* Titel und Vorspann gehen nur mit einem Titel hinaus (`savePage`). */
  const title = (plan.title ?? now.title).trim();
  const saving = (plan.title !== undefined || plan.lead !== undefined) && title !== '';
  const lead = saving
    ? (plan.lead !== undefined ? plan.lead : now.lead.trim() === '' ? null : now.lead.trim())
    : base?.lead ?? null;

  const menu = plan.menu === undefined ? base?.menu ?? null
    : plan.menu === null ? null
    : 'items' in plan.menu ? { from: path, items: plan.menu.items }
    : { from: plan.menu.from, items: [] };

  const look: Look = plan.look ?? now.look;
  return {
    content: {
      path,
      title: saving ? title : base?.title ?? null,
      lead,
      updatedAt: null,
      parts: plan.parts.map((part) => storedPart(part, plan.configs.get(part.id) ?? part.config)),
      logic: plan.logic !== undefined ? plan.logic : now.logic,
      access: { restricted: false },
      editable: false,
      menu,
      mode: plan.mode ?? now.mode,
      theme: writeLook(look),
      subject: plan.subject !== undefined ? plan.subject : now.subject ?? null,
      id: base?.id ?? PREVIEW_PAGE_ID
    },
    menuFrom: plan.menu != null && 'from' in plan.menu ? plan.menu.from : null
  };
}

/** DER PLAN DER VORSCHAU — der Plan des Imports und die Seite danach. */
export function planPreview(input: PreviewInput): PreviewPlan | { error: string } {
  const read = readDoc(input.doc);
  if ('error' in read) return read;
  const doc = read.value;
  const kind = documentKind(doc);
  const base = input.base ?? null;
  const path = cleanPath(input.path ?? '') || cleanPath(asText(asRecord(doc).path)) || base?.path || PREVIEW_PATH;
  const now = nowOf(base, path);

  /* Die erbetenen Dateien zuerst — wie der Import, nur mit Kennungen der Vorschau. */
  const asked = readImageNeeds(doc);
  const needs = asked?.needs ?? [];
  const files = new Map(needs.map((need, i) => [need.key, previewFileId(i)] as const));
  const placed = asked === undefined ? doc : resolveImageNeeds(doc, new Map([...files].map(([key, id]) => [key, `page-image:${id}`] as const))).doc;

  const options: ImportOptions = { ...DEFAULT_IMPORT, ...(input.options ?? {}) };
  const plan = planImport(placed, now, options);
  if ('error' in plan) return plan;

  const { content, menuFrom } = contentOf(plan, now, base, path);
  const notes: string[] = [];
  const title = (plan.title ?? now.title).trim();
  if ((plan.title !== undefined || plan.lead !== undefined || kind === 'page') && title === '' && base?.title == null) {
    notes.push('Strona nie ma tytułu — import nie zapisze tytułu ani tekstu strony ("title" jest potrzebny, żeby zapisać "lead").');
  }
  if (needs.length > 0) {
    notes.push(`Pliki z "images" (${needs.length}): w podglądzie stoją pliki podane przez asystenta albo zastępcze obrazy z opisem — prawdziwe dołączy osoba importująca.`);
  }
  if (plan.appointments !== undefined) {
    notes.push(`Terminy z "appointments" (${plan.appointments.items.length}) powstaną dopiero przy imporcie, w kalendarzu wybranym przez osobę importującą — moduły, które na nie wskazują ("@klucz"), pokażą je dopiero po imporcie.`);
  }
  for (const [id, wish] of plan.forms) {
    const part = plan.parts.find((p) => p.id === id);
    if (part === undefined || (wish.questions === undefined && wish.design === undefined)) continue;
    const at = plan.from?.get(id);
    const count = Array.isArray(wish.questions) ? wish.questions.length : 0;
    notes.push(`Formularz${at === undefined ? '' : ` (modules[${at}])`}: pytania z dokumentu (${count}) powstaną przy imporcie — podgląd rysuje je z dokumentu (układ i logika działają; bez klauzuli administratora danych, która przyjdzie z obszaru odpowiedzi; wysyłanie wyłączone).`);
  }
  if (menuFrom !== null) notes.push(`Menu jak na stronie „${menuFrom}” — podgląd bierze je z tej strony, jeśli jest publiczna.`);

  const warnings = [...plan.warnings, ...(asked?.warnings ?? [])];
  return { path, kind, plan, now, needs, files, content, menuFrom, lines: plan.lines, warnings, notes };
}

/* -- Was auf der Seite steht, Baustein für Baustein ------------------------------------ */

export interface SizeAt {
  readonly colSpan: number;
  readonly rowSpan: number;
  readonly col: number;
  readonly row: number;
  readonly width: PartWidth;
  readonly height: PartHeight;
  /** Was er in dieser Grösse zeigt — der Satz, den der Editor an die Kachel schreibt. */
  readonly shows: string;
  /** In dieser Grösse nur Überschrift und Knopf (ein Formular im Streifen). */
  readonly folded: boolean;
}

export interface ModuleSummary {
  /** M1, M2 … — in der Folge der Seite. */
  readonly n: number;
  readonly id: string;
  /** Sein Eintrag in "modules" des Dokuments — `null`: er stand schon auf der Seite. */
  readonly docIndex: number | null;
  readonly kind: string;
  readonly label: string;
  /** Sein Titel (oder die erste Zeile, der Alt-Text) — woran man ihn erkennt. */
  readonly title: string;
  readonly known: boolean;
  /** Hat er etwas zu zeigen — in der Art dieser Seite? Sonst verschwindet er für Besucher. */
  readonly visible: boolean;
  /** Was er als Slajd zeigt (in seiner grössten Gestalt, 6 × 5). */
  readonly slideShows: string;
  /** Was ihm noch fehlt, in Worten — `null`: nichts. */
  readonly missing: string | null;
  readonly fullscreen: boolean;
  readonly sizes: Readonly<Record<Breakpoint, SizeAt>>;
  readonly slide: {
    readonly label: string; readonly transition: string; readonly enter: string; readonly layers: number;
    readonly motion: number; readonly stage: boolean; readonly beside: string | null; readonly layout: string | null;
  };
  /** Seine Plätze in der Präsentation (Szenen) — `null`: er steht in keiner. */
  readonly show: {
    readonly scenes: readonly string[];
    /** Je Szene: Mitte (`x`, `y`) und Breite (`w`) in Prozent der Bühne. */
    readonly places: Readonly<Record<string, { readonly x: number; readonly y: number; readonly w: number }>>;
    readonly skin: string; readonly type: string; readonly travels: boolean; readonly go: readonly string[];
    /** Was er auf der Bühne zeigt (die Grösse folgt seinem breitesten Platz). */
    readonly shows: string;
  } | null;
}

const titleOf = (part: DraftPart): string => {
  const said = text(part.config, 'title') || text(part.config, 'alt') || text(part.config, 'label');
  if (said !== '') return said.slice(0, 80);
  const line = (part.config.body ?? '').split('\n').map((one) => one.trim()).find((one) => one !== '') ?? '';
  return line.replace(/^[#>]+\s*/, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').slice(0, 80);
};

/** Ein Baustein in jeder Grösse des Rasters, so wie `PageParts` ihn legt. */
function sizesOf(part: DraftPart): Record<Breakpoint, SizeAt> {
  const def = partOf(part.kind);
  const out = {} as Record<Breakpoint, SizeAt>;
  for (const bp of BREAKPOINTS) {
    const frame = frameFor(part, bp);
    const size = partSize({ colSpan: snapColSpan(frame.size.colSpan, COLUMNS[bp]), rowSpan: snapRowSpan(frame.size.rowSpan) });
    out[bp] = {
      colSpan: size.colSpan, rowSpan: size.rowSpan, col: frame.position.col, row: frame.position.row,
      width: size.width, height: size.height,
      shows: def === undefined ? '' : def.shows(part.config, size),
      folded: def !== undefined && def.strip !== null && size.height === 'strip'
    };
  }
  return out;
}

/**
 * Zeigt er Besuchern etwas — nach der Regel der Art der Seite: im Raster und auf
 * Slajdy, wenn die Art etwas zu zeigen hat; auf der Bühne auch ein Tekst mit
 * nichts als einem Titel (`PagePresentation`).
 */
const visibleIn = (part: DraftPart, mode: string): boolean => {
  const def = partOf(part.kind);
  if (def === undefined || def.hasContent(part.config)) return true;
  return mode === 'presentation' && part.kind === 'text' && text(part.config, 'title') !== '';
};

export function modulesOf(pp: PreviewPlan): ModuleSummary[] {
  const mode = pp.content.mode ?? 'page';
  return pp.plan.parts.map((part, i) => {
    const def = partOf(part.kind);
    const slide = readSlide(part.layout);
    const piece = readPiece(part.layout);
    const scenes = Object.keys(piece.places);
    const widest = scenes.length === 0 ? 0 : Math.max(...Object.values(piece.places).map((p) => p.w));
    const onStage = partSize({ colSpan: widest >= 60 ? 6 : widest >= 45 ? 4 : widest >= 30 ? 3 : 2, rowSpan: 5 });
    return {
      n: i + 1,
      id: part.id,
      docIndex: pp.plan.from?.get(part.id) ?? null,
      kind: part.kind,
      label: def?.label ?? part.kind,
      title: titleOf(part),
      known: def !== undefined,
      visible: visibleIn(part, mode),
      slideShows: def === undefined ? '' : def.shows(part.config, partSize({ colSpan: 6, rowSpan: 5 })),
      missing: def?.missing(part.config) ?? null,
      fullscreen: def !== undefined && def.fullFor(part.config),
      sizes: sizesOf(part),
      slide: {
        label: slideLabelOf(part),
        transition: slide.transition,
        enter: slide.enter,
        layers: slide.layers.length,
        motion: slide.motion.length,
        stage: slide.stage !== null,
        beside: slide.with?.slide ?? null,
        layout: slide.layout === null ? null : JSON.stringify(slide.layout)
      },
      show: scenes.length === 0 ? null : {
        scenes,
        places: Object.fromEntries(Object.entries(piece.places).map(([key, p]) => [key, { x: p.x, y: p.y, w: p.w }])),
        skin: piece.skin,
        type: piece.type,
        travels: scenes.length > 1 || piece.hold,
        go: Object.entries(piece.go).map(([scene, target]) => `${scene} → ${target}`),
        shows: def === undefined ? '' : part.kind === 'text' && piece.type !== 'auto' ? `tekst jako „${piece.type}”` : def.shows(part.config, onStage)
      }
    };
  });
}

/* -- Slajdy und Präsentation: was die Vorschau abfährt --------------------------------- */

export interface DeckPlan {
  /** Die Slajdy in ihrer Folge: der Titelslajd (`cover`) und je eigener Baustein einer; Begleiter stehen bei ihrem. */
  readonly slides: readonly { readonly key: string; readonly label: string; readonly modules: readonly string[] }[];
  /** Bausteine auf der Bühne (über allen Slajdy). */
  readonly stage: readonly string[];
}

/** Die Folge, wie `PageSlides` sie legt — nur die Bausteine, die Besuchern etwas zeigen. */
export function deckPlanOf(pp: PreviewPlan): DeckPlan {
  const parts = pp.plan.parts.filter((part) => visibleIn(part, 'slides'));
  const look = pp.plan.look ?? pp.now.look;
  const deck = deckOf(look);
  const title = pp.content.title ?? '';
  const lead = pp.content.lead ?? '';
  const { own, stage, beside } = deckParts(parts);
  const slides: { key: string; label: string; modules: string[] }[] = [];
  if (deck.titleSlide && (title.trim() !== '' || lead.trim() !== '')) slides.push({ key: COVER_KEY, label: title.trim() || 'Start', modules: [] });
  for (const part of own) {
    slides.push({ key: part.id, label: slideLabelOf(part), modules: [part.id, ...(beside.get(part.id) ?? []).map((one) => one.part.id)] });
  }
  return { slides, stage: stage.map((part) => part.id) };
}

export interface ShowPlan {
  readonly show: Show;
  /** Der Weg, den ein Besucher ohne Knöpfe geht (die Kennungen der Szenen). */
  readonly route: readonly string[];
  /** Szenen, die nur über Knöpfe erreichbar sind, und solche, die gar nicht. */
  readonly offRoute: readonly string[];
  readonly unreachable: readonly string[];
  /** Je Szene des Weges ihre Strecke auf der Achse `s` (Schritte) — wie `PresentationView` sie fährt. */
  readonly zones: readonly { readonly key: string; readonly at: number; readonly to: number }[];
  /** Je Szene: welche Bausteine dort einen Platz haben. */
  readonly pieces: Readonly<Record<string, readonly string[]>>;
}

export function showPlanOf(pp: PreviewPlan): ShowPlan {
  const show = readShow((pp.plan.look ?? pp.now.look).show);
  const route = routeOf(show);
  const pieces = pp.plan.parts.map((part) => readPiece(part.layout));
  const reach = reachable(show, pieces);
  const byKey = new Map(show.scenes.map((scene) => [scene.key, scene] as const));
  const zones = zonesOf(route.map((key) => byKey.get(key)?.steps ?? 1));
  const on: Record<string, string[]> = {};
  pp.plan.parts.forEach((part, i) => {
    for (const key of Object.keys(pieces[i].places)) (on[key] ??= []).push(part.id);
  });
  return {
    show,
    route,
    offRoute: show.scenes.filter((scene) => !route.includes(scene.key) && reach.has(scene.key)).map((scene) => scene.key),
    unreachable: show.scenes.filter((scene) => !reach.has(scene.key)).map((scene) => scene.key),
    zones: route.map((key, i) => ({ key, at: zones[i]?.at ?? 0, to: zones[i]?.to ?? 0 })),
    pieces: on
  };
}

/* -- Ein Modul allein: in jeder Grösse ------------------------------------------------- */

/** Welche Grössen ein Baustein bei dieser Spaltenzahl haben kann — Breiten 2/3/4/6, Höhen 1/3/5. */
export function sizesFor(columns: number): { colSpan: number; rowSpan: number }[] {
  const out: { colSpan: number; rowSpan: number }[] = [];
  for (const colSpan of [2, 3, 4, 6].filter((n) => n <= columns)) {
    for (const rowSpan of [1, 3, 5]) out.push({ colSpan, rowSpan });
  }
  return out;
}

/** Der Baustein, den die Vorschau allein zeigt: nach M-Nummer (1…), Stelle im Dokument (`modules[i]`), Kennung oder Art. */
export function pickModule(pp: PreviewPlan, which: string | number | null | undefined): DraftPart | null {
  const parts = pp.plan.parts;
  if (parts.length === 0) return null;
  if (which === null || which === undefined || which === '') return parts[0];
  if (typeof which === 'number') return parts[which - 1] ?? null;
  const said = which.trim();
  const m = /^m(\d+)$/i.exec(said);
  if (m !== null) return parts[Number(m[1]) - 1] ?? null;
  const at = /^modules\[(\d+)\]$/.exec(said);
  if (at !== null) return parts.find((part) => pp.plan.from?.get(part.id) === Number(at[1])) ?? null;
  if (/^\d+$/.test(said)) return parts[Number(said) - 1] ?? null;
  return parts.find((part) => part.id === said || part.moduleId === said) ?? parts.find((part) => part.kind === said) ?? null;
}

/** Die Einträge von "modules", die das Dokument nennt — für die Prüfung der Schlüssel. */
export const entriesOf = (doc: unknown): readonly Record<string, unknown>[] => {
  const kind = documentKind(doc);
  const root = asRecord(doc);
  if (kind === 'page') return asArray(root.modules ?? root.parts).map(asRecord);
  if (kind === 'module' || kind === 'part') return [root];
  return [];
};
