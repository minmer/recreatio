/**
 * 2026-11-10 (Eigentümer: „keine Animationen, bei denen etwas Buntes passiert, sondern eine Gestalt, bei der man spürt, dass
 * jemand eine Welt vorbereitet hat, durch die man geht") — DIE SEITE DES WEGES nach einem Teil, unten über der Karte (die
 * Karte selbst zeigt dabei, was sich änderte: Türme, die sinken oder erobert sind, Wege, die sich öffnen):
 * <code>
 *   was        der Teil, der eben zu Ende ging, und seine Zahlen (sie zählen ruhig hoch)
 *   folgt      was daraus folgt und warum (eroberte Türme, Stufen, Wege, die sich öffneten — `wmFinish.ts`), mit „Pokaż"
 *   weiter     der nächste Teil des Weges — an einem Turm die Wahl: gleich erobern oder erst wiederholen; sonst geht es nach
 *              AUTO_S Sekunden von selbst weiter, bis man etwas berührt
 * </code>
 * Bewegung nach der Wahl „Animacje": ograniczone/wyłączone zeigen gleich den Endstand (CSS unter `data-motion`).
 */

import { useEffect, useRef, useState } from 'react';

import type { T } from '../../core/i18n';
import { useMotion } from '../../ui/motion';
import { FlagIcon } from '../WorldMap';
import { scoreHue } from '../scoreColour';
import { PartIcon } from './WorldWay';
import type { Consequence, FinishStats } from './wmFinish';
import './worldmap.css';

/** Eine Zahl, die von 0 hochzählt (ohne volle Bewegung: gleich der Endstand). */
function useCount(target: number, delayMs: number, ms = 900): number {
  const motion = useMotion();
  const [v, setV] = useState(motion === 'full' ? 0 : target);
  useEffect(() => {
    if (motion !== 'full') { setV(target); return undefined; }
    let raf = 0;
    const t0 = performance.now() + delayMs;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / ms));
      setV(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delayMs, ms, motion]);
  return v;
}

const vars = (pairs: Record<string, string | number>) => (el: HTMLElement | SVGElement | null) => {
  if (el === null) return;
  for (const [k, v] of Object.entries(pairs)) el.style.setProperty(k, String(v));
};

function Tile({ label, value, suffix = '', i, accent = false, src, score }: { label: string; value: number; suffix?: string; i: number; accent?: boolean; src: string; score?: number }) {
  const v = useCount(value, 300 + i * 120);
  return (
    <div className={`cg-fin-tile${score !== undefined ? ' cg-score is-score' : accent ? ' is-accent' : ''}`} ref={vars({ '--i': i, ...(score === undefined ? {} : { '--score-h': scoreHue(score).toFixed(1) }) })} data-world-finish-tile={label} data-fin-src={src}>
      <span className="cg-fin-num">{suffix === '+' ? `+${v}` : `${v}${suffix}`}</span>
      <span className="cg-fin-label">{label}</span>
    </div>
  );
}


/** Wie lange die Seite stehen bleibt, bevor es von selbst weitergeht (Sekunden). */
export const AUTO_S = 6;

/** Die Folgen, die auf einmal stehen (der Rest als „+N"). */
const FOLLOWS_SHOWN = 3;

function ConsequenceIcon({ kind }: { kind: Consequence['kind'] }) {
  if (kind === 'conquer') return <FlagIcon />;
  return <PartIcon kind={kind === 'level' ? 'run' : 'travel'} />;
}

/** Eine Folge: was geschah, darunter warum; „Pokaż" führt auf der Karte hin. */
function Follow({ c, i, t, nameOf, sectionName, onShow }: {
  c: Consequence; i: number; t: T; nameOf: (id: string) => string; sectionName: (id: string) => string;
  onShow: ((kind: 'place' | 'section', id: string) => void) | null;
}) {
  const what = c.kind === 'conquer' ? t('cogitaWorld.finish.fx.conquer', { name: nameOf(c.place) })
    : c.kind === 'level' ? t('cogitaWorld.finish.fx.level', { name: nameOf(c.place), from: c.from, to: c.to })
      : t('cogitaWorld.finish.fx.opened', { name: sectionName(c.section) });
  const why = c.kind === 'conquer' ? (c.why === 'levels' ? t('cogitaWorld.finish.why.levels', { of: c.of }) : t('cogitaWorld.finish.why.share', { pct: Math.round(c.share * 100) }))
    : c.kind === 'level' ? t('cogitaWorld.finish.why.level', { of: c.of })
      : c.why === 'entry' ? t('cogitaWorld.finish.why.entry')
        : c.why === 'tower' ? t('cogitaWorld.finish.why.tower', { place: nameOf(c.start) }) : t('cogitaWorld.finish.why.openLevel', { place: nameOf(c.start) });
  const target = c.kind === 'opened' ? { kind: 'section' as const, id: c.section } : { kind: 'place' as const, id: c.place };
  return (
    <li className={`cg-fin-follow is-${c.kind}`} ref={vars({ '--i': i })} data-world-finish-follow={c.kind} data-fin-src={`${target.kind}:${target.id}`}>
      <span className="cg-fin-ficon" aria-hidden="true"><ConsequenceIcon kind={c.kind} /></span>
      <span className="cg-fin-ftext">
        <strong>{what}</strong>
        <span className="cg-fin-fwhy">{why}</span>
      </span>
      {onShow !== null && <button type="button" className="wk-link-btn cg-fin-fshow" onClick={() => onShow(target.kind, target.id)} data-world-finish-show={target.id}>{t('cogitaWorld.finish.show')}</button>}
    </li>
  );
}

