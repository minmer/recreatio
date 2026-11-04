/**
 * 2026-11-04 (Prompt 15) — DIE ABSTÄNDE DER WIEDERHOLUNGEN EINSTELLEN (`spacing.ts`): drei Namen („Standard", „Lżej",
 * „Raz i gotowe") und „Zaawansowane" mit beiden Werten genau. Derselbe Baustein für den Bereich (Ustawienia der Baza)
 * und für den Lernenden selbst (Nauka: die Zeile „Powtórki: …" und „Zmień").
 */

import { useEffect, useId, useState } from 'react';

import type { Spacing } from './knowness';
import { baseLang, spacingWords, type SpacingWords } from './lang';
import type { Learner } from './learn';
import {
  effectiveFor, FIRST_MAX, FIRST_MIN, GROWTH_MAX, GROWTH_MIN, PRESET_SPACING, presetOf, readSpacing, SPACING_PRESETS, SPACING_UNITS, UNIT_MS, unitOf,
  type SpacingUnit
} from './spacing';
import type { CogitaLibrary } from './store';

/** Ein Abstand in Worten: „15 minut", „1 rok". */
export function durationText(ms: number, W: SpacingWords): string {
  const { amount, unit } = unitOf(ms);
  return `${amount} ${amount === 1 ? W.unitOne[unit] : W.unit[unit]}`;
}

/** Der Name einer Einstellung — ein Preset oder „własne" mit den Werten. */
export function spacingName(sp: Spacing, W: SpacingWords): string {
  const p = presetOf(sp);
  return p === null ? `${W.custom} (${W.summary(durationText(sp.first, W), sp.growth)})` : W.preset[p];
}

