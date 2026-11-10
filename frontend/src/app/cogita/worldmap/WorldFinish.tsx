/**
 * 2026-11-10 (Eigentümer: „im Vollbild Animationen, besonders beim Abschluss — ein Überblick über die Zahlen dieses Teils") —
 * DER ABSCHLUSS EINES TEILS im Vollbild: eine Animation je Art (`wmFinish.ts`: Feuerwerk, Stern, Fahne, Stufen, Seiten, Ring),
 * darunter die Zahlen, die hochzählen, und die Einladung zum nächsten Teil des Weges.
 * Bewegung nach der Wahl „Animacje": ograniczone/wyłączone zeigen gleich den Endstand (CSS unter `data-motion`).
 */

import { useEffect, useState, type ReactNode } from 'react';

import type { T } from '../../core/i18n';
import { useMotion } from '../../ui/motion';
import { PartIcon } from './WorldWay';
import { cheerOf, scatter, type FinishKind, type FinishStats } from './wmFinish';
import './worldmap.css';

/** Die Farben des Konfetti (wie die Themen der Karte). */
const CONFETTI = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6', '#e34948'];

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

function Confetti({ n = 42, salt = 0 }: { n?: number; salt?: number }) {
  return (
    <div className="cg-fin-confetti" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} ref={vars({
          '--x': `${(scatter(i, salt) * 100).toFixed(1)}%`,
          '--dx': `${((scatter(i, salt + 1) - 0.5) * 160).toFixed(0)}px`,
          '--rot': `${(scatter(i, salt + 2) * 900 - 450).toFixed(0)}deg`,
          '--delay': `${(scatter(i, salt + 3) * 0.9).toFixed(2)}s`,
          '--dur': `${(2.2 + scatter(i, salt + 4) * 1.6).toFixed(2)}s`,
          '--c': CONFETTI[i % CONFETTI.length]
        })} />
      ))}
    </div>
  );
}

/* -- Die sechs Animationen --------------------------------------------------------------------------------------------- */

/** Karten: der Ring der Treffer füllt sich, die Quote zählt hoch. */
function RingArt({ s }: { s: FinishStats }) {
  const pct = useCount(Math.round(s.accuracy * 100), 300, 1100);
  const C = 2 * Math.PI * 52;
  return (
    <svg className="cg-fin-ring" viewBox="0 0 140 140" aria-hidden="true">
      <circle className="cg-fin-ringbg" cx="70" cy="70" r="52" />
      <circle className="cg-fin-ringfg" cx="70" cy="70" r="52" ref={vars({ '--c': C.toFixed(1), '--off': (C * (1 - s.accuracy)).toFixed(1) })} />
      {Array.from({ length: 8 }, (_, i) => <circle key={i} className="cg-fin-spark" cx={70 + 64 * Math.cos((i * Math.PI) / 4)} cy={70 + 64 * Math.sin((i * Math.PI) / 4)} r="3" ref={vars({ '--d': `${1.2 + i * 0.06}s` })} />)}
      <text x="70" y="78" textAnchor="middle" className="cg-fin-ringtxt">{pct}%</text>
    </svg>
  );
}

/** Erzählung: ein Buch, dessen Seiten umschlagen. */
function BookArt() {
  return (
    <div className="cg-fin-book" aria-hidden="true">
      <span className="cg-fin-cover is-left" />
      <span className="cg-fin-cover is-right" />
      {[0, 1, 2, 3].map((i) => <span key={i} className="cg-fin-leaf" ref={vars({ '--d': `${0.25 + i * 0.32}s` })} />)}
      <span className="cg-fin-bookmark" />
    </div>
  );
}

