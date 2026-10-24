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
import { type FormContent } from '../forms/formJson';
import type { VirtualAreaDoc } from '../forms/virtualAreasJson';
import { describePlan, readAppointments, referencesIn, REFERENCE_FIELDS, type AppointmentsPlan } from '../calendar/appointmentsJson';
import { newId } from '../core/ids';
import { BREAKPOINTS, COLUMNS, firstFreeCell, snapColSpan, snapRowSpan, type Breakpoint, type Frame, type Layout } from './layout';
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
    theme: now.look.theme,
    cover: layersJson(now.look.cover),
    /* 0085 — die Szenen einer Präsentation (auch, wenn die Seite gerade anders erscheint: sie gehen nicht verloren). */
    ...(now.look.show === undefined ? {} : { show: showJson(readShow(now.look.show)) }),
    /* 0107 — die Folge als Ganzes: gemeinsames Tuch, Leiste, Titelslajd, Breite. */
    ...(now.look.deck === undefined || deckJson(now.look.deck) === undefined ? {} : { deck: deckJson(now.look.deck) }),
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
  check('between', BETWEENS, 'glide');
  /* 0108 — ein Ruch, den das Wörterbuch nicht kennt, bewegt nichts. */
  for (const name of unknownMotions(said.motion)) out.push(`${where}: ruch "show.motion" „${name}” — nie ma go w słowniku (niżej: Ruch); pominięty.`);
  if (has(said, 'places') && (typeof said.places !== 'object' || said.places === null || Array.isArray(said.places))) {
    out.push(`${where}: "show.places" to nie obiekt { "klucz sceny": miejsce } — moduł nie stanie w prezentacji.`);
  }
  /* 2026-10-19 — was an Klatki, Ausschnitt und Maske eines Platzes nicht passt. */
  for (const [key, raw] of Object.entries(asRecord(said.places))) out.push(...placeWarnings(asRecord(raw), `${where}, scena „${key}”`));
  return out;
}

/** 2026-10-19 — ein Ausschnitt, der kein Ausschnitt ist, und eine Maske, deren Form es nicht gibt. */
function lookWarnings(said: Record<string, unknown>, where: string): string[] {
  const out: string[] = [];
  if (has(said, 'crop') && readCrop(said.crop) === null) out.push(`${where}: "crop" „${asText(said.crop)}” — to nie punkt kadru (np. "57% 40%", "center", "left top"); pominięty.`);
  if (has(said, 'mask') && said.mask !== null && said.mask !== 'none') {
    const shape = asText(asRecord(said.mask).shape);
    if (!(MASK_SHAPES as readonly string[]).includes(shape)) out.push(`${where}: "mask" — kształt „${shape}” — dozwolone: ${MASK_SHAPES.join(', ')}; pominięta.`);
  }
  return out;
}

