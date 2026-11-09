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

import { asArray, asRecord, asText } from './event/kit';
import { type FormContent } from '../forms/formJson';
import type { VirtualAreaDoc } from '../forms/virtualAreasJson';
import { describePlan, readAppointments, referencesIn, REFERENCE_FIELDS, type AppointmentsPlan } from '../calendar/appointmentsJson';
import { newId } from '../core/ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, langOfLayout, snapColSpan, snapRowSpan, withLang, type Breakpoint, type Frame, type Layout } from './layout';
import { isLang, LANGS, t, type Lang } from '../core/i18n';
import { pageStyleDropped, pageStyleJson, readPageStyle } from './pageStyle';
import type { MenuState } from './menu';
import { PAGE_MODES, type DraftPart, type MenuItem, type PageMode } from './page';
import { menuImageOf } from './menuPath';
import { readLogic, type PageLogic } from './pageLogic';
import { readSubject, subjectKindOf, writeSubject } from './pageSubject';
import { keepOwn, type RawConfig } from './part';
import { readNeeds } from '../forms/needPlan';
import { needsOut } from '../forms/needsJson';
import { carriesForm, formOnlyKeys, formPartOf, formWishLine, readModuleWish, type ModuleWish } from '../modules/moduleWish';
import { partOf } from './parts/registry';
import {
  ARRIVALS, BETWEENS, EASES, FONT_PAIRS, FORMATS, MASK_SHAPES, MAX_FRAMES, mediaUrl, NAVS, ORIGINS, pieceJson, PROGRESS, readCrop, readPiece, readPieceValue,
  readShow, SCENE_CHANGES, showJson, SKINS, TEXT_TYPES, THREADS, withPiece, type Piece
} from './presentation/presentation';
import { unknownMotions } from './motion/motion';
import { brokenTarget } from './presentation/showPaths';
import { ENTERS, readSlide, readSlideValue, remapSlide, slideJson, TRANSITIONS, withSlide } from './slides/slides';
import { DECK_NAVS, deckJson, DEFAULT_THEMES, LAYER_KINDS, layersJson, readDeck, readLayers, readPalette, type DeckLook, type Look, type Theme } from './slides/slideLook';
import { importLegacy, legacyPages } from './slides/SlidesImport';

export const PAGE_FORMAT = 'recreatio/page';
export const MODULE_FORMAT = 'recreatio/module';
export const PART_FORMAT = 'recreatio/part';

/** Wo eine Warnung steht: „Moduł 3", „Scena 2" — in der Sprache der App. */
const moduleAt = (index: number): string => t('pagesJson.w.module', { n: index + 1 });
const sceneAt = (index: number): string => t('pagesJson.w.scene', { n: index + 1 });

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