/** Die Wahl: Namen, und darunter „Zaawansowane". */
export function SpacingPicker({ value, onChange, disabled = false, W }: { value: Spacing; onChange: (sp: Spacing) => void; disabled?: boolean; W: SpacingWords }) {
  const name = useId();
  const chosen = presetOf(value);
  const start = unitOf(value.first);
  const [amount, setAmount] = useState(String(start.amount));
  const [unit, setUnit] = useState<SpacingUnit>(start.unit);
  const [growth, setGrowth] = useState(String(value.growth));
  useEffect(() => {
    const u = unitOf(value.first);
    setAmount(String(u.amount));
    setUnit(u.unit);
    setGrowth(String(value.growth));
  }, [value.first, value.growth]);
  const exact = readSpacing({ first: Number(amount.replace(',', '.')) * UNIT_MS[unit], growth: Number(growth.replace(',', '.')) });
  const valid = exact !== undefined && Number(amount.replace(',', '.')) > 0;
  return (
    <div className="cg" data-spacing-picker={chosen ?? 'custom'}>
      {SPACING_PRESETS.map((p) => (
        <label key={p} className="pe-check">
          <input type="radio" name={name} checked={chosen === p} disabled={disabled} onChange={() => onChange(PRESET_SPACING[p])} data-spacing-preset={p} />
          <span><strong>{W.preset[p]}</strong> — {W.presetSays[p]}</span>
        </label>
      ))}
      <details open={chosen === null}>
        <summary>{W.advanced}{chosen === null ? ` · ${W.summary(durationText(value.first, W), value.growth)}` : ''}</summary>
        <div className="cg-row">
          <label className="wk-field">
            <span>{W.first}</span>
            <input type="number" inputMode="decimal" min={0} step="any" value={amount} disabled={disabled} onChange={(e) => setAmount(e.target.value)} data-spacing-first="" />
          </label>
          <label className="wk-field">
            <span>&nbsp;</span>
            <select value={unit} disabled={disabled} onChange={(e) => setUnit(e.target.value as SpacingUnit)} data-spacing-unit="">
              {SPACING_UNITS.map((u) => <option key={u} value={u}>{W.unit[u]}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>{W.growth}</span>
            <input type="number" inputMode="decimal" min={GROWTH_MIN} max={GROWTH_MAX} step="any" value={growth} disabled={disabled} onChange={(e) => setGrowth(e.target.value)} data-spacing-growth="" />
          </label>
        </div>
        <p className="cg-muted">{W.first}: {W.firstSays} ({durationText(FIRST_MIN, W)} – {durationText(FIRST_MAX, W)})</p>
        <p className="cg-muted">{W.growth}: {W.growthSays}</p>
        <button type="button" className="wk-btn" disabled={disabled || !valid} onClick={() => { if (exact !== undefined) onChange(exact); }} data-spacing-apply="">{W.apply}</button>
      </details>
    </div>
  );
}

/**
 * FÜR DEN LERNENDEN, wo Wiederholungen beginnen: „Powtórki: Raz i gotowe · Zmień" — darunter, aufgeklappt, die Wahl (oder,
 * vom Bereich festgelegt, warum es nicht geht).
 */
export function SpacingLine({ lib, learner }: { lib: CogitaLibrary; learner: Learner | null }) {
  const W = spacingWords(baseLang(lib));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const eff = effectiveFor(lib, learner);
  const area = lib.settings().spacing;
  const from = eff.from === 'own' ? W.fromOwn : eff.from === 'area' ? W.fromArea : W.fromDefault;
  const keep = (sp: Spacing | null) => {
    if (learner === null) return;
    setBusy(true);
    void learner.keepSpacing(sp).catch(() => undefined).finally(() => setBusy(false));
  };
  return (
    <div className="cg" data-spacing-line={presetOf(eff.spacing) ?? 'custom'} data-spacing-from={eff.from}>
      <span className="cg-muted">
        {W.line(spacingName(eff.spacing, W))} <span>({from})</span>{' '}
        {learner !== null && <button type="button" className="wk-link-btn" aria-expanded={open} onClick={() => setOpen(!open)} data-spacing-change="">{open ? W.close : W.change}</button>}
      </span>
      {open && learner !== null && (
        <section className="cg-card" data-spacing-own="">
          <h3>{W.title}</h3>
          {!eff.changeable ? <p className="cg-muted">{W.locked}</p> : (
            <>
              <SpacingPicker value={eff.spacing} onChange={(sp) => keep(sp)} disabled={busy} W={W} />
              {eff.from === 'own' && (
                <button type="button" className="wk-link-btn" disabled={busy} onClick={() => keep(null)} data-spacing-reset="">{area === undefined ? W.useDefault : W.useArea}</button>
              )}
              <p className="cg-muted">{W.recompute}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * 2026-11-05 — DIE KURZE WAHL im Baustein „Krajobraz": „Jak często pytać: Częściej · Standard · Lżej · Raz i gotowe · Inne…",
 * darunter in einem Satz, was die gewählte tut. Nur wenn der Lernende es darf — hat der Bereich es festgelegt, steht nur
 * da, was gilt. Gespeichert wie in `SpacingLine` (`learner.keepSpacing`): für diese Baza, überall.
 */
export function SpacingChoice({ lib, learner }: { lib: CogitaLibrary; learner: Learner | null }) {
  const W = spacingWords(baseLang(lib));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (learner === null) return null;
  const eff = effectiveFor(lib, learner);
  const chosen = presetOf(eff.spacing);
  if (!eff.changeable) {
    return <p className="cg-muted" data-spacing-choice="locked">{W.line(spacingName(eff.spacing, W))} <span>({W.fromArea})</span></p>;
  }
  const area = lib.settings().spacing;
  const from = eff.from === 'own' ? null : eff.from === 'area' ? W.fromArea : W.fromDefault;
  const keep = (sp: Spacing | null) => {
    setBusy(true);
    void learner.keepSpacing(sp).catch(() => undefined).finally(() => setBusy(false));
  };
  return (
    <div className="cg-spacing-choice" data-spacing-choice={chosen ?? 'custom'} data-spacing-from={eff.from}>
      <div className="cg-row">
        <span className="cg-muted">{W.ask}:</span>
        <span className="cg-subtabs" role="radiogroup" aria-label={W.ask}>
          {SPACING_PRESETS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={chosen === p} className={chosen === p ? 'is-on' : ''} disabled={busy}
              onClick={() => { if (chosen !== p) keep(PRESET_SPACING[p]); }} data-spacing-preset={p}>{W.preset[p]}</button>
          ))}
          <button type="button" className={chosen === null ? 'is-on' : ''} aria-expanded={open} onClick={() => setOpen(!open)} data-spacing-other="">{chosen === null ? W.custom : W.other}</button>
        </span>
      </div>
      <p className="cg-muted">
        {chosen === null ? W.summary(durationText(eff.spacing.first, W), eff.spacing.growth) : W.presetSays[chosen]}
        {from !== null && <> <span>({from})</span></>}
      </p>
      {open && (
        <section className="cg-card" data-spacing-own="">
          <SpacingPicker value={eff.spacing} onChange={(sp) => keep(sp)} disabled={busy} W={W} />
          {eff.from === 'own' && (
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => keep(null)} data-spacing-reset="">{area === undefined ? W.useDefault : W.useArea}</button>
          )}
          <p className="cg-muted">{W.choiceSays} {W.recompute}</p>
        </section>
      )}
    </div>
  );
}

/** FÜR DEN BEREICH (Ustawienia der Baza): die Abstände für alle — und ob die Lernenden sie für sich ändern dürfen. */
export function AreaSpacingSettings({ lib, busy, onSave }: { lib: CogitaLibrary; busy: boolean; onSave: (spacing: unknown) => void }) {
  const W = spacingWords(baseLang(lib));
  const area = lib.settings().spacing;
  const value: Spacing = area ?? PRESET_SPACING.standard;
  const locked = area?.locked === true;
  return (
    <section className="cg-card" data-settings-spacing={area === undefined ? 'none' : presetOf(area) ?? 'custom'}>
      <h3>{W.areaTitle}</h3>
      <p className="cg-muted">{W.areaSays}</p>
      {area === undefined && <p className="cg-muted">{W.areaNone}</p>}
      <SpacingPicker value={value} disabled={busy} W={W} onChange={(sp) => onSave({ first: sp.first, growth: sp.growth, locked })} />
      <label className="pe-check">
        <input type="checkbox" checked={!locked} disabled={busy} onChange={(e) => onSave({ first: value.first, growth: value.growth, locked: !e.target.checked })} data-spacing-may-change="" />
        <span>{W.mayChange}</span>
      </label>
      {area !== undefined && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onSave(undefined)} data-spacing-clear="">{W.areaClear}</button>}
      <p className="cg-muted">{W.recompute}</p>
    </section>
  );
}
