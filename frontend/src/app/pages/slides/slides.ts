/**
 * EINE SEITE ALS SLAJDY (0062) — was ein Slajd ist, und wo er in der Adresse steht.
 * Wie die Seite aussieht (Schichten, Themen, Deck), steht in `slideLook.ts`.
 *
 * <code>
 *   Seite (slug.page_mode)    'page' — Bausteine im Raster · 'slides' — je Baustein ein Slajd
 *   Aussehen (page_theme)     hell/dunkel/automatisch, vier Farben, der Titelslajd
 *   Slajd (layout.slide)      Name im Menü des Slajds, Hintergrundschichten,
 *                             0084: wie er kommt (transition), wie sein Inhalt
 *                             erscheint (enter), eigene Farben (colors), und ob der
 *                             Baustein über die Slajdy hinweg bleibt (stage)
 * </code>
 *
 * <b>Duldsam wie alles, was als Zeichenkette vom Dienst kommt:</b> ein kaputter
 * Eintrag leert nur sich selbst — ein Slajd ohne lesbare Schichten bekommt den
 * Grund des Themas, nicht eine Fehlermeldung.
 */

import type { Layout } from '../layout';
import { motionsJson, readMotions, type MotionUse } from '../motion/motion';
import { type Layer, layersJson, num, readLayers, record, str, within } from './slideLook';

/* -- Wie ein Slajd kommt (0084) ------------------------------------------------- */

/**
 * WIE DIESER SLAJD DEN VORIGEN ABLÖST — gerechnet aus der Stelle der Bahn,
 * nicht aus einer Uhr: wer langsam zieht, sieht das Ablösen langsam, wer
 * zurückzieht, sieht es rückwärts (`slideMotion.ts`).
 */
export const TRANSITIONS = ['scroll', 'fade', 'cover', 'reveal', 'zoom', 'side', 'dissolve'] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const TRANSITION_LABEL: Record<Transition, string> = {
  scroll: 'Przewinięcie — wjeżdża od dołu, jak kartka (zwykłe)',
  fade: 'Przenikanie — poprzedni stoi, ten pojawia się na nim',
  cover: 'Nakrycie — ten wjeżdża na poprzedni, który stoi i przygasa',
  reveal: 'Odsłonięcie — poprzedni odjeżdża w górę i odsłania ten',
  zoom: 'Przybliżenie — poprzedni rośnie i znika, ten wyłania się z głębi',
  side: 'Z boku — ten wjeżdża z prawej, poprzedni odsuwa się w lewo',
  /* 0107 — der Wechsel des Altbestands von Cogita (.cogita-intro-slide: 480 ms, 12 px, Unschärfe 2 px). */
  dissolve: 'Rozmycie — poprzedni gaśnie, rozmywa się i opada, ten wyostrza się, unosząc (jak pokaz Cogita)'
};

/** Wie der INHALT eines Slajds erscheint, während er hereinkommt — ebenfalls an der Bahn, nicht an der Uhr. */
export const ENTERS = ['none', 'rise', 'fade', 'zoom', 'left', 'right'] as const;
export type Enter = (typeof ENTERS)[number];

export const ENTER_LABEL: Record<Enter, string> = {
  none: 'Bez efektu',
  rise: 'Wynurza się z dołu',
  fade: 'Rozjaśnia się',
  zoom: 'Przybliża się',
  left: 'Wsuwa się z lewej',
  right: 'Wsuwa się z prawej'
};

/** Eigene Farben eines Slajds — `null` je Farbe: die der Seite. Zwischen zwei Slajdy gehen sie fliessend über. */
export interface SlideColors {
  readonly accent: string | null;
  readonly ink: string | null;
  readonly ground: string | null;
  readonly muted: string | null;
}

export const COLOR_KEYS = ['accent', 'ink', 'ground', 'muted'] as const;

/* -- Was über die Slajdy hinweg bleibt (0084) -------------------------------------- */

