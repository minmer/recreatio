/**
 * WYGLĄD WARSZTATU (0094) — alles, was der Arbeitsplatz sich für dieses Konto
 * merkt, auf einer Seite (Konto → Wygląd warsztatu, `#/workspace/account/widok`).
 *
 * <code>
 *   Sposób wyświetlania   je Teil: einfach oder erweitert (dasselbe Feld wie an seinem Kopf)
 *   Powiadomienia         welche Arten sich melden, und in welcher Reihenfolge
 *   Widoki                welche es gibt, welcher beim Öffnen steht
 * </code>
 *
 * Nichts davon ist eigens hier: dieselben Stücke stehen an ihrem Ort (das
 * Auswahlfeld am Kopf eines Teils, „Kolejność" an der Glocke, die Widoki auf
 * der Seite des Warsztat). Hier stehen sie untereinander, für wen sie suchen
 * will.
 */

import { useId } from 'react';

import { AlertSettingsEditor } from './AlertList';
import { saveDisplay, TOOLS, useDisplay, type ToolDef } from './display';
import { viewPath } from './routes';
import { areasNow, useLoaded } from './viewData';
import { useViews } from './WorkspaceHome';
import { allViews, partDef, pick } from './workspaceViews';

export function WorkspaceLook() {
  return (
    <div className="wk-look">
      <h1 className="wk-h1">Wygląd warsztatu</h1>
      <p className="wk-lede">
        Każda część warsztatu ma widok prosty i rozszerzony. Prosty jest dla
        wszystkich domyślny; rozszerzony możesz wybrać tutaj albo w samej
        części — i zapisać od razu tam.
      </p>

      <h2 className="wk-h2">Sposób wyświetlania</h2>
      <ul className="wk-look-tools">
        {TOOLS.map((def) => <ToolRow key={def.tool} def={def} />)}
      </ul>

      <h2 className="wk-h2" id="powiadomienia">Powiadomienia</h2>
      <p className="wk-hint">
        Co pojawia się przy dzwonku i w części „Czeka na Ciebie" — i w jakiej
        kolejności. Wyłączone nie liczą się do liczby przy dzwonku.
      </p>
      <AlertSettingsEditor />

      <h2 className="wk-h2">Widoki</h2>
      <ViewsOverview />
    </div>
  );
}

function ToolRow({ def }: { def: ToolDef }) {
  const display = useDisplay(def.tool);
  const id = useId();
  return (
    <li className="wk-look-tool" data-look-tool={def.tool}>
      <label htmlFor={id}>{def.label}</label>
      <select id={id} value={display.saved.id} onChange={(e) => saveDisplay(def.tool, e.target.value)}>
        {def.modes.map((one) => <option key={one.id} value={one.id}>{one.label}{one.extended ? ' (rozszerzony)' : ''}</option>)}
      </select>
      <span className="wk-hint">{display.saved.says}</span>
    </li>
  );
}

function ViewsOverview() {
  const areas = useLoaded(() => areasNow(), []);
  const [state, setState] = useViews();
  const views = allViews(state, areas ?? []);

  return (
    <>
      <p className="wk-hint">
        „Mój widok" otwiera się na stronie warsztatu; każdy obszar ma swój widok,
        a własne widoki zbierają to, co potrzebne — np. kilka obszarów razem.
        Części, ich kolejność i sposób wyświetlania zmienia „Dostosuj widok".
      </p>
      <ul className="wk-look-views">
        {views.map((one) => (
          <li key={one.id} data-look-view={one.id}>
            <a href={viewPath('widok', one.id)}>{one.name}</a>
            <span className="wk-tags">
              <span className="wk-tag">{one.kind === 'mine' ? 'Twój' : one.kind === 'area' ? 'obszar' : 'własny'}</span>
              {state.changed[one.id] !== undefined && <span className="wk-tag">dostosowany</span>}
              {state.current === one.id && <span className="wk-tag wk-tag-new">na start</span>}
            </span>
            <span className="wk-hint">{one.parts.map((p) => partDef(p.kind).label).join(' · ') || 'pusty'}</span>
            {state.current !== one.id && (
              <button type="button" className="wk-link-btn" onClick={() => setState(pick(state, one.id))}>Otwieraj na start</button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export default WorkspaceLook;
