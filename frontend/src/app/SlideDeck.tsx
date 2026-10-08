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

import {
  addressWithSlide, anchorInAddress, anchorOf, defaultLayers, imageUrl, resolveTheme, slideByAnchor, slideInAddress,
  type Enter, type Layer, type SlideColors, type StageFrame, type Theme, type Transition
} from './slides';
import {
  colorsAt, colorsOf, deckAt, enterStyle, entering, frameAt, motionOf, pinnedPosition
} from './slideMotion';
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

function gradientOf(layer: Layer): string | undefined {
  if (layer.kind !== 'gradient') return undefined;
  const stops = layer.via ? `${layer.from}, ${layer.via}, ${layer.to}` : `${layer.from}, ${layer.to}`;
  return `linear-gradient(${layer.angle}deg, ${stops})`;
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

export function SlideDeck({ slides, actors = [], theme, title, embedded = false, control }: {
  slides: readonly DeckSlide[];
  /** 0084 — Bausteine auf der Bühne: über allen Slajdy, mit einem Platz je Slajd. */
  actors?: readonly DeckActor[];
  /** `null` — automatisch: die Farben des Arbeitsplatzes, hell oder dunkel wie das Gerät. */
  theme: Theme | null;
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

  useEffect(() => {
    if (control !== undefined) control.current = { go: scrollToSlide };
  }, [control, scrollToSlide]);

  /* -- Über dem Fenster: unter der Kopfleiste, und die Seite darunter rollt nicht mit. */
  const [top, setTop] = useState(0);
  useEffect(() => {
    if (embedded) return undefined;
    const header = document.querySelector<HTMLElement>('.wk-top');
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
    ...(embedded ? {} : { top: `${top}px` })
  } as CSSProperties;

  const base = embedded ? '' : window.location.hash.split('?')[0];
  const active = scroll.activeIndex;

  return (
    <div className={`wk-deck is-${look.mode}${embedded ? ' is-embedded' : ''}`} style={vars}>
      <nav className="wk-deck-nav" aria-label="Slajdy">
        {slides.map((slide, index) => (
          embedded ? (
            <button key={slide.key} type="button" className={active === index ? 'is-active' : ''}
              onClick={() => scrollToSlide(index)}>
              {slide.label}
            </button>
          ) : (
            <a key={slide.key} className={active === index ? 'is-active' : ''} aria-current={active === index ? 'true' : undefined}
              href={addressWithSlide(base, index)}
              onClick={(event) => { if (!plain(event)) return; event.preventDefault(); scrollToSlide(index); }}>
              {slide.label}
            </a>
          )
        ))}
      </nav>

      <div className="wk-deck-viewport" ref={viewportRef}>
        <div className="wk-deck-track" style={{ transform: `translate3d(0, ${-scroll.position}px, 0)` }} onClick={onTrackClick}>
          {slides.map((slide, index) => {
            const frame = geometry[index];
            if (frame === undefined) return null;
            /* Ohne eigene Schichten: der Grund des Themas und der Name als blasser Schriftzug — passt sich an hell und dunkel an. */
            const layers = slide.layers.length > 0 ? slide.layers : defaultLayers(slide.label, look);

            /*
             * 0084 — IM WECHSEL. Ein festgehaltener Slajd läuft nicht mit der
             * Bahn: er steht auf dem Schirm (seine eigene Stelle, `pinned`), und
             * seine Schichten rechnen von dort. Dazu Deckkraft, Grösse, Seite,
             * Abdunkeln — je nach Art des Wechsels.
             */
            const motion = motionOf(geometry, index, scroll.position, vh, kinds, reduced);
            const pinned = motion.pin ? pinnedPosition(frame, scroll.position, vh) : scroll.position;
            const moved = scroll.position - pinned;
            const sectionStyle: CSSProperties = { height: `${frame.height}px` };
            if (motion !== undefined && (motion.pin || motion.scale !== 1 || motion.shift !== 0 || motion.opacity !== 1 || motion.dim !== 0 || motion.above)) {
              sectionStyle.transform = `translate3d(${motion.shift}%, ${moved}px, 0) scale(${motion.scale})`;
              sectionStyle.transformOrigin = `50% ${pinned - frame.start + vh / 2}px`;
              sectionStyle.opacity = motion.opacity;
              if (motion.dim > 0) sectionStyle.filter = `brightness(${1 - motion.dim})`;
              if (motion.above) sectionStyle.zIndex = 3;
            }
            const appear = enterStyle(slide.enter ?? 'none', entering(geometry, index, scroll.position, vh), reduced);
            const contentStyle: CSSProperties | undefined = slide.enter === undefined || slide.enter === 'none' ? undefined : {
              opacity: appear.opacity,
              transform: `translate3d(${appear.x}px, ${appear.y}px, 0) scale(${appear.scale})`
            };

            return (
              <section
                key={slide.key}
                id={`slajd-${anchorOf(slide.label)}`}
                className={`wk-deck-slide${active === index ? ' is-active' : ''}`}
                style={sectionStyle}
                data-transition={slide.transition ?? 'scroll'}
                aria-label={slide.label}
              >
                {layers.map((layer, n) => {
                  /*
                     Der Schriftzug ist keine Ebene der Parallaxe, sondern eine
                     Zeile, die über den Schirm wandert: seine Ebene steht, der
                     Text darin bewegt sich (Altbestand, EventShell).
                  */
                  const speed = layer.kind === 'bigtext' ? 0 : layer.speed;
                  const local = pinned - frame.start;
                  const span = frame.height + scroll.viewportHeight;
                  const style: CSSProperties = {
                    height: `${scroll.viewportHeight + speed * span}px`,
                    transform: `translate3d(0, ${local * (1 - speed) - speed * scroll.viewportHeight}px, 0)`
                  };
                  const gradient = gradientOf(layer);
                  if (gradient !== undefined) style.background = gradient;
                  if (layer.kind === 'image' && layer.url !== '') {
                    style.backgroundImage = `url(${JSON.stringify(imageUrl(layer.url))})`;
                    style.backgroundSize = 'cover';
                    style.backgroundPosition = layer.position;
                    style.opacity = layer.opacity;
                    style.mixBlendMode = layer.blend;
                  }

                  return (
                    <div key={n} className={`wk-deck-layer is-${layer.kind}`} style={style} aria-hidden="true">
                      {layer.kind === 'bigtext' && (
                        <div className="wk-deck-bigtext" style={{
                          opacity: layer.opacity,
                          transform: `translate3d(0, ${(0.5 - Math.min(1, Math.max(0, (pinned - frame.start + vh) / (frame.height + vh)))) * scroll.viewportHeight * layer.speed}px, 0)`
                        }}>
                          {layer.lines.map((line, i) => (
                            <span key={i} style={layer.color ? { color: layer.color } : undefined}>{line}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Der Inhalt läuft mit Geschwindigkeit 1: keine Verschiebung, so hoch wie der Slajd. */}
                <div className="wk-deck-content-layer" style={{ height: `${frame.height}px` }}>
                  <div
                    className={`wk-deck-content${slide.wide === true ? ' is-wide' : ''}`}
                    style={contentStyle}
                    ref={(element) => { scroll.contentRefs.current[index] = element; }}
                  >
                    {slide.content}
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
              const place = frameAt(actor.frames, at);
              if (place === null) return null;
              const style = {
                left: `${place.x}%`,
                top: `${place.y}%`,
                '--actor-w': `${place.w}%`,
                '--actor-w-narrow': `${Math.min(92, place.w * 1.8)}%`,
                transform: `translate(-50%, -50%) rotate(${place.rotate}deg) scale(${place.scale})`,
                opacity: place.opacity,
                pointerEvents: place.opacity < 0.05 ? 'none' : undefined
              } as CSSProperties;
              return (
                <div key={actor.key} className={`wk-deck-actor${actor.bare ? ' is-bare' : ''}`} style={style}
                  aria-hidden={place.opacity < 0.05 ? true : undefined}>
                  {actor.content}
                </div>
              );
            })}
          </div>
        )}
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