/** 2026-10-19 — was an einem Platz (seinen Klatki, seinem Fortschritt) nicht stimmt. */
function placeWarnings(said: Record<string, unknown>, where: string): string[] {
  const out = lookWarnings(said, where);
  if (has(said, 'tall')) out.push(...lookWarnings(asRecord(said.tall), `${where}, "tall"`));
  if (has(said, 'by') && !(PROGRESS as readonly string[]).includes(asText(said.by))) out.push(`${where}: "by" „${asText(said.by)}” — dozwolone: ${PROGRESS.join(', ')}; będzie "scene".`);
  if (has(said, 'frames')) {
    if (!Array.isArray(said.frames)) out.push(`${where}: "frames" to nie lista klatek — pominięte.`);
    else {
      if (said.frames.length > MAX_FRAMES) out.push(`${where}: ${said.frames.length} klatek — liczy się pierwszych ${MAX_FRAMES}.`);
      said.frames.forEach((raw, i) => {
        const one = asRecord(raw);
        if (typeof one.at !== 'number' && typeof one.step !== 'number') out.push(`${where}, klatka ${i + 1}: brak "at" (0–1) albo "step" — pominięta.`);
        if (has(one, 'ease') && !(EASES as readonly string[]).includes(asText(one.ease))) out.push(`${where}, klatka ${i + 1}: "ease" „${asText(one.ease)}” — dozwolone: ${EASES.join(', ')}; będzie "inOut".`);
        out.push(...lookWarnings(one, `${where}, klatka ${i + 1}`));
        if (has(one, 'tall')) out.push(...lookWarnings(asRecord(one.tall), `${where}, klatka ${i + 1}, "tall"`));
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
    if (!(LAYER_KINDS as readonly string[]).includes(asText(one.kind))) out.push(`${where}, warstwa ${i + 1}: rodzaj „${asText(one.kind)}” — dozwolone: ${LAYER_KINDS.join(', ')}; pominięta.`);
    for (const name of unknownMotions(one.motion)) out.push(`${where}, warstwa ${i + 1}: ruch „${name}” — nie ma go w słowniku; pominięty.`);
  });
  return out;
}

/** 0107 — was an der Folge nicht stimmt. */
function deckWarnings(value: unknown): string[] {
  const root = asRecord(value);
  const out: string[] = [];
  if (has(root, 'nav') && !(DECK_NAVS as readonly string[]).includes(asText(root.nav))) out.push(`"deck.nav" „${asText(root.nav)}” — dozwolone: ${DECK_NAVS.join(', ')}; będzie "labels".`);
  out.push(...layerWarnings(root.backdrop, '"deck.backdrop"'));
  return out;
}

/** 0085 — was an den Szenen nicht stimmt. */
function showWarnings(value: unknown): string[] {
  const out: string[] = [];
  const root = asRecord(value);
  if (has(root, 'format') && !(FORMATS as readonly string[]).includes(asText(root.format))) out.push(`"show.format" „${asText(root.format)}” — dozwolone: ${FORMATS.join(', ')}; będzie "screen".`);
  if (has(root, 'fonts') && !(FONT_PAIRS as readonly string[]).includes(asText(root.fonts))) out.push(`"show.fonts" „${asText(root.fonts)}” — dozwolone: ${FONT_PAIRS.join(', ')}; będzie "app".`);
  if (has(root, 'nav') && !(NAVS as readonly string[]).includes(asText(root.nav))) out.push(`"show.nav" „${asText(root.nav)}” — dozwolone: ${NAVS.join(', ')}; będzie "labels".`);
  out.push(...layerWarnings(root.backdrop, '"show.backdrop"'));
  /* 2026-10-19 — ein Klang ohne Adresse, die er sein darf, klingt nicht. */
  if (has(root, 'sound') && root.sound !== null && mediaUrl(asRecord(root.sound).url) === null) {
    out.push('"show.sound" nie ma adresu dźwięku ("url": "page-image:<id>" albo "https://…") — bez dźwięku.');
  }
  asArray(root.scenes).forEach((raw, i) => {
    const scene = asRecord(raw);
    if (has(scene, 'volume') && typeof scene.volume !== 'number') out.push(`Scena ${i + 1}: "volume" to nie liczba 0–1 — będzie 1.`);
    if (has(scene, 'change') && !(SCENE_CHANGES as readonly string[]).includes(asText(scene.change))) {
      out.push(`Scena ${i + 1}: "change" „${asText(scene.change)}” — dozwolone: ${SCENE_CHANGES.join(', ')}; będzie "fade".`);
    }
    if (has(scene, 'thread') && !(THREADS as readonly string[]).includes(asText(scene.thread))) {
      out.push(`Scena ${i + 1}: "thread" „${asText(scene.thread)}” — dozwolone: ${THREADS.join(', ')}; będzie "none".`);
    }
    out.push(...layerWarnings(scene.layers, `Scena ${i + 1}: "layers"`));
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
 * Der Editor zeigt ihn an; erst „Importuj" führt ihn aus (`PageJsonPanel.tsx`).
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
  const forms = new Map<string, ModuleWish>();
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
      warnings.push(...wish.warnings.map((w) => `Moduł ${index + 1}: ${w}`));
      const said = formWishLine(wish, `Formularz ${asText(entry.name).trim() === '' ? index + 1 : `„${asText(entry.name).trim()}”`}`);
      if (said !== null) lines.push(said);
    } else if (kindSaid !== 'form' && formOnlyKeys(wish).length > 0) {
      warnings.push(`Moduł ${index + 1}: ${formOnlyKeys(wish).map((k) => `"${k}"`).join(', ')} ma tylko formularz — pominięte.`);
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
    /* 0107 — ein Name, den das Wörterbuch nicht kennt, bewegt nichts. */
    for (const name of unknownMotions(said.motion)) warnings.push(`Moduł ${index + 1}: ruch "slide.motion" „${name}” — nie ma go w słowniku (niżej: Ruch); pominięty.`);
    warnings.push(...layerWarnings(said.layers, `Moduł ${index + 1}: "slide.layers"`));

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
    if (has(root, 'theme') || has(root, 'cover') || has(root, 'show') || has(root, 'deck')) {
      const theme = has(root, 'theme') ? readTheme(root.theme) : now.look.theme;
      if (theme === undefined) warnings.push('"theme" nie ma "mode" ("dark", "light" albo "auto") — kolory zostają jak są.');
      if (has(root, 'show') && root.show !== null) warnings.push(...showWarnings(root.show));
      if (has(root, 'cover')) warnings.push(...layerWarnings(root.cover, '"cover"'));
      if (has(root, 'deck') && root.deck !== null) warnings.push(...deckWarnings(root.deck));
      const show = has(root, 'show') ? (root.show === null ? undefined : showJson(readShow(root.show))) : now.look.show;
      /* 0107 — die Folge: "deck": null nimmt sie weg, ein leeres Objekt auch. */
      const deck: DeckLook | undefined = has(root, 'deck') ? (root.deck === null ? undefined : readDeck(root.deck)) : now.look.deck;
      const look: Look = {
        theme: theme === undefined ? now.look.theme : theme,
        cover: has(root, 'cover') ? readLayers(root.cover) : now.look.cover,
        ...(show === undefined ? {} : { show }),
        ...(deck === undefined || deckJson(deck) === undefined ? {} : { deck })
      };
      if (JSON.stringify(look) !== JSON.stringify(now.look)) plan.look = look;
      if (plan.look !== undefined) {
        lines.push(`Kolory: ${plan.look.theme === null ? 'automatyczne' : plan.look.theme.night != null ? 'jasne i nocne (jak urządzenie)' : plan.look.theme.mode === 'dark' ? 'ciemne' : 'jasne'}${has(root, 'cover') ? `, tło tytułu: ${count(plan.look.cover.length, 'warstwa', 'warstwy', 'warstw')}` : ''}.`);
        if (has(root, 'show') && plan.look.show !== undefined) lines.push(`Prezentacja: ${count(readShow(plan.look.show).scenes.length, 'scena', 'sceny', 'scen')}.`);
        if (has(root, 'deck') && plan.look.deck !== undefined) {
          const d = plan.look.deck;
          lines.push(`Pokaz: ${[
            d.backdrop.length > 0 ? `tło wspólne — ${count(d.backdrop.length, 'warstwa', 'warstwy', 'warstw')}` : null,
            d.nav === 'dots' ? 'kropki zamiast nazw' : d.nav === 'none' ? 'bez paska' : null,
            d.titleSlide ? null : 'bez slajdu tytułowego',
            d.width === null ? null : `scena do ${d.width} rem`
          ].filter((one) => one !== null).join(', ')}.`);
        }
      }
    }
    if (has(root, 'menu')) {
      if (root.menu === null) { plan.menu = null; lines.push('Menu: bez menu.'); }
      else if (Array.isArray(root.menu)) {
        const badImages: string[] = [];
        const items = readMenuItems(root.menu, 0, badImages);
        for (const label of badImages) warnings.push(`Menu: „${label}” — "image" to nie obraz (page-image:<id>, https://… albo /plik.svg) — zostaje sama nazwa.`);
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
        if (!known.has(name)) warnings.push(`Moduł „${partOf(part.kind)?.label ?? part.kind}”: „@${name}” — nie ma takiego terminu ani kalendarza w "appointments"/"calendars".`);
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