/** Durchgang: der Turm; seine Stufen leuchten eine nach der anderen auf (bis zur erreichten). */
function TowerArt({ s, flag = false }: { s: FinishStats; flag?: boolean }) {
  const of = Math.max(1, s.level?.of ?? 3);
  const from = s.level?.from ?? 0;
  const to = flag ? of : s.level?.to ?? from;
  const H = flag ? 82 : 96;
  const band = H / of;
  return (
    <svg className={`cg-fin-tower${flag ? ' has-flag' : ''}`} viewBox="0 0 140 150" aria-hidden="true">
      <ellipse className="cg-fin-shadow" cx="70" cy="140" rx="46" ry="7" />
      <g className="cg-fin-rise">
        <rect className="cg-fin-body" x="40" y={138 - H} width="60" height={H} rx="3" />
        {Array.from({ length: of }, (_, i) => {
          const lit = i < to;
          const fresh = i >= from && i < to;
          return <rect key={i} className={`cg-fin-band${lit ? ' is-lit' : ''}${fresh ? ' is-fresh' : ''}`} x="43" y={138 - (i + 1) * band + 2} width="54" height={band - 4} rx="2"
            ref={vars({ '--d': `${0.5 + (i - from) * 0.38}s` })} />;
        })}
        <ellipse className="cg-fin-top" cx="70" cy={138 - H} rx="30" ry="8" />
        {[48, 62, 76, 90].map((x) => <rect key={x} className="cg-fin-merlon" x={x - 4} y={138 - H - 12} width="8" height="10" />)}
        {flag && (
          <g className="cg-fin-flag">
            <line x1="70" y1={138 - H - 12} x2="70" y2={138 - H - 46} className="cg-fin-pole" />
            <path className="cg-fin-cloth" d={`M70 ${138 - H - 46} L98 ${138 - H - 39} L70 ${138 - H - 30} Z`} />
          </g>
        )}
      </g>
    </svg>
  );
}

