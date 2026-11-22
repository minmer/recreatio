/**
 * 2026-11-09 — DIE STUFEN DER WELTKARTE EINSTELLEN (spec §7.1, §4.7; Entscheidung 8): wie viele (0–5), je Stufe Schwelle,
 * was zählt und der Abstand; ohne Stufen der Anteil gekonnter Karten; die Breite der Säulen. Derselbe Baustein für den
 * Admin (Ustawienia der Baza — erst „Zapisz", vorher steht da, wie viele Karten die Wiederholungen verlassen) und für den
 * Lernenden („Moja mapa świata": gilt sofort, gerechnet wird aus den rohen Durchgängen, nichts geht verloren).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Card } from '../cardBasics';
import { tFor, type T } from '../../core/i18n';
import { baseLang } from '../lang';
import { renamer, type Learner } from '../learn';
import { useCtx } from '../ui';
import type { CogitaLibrary } from '../store';
import { effectiveWorldFor, leavingReviews, reportDueFor, reviewWorldOf } from './wmReview';
import { useServerRuns } from './useServerRuns';
import { ATTEMPTS, DEFAULT_SETUP, defaultRules, levelsSetupDoc, MAX_LEVELS, PILLAR_MIN, type Attempts, type LevelRule, type LevelsSetup } from './wmRuns';
import { isRecommendedLevels, levelsChange, levelsChangeWords, recommendedLevels } from './levelsChange';
import './worldmap.css';

const ATTEMPT_KEY: Readonly<Record<Attempts, string>> = { any: 'cogitaWorld.settings.attemptsAny', one: 'cogitaWorld.settings.attemptsOne', first: 'cogitaWorld.settings.attemptsFirst' };
export const attemptsText = (a: Attempts, t: T): string => t(ATTEMPT_KEY[a]);

/** Die Regeln für `n` Stufen: was schon da ist, bleibt; der Rest aus der Vorgabe. */
const rulesFor = (n: number, had: readonly LevelRule[]): LevelRule[] => defaultRules(n).map((d, i) => had[i] ?? d);

