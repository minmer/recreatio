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
import type { DraftPart, MenuItem } from './page';
import { GATE_KINDS, INPUT_KINDS, PAGE_NODE_LABEL, readLogic, type PageLogic } from './pageLogic';
import type { PartModule, RawConfig } from './part';
import { PARTS, partOf } from './parts/registry';
import { DEFAULT_THEMES, readLayers, readSlide, type Look, type Theme } from './slides';
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
  readonly mode: 'page' | 'slides';
  readonly look: Look;
  readonly parts: readonly DraftPart[];
  readonly logic: string | null;
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
  const slide = readSlide(part.layout);

  return {
    id: part.id,
    module: part.moduleId ?? part.id,
    ...(extra.name === undefined ? {} : { name: extra.name }),
    kind: part.kind,
    ...(part.layout.slide === undefined && slide.label === '' && slide.layers.length === 0 ? {} : { slide }),
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
    ...(menu === undefined ? {} : { menu }),
    logic: readLogic(now.logic),
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
}, form?: FormContent): Record<string, unknown> {
  const def = partOf(module.kind);
  return {
    format: MODULE_FORMAT,
    version: 1,
    id: module.moduleId,
    kind: module.kind,
    name: module.name,
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
  return { mode, accent: color('accent'), ink: color('ink'), ground: color('ground'), muted: color('muted') };
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
  readonly mode?: 'page' | 'slides';
  readonly look?: Look;
  readonly menu?: { readonly items: readonly MenuItem[] } | { readonly from: string } | null;
  readonly logic?: string | null;
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
      ? { label: asText(asRecord(entry.slide).label).trim(), layers: readLayers(asRecord(entry.slide).layers) }
      : match === undefined ? undefined : match.layout.slide === undefined ? undefined : readSlide(match.layout);

    const keepPlace = match !== undefined && !complete && !has(entry, 'size') && !has(entry, 'layout');
    const place = !keepPlace && !(complete && (replace || match !== undefined));
    const frameLayout: Layout = keepPlace ? stripSlide(match!.layout) : complete && !place ? frames : {};
    const layout: Layout = slide === undefined ? frameLayout : { ...frameLayout, slide };

    made.push({ part: { id, moduleId, kind: kindSaid, layout, config }, place, size });
    if (match !== undefined) updated += 1; else added += 1;
  });

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
    if (root.mode === 'page' || root.mode === 'slides') {
      if (root.mode !== now.mode) lines.push(root.mode === 'slides' ? 'Wygląd: slajdy.' : 'Wygląd: strona z modułami.');
      plan.mode = root.mode;
    } else if (has(root, 'mode')) warnings.push(`"mode" „${asText(root.mode)}” — dozwolone "page" albo "slides"; zostaje jak jest.`);
    if (has(root, 'theme') || has(root, 'cover')) {
      const theme = has(root, 'theme') ? readTheme(root.theme) : now.look.theme;
      if (theme === undefined) warnings.push('"theme" nie ma "mode" ("dark", "light" albo "auto") — kolory zostają jak są.');
      const look = { theme: theme === undefined ? now.look.theme : theme, cover: has(root, 'cover') ? readLayers(root.cover) : now.look.cover };
      if (JSON.stringify(look) !== JSON.stringify(now.look)) plan.look = look;
      if (plan.look !== undefined) lines.push(`Kolory: ${plan.look.theme === null ? 'automatyczne' : plan.look.theme.mode === 'dark' ? 'ciemne' : 'jasne'}${has(root, 'cover') ? `, tło tytułu: ${count(plan.look.cover.length, 'warstwa', 'warstwy', 'warstw')}` : ''}.`);
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

  if (!has(plan, 'logic') && now.logic !== null && replace) {
    const logic = readLogic(now.logic);
    const here = new Set(parts.map((p) => p.id));
    const lost = (logic?.nodes ?? []).filter((n) => n.kind === 'part' && n.partId !== undefined && !here.has(n.partId)).length;
    if (lost > 0) warnings.push(`Mapa logiki strony wskazuje ${lost} ${lost === 1 ? 'moduł, który' : 'moduły, które'} znikną ze strony.`);
  }

  return { legacy: false, ...plan, parts, configs, names, forms, lines, warnings };
}

const stripSlide = (layout: Layout): Layout => {
  const { slide: _slide, ...frames } = layout;
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
  "speed" 0–1 — jak wolno warstwa przesuwa się przy przewijaniu; "opacity" 0–1. Obraz może być plikiem strony: "page-image:<id>".`;

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
  slide: 'Jak wygląda jako slajd: { "label": nazwa w menu slajdów (z niej kotwica "#nazwa"), "layers": [warstwy tła] }',
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
    modules: sample.map((def) => ({
      kind: def.kind,
      ...(def.kind === 'form' ? { name: 'Zapisy 2026' } : {}),
      slide: { label: def.label, layers: [] },
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
  "mode" — "page": moduły na siatce; "slides": każdy moduł to osobny slajd
  "theme" — kolory: null (automatyczne — jak w aplikacji) albo { "mode": "dark"|"light", "accent", "ink", "ground", "muted" } (kolory "#rrggbb")
  "cover" — tło slajdu tytułowego: lista warstw (niżej)
  "menu" — null (bez menu), lista pozycji albo { "from": "ścieżka" } (to samo menu co na innej Twojej stronie)
      pozycja: { "label", "kind": "abs" (ścieżka od korzenia, np. "parafia/zapisy") | "rel" (względem tej strony) | "url" (pełny adres) | "none" (sam nagłówek), "target", "children": [pozycje] }
  "logic" — mapa logiki strony (kiedy który moduł jest widoczny, kroki osoby) albo null. Najprościej układać ją w edytorze; w JSON: { "version": 1, "nodes": [...], "edges": [...] }
      węzeł: { "id", "kind", "x", "y", ... } — kind: ${([...INPUT_KINDS, ...GATE_KINDS, 'part', 'step'] as const).map((k) => `"${k}" (${PAGE_NODE_LABEL[k]})`).join(', ')}
      "part" ma "partId" (= "id" modułu) i "message"; "step" ma "label", "help", "dueAt" (RRRR-MM-DD), "goto" (= "id" modułu);
      "registered"/"confirmed"/"answer"/"mark" mają "formId"; "answer" — "fieldId", "op" ("filled"|"empty"|"eq"|"ne"), "valueHash"; "mark" — "stepId", "markBy" ("office"|"person"); "date" — "when" ("after"|"before"), "date"
      krawędź: { "id", "from", "to", "port": "show"|"done"|"applies"|"in" }
  "modules" — moduły w kolejności czytania

## Moduł (wpis w "modules")
${keyLines(ENTRY_KEYS)}

${LAYERS}

## Rodzaje modułów
${PARTS.map(kindSection).join('\n\n')}

${FORM_SECTION()}

## Przykład całej strony
${pretty(pageExample())}
`;
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
  "questions", "design" — pytania i układ formularza (niżej)` : ''}

${def === undefined ? `Rodzaj „${kind}” nie jest znany tej wersji — "config" przechodzi bez zmian.` : kindSection(def)}
${form ? `\n${FORM_SECTION()}\n` : ''}`;
}