/**
 * WO EIN WANDERNDER BAUSTEIN AUF EINEM SLAJD STEHT. `x`, `y` — seine Mitte, in
 * Prozent der Bühne; `w` — seine Breite in Prozent (auf schmalen Schirmen
 * breiter); `scale`, `rotate` (Grad), `opacity` 0–1.
 */
export interface StageFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly scale: number;
  readonly rotate: number;
  readonly opacity: number;
  /** 0107 — höchstens so breit (rem); `null`: nur `w`. Das Zeichen bleibt auf einem grossen Schirm ein Zeichen. */
  readonly max?: number | null;
  /** 0107 — andere Werte auf einem hohen Schirm (Telefon hochkant) — nur, was sich unterscheidet. */
  readonly tall?: TallFrame | null;
}

/** 0107 — ein Platz auf einem hohen Schirm: was dort anders ist. Mit eigener Breite gilt auf dem Telefon genau sie. */
export interface TallFrame {
  readonly x?: number;
  readonly y?: number;
  readonly w?: number;
  readonly scale?: number;
  readonly rotate?: number;
  readonly opacity?: number;
}

export const STAGE_FRAME: StageFrame = { x: 50, y: 50, w: 30, scale: 1, rotate: 0, opacity: 1 };

/** 0107 — der Platz, der gerade gilt: auf einem hohen Schirm mit seinen eigenen Werten. */
export const frameFor = (frame: StageFrame, tall: boolean): StageFrame =>
  !tall || frame.tall == null ? frame : { ...frame, ...frame.tall };

/** Der Titelslajd, wo ein wandernder Baustein auf ihm steht. */
export const COVER_KEY = 'cover';

/**
 * EIN BAUSTEIN, DER DEN WECHSEL ÜBERLEBT: er bekommt keinen eigenen Slajd,
 * sondern steht über allen und wechselt seinen Platz von einem zum nächsten.
 * `frames` — je Slajd (die Kennung seines Bausteins, oder `cover`) ein Platz;
 * zwischen zwei Plätzen gleitet er, vor dem ersten und nach dem letzten bleibt
 * er stehen. `bare` — ohne Tafel (ein Logo, ein Bild, ein grosser Knopf).
 */
export interface Stage {
  readonly frames: Readonly<Record<string, StageFrame>>;
  readonly bare: boolean;
}

/* -- Ein Slajd ------------------------------------------------------------------ */

/* -- 0107: wie der Inhalt auf dem Slajd steht, und wer neben wem ---------------------- */

export const ALIGNS3 = ['start', 'center', 'end'] as const;
export type Align3 = (typeof ALIGNS3)[number];

/**
 * WO DER INHALT EINES SLAJDS STEHT. Ohne Angabe: in der Mitte, so breit wie
 * ein Text gut zu lesen ist (wie bisher). Sonst: links, mittig oder rechts in
 * der Bühne (`DeckLook.width`), `width` Prozent davon breit, oben, mittig oder
 * unten — und auf einem hohen Schirm (`tall`) anders, etwa unten über die ganze
 * Breite, damit oben das Zeichen Platz hat.
 */
export interface SlideLayout {
  readonly align: Align3;
  readonly valign: Align3;
  readonly width: number | null;
  readonly tall: { readonly align?: Align3; readonly valign?: Align3; readonly width?: number | null } | null;
}

/** Was gerade gilt: auf einem hohen Schirm mit seinen eigenen Werten. */
export const layoutFor = (layout: SlideLayout, tall: boolean): { align: Align3; valign: Align3; width: number | null } =>
  !tall || layout.tall === null ? layout : {
    align: layout.tall.align ?? layout.align,
    valign: layout.tall.valign ?? layout.valign,
    width: layout.tall.width === undefined ? layout.width : layout.tall.width
  };

/**
 * EIN BAUSTEIN NEBEN EINEM ANDEREN: er hat keinen eigenen Slajd, sondern steht
 * auf dem Slajd von `slide` — daneben (`side`: vor oder nach ihm), `share`
 * Prozent der Reihe breit; auf einem hohen Schirm darüber oder darunter
 * (`tallSide`). Das Bild neben dem Text, die Animacja neben dem Hasło.
 */
