/**
 * OHNE NETZ ODER OHNE KONTO — die App, wenn der Dienst nicht zu erreichen ist, und in der Ausgabe „sms" auch ohne
 * Anmeldung (2026-10-26 die SMS, 2026-10-28 die Nauka dazu). `App.tsx` entscheidet, wann diese Fassung steht.
 *
 * <code>
 *   SMS     (nur Ausgabe „sms") die SMS liegen auf dem Telefon: lesen, schreiben, senden, löschen — ohne Konto.
 *           Was das Konto braucht, sagt das Menü selbst („(po zalogowaniu)"); die Namen kommen aus dem Adressbuch.
 *   Nauka   die Powtórki, die dieses Gerät für die Zeit ohne Netz hält — nach der ANMELDUNG OHNE NETZ
 *           (`core/away.ts`, `cogita/AwayLearn.tsx`); die Antworten warten versiegelt, bis das Netz zurück ist.
 * </code>
 *
 * Der Zustand oben rechts:
 *
 * <code>
 *   checking   die Frage nach dem Konto hängt (schlechtes Netz) — die SMS stehen nach 2,5 s schon da
 *   cut        kein Netz (oder kein Dienst) — „Ponów"; nachgesehen wird auch von selbst
 *   none       das Netz ist da, aber niemand angemeldet — „Zaloguj się"
 *   back       das Konto kam, während diese Fassung offen war — „Pełna wersja"; von selbst wechselt es erst beim
 *              nächsten Schritt, mitten im Tippen nicht
 * </code>
 *
 * Der Kopf klebt oben wie die Kopfleiste des Arbeitsplatzes: die Leiste der Liste und das Gespräch messen an ihm
 * (`data-app-head`, `useBarHeight`).
 */

import { lazy, Suspense } from 'react';

import { phoneHere } from '../phone/here';
import { viewPath } from '../routes';
import { UiHosts } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { ViewGuard } from './ViewGuard';

const SmsApp = lazy(() => import('../phone/SmsApp').then((m) => ({ default: m.SmsApp })));
const AwayLearn = lazy(() => import('../cogita/AwayLearn'));

export type AloneState = 'checking' | 'cut' | 'none' | 'back';
export type AloneTab = 'sms' | 'learn';

const STATE_TEXT: Record<AloneState, string> = {
  checking: 'Łączenie z kontem…',
  cut: 'Bez internetu',
  none: 'Bez logowania',
  back: 'Połączono'
};

export default function AloneShell({ tab, trail, state, onSignIn, onFull, onRetry }: {
  tab: AloneTab;
  /** Der Weg in der Ansicht: in den SMS die Unterhaltung, in der Nauka die Powtórka (`<bibliothek>:<powtórka>`). */
  trail: readonly string[];
  state: AloneState;
  onSignIn: () => void;
  onFull: () => void;
  onRetry: () => void;
}) {
  const phone = phoneHere();
  const shown: AloneTab = phone ? tab : 'learn';
  return (
    <div className="wk-root wk-plain is-wide wk-alone">
      <header className="wk-plain-top" data-app-head="">
        <a className="wk-brandmark" href={shown === 'sms' ? viewPath('sms') : viewPath('learn', 'bez-sieci')}><b>RE</b>creatio</a>
        {phone && (
          <nav className="wk-alone-tabs" aria-label="Bez sieci">
            <a href={viewPath('sms')} aria-current={shown === 'sms' ? 'page' : undefined}>SMS</a>
            <a href={viewPath('learn', 'bez-sieci')} aria-current={shown === 'learn' ? 'page' : undefined}>Nauka</a>
          </nav>
        )}
        <span className="wk-alone-state" role="status">{STATE_TEXT[state]}</span>
        {state === 'cut' && <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={onRetry}>Ponów</button>}
        {state === 'none' && <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={onSignIn}>Zaloguj się</button>}
        {state === 'back' && <button type="button" className="wk-btn wk-btn-small" onClick={onFull}>Pełna wersja</button>}
      </header>
      <main className="wk-main">
        <ViewGuard>
          <Suspense fallback={<Loading />}>
            {shown === 'sms' ? <SmsApp who={null} trail={trail} /> : <AwayLearn who={null} me={null} trail={trail} />}
          </Suspense>
        </ViewGuard>
      </main>
      <UiHosts />
    </div>
  );
}
