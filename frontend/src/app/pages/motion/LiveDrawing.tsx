/**
 * 2026-10-17 — DAS BILD ZUM ANFASSEN, GEZEICHNET (`liveModel.ts` sagt, was
 * darin ist, `liveRun.ts` rechnet es, `liveBuild.tsx` baut das Gerüst,
 * `LivePanel.tsx` die Bedienung).
 *
 * <b>React baut, die Schleife malt</b> — wie die Bühne der Präsentation: das
 * SVG entsteht einmal als Gerüst (jedes Teil ein Element mit `data-k`), und
 * jedes Bild schreibt die Schleife nur, was sich geändert hat, unmittelbar in
 * die Elemente. Ein Teil, dessen Namen sich nicht geändert haben, wird nicht
 * einmal gerechnet. Steht alles still (keine Simulation läuft, niemand zieht,
 * keine Uhr), läuft auch keine Schleife: ein Bild, das wartet, kostet nichts.
 *
 * <b>Leicht genug fürs Telefon</b>: keine Bibliothek, kein Canvas, kein
 * WebGL — SVG und ein paar hundert Zeilen. Die Schleife hält an, sobald das
 * Bild nicht zu sehen ist (seine Szene ist fort, es ist aus dem Bild gerollt).
 * Ein Griff ist mit dem Finger zu treffen (ein unsichtbarer Ring von 44 px),
 * und während er gezogen wird, rollt weder die Seite noch die Präsentation.
 *
 * <b>2026-10-18 — eine Welt</b>: ein Ding antippen wählt es (die Werkstatt
 * zeigt, was man an ihm einstellen darf), ziehen verschiebt es — EINE
 * Änderung je Ziehen, zurückzunehmen mit Strg+Z. Ein Rahmen mit Kamera:
 * Strg+Rad oder zwei Finger zoomen, ein Finger verschiebt (nur hineingezoomt
 * — sonst rollt die Seite), doppelt tippen zoomt hinein oder passt ein.
 *
 * <b>Weniger Bewegung</b> (System): nichts läuft von selbst; was man selbst
 * startet, läuft.
 */

import { useContext, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, type CSSProperties } from 'react';

import { toNum, truth } from './expr';
import type { Drawing } from './drawing';
import { usePhase, useReducedMotion } from './MotionBox';
import { useMotionPlan } from './DrawingView';
import { Program, type Said } from './liveRun';
import type { WorldShot } from './liveThings';
import { buildDrawing, type Camera, type Inst } from './liveBuild';
import { ControlView, digitsOf, propRange, rangeOf, shotOfText, withUnit, WorldPanel, type WorldAct } from './LivePanel';
import { ShowClock } from '../presentation/showContext';

/** Ein Zufall aus einem Samen (mulberry32) — dasselbe Bild für denselben Samen. */
export function seeded(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i += 1) a = Math.imul(a ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ein kurzer Schlüssel aus einem langen Text (FNV-1a) — für den gespeicherten Bau. */
const keyOf = (text: string): string => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
};

const ZOOM_MAX = 12;

export interface LiveDrawingProps {
  readonly drawing: Drawing;
  readonly identity: string;
  /** Ohne Bewegung, ohne Bedienung (im Streifen, als Vorschau). */
  readonly still?: boolean;
  readonly className?: string;
  /** Werte, die feststehen (Cogita: der gezogene Zufall; die Antwort, die gezeigt wird). */
  readonly fixed?: Readonly<Record<string, number>> | null;
  /** Der Same für `random` — sonst jedes Mal anders. */
  readonly seed?: string | null;
  /** Das Programm für den, der es braucht (Cogita liest daraus die Antwort). */
  readonly onProgram?: (program: Program) => void;
  /** Fehler in den Ausdrücken — für den Editor. */
  readonly onProblems?: (problems: Program['problems']) => void;
  /** Gleich loslaufen (Cogita zeigt nach der Antwort, was geschah). */
  readonly start?: boolean;
  /** Nur ansehen: die Bedienung steht still. */
  readonly locked?: boolean;
  /** 2026-10-18 — der Bau einer Welt, durch ihre Regeln nachgespielt (Cogita zeigt eine Antwort, wie sie geprüft wurde). */
  readonly replay?: WorldShot | null;
}

