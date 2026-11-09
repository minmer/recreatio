/**
 * 2026-11-01 — „ZBUDUJ Z KAFELKÓW" (Lemma): die Antwort aus Kacheln zusammensetzen — einen Wzór, eine Verneinung, einen
 * Mengenausdruck, eine Zeile eines Beweises — und sehen, wie sie gesetzt aussieht, während man baut.
 *
 * <code>
 *   Bank        alle Kacheln (die richtigen und die zu viel), gemischt; antippen setzt sie ans Ende der Zeile
 *   Zeile       antippen nimmt eine Kachel zurück; ziehen ordnet um (Maus, Stift, Finger — in zwei Richtungen, die Zeile
 *               bricht um); Tastatur: Leertaste/Enter hebt auf, ←/→ verschiebt, Leertaste/Enter legt ab, Esc bricht ab,
 *               Entf/Rück nimmt sie zurück — jede Stelle wird angesagt (`aria-live`)
 *   Vorschau    das Gebaute, mit `join` verbunden: als EIN Wzór (`math` — jede Kachel `$…$` wird ihr LaTeX, Text wird
 *               `\text{…}`) oder als Text mit seinen Wzory (`text`)
 *   danach      ✓/✗ an jeder Stelle (gegen die nächste richtige Folge), „3 z 5 na swoim miejscu", „Pokaż rozwiązanie"
 *               schiebt die Kacheln (FLIP) an ihre Stellen und zurück
 * </code>
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { texPieces } from '../core/tex';
import { useT } from '../core/i18n';
import { Tex, TexText } from '../ui/tex/Tex';
import type { Card } from './cardBasics';
import type { Outcome } from './check';

/** Eine Kachel: ihre Nummer in der Bank (gleiche Texte bleiben verschiedene Kacheln) und ihr Text. */
interface Tile {
  readonly id: number;
  readonly text: string;
}

/** Wie weit sich ein Zeiger bewegen darf, bevor ein Tippen ein Ziehen wird. */
const SLOP = 5;

/* -- Die Vorschau ------------------------------------------------------------------------------------------------- */

/** Text in `\text{…}` — was LaTeX dort anders lesen würde, als Zeichen. */
const TEXT_ESC: Readonly<Record<string, string>> = { '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', $: '\\$', '&': '\\&', '#': '\\#', '^': '\\^{}', _: '\\_', '%': '\\%', '~': '\\~{}' };
const asText = (text: string): string => (text.trim() === '' ? '' : `\\text{${text.replace(/[\\{}$&#^_%~]/g, (c) => TEXT_ESC[c] ?? c)}}`);

/** Eine Kachel als Stück LaTeX: ihr Wzór (ohne Dollar), Text als `\text{…}`. */
function tileTex(tile: string): string {
  return texPieces(tile).map((p) => (p.t === 'math' ? p.tex : asText(p.v))).join('');
}

/**
 * 2026-11-01 — WAS GEBAUT IST, gesetzt: `math` — alle Kacheln als EIN Wzór (so liest man „∃a∈A : ¬P(a)", nicht drei
 * Wzory nebeneinander); `text` — die Kacheln mit `join` verbunden, ihre Wzory einzeln gesetzt.
 */
export function previewTex(tiles: readonly string[], preview: 'math' | 'text', join: string): string {
  if (preview === 'text') return tiles.join(join);
  const glue = join.trim() === '' ? (join === '' ? '' : ' ') : tileTex(join);
  return tiles.map(tileTex).join(glue);
}

export function BuildPreview({ tiles, preview, join, empty }: { tiles: readonly string[]; preview: 'math' | 'text'; join: string; empty?: string }) {
  const t = useT();
  const shown = previewTex(tiles, preview, join);
  return (
    <div className="cg-build-preview" data-build-preview={shown} aria-label={t('cogitaLearnRun.build.preview')}>
      {tiles.length === 0 ? <span className="cg-muted">{empty ?? t('cogitaLearnRun.build.empty')}</span>
        : preview === 'math' ? <Tex tex={shown} display /> : <TexText text={shown} />}
    </div>
  );
}

/* -- Bauen --------------------------------------------------------------------------------------------------------- */

