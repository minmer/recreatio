/**
 * DER ANTRIEB EINER PRÄSENTATION (0085) — aus der Startseite des Altbestands
 * übernommen (`legacy/public/pages/FrontPage.tsx`), Regel für Regel. Neu ist
 * nur, dass er nicht das Fenster rollt, sondern eine ZAHL bewegt: die Stelle
 * `s` auf der Achse der Szenen. Daraus zeichnet die Bühne alles Weitere —
 * so läuft derselbe Antrieb auf der Seite, im Kasten des Editors und auf dem
 * ganzen Bildschirm eines Vortrags.
 *
 * <b>Zwei Bewegungen, und sie fühlen sich mit Absicht verschieden an:</b>
 * INNERHALB einer Szene läuft es frei — der Weg der Hand wird zur Strecke,
 * ein kurzer Nachlauf glättet das Rad, und ein Auslauf mit Magnet sucht sich
 * einen Schritt. ZWISCHEN zwei Szenen wird gesprungen: eine Geste, ein
 * Sprung; er muss etwas kosten (STEP_PUSH), er fängt mit der Geschwindigkeit
 * der Hand an (Hermite-Kurve) und läuft in seiner eigenen Zeit aus. Während er
 * läuft, wird nichts gesammelt — die Hand darf ihn lenken, nicht den nächsten
 * anzahlen.
 *
 * <b>Finger und Rad werden verschieden behandelt</b>, weil sie verschieden
 * sind: ein Finger hat eine Bildschirmhöhe Weg, ein Rad unendlich viel
 * (TOUCH_GAIN, ein kürzerer Nachlauf). Die Tastatur geht in ganzen Schritten.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';

import {
  betweenOf, glide, glideLead, glideSlope, lastOf, zoneIndexOf, type Zone
} from './presentationMotion';

/* Die Masse des Altbestands — dort an echten Trackpads, Rädern und Telefonen eingestellt. */
const STEP_VH = 60;
const STEP_VW = 34;
const STEP_WIDE = 900;
const GESTURE_GAP = 150;
const STEP_PUSH = 180;
const PUSH_FADE = 900;
const PUSH_KEEP = 0.7;
const FREE_MS = 220;
const FREE_TOUCH_MS = 90;
const TOUCH_GAIN = 2.1;
const COAST_STICK = 35;
const COAST_SLIDE = 150;
const COAST_MIN = 0.0004;
const MAGNET_HALF = 150;
const MAGNET_LEAD = 0.18;
const COAST_HAND = 300;
const TOUCH_MIN = 26;
const NOTCH_MS = 110;
const PULL = 0.4;

/** Tasten, die einem Bedienelement gehören — dort nimmt der Antrieb Leertaste und Eingabe nicht weg. */
const OWN_KEYS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON', 'A', 'SUMMARY']);

export interface DriveControl {
  /** Auf eine Stelle zufahren (ms: Dauer; 0 — sofort). */
  readonly go: (s: number, ms?: number) => void;
  /** Zum Anfang einer Szene. */
  readonly toScene: (index: number) => void;
  /** Ein Schritt vor oder zurück — in einer Szene von Schritt zu Schritt, an ihrem Rand zur nächsten. */
  readonly stepBy: (dir: 1 | -1) => void;
  readonly at: () => number;
  /** 0089 — der Weg, auf dem die Bühne gerade ist (die Kennungen ihrer Szenen) — für einen Vortrag, der dort weitergeht. */
  readonly route?: () => readonly string[];
}

export interface DriveOptions {
  readonly zones: readonly Zone[];
  /** Wie lange der Sprung IN Szene i dauert (ms) — Index wie die Szenen. */
  readonly durations: readonly number[];
  /** Wo Rad und Finger abgefangen werden: das ganze Fenster (die Seite) oder nur dieser Kasten. */
  readonly scope: 'window' | 'box';
  /** Tasten: im ganzen Fenster, nur wenn der Kasten den Fokus hat, oder gar nicht. */
  readonly keys: 'window' | 'focus' | 'none';
  /** Pfeile links/rechts und Eingabe wie vor/zurück — für einen Vortrag. */
  readonly presenter?: boolean;
  readonly reduced: boolean;
  /** Steht still an dieser Stelle (der Editor): keine Eingabe. */
  readonly frozen?: number | null;
  /** Wo es anfängt. */
  readonly start?: number;
  readonly onPaint: (s: number) => void;
  /**
   * 0089 — ÜBER DEN RAND: „dalej" nach der letzten Szene (oder zurück vor die
   * erste). Wohin es dann geht, weiss die Bühne (ein Weg zurück, hinaus) —
   * `key`: Taste, Knopf, Klick; `gesture`: Rad oder Finger.
   */
  readonly onBeyond?: (dir: 1 | -1, via: 'key' | 'gesture') => void;
}

