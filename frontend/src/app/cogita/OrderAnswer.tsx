/**
 * 2026-10-31 — „UŁÓŻ W KOLEJNOŚCI" ZUM ANFASSEN: ziehen mit Vorschau, Tastatur, Pfeile — und danach das Ergebnis auf
 * der eigenen Antwort.
 *
 * <code>
 *   ziehen      Maus, Stift, Finger (Pointer Events): das gezogene Stück folgt dem Zeiger, die anderen weichen sanft
 *               aus, man sieht, wo es landet; am Griff ⋮⋮ sofort, mit dem Finger auf dem Text nach kurzem Halten —
 *               so blättert die Seite über der Liste weiter, nur beim Ziehen nicht; am Rand des Bildschirms rollt es
 *   Tastatur    Leertaste/Enter hebt auf, ↑/↓ verschiebt, Leertaste/Enter legt ab, Esc bricht ab — der Bildschirmleser
 *               hört jede Stelle (`aria-live`)
 *   Pfeile      ↑/↓ an jedem Stück bleiben, als zweiter Weg
 *   danach      ✓/✗ an jedem Stück, falsche mit ihrer richtigen Stelle („→ 3"), „4 z 6 na swoim miejscu";
 *               „Pokaż poprawną kolejność" schiebt die Stücke (FLIP) an ihre Stellen und zurück
 * </code>
 *
 * Die Verschiebungen laufen am DOM vorbei (`element.style.transform`): ein Zug ist 60 Bilder in der Sekunde, kein
 * neues Zeichnen von React. Stücke dürfen verschieden hoch sein — gemessen wird beim Aufheben.
 */

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { orderMarks, type OrderMark } from './check';

interface Piece {
  readonly id: number;
  readonly text: string;
}

/** Wie weit sich ein Zeiger bewegen darf, bevor ein Tippen ein Ziehen wird (Maus, Stift, Griff). */
const SLOP = 4;
/** Wie lange ein Finger auf dem Text hält, bis das Stück sich hebt. */
const HOLD_MS = 280;
/** Ab wie nahe am Rand die Liste rollt, und wie schnell (Pixel je Bild, am Rand). */
const EDGE = 64;
const SPEED = 14;

interface Drag {
  readonly id: number;
  readonly from: number;
  readonly pointerId: number;
  readonly startY: number;
  readonly startScroll: number;
  /** Mitten und Höhen beim Aufheben, in der Reihenfolge der Liste. */
  readonly tops: readonly number[];
  readonly heights: readonly number[];
  readonly gap: number;
  readonly scroller: Element;
  y: number;
  to: number;
  frame: number;
}

/** Das nächste Element, das rollt — sonst das Dokument. */
function scrollerOf(el: Element | null): Element {
  for (let at = el?.parentElement ?? null; at !== null; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (/(auto|scroll)/.test(style.overflowY) && at.scrollHeight > at.clientHeight + 1) return at;
  }
  return document.scrollingElement ?? document.documentElement;
}

const isPage = (el: Element) => el === document.scrollingElement || el === document.documentElement || el === document.body;

/** Wo der Zeiger rollen lässt: −1 hinauf, 1 hinab, 0 nicht — am Rand des Fensters oder des rollenden Elements. */
function edgeOf(scroller: Element, y: number): number {
  const top = isPage(scroller) ? 0 : Math.max(0, scroller.getBoundingClientRect().top);
  const bottom = isPage(scroller) ? window.innerHeight : Math.min(window.innerHeight, scroller.getBoundingClientRect().bottom);
  if (y < top + EDGE) return -Math.min(1, (top + EDGE - y) / EDGE);
  if (y > bottom - EDGE) return Math.min(1, (y - (bottom - EDGE)) / EDGE);
  return 0;
}

/**
 * FLIP: wo die Stücke vorher standen (`before`), dorthin werden sie verschoben — und gleiten dann an ihren neuen Platz.
 * Ohne `before` (das erste Zeichnen) geschieht nichts.
 */
function flip(list: HTMLElement | null, before: ReadonlyMap<number, number> | null) {
  if (list === null || before === null) return;
  const items = [...list.querySelectorAll<HTMLElement>('[data-order-id]')];
  const moved: HTMLElement[] = [];
  for (const el of items) {
    el.style.transition = 'none';
    el.style.transform = '';
    const was = before.get(Number(el.dataset.orderId));
    if (was === undefined) continue;
    const dy = was - el.getBoundingClientRect().top;
    if (Math.abs(dy) < 0.5) continue;
    el.style.transform = `translateY(${dy}px)`;
    moved.push(el);
  }
  void list.offsetHeight;
  for (const el of items) {
    el.style.transition = '';
    if (moved.includes(el)) el.style.transform = '';
  }
}

