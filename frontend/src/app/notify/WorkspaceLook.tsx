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
import { MotionChoice } from '../ui/MotionChoice';
import { motionWords } from '../cogita/motionWords';
import { useT } from '../core/i18n';

export function WorkspaceLook({ who }: { who: Who }) {
  const state = useSyncExternalStore(subscribe, current);
  const t = useT();

  return (
    <div className="wk-narrow wk-look">
      <PageHeader title={t('notify.look.title')} />

      <section aria-labelledby="look-alerts">
        <h2 className="wk-h2" id="look-alerts">{t('notify.look.waiting')}</h2>
        <p className="wk-hint">{t('notify.look.waitingHint')}</p>
        <AlertSettingsEditor />
        {/* 2026-10-29 — dieselbe Liste als JSON („recreatio/workspace-view", `workspace/viewJson.ts`). */}
        <ViewJsonPanel />
      </section>

      <section aria-labelledby="look-device">
        <h2 className="wk-h2" id="look-device">{t('notify.look.device')}</h2>
        <NotifySettingsPanel who={who} settings={state.settings} />
        {/* 2026-11-05 (Prompt 17) — wie viel sich bewegt (Punkte, Karte, Antworten): für dieses Gerät. */}
        <MotionChoice words={motionWords(t.lang)} />
      </section>
    </div>
  );
}

export default WorkspaceLook;