/**
 * Der Antrieb. `box` ist der Kasten der Bühne (Mass für einen Schritt, und bei
 * `scope: 'box'` der Ort der Eingabe). Zurück kommt die Steuerung.
 */
export function usePresentationDrive(box: MutableRefObject<HTMLElement | null>, options: DriveOptions): MutableRefObject<DriveControl | null> {
  const control = useRef<DriveControl | null>(null);
  const opts = useRef(options);
  opts.current = options;

  /* Die Stelle überlebt das Neuaufsetzen (eine geänderte Szene im Editor). */
  const here = useRef<number>(options.start ?? 0);

  const { scope, keys, presenter = false, reduced } = options;
  const frozen = options.frozen ?? null;
  const shape = options.zones.map((z) => `${z.at}-${z.to}`).join(',');

  useEffect(() => {
    const node = box.current;
    if (node === null) return undefined;

    const zones = () => opts.current.zones;
    const last = () => lastOf(zones());
    const paintAt = (s: number) => { here.current = s; opts.current.onPaint(s); };

    if (frozen !== null) {
      paintAt(Math.min(last(), Math.max(0, frozen)));
      control.current = {
        go: (s) => paintAt(Math.min(last(), Math.max(0, s))),
        toScene: (i) => paintAt(zones()[i]?.at ?? 0),
        stepBy: () => undefined,
        at: () => here.current
      };
      return undefined;
    }

    let frame = 0;
    let target = Math.min(last(), Math.max(0, here.current));
    let fromS = target, toS = target, startedAt = 0, span = 0, lead = 0;
    let gliding = false, snapping = false;
    let coasting = false, vel = 0, coastAt = 0, coastDir = 1;
    let lastEvent = 0, touchAt = 0, touchTime = 0, speed = 0, push = 0;
    let stepPx = 400;

    const measure = () => {
      const h = Math.max(320, node.clientHeight || window.innerHeight);
      stepPx = Math.round(Math.max((h * STEP_VH) / 100, (Math.min(window.innerWidth, STEP_WIDE) * STEP_VW) / 100));
    };

    /** Wie lange der Sprung zwischen Szene i und i + 1 dauert. */
    const durationBetween = (i: number, j: number) => opts.current.durations[Math.max(i, j)] ?? 700;

    const tick = () => {
      frame = 0;
      const now = performance.now();

      if (gliding) {
        const k = span <= 0 ? 1 : Math.min(1, (now - startedAt) / span);
        paintAt(fromS + (toS - fromS) * glide(k, lead));
        if (k < 1) { frame = requestAnimationFrame(tick); return; }
        gliding = false;
        /* War die Hand beim Ende noch dran, rollt es aus — nur nach einem freien Lauf. */
        if (!snapping && now - lastEvent < COAST_HAND) {
          vel = speed / stepPx;
          coastDir = Math.sign(speed) || 1;
          coastAt = now;
          coasting = true;
          frame = requestAnimationFrame(tick);
        }
        /* Angekommen — und von der Geste ist nichts mehr übrig. */
        snapping = false;
        speed = 0;
        push = 0;
        return;
      }

      if (!coasting) return;

      /* Der Auslauf: an einem Schritt kurz, dazwischen lang — er sucht sich einen. */
      const dt = Math.min(64, now - coastAt);
      coastAt = now;
      const half = COAST_STICK + (COAST_SLIDE - COAST_STICK) * betweenOf(zones(), target);
      vel *= Math.pow(0.5, dt / half);

      const zone = zones()[zoneIndexOf(zones(), target)];
      let next = Math.min(zone.to, Math.max(zone.at, target + vel * dt));
      /* Und der nächste Schritt zieht — vorwärts schon ab knapp einem Drittel. */
      const aim = Math.min(zone.to, Math.max(zone.at, Math.round(next + coastDir * MAGNET_LEAD)));
      next += (aim - next) * (1 - Math.pow(0.5, dt / MAGNET_HALF));

      const arrived = Math.abs(vel) < COAST_MIN && Math.abs(aim - next) < 0.004;
      const edge = next === target && Math.abs(vel) >= COAST_MIN;
      target = arrived ? aim : next;
      paintAt(target);
      if (arrived || edge) { coasting = false; vel = 0; return; }
      frame = requestAnimationFrame(tick);
    };

    /** Auf eine Stelle zufahren — als Fortsetzung dessen, was die Hand tut (`hand` in px/ms). */
    const go = (to: number, hand: number, ms: number, snap: boolean) => {
      const next = Math.min(last(), Math.max(0, to));
      const now = performance.now();
      const running = gliding && span > 0
        ? (glideSlope(Math.min(1, (now - startedAt) / span), lead) * (toS - fromS)) / span
        : 0;

      target = next;
      snapping = snap;
      coasting = false;
      vel = 0;
      fromS = here.current;
      toS = target;
      span = opts.current.reduced ? 0 : ms;
      startedAt = now;
      gliding = true;

      if (span <= 0) { gliding = false; paintAt(toS); return; }

      /* Gezählt wird nur, was in die Richtung der Fahrt zeigt. */
      const reach = toS - fromS;
      const v = reach >= 0 ? Math.max(hand / stepPx, running, 0) : Math.min(hand / stepPx, running, 0);
      lead = glideLead(v, span, reach);
      if (frame === 0) frame = requestAnimationFrame(tick);
    };

    /** Den laufenden Sprung an die Hand heranziehen — ohne einen weiteren auszulösen. */
    const steer = (hand: number) => {
      if (!gliding || span <= 0) return;
      const now = performance.now();
      const k = Math.min(1, (now - startedAt) / span);
      const left = span * (1 - k);
      if (left < 80) return;
      const y = fromS + (toS - fromS) * glide(k, lead);
      const reach = toS - y;
      if (reach === 0) return;
      const was = (glideSlope(k, lead) * (toS - fromS)) / span;
      const want = reach > 0 ? Math.max(hand / stepPx, 0) : Math.min(hand / stepPx, 0);
      const v = was + (want - was) * PULL;
      fromS = y;
      startedAt = now;
      span = left;
      lead = glideLead(v, left, reach);
    };

    /** Eine Geste: innerhalb einer Szene frei, an ihrem Rand gesammelt bis zum Sprung. */
    const gesture = (px: number, dt: number, follow: number) => {
      const now = performance.now();
      const idle = now - lastEvent;
      const fresh = idle > GESTURE_GAP;
      lastEvent = now;

      const v = px / Math.max(4, dt);
      speed = fresh ? v : speed * 0.55 + v * 0.45;

      if (gliding && snapping) { steer(speed); return; }

      const list = zones();
      const index = zoneIndexOf(list, target);
      const zone = list[index];
      const want = target + px / stepPx;

      if (want >= zone.at - 1e-4 && want <= zone.to + 1e-4) {
        push = 0;
        go(want, speed, follow, false);
        return;
      }

      push *= Math.max(PUSH_KEEP, 1 - idle / PUSH_FADE);
      if (px * push < 0) push = 0;
      push += px;

      const dir = push > 0 ? 1 : -1;
      const edge = dir > 0 ? zone.to : zone.at;
      if (Math.abs(push) < STEP_PUSH) {
        if (Math.abs(edge - target) > 1e-4) go(edge, speed, follow, false);
        return;
      }

      push = 0;
      const next = list[index + dir];
      if (next === undefined) { opts.current.onBeyond?.(dir, 'gesture'); return; }
      /* Rückwärts landet man am ENDE der vorigen — dort, wo man sie verlassen hat. */
      go(dir > 0 ? next.at : next.to, speed, durationBetween(index, index + dir), true);
    };

    const stepBy = (dir: 1 | -1) => {
      const list = zones();
      const index = zoneIndexOf(list, target);
      const zone = list[index];
      const want = Math.round(target) + dir;
      if (want >= zone.at && want <= zone.to) { go(want, 0, 700, true); return; }
      const next = list[index + dir];
      if (next === undefined) { opts.current.onBeyond?.(dir, 'key'); return; }
      go(dir > 0 ? next.at : next.to, 0, durationBetween(index, index + dir), true);
    };

    /* -- Eingaben ----------------------------------------------------------------- */

    const inside = (event: Event): boolean => scope === 'window' || (event.target instanceof Node && node.contains(event.target));

    /** Rollt unter dem Zeiger etwas selbst (ein langer Baustein, ein Menü)? Dann darf es. */
    const rolls = (event: Event): boolean => {
      let el = event.target instanceof Element ? event.target : null;
      while (el !== null && el !== node && el !== document.body) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const style = getComputedStyle(el);
          if (style.overflowY === 'auto' || style.overflowY === 'scroll') return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onWheel = (event: WheelEvent) => {
      if (!inside(event) || rolls(event)) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      /* deltaMode: 0 Pixel, 1 Zeilen, 2 Seiten. */
      const unit = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? window.innerHeight : 1;
      const gap = performance.now() - lastEvent;
      gesture(event.deltaY * unit, gap > GESTURE_GAP ? NOTCH_MS : gap, FREE_MS);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!inside(event)) return;
      touchAt = event.touches[0]?.clientY ?? 0;
      touchTime = performance.now();
      lastEvent = 0;
      speed = 0;
      push = 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!inside(event) || rolls(event) || event.touches.length > 1) return;
      event.preventDefault();
      const y = event.touches[0]?.clientY ?? 0;
      const dy = touchAt - y;
      if (Math.abs(dy) < TOUCH_MIN) return;
      const now = performance.now();
      gesture(dy * TOUCH_GAIN, now - touchTime, FREE_TOUCH_MS);
      touchAt = y;
      touchTime = now;
    };

    const onKey = (event: KeyboardEvent) => {
      if (keys === 'none' || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      /* Im Kasten: nur, wenn er (seine Hülle) den Fokus hat — die Pfeile des Editors gehören sonst dem Editor. */
      const shell = node.closest('.pz') ?? node;
      if (keys === 'focus' && !(event.target instanceof Node && shell.contains(event.target))) return;
      const tag = event.target instanceof HTMLElement ? event.target.tagName : '';
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;
      const own = OWN_KEYS.has(tag) && (event.key === ' ' || event.key === 'Enter');
      const forward = event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !own)
        || (presenter && (event.key === 'ArrowRight' || (event.key === 'Enter' && !own)));
      const back = event.key === 'ArrowUp' || event.key === 'PageUp' || (presenter && event.key === 'ArrowLeft');
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        go(event.key === 'Home' ? 0 : last(), 0, 900, true);
        return;
      }
      if (!forward && !back) return;
      event.preventDefault();
      stepBy(forward ? 1 : -1);
    };

    const relayout = () => {
      coasting = false;
      vel = 0;
      measure();
      paintAt(here.current);
    };

    measure();
    target = Math.min(last(), Math.max(0, here.current));
    paintAt(target);

    control.current = {
      go: (s, ms = 700) => go(s, 0, ms, true),
      toScene: (i) => {
        const list = zones();
        const zone = list[Math.max(0, Math.min(list.length - 1, i))];
        if (zone === undefined) return;
        const from = zoneIndexOf(list, target);
        go(zone.at, 0, Math.abs(from - i) <= 1 ? durationBetween(from, i) : 900, true);
      },
      stepBy,
      at: () => here.current
    };

    const listen: Window | HTMLElement = scope === 'window' ? window : node;
    listen.addEventListener('wheel', onWheel as EventListener, { passive: false });
    listen.addEventListener('touchstart', onTouchStart as EventListener, { passive: true });
    listen.addEventListener('touchmove', onTouchMove as EventListener, { passive: false });
    if (keys !== 'none') window.addEventListener('keydown', onKey);
    window.addEventListener('resize', relayout, { passive: true });
    window.addEventListener('orientationchange', relayout, { passive: true });
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(relayout);
    watch?.observe(node);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      listen.removeEventListener('wheel', onWheel as EventListener);
      listen.removeEventListener('touchstart', onTouchStart as EventListener);
      listen.removeEventListener('touchmove', onTouchMove as EventListener);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', relayout);
      window.removeEventListener('orientationchange', relayout);
      watch?.disconnect();
    };
  }, [box, scope, keys, presenter, reduced, frozen, shape]);

  return control;
}
