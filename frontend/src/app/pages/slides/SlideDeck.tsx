/**
 * SLAJDY (0062) — eine Seite, bei der jeder Baustein einen Bildschirm für sich hat.
 *
 * <b>Die Hülle aus dem Altbestand</b> (`legacy/pages/events/shell/EventShell.tsx`),
 * ohne das, was dort das Ereignis betraf: Oben die Namen der Slajdy, in der
 * Mitte die Bahn, die der Antrieb (`useSlideScroll`) verschiebt, hinter jedem
 * Slajd seine Schichten — Verlauf, Bild, grosser Schriftzug —, die sich mit
 * eigener Geschwindigkeit bewegen. Unten, wo man ist, und die Pfeile.
 *
 * <b>Die Hülle kennt keinen Baustein.</b> Was auf einem Slajd steht, gibt die
 * Seite hinein (`PublicPage`, der Editor mit seiner Vorschau); hier wird nur
 * geschoben, geschichtet und gezählt.
 *
 * <b>Die Adresse folgt dem Slajd</b> (`#/<seite>?s=3`), ohne Eintrag im
 * Verlauf: wer sie kopiert, teilt die Stelle, und wer sie öffnet, landet dort
 * — erst, wenn jeder Slajd gemessen ist, sonst landete er mitten in einem
 * früheren.
 *
 * <b>0084 — der Wechsel selbst</b> (`slideMotion.ts`): wie ein Slajd den
 * vorigen ablöst (wjeżdża, przenika, nakrywa, odsłania, przybliża, z boku), wie
 * sein Inhalt erscheint, Farben, die fliessend mitgehen, und Bausteine auf der
 * BÜHNE, die keinen eigenen Slajd haben, sondern über allen stehen und ihren
 * Platz von einem zum nächsten wechseln. Alles aus der Stelle der Bahn — der
 * Finger, nicht eine Uhr, bestimmt, wie weit ein Wechsel ist.
 */

import {
  useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode
} from 'react';

import { LayerArt, layerBackground } from '../presentation/deckLayers';
import { SlidePhase, type Phase } from '../motion/MotionBox';
import { addressWithSlide, anchorInAddress, anchorOf, layoutFor, slideByAnchor, slideInAddress, type Enter, type SlideColors, type SlideLayout, type StageFrame, type Transition } from './slides';
import { defaultLayers, NO_DECK, resolveTheme, type DeckLook, type Layer, type Theme } from './slideLook';
import { colorsAt, colorsOf, deckAt, enterStyle, entering, frameAt } from './slideMotion';
import { layerCover, layerPlace, sheetsAt } from './slideSheets';
import { useSlideScroll } from './useSlideScroll';

export interface DeckSlide {
  readonly key: string;
  readonly label: string;
  readonly layers: readonly Layer[];

  /** Breiter Inhalt — ein Kalender, eine Buchung — bekommt mehr Breite als ein Text. */
  readonly wide?: boolean;
  readonly content: ReactNode;

  /** 0084 — wie er den vorigen ablöst; wie sein Inhalt erscheint; seine eigenen Farben. */
  readonly transition?: Transition;
  readonly enter?: Enter;
  readonly colors?: SlideColors | null;
  /** 0107 — wo sein Inhalt steht (links, rechts, unten …); fehlt: in der Mitte. */
  readonly layout?: SlideLayout | null;
}

/**
 * 0084 — EIN BAUSTEIN AUF DER BÜHNE: kein eigener Slajd, sondern über allen,
 * mit einem Platz je Slajd (nach der Stelle in der Folge), zwischen denen er
 * gleitet.
 */
export interface DeckActor {
  readonly key: string;
  readonly frames: ReadonlyMap<number, StageFrame>;
  readonly bare: boolean;
  readonly content: ReactNode;
}

/** 0107 — wie hell eine Farbe ist (0–1); `null`: keine `#rrggbb`. */
function lightness(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (m === null) return null;
  const n = Number.parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/**
 * 0107 — DIE SCHRIFT AUF DEM AKZENT: weiss auf einem dunklen Akzent (wie
 * bisher), auf einem hellen (Cogita: #7ec8ff) die dunklere der beiden Farben
 * des Slajds — weiss auf Hellblau liest niemand.
 */
export function onAccent(accent: string, ink: string, ground: string): string {
  const a = lightness(accent);
  if (a === null || a < 0.4) return '#ffffff';
  const i = lightness(ink) ?? 1;
  const g = lightness(ground) ?? 0;
  const darker = i < g ? ink : ground;
  return (lightness(darker) ?? 0) < 0.2 ? darker : '#0b1420';
}

/** 0107 — Hochkant (ein Telefon): höher als breit. Dann gelten die Plätze und der Aufbau für hohe Schirme. */
function useTall(ref: MutableRefObject<HTMLDivElement | null>): boolean {
  const [tall, setTall] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const measure = () => setTall(el.clientHeight > el.clientWidth * 1.05);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [ref]);
  return tall;
}