export function FinishShow({ stats, title, t, nameOf, sectionName, next, onNext, onWay, onClose, onShow, auto = true, paused = false, tower = null }: {
  stats: FinishStats;
  /** Was eben zu Ende ging (der Name des Teils). */
  title: string;
  t: T;
  nameOf: (id: string) => string;
  /** Der Name eines Pfades (Linie → Ziel). */
  sectionName: (id: string) => string;
  /** Der nächste Teil des Weges (Text), null ohne Navigation oder am Ziel. */
  next: string | null;
  onNext: (() => void) | null;
  onWay: (() => void) | null;
  onClose: () => void;
  /** Eine Folge auf der Karte zeigen (schliesst die Seite). */
  onShow: ((kind: 'place' | 'section', id: string) => void) | null;
  /**
   * 2026-11-10 (Eigentümer: „das Ganze als Spiel, ohne unnötige Klicks") — VON SELBST WEITER: nach AUTO_S Sekunden der nächste
   * Teil (oder ohne Weg die Karte). Jede Berührung, Taste oder Rad hält es an. Nicht am Ziel, nicht an einem Turm (dort wählt man).
   */
  auto?: boolean;
  /** Der Teil des Weges ist nicht fertig (verlassen): „Pause", und es geht nicht von selbst weiter. */
  paused?: boolean;
  /** 2026-11-10 — der nächste Teil ist ein Turm: gleich erobern (`onNext`) oder erst wiederholen (`prepare` Karten). */
  tower?: { readonly prepare: number; readonly onPrepare: () => void; readonly unseen: number; readonly cards: number } | null;
}) {
  const s = stats;
  const kind = s.kind;
  const head = paused ? t('cogitaWorld.finish.paused')
    : kind === 'arrive' ? t('cogitaWorld.finish.arrive')
      : kind === 'perfect' ? t('cogitaWorld.finish.perfect')
        : kind === 'conquer' ? t('cogitaWorld.finish.conquer', { names: s.conquered.map(nameOf).join(', ') })
          : kind === 'tower' ? (s.level !== null ? t('cogitaWorld.finish.level', { level: s.level.to }) : t('cogitaWorld.finish.run'))
            : kind === 'story' ? t('cogitaWorld.finish.story') : t('cogitaWorld.finish.cards');
  /* 2026-11-10 (Eigentümer: „zu viel auf einmal") — höchstens drei Zahlen: wie gut, was neu sitzt, die Stufen (sonst die gelesenen Schritte). */
  /* 2026-11-12 — jede Zahl ist eine Quelle des Flugs zur Karte (`data-fin-src`, WorldFlight.tsx). */
  const tiles: { label: string; value: number; suffix?: string; accent?: boolean; src: string; score?: number }[] = [];
  if (s.answers > 0) tiles.push({ label: t('cogitaWorld.finish.right'), value: Math.round(s.accuracy * 100), suffix: '%', src: 'right', score: s.accuracy });
  else if (s.visited > 0) tiles.push({ label: t('cogitaWorld.finish.steps'), value: s.visited, src: 'steps' });
  if (s.known > 0) tiles.push({ label: t('cogitaWorld.finish.known'), value: s.known, suffix: '+', accent: true, src: 'known' });
  if (s.level !== null) tiles.push({ label: t('cogitaWorld.finish.levels'), value: s.level.to - s.level.from, suffix: '+', accent: true, src: 'levels' });
  else if (s.points > 0) tiles.push({ label: t('cogitaWorld.finish.points'), value: s.points, suffix: '+', accent: true, src: 'points' });
  const follows = s.consequences.slice(0, FOLLOWS_SHOWN);
  const moreFollows = s.consequences.length - follows.length;
  /* Das Zeichen des Teils (wie in der Kette des Weges). */
  const icon = kind === 'arrive' ? 'target' : kind === 'story' ? 'travel' : kind === 'cards' ? 'learn' : 'run';

  /* Von selbst weiter: der nächste Teil, sonst (ohne Weg) die Karte. Am Ziel und an einem Turm (dort wählt man) nicht. */
  const primary = tower !== null ? null : onNext ?? (onWay === null ? onClose : null);
  const primaryRef = useRef(primary);
  primaryRef.current = primary;
  const [left, setLeft] = useState<number | null>(auto && !paused && primary !== null && kind !== 'arrive' ? AUTO_S : null);
  const counting = left !== null;
  useEffect(() => {
    if (!counting) return undefined;
    const stop = () => setLeft(null);
    const id = window.setInterval(() => { if (!document.hidden) setLeft((x) => (x === null ? null : x - 1)); }, 1000);
    window.addEventListener('pointerdown', stop, true);
    window.addEventListener('keydown', stop, true);
    window.addEventListener('wheel', stop, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pointerdown', stop, true);
      window.removeEventListener('keydown', stop, true);
      window.removeEventListener('wheel', stop, true);
    };
  }, [counting]);
  useEffect(() => { if (left !== null && left <= 0) { setLeft(null); primaryRef.current?.(); } }, [left]);
  /* Esc schliesst die Seite (die Karte bleibt; ein zweites Esc verlässt die ganze Seite). */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); closeRef.current(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <div className={`cg-wm-fin is-${kind}`} role="dialog" aria-modal="false" aria-labelledby="cg-wm-fin-head" data-world-finish={kind} data-world-finish-answers={s.answers} data-world-finish-follows={s.consequences.length}>
      <div className="cg-fin-card" data-fin-src="card">
        <header className="cg-fin-top">
          <span className="cg-fin-badge" aria-hidden="true" data-fin-src="head">{kind === 'conquer' || kind === 'perfect' ? <FlagIcon size={16} /> : <PartIcon kind={icon} />}</span>
          <span className="cg-fin-titles">
            <span className="cg-fin-what">{title}</span>
            <h2 id="cg-wm-fin-head" className="cg-fin-head">{head}</h2>
          </span>
        </header>
        {tiles.length > 0 && (
          <div className="cg-fin-tiles">
            {tiles.slice(0, 3).map((x, i) => <Tile key={x.label} i={i} {...x} />)}
          </div>
        )}
        {follows.length > 0 && (
          <section className="cg-fin-follows" aria-label={t('cogitaWorld.finish.follows')}>
            <h3 className="cg-fin-fhead">{t('cogitaWorld.finish.follows')}</h3>
            <ul>
              {follows.map((c, i) => <Follow key={`${c.kind}:${c.kind === 'opened' ? c.section : c.place}`} c={c} i={i} t={t} nameOf={nameOf} sectionName={sectionName} onShow={onShow} />)}
            </ul>
            {moreFollows > 0 && <p className="cg-fin-fmore">{t('cogitaWorld.finish.more', { count: moreFollows })}</p>}
          </section>
        )}
        {next !== null && (
          <div className="cg-fin-next" data-world-finish-next="">
            <span className="cg-fin-nextlabel"><PartIcon kind={tower !== null ? 'run' : 'target'} /> {t('cogitaWorld.way.nextAfter')}</span>
            <span className="cg-fin-nexttext">{next}</span>
            {tower !== null && <span className="cg-fin-nextmeta" data-world-finish-tower={tower.unseen}>{tower.unseen > 0 ? t('cogitaWorld.panel.conquerUnseen', { count: tower.unseen, all: tower.cards }) : t('cogitaWorld.panel.conquerSays', { count: tower.cards })}</span>}
          </div>
        )}
        <div className="wk-actions cg-fin-actions">
          {onNext !== null && <button type="button" className="wk-btn cg-wm-go" autoFocus onClick={onNext} data-world-finish-go="">{tower !== null ? t('cogitaWorld.panel.conquerNow') : t('cogitaWorld.way.go')} ▶</button>}
          {tower !== null && tower.prepare > 0 && <button type="button" className="wk-btn wk-btn-line" onClick={tower.onPrepare} data-world-finish-prepare={tower.prepare}>{t('cogitaWorld.panel.prepareN', { count: tower.prepare })}</button>}
          {onWay !== null && <button type="button" className={onNext === null ? 'wk-btn' : 'wk-btn wk-btn-line'} autoFocus={onNext === null} onClick={onWay} data-world-finish-way="">{t('cogitaWorld.finish.showWay')}</button>}
          <button type="button" className={onNext === null && onWay === null ? 'wk-btn' : 'wk-link-btn'} autoFocus={onNext === null && onWay === null} onClick={onClose} data-world-finish-close="">{t('cogitaWorld.way.toMap')}</button>
        </div>
        {left !== null && (
          <p className="cg-fin-auto" role="timer" aria-live="off" data-world-finish-auto={left}>
            <span className="cg-fin-autobar" ref={vars({ '--auto-s': `${AUTO_S}s` })} aria-hidden="true" />
            {onNext !== null ? t('cogitaWorld.finish.autoGo', { s: left }) : t('cogitaWorld.finish.autoMap', { s: left })}
          </p>
        )}
      </div>
    </div>
  );
}
