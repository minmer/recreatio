/**
 * 2026-10-29 — DER WIDOK ALS JSON auf „Powiadomienia" (`notify/WorkspaceLook.tsx`): die Liste „Czeka na
 * Ciebie" hinaus und herein — mit dem Plan vor dem Knopf und der Beschreibung daneben (`viewJson.ts`).
 *
 * Gespeichert wird über denselben gemerkten Wert wie beim Ordnen mit ↑ ↓ (`ALERTS_PREF`, versiegelt in
 * `prefs.ts`): kein zweiter Weg zum Dienst, und die Liste darüber zeigt den neuen Stand sofort.
 */

import { JsonPanel } from '../ui/JsonPanel';
import { useRemembered } from '../core/prefs';
import { WorkspaceError } from '../core/session';
import { ALERTS_PREF, alertsJson, readAlerts } from './alerts';
import { exportView, planView, VIEW_JSON } from './viewJson';

export function ViewJsonPanel() {
  /* Mit `ready`: geplant wird erst gegen den geöffneten Stand des Kontos, nicht gegen die Vorgabe davor. */
  const [text, setText, ready] = useRemembered(ALERTS_PREF, '');
  const settings = readAlerts(text);

  return (
    <JsonPanel
      summary="Powiadomienia jako JSON"
      lead={<>Kolejność i włączenie listy „Czeka na Ciebie” — do kopii albo do ułożenia przez AI. Import zmienia tylko to ustawienie konta; układ strony Teraz jest stały.</>}
      fileName="powiadomienia.json"
      exportDoc={() => exportView(settings)}
      format={VIEW_JSON}
      preview={(doc) => (ready ? planView(doc, settings) : { error: 'Ustawienia konta jeszcze się otwierają — za chwilę zobaczysz plan.' })}
      importLabel="Zapisz kolejność"
      onImport={async (doc) => {
        const plan = planView(doc, settings);
        if ('error' in plan) throw new WorkspaceError(plan.error);
        if (plan.changed) setText(alertsJson(plan.next));
        return { lines: plan.lines, warnings: plan.warnings };
      }}
    />
  );
}

export default ViewJsonPanel;
