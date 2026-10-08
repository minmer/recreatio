/**
 * DIE BÜHNE EINER PRÄSENTATION (0085) — Szenen, Bausteine darauf, eine Kamera.
 *
 * <b>React baut, der Antrieb malt.</b> Was auf der Bühne steht, entsteht
 * einmal (und neu, wenn sich die Präsentation ändert); was sich bewegt —
 * Deckkraft, Lage, Grösse, die Kamera —, schreibt `paint(s)` bei jedem Bild
 * unmittelbar in die Elemente, wie die Startseite des Altbestands es mit ihren
 * Variablen tat. Sechzig Mal in der Sekunde neu zu zeichnen hiesse, jeden
 * Kalender und jedes Formular darauf sechzigmal neu zu bauen.
 *
 * <b>Drei Orte, dieselbe Bühne:</b> die Seite (`page` — unter der Kopfleiste,
 * das Rad gehört ihr), ein Kasten (`box` — die Vorschau und die Leinwand des
 * Editors, auf Wunsch stehend an einer Stelle) und der ganze Bildschirm
 * (`present` — ein Vortrag: Pfeile, Klick, Fernbedienung).
 *
 * <b>Wo ein Baustein steht</b>: in seiner Szene (ein Platz) — dann kommt und
 * geht er mit ihr, wandert mit ihrer Betonung und fliegt mit ihrer Kamera; oder
 * über den Szenen (er wandert) — dann zwischen der Szene, auf der er zuerst
 * steht, und der nächsten, damit ein Kreis über den Vierteln und unter dem
 * Text des letzten Bildes liegen kann.
 */

import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type MutableRefObject, type ReactNode
} from 'react';

import {
  ASPECT, FONT_FACES, ORIGIN_AT, placeFor, resolveColor, travels,
  type Place, type Piece, type Scene, type Show
} from './presentation';
import {
  activeScene, arriveProgress, arriveStyle, betweenOf, clamp01, depthFade, emphasisOf, EMPHASIS, enteredOf, flightCurve,
  growAt, journeyAt, panAt, sceneState, scatterWords, walkOf, yieldOf, zonesOf, type Stepped, type Zone
} from './presentationMotion';
import { ShowDark } from './showContext';
import { usePrefersDark, usePrefersReducedMotion } from './SlideDeck';
import { addressWithSlide, anchorOf, imageUrl, resolveTheme, slideInAddress, type Layer, type Theme } from './slides';
import { usePresentationDrive, type DriveControl } from './usePresentationDrive';

export interface ShowPiece {
  readonly key: string;
  readonly kind: string;
  readonly label: string;
  readonly piece: Piece;
  readonly content: ReactNode;
}

export type ShowMode = 'page' | 'box' | 'present';

/** Ein Baustein, wie die Bühne ihn hält: wo er hingehört und wo er steht. */
interface Placed {
  readonly key: string;
  readonly kind: string;
  readonly label: string;
  readonly piece: Piece;
  readonly content: ReactNode;
  /** Wandert er — oder gehört er einer Szene? */
  readonly travel: boolean;
  /** Seine Szene, wenn er einer gehört; bei einem wandernden die erste mit Platz. */
  readonly home: number;
  /** Je Szene (Index) sein Platz — für das Bild, das gerade gilt (hoch oder breit). */
  readonly places: ReadonlyMap<number, Place>;
  /** Steht er in der Tiefe seiner Szene (z ≠ 0)? */
  readonly deep: boolean;
}

