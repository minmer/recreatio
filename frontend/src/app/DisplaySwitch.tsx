/**
 * DAS AUSWAHLFELD „Sposób wyświetlania" (0094) — oben in jedem Teil des
 * Arbeitsplatzes, der mehr als einen Weg hat.
 *
 * Wer einen anderen Weg wählt, sieht ihn sofort; daneben steht dann „Zapisz
 * jako mój sposób" — das merkt ihn für das Konto, auf jedem Gerät. Wer nur
 * kurz in den erweiterten Weg schaut, muss nichts zurückstellen: ohne Zapisz
 * gilt er nur in dieser Karte.
 */

import { useId } from 'react';

import { useDisplay, type Tool } from './display';

export function DisplaySwitch({ tool }: { tool: Tool }) {
  const display = useDisplay(tool);
  const id = useId();

  return (
    <div className="wk-display" data-display={tool}>
      <label className="wk-display-pick" htmlFor={id}>
        <span>Sposób wyświetlania</span>
        <select id={id} value={display.mode.id} onChange={(e) => display.pick(e.target.value)}>
          {display.def.modes.map((one) => (
            <option key={one.id} value={one.id}>{one.label}{one.extended ? ' (rozszerzony)' : ''}</option>
          ))}
        </select>
      </label>
      {display.trying && (
        <span className="wk-display-save" role="status">
          <button type="button" className="wk-btn wk-btn-small" data-display-save="" onClick={display.save}>Zapisz jako mój sposób</button>
          <button type="button" className="wk-link-btn" onClick={display.reset}>Wróć do: {display.saved.label}</button>
        </span>
      )}
      <span className="wk-hint wk-display-says">{display.mode.says}</span>
    </div>
  );
}

export default DisplaySwitch;