/** 2026-10-24 — die Wymagania eines Formulars im JSON ("needs"), aus seiner Tafel — ohne eines kein Schlüssel. */
function needsOf(kind: string, config: RawConfig): { needs?: Record<string, unknown>[] } {
  if (kind !== 'form') return {};
  const list = needsOut(readNeeds(config.needs));
  return list.length === 0 ? {} : { needs: list };
}

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
    /* 2026-11-05 — eine eigene Sprache des Bausteins; fehlt: die der Seite. */
    ...(langOfLayout(part.layout) === null ? {} : { lang: langOfLayout(part.layout) }),
    ...(plain ? {} : { slide }),
    /* 0085 — wo er in der Präsentation steht (nur, wenn er dort steht). */
    ...(part.layout.show === undefined ? {} : { show: pieceJson(readPiece(part.layout)) }),
    layout,
    config: def === undefined ? { ...part.config } : def.json.toJson(part.config),
    ...(extra.form === undefined ? {} : { questions: extra.form.questions, design: extra.form.design }),
    /* 2026-10-24 — die Wymagania: was gewollt ist (und was sie hier halten), nicht die Sperren der Tafel. */
    ...needsOf(part.kind, part.config)
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
    /* 2026-11-05 — die Sprache der Seite; fehlt: jeder Besucher in seiner. */
    ...(now.look.lang === undefined ? {} : { lang: now.look.lang }),
    theme: now.look.theme,
    cover: layersJson(now.look.cover),
    /* 0085 — die Szenen einer Präsentation (auch, wenn die Seite gerade anders erscheint: sie gehen nicht verloren). */
    ...(now.look.show === undefined ? {} : { show: showJson(readShow(now.look.show)) }),
    /* 0107 — die Folge als Ganzes: gemeinsames Tuch, Leiste, Titelslajd, Breite. */
    ...(now.look.deck === undefined || deckJson(now.look.deck) === undefined ? {} : { deck: deckJson(now.look.deck) }),
    /* 2026-11-06 — der Entwurf der Seite als Raster (pageStyle.ts). */
    ...(pageStyleJson(now.look.style) === undefined ? {} : { style: pageStyleJson(now.look.style) }),
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
  /** 0091/0120 — die Rollen, die seine Menschen bekommen. */
  readonly memberRoles?: readonly string[];
  /** 0120 — seine Obszary osób: je Regel Name, was die Person tut, welche Rollen jeden solchen Bereich erreichen. */
  readonly virtualAreas?: readonly VirtualAreaDoc[];
  /** 0096 — der Name der Gruppe (des Ordners), in dem das Formular steht. */
  readonly group?: string | null;
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
    ...(form === undefined ? {} : { questions: form.questions, design: form.design }),
    ...needsOf(module.kind, module.config),
    ...(module.memberRoles === undefined || module.memberRoles.length === 0 ? {} : { memberRoles: [...module.memberRoles] }),
    ...(module.virtualAreas === undefined || module.virtualAreas.length === 0 ? {} : {
      virtualAreas: module.virtualAreas.map((va) => ({ name: va.name, submitter: va.submitter, roles: va.roles.map((r) => ({ ...r })) }))
    }),
    ...(module.group == null ? {} : { group: module.group })
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
    return { error: e instanceof Error ? e.message : t('pagesJson.w.badJson') };
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
    if (has(said, key) && !list.includes(asText(said[key]))) out.push(t('pagesJson.w.allowed', { where, what: `"show.${key}"`, value: asText(said[key]), list: list.join(', '), fallback }));
  };
  check('skin', SKINS, 'card');
  check('type', TEXT_TYPES, 'auto');
  check('arrive', ARRIVALS, 'fade');
  check('ease', EASES, 'inOut');
  check('origin', ORIGINS, 'center');
  check('between', BETWEENS, 'glide');
  /* 0108 — ein Ruch, den das Wörterbuch nicht kennt, bewegt nichts. */
  for (const name of unknownMotions(said.motion)) out.push(t('pagesJson.w.motion', { where, what: '"show.motion"', name }));
  if (has(said, 'places') && (typeof said.places !== 'object' || said.places === null || Array.isArray(said.places))) {
    out.push(t('pagesJson.w.places', { where }));
  }
  /* 2026-10-19 — was an Klatki, Ausschnitt und Maske eines Platzes nicht passt. */
  for (const [key, raw] of Object.entries(asRecord(said.places))) out.push(...placeWarnings(asRecord(raw), t('pagesJson.w.sceneKey', { where, key })));
  return out;
}

/** 2026-10-19 — ein Ausschnitt, der kein Ausschnitt ist, und eine Maske, deren Form es nicht gibt. */
function lookWarnings(said: Record<string, unknown>, where: string): string[] {
  const out: string[] = [];
  if (has(said, 'crop') && readCrop(said.crop) === null) out.push(t('pagesJson.w.crop', { where, value: asText(said.crop) }));
  if (has(said, 'mask') && said.mask !== null && said.mask !== 'none') {
    const shape = asText(asRecord(said.mask).shape);
    if (!(MASK_SHAPES as readonly string[]).includes(shape)) out.push(t('pagesJson.w.mask', { where, shape, list: MASK_SHAPES.join(', ') }));
  }
  return out;
}