/** Die Schriften eines Paares holen — einmal je Paar, wie eine Seite es auch tut. */
function useFonts(pair: keyof typeof FONT_FACES): void {
  useEffect(() => {
    const load = FONT_FACES[pair].load;
    if (load === null) return;
    const id = `pz-font-${pair}`;
    if (document.getElementById(id) !== null) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${load}&display=swap`;
    document.head.appendChild(link);
  }, [pair]);
}

function layerStyle(layer: Layer): CSSProperties {
  if (layer.kind === 'gradient') {
    const stops = layer.via ? `${layer.from}, ${layer.via}, ${layer.to}` : `${layer.from}, ${layer.to}`;
    return { background: `linear-gradient(${layer.angle}deg, ${stops})` };
  }
  if (layer.kind === 'image') {
    return layer.url === '' ? {} : {
      backgroundImage: `url(${JSON.stringify(imageUrl(layer.url))})`, backgroundSize: 'cover',
      backgroundPosition: layer.position, opacity: layer.opacity, mixBlendMode: layer.blend
    };
  }
  return {};
}

const plainClick = (event: React.MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export function PresentationView({
  show, pieces, theme, title = null, mode, frozen = null, startAt = null, boxAspect = null, virtual = null, extra, control, selected = null,
  onPick, onStage, onActive, onPresent, onExit
}: {
  show: Show;
  pieces: readonly ShowPiece[];
  /** `null` — automatisch: die Farben des Arbeitsplatzes, hell oder dunkel wie das Gerät. */
  theme: Theme | null;
  title?: string | null;
  mode: ShowMode;
  /** Der Editor: an dieser Stelle stehen bleiben (keine Eingabe). */
  frozen?: number | null;
  /** Hier anfangen (ein Vortrag dort, wo die Seite gerade stand). */
  startAt?: number | null;
  /** Im Kasten: dieses Seitenverhältnis (breit/hoch auf der Leinwand des Editors). */
  boxAspect?: number | null;
  /**
   * Der Editor: die Bühne in der Grösse eines echten Schirms (1440 × 810, ein
   * Telefon 390 × 760) aufbauen und verkleinert zeigen — sonst sähe die
   * Leinwand aus wie ein kleines Fenster, in dem Blasen über den Rand ragen,
   * die auf einem echten Schirm Platz haben.
   */
  virtual?: { readonly w: number; readonly h: number } | null;
  /** Für wen, und die Links — oben links, wenn es etwas zu sagen gibt. */
  extra?: ReactNode;
  control?: MutableRefObject<DriveControl | null>;
  selected?: string | null;
  onPick?: (key: string) => void;
  onStage?: (stage: HTMLDivElement | null) => void;
  onActive?: (index: number) => void;
  onPresent?: () => void;
  onExit?: () => void;
}) {
  const deviceDark = usePrefersDark();
  const look = resolveTheme(theme, deviceDark);
  const dark = look.mode === 'dark';
  const reduced = usePrefersReducedMotion();
  const faces = FONT_FACES[show.fonts];
  useFonts(show.fonts);

  const scenes = show.scenes;
  const zones: Zone[] = useMemo(() => zonesOf(scenes.map((sc) => sc.steps)), [scenes]);
  const changes = useMemo(() => scenes.map((sc) => sc.change), [scenes]);
  const keeps = useMemo(() => scenes.map((sc) => sc.keep), [scenes]);

  /* -- Die Grösse der Bühne ------------------------------------------------------- */

  const root = useRef<HTMLDivElement | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = viewport.current;
    if (node === null) return undefined;
    const measure = () => setRoom((was) => {
      const w = node.clientWidth, h = node.clientHeight;
      return was.w === w && was.h === h ? was : { w, h };
    });
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(node);
    return () => watch?.disconnect();
  }, []);

  const aspect = ASPECT[show.format];
  const fixed = aspect !== null;
  const size = (() => {
    if (virtual !== null) return { w: virtual.w, h: virtual.h };
    if (room.w === 0 || room.h === 0) return { w: room.w, h: room.h };
    if (aspect === null) return room;
    const w = Math.min(room.w, room.h * aspect);
    return { w: Math.round(w), h: Math.round(w / aspect) };
  })();
  const tall = !fixed && size.h > size.w;
  /* Wie stark die Bühne verkleinert gezeigt wird (nur mit `virtual`). */
  const shrink = virtual === null || room.w === 0 || room.h === 0 ? 1 : Math.min(room.w / virtual.w, room.h / virtual.h);

  /* -- Unter der Kopfleiste (auf der Seite) ------------------------------------------ */

  const [top, setTop] = useState(0);
  useEffect(() => {
    if (mode !== 'page') return undefined;
    const header = document.querySelector<HTMLElement>('.wk-top');
    const measure = () => setTop(header?.getBoundingClientRect().height ?? 0);
    measure();
    const watch = header !== null && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (header !== null) watch?.observe(header);
    document.body.classList.add('has-pz');
    return () => { watch?.disconnect(); document.body.classList.remove('has-pz'); };
  }, [mode]);

  /* Ein Vortrag nimmt den ganzen Bildschirm — und gibt ihn mit Esc zurück. */
  const exit = useRef(onExit);
  exit.current = onExit;
  useEffect(() => {
    if (mode !== 'present') return undefined;
    const node = root.current;
    node?.requestFullscreen?.().catch(() => undefined);
    const onChange = () => { if (document.fullscreenElement === null) exit.current?.(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') exit.current?.(); };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement !== null) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, [mode]);

  /* -- Wer wo steht ------------------------------------------------------------------ */

  const indexOf = useMemo(() => new Map(scenes.map((sc, i) => [sc.key, i])), [scenes]);

  const placed: Placed[] = useMemo(() => pieces.flatMap((one): Placed[] => {
    const places = new Map<number, Place>();
    for (const [key, place] of Object.entries(one.piece.places)) {
      const at = indexOf.get(key);
      if (at !== undefined) places.set(at, placeFor(place, tall));
    }
    if (places.size === 0) return [];
    const home = Math.min(...places.keys());
    const travel = travels(one.piece) || places.size > 1;
    return [{
      key: one.key, kind: one.kind, label: one.label, piece: one.piece, content: one.content,
      travel, home, places, deep: !travel && (places.get(home)?.z ?? 0) !== 0
    }];
  }), [pieces, indexOf, tall]);

  /* Die betonten Bausteine je Szene — für das Nachgehen, die Mitte und den Faden. */
  const stepped: Stepped[] = useMemo(() => placed.flatMap((one) => {
    if (one.travel) return [];
    const place = one.places.get(one.home)!;
    return place.step === null || !scenes[one.home]?.emphasis ? [] : [{ scene: one.home, step: place.step, x: place.x, y: place.y }];
  }), [placed, scenes]);

  const centres = useMemo(() => scenes.map((_, i) => {
    const own = stepped.filter((one) => one.scene === i);
    if (own.length === 0) return null;
    return { x: own.reduce((n, one) => n + one.x, 0) / own.length, y: own.reduce((n, one) => n + one.y, 0) / own.length, count: own.length };
  }), [scenes, stepped]);

  const words = useMemo(() => scenes.map((sc) => (sc.words === null ? [] : scatterWords(sc.words, sc.depth.perspective))), [scenes]);

  /** Der Fluchtpunkt einer Szene: dort, wo ihr tiefster Baustein steht (Altbestand: der Satz). */
  const focus = useMemo(() => scenes.map((_, i) => {
    let deepest: Place | null = null;
    for (const one of placed) {
      if (one.travel || one.home !== i || !one.deep) continue;
      const place = one.places.get(i)!;
      if (deepest === null || place.z < deepest.z) deepest = place;
    }
    return deepest === null ? { x: 50, y: 50 } : { x: deepest.x, y: deepest.y };
  }), [scenes, placed]);

  /* -- Malen ------------------------------------------------------------------------- */

  const sceneEls = useRef<(HTMLElement | null)[]>([]);
  const contentEls = useRef<(HTMLDivElement | null)[]>([]);
  const camEls = useRef<(HTMLDivElement | null)[]>([]);
  const hintEls = useRef<(HTMLParagraphElement | null)[]>([]);
  const wordEls = useRef<(HTMLSpanElement | null)[][]>([]);
  const pieceEls = useRef(new Map<string, HTMLDivElement | null>());
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  const paintRef = useRef<(s: number) => void>(() => undefined);
  paintRef.current = (s: number) => {
    const walk = walkOf(s);
    const between = betweenOf(zones, s);
    const pan = reduced ? { x: 0, y: 0 } : panAt(zones, stepped, walk);
    const states = scenes.map((_, i) => sceneState(zones, i, s, changes, reduced, keeps));
    const cams = scenes.map((sc, i) => (states[i].flown && !reduced ? sc.depth.travel * flightCurve(states[i].pOut, sc.depth.linger) : 0));

    scenes.forEach((sc, i) => {
      const el = sceneEls.current[i];
      if (el === null || el === undefined) return;
      const st = states[i];
      if (!st.visible) {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.setAttribute('aria-hidden', 'true');
        return;
      }
      el.style.visibility = 'visible';
      el.removeAttribute('aria-hidden');
      el.style.opacity = String(st.opacity);
      el.style.transform = st.x === 0 && st.y === 0 && st.scale === 1 ? '' : `translate3d(${st.x}%, ${st.y}%, 0) scale(${st.scale})`;
      el.style.filter = st.dim > 0 ? `brightness(${1 - st.dim})` : '';
      el.style.zIndex = String(10 * (i + 1) + (st.above ? 12 : 0));

      const content = contentEls.current[i];
      if (content !== null && content !== undefined) {
        const k = centres[i] === null ? 0 : tall ? sc.follow.tall : sc.follow.wide;
        const grow = reduced ? 1 : growAt(sc.grow, zones[i], s);
        content.style.transform = k === 0 && grow === 1 ? '' : `translate3d(${pan.x * k}%, ${pan.y * k}%, 0) scale(${grow})`;
      }

      const cam = camEls.current[i];
      if (cam !== null && cam !== undefined) {
        cam.style.transform = `translateZ(${cams[i]}px)`;
        const p = sc.depth.perspective;
        (wordEls.current[i] ?? []).forEach((w, n) => {
          const spot = words[i][n];
          if (w !== null && spot !== undefined) w.style.opacity = String(spot.alpha * depthFade(spot.z + cams[i], p));
        });
      }

      const hint = hintEls.current[i];
      if (hint !== null && hint !== undefined) hint.style.opacity = String((1 - clamp01((st.pOut - 0.05) / 0.4)) * st.pIn);
    });

    for (const one of placed) {
      const el = pieceEls.current.get(one.key);
      if (el === null || el === undefined) continue;
      let place: Place;
      let opacity = 1, dx = 0, dy = 0, scale = 1, f = 0, z = 0;

      if (one.travel) {
        const j = journeyAt(one.places, zones, s, one.piece.ease, one.piece.hold);
        if (j === null || j.presence <= 0) { el.style.visibility = 'hidden'; el.style.pointerEvents = 'none'; continue; }
        place = j.place;
        if (j.arriving !== null) {
          const pIn = enteredOf(zones[j.arriving], s);
          const a = arriveStyle(one.piece.arrive, arriveProgress(pIn, one.piece.delay, one.piece.span), place, reduced, one.piece.origin);
          opacity = a.opacity; dx = a.x; dy = a.y; scale = a.scale;
        } else if (j.presence < 1) {
          opacity = j.presence;
        }
      } else {
        place = one.places.get(one.home)!;
        const st = states[one.home];
        if (st === undefined || !st.visible) { el.style.visibility = 'hidden'; el.style.pointerEvents = 'none'; continue; }
        const a = arriveStyle(one.piece.arrive, arriveProgress(st.pIn, one.piece.delay, one.piece.span), place, reduced, one.piece.origin);
        opacity = a.opacity; dx = a.x; dy = a.y; scale = a.scale;

        const sc = scenes[one.home];
        if (place.step !== null && sc.emphasis) {
          f = emphasisOf(zones[one.home], place.step, walk);
          const inZone = s >= zones[one.home].at && s <= zones[one.home].to;
          const dip = inZone ? between : 0;
          opacity *= (EMPHASIS.rest + (1 - EMPHASIS.rest) * f) * (1 - EMPHASIS.dip * dip);
          scale *= 1 + EMPHASIS.grow * f;
          const centre = centres[one.home];
          if (centre !== null && centre.count >= 2 && !reduced) {
            const away = yieldOf(place, centre);
            const push = 1 - f + 0.6 * dip;
            dx += away.x * push;
            dy += away.y * push;
          }
        }
        if (one.deep) {
          z = place.z;
          opacity *= depthFade(place.z + cams[one.home], scenes[one.home].depth.perspective);
        }
      }

      opacity *= place.opacity;
      const pin = ORIGIN_AT[one.piece.origin];
      el.style.visibility = opacity <= 0.001 ? 'hidden' : 'visible';
      el.style.left = `${place.x + dx}%`;
      el.style.top = `${place.y + dy}%`;
      el.style.width = place.max === null ? `${place.w}%` : `min(${place.w}%, ${place.max}rem)`;
      el.style.height = place.h === null ? '' : `${place.h}%`;
      el.style.opacity = String(opacity);
      el.style.transform = `translate(${-pin.x * 100}%, ${-pin.y * 100}%)${z !== 0 ? ` translateZ(${z}px)` : ''}${place.rotate !== 0 ? ` rotate(${place.rotate}deg)` : ''} scale(${place.scale * scale})`;
      el.style.setProperty('--pz-f', f.toFixed(3));
      el.style.zIndex = one.travel
        ? String(one.piece.layer >= 10 ? 2000 + one.piece.layer : 10 * (one.home + 1) + 5 + one.piece.layer)
        : String(Math.max(0, Math.round(20 + one.piece.layer * 2 + f)));
      el.style.pointerEvents = opacity > 0.3 ? 'auto' : 'none';
    }

    const now = activeScene(zones, s);
    if (now !== activeRef.current) {
      activeRef.current = now;
      setActive(now);
    }

    /* Die Leiste nimmt die Farben der Szene, die dran ist. */
    const node = root.current;
    const colors = scenes[now]?.colors;
    if (node !== null) {
      node.style.setProperty('--pz-chrome-ink', resolveColor(colors?.ink ?? null, dark) ?? 'var(--pz-ink)');
      node.style.setProperty('--pz-chrome-ground', resolveColor(colors?.ground ?? null, dark) ?? 'var(--pz-ground)');
    }
  };

  /* -- Der Antrieb ------------------------------------------------------------------- */

  const [start] = useState(() => {
    if (startAt !== null) return startAt;
    if (mode !== 'page') return 0;
    const n = slideInAddress(window.location.hash);
    return n === null ? 0 : zones[Math.min(n, zones.length - 1)]?.at ?? 0;
  });

  const drive = usePresentationDrive(stage, {
    zones,
    durations: scenes.map((sc) => sc.duration),
    scope: mode === 'page' ? 'window' : 'box',
    keys: mode === 'box' ? 'focus' : 'window',
    presenter: mode === 'present',
    reduced,
    frozen,
    start,
    onPaint: (s) => paintRef.current(s)
  });

  useEffect(() => { if (control !== undefined) control.current = drive.current; });

  /* Nach jedem Bauen: an derselben Stelle neu malen (neue Elemente kennen ihre Lage noch nicht). */
  useLayoutEffect(() => { paintRef.current(drive.current?.at() ?? frozen ?? start); });

  useEffect(() => { onActive?.(active); }, [active, onActive]);

  /* Die Adresse folgt der Szene — ohne Eintrag im Verlauf (wie bei den Slajdy). */
  useEffect(() => {
    if (mode !== 'page' || scenes.length === 0) return;
    const next = addressWithSlide(window.location.hash, active);
    if (window.location.hash !== next) window.history.replaceState(window.history.state, '', next);
  }, [mode, active, scenes.length]);

  useEffect(() => {
    if (mode !== 'page') return undefined;
    const onHash = () => {
      const n = slideInAddress(window.location.hash) ?? 0;
      if (n !== activeRef.current && n < scenes.length) drive.current?.toScene(n);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [mode, scenes.length, drive]);

  useEffect(() => { onStage?.(stage.current); return () => onStage?.(null); }, [onStage]);

  /* -- Klicks: Verweise auf Szenen, im Vortrag weiter, im Editor wählen --------------- */

  const anchors = useMemo(() => new Map(scenes.map((sc, i) => [anchorOf(sc.label), i])), [scenes]);

  const onStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!plainClick(event)) return;
    const target = event.target as HTMLElement;
    const piece = target.closest<HTMLElement>('[data-pz-piece]');
    if (onPick !== undefined) {
      event.preventDefault();
      if (piece !== null) onPick(piece.dataset.pzPiece ?? '');
      return;
    }
    const link = target.closest('a');
    if (link !== null) {
      const href = link.getAttribute('href') ?? '';
      if (href.startsWith('#') && !href.startsWith('#/')) {
        const index = anchors.get(href.slice(1).toLowerCase());
        if (index !== undefined) { event.preventDefault(); drive.current?.toScene(index); }
      }
      return;
    }
    if (mode === 'present' && target.closest('button, input, select, textarea, label, summary, [role="button"]') === null) {
      drive.current?.stepBy(1);
    }
  };

  /* -- Zeichnen ---------------------------------------------------------------------- */

  const vars = {
    '--pz-accent': look.accent,
    '--pz-ink': look.ink,
    '--pz-ground': look.ground,
    '--pz-muted': look.muted,
    '--pz-paper': look.ground,
    '--pz-display': faces.display,
    '--pz-text': faces.text,
    '--pz-ui': faces.ui,
    ...(mode === 'page' ? { top: `${top}px` } : {}),
    ...(mode === 'box' && boxAspect !== null ? { aspectRatio: String(boxAspect), height: 'auto' } : {})
  } as CSSProperties;

  const sceneVars = (sc: Scene): CSSProperties => {
    const c = sc.colors;
    const out: Record<string, string> = {};
    if (c !== null) {
      for (const key of ['accent', 'ink', 'muted'] as const) {
        const v = resolveColor(c[key], dark);
        if (v !== null) out[`--pz-${key}`] = v;
      }
      const g = resolveColor(c.ground, dark);
      if (g !== null) out['--pz-scene-ground'] = g;
    }
    return out as CSSProperties;
  };

  const pieceView = (one: Placed) => {
    const p = one.piece;
    const fill = resolveColor(p.fill, dark);
    const ink = resolveColor(p.ink, dark);
    const accent = resolveColor(p.accent, dark);
    const pin = ORIGIN_AT[p.origin];
    const media = p.media;
    const mediaEl = media === null ? null : (
      <div className={`pz-media is-${media.fit}${media.fade ? ' is-fade' : ''} at-${media.side}`} aria-hidden="true" style={{
        backgroundImage: `url(${JSON.stringify(imageUrl(media.url))})`,
        backgroundSize: media.fit === 'cover' ? 'cover' : media.max === null ? `${media.size}% auto` : `min(${media.size}%, ${media.max}rem) auto`,
        backgroundPosition: media.at,
        opacity: media.opacity
      }} />
    );
    return (
      <div
        key={one.key}
        ref={(el) => { pieceEls.current.set(one.key, el); }}
        className={`pz-el skin-${p.skin} type-${p.type} kind-${one.kind}${one.travel ? ' is-travel' : ''}${selected === one.key ? ' is-selected' : ''}${p.layer < 0 ? ' is-under' : ''}`}
        data-pz-piece={one.key}
        style={{
          visibility: 'hidden', transformOrigin: `${pin.x * 100}% ${pin.y * 100}%`,
          ...(accent === null ? {} : { '--pz-accent': accent } as CSSProperties)
        }}
      >
        <div
          className={`pz-box align-${p.align} valign-${p.valign}${media === null ? '' : ` has-media media-${media.side}`}`}
          style={{ ...(fill === null ? {} : { background: fill }), ...(ink === null ? {} : { color: ink, '--pz-box-ink': ink } as CSSProperties) }}
        >
          {media !== null && media.side !== 'after' && mediaEl}
          <div className="pz-body">{one.content}</div>
          {media !== null && media.side === 'after' && mediaEl}
        </div>
      </div>
    );
  };

  const threadOf = (i: number) => {
    const sc = scenes[i];
    if (sc.thread === 'none') return null;
    const points = stepped.filter((one) => one.scene === i).sort((a, b) => a.step - b.step);
    if (points.length < 2) return null;
    return (
      <svg className={`pz-thread is-${sc.thread}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points.map((one) => `${one.x},${one.y}`).join(' ')} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  };

  return (
    <ShowDark.Provider value={dark}>
      <div
        ref={root}
        className={`pz is-${mode} is-${look.mode}${fixed ? ' is-fixed' : ''}${tall ? ' is-tall' : ''}${onPick !== undefined ? ' is-editing' : ''}`}
        style={vars}
        tabIndex={mode === 'box' && frozen === null ? 0 : undefined}
        aria-label={title ?? undefined}
      >
        {show.nav === 'labels' && scenes.length > 1 && (
          <nav className="pz-nav" aria-label="Sceny">
            {scenes.map((sc, i) => (
              <button key={sc.key} type="button" className={active === i ? 'is-active' : ''} aria-current={active === i ? 'true' : undefined}
                onClick={() => drive.current?.toScene(i)}>
                {sc.label || `${i + 1}`}
              </button>
            ))}
          </nav>
        )}

        <div className="pz-viewport" ref={viewport}>
          {/* Verkleinert steht die Fassung frei in der Mitte: ihre Grösse folgt dem Platz und darf ihn nicht selbst bestimmen. */}
          <div className={virtual === null ? 'pz-frame' : 'pz-frame is-virtual'} style={virtual === null ? undefined : { width: `${size.w * shrink}px`, height: `${size.h * shrink}px` }}>
          <div
            className="pz-stage"
            ref={stage}
            style={{
              width: `${size.w}px`, height: `${size.h}px`,
              ...(virtual === null ? {} : { transform: `scale(${shrink})`, transformOrigin: '0 0' })
            }}
            onClick={onStageClick}
          >
            {scenes.length === 0 && <p className="pz-empty">Ta prezentacja nie ma jeszcze żadnej sceny.</p>}

            {scenes.map((sc, i) => {
              const own = placed.filter((one) => !one.travel && one.home === i);
              const deep = own.filter((one) => one.deep);
              const flat = own.filter((one) => !one.deep);
              const space = deep.length > 0 || words[i].length > 0;
              return (
                <section
                  key={sc.key}
                  ref={(el) => { sceneEls.current[i] = el; }}
                  className={`pz-scene${active === i ? ' is-active' : ''}`}
                  id={`scena-${anchorOf(sc.label) || i + 1}`}
                  aria-label={sc.label || undefined}
                  data-change={sc.change}
                  style={{ ...sceneVars(sc), visibility: 'hidden' }}
                >
                  <div className="pz-ground" aria-hidden="true" />
                  {sc.layers.map((layer, n) => (
                    <div key={n} className={`pz-layer is-${layer.kind}`} style={layerStyle(layer)} aria-hidden="true">
                      {layer.kind === 'bigtext' && (
                        <div className="pz-bigtext" style={{ opacity: layer.opacity }}>
                          {layer.lines.map((line, k) => <span key={k} style={layer.color ? { color: layer.color } : undefined}>{line}</span>)}
                        </div>
                      )}
                    </div>
                  ))}

                  {space && (
                    <div className="pz-space" style={{ perspective: `${sc.depth.perspective}px`, perspectiveOrigin: `${focus[i].x}% ${focus[i].y}%` }}>
                      <div className="pz-cam" ref={(el) => { camEls.current[i] = el; }}>
                        {words[i].map((w, n) => (
                          <span
                            key={n}
                            ref={(el) => { (wordEls.current[i] ??= [])[n] = el; }}
                            className="pz-word"
                            aria-hidden="true"
                            style={{
                              left: `${w.x}%`, top: `${w.y}%`, transform: `translate(-50%, -50%) translateZ(${w.z}px)`,
                              fontSize: `${w.size}cqmin`, ...(sc.words?.color ? { color: resolveColor(sc.words.color, dark) ?? undefined } : {})
                            }}
                          >
                            {sc.words?.prefix ? <b className="pz-word-pre">{sc.words.prefix}</b> : null}{w.word}
                          </span>
                        ))}
                        {deep.map(pieceView)}
                      </div>
                    </div>
                  )}

                  <div className="pz-content" ref={(el) => { contentEls.current[i] = el; }}>
                    {threadOf(i)}
                    {flat.map(pieceView)}
                  </div>

                  {sc.hint !== '' && (
                    <p className="pz-hint" aria-hidden="true" ref={(el) => { hintEls.current[i] = el; }}>
                      <span>{sc.hint}</span><i />
                    </p>
                  )}
                </section>
              );
            })}

            {placed.filter((one) => one.travel).map(pieceView)}
          </div>
          </div>
        </div>

        {show.nav === 'dots' && scenes.length > 1 && (
          <nav className="pz-dots" aria-label="Sceny">
            {scenes.map((sc, i) => (
              <button key={sc.key} type="button" className={active === i ? 'is-active' : ''} aria-label={sc.label || `Scena ${i + 1}`}
                aria-current={active === i ? 'true' : undefined} title={sc.label || undefined}
                onClick={() => drive.current?.toScene(i)} />
            ))}
          </nav>
        )}

        {extra !== undefined && mode === 'page' && <div className="pz-extra">{extra}</div>}

        {(mode === 'present' || (mode === 'page' && show.nav !== 'none')) && scenes.length > 0 && (
          <div className="pz-tools">
            <span className="pz-count" aria-live="polite">{active + 1} / {scenes.length}</span>
            <button type="button" aria-label="Wstecz" disabled={active === 0 && (drive.current?.at() ?? 0) <= 0} onClick={() => drive.current?.stepBy(-1)}>‹</button>
            <button type="button" aria-label="Dalej" onClick={() => drive.current?.stepBy(1)}>›</button>
            {mode === 'page' && onPresent !== undefined && (
              <button type="button" className="pz-present" onClick={onPresent} title="Pokaz na pełnym ekranie">Pokaz</button>
            )}
            {mode === 'present' && <button type="button" className="pz-present" onClick={onExit}>Zakończ</button>}
          </div>
        )}
      </div>
    </ShowDark.Provider>
  );
}

export default PresentationView;