/** 0107 — eine Schicht hinter einem Slajd oder im Tuch: ihr Grund, und was in ihr liegt. */
function LayerFace({ layer, style, className = '', shift = 0 }: { layer: Layer; style: CSSProperties; className?: string; shift?: number }) {
  return (
    <div className={`wk-deck-layer is-${layer.kind}${className}`} style={{ ...layerBackground(layer), ...style }} aria-hidden="true">
      <LayerArt layer={layer} />
      {/* 2026-10-24 — auch im gemeinsamen Tuch steht ein Schriftzug da (vorher fehlte er dort ganz). */}
      {layer.kind === 'bigtext' && <BigText layer={layer} shift={shift} />}
    </div>
  );
}

/**
 * 2026-10-24 — WIE EINE SCHICHT IM TUCH WANDERT — genau wie hinter einem Slajd ohne Tuch: um ihr Tempo
 * langsamer als die Bahn (0 steht, 1 läuft mit dem Inhalt), und so viel höher als der Schirm, dass sie ihn
 * auf dem ganzen Weg bedeckt (ein Bild wird dafür grösser gezogen). Verschiedene Tempi geben die Tiefe.
 * Der Schriftzug steht in seiner Ebene und wandert um seine Strecke („Długość przejazdu").
 * `from` und `length`: der Abschnitt der Bahn, über den sie wandert. 2026-10-25: nur noch für das
 * gemeinsame Tuch — die eigenen Schichten eines Slajds liegen in ihm (`layerPlace`).
 */
function drift(layer: Layer, position: number, from: number, length: number, vh: number): { style: CSSProperties; shift: number } {
  const span = Math.max(1, length);
  const along = Math.min(span, Math.max(0, position - from));
  const speed = layer.kind === 'bigtext' ? 0 : layer.speed;
  return {
    style: { top: 0, height: `${vh + speed * span}px`, transform: `translate3d(0, ${-speed * along}px, 0)` },
    shift: layer.kind === 'bigtext' ? (0.5 - along / span) * vh * layer.speed : 0
  };
}

/** Der Schriftzug einer Schicht — `shift`: wie weit er gerade über den Schirm gewandert ist (px). */
function BigText({ layer, shift }: { layer: Extract<Layer, { kind: 'bigtext' }>; shift: number }) {
  return (
    <div className="wk-deck-bigtext" style={{ opacity: layer.opacity, transform: `translate3d(0, ${shift}px, 0)` }}>
      {layer.lines.map((line, i) => (
        <span key={i} style={layer.color ? { color: layer.color } : undefined}>{line}</span>
      ))}
    </div>
  );
}

/** Von aussen steuern — der Editor springt zu dem Slajd, den man in der Liste anklickt. */
export interface DeckControl {
  readonly go: (index: number) => void;
}

/** Hell oder dunkel, wie das Gerät gerade eingestellt ist — und es bleibt dabei, wenn es wechselt. */
export function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(query.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return dark;
}

/** „Weniger Bewegung" im System — dann blenden Slajdy nur über, nichts fliegt. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(query.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * 0086 — WELCHER SLAJD IN DER ADRESSE STEHT: `?s=3`, die Kennung eines
 * Bausteins (`?part=…`, wie aus einem Widget) oder ein Anker nach dem Namen
 * des Slajd (`#zapisy`) — so öffnet der Link nach dem Absenden genau dort.
 */
function slideFromAddress(hash: string, slides: readonly DeckSlide[]): number | null {
  const n = slideInAddress(hash);
  if (n !== null) return n;
  const part = /[?&]part=([0-9a-f-]{36})/i.exec(hash)?.[1]?.toLowerCase();
  const byPart = part === undefined ? -1 : slides.findIndex((one) => one.key.toLowerCase() === part);
  if (byPart >= 0) return byPart;
  return slideByAnchor(slides.map((one) => ({ id: one.key, label: one.label })), anchorInAddress(hash));
}

