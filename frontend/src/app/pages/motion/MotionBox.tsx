/**
 * 0107 — DIE BEWEGUNGEN ABSPIELEN (`motion.ts` sagt, welche; hier geschieht es).
 *
 * <b>Web Animations, nicht Klassen.</b> Ein Auftritt muss stehen bleiben
 * können, bevor er spielt (der Text ist noch nicht da, während sein Slajd
 * hereingleitet), genau dann loslaufen, wenn der Slajd erreicht ist, und
 * zurückgesetzt werden, wenn man ihn ganz verlassen hat — damit er beim
 * nächsten Kommen wieder spielt. Mit `element.animate()` ist das ein Anhalten,
 * ein `currentTime = 0` und ein `play()`; mit Klassen wäre es ein Umbauen des
 * Baums, und der Inhalt (ein halb ausgefülltes Formular) verlöre seinen Stand.
 *
 * <b>Wann ein Ding „da" ist</b>, sagt der Slajd (`SlidePhase`): `here` — sein
 * Slajd ist der jetzige; `near` — er ist zu sehen, aber nicht der jetzige (er
 * kommt oder geht); `away` — nicht zu sehen. Ausserhalb der Slajdy (eine Seite
 * mit Raster, eine Präsentation) fragt der Baustein den Browser, ob er im Bild
 * ist, und spielt seinen Auftritt einmal.
 *
 * <b>Weniger Bewegung</b> (System): nichts läuft; alles steht im letzten Bild.
 *
 * <b>2026-10-19 — nach dem Fortschritt</b> (`by`, in einer Szene einer
 * Präsentation): die Bewegung steht angehalten und bekommt bei jedem Bild der
 * Bühne die Stelle, die dem Fortschritt der Szene entspricht (`ShowClock`).
 */

import {
  createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject
} from 'react';

import { dashArray, dashOf, isOnce, keyframesOf, motionDef, timingOf, type MotionUse } from './motion';
import { ShowClock } from '../presentation/showContext';

export type Phase = 'here' | 'near' | 'away';

/** „Weniger Bewegung" im System (wie `usePrefersReducedMotion` im Deck — hier eigen, damit sich Deck und Bewegung nicht gegenseitig laden). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(query.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Der Stand des Slajds, auf dem etwas steht — `null`: nicht auf einem Slajd. */
export const SlidePhase = createContext<Phase | null>(null);

/**
 * Wo ein Ding gerade steht — vom Slajd, sonst vom Browser (im Bild oder nicht).
 * Ein Ding ohne Slajd, das nie im Bild war, gilt als `away`.
 */
export function usePhase(ref: RefObject<Element | null>): Phase {
  const deck = useContext(SlidePhase);
  const [seen, setSeen] = useState<Phase>('away');

  useEffect(() => {
    if (deck !== null) return undefined;
    const el = ref.current;
    if (el === null || typeof IntersectionObserver === 'undefined') { setSeen('here'); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) setSeen(entry.isIntersecting ? 'here' : 'away');
    }, { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [deck, ref]);

  return deck ?? seen;
}

/**
 * EINE BEWEGUNG AN EINEM ELEMENT, nach dem Stand seines Slajds.
 *
 * <code>
 *   enter   away → zurück aufs erste Bild, angehalten · here → spielt (einmal) · near → bleibt, wie es ist
 *   loop    here, near → läuft · away → angehalten
 * </code>
 *
 * `replay` — ausserhalb der Slajdy: ob ein Auftritt beim erneuten Hereinrollen
 * noch einmal spielt (auf einer Seite: nein — das wäre bei jedem Rollen ein Zappeln).
 */
export function useMotion(ref: RefObject<HTMLElement | null>, use: MotionUse, phase: Phase, replay: boolean): void {
  const reduced = useReducedMotion();
  const anim = useRef<Animation | null>(null);
  const played = useRef(false);
  const key = JSON.stringify(use);
  /* 2026-10-19 — folgt sie dem Fortschritt der Szene (und steht sie in einer)? */
  const clock = useContext(ShowClock);
  const by = use.by;
  const scrubbed = by !== null && clock !== null && typeof clock.progress === 'function';

  useEffect(() => {
    const el = ref.current;
    const def = motionDef(use.name);
    if (el === null || def === undefined || reduced || typeof el.animate !== 'function') return undefined;
    if (scrubbed) {
      /* Ein Durchgang, angehalten: jede Stelle des Fortschritts ist eine Stelle der Bewegung. */
      const timing = timingOf(use);
      const span = typeof timing.duration === 'number' ? Math.max(1, timing.duration) : 1000;
      const made = el.animate(keyframesOf(use), { ...timing, delay: 0, iterations: 1, direction: 'normal' });
      anim.current = made;
      made.pause();
      const follow = () => { made.currentTime = clock!.progress!(by!) * span; };
      follow();
      const off = clock!.subscribe(follow);
      return () => {
        off();
        made.cancel();
        if (anim.current === made) anim.current = null;
      };
    }
    const made = el.animate(keyframesOf(use), timingOf(use));
    anim.current = made;
    played.current = false;
    made.pause();
    made.currentTime = 0;
    return () => {
      made.cancel();
      if (anim.current === made) anim.current = null;
    };
    /* Die Bewegung als Text: dieselbe Bewegung in einem neuen Objekt baut nichts neu. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced, ref, scrubbed, clock]);

  useEffect(() => {
    const made = anim.current;
    const def = motionDef(use.name);
    if (made === null || def === undefined || scrubbed) return;
    if (isOnce(use)) {
      if (phase === 'away') {
        if (replay || !played.current) { made.pause(); made.currentTime = 0; played.current = false; }
      } else if (phase === 'here' && !played.current) {
        played.current = true;
        made.currentTime = 0;
        made.play();
      }
    } else if (phase === 'away') made.pause();
    else made.play();
  });
}

/** Ein Rahmen je Bewegung, der äussere zuerst — so stört der Auftritt die Schleife nicht. */
function MotionLayer({ use, phase, replay, last, className, style, children }: {
  use: MotionUse;
  phase: Phase;
  replay: boolean;
  last: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useMotion(ref, use, phase, replay);
  const dash = dashOf(use);
  return (
    <div
      ref={ref}
      className={`wk-motion is-${use.name}${className !== undefined && last ? ` ${className}` : ''}`}
      style={{ ...(last ? style : undefined), ...(dash === null ? {} : { strokeDasharray: dashArray(dash) }) }}
    >
      {children}
    </div>
  );
}

/**
 * EIN DING MIT SEINEN BEWEGUNGEN — ohne Bewegung ein einfacher Rahmen (oder
 * gar keiner, `bare`). `className`/`style` gehen an den innersten Rahmen.
 */
export function MotionBox({ motions, className, style, children, bare = false }: {
  motions: readonly MotionUse[];
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Ohne Bewegung kein eigenes Element. */
  bare?: boolean;
}) {
  const probe = useRef<HTMLDivElement | null>(null);
  const deck = useContext(SlidePhase);
  const phase = usePhase(probe);
  const replay = deck !== null;

  if (motions.length === 0) {
    return bare ? <>{children}</> : <div className={className} style={style}>{children}</div>;
  }

  let inner: ReactNode = children;
  for (let i = motions.length - 1; i >= 0; i -= 1) {
    inner = (
      <MotionLayer key={`${i}-${motions[i].name}`} use={motions[i]} phase={phase} replay={replay}
        last={i === motions.length - 1} className={className} style={style}>
        {inner}
      </MotionLayer>
    );
  }
  return <div ref={probe} className="wk-motion-root">{inner}</div>;
}

export default MotionBox;