export interface SlideCompanion {
  readonly slide: string;
  readonly side: 'start' | 'end';
  readonly share: number;
  readonly tallSide: 'start' | 'end';
}

const align3 = (value: unknown, fallback: Align3): Align3 => (ALIGNS3.includes(value as Align3) ? value as Align3 : fallback);

function readLayout(value: unknown): SlideLayout | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const one = record(value);
  const widthOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(10, v)) : null);
  const t = typeof one.tall === 'object' && one.tall !== null ? record(one.tall) : null;
  const tall = t === null ? null : {
    ...(t.align === undefined ? {} : { align: align3(t.align, 'center') }),
    ...(t.valign === undefined ? {} : { valign: align3(t.valign, 'center') }),
    ...(t.width === undefined ? {} : { width: widthOf(t.width) })
  };
  return {
    align: align3(one.align, 'center'),
    valign: align3(one.valign, 'center'),
    width: widthOf(one.width),
    tall: tall === null || Object.keys(tall).length === 0 ? null : tall
  };
}

function layoutJson(layout: SlideLayout): Record<string, unknown> {
  return {
    ...(layout.align === 'center' ? {} : { align: layout.align }),
    ...(layout.valign === 'center' ? {} : { valign: layout.valign }),
    ...(layout.width === null ? {} : { width: layout.width }),
    ...(layout.tall === null ? {} : { tall: layout.tall })
  };
}

function readCompanion(value: unknown): SlideCompanion | null {
  const one = typeof value === 'string' ? { slide: value } : record(value);
  const slide = typeof one.slide === 'string' ? one.slide.trim().slice(0, 64) : '';
  if (slide === '') return null;
  const side = one.side === 'start' ? 'start' : 'end';
  return {
    slide,
    side,
    share: Math.round(within(one.share, 10, 90, 45)),
    tallSide: one.tallSide === 'start' || one.tallSide === 'end' ? one.tallSide : side
  };
}

function companionJson(c: SlideCompanion): Record<string, unknown> {
  return { slide: c.slide, side: c.side, share: c.share, ...(c.tallSide === c.side ? {} : { tallSide: c.tallSide }) };
}

/* -- Ein Slajd ------------------------------------------------------------------ */

/** Was ein Baustein als Slajd trägt (`layout.slide`). */
export interface SlideLook {
  /** Sein Name im Menü der Slajdy — leer: der Titel des Bausteins, sonst seine Art. */
  readonly label: string;
  readonly layers: readonly Layer[];
  /** 0084 — wie er den vorigen ablöst (Vorgabe: `scroll`, wie bisher). */
  readonly transition: Transition;
  /** 0084 — wie sein Inhalt erscheint (Vorgabe: `none`, wie bisher). */
  readonly enter: Enter;
  readonly colors: SlideColors | null;
  /** 0084 — nicht `null`: der Baustein wandert über die Slajdy, statt selbst einer zu sein. */
  readonly stage: Stage | null;
  /** 0107 — seine Bewegungen (`motion.ts`): ein Auftritt, wenn sein Slajd erreicht ist, und/oder eine Schleife. */
  readonly motion: readonly MotionUse[];
  /** 0107 — wo der Inhalt seines Slajds steht. `null`: in der Mitte, wie bisher. */
  readonly layout: SlideLayout | null;
  /** 0107 — nicht `null`: er steht neben einem anderen Baustein auf dessen Slajd. */
  readonly with: SlideCompanion | null;
}

const between = (value: unknown, min: number, max: number, fallback: number): number =>
  Math.min(max, Math.max(min, num(value, fallback)));

