/**
 * POWIADOMIENIA — ein Ort für alles, was sich meldet (2026-10-16).
 *
 * Bis hierher hiess die Seite „Wygląd warsztatu": je Teil ein Auswahlfeld
 * „prosty / rozszerzony", eine Liste der Widoki — und darunter, fast versteckt,
 * die Reihenfolge der Meldungen. Was auf DIESEM Gerät meldet, stand wiederum in
 * einem Dialog hinter der Glocke. Jetzt steht beides hier: was „Czeka na
 * Ciebie" und die Glocke zeigen (und in welcher Reihenfolge), und was dieses
 * Gerät tut. Die Glocke führt mit „Ustawienia" hierher.
 */

import { useSyncExternalStore } from 'react';

import { AlertSettingsEditor } from '../workspace/AlertList';
import { ViewJsonPanel } from '../workspace/ViewJsonPanel';
import { NotifySettingsPanel } from './NotifyBell';
import { current, subscribe } from './notify';
import type { Who } from '../core/session';
import { PageHeader } from '../ui/PageHeader';

export function WorkspaceLook({ who }: { who: Who }) {
  const state = useSyncExternalStore(subscribe, current);

  return (
    <div className="wk-narrow wk-look">
      <PageHeader title="Powiadomienia" />

      <section aria-labelledby="look-alerts">
        <h2 className="wk-h2" id="look-alerts">Co czeka na Ciebie</h2>
        <p className="wk-hint">
          Co pokazuje dzwonek i strona Teraz — w tej kolejności. Wyłączone nie liczą się do liczby przy dzwonku.
        </p>
        <AlertSettingsEditor />
        {/* 2026-10-29 — dieselbe Liste als JSON („recreatio/workspace-view", `workspace/viewJson.ts`). */}
        <ViewJsonPanel />
      </section>

      <section aria-labelledby="look-device">
        <h2 className="wk-h2" id="look-device">Na tym urządzeniu</h2>
        <NotifySettingsPanel who={who} settings={state.settings} />
      </section>
    </div>
  );
}

export default WorkspaceLook;
