/**
 * DIE REGLER DES TEMPOS (`pace.ts`) — wie lange zwischen zwei Sendungen gewartet wird
 * (zwischen den einzelnen Paketen, den Ramki und den Drücken bzw. Aktionen) und wie
 * lange eine Ramka höchstens hinausgeht. Ganz links bzw. ganz rechts: wie gespeichert,
 * so schnell wie möglich. Zweimal da: unter den Knöpfen (nur für die Knöpfe — dort nur
 * die Pause, wie lange sagt das Halten des Knopfs, `SendKey`) und in jedem Timer (beide).
 */

import { isFastest, LIMIT_STEPS, limitText, nearestStep, packetInterval, PAUSE_STEPS, pauseText, FASTEST, type Pace } from './pace';

export function PaceControl({ pace, onChange, title, between, note, limit = true }: {
  pace: Pace;
  onChange: (next: Pace) => void;
  title: string;
  /** Wo die Pause ausser zwischen den Paketen noch steht: „między ramkami i naciśnięciami". */
  between: string;
  note: string;
  /** Den Regler „jak długo nadawać" zeigen (die Timer) — die Knöpfe haben stattdessen das Halten. */
  limit?: boolean;
}) {
  const pauseAt = nearestStep(PAUSE_STEPS, pace.pauseMs);
  /* Das Limit hat eine Stufe mehr: ganz rechts „jak zapisano" (kein Limit). */
  const limitAt = pace.limitMs === null ? LIMIT_STEPS.length : nearestStep(LIMIT_STEPS, pace.limitMs);

  return (
    <section className="wk-box lp-pace" aria-label={title}>
      <div className="wk-box-head">
        <h2 className="wk-box-title">{title}</h2>
        {!isFastest(pace) && (
          <button type="button" className="wk-link-btn lp-head-end" onClick={() => onChange(FASTEST)}>Najszybciej</button>
        )}
      </div>
      <div className="wk-box-body">
        <label className="lp-slider">
          <span className="lp-slider-head">
            <span>Przerwa między pakietami</span>
            <strong>{pauseText(pace.pauseMs)}</strong>
          </span>
          <input type="range" min={0} max={PAUSE_STEPS.length - 1} step={1} value={pauseAt}
            aria-valuetext={pauseText(pace.pauseMs)}
            onChange={(e) => onChange({ ...pace, pauseMs: PAUSE_STEPS[Number(e.target.value)] })} />
          <span className="lp-slider-ends"><span>najszybciej</span><span>wolniej</span></span>
          <span className="lp-facts">
            {pace.pauseMs === 0
              ? `Pakiet co ${packetInterval(pace)} ms — najszybciej, jak nadaje Android.`
              : `Pakiet co ${packetInterval(pace)} ms; tyle samo przerwy ${between}.`}
          </span>
        </label>
        {limit && (
          <label className="lp-slider">
            <span className="lp-slider-head">
              <span>Jak długo nadawać</span>
              <strong>{limitText(pace.limitMs)}</strong>
            </span>
            <input type="range" min={0} max={LIMIT_STEPS.length} step={1} value={limitAt}
              aria-valuetext={limitText(pace.limitMs)}
              onChange={(e) => {
                const at = Number(e.target.value);
                onChange({ ...pace, limitMs: at >= LIMIT_STEPS.length ? null : LIMIT_STEPS[at] });
              }} />
            <span className="lp-slider-ends"><span>krócej</span><span>jak zapisano</span></span>
          </label>
        )}
        <p className="wk-working">{note}</p>
      </div>
    </section>
  );
}