function readTallFrame(value: unknown): TallFrame | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const one = record(value);
  const out: { -readonly [K in keyof TallFrame]: TallFrame[K] } = {};
  if (typeof one.x === 'number') out.x = between(one.x, -50, 150, STAGE_FRAME.x);
  if (typeof one.y === 'number') out.y = between(one.y, -50, 150, STAGE_FRAME.y);
  if (typeof one.w === 'number') out.w = between(one.w, 4, 100, STAGE_FRAME.w);
  if (typeof one.scale === 'number') out.scale = between(one.scale, 0.1, 4, STAGE_FRAME.scale);
  if (typeof one.rotate === 'number') out.rotate = between(one.rotate, -360, 360, STAGE_FRAME.rotate);
  if (typeof one.opacity === 'number') out.opacity = between(one.opacity, 0, 1, STAGE_FRAME.opacity);
  return Object.keys(out).length === 0 ? null : out;
}

function readFrame(value: unknown): StageFrame | null {
  if (typeof value !== 'object' || value === null) return null;
  const one = record(value);
  const max = typeof one.max === 'number' && Number.isFinite(one.max) ? between(one.max, 1, 200, 30) : null;
  const tall = readTallFrame(one.tall);
  return {
    x: between(one.x, -50, 150, STAGE_FRAME.x),
    y: between(one.y, -50, 150, STAGE_FRAME.y),
    w: between(one.w, 4, 100, STAGE_FRAME.w),
    scale: between(one.scale, 0.1, 4, STAGE_FRAME.scale),
    rotate: between(one.rotate, -360, 360, STAGE_FRAME.rotate),
    opacity: between(one.opacity, 0, 1, STAGE_FRAME.opacity),
    ...(max === null ? {} : { max }),
    ...(tall === null ? {} : { tall })
  };
}

const colorOrNull = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** Ein Slajd aus dem, was gespeichert liegt (oder in einem Dokument steht) — duldsam. */
export function readSlideValue(value: unknown): SlideLook {
  const one = record(value);
  const transition = str(one.transition) as Transition;
  const enter = str(one.enter) as Enter;

  const c = record(one.colors);
  const colors: SlideColors = { accent: colorOrNull(c.accent), ink: colorOrNull(c.ink), ground: colorOrNull(c.ground), muted: colorOrNull(c.muted) };

  let stage: Stage | null = null;
  if (typeof one.stage === 'object' && one.stage !== null) {
    const raw = record(record(one.stage).frames);
    const frames: Record<string, StageFrame> = {};
    for (const [key, frame] of Object.entries(raw)) {
      const read = readFrame(frame);
      if (read !== null && key.trim() !== '') frames[key.trim()] = read;
    }
    stage = { frames, bare: record(one.stage).bare === true };
  }

  return {
    label: str(one.label).trim(),
    layers: readLayers(one.layers),
    transition: TRANSITIONS.includes(transition) ? transition : 'scroll',
    enter: ENTERS.includes(enter) ? enter : 'none',
    colors: COLOR_KEYS.some((k) => colors[k] !== null) ? colors : null,
    stage,
    motion: readMotions(one.motion),
    layout: readLayout(one.layout),
    /* Wer wandert, steht über allen — nicht neben einem. */
    with: stage === null ? readCompanion(one.with) : null
  };
}

export const readSlide = (layout: Layout): SlideLook => readSlideValue(layout.slide);

/**
 * Ein Slajd, wie er gespeichert wird und im JSON steht — KNAPP: was der
 * Vorgabe entspricht, fehlt. Ein Slajd ohne die Neuerungen von 0084 sieht
 * genauso aus wie vorher.
 */
export function slideJson(slide: SlideLook): Record<string, unknown> {
  const colors = slide.colors === null ? null
    : Object.fromEntries(COLOR_KEYS.filter((k) => slide.colors![k] !== null).map((k) => [k, slide.colors![k]]));
  const motion = motionsJson(slide.motion);
  const layout = slide.layout === null ? null : layoutJson(slide.layout);
  return {
    label: slide.label,
    layers: layersJson(slide.layers),
    ...(slide.transition === 'scroll' ? {} : { transition: slide.transition }),
    ...(slide.enter === 'none' ? {} : { enter: slide.enter }),
    ...(colors === null || Object.keys(colors).length === 0 ? {} : { colors }),
    ...(slide.stage === null ? {} : { stage: { frames: slide.stage.frames, ...(slide.stage.bare ? { bare: true } : {}) } }),
    ...(motion === undefined ? {} : { motion }),
    ...(layout === null || Object.keys(layout).length === 0 ? {} : { layout }),
    ...(slide.with === null ? {} : { with: companionJson(slide.with) })
  };
}

