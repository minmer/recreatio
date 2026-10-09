/**
 * 0064 — EINE SEITE, EIN BAUSTEIN, EIN MODUL ALS JSON: Export, Import und die
 * Beschreibung daneben.
 *
 * <b>Export und Import sind dasselbe Dokument.</b> Wer eine Seite exportiert,
 * sie im Texteditor (oder von einem Sprachmodell) ändern lässt und wieder
 * importiert, ändert sie AN ORT UND STELLE: jeder Baustein trägt seine Kennung
 * (`id`, die Stelle auf der Seite) und die seines Moduls (`module`). Eine
 * bekannte Kennung heisst „diesen ändern" — die Einsendungen eines Formulars,
 * die Links der Menschen, die Karte der Seite hängen daran und bleiben. Nur was
 * keine (oder eine fremde) Kennung trägt, entsteht neu.
 *
 * <b>Was fehlt, bleibt.</b> Ein Dokument mit nur `modules` lässt Titel, Menü
 * und Aussehen, wie sie sind; ein Baustein ohne `layout` behält seinen Platz,
 * einer ohne `config` seinen Inhalt.
 *
 * <b>Die Beschreibung entsteht aus den Bausteinen selbst</b> (`PartModule.json`)
 * und läuft deshalb nicht von ihnen weg: eine neue Art, ein neuer Schlüssel
 * steht darin, sobald er im Baustein steht. `scripts/app-json-check.mjs`
 * prüft, dass jeder Schlüssel eines Beispiels beschrieben ist.
 *
 * Der Altbestand (`SlidesImport.tsx`: `{ title, pages: [{ parts }] }`) wird
 * erkannt und wie bisher übernommen.
 */

import { asArray, asRecord, asText, count } from './event/kit';
import { QUESTION_EXAMPLE, QUESTION_KEYS, type FormContent } from './formJson';
import { newId } from './ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, snapColSpan, snapRowSpan, type Breakpoint, type Frame, type Layout } from './layout';
import type { MenuState } from './menu';
import { PAGE_MODES, type DraftPart, type MenuItem, type PageMode } from './page';
import { GATE_KINDS, INPUT_KINDS, PAGE_NODE_LABEL, readLogic, type PageLogic } from './pageLogic';
import { readSubject, subjectDescription, subjectKindOf, writeSubject } from './pageSubject';
import type { PartModule, RawConfig } from './part';
import { PARTS, partOf } from './parts/registry';
import {
  ARRIVALS, EASES, FONT_PAIRS, FORMATS, NAVS, ORIGINS, pieceJson, readPiece, readPieceValue, readShow, SCENE_CHANGES, showJson, SKINS,
  TEXT_TYPES, THREADS, withPiece, type Piece
} from './presentation';
import { brokenTarget } from './showPaths';
import {
  DEFAULT_THEMES, ENTERS, readLayers, readPalette, readSlide, readSlideValue, remapStage, slideJson, TRANSITIONS, withSlide, type Look, type Theme
} from './slides';
import { importLegacy, legacyPages } from './SlidesImport';

export const PAGE_FORMAT = 'recreatio/page';
export const MODULE_FORMAT = 'recreatio/module';
export const PART_FORMAT = 'recreatio/part';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID.test(value);

/* -- Was eine Seite gerade ist ------------------------------------------------------ */

export interface PageNow {
  readonly path: string;
  readonly title: string;
  readonly lead: string;
  readonly mode: PageMode;
  readonly look: Look;
  readonly parts: readonly DraftPart[];
  readonly logic: string | null;
  /** 0082 — „Wybór na stronie" (JSON) — fehlt: keiner. */
  readonly subject?: string | null;
  /** `null`: nicht geladen — dann steht das Menü nicht im Export. */
  readonly menu: MenuState | null;
  /** Modul → Name, soweit bekannt. */
  readonly names?: ReadonlyMap<string, string>;
  /** Modul eines Formulars → seine Fragen und sein Aufbau, soweit lesbar. */
  readonly forms?: ReadonlyMap<string, FormContent>;
}

/* -- Export -------------------------------------------------------------------------- */

/** Ein Baustein der Seite als Eintrag von `modules`. */
export function exportEntry(part: DraftPart, extra: { name?: string; form?: FormContent } = {}): Record<string, unknown> {
  const def = partOf(part.kind);
  const layout: Partial<Record<Breakpoint, Frame>> = {};
  for (const bp of BREAKPOINTS) {
    const frame = part.layout[bp];
    if (frame !== undefined) layout[bp] = frame;
  }
  /* Knapp: was der Vorgabe entspricht, fehlt (0084) — ein Slajd von früher sieht aus wie früher. */
  const slide = slideJson(readSlide(part.layout));
  const plain = part.layout.slide === undefined && Object.keys(slide).length === 2 && slide.label === '' && (slide.layers as unknown[]).length === 0;

  return {
    id: part.id,
    module: part.moduleId ?? part.id,
    ...(extra.name === undefined ? {} : { name: extra.name }),
    kind: part.kind,
    ...(plain ? {} : { slide }),
    /* 0085 — wo er in der Präsentation steht (nur, wenn er dort steht). */
    ...(part.layout.show === undefined ? {} : { show: pieceJson(readPiece(part.layout)) }),
    layout,
    config: def === undefined ? { ...part.config } : def.json.toJson(part.config),
    ...(extra.form === undefined ? {} : { questions: extra.form.questions, design: extra.form.design })
  };
}

export function exportPage(now: PageNow): Record<string, unknown> {
  const menu = now.menu === null ? undefined
    : now.menu.uses !== null ? { from: now.menu.uses.from }
    : now.menu.items ?? null;

  return {
    format: PAGE_FORMAT,
    version: 1,
    path: now.path,
    title: now.title,
    lead: now.lead.trim() === '' ? null : now.lead,
    mode: now.mode,
    theme: now.look.theme,
    cover: now.look.cover,
    /* 0085 — die Szenen einer Präsentation (auch, wenn die Seite gerade anders erscheint: sie gehen nicht verloren). */
    ...(now.look.show === undefined ? {} : { show: showJson(readShow(now.look.show)) }),
    ...(menu === undefined ? {} : { menu }),
    logic: readLogic(now.logic),
    subject: readSubject(now.subject ?? null),
    modules: now.parts.map((part) => {
      const moduleId = part.moduleId ?? part.id;
      return exportEntry(part, {
        name: now.names?.get(moduleId),
        form: part.kind === 'form' ? now.forms?.get(moduleId) : undefined
      });
    })
  };
}

/** Ein Modul aus dem Bausteinverwalter. */
export function exportModule(module: {
  readonly moduleId: string; readonly kind: string; readonly name: string; readonly config: RawConfig;
  /** 0047/0077 — ein Formular, das ein anderes erweitert: wessen, wer es ausfüllt, wie oft. */
  readonly extendsId?: string | null; readonly audience?: string; readonly repeat?: string;
}, form?: FormContent): Record<string, unknown> {
  const def = partOf(module.kind);
  return {
    format: MODULE_FORMAT,
    version: 1,
    id: module.moduleId,
    kind: module.kind,
    name: module.name,
    ...(module.extendsId == null ? {} : { extends: module.extendsId, audience: module.audience ?? 'person', repeat: module.repeat ?? 'once' }),
    config: def === undefined ? { ...module.config } : def.json.toJson(module.config),
    ...(form === undefined ? {} : { questions: form.questions, design: form.design })
  };
}