/** Ein normaler Klick — ein Klick mit Strg oder Umschalt will einen neuen Tab und bekommt ihn. */
const plain = (event: React.MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export function SlideDeck({ slides, actors = [], theme, deck = NO_DECK, title, embedded = false, control }: {
  slides: readonly DeckSlide[];
  /** 0084 — Bausteine auf der Bühne: über allen Slajdy, mit einem Platz je Slajd. */
  actors?: readonly DeckActor[];
  /** `null` — automatisch: die Farben des Arbeitsplatzes, hell oder dunkel wie das Gerät. */
  theme: Theme | null;
  /** 0107 — die Folge als Ganzes: gemeinsames Tuch, Leiste, Breite der Bühne. */
  deck?: DeckLook;
  /** Unten links, klein: wessen Slajdy das sind. */
  title?: string | null;
  /** In der Vorschau des Editors: in einem Kasten statt über dem Fenster, ohne Adresse, ohne Tasten. */
  embedded?: boolean;
  control?: MutableRefObject<DeckControl | null>;
}) {
  const dark = usePrefersDark();
  const look = resolveTheme(theme, dark);
  const scroll = useSlideScroll(slides.length, { keyboard: !embedded });
  const { scrollToSlide, geometry, measured, viewportRef } = scroll;
  const reduced = usePrefersReducedMotion();
  const tall = useTall(viewportRef);
  /* 0107 — ein gemeinsames Tuch: die Slajdy rollen durchsichtig darüber, ihre eigenen Schichten liegen darin (2026-10-25: im Fenster ihres Slajds). */
  const shared = deck.backdrop.length > 0;

  useEffect(() => {
    if (control !== undefined) control.current = { go: scrollToSlide };
  }, [control, scrollToSlide]);

  /* -- Über dem Fenster: unter der Kopfleiste, und die Seite darunter rollt nicht mit. */
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (embedded) return undefined;
    const header = document.querySelector<HTMLElement>('[data-app-head]');
    const measure = () => setTop(header?.getBoundingClientRect().height ?? 0);
    measure();
    const observer = header !== null && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (header !== null) observer?.observe(header);
    document.body.classList.add('has-deck');
    return () => {
      observer?.disconnect();
      document.body.classList.remove('has-deck');
    };
  }, [embedded]);

  /* -- Der Slajd aus der Adresse ---------------------------------------------- */

  const [wanted] = useState<number | null>(() => (embedded ? null : slideFromAddress(window.location.hash, slides)));
  const wantsJump = wanted !== null && wanted > 0 && wanted < slides.length;
  const [jumped, setJumped] = useState(!wantsJump);
  /** Wo der Sprung die Bahn hingestellt hat — solange der Leser sie nicht selbst bewegt. */
  const landed = useRef<number | null>(null);

  useEffect(() => {
    if (jumped || !wantsJump || wanted === null) return undefined;
    const land = () => {
      scrollToSlide(wanted);
      landed.current = geometry[wanted]?.start ?? null;
      setJumped(true);
    };
    if (measured) { land(); return undefined; }
    /* Ein Slajd, der nie eine Höhe meldet, darf den Sprung nicht für immer aufhalten. */
    const timer = window.setTimeout(land, 800);
    return () => window.clearTimeout(timer);
  }, [geometry, wanted, jumped, measured, scrollToSlide, wantsJump]);

  /* Bilder kommen nach dem Sprung, und alles darunter rückt. Solange der Leser nicht rollt, bleibt die Bahn auf dem Slajd. */
  useEffect(() => {
    if (!jumped || !wantsJump || wanted === null || landed.current === null) return;
    if (scroll.interacted) { landed.current = null; return; }
    const start = geometry[wanted]?.start;
    if (start === undefined || Math.abs(start - landed.current) <= 2) return;
    scrollToSlide(wanted);
    landed.current = start;
  }, [geometry, wanted, jumped, scroll.interacted, scrollToSlide, wantsJump]);

  /*
   * Ein Verweis auf DIESELBE Seite mit anderem Slajd (`?s=4` im Menü, in einer
   * Nachricht) lädt nichts neu — also fährt die Bahn selbst dorthin.
   */
  const activeRef = useRef(0);
  activeRef.current = scroll.activeIndex;
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  useEffect(() => {
    if (embedded) return undefined;
    const onHash = () => {
      const n = slideFromAddress(window.location.hash, slidesRef.current) ?? 0;
      if (n !== activeRef.current && n < slides.length) scrollToSlide(n);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [embedded, scrollToSlide, slides.length]);

  /* Die Adresse folgt dem Slajd — ohne Eintrag im Verlauf. */
  useEffect(() => {
    if (embedded || !jumped || slides.length === 0) return;
    const next = addressWithSlide(window.location.hash, scroll.activeIndex);
    if (window.location.hash !== next) window.history.replaceState(window.history.state, '', next);
  }, [embedded, jumped, slides.length, scroll.activeIndex]);

  /* -- Verweise zwischen Slajdy: „#zapisy" im Text führt zum Slajd „Zapisy". -- */

  const anchors = new Map(slides.map((slide, index) => [anchorOf(slide.label), index]));

  const onTrackClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!plain(event)) return;
    const link = (event.target as HTMLElement).closest('a');
    if (link === null) return;
    const href = link.getAttribute('href') ?? '';
    if (!href.startsWith('#') || href.startsWith('#/')) return;
    const index = anchors.get(href.slice(1).toLowerCase());
    if (index === undefined) return;
    event.preventDefault();
    scrollToSlide(index);
  };

  /* -- 0084: wo die Folge gerade steht, und was daraus folgt ---------------- */

  const vh = scroll.viewportHeight;
  const at = deckAt(geometry, scroll.position, vh);
  const kinds = slides.map((slide) => slide.transition ?? 'scroll');
  /* Die eigenen Schichten jedes Slajds — ohne eigene: mit Tuch keine (das Tuch scheint durch), sonst der Grund des Themas und sein Name. */
  const drawn = slides.map((slide) => (slide.layers.length > 0 ? slide.layers : shared ? [] : defaultLayers(slide.label, look)));
  /* 2026-10-25 — wie jedes Blatt steht, mit dem, was ein anderer von ihm bedeckt (`slideSheets.ts`). */
  const sheets = sheetsAt(geometry, scroll.position, vh, kinds, drawn.map(layerCover), reduced);
  const last = geometry[geometry.length - 1];
  const travel = last === undefined ? 0 : Math.max(0, last.start + last.height - vh);
  /* Das Tuch liegt in der Bahn und wird um ihre Stelle zurückgeschoben — so steht es. */
  const cloth: CSSProperties = { transform: `translate3d(0, ${scroll.position}px, 0)` };

  /* Die Farben gehen mit: zwischen zwei Slajdy mit eigenen Farben fliessend. */
  const pageColors = { accent: look.accent, ink: look.ink, ground: look.ground, muted: look.muted };
  const colors = slides.some((slide) => slide.colors != null)
    ? colorsAt(slides.map((slide) => colorsOf(pageColors, slide.colors)), at) ?? pageColors
    : pageColors;

  const vars = {
    '--deck-accent': colors.accent,
    '--deck-ink': colors.ink,
    '--deck-ground': colors.ground,
    '--deck-muted': colors.muted,
    /* 0107 — die Schrift auf dem Akzent: dunkel auf einem hellen. */
    '--deck-on-accent': onAccent(colors.accent, colors.ink, colors.ground),
    ...(deck.width === null ? {} : { '--deck-width': `${deck.width}rem` }),
    ...(embedded ? {} : { top: `${top}px` })
  } as CSSProperties;

  const base = embedded ? '' : window.location.hash.split('?')[0];
  const active = scroll.activeIndex;

  /* 0107 — wie jeder Slajd gerade steht: der jetzige, zu sehen (er kommt oder geht), oder fort. */
  const phaseOf = (index: number): Phase => (index === active ? 'here' : Math.abs(at - index) < 1 ? 'near' : 'away');

  const labels = (
    slides.map((slide, index) => (
      embedded ? (
        <button key={slide.key} type="button" className={active === index ? 'is-active' : ''} aria-label={deck.nav === 'dots' ? slide.label : undefined}
          title={deck.nav === 'dots' ? slide.label : undefined} onClick={() => scrollToSlide(index)}>
          {deck.nav === 'dots' ? null : slide.label}
        </button>
      ) : (
        <a key={slide.key} className={active === index ? 'is-active' : ''} aria-current={active === index ? 'true' : undefined}
          aria-label={deck.nav === 'dots' ? slide.label : undefined} title={deck.nav === 'dots' ? slide.label : undefined}
          href={addressWithSlide(base, index)}
          onClick={(event) => { if (!plain(event)) return; event.preventDefault(); scrollToSlide(index); }}>
          {deck.nav === 'dots' ? null : slide.label}
        </a>
      )
    ))
  );

  return (
    <div className={`wk-deck is-${look.mode}${embedded ? ' is-embedded' : ''}${deck.nav !== 'labels' ? ` is-nav-${deck.nav}` : ''}${tall ? ' is-tall' : ''}`} style={vars}>
      {deck.nav === 'labels' && <nav className="wk-deck-nav" aria-label="Slajdy">{labels}</nav>}

      <div className="wk-deck-viewport" ref={viewportRef}>
        <div className="wk-deck-track" style={{ transform: `translate3d(0, ${-scroll.position}px, 0)` }} onClick={onTrackClick}>
          {/*
            0107 — DAS GEMEINSAME TUCH: steht, während die Slajdy darüber rollen.
            2026-10-24: ganz unten die gemeinsamen Schichten, darüber die eigenen der
            Slajdy — ein deckendes gemeinsames Tuch verdeckte sonst jedes Bild eines Slajds.
            2026-10-25: als erstes IN der Bahn, um ihre Stelle zurückgeschoben — es steht
            und liegt doch in derselben Ebene wie die Slajdy, ein „multiply" mischt sich
            mit ihm. Die eigenen Schichten liegen im Slajd und gehen mit ihm — oben ganz
            hinaus, statt im Tuch stehen zu bleiben und nur überzublenden (Wunsch des Nutzers).
          */}
          {shared && (
            <div className="wk-deck-backdrop" style={cloth} aria-hidden="true">
              {/* Die gemeinsamen wandern über die ganze Folge — langsam, wie ihr Tempo sagt (0 steht). */}
              {deck.backdrop.map((layer, n) => {
                const d = drift(layer, scroll.position, 0, travel, vh);
                return <LayerFace key={`shared-${n}`} layer={layer} className=" is-shared" style={d.style} shift={d.shift} />;
              })}
            </div>
          )}

          {slides.map((slide, index) => {
            const frame = geometry[index];
            const sheet = sheets[index];
            if (frame === undefined || sheet === undefined) return null;

            /*
             * 0084 — IM WECHSEL. Ein festgehaltener Slajd läuft nicht mit der
             * Bahn: er steht auf dem Schirm (seine eigene Stelle, `pinned`). Dazu
             * Deckkraft, Grösse, Seite, Abdunkeln — je nach Art des Wechsels.
             * 2026-10-25: das ganze Blatt — Schichten und Inhalt — geht so. Was ein
             * anderer von ihm bedeckt, schneidet `cut` ab; wer über wem liegt, sagt
             * nur noch die Folge (kein z-index: der gehende beim Odsłonięcie bleibt
             * ungestylt, und sein „multiply" mischt sich weiter mit dem Tuch). Nur
             * was sich ändert, wird gesetzt: ein ruhendes Blatt ist keine eigene Ebene.
             */
            const { motion, pinned, cut } = sheet;
            const sectionStyle: CSSProperties = { height: `${frame.height}px` };
            if (motion.pin || motion.scale !== 1 || motion.shift !== 0 || motion.lift !== 0) {
              sectionStyle.transform = `translate3d(${motion.shift}%, ${scroll.position - pinned + motion.lift}px, 0) scale(${motion.scale})`;
              sectionStyle.transformOrigin = `50% ${pinned - frame.start + vh / 2}px`;
            }
            if (motion.opacity !== 1) sectionStyle.opacity = motion.opacity;
            const filters = [motion.dim > 0 ? `brightness(${1 - motion.dim})` : '', motion.blur > 0.01 ? `blur(${motion.blur.toFixed(2)}px)` : ''].filter((f) => f !== '');
            if (filters.length > 0) sectionStyle.filter = filters.join(' ');
            if (cut !== null) sectionStyle.clipPath = `inset(${cut.top}px ${cut.right}% ${cut.bottom}px 0)`;
            const appear = enterStyle(slide.enter ?? 'none', entering(geometry, index, scroll.position, vh), reduced);
            const contentStyle: CSSProperties | undefined = slide.enter === undefined || slide.enter === 'none' ? undefined : {
              opacity: appear.opacity,
              transform: `translate3d(${appear.x}px, ${appear.y}px, 0) scale(${appear.scale})`
            };
            /* 0107 — wo der Inhalt steht: links, rechts, unten — in der Bühne der Folge, auf einem hohen Schirm anders. */
            const place = slide.layout == null ? null : layoutFor(slide.layout, tall);

            return (
              <section
                key={slide.key}
                id={`slajd-${anchorOf(slide.label)}`}
                className={`wk-deck-slide${active === index ? ' is-active' : ''}${shared ? ' is-clear' : ''}`}
                style={sectionStyle}
                data-transition={slide.transition ?? 'scroll'}
                aria-label={slide.label}
              >
                {/*
                  Die eigenen Schichten, jede mit eigenem Tempo — auch während der Slajd festgehalten
                  steht (Wunsch des Nutzers, 2026-10-24). Der Schriftzug ist keine Ebene der
                  Parallaxe, sondern eine Zeile, die über den Schirm wandert (Altbestand, EventShell).
                */}
                {drawn[index].map((layer, n) => {
                  const at = layerPlace(layer.speed, layer.kind === 'bigtext', frame, pinned, scroll.position, vh, reduced);
                  const face: CSSProperties = reduced ? { height: `${at.height}px` } : { height: `${at.height}px`, transform: `translate3d(0, ${at.top}px, 0)` };
                  return <LayerFace key={n} layer={layer} style={face} shift={at.shift} />;
                })}

                {/* Der Inhalt läuft mit Geschwindigkeit 1: keine Verschiebung, so hoch wie der Slajd. */}
                <div className={`wk-deck-content-layer${place === null ? '' : ` is-placed is-v-${place.valign}`}`} style={{ height: `${frame.height}px` }}>
                  <div
                    className={`wk-deck-content${slide.wide === true ? ' is-wide' : ''}${place === null ? '' : ` is-placed is-${place.align}`}`}
                    style={{ ...contentStyle, ...(place === null || place.width === null ? {} : { '--content-w': `${place.width}%` } as CSSProperties) }}
                    ref={(element) => { scroll.contentRefs.current[index] = element; }}
                  >
                    {/* 0107 — was darauf steht, erfährt, ob sein Slajd der jetzige ist: Auftritte und Animacje laufen danach. */}
                    <SlidePhase.Provider value={phaseOf(index)}>
                      {slide.content}
                    </SlidePhase.Provider>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/*
          0084 — DIE BÜHNE: Bausteine, die den Wechsel überleben. Sie stehen
          über allen Slajdy und gleiten von ihrem Platz auf dem einen zu dem
          auf dem nächsten — im selben Mass, in dem die Bahn sich bewegt.
        */}
        {actors.length > 0 && (
          <div className="wk-deck-stage">
            {actors.map((actor) => {
              const place = frameAt(actor.frames, at, tall);
              if (place === null) return null;
              /* 0107 — wer für hohe Schirme eigene Plätze hat, bekommt dort genau seine Breite (nicht die Vorgabe ×1,8). */
              const ownTall = tall && [...actor.frames.values()].some((f) => f.tall?.w !== undefined);
              const style = {
                left: `${place.x}%`,
                top: `${place.y}%`,
                '--actor-w': `${place.w}%`,
                '--actor-w-narrow': `${ownTall ? place.w : Math.min(92, place.w * 1.8)}%`,
                ...(place.max == null ? {} : { '--actor-max': `${place.max}rem` }),
                transform: `translate(-50%, -50%) rotate(${place.rotate}deg) scale(${place.scale})`,
                opacity: place.opacity,
                pointerEvents: place.opacity < 0.05 ? 'none' : undefined
              } as CSSProperties;
              return (
                <div key={actor.key} className={`wk-deck-actor${actor.bare ? ' is-bare' : ''}${place.max == null ? '' : ' has-max'}`} style={style}
                  aria-hidden={place.opacity < 0.05 ? true : undefined}>
                  <SlidePhase.Provider value={place.opacity < 0.05 ? 'away' : 'here'}>
                    {actor.content}
                  </SlidePhase.Provider>
                </div>
              );
            })}
          </div>
        )}

        {/* 0107 — die Leiste als Punkte, rechts in der Mitte (wie der Pokaz von Cogita). */}
        {deck.nav === 'dots' && slides.length > 1 && <nav className="wk-deck-dots" aria-label="Slajdy">{labels}</nav>}
      </div>

      <footer className="wk-deck-foot">
        <span className="wk-deck-title">{title ?? ''}</span>
        <span className="wk-deck-progress" aria-live="polite">
          {slides.length > 0 ? `${active + 1} / ${slides.length}` : '—'}
        </span>
        <span className="wk-deck-arrows">
          <button type="button" aria-label="Poprzedni slajd" disabled={active === 0} onClick={() => scrollToSlide(active - 1)}>↑</button>
          <button type="button" aria-label="Następny slajd" disabled={active >= slides.length - 1} onClick={() => scrollToSlide(active + 1)}>↓</button>
        </span>
      </footer>
    </div>
  );
}

export default SlideDeck;