/** 2026-10-19 — was an einem Platz (seinen Klatki, seinem Fortschritt) nicht stimmt. */
function placeWarnings(said: Record<string, unknown>, where: string): string[] {
  const out = lookWarnings(said, where);
  if (has(said, 'tall')) out.push(...lookWarnings(asRecord(said.tall), `${where}, "tall"`));
  if (has(said, 'by') && !(PROGRESS as readonly string[]).includes(asText(said.by))) out.push(t('pagesJson.w.allowed', { where, what: '"by"', value: asText(said.by), list: PROGRESS.join(', '), fallback: 'scene' }));
  if (has(said, 'frames')) {
    if (!Array.isArray(said.frames)) out.push(t('pagesJson.w.framesNotList', { where }));
    else {
      if (said.frames.length > MAX_FRAMES) out.push(t('pagesJson.w.framesMany', { where, count: said.frames.length, max: MAX_FRAMES }));
      said.frames.forEach((raw, i) => {
        const one = asRecord(raw);
        if (typeof one.at !== 'number' && typeof one.step !== 'number') out.push(t('pagesJson.w.frameNoAt', { where: t('pagesJson.w.frame', { where, n: i + 1 }) }));
        if (has(one, 'ease') && !(EASES as readonly string[]).includes(asText(one.ease))) out.push(t('pagesJson.w.allowed', { where: t('pagesJson.w.frame', { where, n: i + 1 }), what: '"ease"', value: asText(one.ease), list: EASES.join(', '), fallback: 'inOut' }));
        out.push(...lookWarnings(one, t('pagesJson.w.frame', { where, n: i + 1 })));
        if (has(one, 'tall')) out.push(...lookWarnings(asRecord(one.tall), `${t('pagesJson.w.frame', { where, n: i + 1 })}, "tall"`));
      });
    }
  }
  return out;
}

/** 0107 — Schichten, deren Art es nicht gibt (sie fallen weg), und Bewegungen, die das Wörterbuch nicht kennt. */
function layerWarnings(value: unknown, where: string): string[] {
  const out: string[] = [];
  asArray(value).forEach((raw, i) => {
    const one = asRecord(raw);
    if (!(LAYER_KINDS as readonly string[]).includes(asText(one.kind))) out.push(t('pagesJson.w.layerKind', { where: t('pagesJson.w.layer', { where, n: i + 1 }), kind: asText(one.kind), list: LAYER_KINDS.join(', ') }));
    for (const name of unknownMotions(one.motion)) out.push(t('pagesJson.w.layerMotion', { where: t('pagesJson.w.layer', { where, n: i + 1 }), name }));
  });
  return out;
}

/** 0107 — was an der Folge nicht stimmt. */
function deckWarnings(value: unknown): string[] {
  const root = asRecord(value);
  const out: string[] = [];
  if (has(root, 'nav') && !(DECK_NAVS as readonly string[]).includes(asText(root.nav))) out.push(t('pagesJson.w.allowedTop', { what: '"deck.nav"', value: asText(root.nav), list: DECK_NAVS.join(', '), fallback: 'labels' }));
  out.push(...layerWarnings(root.backdrop, '"deck.backdrop"'));
  return out;
}

/** 0085 — was an den Szenen nicht stimmt. */
function showWarnings(value: unknown): string[] {
  const out: string[] = [];
  const root = asRecord(value);
  if (has(root, 'format') && !(FORMATS as readonly string[]).includes(asText(root.format))) out.push(t('pagesJson.w.allowedTop', { what: '"show.format"', value: asText(root.format), list: FORMATS.join(', '), fallback: 'screen' }));
  if (has(root, 'fonts') && !(FONT_PAIRS as readonly string[]).includes(asText(root.fonts))) out.push(t('pagesJson.w.allowedTop', { what: '"show.fonts"', value: asText(root.fonts), list: FONT_PAIRS.join(', '), fallback: 'app' }));
  if (has(root, 'nav') && !(NAVS as readonly string[]).includes(asText(root.nav))) out.push(t('pagesJson.w.allowedTop', { what: '"show.nav"', value: asText(root.nav), list: NAVS.join(', '), fallback: 'labels' }));
  out.push(...layerWarnings(root.backdrop, '"show.backdrop"'));
  /* 2026-10-19 — ein Klang ohne Adresse, die er sein darf, klingt nicht. */
  if (has(root, 'sound') && root.sound !== null && mediaUrl(asRecord(root.sound).url) === null) {
    out.push(t('pagesJson.w.sound'));
  }
  asArray(root.scenes).forEach((raw, i) => {
    const scene = asRecord(raw);
    if (has(scene, 'volume') && typeof scene.volume !== 'number') out.push(t('pagesJson.w.volume', { where: sceneAt(i) }));
    if (has(scene, 'change') && !(SCENE_CHANGES as readonly string[]).includes(asText(scene.change))) {
      out.push(t('pagesJson.w.allowed', { where: sceneAt(i), what: '"change"', value: asText(scene.change), list: SCENE_CHANGES.join(', '), fallback: 'fade' }));
    }
    if (has(scene, 'thread') && !(THREADS as readonly string[]).includes(asText(scene.thread))) {
      out.push(t('pagesJson.w.allowed', { where: sceneAt(i), what: '"thread"', value: asText(scene.thread), list: THREADS.join(', '), fallback: 'none' }));
    }
    out.push(...layerWarnings(scene.layers, `${sceneAt(i)}: "layers"`));
  });
  return out;
}