/* -- Duldsames Lesen ------------------------------------------------------------------ */

const has = (record: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key);

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN);

/** Ein Dokument als Text — oder der Fehler, in Worten. */
export function parseDocument(text: string): { value: unknown } | { error: string } | null {
  if (text.trim() === '') return null;
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Nieprawidłowy JSON.' };
  }
}

/** Die Tafel eines Bausteins aus dem JSON — über seine Art, oder flach, wenn die Art unbekannt ist. */
export function configFromJson(kind: string, value: unknown): RawConfig {
  const def = partOf(kind);
  if (def !== undefined) return def.json.fromJson(value);
  const out: RawConfig = {};
  for (const [key, one] of Object.entries(asRecord(value))) {
    if (typeof one === 'string') out[key] = one;
    else if (one !== null && one !== undefined) out[key] = typeof one === 'object' ? JSON.stringify(one) : String(one);
  }
  return out;
}

/** Ein Patch, der eine Tafel durch eine andere ERSETZT: was wegfällt, wird geleert. */
export function replacing(before: RawConfig, after: RawConfig): RawConfig {
  const patch: RawConfig = {};
  for (const key of Object.keys(before)) if (!has(after, key) && before[key].trim() !== '') patch[key] = '';
  for (const [key, value] of Object.entries(after)) if (before[key] !== value) patch[key] = value;
  return patch;
}

export const sameConfig = (a: RawConfig, b: RawConfig): boolean => Object.keys(replacing(a, b)).length === 0
  && Object.keys(replacing(b, a)).length === 0;

function readFrame(value: unknown, bp: Breakpoint): Frame | null {
  const one = asRecord(value);
  const position = asRecord(one.position);
  const size = asRecord(one.size);
  const colSpanWanted = num(size.colSpan);
  const rowSpanWanted = num(size.rowSpan);
  if (!Number.isFinite(colSpanWanted) || !Number.isFinite(rowSpanWanted)) return null;
  const colSpan = snapColSpan(colSpanWanted, COLUMNS[bp]);
  const rowSpan = snapRowSpan(rowSpanWanted);
  const row = Math.max(1, Math.trunc(Number.isFinite(num(position.row)) ? num(position.row) : 1));
  const col = Math.min(Math.max(1, Math.trunc(Number.isFinite(num(position.col)) ? num(position.col) : 1)), COLUMNS[bp] - colSpan + 1);
  return { position: { row, col }, size: { colSpan, rowSpan } };
}