/** Mistrzowsko: ein Stern, Strahlen, die sich drehen, Funken. */
function StarArt() {
  const pts = Array.from({ length: 10 }, (_, i) => { const r = i % 2 === 0 ? 50 : 21; const a = -Math.PI / 2 + (i * Math.PI) / 5; return `${(70 + r * Math.cos(a)).toFixed(1)},${(70 + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
  return (
    <svg className="cg-fin-star" viewBox="0 0 140 140" aria-hidden="true">
      <g className="cg-fin-rays">{Array.from({ length: 12 }, (_, i) => <path key={i} d="M70 70 L66 4 L74 4 Z" transform={`rotate(${i * 30} 70 70)`} />)}</g>
      <polygon className="cg-fin-starbody" points={pts} />
      {Array.from({ length: 10 }, (_, i) => <circle key={i} className="cg-fin-spark" cx={70 + 62 * Math.cos(i * 0.63)} cy={70 + 62 * Math.sin(i * 0.63)} r="2.6" ref={vars({ '--d': `${0.6 + scatter(i, 7) * 0.8}s` })} />)}
    </svg>
  );
}

/** Ziel erreicht: Feuerwerk um die Fahne. */
function FireworksArt() {
  const bursts = [[40, 40], [104, 30], [70, 18], [24, 86], [118, 80]];
  return (
    <svg className="cg-fin-fireworks" viewBox="0 0 140 140" aria-hidden="true">
      {bursts.map(([x, y], b) => (
        <g key={b} className="cg-fin-burst" transform={`translate(${x} ${y})`} ref={vars({ '--d': `${0.2 + b * 0.45}s`, '--c': CONFETTI[b % CONFETTI.length] })}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <line key={i} x1={Math.cos(a) * 4} y1={Math.sin(a) * 4} x2={Math.cos(a) * 18} y2={Math.sin(a) * 18} />;
          })}
        </g>
      ))}
      <g className="cg-fin-goal">
        <line x1="62" y1="126" x2="62" y2="66" className="cg-fin-pole" />
        <path className="cg-fin-cloth" d="M62 66 L98 76 L62 88 Z" />
      </g>
    </svg>
  );
}

function artOf(kind: FinishKind, s: FinishStats): ReactNode {
  switch (kind) {
    case 'arrive': return <FireworksArt />;
    case 'perfect': return <StarArt />;
    case 'conquer': return <TowerArt s={s} flag />;
    case 'tower': return <TowerArt s={s} />;
    case 'story': return <BookArt />;
    case 'cards': return <RingArt s={s} />;
  }
}

/* -- Die Zahlen ---------------------------------------------------------------------------------------------------------- */

function Tile({ label, value, suffix = '', i, accent = false }: { label: string; value: number; suffix?: string; i: number; accent?: boolean }) {
  const v = useCount(value, 500 + i * 160);
  return (
    <div className={`cg-fin-tile${accent ? ' is-accent' : ''}`} ref={vars({ '--i': i })} data-world-finish-tile={label}>
      <span className="cg-fin-num">{suffix === '+' ? `+${v}` : `${v}${suffix}`}</span>
      <span className="cg-fin-label">{label}</span>
    </div>
  );
}

const clock = (ms: number): string => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function FinishShow({ stats, title, t, nameOf, next, onNext, onWay, onClose }: {
  stats: FinishStats;
  /** Was eben zu Ende ging (der Name des Teils). */
  title: string;
  t: T;
  nameOf: (id: string) => string;
  /** Der nächste Teil des Weges (Text), null ohne Navigation oder am Ziel. */
  next: string | null;
  onNext: (() => void) | null;
  onWay: (() => void) | null;
  onClose: () => void;
}) {
  const s = stats;
  const kind = s.kind;
  const head = kind === 'arrive' ? t('cogitaWorld.finish.arrive')
    : kind === 'perfect' ? t('cogitaWorld.finish.perfect')
      : kind === 'conquer' ? t('cogitaWorld.finish.conquer', { names: s.conquered.map(nameOf).join(', ') })
        : kind === 'tower' ? (s.level !== null ? t('cogitaWorld.finish.level', { level: s.level.to }) : t('cogitaWorld.finish.run'))
          : kind === 'story' ? t('cogitaWorld.finish.story') : t('cogitaWorld.finish.cards');
  const tiles: { label: string; value: number; suffix?: string; accent?: boolean }[] = [];
  if (s.answers > 0) tiles.push({ label: t('cogitaWorld.finish.answers'), value: s.answers });
  if (s.answers > 0) tiles.push({ label: t('cogitaWorld.finish.right'), value: Math.round(s.accuracy * 100), suffix: '%', accent: s.accuracy >= 0.9 });
  if (s.visited > 0) tiles.push({ label: t('cogitaWorld.finish.steps'), value: s.visited });
  if (s.met > 0) tiles.push({ label: t('cogitaWorld.finish.met'), value: s.met, suffix: '+' });
  if (s.known > 0) tiles.push({ label: t('cogitaWorld.finish.known'), value: s.known, suffix: '+', accent: true });
  if (s.level !== null) tiles.push({ label: t('cogitaWorld.finish.levels'), value: s.level.to - s.level.from, suffix: '+', accent: true });
  if (s.points > 0) tiles.push({ label: t('cogitaWorld.finish.points'), value: s.points, suffix: '+', accent: true });
  const festive = kind === 'arrive' || kind === 'perfect' || kind === 'conquer';
  return (
    <div className={`cg-wm-fin is-${kind}`} role="dialog" aria-modal="true" aria-labelledby="cg-wm-fin-head" data-world-finish={kind} data-world-finish-answers={s.answers}>
      {festive && <Confetti salt={kind.length} />}
      <div className="cg-fin-card">
        <div className="cg-fin-art">{artOf(kind, s)}</div>
        <p className="cg-fin-what">{title}</p>
        <h2 id="cg-wm-fin-head" className="cg-fin-head">{head}</h2>
        <p className="cg-fin-cheer">{t(`cogitaWorld.finish.cheer.${cheerOf(s)}`)}{s.ms >= 5000 ? ` · ${t('cogitaWorld.finish.time', { time: clock(s.ms) })}` : ''}</p>
        {tiles.length > 0 && (
          <div className="cg-fin-tiles">
            {tiles.slice(0, 6).map((x, i) => <Tile key={x.label} i={i} {...x} />)}
          </div>
        )}
        {s.just.length > 0 && <p className="cg-fin-way">✓ {t('cogitaWorld.finish.parts', { count: s.just.length })}</p>}
        {next !== null && (
          <div className="cg-fin-next" data-world-finish-next="">
            <span className="cg-fin-nextlabel"><PartIcon kind="target" /> {t('cogitaWorld.way.nextAfter')}</span>
            <span className="cg-fin-nexttext">{next}</span>
          </div>
        )}
        <div className="wk-actions cg-fin-actions">
          {onNext !== null && <button type="button" className="wk-btn cg-wm-go" autoFocus onClick={onNext} data-world-finish-go="">{t('cogitaWorld.way.go')} ▶</button>}
          {onWay !== null && <button type="button" className={onNext === null ? 'wk-btn' : 'wk-btn wk-btn-line'} autoFocus={onNext === null} onClick={onWay} data-world-finish-way="">{t('cogitaWorld.finish.showWay')}</button>}
          <button type="button" className={onNext === null && onWay === null ? 'wk-btn' : 'wk-link-btn'} autoFocus={onNext === null && onWay === null} onClick={onClose} data-world-finish-close="">{t('cogitaWorld.way.toMap')}</button>
        </div>
      </div>
    </div>
  );
}
