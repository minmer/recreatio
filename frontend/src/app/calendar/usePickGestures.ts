/**
 * WÄHLEN UND ZIEHEN IM KALENDER (2026-10-17) — mit der Maus und mit dem Finger.
 *
 * <code>
 *   Maus, im Leeren drücken und ziehen     ein Rechteck; was es berührt, ist gewählt (Strg/Umschalt: dazu)
 *   Maus, auf einem Termin drücken, ziehen  die Auswahl (oder dieser eine) wandert; loslassen auf einem
 *                                           Tag oder einer Stunde verschiebt — mit Strg/Alt: kopiert
 *   Finger, lange drücken                   ein Termin: gewählt; danach weiterziehen: das Rechteck (dazu)
 *   Finger, wischen                         rollt und blättert wie immer
 * </code>
 *
 * Gelesen wird am DOM, nicht an den Daten: wählbar ist, was `data-pick`
 * trägt (der Schlüssel des Termins), ein Ziel, was `data-day` trägt (der Tag;
 * mit `data-slot` eine Spalte mit Stunden — die Zeit kommt aus der Höhe).
 * So gilt dasselbe für Tag, Woche, Monat und Liste. Rechteck und Zettel am
 * Zeiger werden ohne React gezeichnet: beim Ziehen rendert der Kalender nur,
 * wenn sich die Auswahl ändert.
 *
 * Nach einem Ziehen oder langen Druck schluckt der Behälter den folgenden
 * Klick — sonst legte das Loslassen über einer leeren Stunde einen Termin an
 * oder öffnete den gewählten.
 */

import { useEffect, useRef } from 'react';

import { fromKey } from '../core/dayMath';
import type { PasteAt } from './EventPick';

/** So weit muss die Maus wandern, bevor aus dem Klick ein Ziehen wird (px). */
const DRAG_START = 6;

/** So weit darf der Finger wandern, und es bleibt ein langer Druck (px). */
const TOUCH_SLOP = 10;

/** So lange ist ein langer Druck (ms). */
const LONG_PRESS = 450;

/** So nah am Rand des Rasters rollt es beim Ziehen mit (px). */
const EDGE = 36;

export interface PickGestures {
  /** Ist etwas gewählt? (Dann wählt auch der Finger ohne langen Druck dazu — das macht `onOpen`.) */
  readonly isPicked: (key: string) => boolean;
  /** Die gewählten Schlüssel — gezogen wird die ganze Auswahl, wenn der gezogene Termin dazugehört. */
  readonly pickedKeys: () => readonly string[];
  /** Während des Rechtecks: was es gerade berührt (`null`: vorbei). `add`: zur Auswahl dazu. */
  readonly onLive: (keys: ReadonlySet<string> | null, add: boolean) => void;
  /** Das Rechteck ist fertig. */
  readonly onLasso: (keys: readonly string[], add: boolean) => void;
  /** Langer Druck auf einen Termin. */
  readonly onLongPress: (key: string) => void;
  /** Gezogen und fallen gelassen. */
  readonly onDrop: (keys: readonly string[], target: PasteAt, copy: boolean) => void;
  /** Die Worte am Zettel: „Przenieś 3 terminy → czw., 5.11, 10:15". */
  readonly dropLabel: (count: number, target: PasteAt | null, copy: boolean) => string;
}

type Mode = 'idle' | 'touch-wait' | 'lasso-wait' | 'drag-wait' | 'lasso' | 'drag';

const BLOCKERS = 'button, a, input, select, textarea, label, summary, [role="checkbox"], [contenteditable="true"]';

/** Wohin ein Punkt zeigt: ein Tag, und in einer Spalte mit Stunden auch die Zeit (auf Viertelstunden). */
export function targetAt(container: HTMLElement, x: number, y: number): PasteAt | null {
  const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-day]');
  if (hit == null || !container.contains(hit) || hit.dataset.day === undefined) return null;
  const day = fromKey(hit.dataset.day);
  if (!hit.hasAttribute('data-slot')) return { day };
  const box = hit.getBoundingClientRect();
  const hour = box.height / 24;
  const minutes = Math.max(0, Math.min(23 * 60 + 45, Math.round((((y - box.top) / hour) * 60) / 15) * 15));
  const at = new Date(day);
  at.setHours(0, minutes, 0, 0);
  return { day, at };
}