const MENU_KINDS: readonly MenuItem['kind'][] = ['abs', 'rel', 'url', 'none'];

/** `badImages`: die Namen der Einträge, deren "image" kein Bild sein kann (es fällt weg — und wird gesagt). */
function readMenuItems(value: unknown, depth = 0, badImages: string[] = []): MenuItem[] {
  return asArray(value).map(asRecord).filter((one) => asText(one.label).trim() !== '').map((one) => {
    const target = asText(one.target).trim();
    const said = asText(one.kind) as MenuItem['kind'];
    const kind = MENU_KINDS.includes(said) ? said : target === '' ? 'none' : /^https?:/i.test(target) ? 'url' : 'abs';
    const label = asText(one.label).trim();
    /* 2026-10-21 — ein Logo statt des Namens. */
    const image = menuImageOf(one.image);
    if (image === null && asText(one.image).trim() !== '') badImages.push(label);
    return { label, kind, target, children: depth < 4 ? readMenuItems(one.children, depth + 1, badImages) : [], ...(image === null ? {} : { image }) };
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
  /** Stelle → was ein Formular über Name und Inhalt hinaus bekommt (Fragen, Aufbau, Wymagania, Rollen …) — `moduleImport.ts`. */
  readonly forms: ReadonlyMap<string, ModuleWish>;
  /** 2026-10-24 — Termine (mit Programm), die der Import in die gewählten Kalender einträgt (`appointmentsJson.ts`). */
  readonly appointments?: AppointmentsPlan;
  /** 2026-10-27 — Stelle → ihr Eintrag in "modules" des Dokuments (ab 0); die Vorschau für Assistenten nennt Bausteine danach. */
  readonly from?: ReadonlyMap<string, number>;
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

/** 2026-10-24 — die Felder eines Bausteins, die auf Kalender oder Termine zeigen (dort darf „@name" stehen). */
export const referenceFieldsOf = (kind: string): readonly string[] =>
  (partOf(kind)?.fields ?? []).filter((f) => REFERENCE_FIELDS.includes(f.kind)).map((f) => f.key);

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
    t(options.replace ? 'pagesJson.l.legacyReplace' : 'pagesJson.l.legacyAppend', { page: pages[index]?.label ?? '?', count: done.parts.length }),
    ...(theme !== null ? [t(theme.mode === 'dark' ? 'pagesJson.l.legacyDark' : 'pagesJson.l.legacyLight')] : []),
    ...(now.title === '' && done.title !== null ? [t('pagesJson.l.pageTitle', { title: done.title })] : [])
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
 * Der Editor zeigt ihn an; erst „Importuj" führt ihn aus (`PageJsonPanel.tsx`).
 */
export function planImport(doc: unknown, now: PageNow, options: ImportOptions): PagePlan | { error: string } {
  const kind = documentKind(doc);
  if (kind === 'legacy') return planLegacy(doc, now, options);
  if (kind === 'unknown') return { error: t('pagesJson.w.notPage') };

  const root = asRecord(doc);
  const warnings: string[] = [];
  const lines: string[] = [];

  /* Ein einzelnes Modul oder ein Baustein ist eine Seite mit einem Eintrag. */
  const entries = kind === 'page'
    ? asArray(root.modules ?? root.parts)
    : [kind === 'module' ? { ...root, id: undefined, module: root.id } : root];
  const replace = kind === 'page' && options.replace;

  if (kind === 'page' && has(root, 'path') && asText(root.path) !== '' && asText(root.path) !== now.path) {
    lines.push(t('pagesJson.l.fromPage', { path: asText(root.path) }));
  }

  const used = new Set<string>();
  const ids = new Map<string, string>();
  const configs = new Map<string, RawConfig>();
  const names = new Map<string, string>();
  const forms = new Map<string, ModuleWish>();
  const from = new Map<string, number>();
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
      warnings.push(kindSaid === '' ? t('pagesJson.w.noKind', { where: moduleAt(index) }) : t('pagesJson.w.unknownKind', { where: moduleAt(index), kind: kindSaid }));
      return;
    }

    if (match !== undefined) used.add(match.id);
    const id = match?.id ?? newId();
    if (docId !== '') ids.set(docId, id);
    from.set(id, index);

    const moduleId = match !== undefined
      ? (isUuid(docModule) ? docModule : match.moduleId)
      : options.copyModules ? null : isUuid(docModule) ? docModule : null;
    if (docModule !== '' && !isUuid(docModule)) warnings.push(t('pagesJson.w.moduleId', { where: moduleAt(index), id: docModule }));

    /* 2026-10-24 — was das Modul selbst führt (die Sperren der Wymagania), setzt kein Dokument. */
    const config = has(entry, 'config')
      ? (def === undefined ? configFromJson(kindSaid, entry.config) : keepOwn(def.json, match?.config ?? {}, configFromJson(kindSaid, entry.config)))
      : match?.config ?? {};
    if (has(entry, 'config')) configs.set(id, config);
    if (asText(entry.name).trim() !== '') names.set(id, asText(entry.name).trim());
    /* 2026-10-24 — ein Formular bekommt alles, was ein Modul-Dokument trägt (`moduleWish.ts`); eine andere Art nichts davon. */
    const wish = readModuleWish(entry);
    if (kindSaid === 'form' && carriesForm(wish)) {
      forms.set(id, formPartOf(wish));
      warnings.push(...wish.warnings.map((w) => `${moduleAt(index)}: ${w}`));
      const said = formWishLine(wish, `Formularz ${asText(entry.name).trim() === '' ? index + 1 : `„${asText(entry.name).trim()}”`}`);
      if (said !== null) lines.push(said);
    } else if (kindSaid !== 'form' && formOnlyKeys(wish).length > 0) {
      warnings.push(t('pagesJson.w.formOnly', { where: moduleAt(index), keys: formOnlyKeys(wish).map((k) => `"${k}"`).join(', ') }));
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
      warnings.push(t('pagesJson.w.allowed', { where: moduleAt(index), what: '"slide.transition"', value: asText(said.transition), list: TRANSITIONS.join(', '), fallback: 'scroll' }));
    }
    if (has(said, 'enter') && !(ENTERS as readonly string[]).includes(asText(said.enter))) {
      warnings.push(t('pagesJson.w.allowed', { where: moduleAt(index), what: '"slide.enter"', value: asText(said.enter), list: ENTERS.join(', '), fallback: 'none' }));
    }
    /* 0107 — ein Name, den das Wörterbuch nicht kennt, bewegt nichts. */
    for (const name of unknownMotions(said.motion)) warnings.push(t('pagesJson.w.motion', { where: moduleAt(index), what: '"slide.motion"', name }));
    warnings.push(...layerWarnings(said.layers, `${moduleAt(index)}: "slide.layers"`));

    /* 0085 — sein Platz in der Präsentation: aus dem Dokument, sonst der bisherige. "show": null nimmt ihn heraus. */
    const shown: Piece | undefined = has(entry, 'show')
      ? (entry.show === null ? undefined : readPieceValue(entry.show))
      : match === undefined || match.layout.show === undefined ? undefined : readPiece(match.layout);
    if (has(entry, 'show') && entry.show !== null) warnings.push(...pieceWarnings(asRecord(entry.show), moduleAt(index)));

    const keepPlace = match !== undefined && !complete && !has(entry, 'size') && !has(entry, 'layout');
    const place = !keepPlace && !(complete && (replace || match !== undefined));
    const frameLayout: Layout = keepPlace ? stripSlide(match!.layout) : complete && !place ? frames : {};
    const sliding: Layout = slide === undefined ? frameLayout : { ...frameLayout, slide };
    const placedLayout: Layout = shown === undefined ? sliding : withPiece(sliding, shown);

    /* 2026-11-05 — die Sprache des Bausteins: aus dem Dokument ("lang": null nimmt sie weg), sonst die bisherige. */
    const langSaid = has(entry, 'lang') ? langIn(entry.lang, `${moduleAt(index)}: "lang"`, warnings) : undefined;
    const layout: Layout = withLang(placedLayout, langSaid !== undefined ? langSaid : match === undefined ? null : langOfLayout(match.layout));

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
    if (look.stage !== null || look.with !== null) m.part = { ...m.part, layout: withSlide(m.part.layout, remapSlide(look, ids)) };
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
    lines.push(replace
      ? t('pagesJson.l.modulesReplace', { updated, added, removed: removed.length })
      : t('pagesJson.l.modulesKeep', { updated, added, kept: now.parts.length - used.size }));
  }
  if (forms.size > 0) lines.push(t('pagesJson.l.questions', { count: forms.size }));

  /* Die Seite selbst — nur, was das Dokument nennt. */
  const plan: {
    -readonly [K in keyof PagePlan]?: PagePlan[K];
  } = {};
  if (kind === 'page') {
    if (typeof root.title === 'string' && root.title.trim() !== '' && root.title.trim() !== now.title) {
      plan.title = root.title.trim();
      lines.push(t('pagesJson.l.title', { title: plan.title }));
    }
    if (has(root, 'lead') && (root.lead === null || typeof root.lead === 'string')) {
      const lead = typeof root.lead === 'string' && root.lead.trim() !== '' ? root.lead.trim() : null;
      if ((lead ?? '') !== now.lead.trim()) { plan.lead = lead; lines.push(t(lead === null ? 'pagesJson.l.leadRemoved' : 'pagesJson.l.leadNew')); }
    }
    if ((PAGE_MODES as readonly unknown[]).includes(root.mode)) {
      const mode = root.mode as PageMode;
      if (mode !== now.mode) lines.push(t(mode === 'slides' ? 'pagesJson.l.modeSlides' : mode === 'presentation' ? 'pagesJson.l.modePresentation' : 'pagesJson.l.modePage'));
      plan.mode = mode;
    } else if (has(root, 'mode')) warnings.push(t('pagesJson.w.mode', { value: asText(root.mode) }));
    if (has(root, 'theme') || has(root, 'cover') || has(root, 'show') || has(root, 'deck') || has(root, 'style')) {
      const theme = has(root, 'theme') ? readTheme(root.theme) : now.look.theme;
      if (theme === undefined) warnings.push(t('pagesJson.w.theme'));
      if (has(root, 'show') && root.show !== null) warnings.push(...showWarnings(root.show));
      if (has(root, 'cover')) warnings.push(...layerWarnings(root.cover, '"cover"'));
      if (has(root, 'deck') && root.deck !== null) warnings.push(...deckWarnings(root.deck));
      const show = has(root, 'show') ? (root.show === null ? undefined : showJson(readShow(root.show))) : now.look.show;
      /* 0107 — die Folge: "deck": null nimmt sie weg, ein leeres Objekt auch. */
      const deck: DeckLook | undefined = has(root, 'deck') ? (root.deck === null ? undefined : readDeck(root.deck)) : now.look.deck;
      /* 2026-11-06 — der Entwurf: "style": null nimmt ihn weg; was nicht gilt, wird genannt. */
      const style = has(root, 'style') ? (root.style === null ? undefined : readPageStyle(root.style)) : now.look.style;
      if (has(root, 'style') && root.style !== null) for (const key of pageStyleDropped(root.style)) warnings.push(t('appearance.page.dropped', { key }));
      const look: Look = {
        theme: theme === undefined ? now.look.theme : theme,
        cover: has(root, 'cover') ? readLayers(root.cover) : now.look.cover,
        ...(show === undefined ? {} : { show }),
        ...(deck === undefined || deckJson(deck) === undefined ? {} : { deck }),
        ...(now.look.lang === undefined ? {} : { lang: now.look.lang }),
        ...(style === undefined ? {} : { style })
      };
      if (JSON.stringify(look) !== JSON.stringify(now.look)) plan.look = look;
      if (plan.look !== undefined) {
        {
          const colors = t(plan.look.theme === null ? 'pagesJson.l.colorsAuto' : plan.look.theme.night != null ? 'pagesJson.l.colorsNight' : plan.look.theme.mode === 'dark' ? 'pagesJson.l.colorsDark' : 'pagesJson.l.colorsLight');
          lines.push(has(root, 'cover') ? t('pagesJson.l.colorsCover', { colors, count: plan.look.cover.length }) : t('pagesJson.l.colors', { colors }));
        }
        if (has(root, 'style')) lines.push(plan.look.style === undefined ? t('appearance.page.importNone') : t('appearance.page.importLine'));
        if (has(root, 'show') && plan.look.show !== undefined) lines.push(t('pagesJson.l.scenes', { count: readShow(plan.look.show).scenes.length }));
        if (has(root, 'deck') && plan.look.deck !== undefined) {
          const d = plan.look.deck;
          lines.push(t('pagesJson.l.deck', { parts: [
            d.backdrop.length > 0 ? t('pagesJson.l.deckBackdrop', { count: d.backdrop.length }) : null,
            d.nav === 'dots' ? t('pagesJson.l.deckDots') : d.nav === 'none' ? t('pagesJson.l.deckNoBar') : null,
            d.titleSlide ? null : t('pagesJson.l.deckNoTitle'),
            d.width === null ? null : t('pagesJson.l.deckWidth', { width: d.width })
          ].filter((one) => one !== null).join(', ') }));
        }
      }
    }
    /* 2026-11-05 — die Sprache der Seite: "lang": null — jeder Besucher in seiner. */
    if (has(root, 'lang')) {
      const lang = langIn(root.lang, '"lang"', warnings);
      const base = plan.look ?? now.look;
      if (lang !== undefined && lang !== (base.lang ?? null)) {
        const { lang: _was, ...rest } = base;
        plan.look = lang === null ? rest : { ...rest, lang };
        lines.push(lang === null ? t('pagesJson.l.langVisitor') : t('pagesJson.l.lang', { lang }));
      }
    }
    if (has(root, 'menu')) {
      if (root.menu === null) { plan.menu = null; lines.push(t('pagesJson.l.menuNone')); }
      else if (Array.isArray(root.menu)) {
        const badImages: string[] = [];
        const items = readMenuItems(root.menu, 0, badImages);
        for (const label of badImages) warnings.push(t('pagesJson.w.menuImage', { label }));
        plan.menu = items.length === 0 ? null : { items };
        lines.push(items.length === 0 ? t('pagesJson.l.menuNone') : t('pagesJson.l.menuItems', { count: items.length }));
      } else if (asText(asRecord(root.menu).from).trim() !== '') {
        plan.menu = { from: asText(asRecord(root.menu).from).trim() };
        lines.push(t('pagesJson.l.menuFrom', { from: (plan.menu as { from: string }).from }));
      } else warnings.push(t('pagesJson.w.menu'));
    }
    if (has(root, 'logic')) {
      if (root.logic === null) { plan.logic = null; lines.push(t('pagesJson.l.logicRemoved')); }
      else {
        const swap = (id: unknown) => (typeof id === 'string' ? ids.get(id) ?? id : id);
        const given = asRecord(typeof root.logic === 'string' ? safeJson(root.logic) : root.logic);
        const swapped = { ...given, nodes: asArray(given.nodes).map((n) => ({ ...asRecord(n), partId: swap(asRecord(n).partId), goto: swap(asRecord(n).goto) })) };
        const logic: PageLogic | null = readLogic(JSON.stringify(swapped));
        if (logic === null) warnings.push(t('pagesJson.w.logic'));
        else {
          plan.logic = JSON.stringify(logic);
          lines.push(t('pagesJson.l.logic', { count: logic.nodes.length }));
          const here = new Set(parts.map((p) => p.id));
          const lost = logic.nodes.filter((n) => n.kind === 'part' && n.partId !== undefined && !here.has(n.partId)).length;
          if (lost > 0) warnings.push(t('pagesJson.w.logicLost', { count: lost }));
        }
      }
    }
  }

  /* 0082 — „Wybór na stronie". */
  if (kind === 'page' && has(root, 'subject')) {
    const decl = root.subject === null ? null : readSubject(root.subject);
    const known = decl === null ? undefined : subjectKindOf(decl.kind);
    if (root.subject !== null && (decl === null || known === undefined)) {
      warnings.push(decl === null ? t('pagesJson.w.subjectNoKind') : t('pagesJson.w.subjectKind', { kind: decl.kind }));
    } else {
      const next = writeSubject(decl);
      if (next !== writeSubject(readSubject(now.subject ?? null))) {
        plan.subject = next;
        lines.push(decl === null || known === undefined ? t('pagesJson.l.subjectNone') : t('pagesJson.l.subject', { kind: known.label.toLowerCase() }));
        const missing = decl === null || known === undefined ? null : known.missing(decl);
        if (missing !== null) warnings.push(t('pagesJson.w.subjectMissing', { missing }));
      }
    }
  }

  /*
     2026-10-24 — TERMINE FÜR DEN KALENDER (mit ihrem Programm). Eingetragen
     werden sie beim Import, je Eingang in den Kalender, den der Importierende
     wählt; Module zeigen mit „@name" auf sie.
  */
  if (kind === 'page') {
    const appointments = readAppointments(root.appointments, root.calendars, warnings);
    if (appointments !== undefined && appointments.items.length > 0) {
      plan.appointments = appointments;
      lines.push(describePlan(appointments));
    }
  }
  {
    const known = plan.appointments?.keys ?? new Set<string>();
    for (const part of parts) {
      for (const name of referencesIn(part.config, referenceFieldsOf(part.kind))) {
        if (!known.has(name)) warnings.push(t('pagesJson.w.refMissing', { label: partOf(part.kind)?.label ?? part.kind, name }));
      }
    }
  }

  /* 0085 — ein Platz auf einer Szene, die es nicht gibt, steht nirgends. */
  {
    const scenes = new Set(readShow((plan.look ?? now.look).show).scenes.map((sc) => sc.key));
    const lost = parts.reduce((n, p) => n + Object.keys(readPiece(p.layout).places).filter((key) => !scenes.has(key)).length, 0);
    if (lost > 0) warnings.push(t('pagesJson.w.placesLost', { count: lost }));

    /* 0089 — ein Ausgang, der auf nichts zeigt: „dalej" geht dann zur nächsten der Liste, ein Knopf nirgends hin. */
    const show = readShow((plan.look ?? now.look).show);
    const broken = show.scenes.filter((sc) => brokenTarget(show, sc.next)).length
      + parts.reduce((n, p) => n + Object.values(readPiece(p.layout).go).filter((t) => brokenTarget(show, t)).length, 0);
    if (broken > 0) warnings.push(t('pagesJson.w.exitsBroken', { count: broken }));
  }

  if (!has(plan, 'logic') && now.logic !== null && replace) {
    const logic = readLogic(now.logic);
    const here = new Set(parts.map((p) => p.id));
    const lost = (logic?.nodes ?? []).filter((n) => n.kind === 'part' && n.partId !== undefined && !here.has(n.partId)).length;
    if (lost > 0) warnings.push(t('pagesJson.w.logicWillLose', { count: lost }));
  }

  return { legacy: false, ...plan, parts, configs, names, forms, from, lines, warnings };
}

/** 2026-11-05 — "lang" aus dem Dokument: eine der Sprachen, `null` (keine eigene) — sonst `undefined` und eine Warnung. */
function langIn(value: unknown, where: string, warnings: string[]): Lang | null | undefined {
  if (value === null || value === '') return null;
  if (isLang(value)) return value;
  warnings.push(t('pagesJson.w.lang', { where, value: asText(value), list: LANGS.join(', ') }));
  return undefined;
}

const stripSlide = (layout: Layout): Layout => {
  const { slide: _slide, show: _show, ...frames } = layout;
  return frames;
};

function safeJson(text: string): unknown {
  try { return JSON.parse(text) as unknown; } catch { return null; }
}