export function LiveDrawing({ drawing, identity, still = false, className, fixed = null, seed = null, onProgram, onProblems, start = false, locked = false, replay = null }: LiveDrawingProps) {
  const svg = useRef<SVGSVGElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const say = useRef<HTMLParagraphElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const phase = usePhase(svg);
  const reduced = useReducedMotion();
  const clock = useContext(ShowClock);
  const prefix = `lv${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fixedKey = fixed === null ? '' : JSON.stringify(fixed);
  const replayKey = replay === null ? '' : JSON.stringify(replay);
  const [, force] = useReducer((n: number) => n + 1, 0);

  const program = useMemo(
    () => new Program(drawing.live, { fixed: fixed ?? undefined, random: seed === null ? undefined : seeded(seed), replay }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identity, fixedKey, seed, replayKey]
  );
  /* Der Bau der Welt — ändert er sich (ein Ding mehr, eines weniger), wird das Gerüst neu gebaut. */
  const worldVersion = program.world?.version ?? 0;
  const selected = program.world?.selected ?? null;
  const built = useMemo(
    () => buildDrawing(drawing, program, prefix, still),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [program, prefix, still, worldVersion]
  );

  useMotionPlan(svg, built.plan, still || reduced, phase);

  /** Die Schleife und ihre Hebel — gebaut nach dem Gerüst, gehalten über die Bilder. */
  const engine = useRef<{
    wake: () => void; visible: (on: boolean) => void; input: (name: string, value: number) => void; press: (i: number) => void;
    act: (a: WorldAct) => void; refresh: () => void;
  } | null>(null);

  useLayoutEffect(() => {
    const root = svg.current;
    if (root === null) return undefined;
    const els = new Map<number, SVGElement>();
    root.querySelectorAll<SVGElement>('[data-k]').forEach((el) => els.set(Number(el.dataset.k), el));
    const env = program.env;
    const world = program.world;
    const shop = program.workshop;
    const readouts = program.controlValues;
    const buttons = program.controlSets;
    const shows = program.controlShows;
    const ctrlEls = new Map<number, HTMLElement>();
    panel.current?.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => ctrlEls.set(Number(el.dataset.c), el));

    const writeInst = (inst: Inst) => {
      const el = els.get(inst.k);
      if (el === undefined) return;
      const e = inst.env ?? env;
      if (inst.gate !== null && !inst.gate(e)) return;
      if (inst.scope === null) { inst.write(el, e); return; }
      const had = Object.prototype.hasOwnProperty.call(e, 'i');
      const was = [e.i, e.n] as const;
      e.i = inst.scope[0];
      e.n = inst.scope[1];
      inst.write(el, e);
      if (had || e === env) { e.i = was[0]; e.n = was[1]; } else { delete e.i; delete e.n; }
    };

    let lastStatus: string | null = null;
    let lastSaid: Said | null = null;
    let lastGoal = false;

    const syncControls = (changed: ReadonlySet<string> | null) => {
      const statusChanged = program.status !== lastStatus;
      lastStatus = program.status;
      program.controls.forEach((c, i) => {
        const el = ctrlEls.get(i);
        if (el === undefined) return;
        const show = shows[i];
        if (show !== null && (changed === null || show.reads.some((r) => changed.has(r)))) el.hidden = !truth(show.run(env));
        if ('var' in c && changed !== null && !changed.has(c.var) && c.type !== 'choice') return;
        switch (c.type) {
          case 'slider': {
            const spec = program.varOf(c.var);
            const value = program.value(c.var);
            const input = el.querySelector('input');
            if (input !== null && input.valueAsNumber !== value && document.activeElement !== input) input.value = String(value);
            const out = el.querySelector('output');
            const text = withUnit(value, digitsOf(spec?.step ?? null, c.digits), c.unit || spec?.unit || '');
            if (out !== null && out.textContent !== text) out.textContent = text;
            if (input !== null) input.setAttribute('aria-valuetext', text);
            return;
          }
          case 'number': {
            const input = el.querySelector('input');
            const value = program.value(c.var);
            if (input !== null && document.activeElement !== input && toNum(input.value) !== value) input.value = String(value);
            return;
          }
          case 'toggle': {
            const input = el.querySelector('input');
            if (input !== null) input.checked = truth(program.value(c.var));
            return;
          }
          case 'choice': {
            if (changed !== null && !changed.has(c.var)) return;
            const value = program.value(c.var);
            el.querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-pressed', String(c.options[n]?.value === value)));
            return;
          }
          case 'button': {
            if (!statusChanged && changed !== null) return;
            const running = program.status === 'running' || program.sleeping;
            if (c.do === 'toggle') {
              el.textContent = running ? 'Pauza' : (program.status === 'paused' ? 'Dalej' : c.label);
              el.setAttribute('aria-pressed', String(running));
            }
            if (c.do === 'run') el.toggleAttribute('data-on', running);
            return;
          }
          case 'readout': {
            const e = readouts[i];
            if (e === null) return;
            if (changed !== null && !e.reads.some((r) => changed.has(r))) return;
            const raw = e.run(env);
            const text = typeof raw === 'string' ? raw : withUnit(raw, c.digits ?? 2, c.unit);
            const out = el.querySelector('output');
            if (out !== null && out.textContent !== text) out.textContent = text;
            return;
          }
        }
      });
    };

    const singles = [...root.querySelectorAll<SVGGElement>('[data-var]')];
    const syncHandles = (changed: ReadonlySet<string> | null) => {
      singles.forEach((g) => {
        const name = g.dataset.var ?? '';
        if (changed !== null && !changed.has(name)) return;
        const spec = program.varOf(name);
        const value = program.value(name);
        g.setAttribute('aria-valuenow', String(Math.round(value * 1000) / 1000));
        g.setAttribute('aria-valuetext', withUnit(value, digitsOf(spec?.step ?? null, null), spec?.unit ?? ''));
        if (spec?.min != null) g.setAttribute('aria-valuemin', String(spec.min));
        if (spec?.max != null) g.setAttribute('aria-valuemax', String(spec.max));
      });
    };

    /* Die Werkstatt: Cofnij/Ponów, Start/Pauza, und die Werte des gewählten Dings. */
    let shownVersion = world?.version ?? 0;
    let shownSelected = world?.selected ?? null;
    const syncWorld = (changed: ReadonlySet<string> | null) => {
      const p = panel.current;
      if (world === null || p === null) return;
      p.querySelectorAll<HTMLButtonElement>('[data-w="undo"]').forEach((b) => { b.disabled = locked || !world.canUndo(); });
      p.querySelectorAll<HTMLButtonElement>('[data-w="redo"]').forEach((b) => { b.disabled = locked || !world.canRedo(); });
      p.querySelectorAll<HTMLButtonElement>('[data-w="toggle"]').forEach((b) => {
        const text = program.status === 'running' || program.sleeping ? 'Pauza' : 'Start';
        if (b.textContent !== text) b.textContent = text;
      });
      const t = world.selected === null ? undefined : world.get(world.selected);
      /* Die Werte des gewählten Dings — nach jeder Änderung (eines Werts der Welt oder des Bildes, von dem eine Grenze abhängen kann). */
      if (t === undefined || (changed !== null && changed.size === 0)) return;
      p.querySelectorAll<HTMLElement>('[data-prop]').forEach((el) => {
        const name = el.dataset.prop ?? '';
        const spec = t.kind.props.get(name)?.spec;
        if (spec === undefined) return;
        const value = toNum(t.env[name]);
        const r = propRange(spec, world.bounds(t, name), value);
        const text = withUnit(value, digitsOf(spec.step, null), spec.unit);
        const out = el.querySelector('output');
        if (out !== null && out.textContent !== text) out.textContent = text;
        el.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
          if (input.min !== String(r.min)) input.min = String(r.min);
          if (input.max !== String(r.max)) input.max = String(r.max);
          if (input.step !== String(r.step)) input.step = String(r.step);
          if (document.activeElement !== input && input.valueAsNumber !== value) input.value = String(value);
          if (input.type === 'range') input.setAttribute('aria-valuetext', text);
        });
      });
      p.querySelectorAll<HTMLElement>('[data-ro]').forEach((el) => {
        const i = Number(el.dataset.ro);
        const spec = t.kind.spec.readouts[i];
        if (spec === undefined) return;
        const raw = world.readout(t, i);
        const text = typeof raw === 'string' ? raw : withUnit(raw, spec.digits ?? 2, spec.unit);
        const out = el.querySelector('output');
        if (out !== null && out.textContent !== text) out.textContent = text;
      });
    };

    const syncSelection = () => {
      const now = world?.selected ?? null;
      root.querySelectorAll<SVGGElement>('[data-thing]').forEach((g) => g.classList.toggle('is-selected', g.dataset.thing === now));
    };

    /** Hat sich der Bau oder die Wahl geändert? Dann baut React neu (das Gerüst, die Werkstatt). */
    const syncShape = () => {
      if (world === null) return;
      if (world.selected !== shownSelected) { shownSelected = world.selected; syncSelection(); force(); }
      if (world.version !== shownVersion) { shownVersion = world.version; force(); }
    };

    const syncSaid = () => {
      const now = program.said();
      if (now !== lastSaid) {
        lastSaid = now;
        const p = say.current;
        if (p !== null) {
          p.textContent = now?.text ?? '';
          p.hidden = now === null || now.text === '';
          p.dataset.mood = now?.mood ?? 'info';
        }
      }
      const goal = program.goalReached();
      if (goal !== lastGoal) {
        lastGoal = goal;
        box.current?.classList.toggle('is-solved', goal);
      }
      for (const target of program.takeGos()) clock?.go(target);
    };

    /* Die Spuren: nach jedem Schritt der Simulation (oder ohne sie: nach der Uhr) ein Punkt. */
    let traced = false;
    const offs = built.traces.map((trace) => program.onSample(
      (e) => { if (trace.sample(e, toNum(e.t))) traced = true; },
      () => { trace.points.length = 0; trace.next = 0; traced = true; }
    ));

    let camDirty = false;

    const paint = () => {
      const changed = program.takeChanged();
      if (traced) { changed.add('#trace'); traced = false; }
      if (camDirty) { changed.add('#cam'); camDirty = false; }
      if (changed.size > 0) {
        for (const inst of built.insts) {
          for (const r of inst.reads) {
            if (changed.has(r)) { writeInst(inst); break; }
          }
        }
      }
      syncControls(changed);
      syncHandles(changed);
      syncWorld(changed);
      syncSaid();
    };

    /* Alles einmal schreiben — vor dem ersten Bild (Layout-Effekt). */
    program.settle();
    for (const inst of built.insts) writeInst(inst);
    program.takeChanged();
    syncControls(null);
    syncHandles(null);
    syncWorld(null);
    syncSelection();
    syncSaid();
    onProgram?.(program);

    let raf = 0;
    let last = 0;
    let visible = true;
    const ticking = !still && !reduced;

    type Gesture =
      | { readonly kind: 'handle'; readonly h: number; readonly pointer: number }
      | { readonly kind: 'thing'; readonly id: string; readonly pointer: number; readonly x0: number; readonly y0: number; moved: boolean; live: boolean }
      | { readonly kind: 'pan'; readonly cam: number; readonly pointer: number; last: readonly [number, number] };
    let gesture: Gesture | null = null;
    /* Zwei Finger auf einem Rahmen mit Kamera: zoomen. */
    const pointers = new Map<number, readonly [number, number]>();
    let pinch: { readonly cam: number; readonly dist: number; readonly z: number } | null = null;

    const frame = (now: number) => {
      raf = 0;
      if (!visible) { last = 0; return; }
      /* Höchstens 60 Bilder in der Sekunde — ein Schirm mit 120 Hz zeichnet dasselbe Bild zweimal, statt doppelt zu rechnen. */
      if (last !== 0 && now - last < 15 && gesture === null) { raf = requestAnimationFrame(frame); return; }
      const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      program.advance(dt, ticking);
      if (built.traces.length > 0 && program.sim === null && program.usesTime) {
        for (const trace of built.traces) if (trace.sample(env, toNum(env.time))) traced = true;
      }
      program.settle();
      paint();
      if (program.busy(ticking) || gesture !== null) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => {
      if (still) { program.settle(); paint(); return; }
      if (raf === 0) raf = requestAnimationFrame(frame);
    };

    /** Nach einer Änderung am Bau oder an der Wahl: rechnen, malen, weiterlaufen — und, wenn nötig, neu bauen lassen. */
    const changedWorld = () => {
      program.settle();
      paint();
      wake();
      syncShape();
    };

    const input = (name: string, value: number) => {
      if (program.set(name, value)) { program.settle(); paint(); wake(); }
    };

    const press = (i: number) => {
      const c = program.controls[i];
      if (c === undefined || c.type !== 'button') return;
      program.press(buttons[i], c.do, c.go);
      paint();
      wake();
    };

    /* -- Die Kamera ------------------------------------------------------------------------------- */

    const toLocal = (el: Element, x: number, y: number): readonly [number, number] | null => {
      const parent = (el.parentNode ?? el) as SVGGraphicsElement;
      const m = typeof parent.getScreenCTM === 'function' ? parent.getScreenCTM() : null;
      if (m === null) return null;
      const p = new DOMPoint(x, y).matrixTransform(m.inverse());
      return [p.x, p.y];
    };

    const camEl = (i: number): SVGRectElement | null => root.querySelector<SVGRectElement>(`[data-cam="${i}"]`);

    /** Die Kamera innerhalb dessen halten, was `view` zeigt (hineingezoomt darf man sich darin bewegen). */
    const clampCam = (c: Camera) => {
      const v = c.fit(env);
      const hw = Math.abs(v[2] - v[0]) / 2 * (1 - 1 / c.at.z);
      const hh = Math.abs(v[3] - v[1]) / 2 * (1 - 1 / c.at.z);
      c.at.x = Math.max(-hw, Math.min(hw, c.at.x));
      c.at.y = Math.max(-hh, Math.min(hh, c.at.y));
    };

    const camMoved = () => {
      for (const c of built.cameras) clampCam(c);
      box.current?.classList.toggle('is-zoomed', built.cameras.some((c) => c.at.z > 1.001));
      camDirty = true;
      paint();
    };

    /** Um einen Punkt der Zeichnung zoomen: was dort ist, bleibt dort. */
    const zoomAt = (i: number, z: number, local: readonly [number, number] | null) => {
      const c = built.cameras[i];
      if (c === undefined) return;
      const next = Math.max(1, Math.min(ZOOM_MAX, z));
      const p = local ?? [c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2] as const;
      const [wx, wy] = c.place.back(env, p[0], p[1]);
      c.at.z = next;
      const [nx, ny] = c.place.back(env, p[0], p[1]);
      c.at.x += wx - nx;
      c.at.y += wy - ny;
      if (next <= 1.001) { c.at.z = 1; c.at.x = 0; c.at.y = 0; }
      camMoved();
    };

    const camera = (cmd: 'in' | 'out' | 'fit') => {
      built.cameras.forEach((c, i) => {
        if (cmd === 'fit') { c.at.z = 1; c.at.x = 0; c.at.y = 0; camMoved(); return; }
        zoomAt(i, c.at.z * (cmd === 'in' ? 1.6 : 1 / 1.6), null);
      });
    };

    /* -- Die Werkstatt ------------------------------------------------------------------------------ */

    const storeKey = `lv-world:${keyOf(identity)}`;

    const act = (a: WorldAct) => {
      if (world === null || (locked && a.type !== 'cam' && a.type !== 'select')) return;
      switch (a.type) {
        case 'undo': shop?.undo(); break;
        case 'redo': shop?.redo(); break;
        case 'reset': shop?.reset(); break;
        case 'toggle': program.act('toggle'); break;
        case 'endEdit': shop?.endEdit(); return;
        case 'add': shop?.addThing(a.kind, a.parent === null ? null : world.get(a.parent) ?? null); break;
        case 'remove': { const t = world.get(a.id); if (t !== undefined) shop?.removeThing(t); break; }
        case 'copy': { const t = world.get(a.id); if (t !== undefined) shop?.copyThing(t); break; }
        case 'select': shop?.select(a.id); break;
        case 'edit': { const t = world.get(a.id); if (t !== undefined) shop?.editProp(t, a.prop, a.value); break; }
        case 'cam': camera(a.cmd); return;
        case 'import': shop?.load(a.shot); break;
        case 'save':
          try {
            localStorage.setItem(storeKey, JSON.stringify(program.worldSnapshot()));
            program.say('Zapisano układ (w tej przeglądarce).');
          } catch {
            program.say('Nie udało się zapisać — przeglądarka nie pozwala.', 'miss');
          }
          break;
        case 'load': {
          let text: string | null = null;
          try { text = localStorage.getItem(storeKey); } catch { text = null; }
          const shot = text === null ? null : shotOfText(text);
          if (shot === null) program.say('Nie ma zapisanego układu.', 'miss');
          else { shop?.load(shot); program.say('Wczytano zapisany układ.'); }
          break;
        }
      }
      changedWorld();
    };

    /* -- Ziehen, Antippen, Wählen -------------------------------------------------------------------- */

    const dragTo = (h: number, local: readonly [number, number]) => {
      const handle = built.handles[h];
      if (handle === undefined) return;
      const was = handle.scope === null ? null : [env.i, env.n] as const;
      if (handle.scope !== null) { env.i = handle.scope[0]; env.n = handle.scope[1]; }
      const [wx, wy] = handle.place.back(env, local[0], local[1]);
      program.set('px', wx);
      program.set('py', wy);
      const values = handle.set.map((a) => toNum(a.expr.run(env)));
      if (was !== null) { env.i = was[0]; env.n = was[1]; }
      handle.set.forEach((a, i) => program.set(a.name, values[i]));
      program.settle();
      paint();
    };

    /** Ein Ding an die Stelle des Fingers (Zeichnung) ziehen — in der Welt, in der es steht. */
    const dragThingTo = (id: string, el: Element, clientX: number, clientY: number) => {
      const t = world?.get(id);
      const place = built.worldPlace;
      if (t === undefined || place === null) return;
      const local = toLocal(el, clientX, clientY);
      if (local === null) return;
      const [wx, wy] = place.back(env, local[0], local[1]);
      shop?.dragThing(t, wx, wy);
      paint();
    };

    const closest = (target: EventTarget | null, selector: string): HTMLElement | SVGElement | null =>
      target instanceof Element ? target.closest<HTMLElement | SVGElement>(selector) : null;

    const onDown = (event: PointerEvent) => {
      if (event.button > 0) return;
      const grab = closest(event.target, '[data-drag]');
      const thing = closest(event.target, '[data-thing]');
      const cam = closest(event.target, '[data-cam]');
      if (world !== null && thing === null && grab === null && closest(event.target, '[data-tap]') === null && world.selected !== null) {
        shop?.select(null);
        changedWorld();
      }
      if (cam !== null) {
        pointers.set(event.pointerId, [event.clientX, event.clientY]);
        const i = Number(cam.dataset.cam);
        const c = built.cameras[i];
        if (pointers.size === 2 && c !== undefined) {
          const [a, b] = [...pointers.values()];
          pinch = { cam: i, dist: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: c.at.z };
          gesture = null;
          event.preventDefault();
          return;
        }
        if (c !== undefined && c.at.z > 1.001) {
          event.preventDefault();
          gesture = { kind: 'pan', cam: i, pointer: event.pointerId, last: [event.clientX, event.clientY] };
          root.setPointerCapture?.(event.pointerId);
          wake();
        }
        return;
      }
      if (locked) return;
      if (grab !== null) {
        event.preventDefault();
        const h = Number(grab.dataset.drag);
        gesture = { kind: 'handle', h, pointer: event.pointerId };
        root.setPointerCapture?.(event.pointerId);
        grab.classList.add('is-held');
        const local = toLocal(grab.firstElementChild ?? grab, event.clientX, event.clientY);
        if (local !== null) dragTo(h, local);
        wake();
        return;
      }
      if (thing !== null && world !== null) {
        event.preventDefault();
        const id = thing.dataset.thing ?? '';
        shop?.select(id);
        gesture = { kind: 'thing', id, pointer: event.pointerId, x0: event.clientX, y0: event.clientY, moved: false, live: false };
        root.setPointerCapture?.(event.pointerId);
        changedWorld();
      }
    };

    const onMove = (event: PointerEvent) => {
      if (pointers.has(event.pointerId)) pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pinch !== null && pointers.size === 2) {
        event.preventDefault();
        const [a, b] = [...pointers.values()];
        const el = camEl(pinch.cam);
        const mid = el === null ? null : toLocal(el, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        zoomAt(pinch.cam, pinch.z * (Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.dist), mid);
        return;
      }
      const g = gesture;
      if (g === null || event.pointerId !== g.pointer) return;
      event.preventDefault();
      if (g.kind === 'handle') {
        const grab = root.querySelector(`[data-drag="${g.h}"]`);
        const local = grab === null ? null : toLocal(grab.firstElementChild ?? grab, event.clientX, event.clientY);
        if (local !== null) dragTo(g.h, local);
        return;
      }
      if (g.kind === 'pan') {
        const c = built.cameras[g.cam];
        const el = camEl(g.cam);
        if (c === undefined || el === null) return;
        const before = toLocal(el, g.last[0], g.last[1]);
        const now = toLocal(el, event.clientX, event.clientY);
        g.last = [event.clientX, event.clientY];
        if (before === null || now === null) return;
        const [ax, ay] = c.place.back(env, before[0], before[1]);
        const [bx, by] = c.place.back(env, now[0], now[1]);
        c.at.x += ax - bx;
        c.at.y += ay - by;
        camMoved();
        return;
      }
      if (!g.moved) {
        if (Math.hypot(event.clientX - g.x0, event.clientY - g.y0) < 4) return;
        g.moved = true;
        const t = world?.get(g.id);
        g.live = t !== undefined && world !== null && world.canDrag(t) && shop?.gestureStart() === true;
        if (!g.live) { paint(); return; }
        root.querySelector(`[data-thing="${g.id}"]`)?.classList.add('is-held');
      }
      if (!g.live) return;
      const el = root.querySelector(`[data-thing="${g.id}"]`);
      if (el !== null) dragThingTo(g.id, el, event.clientX, event.clientY);
    };

    const onUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      const g = gesture;
      if (g === null || event.pointerId !== g.pointer) return;
      gesture = null;
      root.releasePointerCapture?.(event.pointerId);
      if (g.kind === 'handle') root.querySelector(`[data-drag="${g.h}"]`)?.classList.remove('is-held');
      if (g.kind === 'thing') {
        root.querySelector(`[data-thing="${g.id}"]`)?.classList.remove('is-held');
        const t = world?.get(g.id);
        if (!g.moved && t !== undefined && event.type === 'pointerup') shop?.tapThing(t);
        changedWorld();
        return;
      }
      wake();
    };

    const onWheel = (event: WheelEvent) => {
      const cam = closest(event.target, '[data-cam]') ?? (built.cameras.length === 1 ? closest(event.target, '[data-thing]') : null);
      /* Ohne Strg rollt die Seite (ein Trackpad zoomt mit Strg von selbst). */
      if (cam === null || !(event.ctrlKey || event.metaKey) || built.cameras.length === 0) return;
      event.preventDefault();
      const i = cam.dataset.cam === undefined ? 0 : Number(cam.dataset.cam);
      const c = built.cameras[i];
      const el = camEl(i);
      if (c === undefined || el === null) return;
      zoomAt(i, c.at.z * Math.exp(-event.deltaY * 0.0025), toLocal(el, event.clientX, event.clientY));
    };

    const onDouble = (event: MouseEvent) => {
      const cam = closest(event.target, '[data-cam]');
      if (cam === null) return;
      const i = Number(cam.dataset.cam);
      const c = built.cameras[i];
      if (c === undefined) return;
      event.preventDefault();
      if (c.at.z > 1.001) { c.at.z = 1; c.at.x = 0; c.at.y = 0; camMoved(); return; }
      zoomAt(i, 2.5, toLocal(cam, event.clientX, event.clientY));
    };

    const runTap = (el: Element) => {
      const tap = built.taps[Number((el as SVGElement).dataset.tap)];
      if (tap === undefined || tap.shape.tap === null) return;
      const was = tap.scope === null ? null : [env.i, env.n] as const;
      if (tap.scope !== null) { env.i = tap.scope[0]; env.n = tap.scope[1]; }
      program.press(tap.set, tap.shape.tap.do, tap.shape.tap.go);
      if (was !== null) { env.i = was[0]; env.n = was[1]; }
      paint();
      wake();
    };

    const onClick = (event: MouseEvent) => {
      if (locked) return;
      const el = closest(event.target, '[data-tap]');
      if (el !== null) { event.preventDefault(); runTap(el); }
    };

    /** Mit der Tastatur: Pfeile bewegen einen Griff (ein Ding), Eingabe und Leertaste drücken, Entf entfernt, Strg+Z nimmt zurück. */
    const onKey = (event: KeyboardEvent) => {
      if (locked) return;
      if (world !== null && (event.ctrlKey || event.metaKey) && !event.altKey && (event.key === 'z' || event.key === 'Z' || event.key === 'y' || event.key === 'Y')) {
        const field = event.target instanceof HTMLElement && (event.target.tagName === 'TEXTAREA' || (event.target.tagName === 'INPUT' && (event.target as HTMLInputElement).type === 'number'));
        if (field) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'y' || event.key === 'Y' || event.shiftKey) shop?.redo(); else shop?.undo();
        changedWorld();
        return;
      }
      const thing = closest(event.target, '[data-thing]');
      if (thing !== null && world !== null) {
        const t = world.get(thing.dataset.thing ?? '');
        if (t === undefined) return;
        if (event.key === 'Escape') { event.preventDefault(); shop?.select(null); changedWorld(); return; }
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); shop?.removeThing(t); changedWorld(); return; }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); shop?.select(t.id); shop?.tapThing(t); changedWorld(); return; }
        const place = built.worldPlace;
        if (place === null || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || !world.canDrag(t)) return;
        event.preventDefault();
        event.stopPropagation();
        const [sx, sy] = place.scale(env);
        const step = event.shiftKey ? 4 : 1;
        const dx = event.key === 'ArrowRight' ? 12 / sx : event.key === 'ArrowLeft' ? -12 / sx : 0;
        const dy = event.key === 'ArrowUp' ? 12 / sy : event.key === 'ArrowDown' ? -12 / sy : 0;
        if (shop?.gestureStart()) shop?.dragThing(t, toNum(t.env.x) + dx * step, toNum(t.env.y) + dy * step);
        changedWorld();
        return;
      }
      const tap = closest(event.target, '[data-tap]');
      if (tap !== null && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopPropagation();
        runTap(tap);
        return;
      }
      const grab = closest(event.target, '[data-drag]');
      if (grab === null || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const handle = built.handles[Number(grab.dataset.drag)];
      if (handle === undefined) return;
      const single = grab.dataset.var;
      if (single !== undefined) {
        const spec = program.varOf(single);
        const r = rangeOf(spec);
        const up = event.key === 'ArrowRight' || event.key === 'ArrowUp';
        const next = event.key === 'Home' ? r.min : event.key === 'End' ? r.max : program.value(single) + (up ? 1 : -1) * r.step * (event.shiftKey ? 10 : 1);
        input(single, next);
        return;
      }
      /* Ein Griff mit Rechnungen: der Finger einen kleinen Schritt weiter, von dort, wo der Griff steht. */
      const [wx, wy] = handle.anchor(env);
      const [sx, sy] = handle.place.scale(env);
      const unitX = handle.place.world ? 12 / sx : 4;
      const unitY = handle.place.world ? 12 / sy : 4;
      const dx = event.key === 'ArrowRight' ? unitX : event.key === 'ArrowLeft' ? -unitX : 0;
      const dy = event.key === 'ArrowUp' ? (handle.place.world ? unitY : -unitY) : event.key === 'ArrowDown' ? (handle.place.world ? -unitY : unitY) : 0;
      dragTo(Number(grab.dataset.drag), handle.place.at(env, wx + dx, wy + dy));
      wake();
    };

    /*
     * Ein Finger auf einem Ding, einem Griff (oder, hineingezoomt, auf dem Grund
     * der Kamera): die Seite darf nicht rollen. `touch-action` gilt in Chrome
     * nicht für die Teile eines SVG — darum hier, beim ersten Berühren.
     */
    const onTouchStart = (event: TouchEvent) => {
      if (locked || !event.cancelable) return;
      const hold = closest(event.target, '[data-thing], [data-drag]') !== null
        || (closest(event.target, '[data-cam]') !== null && (event.touches.length > 1 || built.cameras.some((c) => c.at.z > 1.001)));
      if (hold) event.preventDefault();
    };

    /** Mit der Tastatur zu einem Ding: es ist gewählt. */
    const onFocus = (event: FocusEvent) => {
      const thing = closest(event.target, '[data-thing]');
      if (thing === null || world === null || locked || world.selected === thing.dataset.thing) return;
      shop?.select(thing.dataset.thing ?? null);
      changedWorld();
    };

    const host = box.current;
    if (!still) {
      root.addEventListener('pointerdown', onDown);
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerup', onUp);
      root.addEventListener('pointercancel', onUp);
      root.addEventListener('click', onClick);
      root.addEventListener('dblclick', onDouble);
      root.addEventListener('wheel', onWheel, { passive: false });
      root.addEventListener('focusin', onFocus);
      root.addEventListener('touchstart', onTouchStart, { passive: false });
      host?.addEventListener('keydown', onKey);
    }

    /* In einer Präsentation: die Stelle in der Szene als `step`. */
    const offClock = clock === null ? () => undefined : clock.subscribe(() => {
      if (program.set('step', clock.step())) { program.settle(); paint(); wake(); }
    });
    if (clock !== null) program.set('step', clock.step());

    engine.current = {
      wake,
      visible: (on) => {
        visible = on;
        if (on) {
          if (ticking && program.sim?.auto === true && program.status === 'ready') program.act('run');
          if (start && program.status === 'ready') program.act('run');
          last = 0;
          wake();
        }
      },
      input,
      press,
      act,
      refresh: () => { syncWorld(null); syncSelection(); }
    };
    if (start && program.status === 'ready' && program.sim !== null) { program.act('run'); }
    wake();

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('click', onClick);
      root.removeEventListener('dblclick', onDouble);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('touchstart', onTouchStart);
      host?.removeEventListener('keydown', onKey);
      offClock();
      for (const off of offs) off();
      engine.current = null;
    };
  }, [built, program, still, reduced, clock, locked, start, onProgram, identity]);

  /* Ein anderes Ding gewählt: die Werkstatt ist neu gebaut — ihre Werte schreiben. */
  useLayoutEffect(() => { engine.current?.refresh(); }, [selected]);

  useEffect(() => { engine.current?.visible(phase !== 'away'); }, [phase, built]);

  useEffect(() => { onProblems?.(program.problems); }, [program, built, onProblems]);

  const sized = (drawing.max === null ? undefined : { '--an-max': `${drawing.max}rem` }) as CSSProperties | undefined;
  const showPanel = !still && (program.controls.length > 0 || program.world !== null || program.hasGoal()
    || drawing.live?.rules.some((r) => r.say !== '') === true || drawing.live?.sim?.events.some((e) => e.say !== '') === true);

  return (
    <div ref={box} className={`lv${program.panel === 'side' ? ' is-side' : ''}${className === undefined ? '' : ` ${className}`}`} style={sized}>
      <div className="lv-in">
        <svg ref={svg} className="lv-stage" viewBox={`0 0 ${drawing.w} ${drawing.h}`} role={drawing.alt === '' ? 'group' : 'img'}
          aria-label={drawing.alt === '' ? undefined : drawing.alt}>
          {built.defs.length > 0 && <defs>{built.defs}</defs>}
          {built.nodes}
        </svg>
        {showPanel && (
          <div ref={panel} className="lv-panel" data-pz-hold="">
            {program.controls.length > 0 && (
              <div className="lv-controls">
                {program.controls.map((c, i) => (
                  <ControlView key={i} c={c} i={i} program={program} locked={locked}
                    onSet={(name, value) => engine.current?.input(name, value)} onPress={(n) => engine.current?.press(n)} />
                ))}
              </div>
            )}
            <p ref={say} className="lv-say" role="status" aria-live="polite" hidden />
            {program.world !== null && (
              <WorldPanel program={program} selected={selected} version={worldVersion} locked={locked} cameras={built.cameras.length > 0}
                onAct={(a) => engine.current?.act(a)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveDrawing;