export function usePickGestures(enabled: boolean, gestures: PickGestures) {
  const ref = useRef<HTMLDivElement | null>(null);
  const now = useRef(gestures);
  now.current = gestures;
  /* Für das Wischen (Blättern): hat diese Berührung gewählt oder gezogen? */
  const used = useRef(false);

  useEffect(() => {
    const box = ref.current;
    if (box === null || !enabled) return undefined;

    let mode: Mode = 'idle';
    let pointer = -1;
    let start = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let add = false;
    let dragKeys: readonly string[] = [];
    let timer: number | undefined;
    let live = new Set<string>();
    let swallow = false;
    let scrollAt = 0;
    let scroller: HTMLElement | null = null;
    let scrolled = { el: 0, page: 0 };
    let overlay: HTMLDivElement | null = null;

    const draw = (className: string): HTMLDivElement => {
      if (overlay === null) {
        overlay = document.createElement('div');
        overlay.setAttribute('aria-hidden', 'true');
        box.appendChild(overlay);
      }
      overlay.className = className;
      return overlay;
    };
    const unDraw = () => { overlay?.remove(); overlay = null; };

    /* Wie weit seit dem Druck gerollt wurde — das Rechteck hängt am Inhalt, nicht am Bildschirm. */
    const rolled = () => (scroller?.scrollTop ?? 0) - scrolled.el + window.scrollY - scrolled.page;

    const lassoRect = () => {
      const y0 = start.y - rolled();
      return { left: Math.min(start.x, last.x), right: Math.max(start.x, last.x), top: Math.min(y0, last.y), bottom: Math.max(y0, last.y) };
    };

    const paintLasso = () => {
      const r = lassoRect();
      const at = box.getBoundingClientRect();
      const el = draw('wk-cal2-lasso');
      el.style.left = `${r.left - at.left}px`;
      el.style.top = `${r.top - at.top}px`;
      el.style.width = `${r.right - r.left}px`;
      el.style.height = `${r.bottom - r.top}px`;
      const hit = new Set<string>();
      for (const chip of box.querySelectorAll<HTMLElement>('[data-pick]')) {
        const c = chip.getBoundingClientRect();
        if (c.width === 0 || c.right < r.left || c.left > r.right || c.bottom < r.top || c.top > r.bottom) continue;
        hit.add(chip.dataset.pick!);
      }
      if (hit.size !== live.size || [...hit].some((k) => !live.has(k))) {
        live = hit;
        now.current.onLive(live, add);
      }
    };

    const paintDrag = (copy: boolean) => {
      const at = box.getBoundingClientRect();
      const el = draw('wk-cal2-dragnote');
      el.textContent = now.current.dropLabel(dragKeys.length, targetAt(box, last.x, last.y), copy);
      el.style.left = `${last.x - at.left + 14}px`;
      el.style.top = `${last.y - at.top + 14}px`;
    };

    /* Am Rand des Rasters (innen) rollt es mit — sanft, je Bewegung ein Stück; über den Köpfen der Tage nicht. */
    const roll = () => {
      if (scroller === null || Date.now() - scrollAt < 16) return;
      const r = scroller.getBoundingClientRect();
      if (last.x < r.left || last.x > r.right || last.y < r.top || last.y > r.bottom) return;
      const step = last.y < r.top + EDGE ? -14 : last.y > r.bottom - EDGE ? 14 : 0;
      if (step !== 0) { scroller.scrollTop += step; scrollAt = Date.now(); }
    };

    const reset = () => {
      window.clearTimeout(timer);
      timer = undefined;
      if (mode === 'lasso') now.current.onLive(null, add);
      if (mode === 'drag') box.classList.remove('is-dragging');
      mode = 'idle';
      pointer = -1;
      live = new Set();
      unDraw();
    };

    const begin = (next: 'lasso' | 'drag', e: PointerEvent) => {
      mode = next;
      used.current = true;
      if (e.pointerType === 'mouse') { try { box.setPointerCapture(e.pointerId); } catch { /* schon weg */ } }
      window.getSelection()?.removeAllRanges();
      if (next === 'drag') box.classList.add('is-dragging');
    };

    const onDown = (e: PointerEvent) => {
      if (mode !== 'idle' || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const target = e.target as Element | null;
      if (target === null) return;
      const chip = target.closest<HTMLElement>('[data-pick]');
      const blocker = target.closest(BLOCKERS);
      if (blocker !== null && blocker !== chip) return;

      used.current = false;
      pointer = e.pointerId;
      start = { x: e.clientX, y: e.clientY };
      last = start;
      scroller = target.closest<HTMLElement>('.wk-cal2-scroll');
      scrolled = { el: scroller?.scrollTop ?? 0, page: window.scrollY };

      if (e.pointerType !== 'mouse') {
        /* Finger: erst ein langer Druck macht daraus ein Wählen — sonst rollt und blättert er. */
        mode = 'touch-wait';
        timer = window.setTimeout(() => {
          if (mode !== 'touch-wait') return;
          navigator.vibrate?.(12);
          swallow = true;
          used.current = true;
          if (chip?.dataset.pick !== undefined) now.current.onLongPress(chip.dataset.pick);
          add = true;
          mode = 'lasso';
          live = new Set();
        }, LONG_PRESS);
        return;
      }

      if (chip?.dataset.pick !== undefined) {
        const key = chip.dataset.pick;
        mode = 'drag-wait';
        dragKeys = now.current.isPicked(key) ? now.current.pickedKeys() : [key];
      } else {
        mode = 'lasso-wait';
        add = e.shiftKey || e.ctrlKey || e.metaKey;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointer || mode === 'idle') return;
      last = { x: e.clientX, y: e.clientY };
      const far = Math.hypot(last.x - start.x, last.y - start.y);

      if (mode === 'touch-wait') {
        if (far > TOUCH_SLOP) reset();
        return;
      }
      if (mode === 'lasso-wait' || mode === 'drag-wait') {
        if (far < DRAG_START) return;
        begin(mode === 'lasso-wait' ? 'lasso' : 'drag', e);
      }
      roll();
      if (mode === 'lasso') paintLasso();
      else if (mode === 'drag') paintDrag(e.ctrlKey || e.altKey || e.metaKey);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      if (mode === 'lasso') {
        paintLasso();
        const keys = [...live];
        const adding = add;
        reset();
        now.current.onLasso(keys, adding);
        swallow = true;
      } else if (mode === 'drag') {
        const target = targetAt(box, e.clientX, e.clientY);
        const keys = dragKeys;
        const copy = e.ctrlKey || e.altKey || e.metaKey;
        reset();
        if (target !== null) now.current.onDrop(keys, target, copy);
        swallow = true;
      } else {
        reset();
      }
      /* Kommt kein Klick (die Maus landete woanders), darf auch der nächste nicht verschluckt werden. */
      if (swallow) window.setTimeout(() => { swallow = false; }, 400);
    };

    const onCancel = (e: PointerEvent) => { if (e.pointerId === pointer) reset(); };

    /* Solange der Finger ein Rechteck zieht, rollt die Seite nicht. */
    const onTouchMove = (e: TouchEvent) => { if (mode === 'lasso' && e.cancelable) e.preventDefault(); };

    /* Der lange Druck ist unseres — kein Menü des Browsers. */
    const onMenu = (e: Event) => { if (swallow || mode !== 'idle') e.preventDefault(); };

    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };

    /* Esc während des Ziehens: nichts geschieht. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || mode === 'idle') return;
      e.stopPropagation();
      reset();
      swallow = true;
    };

    /* Während des Ziehens zeigt der Zettel sofort, ob Strg (Kopie) gedrückt ist. */
    const onModifier = (e: KeyboardEvent) => { if (mode === 'drag') paintDrag(e.ctrlKey || e.altKey || e.metaKey); };

    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onCancel);
    box.addEventListener('touchmove', onTouchMove, { passive: false });
    box.addEventListener('contextmenu', onMenu);
    box.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keydown', onModifier);
    window.addEventListener('keyup', onModifier);
    return () => {
      reset();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onCancel);
      box.removeEventListener('touchmove', onTouchMove);
      box.removeEventListener('contextmenu', onMenu);
      box.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keydown', onModifier);
      window.removeEventListener('keyup', onModifier);
    };
  }, [enabled]);

  return { ref, used };
}