/** Wie viele Stufen, und je Stufe ihre Regel. */
export function LevelsEditor({ levels, rules, onChange, disabled = false, t }: {
  levels: number;
  rules: readonly LevelRule[];
  onChange: (next: { readonly levels: number; readonly rules: readonly LevelRule[] }) => void;
  disabled?: boolean;
  t: T;
}) {
  const set = (i: number, patch: Partial<LevelRule>) => onChange({ levels, rules: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const num = (v: string, lo: number, hi: number): number | null => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
  return (
    <div className="cg" data-levels-editor={levels}>
      <div className="cg-row">
        <span className="cg-muted">{t('cogitaWorld.settings.levels')}:</span>
        <span className="cg-subtabs" role="radiogroup" aria-label={t('cogitaWorld.settings.levels')}>
          {Array.from({ length: MAX_LEVELS + 1 }, (_, n) => (
            <button key={n} type="button" role="radio" aria-checked={levels === n} className={levels === n ? 'is-on' : ''} disabled={disabled}
              onClick={() => { if (levels !== n) onChange({ levels: n, rules: rulesFor(n, rules) }); }} data-levels-n={n}>{n === 0 ? t('cogitaWorld.settings.levelsNone') : n}</button>
          ))}
        </span>
      </div>
      {rules.slice(0, levels).map((r, i) => (
        <fieldset key={i} className="cg-world-rule" data-level-rule={i + 1}>
          <legend>{t('cogitaWorld.settings.levelN', { n: i + 1 })}</legend>
          <div className="cg-row">
            <label className="wk-field">
              <span>{t('cogitaWorld.settings.pct')}</span>
              <input type="number" inputMode="numeric" min={1} max={100} step={1} value={r.pct} disabled={disabled}
                onChange={(e) => { const n = num(e.target.value, 1, 100); if (n !== null) set(i, { pct: Math.round(n) }); }} data-level-pct={i + 1} />
            </label>
            <label className="wk-field">
              <span>{t('cogitaWorld.settings.attempts')}</span>
              <select value={r.attempts} disabled={disabled} onChange={(e) => set(i, { attempts: e.target.value as Attempts })} data-level-attempts={i + 1}>
                {ATTEMPTS.map((a) => <option key={a} value={a}>{attemptsText(a, t)}</option>)}
              </select>
            </label>
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Die Breite der Säulen: stufenlos 40–100 %. `onLive` bei jeder Bewegung (nur neu zeichnen), `onCommit` am Ende. */
export function PillarSlider({ value, onLive, onCommit, disabled = false, t }: { value: number; onLive?: (w: number) => void; onCommit: (w: number) => void; disabled?: boolean; t: T }) {
  const [shown, setShown] = useState(value);
  useEffect(() => { setShown(value); }, [value]);
  const pct = Math.round(shown * 100);
  return (
    <label className="wk-field cg-world-pillar" data-pillar-width={pct}>
      <span>{t('cogitaWorld.settings.pillar')} · {t('cogitaWorld.settings.pillarSays', { pct })}</span>
      <input type="range" min={Math.round(PILLAR_MIN * 100)} max={100} step={1} value={pct} disabled={disabled}
        onChange={(e) => { const w = Number(e.target.value) / 100; setShown(w); onLive?.(w); }}
        onPointerUp={() => onCommit(shown)} onKeyUp={() => onCommit(shown)} onBlur={() => { if (Math.abs(shown - value) > 1e-6) onCommit(shown); }} data-pillar-slider="" />
    </label>
  );
}

/** FÜR DEN BEREICH (Ustawienia der Baza): erst ein Entwurf — davor, wie viele Karten die Wiederholungen verlassen würden. */
export function AreaWorldSettings({ lib, busy, onSave }: { lib: CogitaLibrary; busy: boolean; onSave: (levelsSetup: unknown) => void }) {
  const t = tFor(baseLang(lib));
  /* PR A — bevor der Dienst Durchgänge speichert, lassen sich keine Stufen einschalten (sie gälten ohnehin als 0). */
  const runs = useServerRuns();
  const area = lib.settings().levelsSetup;
  const areaKey = JSON.stringify(area === undefined ? null : levelsSetupDoc(area));
  const [draft, setDraft] = useState<LevelsSetup>(area ?? DEFAULT_SETUP);
  useEffect(() => { setDraft(area ?? DEFAULT_SETUP); }, [areaKey]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Step 3 · 3 — gespeichert (die Stufen der Baza änderten sich): die Erinnerung des Dienstes für den, der hier lernt, gleich neu. */
  const { learner: here } = useCtx();
  const savedKey = useRef(areaKey);
  useEffect(() => {
    if (savedKey.current === areaKey) return;
    savedKey.current = areaKey;
    if (here == null) return;
    void lib.cards().then((r) => reportDueFor(lib, r.cards, here, renamer(lib.merges())), () => undefined);
  }, [areaKey, here, lib]);
  const [cards, setCards] = useState<readonly Card[] | null>(lib.cardsReady() ?? null);
  useEffect(() => {
    let alive = true;
    void lib.cards().then((r) => { if (alive) setCards(r.cards); }).catch(() => undefined);
    return () => { alive = false; };
  }, [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Ein Lernender ohne Durchgänge (alle bestehenden): jede Karte eines Ortes verlässt die Wiederholungen, bis er erobert. */
  /* Step 3 · 2 — nur Karten, deren Ort eine Weltkarte der Baza zeigt; ohne Weltkarte wirken Stufen nicht auf Wiederholungen. */
  const reviewWorld = useMemo(() => (cards === null ? null : reviewWorldOf(lib, cards)), [cards, lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const leaving = useMemo(() => (cards === null ? null : leavingReviews(reviewWorld, cards.map((c) => c.key), [], draft)), [cards, draft, reviewWorld]);
  const changed = JSON.stringify(levelsSetupDoc(draft)) !== areaKey;
  /* 2026-11-22 (guide-good-world §1.3, I7) — dieselben Worte wie im Import: was eine andere Einstellung für die Lernenden heisst. */
  const changeSaid = useMemo(() => { const c = levelsChange(area, draft); return c === null ? null : levelsChangeWords(c, t); }, [area, draft, t]);
  return (
    <section className="cg-card" data-settings-world={area === undefined ? 'none' : area.levels}>
      <h3>{t('cogitaWorld.settings.title')}</h3>
      <p className="cg-muted">{t('cogitaWorld.settings.says')}</p>
      {/* 2026-11-22 (I7) — die Empfehlung für jede Welt: ein Klick setzt sie in den Entwurf (gespeichert wird erst mit „Zapisz"). */}
      {!isRecommendedLevels(draft) && (
        <p className="cg-muted">
          <button type="button" className="wk-link-btn" disabled={busy} data-world-recommended=""
            onClick={() => setDraft({ ...recommendedLevels(), pillarWidth: draft.pillarWidth, locked: draft.locked })}>{t('cogitaWorld.settings.recommended')}</button>
          {' '}{t('cogitaWorld.settings.recommendedSays')}
        </p>
      )}
      <LevelsEditor levels={draft.levels} rules={draft.rules} disabled={busy} t={t} onChange={(v) => setDraft({ ...draft, levels: v.levels, rules: v.rules })} />
      {changed && changeSaid !== null && <p className="wk-note" data-world-levels-change="">{changeSaid.line} {changeSaid.learners}</p>}
      {draft.levels === 0 && (
        <label className="wk-field">
          <span>{t('cogitaWorld.settings.knownShare')}</span>
          <input type="number" inputMode="numeric" min={10} max={100} step={1} value={Math.round(draft.knownShare * 100)} disabled={busy}
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) setDraft({ ...draft, knownShare: Math.max(0.1, Math.min(1, n / 100)) }); }} data-world-known-share="" />
        </label>
      )}
      {/* 2026-11-10 — ab wann sich die Pfade eines Turms öffnen (`openAt`): erobert, sofort, oder ab Stufe k. */}
      <label className="wk-field">
        <span>{t('cogitaWorld.settings.openAt')}</span>
        <select value={draft.openAt === undefined ? 'conquered' : String(draft.openAt)} disabled={busy} data-world-open-at=""
          onChange={(e) => { const v = e.target.value; setDraft((d) => { const { openAt: _drop, ...rest } = d; return v === 'conquered' ? rest : { ...rest, openAt: Number(v) }; }); }}>
          <option value="conquered">{t('cogitaWorld.settings.openAtConquered')}</option>
          <option value="0">{t('cogitaWorld.settings.openAtAlways')}</option>
          {Array.from({ length: Math.max(0, draft.levels - 1) }, (_, i) => <option key={i + 1} value={String(i + 1)}>{t('cogitaWorld.settings.openAtLevel', { level: i + 1 })}</option>)}
        </select>
        <span className="cg-muted">{t('cogitaWorld.settings.openAtSays')}</span>
      </label>
      <PillarSlider value={draft.pillarWidth} disabled={busy} t={t} onCommit={(w) => setDraft((d) => ({ ...d, pillarWidth: w }))} onLive={(w) => setDraft((d) => ({ ...d, pillarWidth: w }))} />
      <label className="pe-check">
        <input type="checkbox" checked={!draft.locked} disabled={busy} onChange={(e) => setDraft({ ...draft, locked: !e.target.checked })} data-world-may-change="" />
        <span>{t('cogitaWorld.settings.mayChange')}</span>
      </label>
      {leaving !== null && <p className={leaving > 0 ? 'wk-note' : 'cg-muted'} data-world-leaving={leaving}>{leaving === 0 ? t('cogitaWorld.settings.leavingNone') : t('cogitaWorld.settings.leaving', { count: leaving })}</p>}
      {!runs && <p className="wk-note" data-world-server-old="">{t('cogitaWorld.settings.serverOldArea')}</p>}
      {cards !== null && reviewWorld === null && draft.levels > 0 && <p className="cg-muted" data-world-no-world-view="">{t('cogitaWorld.settings.noWorldView')}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy || !changed || (!runs && draft.levels > 0)} onClick={() => onSave(levelsSetupDoc(draft))} data-world-save="">{t('cogitaWorld.settings.save')}</button>
        {area !== undefined && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onSave(undefined)} data-world-clear="">{t('cogitaWorld.settings.clear')}</button>}
      </div>
    </section>
  );
}

/** DER LERNENDE („Moja mapa świata"): eigene Stufen und Breite — gilt sofort; gesperrt: nur, was gilt. */
export function OwnWorldSettings({ lib, learner, onPillarLive }: { lib: CogitaLibrary; learner: Learner | null; onPillarLive?: (w: number) => void }) {
  const t = tFor(baseLang(lib));
  const [busy, setBusy] = useState(false);
  const runs = useServerRuns();
  if (learner === null) return null;
  /* PR A — mit Konto erst, wenn der Dienst Durchgänge speichert; ohne Konto bleiben sie im Browser. */
  const on = learner.holder.kind === 'local' || runs;
  const eff = effectiveWorldFor(lib, learner);
  const keep = (work: Promise<void>) => { setBusy(true); void work.catch(() => undefined).finally(() => setBusy(false)); };
  /* Step 3 · 3 — eigene Stufen gespeichert: die Erinnerung des Dienstes gleich neu. */
  const keepLevels = (next: Parameters<Learner['keepLevels']>[0]) => keep(learner.keepLevels(next).then(() => lib.cards()).then((r) => reportDueFor(lib, r.cards, learner, renamer(lib.merges()))));
  const from = eff.from === 'own' ? null : eff.from === 'area' ? t('cogitaWorld.settings.fromArea') : t('cogitaWorld.settings.fromDefault');
  return (
    <section className="cg-card" data-world-own={eff.from} data-world-levels={eff.levels}>
      <h3>{t('cogitaWorld.settings.own')}</h3>
      <p className="cg-muted">{t('cogitaWorld.settings.ownSays')}{from !== null && <> <span>({from})</span></>}</p>
      {!on && <p className="cg-muted" data-world-server-old="">{t('cogitaWorld.settings.serverOld')}</p>}
      {on && eff.changeable && <LevelsEditor levels={eff.levels} rules={eff.rules} disabled={busy} t={t} onChange={(v) => keepLevels(v)} />}
      {on && !eff.changeable && <p className="cg-muted" data-world-locked="">{t('cogitaWorld.settings.locked')} {t('cogitaWorld.settings.levels')}: {eff.levels}</p>}
      {on && eff.changeable && eff.from === 'own' && (
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => keepLevels(null)} data-world-own-reset="">{t('cogitaWorld.settings.useArea')}</button>
      )}
      <PillarSlider value={eff.pillarWidth} disabled={busy} t={t} onLive={onPillarLive} onCommit={(w) => keep(learner.keepPillar(w))} />
    </section>
  );
}

/**
 * 2026-11-14 (Eigentümer: „ein eroberter Turm, der nicht auf der Stern-Stufe ist: ‚Zdobądź w pełni' — danach die Stufen mit Erklärung,
 * dann Start") — DIE TAFEL VOR EINEM DURCHGANG AUF MEHR: jede Stufe mit ihrer Regel (erreicht ✓), darunter der Stern; ein Satz, was der
 * Durchgang tut; „Rozpocznij przebieg".
 */
export function FullConquerSheet({ name, levels, rules, reached, perfect, t, onStart, onClose }: {
  name: string;
  levels: number;
  rules: readonly LevelRule[];
  reached: number;
  perfect: boolean;
  t: T;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="cg-wm-sheetback" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} data-world-full-sheet="">
      <section className="cg-wm-sheet cg-wm-fullsheet" role="dialog" aria-modal="true" aria-label={t('cogitaWorld.full.title', { name })}>
        <button type="button" className="cg-wm-wayx cg-wm-sheetx" onClick={onClose} aria-label={t('cogitaWorld.panel.close')}>×</button>
        <h3 className="cg-wm-sheethead">{t('cogitaWorld.full.title', { name })}</h3>
        <p className="cg-wm-sheetabout">{t('cogitaWorld.full.says')}</p>
        <ol className="cg-wm-fulllevels">
          {Array.from({ length: levels }, (_v, i) => {
            const r = rules[i];
            const done = reached > i;
            return (
              <li key={i} className={done ? 'is-done' : ''} data-world-full-level={i + 1}>
                <span className="cg-wm-fullmark" aria-hidden="true">{done ? '✓' : i + 1}</span>
                <span>{t('cogitaWorld.full.level', { level: i + 1 })}{r === undefined ? '' : ` — ${r.pct} % · ${attemptsText(r.attempts, t)}`}</span>
              </li>
            );
          })}
          <li className={perfect ? 'is-done is-star' : 'is-star'} data-world-full-level="star">
            <span className="cg-wm-fullmark" aria-hidden="true">★</span>
            <span>{t('cogitaWorld.full.star')}</span>
          </li>
        </ol>
        <p className="cg-wm-meta">{t('cogitaWorld.full.how')}</p>
        <div className="cg-wm-sheetbtns">
          <button type="button" className="wk-btn cg-wm-go" autoFocus onClick={onStart} data-world-full-start="">{t('cogitaWorld.run.start')} ▶</button>
        </div>
      </section>
    </div>
  );
}