const tops = (list: HTMLElement | null): Map<number, number> =>
  new Map([...(list?.querySelectorAll<HTMLElement>('[data-order-id]') ?? [])].map((el) => [Number(el.dataset.orderId), el.getBoundingClientRect().top]));

export function OrderAnswer({ start, correct, locked, given, onOrder, action }: {
  /** Die Folge, mit der die Liste beginnt (gemischt). */
  start: readonly string[];
  /** Die richtige Folge — für die Marken danach. */
  correct: readonly string[];
  locked: boolean;
  /** Nach der Prüfung: die gegebene Folge — dann stehen die Marken auf ihr. */
  given?: readonly string[];
  onOrder: (order: string[]) => void;
  /** Der Knopf unter der Liste („Sprawdź”, danach „Dalej”) — vor dem Ergebnis, damit er an seinem Platz bleibt. */
  action?: ReactNode;
}) {
  const [pieces, setPieces] = useState<readonly Piece[]>(() => start.map((text, id) => ({ id, text })));
  const [picked, setPicked] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [said, setSaid] = useState('');
  const [showCorrect, setShowCorrect] = useState(false);
  const list = useRef<HTMLOListElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const before = useRef<Map<number, number> | null>(null);
  const hold = useRef<{ timer: number; x: number; y: number; id: number; pointerId: number } | null>(null);
  /* Maus, Stift, Griff: gedrückt, aber noch nicht weit genug bewegt — ein Klick bleibt ein Klick. */
  const pending = useRef<{ id: number; x: number; y: number; pointerId: number } | null>(null);
  const keyStart = useRef<readonly Piece[] | null>(null);
  const reported = useRef(onOrder);
  reported.current = onOrder;

  /* Nach jeder neuen Folge: die Stücke gleiten von ihrem alten Platz an den neuen. */
  useLayoutEffect(() => { flip(list.current, before.current); before.current = null; }, [pieces, showCorrect]);
  useEffect(() => { reported.current(pieces.map((p) => p.text)); }, [pieces]);
  /* Ein Ziehen, das beim Verlassen noch läuft, hört auf (kein Rollen mehr). */
  useEffect(() => () => { if (drag.current !== null) cancelAnimationFrame(drag.current.frame); if (hold.current !== null) window.clearTimeout(hold.current.timer); }, []);

  const n = pieces.length;
  const reorder = (next: readonly Piece[]) => { before.current = tops(list.current); setPieces(next); };
  const move = (from: number, to: number): readonly Piece[] => {
    const next = pieces.slice();
    const [one] = next.splice(from, 1);
    next.splice(to, 0, one!);
    return next;
  };

  /* -- Ziehen ------------------------------------------------------------------------------------- */

  const elementOf = (id: number) => list.current?.querySelector<HTMLElement>(`[data-order-id="${id}"]`) ?? null;

  const paint = (d: Drag) => {
    const scroll = (isPage(d.scroller) ? window.scrollY : d.scroller.scrollTop) - d.startScroll;
    const dy = d.y - d.startY + scroll;
    const els = [...(list.current?.querySelectorAll<HTMLElement>('[data-order-id]') ?? [])];
    const center = d.tops[d.from]! + d.heights[d.from]! / 2 + dy;
    /* Wohin es fiele: hinter jedes Stück, dessen Mitte darüber liegt. */
    let to = 0;
    for (let i = 0; i < d.tops.length; i += 1) if (i !== d.from && d.tops[i]! + d.heights[i]! / 2 < center) to += 1;
    d.to = to;
    const room = d.heights[d.from]! + d.gap;
    els.forEach((el, i) => {
      if (i === d.from) { el.style.transform = `translateY(${dy}px)`; return; }
      const shift = d.from < to && i > d.from && i <= to ? -room : d.from > to && i >= to && i < d.from ? room : 0;
      el.style.transform = shift === 0 ? '' : `translateY(${shift}px)`;
    });
  };

  const roll = () => {
    const d = drag.current;
    if (d === null) return;
    const edge = edgeOf(d.scroller, d.y);
    if (edge !== 0) {
      if (isPage(d.scroller)) window.scrollBy(0, edge * SPEED); else d.scroller.scrollTop += edge * SPEED;
      paint(d);
    }
    d.frame = requestAnimationFrame(roll);
  };

  const begin = (id: number, pointerId: number, y: number) => {
    const el = elementOf(id);
    if (el === null || list.current === null) return;
    const els = [...list.current.querySelectorAll<HTMLElement>('[data-order-id]')];
    const rects = els.map((x) => x.getBoundingClientRect());
    const from = els.indexOf(el);
    const scroller = scrollerOf(list.current);
    try { el.setPointerCapture(pointerId); } catch { /* der Zeiger ist schon fort */ }
    drag.current = {
      id, from, pointerId, startY: y, y, to: from,
      startScroll: isPage(scroller) ? window.scrollY : scroller.scrollTop,
      tops: rects.map((r) => r.top), heights: rects.map((r) => r.height),
      gap: rects.length > 1 ? Math.max(0, rects[1]!.top - rects[0]!.bottom) : 0,
      scroller, frame: 0
    };
    drag.current.frame = requestAnimationFrame(roll);
    setDragging(id);
    setSaid(`Podniesiono: ${pieces[from]?.text ?? ''}, pozycja ${from + 1} z ${n}.`);
  };

  const finish = (drop: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (d === null) return;
    cancelAnimationFrame(d.frame);
    setDragging(null);
    const el = elementOf(d.id);
    try { el?.releasePointerCapture(d.pointerId); } catch { /* schon losgelassen */ }
    if (!drop || d.to === d.from) {
      /* Zurück an den alten Platz — sanft. */
      for (const x of list.current?.querySelectorAll<HTMLElement>('[data-order-id]') ?? []) x.style.transform = '';
      setSaid(drop ? 'Upuszczono na tym samym miejscu.' : 'Anulowano.');
      return;
    }
    before.current = tops(list.current);
    setPieces(move(d.from, d.to));
    setSaid(`Upuszczono na pozycji ${d.to + 1} z ${n}.`);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLLIElement>, id: number) => {
    if (locked || e.button !== 0 || drag.current !== null) return;
    const target = e.target as HTMLElement;
    if (target.closest('button:not(.cg-order-grip)') !== null) return;
    const onGrip = target.closest('.cg-order-grip') !== null;
    if (e.pointerType === 'touch' && !onGrip) {
      /* Der Finger auf dem Text: erst halten — wer gleich wischt, blättert die Seite. */
      const timer = window.setTimeout(() => {
        const h = hold.current;
        hold.current = null;
        if (h !== null) begin(h.id, h.pointerId, h.y);
      }, HOLD_MS);
      hold.current = { timer, x: e.clientX, y: e.clientY, id, pointerId: e.pointerId };
      return;
    }
    hold.current = null;
    if (onGrip && e.pointerType === 'touch') { e.preventDefault(); begin(id, e.pointerId, e.clientY); return; }
    pending.current = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLLIElement>) => {
    const h = hold.current;
    if (h !== null && h.pointerId === e.pointerId && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) { window.clearTimeout(h.timer); hold.current = null; }
    const p = pending.current;
    if (p !== null && p.pointerId === e.pointerId && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) {
      pending.current = null;
      begin(p.id, p.pointerId, p.y);
    }
    const d = drag.current;
    if (d === null || d.pointerId !== e.pointerId) return;
    e.preventDefault();
    d.y = e.clientY;
    paint(d);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLLIElement>, cancel = false) => {
    if (hold.current !== null && hold.current.pointerId === e.pointerId) { window.clearTimeout(hold.current.timer); hold.current = null; }
    if (pending.current !== null && pending.current.pointerId === e.pointerId) pending.current = null;
    if (drag.current !== null && drag.current.pointerId === e.pointerId) finish(!cancel);
  };

  /* Ein Finger, der ein Stück hält, rollt die Seite nicht (der Text erlaubt sonst das Rollen: `touch-action: pan-y`). */
  useEffect(() => {
    const el = list.current;
    if (el === null) return undefined;
    const stop = (e: TouchEvent) => { if (drag.current !== null) e.preventDefault(); };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);

  /* -- Tastatur ----------------------------------------------------------------------------------- */

  const focusPiece = (id: number) => window.requestAnimationFrame(() => elementOf(id)?.focus());

  const onKey = (e: ReactKeyboardEvent<HTMLLIElement>, at: number, id: number) => {
    if (locked || e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (picked === null) {
        keyStart.current = pieces;
        setPicked(id);
        setSaid(`Podniesiono: ${pieces[at]!.text}, pozycja ${at + 1} z ${n}. Strzałki przesuwają, spacja upuszcza, Escape anuluje.`);
      } else {
        setPicked(null);
        keyStart.current = null;
        setSaid(`Upuszczono na pozycji ${at + 1} z ${n}.`);
      }
      return;
    }
    if (e.key === 'Escape' && picked !== null) {
      e.preventDefault();
      if (keyStart.current !== null) reorder(keyStart.current);
      keyStart.current = null;
      setPicked(null);
      setSaid('Anulowano — element wrócił na swoje miejsce.');
      focusPiece(id);
      return;
    }
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && picked === id) {
      e.preventDefault();
      const to = e.key === 'ArrowUp' ? at - 1 : at + 1;
      if (to < 0 || to >= n) return;
      reorder(move(at, to));
      setSaid(`Przeniesiono na pozycję ${to + 1} z ${n}.`);
      focusPiece(id);
    }
  };

  const nudge = (at: number, to: number) => {
    if (locked || to < 0 || to >= n) return;
    const id = pieces[at]!.id;
    reorder(move(at, to));
    setSaid(`Przeniesiono na pozycję ${to + 1} z ${n}.`);
    focusPiece(id);
  };

  /* -- Danach ------------------------------------------------------------------------------------- */

  /* Die Marken gehören zur eigenen Folge — sie ist, was geprüft wurde (`given`). */
  const marks: readonly OrderMark[] | null = given === undefined ? null : orderMarks(correct, pieces.map((p) => p.text));
  const shown: readonly Piece[] = marks === null || !showCorrect ? pieces
    : pieces.map((p, i) => ({ p, place: marks[i]?.place ?? 0, i })).sort((a, b) => (a.place || 1e9) - (b.place || 1e9) || a.i - b.i).map((x) => x.p);
  const right = marks === null ? 0 : marks.filter((m) => m.right).length;
  /* Wie viele Nachbarn in der richtigen Folge stehen — ein verschobenes Stück verdirbt alle Stellen, nicht die Folge. */
  const neighbours = marks === null ? 0 : marks.slice(1).filter((m, i) => marks[i]!.place > 0 && m.place === marks[i]!.place + 1).length;
  const markOf = (id: number) => { const i = pieces.findIndex((p) => p.id === id); return marks === null || i < 0 ? null : { mark: marks[i]!, at: i + 1 }; };

  return (
    <div className="cg-order-wrap">
      <ol ref={list} className={`cg-order${dragging !== null ? ' is-dragging' : ''}${marks !== null ? ' is-checked' : ''}`} aria-label="Kolejność — przeciągnij albo użyj strzałek" data-order-list="">
        {shown.map((p, at) => {
          const m = markOf(p.id);
          const state = m === null ? '' : m.mark.right ? ' is-right' : ' is-wrong';
          return (
            <li key={p.id} data-order-id={p.id} data-order-text={p.text}
              className={`cg-order-item${state}${dragging === p.id ? ' is-lifted' : ''}${picked === p.id ? ' is-picked' : ''}`}
              tabIndex={locked ? -1 : 0} aria-roledescription="element do przeciągnięcia"
              aria-label={`${p.text}, pozycja ${at + 1} z ${n}${m === null ? '' : m.mark.right ? ', dobrze' : `, źle — właściwa pozycja ${m.mark.place}`}`}
              aria-grabbed={picked === p.id || dragging === p.id}
              onPointerDown={(e) => onPointerDown(e, p.id)} onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e)} onPointerCancel={(e) => onPointerUp(e, true)} onLostPointerCapture={(e) => { if (e.target === e.currentTarget) onPointerUp(e, true); }}
              onKeyDown={(e) => onKey(e, at, p.id)}>
              {!locked && <span className="cg-order-grip" aria-hidden>⋮⋮</span>}
              <span className="cg-order-n" aria-hidden>{at + 1}.</span>
              <span className="cg-order-text">{p.text}</span>
              {m !== null && (
                <span className="cg-order-mark" aria-hidden>
                  {m.mark.right ? '✓' : '✗'}
                  {!m.mark.right && m.mark.place > 0 && <span className="cg-order-badge">{showCorrect ? `u Ciebie: ${m.at}` : `→ ${m.mark.place}`}</span>}
                </span>
              )}
              {!locked && (
                <span className="cg-order-arrows">
                  <button type="button" className="wk-link-btn" aria-label={`Wyżej: ${p.text}`} disabled={at === 0} onClick={() => nudge(at, at - 1)}>↑</button>
                  <button type="button" className="wk-link-btn" aria-label={`Niżej: ${p.text}`} disabled={at === n - 1} onClick={() => nudge(at, at + 1)}>↓</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <span className="cg-sr" aria-live="assertive" data-order-said="">{said}</span>
      {action}
      {marks !== null && (
        <div className="cg-order-result">
          <span className="cg-order-count" data-order-count={right}>{right} z {n} na swoim miejscu</span>
          {right < n && n >= 3 && neighbours > 0 && <span className="cg-muted" data-order-neighbours={neighbours}>{neighbours} z {n - 1} par sąsiadów w dobrej kolejności</span>}
          {right < n && (
            <button type="button" className="wk-link-btn" aria-pressed={showCorrect} data-order-toggle=""
              onClick={() => { before.current = tops(list.current); setShowCorrect((x) => !x); }}>
              {showCorrect ? 'Pokaż moją kolejność' : 'Pokaż poprawną kolejność'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