function readTheme(value: unknown): Theme | null | undefined {
  if (value === null) return null;
  const theme = asRecord(value);
  const mode = asText(theme.mode);
  if (mode === 'auto') return null;
  if (mode !== 'dark' && mode !== 'light') return undefined;
  const color = (key: 'accent' | 'ink' | 'ground' | 'muted') =>
    (/^#[0-9a-f]{6}$/i.test(asText(theme[key])) ? asText(theme[key]) : DEFAULT_THEMES[mode][key]);
  /* 0085 — Nachtfarben: nur, wenn alle vier echte Farben sind. */
  const night = readPalette(theme.night);
  const nightOk = night !== null && Object.values(night).every((c) => /^#[0-9a-f]{6}$/i.test(c));
  return { mode, accent: color('accent'), ink: color('ink'), ground: color('ground'), muted: color('muted'), ...(nightOk ? { night } : {}) };
}

/** 0085 — was an einem Platz in der Präsentation nicht stimmt, in Worten. */
function pieceWarnings(said: Record<string, unknown>, where: string): string[] {
  const out: string[] = [];
  const check = (key: string, list: readonly string[], fallback: string) => {
    if (has(said, key) && !list.includes(asText(said[key]))) out.push(`${where}: "show.${key}" „${asText(said[key])}” — dozwolone: ${list.join(', ')}; będzie "${fallback}".`);
  };
  check('skin', SKINS, 'card');
  check('type', TEXT_TYPES, 'auto');
  check('arrive', ARRIVALS, 'fade');
  check('ease', EASES, 'inOut');
  check('origin', ORIGINS, 'center');
  if (has(said, 'places') && (typeof said.places !== 'object' || said.places === null || Array.isArray(said.places))) {
    out.push(`${where}: "show.places" to nie obiekt { "klucz sceny": miejsce } — moduł nie stanie w prezentacji.`);
  }
  return out;
}

/** 0085 — was an den Szenen nicht stimmt. */
function showWarnings(value: unknown): string[] {
  const out: string[] = [];
  const root = asRecord(value);
  if (has(root, 'format') && !(FORMATS as readonly string[]).includes(asText(root.format))) out.push(`"show.format" „${asText(root.format)}” — dozwolone: ${FORMATS.join(', ')}; będzie "screen".`);
  if (has(root, 'fonts') && !(FONT_PAIRS as readonly string[]).includes(asText(root.fonts))) out.push(`"show.fonts" „${asText(root.fonts)}” — dozwolone: ${FONT_PAIRS.join(', ')}; będzie "app".`);
  if (has(root, 'nav') && !(NAVS as readonly string[]).includes(asText(root.nav))) out.push(`"show.nav" „${asText(root.nav)}” — dozwolone: ${NAVS.join(', ')}; będzie "labels".`);
  asArray(root.scenes).forEach((raw, i) => {
    const scene = asRecord(raw);
    if (has(scene, 'change') && !(SCENE_CHANGES as readonly string[]).includes(asText(scene.change))) {
      out.push(`Scena ${i + 1}: "change" „${asText(scene.change)}” — dozwolone: ${SCENE_CHANGES.join(', ')}; będzie "fade".`);
    }
    if (has(scene, 'thread') && !(THREADS as readonly string[]).includes(asText(scene.thread))) {
      out.push(`Scena ${i + 1}: "thread" „${asText(scene.thread)}” — dozwolone: ${THREADS.join(', ')}; będzie "none".`);
    }
  });
  return out;
}

const MENU_KINDS: readonly MenuItem['kind'][] = ['abs', 'rel', 'url', 'none'];

function readMenuItems(value: unknown, depth = 0): MenuItem[] {
  return asArray(value).map(asRecord).filter((one) => asText(one.label).trim() !== '').map((one) => {
    const target = asText(one.target).trim();
    const said = asText(one.kind) as MenuItem['kind'];
    const kind = MENU_KINDS.includes(said) ? said : target === '' ? 'none' : /^https?:/i.test(target) ? 'url' : 'abs';
    return { label: asText(one.label).trim(), kind, target, children: depth < 4 ? readMenuItems(one.children, depth + 1) : [] };
  });
}

/* -- Import ------------------------------------------------------------------------- */

export interface ImportOptions {
  /** Die Bausteine der Seite werden GENAU die des Dokuments — sonst kommen sie dazu. */
  readonly replace: boolean;
  /** Bausteine anderer Seiten als neue Module (Kopien) statt als dieselben. */
  readonly copyModules: boolean;
  /** Altbestand: welche seiner Seiten. */
  readonly legacyPage: number;
  /** Altbestand: auch seine Farben. */
  readonly takeTheme: boolean;
}

export const DEFAULT_IMPORT: ImportOptions = { replace: false, copyModules: false, legacyPage: 0, takeTheme: true };

export interface PagePlan {
  readonly legacy: boolean;
  readonly title?: string;
  readonly lead?: string | null;
  readonly mode?: PageMode;
  readonly look?: Look;
  readonly menu?: { readonly items: readonly MenuItem[] } | { readonly from: string } | null;
  readonly logic?: string | null;
  /** 0082 — „Wybór na stronie" (JSON); `null` nimmt ihn weg. */
  readonly subject?: string | null;
  readonly parts: readonly DraftPart[];
  /** Was ein Modul nach dem Speichern tragen soll (Stelle → Tafel) — geteilte Module folgen dem Entwurf nicht von selbst. */
  readonly configs: ReadonlyMap<string, RawConfig>;
  /** Stelle → gewünschter Name des Moduls. */
  readonly names: ReadonlyMap<string, string>;
  /** Stelle → Fragen und Aufbau eines Formulars. */
  readonly forms: ReadonlyMap<string, { readonly questions?: unknown; readonly design?: unknown }>;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/** Was für ein Dokument das ist. */
export function documentKind(doc: unknown): 'page' | 'module' | 'part' | 'legacy' | 'unknown' {
  if (Array.isArray(doc)) return 'legacy';
  const root = asRecord(doc);
  const format = asText(root.format);
  if (format === PAGE_FORMAT) return 'page';
  if (format === MODULE_FORMAT) return 'module';
  if (format === PART_FORMAT) return 'part';
  if (Array.isArray(root.modules)) return 'page';
  if (Array.isArray(root.pages) || Array.isArray(root.parts)) return 'legacy';
  if (typeof root.kind === 'string' && has(root, 'config')) return 'part';
  if (has(root, 'title') || has(root, 'menu') || has(root, 'theme') || has(root, 'mode')) return 'page';
  return 'unknown';
}

/** Die Seiten eines Dokuments des Altbestands — für die Auswahl. */
export const legacyPagesOf = (doc: unknown) => legacyPages(doc);

function planLegacy(doc: unknown, now: PageNow, options: ImportOptions): PagePlan {
  const pages = legacyPages(doc);
  const index = Math.min(Math.max(0, options.legacyPage), Math.max(0, pages.length - 1));
  const done = importLegacy(doc, index, options.replace ? [] : now.parts);
  const theme = options.takeTheme ? done.theme : null;
  const lines = [
    `Dokument starego systemu — strona „${pages[index]?.label ?? '?'}”: ${count(done.parts.length, 'moduł', 'moduły', 'modułów')} — ${options.replace ? 'zamiast obecnych' : 'na końcu strony'}.`,
    ...(theme !== null ? [`Kolory wydarzenia (${theme.mode === 'dark' ? 'ciemne' : 'jasne'}).`] : []),
    ...(now.title === '' && done.title !== null ? [`Tytuł strony: „${done.title}”.`] : [])
  ];
  return {
    legacy: true,
    ...(now.title === '' && done.title !== null ? { title: done.title } : {}),
    ...(now.title === '' && done.lead !== null ? { lead: done.lead } : {}),
    ...(theme !== null ? { look: { ...now.look, theme } } : {}),
    parts: options.replace ? done.parts : [...now.parts, ...done.parts],
    configs: new Map(),
    names: new Map(),
    forms: new Map(),
    lines,
    warnings: done.warnings
  };
}

/**
 * DER PLAN EINES IMPORTS — was sich ändern wird, noch ohne etwas zu ändern.
 * Der Editor zeigt ihn an; erst „Importuj" führt ihn aus (`PageJson.tsx`).
 */
export function planImport(doc: unknown, now: PageNow, options: ImportOptions): PagePlan | { error: string } {
  const kind = documentKind(doc);
  if (kind === 'legacy') return planLegacy(doc, now, options);
  if (kind === 'unknown') return { error: 'To nie wygląda na dokument strony ani modułu — brakuje "modules" (albo "kind" i "config").' };

  const root = asRecord(doc);
  const warnings: string[] = [];
  const lines: string[] = [];

  /* Ein einzelnes Modul oder ein Baustein ist eine Seite mit einem Eintrag. */
  const entries = kind === 'page'
    ? asArray(root.modules ?? root.parts)
    : [kind === 'module' ? { ...root, id: undefined, module: root.id } : root];
  const replace = kind === 'page' && options.replace;

  if (kind === 'page' && has(root, 'path') && asText(root.path) !== '' && asText(root.path) !== now.path) {
    lines.push(`Dokument pochodzi ze strony „${asText(root.path)}” — moduły bez pasującego "id" powstaną tu jako nowe miejsca.`);
  }

  const used = new Set<string>();
  const ids = new Map<string, string>();
  const configs = new Map<string, RawConfig>();
  const names = new Map<string, string>();
  const forms = new Map<string, { questions?: unknown; design?: unknown }>();
  const made: { part: DraftPart; place: boolean; size: { colSpan: number; rowSpan: number } }[] = [];
  let updated = 0;
  let added = 0;

  entries.forEach((raw, index) => {
    const entry = asRecord(raw);
    const docId = asText(entry.id).trim();
    const docModule = asText(entry.module).trim();
    const match = now.parts.find((p) => p.id === docId && !used.has(p.id))
      ?? (docModule === '' ? undefined : now.parts.find((p) => !used.has(p.id) && (p.moduleId ?? p.id) === docModule));
    const kindSaid = asText(entry.kind).trim() || match?.kind || '';
    const def = partOf(kindSaid);

    if (def === undefined && match?.kind !== kindSaid) {
      warnings.push(`Moduł ${index + 1}: ${kindSaid === '' ? 'brak "kind"' : `nieznany rodzaj „${kindSaid}”`} — pominięty.`);
      return;
    }

    if (match !== undefined) used.add(match.id);
    const id = match?.id ?? newId();
    if (docId !== '') ids.set(docId, id);

    const moduleId = match !== undefined
      ? (isUuid(docModule) ? docModule : match.moduleId)
      : options.copyModules ? null : isUuid(docModule) ? docModule : null;
    if (docModule !== '' && !isUuid(docModule)) warnings.push(`Moduł ${index + 1}: "module" „${docModule}” nie jest identyfikatorem — powstanie nowy moduł.`);

    const config = has(entry, 'config') ? configFromJson(kindSaid, entry.config) : match?.config ?? {};
    if (has(entry, 'config')) configs.set(id, config);
    if (asText(entry.name).trim() !== '') names.set(id, asText(entry.name).trim());
    if (kindSaid === 'form' && (has(entry, 'questions') || has(entry, 'design'))) {
      forms.set(id, { ...(has(entry, 'questions') ? { questions: entry.questions } : {}), ...(has(entry, 'design') ? { design: entry.design } : {}) });
    }

    /* Der Platz: aus dem Dokument, sonst der bisherige, sonst der erste freie. */
    const frames: Partial<Record<Breakpoint, Frame>> = {};
    for (const bp of BREAKPOINTS) {
      const frame = readFrame(asRecord(entry.layout)[bp], bp);
      if (frame !== null) frames[bp] = frame;
    }
    const complete = BREAKPOINTS.every((bp) => frames[bp] !== undefined);
    const sizeSaid = asRecord(entry.size);
    const size = Number.isFinite(num(sizeSaid.colSpan)) && Number.isFinite(num(sizeSaid.rowSpan))
      ? { colSpan: num(sizeSaid.colSpan), rowSpan: num(sizeSaid.rowSpan) }
      : frames.desktop?.size ?? match?.layout.desktop?.size ?? def?.box ?? { colSpan: 6, rowSpan: 3 };

    const slide = has(entry, 'slide')
      ? slideJson(readSlideValue(entry.slide))
      : match === undefined ? undefined : match.layout.slide === undefined ? undefined : slideJson(readSlide(match.layout));
    const said = asRecord(entry.slide);
    if (has(said, 'transition') && !(TRANSITIONS as readonly string[]).includes(asText(said.transition))) {
      warnings.push(`Moduł ${index + 1}: "slide.transition" „${asText(said.transition)}” — dozwolone: ${TRANSITIONS.join(', ')}; będzie "scroll".`);
    }
    if (has(said, 'enter') && !(ENTERS as readonly string[]).includes(asText(said.enter))) {
      warnings.push(`Moduł ${index + 1}: "slide.enter" „${asText(said.enter)}” — dozwolone: ${ENTERS.join(', ')}; będzie "none".`);
    }

    /* 0085 — sein Platz in der Präsentation: aus dem Dokument, sonst der bisherige. "show": null nimmt ihn heraus. */
    const shown: Piece | undefined = has(entry, 'show')
      ? (entry.show === null ? undefined : readPieceValue(entry.show))
      : match === undefined || match.layout.show === undefined ? undefined : readPiece(match.layout);
    if (has(entry, 'show') && entry.show !== null) warnings.push(...pieceWarnings(asRecord(entry.show), `Moduł ${index + 1}`));

    const keepPlace = match !== undefined && !complete && !has(entry, 'size') && !has(entry, 'layout');
    const place = !keepPlace && !(complete && (replace || match !== undefined));
    const frameLayout: Layout = keepPlace ? stripSlide(match!.layout) : complete && !place ? frames : {};
    const sliding: Layout = slide === undefined ? frameLayout : { ...frameLayout, slide };
    const layout: Layout = shown === undefined ? sliding : withPiece(sliding, shown);

    made.push({ part: { id, moduleId, kind: kindSaid, layout, config }, place, size });
    if (match !== undefined) updated += 1; else added += 1;
  });

  /*
   * 0084 — DIE PLÄTZE AUF DER BÜHNE zeigen auf Slajdy (Kennungen der Stellen).
   * Ein Dokument von woanders oder mit eigenen Namen ("a") bekommt hier neue
   * Kennungen — die Plätze folgen ihnen.
   */
  for (const m of made) {
    if (m.part.layout.slide === undefined) continue;
    const look = readSlide(m.part.layout);
    if (look.stage !== null) m.part = { ...m.part, layout: withSlide(m.part.layout, remapStage(look, ids)) };
  }

  /* Die Anordnung: ersetzt, oder die bisherige mit den geänderten an ihrer Stelle und den neuen dahinter. */
  const byId = new Map(made.map((m) => [m.part.id, m]));
  const order: { part: DraftPart; place: boolean; size: { colSpan: number; rowSpan: number } }[] = replace
    ? made
    : [
      ...now.parts.map((p) => byId.get(p.id) ?? { part: p, place: false, size: p.layout.desktop?.size ?? { colSpan: 6, rowSpan: 3 } }),
      ...made.filter((m) => !now.parts.some((p) => p.id === m.part.id))
    ];

  const placed: DraftPart[] = order.filter((o) => !o.place).map((o) => o.part);
  const parts: DraftPart[] = order.map((o) => {
    if (!o.place) return o.part;
    const layout: Record<string, unknown> = { ...o.part.layout };
    for (const bp of BREAKPOINTS) {
      const size = { colSpan: snapColSpan(o.size.colSpan, COLUMNS[bp]), rowSpan: snapRowSpan(o.size.rowSpan) };
      layout[bp] = { position: firstFreeCell(placed, size, COLUMNS[bp], bp), size };
    }
    const part = { ...o.part, layout: layout as Layout };
    placed.push(part);
    return part;
  });

  const removed = replace ? now.parts.filter((p) => !used.has(p.id)) : [];
  if (kind === 'page' || entries.length > 0) {
    lines.push(`Moduły: zmienione w miejscu — ${updated}, nowe — ${added}${replace ? `, znikną ze strony — ${removed.length}` : `, pozostałe bez zmian — ${now.parts.length - used.size}`}.`);
  }
  if (forms.size > 0) lines.push(`Pytania: ${count(forms.size, 'formularz', 'formularze', 'formularzy')}.`);

  /* Die Seite selbst — nur, was das Dokument nennt. */
  const plan: {
    -readonly [K in keyof PagePlan]?: PagePlan[K];
  } = {};
  if (kind === 'page') {
    if (typeof root.title === 'string' && root.title.trim() !== '' && root.title.trim() !== now.title) {
      plan.title = root.title.trim();
      lines.push(`Tytuł: „${plan.title}”.`);
    }
    if (has(root, 'lead') && (root.lead === null || typeof root.lead === 'string')) {
      const lead = typeof root.lead === 'string' && root.lead.trim() !== '' ? root.lead.trim() : null;
      if ((lead ?? '') !== now.lead.trim()) { plan.lead = lead; lines.push(lead === null ? 'Tekst strony: usunięty.' : 'Tekst strony: nowy.'); }
    }
    if ((PAGE_MODES as readonly unknown[]).includes(root.mode)) {
      const mode = root.mode as PageMode;
      if (mode !== now.mode) lines.push(mode === 'slides' ? 'Wygląd: slajdy.' : mode === 'presentation' ? 'Wygląd: prezentacja.' : 'Wygląd: strona z modułami.');
      plan.mode = mode;
    } else if (has(root, 'mode')) warnings.push(`"mode" „${asText(root.mode)}” — dozwolone "page", "slides" albo "presentation"; zostaje jak jest.`);
    if (has(root, 'theme') || has(root, 'cover') || has(root, 'show')) {
      const theme = has(root, 'theme') ? readTheme(root.theme) : now.look.theme;
      if (theme === undefined) warnings.push('"theme" nie ma "mode" ("dark", "light" albo "auto") — kolory zostają jak są.');
      if (has(root, 'show') && root.show !== null) warnings.push(...showWarnings(root.show));
      const show = has(root, 'show') ? (root.show === null ? undefined : showJson(readShow(root.show))) : now.look.show;
      const look: Look = {
        theme: theme === undefined ? now.look.theme : theme,
        cover: has(root, 'cover') ? readLayers(root.cover) : now.look.cover,
        ...(show === undefined ? {} : { show })
      };
      if (JSON.stringify(look) !== JSON.stringify(now.look)) plan.look = look;
      if (plan.look !== undefined) {
        lines.push(`Kolory: ${plan.look.theme === null ? 'automatyczne' : plan.look.theme.night != null ? 'jasne i nocne (jak urządzenie)' : plan.look.theme.mode === 'dark' ? 'ciemne' : 'jasne'}${has(root, 'cover') ? `, tło tytułu: ${count(plan.look.cover.length, 'warstwa', 'warstwy', 'warstw')}` : ''}.`);
        if (has(root, 'show') && plan.look.show !== undefined) lines.push(`Prezentacja: ${count(readShow(plan.look.show).scenes.length, 'scena', 'sceny', 'scen')}.`);
      }
    }
    if (has(root, 'menu')) {
      if (root.menu === null) { plan.menu = null; lines.push('Menu: bez menu.'); }
      else if (Array.isArray(root.menu)) {
        const items = readMenuItems(root.menu);
        plan.menu = items.length === 0 ? null : { items };
        lines.push(items.length === 0 ? 'Menu: bez menu.' : `Menu: ${count(items.length, 'pozycja', 'pozycje', 'pozycji')}.`);
      } else if (asText(asRecord(root.menu).from).trim() !== '') {
        plan.menu = { from: asText(asRecord(root.menu).from).trim() };
        lines.push(`Menu: to samo co na „${(plan.menu as { from: string }).from}”.`);
      } else warnings.push('"menu" nie jest listą ani { "from": … } — zostaje jak jest.');
    }
    if (has(root, 'logic')) {
      if (root.logic === null) { plan.logic = null; lines.push('Mapa logiki: usunięta.'); }
      else {
        const swap = (id: unknown) => (typeof id === 'string' ? ids.get(id) ?? id : id);
        const given = asRecord(typeof root.logic === 'string' ? safeJson(root.logic) : root.logic);
        const swapped = { ...given, nodes: asArray(given.nodes).map((n) => ({ ...asRecord(n), partId: swap(asRecord(n).partId), goto: swap(asRecord(n).goto) })) };
        const logic: PageLogic | null = readLogic(JSON.stringify(swapped));
        if (logic === null) warnings.push('"logic" jest nieczytelne — mapa logiki zostaje jak jest.');
        else {
          plan.logic = JSON.stringify(logic);
          lines.push(`Mapa logiki: ${count(logic.nodes.length, 'węzeł', 'węzły', 'węzłów')}.`);
          const here = new Set(parts.map((p) => p.id));
          const lost = logic.nodes.filter((n) => n.kind === 'part' && n.partId !== undefined && !here.has(n.partId)).length;
          if (lost > 0) warnings.push(`Mapa logiki wskazuje ${lost} ${lost === 1 ? 'moduł, którego' : 'moduły, których'} nie ma na stronie.`);
        }
      }
    }
  }

  /* 0082 — „Wybór na stronie". */
  if (kind === 'page' && has(root, 'subject')) {
    const decl = root.subject === null ? null : readSubject(root.subject);
    const known = decl === null ? undefined : subjectKindOf(decl.kind);
    if (root.subject !== null && (decl === null || known === undefined)) {
      warnings.push(decl === null ? '"subject" nie ma "kind" — wybór na stronie zostaje jak jest.' : `"subject": nieznany rodzaj „${decl.kind}” — wybór na stronie zostaje jak jest.`);
    } else {
      const next = writeSubject(decl);
      if (next !== writeSubject(readSubject(now.subject ?? null))) {
        plan.subject = next;
        lines.push(decl === null || known === undefined ? 'Wybór na stronie: brak.' : `Wybór na stronie: ${known.label.toLowerCase()}.`);
        const missing = decl === null || known === undefined ? null : known.missing(decl);
        if (missing !== null) warnings.push(`Wybór na stronie: ${missing}`);
      }
    }
  }

  /* 0085 — ein Platz auf einer Szene, die es nicht gibt, steht nirgends. */
  {
    const scenes = new Set(readShow((plan.look ?? now.look).show).scenes.map((sc) => sc.key));
    const lost = parts.reduce((n, p) => n + Object.keys(readPiece(p.layout).places).filter((key) => !scenes.has(key)).length, 0);
    if (lost > 0) warnings.push(`Prezentacja: ${count(lost, 'miejsce wskazuje', 'miejsca wskazują', 'miejsc wskazuje')} scenę, której nie ma w "show.scenes" — nie będzie widoczne.`);

    /* 0089 — ein Ausgang, der auf nichts zeigt: „dalej" geht dann zur nächsten der Liste, ein Knopf nirgends hin. */
    const show = readShow((plan.look ?? now.look).show);
    const broken = show.scenes.filter((sc) => brokenTarget(show, sc.next)).length
      + parts.reduce((n, p) => n + Object.values(readPiece(p.layout).go).filter((t) => brokenTarget(show, t)).length, 0);
    if (broken > 0) warnings.push(`Prezentacja: ${count(broken, 'wyjście („next” albo „go”) prowadzi', 'wyjścia prowadzą', 'wyjść prowadzi')} do sceny albo linku, których nie ma — „dalej” pójdzie do następnej sceny, przycisk nigdzie.`);
  }

  if (!has(plan, 'logic') && now.logic !== null && replace) {
    const logic = readLogic(now.logic);
    const here = new Set(parts.map((p) => p.id));
    const lost = (logic?.nodes ?? []).filter((n) => n.kind === 'part' && n.partId !== undefined && !here.has(n.partId)).length;
    if (lost > 0) warnings.push(`Mapa logiki strony wskazuje ${lost} ${lost === 1 ? 'moduł, który' : 'moduły, które'} znikną ze strony.`);
  }

  return { legacy: false, ...plan, parts, configs, names, forms, lines, warnings };
}

const stripSlide = (layout: Layout): Layout => {
  const { slide: _slide, show: _show, ...frames } = layout;
  return frames;
};

function safeJson(text: string): unknown {
  try { return JSON.parse(text) as unknown; } catch { return null; }
}

/* -- Die Beschreibung ------------------------------------------------------------- */

const keyLines = (keys: Readonly<Record<string, string>>, indent = '  '): string =>
  Object.entries(keys).map(([key, says]) => `${indent}"${key}" — ${says}`).join('\n');

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

/** Ein Abschnitt je Art: wozu, welche Schlüssel, ein Beispiel. */
export function kindSection(def: PartModule): string {
  const flags = [
    def.takes ? 'przyjmuje zgłoszenia' : null,
    def.fullscreen ? 'można otworzyć na pełnym ekranie' : null,
    def.Editor !== null ? 'w edytorze: własny edytor list' : null
  ].filter((one) => one !== null);
  return [
    `### "${def.kind}" — ${def.label}`,
    def.use + (flags.length === 0 ? '' : ` (${flags.join('; ')})`),
    `Domyślny rozmiar: ${def.box.colSpan}×${def.box.rowSpan}.`,
    '"config":',
    keyLines(def.json.keys),
    'Przykład "config":',
    pretty(def.json.example)
  ].join('\n');
}

const LAYERS = `Warstwy tła ("cover" strony, "slide.layers" modułu) — od tyłu do przodu:
  { "kind": "gradient", "speed": 0.12, "angle": 168, "from": "#12203a", "via": null, "to": "#060a12" }
  { "kind": "image", "speed": 0.34, "url": "https://…/tlo.jpg", "opacity": 0.45, "blend": "normal"|"multiply"|"screen"|"overlay"|"soft-light", "position": "center" }
  { "kind": "bigtext", "speed": 0.95, "lines": ["TRASA"], "opacity": 0.1, "color": null }
  "speed" 0–1 — jak wolno warstwa przesuwa się przy przewijaniu; "opacity" 0–1. Obraz może być plikiem strony: "page-image:<id>".

Slajd modułu ("slide") — wszystko poza "label" i "layers" jest nieobowiązkowe:
  "transition" — jak ten slajd zastępuje poprzedni: "scroll" (wjeżdża od dołu, zwykłe), "fade" (przenika), "cover" (nakrywa poprzedni, który przygasa), "reveal" (poprzedni odjeżdża i go odsłania), "zoom" (przybliżenie), "side" (z prawej). Idzie za przewijaniem, nie za zegarem
  "enter" — jak pojawia się treść: "none", "rise", "fade", "zoom", "left", "right"
  "colors" — własne kolory slajdu, przechodzą płynnie między slajdami: { "accent", "ink", "ground", "muted" } ("#rrggbb"; pominięty — jak strona)
  "stage" — moduł NIE ma własnego slajdu: stoi nad wszystkimi i przy zmianie slajdu przesuwa się na swoje miejsce na następnym:
      { "frames": { "<id modułu-slajdu albo "cover">": { "x": 50, "y": 50, "w": 30, "scale": 1, "rotate": 0, "opacity": 1 } }, "bare": false }
      "x", "y" — środek w procentach sceny; "w" — szerokość w procentach; między slajdami z miejscem przesuwa się płynnie, przed pierwszym i po ostatnim stoi; "bare": true — bez ramki (logo, obraz)`;

const PRESENTATION = `## Prezentacja ("mode": "presentation")
Sceny to ekrany; moduły stoją na nich w dowolnym miejscu. Scena może mieć kilka kroków — wtedy wyróżnienie przechodzi z modułu na moduł, a scena idzie za wyróżnionym. Moduł z miejscem na kilku scenach wędruje: przy zmianie sceny przechodzi płynnie na swoje następne miejsce. Wszystko idzie za przewijaniem (kółko, palec, strzałki), w „Pokazie” — za klawiaturą i kliknięciem.
Sceny nie muszą iść po kolei: każda ma jedno wejście i wyjścia — „dalej” (strzałki, przewijanie: "next") i przyciski (moduły z "go"). Wyjście prowadzi do sceny, do końca ("end") albo na zewnątrz ("link:<id>" z "links"). Kto naciśnie przycisk, idzie dalej tą drogą; wstecz — drogą, którą przyszedł.

"show" strony:
  "format" — "screen" (cały ekran, jak strona startowa; na telefonie pionowo — z miejscami "tall"), "wide" (16:9), "classic" (4:3)
  "fonts" — pismo: "app", "spectral" (Spectral + IBM Plex Sans), "cormorant" (Cormorant Garamond + Source Sans), "plex" (IBM Plex Sans)
  "nav" — pasek scen: "labels" (nazwy u góry), "dots" (kropki z prawej), "none"
  "links" — drogi na zewnątrz: [{ "id": "zapisy", "label": "Zapisz się", "href": "https://…" | "#/strona" | "mailto:…" }] — wyjście sceny albo przycisku prowadzi tam przez "link:<id>"
  "map" — gdzie stoją sceny na mapie przejść w edytorze: { "<klucz sceny>" | "link:<id>" | "end": { "x", "y" } } — tylko dla edytora
  "scenes" — lista scen w kolejności:
    "key" — klucz sceny (krótki, unikalny, np. "start"); miejsca modułów wskazują scenę po kluczu
    "label" — nazwa w pasku; link "#nazwa" w tekście prowadzi do tej sceny
    "steps" — ile kroków (postojów) ma scena; domyślnie 1
    "change" — jak zastępuje poprzednią: "fade" (przenikanie), "build" (scena jest od razu, jej moduły wchodzą każdy po swojemu — "arrive"), "fly" (kamera przelatuje przez POPRZEDNIĄ scenę — jej moduły z głębią i chmurę słów), "rise", "zoom", "cover", "reveal", "side", "cut"
    "keep" — true: poprzednia scena zostaje pod spodem, aż przejście się skończy (przy "fade", "build", "rise")
    "duration" — ile trwa skok do tej sceny w ms (domyślnie 700, przy "fly" 1700)
    "colors" — { "accent", "ink", "ground" (tło sceny), "muted" } — pominięte: jak cała prezentacja
    "layers" — warstwy tła (jak przy slajdach, bez przesuwania)
    "grow" — { "from": 0.8, "to": 1.08 } — scena rośnie od wejścia do ostatniego kroku
    "follow" — { "wide": 0.45, "tall": 1 } — jak mocno scena przesuwa się, by wyróżniony moduł stał w środku (szeroki / wąski ekran)
    "emphasis" — false: kroki nie wyróżniają modułów (domyślnie true: niewyróżnione bledną i odsuwają się od środka)
    "thread" — nitka przez moduły z krokami, w kolejności kroków: "none", "line", "dots"
    "hint" — mała podpowiedź na dole (np. "Przewiń"); znika, gdy ruszysz dalej
    "words" — chmura słów w głębi: { "list": ["colligere", …], "prefix": "RE", "count": 39, "seed": 7, "color": null }
    "depth" — { "perspective": 1000, "travel": 2200, "linger": true } — głębia sceny i jak daleko przelatuje kamera; "linger" — zwalnia przy najgłębszym module
    "next" — dokąd prowadzi „dalej” (strzałki, przewijanie): klucz sceny, "end" (tu koniec) albo "link:<id>"; pominięte — następna scena na liście

"show" modułu:
  "places" — { "<klucz sceny>": miejsce } — jedno miejsce: moduł należy do tej sceny; kilka: wędruje
    miejsce: { "x": 50, "y": 50, "w": 30, "h": null, "max": null, "rotate": 0, "scale": 1, "opacity": 1, "z": 0, "step": null, "tall": null }
      "x", "y" — punkt modułu (zwykle środek — zob. "origin") w procentach sceny; "w" — szerokość w procentach szerokości; "h" — wysokość w procentach wysokości (null — jak treść)
      "max" — najwyżej tyle szerokości w rem (np. 22): na dużym ekranie moduł nie rośnie dalej, na telefonie bierze "w" procent
      "z" — głębia w pikselach (0 płasko, −980 daleko); "step" — w którym kroku sceny jest wyróżniony (od 0)
      "tall" — inne wartości na wąskim ekranie: { "x", "y", "w", "h", "max", "scale", "rotate" } (tylko te, które się różnią)
  "skin" — oprawa: "plain" (bez tła), "card" (tafla), "bubble" (bańka), "pill" (pigułka), "panel" (pole wypełniające "w"×"h")
  "type" — tylko "text": "auto" (jak na stronie), "display" (wielkie zdanie — nagłówek strony), "title" (wersaliki), "heading" (nagłówek z treścią), "kicker" (nagłówek w kolorze akcentu z treścią), "body" (akapity), "close" (puenta: kursywa w kolorze akcentu, pusta linia dzieli grupy), "note" (mały dopisek)
  "fill", "ink", "accent" — kolor tła, pisma i akcentu (linki, puenta): "#rrggbb", para "jasny|ciemny" albo nazwa: "accent", "ink", "ground", "muted"
  "origin" — który punkt modułu stoi na "x", "y": "center" (domyślnie), "top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"
  "media" — obraz w oprawie: { "url", "at": "57% 50%", "fit": "cover"|"contain", "size": 60, "max": null, "opacity": 1, "fade": true, "side": "after"|"before"|"behind" } — przy "contain": "size" w procentach miejsca, "max" najwyżej tyle rem
  "align", "valign" — "start", "center", "end"
  "arrive" — jak się pojawia: "none", "fade", "rise", "zoom", "grow", "left", "right", "from-left", "from-right", "from-top", "from-bottom" (z "from-…" wjeżdża zza krawędzi)
  "delay", "span" — kiedy w przejściu zaczyna (0–1) i jaką jego część trwa (0–1)
  "ease" — ruch wędrującego: "inOut", "linear", "in" (przyspiesza), "out"
  "hold" — true: stoi też przed pierwszym i po ostatnim swoim miejscu
  "layer" — wyżej z przodu; wędrujący od 10 stoi nad wszystkimi scenami
  "go" — moduł jest przyciskiem: { "<klucz sceny>": cel } — na tej scenie kliknięcie prowadzi do celu (klucz sceny, "end" albo "link:<id>"; "" — jeszcze nigdzie)

Tekst ("text") w prezentacji i na stronie: "## " — śródtytuł, "# " — duża linia, "> " — mała, cicha linia, [napis](https://… | #/strona | #scena | mailto:… | tel:…) — link; linia z samych linków to rząd linków.`;

const FORM_SECTION = () => `## Pytania formularza (moduł "form")
Wpis modułu "form" — na stronie i w eksporcie modułu — może nieść jego pytania i układ. Pytania są szyfrowane w przeglądarce kluczem obszaru formularza: eksport pokazuje tylko te, które da się otworzyć Twoimi kluczami (inne mają "label": null i przy imporcie zostają nietknięte). Import pieczętuje nowe i zmienione pytania tutaj, zanim trafią do usługi.
- Pytanie z "id" z eksportu jest zmieniane — jego odpowiedzi zostają.
- Pytanie bez "id" albo z własnym (np. "q1") powstaje nowe, na końcu; tej samej nazwy można użyć w "design".
- Pytań, których nie ma w dokumencie, import nie usuwa — chyba że zaznaczysz „usuń pozostałe”. Pytania z odpowiedziami usługa i tak odmówi usunięcia.
- Kolejności istniejących pytań nie da się zmienić — kolejność na formularzu ustala "design.layout".
${keyLines(QUESTION_KEYS)}
Przykład:
${pretty(QUESTION_EXAMPLE)}`;

const ENTRY_KEYS: Readonly<Record<string, string>> = {
  id: 'Miejsce modułu na tej stronie. Z eksportu — moduł jest zmieniany w miejscu (zostają zgłoszenia, linki, mapa logiki). Pominięty albo nieznany — powstaje nowe miejsce',
  module: 'Moduł, który to miejsce pokazuje (ten sam moduł może stać na kilku stronach). Przy nowym miejscu pominięty — powstaje nowy moduł; przy miejscu z "id" — zostaje dotychczasowy',
  name: 'Nazwa modułu na liście modułów (opcjonalnie)',
  kind: 'Rodzaj modułu — lista niżej',
  slide: 'Jak wygląda jako slajd: { "label": nazwa w menu slajdów (z niej kotwica "#nazwa"), "layers": [warstwy tła], "transition", "enter", "colors", "stage" } — szczegóły niżej (Slajd modułu)',
  show: 'Gdzie stoi w prezentacji ("mode": "presentation"): { "places": { "<klucz sceny>": miejsce }, "skin", "type", … } — szczegóły niżej (Prezentacja). null — zdejmuje moduł z prezentacji',
  size: 'Rozmiar, gdy nie podajesz "layout": { "colSpan": 2|3|4|6, "rowSpan": 1|3|5 } — 1 pasek, 3 blok, 5 wysoki. Miejsce: pierwsze wolne',
  layout: 'Dokładne miejsce na siatce dla "desktop" (6 kolumn), "tablet" (4) i "mobile" (2): { "position": { "row", "col" }, "size": { "colSpan", "rowSpan" } }. Pominięty — moduł zostaje, gdzie był (nowy: pierwsze wolne miejsce)',
  config: 'Treść modułu — zależy od rodzaju (niżej). Pominięta — treść zostaje bez zmian',
  questions: 'Tylko "form": pytania (niżej)',
  design: 'Tylko "form": układ i logika (niżej)'
};

/** Ein vollständiges Beispiel einer Seite — aus den Beispielen der Bausteine. */
export function pageExample(): Record<string, unknown> {
  const sample = ['hero', 'plan', 'text', 'form'].map((kind) => partOf(kind)).filter((def): def is PartModule => def !== undefined);
  return {
    format: PAGE_FORMAT,
    version: 1,
    path: 'parafia/pielgrzymka',
    title: 'Pielgrzymka rowerowa',
    lead: 'Dwa dni, 140 km, jedna wspólnota.',
    mode: 'slides',
    theme: DEFAULT_THEMES.dark,
    cover: [],
    menu: [{ label: 'Parafia', kind: 'abs', target: 'parafia', children: [] }, { label: 'Zapisy', kind: 'rel', target: 'zapisy', children: [] }],
    logic: null,
    modules: sample.map((def, i) => ({
      ...(i === 0 ? { id: 'start' } : {}),
      kind: def.kind,
      ...(def.kind === 'form' ? { name: 'Zapisy 2026' } : {}),
      slide: i === 1 ? { label: def.label, layers: [], transition: 'fade', enter: 'rise' }
        : i === 2 ? { label: def.label, layers: [], colors: { accent: '#d3a25e' }, stage: { frames: { start: { x: 80, y: 18, w: 22, scale: 1, rotate: 0, opacity: 1 } }, bare: true } }
        : { label: def.label, layers: [] },
      size: def.box,
      config: def.json.example,
      ...(def.kind === 'form' ? QUESTION_EXAMPLE : {})
    }))
  };
}

/** Die Beschreibung der Seite — neben dem Import der Seite, und zum Kopieren für ein Sprachmodell. */
export function pageDescription(): string {
  return `# Strona jako JSON ("${PAGE_FORMAT}", wersja 1)

Co robi import:
- Dokument opisuje całą stronę: tytuł, tekst, wygląd (strona z modułami albo slajdy), kolory, menu, mapę logiki i moduły — każdy z treścią. Klucz, którego nie ma w dokumencie, zostaje na stronie bez zmian.
- Eksport → zmiana → import zmienia stronę W MIEJSCU: moduł z "id" z eksportu zostaje tym samym modułem (z jego zgłoszeniami, linkami osób i miejscem w mapie logiki). Moduł bez "id" powstaje nowy.
- „Zastąp moduły strony”: moduły strony stają się dokładnie tymi z dokumentu, pozostałe znikają ze strony. Bez tego moduły z dokumentu są zmieniane albo dopisywane, a reszta zostaje.
- Import zapisuje od razu. Eksport przed importem to kopia zapasowa.
- Przyjmowany jest też dokument wydarzenia ze starego systemu ({ "title", "pages": [{ "parts": [...] }] }) oraz pojedynczy moduł ("${MODULE_FORMAT}") — dopisywany do strony.
Zwróć JEDEN obiekt JSON, bez komentarzy.

## Strona
  "format" — "${PAGE_FORMAT}"
  "version" — 1
  "path" — tylko informacja; import zawsze trafia na otwartą stronę
  "title" — tytuł strony
  "lead" — tekst pod tytułem (albo null)
  "mode" — "page": moduły na siatce; "slides": każdy moduł to osobny slajd; "presentation": sceny z modułami w dowolnym miejscu (niżej: Prezentacja)
  "theme" — kolory: null (automatyczne — jak w aplikacji) albo { "mode": "dark"|"light", "accent", "ink", "ground", "muted" } (kolory "#rrggbb"); z "night": { "accent", "ink", "ground", "muted" } strona idzie za urządzeniem — jasne kolory w dzień, te w nocy
  "cover" — tło slajdu tytułowego: lista warstw (niżej)
  "show" — sceny prezentacji (niżej: Prezentacja)
  "menu" — null (bez menu), lista pozycji albo { "from": "ścieżka" } (to samo menu co na innej Twojej stronie)
      pozycja: { "label", "kind": "abs" (ścieżka od korzenia, np. "parafia/zapisy") | "rel" (względem tej strony) | "url" (pełny adres) | "none" (sam nagłówek), "target", "children": [pozycje] }
  "subject" — wybór na stronie: u góry strony wybiera się jedną rzecz, a moduły (np. "entry-panel") ją pokazują. ${subjectDescription()}
  "logic" — mapa logiki strony (kiedy który moduł jest widoczny, kroki osoby) albo null. Najprościej układać ją w edytorze; w JSON: { "version": 1, "nodes": [...], "edges": [...] }
      węzeł: { "id", "kind", "x", "y", ... } — kind: ${([...INPUT_KINDS, ...GATE_KINDS, 'part', 'step'] as const).map((k) => `"${k}" (${PAGE_NODE_LABEL[k]})`).join(', ')}
      "part" ma "partId" (= "id" modułu) i "message"; "step" ma "label", "help", "dueAt" (RRRR-MM-DD), "goto" (= "id" modułu);
      "registered"/"confirmed"/"answer"/"mark" mają "formId"; "answer" — "fieldId", "op" ("filled"|"empty"|"eq"|"ne"), "valueHash"; "mark" — "stepId", "markBy" ("office"|"person"); "date" — "when" ("after"|"before"), "date"
      krawędź: { "id", "from", "to", "port": "show"|"done"|"applies"|"in" }
  "modules" — moduły w kolejności czytania

## Moduł (wpis w "modules")
${keyLines(ENTRY_KEYS)}

${LAYERS}

${PRESENTATION}

## Rodzaje modułów
${PARTS.map(kindSection).join('\n\n')}

${FORM_SECTION()}

## Przykład całej strony
${pretty(pageExample())}

## Przykład prezentacji
${pretty(presentationExample())}
`;
}

/**
 * 0085 — EINE KLEINE PRÄSENTATION: der Flug durch den Raum, eine Szene mit
 * Schritten am Faden, ein Kreis, der zum Grund wächst. Steht in der
 * Beschreibung und lässt sich ohne Warnung importieren (`app-json-check`).
 */
export function presentationExample(): Record<string, unknown> {
  return {
    format: PAGE_FORMAT,
    version: 1,
    path: 'parafia/rekolekcje',
    title: 'Rekolekcje',
    lead: null,
    mode: 'presentation',
    theme: { mode: 'light', accent: '#2f5d46', ink: '#171a16', ground: '#f7f8f5', muted: '#7c8479', night: { accent: '#8fc4a8', ink: '#eceee8', ground: '#141713', muted: '#838b7e' } },
    cover: [],
    show: {
      format: 'screen',
      fonts: 'spectral',
      nav: 'dots',
      scenes: [
        { key: 'start', label: 'Start', colors: { ground: '#14180f', ink: '#f2f4ef' }, hint: 'Przewiń', words: { list: ['colligere', 'novatio', 'quies'], prefix: 'RE', count: 15, seed: 7 } },
        { key: 'dni', label: 'Trzy dni', steps: 3, change: 'fly', grow: { from: 0.8, to: 1.08 }, thread: 'dots' },
        { key: 'zapisy', label: 'Zapisy', colors: { ink: '#f2f4ef', accent: '#9ed3b4' }, next: 'link:parafia' }
      ],
      links: [{ id: 'parafia', label: 'Strona parafii', href: '#/parafia' }]
    },
    modules: [
      { id: 'haslo', kind: 'text', size: { colSpan: 6, rowSpan: 3 }, show: { places: { start: { x: 50, y: 56, w: 40, z: -980 } }, skin: 'plain', type: 'display', align: 'center' }, config: { title: 'Trzy dni, jedna wspólnota' } },
      ...['Piątek — przyjazd', 'Sobota — droga', 'Niedziela — powrót'].map((title, step) => ({
        id: `dzien${step + 1}`, kind: 'text', size: { colSpan: 3, rowSpan: 3 },
        show: { places: { dni: { x: [30, 70, 50][step], y: [32, 40, 72][step], w: 24, step } }, skin: 'bubble', type: 'title', arrive: 'zoom', delay: step * 0.12, span: 0.55 },
        config: { title }
      })),
      { id: 'kolo', kind: 'shape', size: { colSpan: 2, rowSpan: 2 }, show: { places: { dni: { x: 50, y: 50, w: 12, opacity: 0 }, zapisy: { x: 50, y: 50, w: 12, scale: 22 } }, skin: 'plain', ease: 'in', layer: -2 }, config: { shape: 'circle', fill: '#14180f' } },
      { id: 'zapis', kind: 'text', size: { colSpan: 3, rowSpan: 3 }, show: { places: { zapisy: { x: 34, y: 52, w: 40 } }, skin: 'plain', type: 'heading', arrive: 'fade', delay: 0.45, span: 0.55 }, config: { title: 'Zapisy', body: ['# [zapisy@example.pl](mailto:zapisy@example.pl)', '> Zapisy do 15 maja.'] } },
      { id: 'skrot', kind: 'text', size: { colSpan: 2, rowSpan: 1 }, show: { places: { start: { x: 50, y: 84, w: 22 } }, skin: 'pill', type: 'note', align: 'center', go: { start: 'zapisy' } }, config: { title: 'Od razu do zapisów' } }
    ]
  };
}

/** Die Beschreibung eines einzelnen Bausteins — neben seinem Import im Editor. */
export function partDescription(kind: string): string {
  const def = partOf(kind);
  if (def === undefined) return `Rodzaj „${kind}” nie jest znany tej wersji.`;
  return `# Treść modułu „${def.label}” jako JSON

Co robi import tutaj: treść ("config") zastępuje obecną treść tego modułu w szkicu strony — zapisuje ją dopiero „Zapisz moduły”. Przyjmowany jest sam obiekt "config", wpis { "kind", "config" } albo cały wpis z eksportu strony (liczy się z niego "config"). Klucze, których nie podasz, zostają puste.

${kindSection(def)}
`;
}

/** Die Beschreibung eines Moduls — neben seinem Import im Bausteinverwalter. */
export function moduleDescription(kind: string): string {
  const def = partOf(kind);
  const form = kind === 'form';
  return `# Moduł jako JSON ("${MODULE_FORMAT}", wersja 1)

Co robi import tutaj: zmienia TEN moduł — jego nazwę i treść — na wszystkich stronach, na których stoi.${form ? ' Do tego pytania formularza i jego układ (niżej).' : ''} Klucz, którego nie ma w dokumencie, zostaje bez zmian. Import zapisuje od razu.

  "format" — "${MODULE_FORMAT}"
  "version" — 1
  "id" — identyfikator modułu (tylko informacja — import zmienia zawsze otwarty moduł)
  "kind" — rodzaj; musi się zgadzać z otwartym modułem
  "name" — nazwa na liście modułów
  "config" — treść, zależna od rodzaju (niżej)${form ? `
  "questions", "design" — pytania i układ formularza (niżej)
  "extends", "audience" — tylko w rozszerzeniu formularza: który formularz rozszerza i kto je wypełnia ("person" — osoba przez swój link, "office" — tylko koordynator). Tylko informacja — import ich nie zmienia
  "repeat" — tylko w rozszerzeniu: jak często każda osoba z listy dostaje wpis — "once" (raz), "day", "week", "month", "year". Import zmienia to, dopóki rozszerzenie nie ma żadnego wpisu` : ''}

${def === undefined ? `Rodzaj „${kind}” nie jest znany tej wersji — "config" przechodzi bez zmian.` : kindSection(def)}
${form ? `\n${FORM_SECTION()}\n` : ''}`;
}