export const withSlide = (layout: Layout, slide: SlideLook): Layout => ({ ...layout, slide: slideJson(slide) });

/**
 * Die Kennungen, auf die ein Slajd zeigt — die Plätze eines wandernden
 * Bausteins (0084) und der Baustein, neben dem er steht (0107) —, nach einem
 * Import die neuen.
 */
export function remapSlide(slide: SlideLook, ids: ReadonlyMap<string, string>): SlideLook {
  let out = slide;
  if (slide.stage !== null) {
    const frames: Record<string, StageFrame> = {};
    for (const [key, frame] of Object.entries(slide.stage.frames)) frames[ids.get(key) ?? key] = frame;
    out = { ...out, stage: { ...slide.stage, frames } };
  }
  if (slide.with !== null) out = { ...out, with: { ...slide.with, slide: ids.get(slide.with.slide) ?? slide.with.slide } };
  return out;
}

/** Der alte Name (0084) — dieselbe Rechnung. */
export const remapStage = remapSlide;

/**
 * Wie ein Slajd als Adresse heisst — aus seinem Namen, Buchstabe für Buchstabe
 * wie im Altbestand (`partAnchor`), damit ein Verweis `#zapisy` im Text auf
 * den Slajd „Zapisy" führt.
 */
export const anchorOf = (label: string): string =>
  label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Welcher Slajd in der Adresse steht: `#/<seite>?s=3` — ab 1 gezählt, der erste
 * ohne Zahl. Hinter `?` liest die Weiche nichts mehr (`parsePath`).
 */
export function slideInAddress(hash: string): number | null {
  const plain = withoutAnchor(hash);
  const at = plain.indexOf('?');
  if (at < 0) return null;
  const n = Number.parseInt(new URLSearchParams(plain.slice(at + 1)).get('s') ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n - 1 : null;
}

/**
 * 0086 — DER ANKER IN DER ADRESSE: `#/<seite>#zapisy` (oder `…?s=2#zapisy`) —
 * der Teil hinter der zweiten Raute, kleingeschrieben; leer, wenn keiner da ist.
 * So führt ein Link (etwa der nach dem Absenden) auf einen Slajd nach seinem Namen.
 */
export function anchorInAddress(hash: string): string {
  const first = hash.indexOf('#');
  const second = first < 0 ? -1 : hash.indexOf('#', first + 1);
  if (second < 0) return '';
  try { return decodeURIComponent(hash.slice(second + 1)).trim().toLowerCase(); } catch { return hash.slice(second + 1).trim().toLowerCase(); }
}

/** Die Adresse ohne ihren Anker. */
const withoutAnchor = (hash: string): string => {
  const first = hash.indexOf('#');
  const second = first < 0 ? -1 : hash.indexOf('#', first + 1);
  return second < 0 ? hash : hash.slice(0, second);
};

/** Welcher Slajd zu einem Anker gehört — nach seinem Namen (`anchorOf`) oder der Kennung seines Bausteins. */
export function slideByAnchor(slides: readonly { readonly id?: string; readonly label: string }[], anchor: string): number | null {
  if (anchor === '') return null;
  const at = slides.findIndex((one) => anchorOf(one.label) === anchor || (one.id !== undefined && one.id.toLowerCase() === anchor));
  return at < 0 ? null : at;
}

export function addressWithSlide(hash: string, index: number): string {
  const base = withoutAnchor(hash).split('?')[0];
  return index <= 0 ? base : `${base}?s=${index + 1}`;
}