/** Ab zwei Kacheln nie die richtige Folge in der Bank (sonst wäre Bauen Abschreiben). */
function shuffledTiles(texts: readonly string[]): Tile[] {
  const tiles = texts.map((text, id) => ({ id, text }));
  for (let i = tiles.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  if (tiles.length >= 2 && tiles.every((t, i) => t.id === i)) tiles.push(tiles.shift()!);
  return tiles;
}

/** Die Stellen der Kacheln vorher — für FLIP. */
const placesIn = (root: HTMLElement | null): Map<string, DOMRect> =>
  new Map([...(root?.querySelectorAll<HTMLElement>('[data-tile-key]') ?? [])].map((el) => [el.dataset.tileKey ?? '', el.getBoundingClientRect()]));

function flip(root: HTMLElement | null, before: ReadonlyMap<string, DOMRect> | null) {
  if (root === null || before === null) return;
  const els = [...root.querySelectorAll<HTMLElement>('[data-tile-key]')];
  const moved: HTMLElement[] = [];
  for (const el of els) {
    el.style.transition = 'none';
    el.style.transform = '';
    const was = before.get(el.dataset.tileKey ?? '');
    if (was === undefined) continue;
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    moved.push(el);
  }
  void root.offsetHeight;
  for (const el of els) {
    el.style.transition = '';
    if (moved.includes(el)) el.style.transform = '';
  }
}

export function BuildAnswer({ card, locked, autoFocus = true, given, outcome, onSubmit, action }: {
  card: Card;
  locked: boolean;
  autoFocus?: boolean;
  /** Nach der Prüfung: was gebaut war — dann stehen die Marken darauf. */
  given?: readonly string[];
  outcome?: Outcome;
  onSubmit: (given: string[]) => void;
  /** „Dalej" an der Stelle von „Sprawdź", nach der Prüfung. */
  action?: ReactNode;
}) {
  const spec = card.answer.form === 'build' ? card.answer : null;
  const all = spec === null ? [] : [...spec.items, ...spec.extra];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bank = useMemo(() => shuffledTiles(all), [card.key, card.fingerprint]);
  const [line, setLine] = useState<readonly Tile[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [said, setSaid] = useState('');
  const t = useT();
  const [solution, setSolution] = useState(false);
  const lineEl = useRef<HTMLOListElement | null>(null);
  const bankEl = useRef<HTMLDivElement | null>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);
  const keyStart = useRef<readonly Tile[] | null>(null);
  const drag = useRef<{ id: number; pointerId: number; startX: number; startY: number; grabX: number; grabY: number; x: number; y: number; active: boolean } | null>(null);

  useLayoutEffect(() => { flip(lineEl.current, before.current); before.current = null; }, [line, solution]);
  useEffect(() => {
    if (autoFocus && !locked) window.setTimeout(() => bankEl.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true }), 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.key]);
  /* Ein Ziehen, das beim Verlassen noch läuft, hört auf. */
  useEffect(() => () => { drag.current = null; }, []);

  const checked = given !== undefined;
  const used = new Set(line.map((t) => t.id));
  const n = line.length;
  const remember = () => { before.current = placesIn(lineEl.current); };
  const put = (next: readonly Tile[]) => { remember(); setLine(next); };
  const add = (tile: Tile) => {
    if (locked || used.has(tile.id)) return;
    put([...line, tile]);
    setSaid(t('cogitaLearnRun.build.added', { text: tile.text, at: n + 1 }));
  };
  const remove = (id: number) => {
    if (locked) return;
    const at = line.findIndex((t) => t.id === id);
    if (at < 0) return;
    put(line.filter((t) => t.id !== id));
    setSaid(t('cogitaLearnRun.build.removed', { text: line[at]!.text }));
    /* Der Fokus bleibt in der Zeile (die Nachbarin) — sonst fiele er auf die Seite. */
    window.requestAnimationFrame(() => {
      const els = lineEl.current?.querySelectorAll<HTMLElement>('[data-tile-id]');
      (els?.[Math.min(at, (els?.length ?? 1) - 1)] ?? bankEl.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    });
  };
  const moveTo = (from: number, to: number): readonly Tile[] => {
    const next = line.slice();
    const [one] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, one!);
    return next;
  };
  const focusTile = (id: number) => window.requestAnimationFrame(() => lineEl.current?.querySelector<HTMLElement>(`[data-tile-id="${id}"]`)?.focus());

  /* -- Ziehen in zwei Richtungen ------------------------------------------------------------------------------- */

  const place = () => {
    const d = drag.current;
    const root = lineEl.current;
    if (d === null || root === null) return;
    const el = root.querySelector<HTMLElement>(`[data-tile-id="${d.id}"]`);
    if (el === null) return;
    const box = root.getBoundingClientRect();
    el.style.transform = `translate(${d.x - box.left - d.grabX - el.offsetLeft}px, ${d.y - box.top - d.grabY - el.offsetTop}px)`;
  };
  /* Nach jedem Umordnen beim Ziehen: die gezogene Kachel bleibt unter dem Zeiger. */
  useLayoutEffect(() => { if (dragging !== null) place(); });

  const onPointerDown = (e: ReactPointerEvent<HTMLLIElement>, id: number) => {
    if (locked || e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, grabX: e.clientX - r.left, grabY: e.clientY - r.top, x: e.clientX, y: e.clientY, active: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* der Zeiger ist schon fort */ }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLLIElement>) => {
    const d = drag.current;
    if (d === null || d.pointerId !== e.pointerId) return;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) <= SLOP) return;
      d.active = true;
      setDragging(d.id);
      const at = line.findIndex((t) => t.id === d.id);
      setSaid(t('cogitaLearnRun.build.lifted', { text: line[at]?.text ?? '', at: at + 1, n }));
    }
    e.preventDefault();
    /* Wohin sie fiele: hinter jede andere Kachel, die in Lesefolge vor dem Zeiger steht (Zeile über Zeile, dann links). */
    const others = [...(lineEl.current?.querySelectorAll<HTMLElement>('[data-tile-id]') ?? [])].filter((el) => Number(el.dataset.tileId) !== d.id);
    let to = 0;
    for (const el of others) {
      const r = el.getBoundingClientRect();
      const cy = r.top + r.height / 2;
      if (cy < e.clientY - r.height / 2 || (Math.abs(cy - e.clientY) <= r.height / 2 && r.left + r.width / 2 < e.clientX)) to += 1;
    }
    const from = line.findIndex((t) => t.id === d.id);
    if (from >= 0 && to !== from) setLine(moveTo(from, to));
    else place();
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLLIElement>, cancel = false) => {
    const d = drag.current;
    if (d === null || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* schon losgelassen */ }
    if (!d.active) { if (!cancel) remove(d.id); return; }
    setDragging(null);
    const el = lineEl.current?.querySelector<HTMLElement>(`[data-tile-id="${d.id}"]`);
    if (el !== null && el !== undefined) el.style.transform = '';
    const at = line.findIndex((t) => t.id === d.id);
    setSaid(t('cogitaLearnRun.build.dropped', { at: at + 1, n }));
  };

  /* -- Tastatur ---------------------------------------------------------------------------------------------------- */

  const onKey = (e: ReactKeyboardEvent<HTMLLIElement>, at: number, id: number) => {
    if (locked || e.target !== e.currentTarget) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (picked === null) {
        keyStart.current = line;
        setPicked(id);
        setSaid(t('cogitaLearnRun.build.liftedKeys', { text: line[at]!.text, at: at + 1, n }));
      } else {
        setPicked(null);
        keyStart.current = null;
        setSaid(t('cogitaLearnRun.build.dropped', { at: at + 1, n }));
      }
      return;
    }
    if (e.key === 'Escape' && picked !== null) {
      e.preventDefault();
      if (keyStart.current !== null) put(keyStart.current);
      keyStart.current = null;
      setPicked(null);
      setSaid(t('cogitaLearnRun.build.cancelled'));
      focusTile(id);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && picked === null) { e.preventDefault(); remove(id); return; }
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : 0;
    if (step !== 0) {
      e.preventDefault();
      if (picked === id) {
        const to = at + step;
        if (to < 0 || to >= n) return;
        put(moveTo(at, to));
        setSaid(t('cogitaLearnRun.build.moved', { at: to + 1, n }));
        focusTile(id);
      } else {
        const next = line[at + step];
        if (next !== undefined) focusTile(next.id);
      }
    }
  };

  /* -- Danach ------------------------------------------------------------------------------------------------------ */

  const marks = checked ? outcome?.marks ?? [] : null;
  const target = outcome?.solution ?? spec?.items ?? [];
  /* „Pokaż rozwiązanie": die richtige Folge — die eigenen Kacheln an ihren Stellen, fehlende aus der Bank. */
  const solved: readonly Tile[] = useMemo(() => {
    const free = [...line, ...bank.filter((t) => !line.some((x) => x.id === t.id))];
    const out: Tile[] = [];
    for (const text of target) {
      const at = free.findIndex((t) => t.text.trim() === text.trim());
      out.push(at >= 0 ? free.splice(at, 1)[0]! : { id: 1000 + out.length, text });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, bank, target.join('\u0000')]);
  /* Was nach der Prüfung in der Zeile steht: die eigene Folge — sie wurde geprüft. */
  useEffect(() => {
    if (!checked || given === undefined) return;
    /* Nach einem Neuladen (oder in einer Sitzung) die geprüfte Folge aus den Texten wiederherstellen. */
    if (line.length === given.length && line.every((t, i) => t.text === given[i])) return;
    const free = bank.slice();
    setLine(given.map((text, i) => { const at = free.findIndex((t) => t.text === text); return at >= 0 ? free.splice(at, 1)[0]! : { id: 2000 + i, text }; }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  if (spec === null) return null;
  const shown = solution ? solved : line;
  const right = marks === null ? 0 : marks.filter(Boolean).length;
  const tileKey = (t: Tile) => `t${t.id}`;

  return (
    <div className={`cg-build${checked ? ' is-checked' : ''}${dragging !== null ? ' is-dragging' : ''}`} data-build="">
      <BuildPreview tiles={shown.map((t) => t.text)} preview={spec.preview} join={spec.join} />
      <ol ref={lineEl} className="cg-build-line" aria-label={n === 0 ? t('cogitaLearnRun.build.lineEmpty') : t('cogitaLearnRun.build.line', { count: n })} data-build-line="">
        {shown.length === 0 && <li className="cg-build-empty" aria-hidden>{t('cogitaLearnRun.build.pick')}</li>}
        {shown.map((x, at) => {
          const m = marks === null || solution ? null : marks[at] ?? false;
          return (
            <li key={tileKey(x)} data-tile-key={tileKey(x)} data-tile-id={x.id} data-tile-text={x.text}
              className={`cg-tile${m === null ? '' : m ? ' is-right' : ' is-wrong'}${dragging === x.id ? ' is-lifted' : ''}${picked === x.id ? ' is-picked' : ''}`}
              tabIndex={locked ? -1 : 0} aria-roledescription={t('cogitaLearnRun.build.tileRole')}
              aria-label={t(m === null ? 'cogitaLearnRun.build.tile' : m ? 'cogitaLearnRun.build.tileRight' : 'cogitaLearnRun.build.tileWrong', { text: x.text, at: at + 1, n: shown.length })}
              onPointerDown={(e) => onPointerDown(e, x.id)} onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e)} onPointerCancel={(e) => onPointerUp(e, true)}
              onKeyDown={(e) => onKey(e, at, x.id)}>
              <TexText text={x.text} />
              {m !== null && <span className="cg-tile-mark" aria-hidden>{m ? '✓' : '✗'}</span>}
            </li>
          );
        })}
      </ol>
      <span className="cg-sr" aria-live="assertive" data-build-said="">{said}</span>
      {!checked && (
        <div ref={bankEl} className="cg-build-bank" aria-label={t('cogitaLearnRun.build.bank')} data-build-bank="">
          {bank.map((x) => (
            <button key={x.id} type="button" className={`cg-tile${used.has(x.id) ? ' is-used' : ''}`} disabled={locked || used.has(x.id)} data-bank-text={x.text}
              aria-label={t('cogitaLearnRun.build.add', { text: x.text })} onClick={() => add(x)}>
              <TexText text={x.text} />
            </button>
          ))}
        </div>
      )}
      {action ?? (!checked && (
        <div className="cg-answer-actions">
          {n > 0 && <button type="button" className="wk-link-btn" disabled={locked} onClick={() => { put([]); setSaid(t('cogitaLearnRun.build.cleared')); }}>{t('cogitaLearnRun.build.clear')}</button>}
          <button key="check" type="button" className="wk-btn" disabled={locked || n === 0} onClick={() => onSubmit(line.map((x) => x.text))}>{t('cogitaLearnRun.card.check')}</button>
        </div>
      ))}
      {marks !== null && (
        <div className="cg-order-result">
          <span className="cg-order-count" data-build-count={right}>{t('cogitaLearnRun.build.inPlace', { right, n: target.length })}</span>
          {outcome?.correct !== true && (
            <button type="button" className="wk-link-btn" aria-pressed={solution} data-build-toggle=""
              onClick={() => { remember(); setSolution((x) => !x); }}>
              {solution ? t('cogitaLearnRun.build.showMine') : t('cogitaLearnRun.build.showSolution')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
