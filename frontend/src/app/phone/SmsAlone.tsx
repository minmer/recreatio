/**
 * SMS BEZ KONTA (2026-10-26) — die Ausgabe „sms" ohne Netz oder ohne Anmeldung.
 *
 * SMS liegen auf dem Telefon, nicht beim Dienst: lesen, schreiben, senden, löschen geht
 * auch dann. Was das Konto braucht, sagt das Menü selbst („(po zalogowaniu)": Archiv,
 * Pliki przez link, Numery), und die Namen kommen aus dem Adressbuch des Telefons statt
 * aus Kontakty. `App.tsx` entscheidet, wann diese Fassung steht:
 *
 * <code>
 *   checking   die Frage nach dem Konto hängt (schlechtes Netz) — nach 2,5 s schon die SMS
 *   none       niemand angemeldet, oder kein Netz — „Zaloguj się"
 *   back       das Konto kam, während diese Fassung offen war — „Pełna wersja"; von selbst
 *              wechselt es erst beim nächsten Schritt, mitten im Tippen nicht
 * </code>
 *
 * Der Kopf klebt oben wie die Kopfleiste des Arbeitsplatzes: die Leiste der Liste und das
 * Gespräch messen an ihm (`data-app-head`, `useBarHeight`).
 */

import { ViewGuard } from '../shell/ViewGuard';
import { UiHosts } from '../ui/dialogs';
import { viewPath } from '../routes';
import { SmsApp } from './SmsApp';
import './phone.css';

export type AloneState = 'checking' | 'none' | 'back';

const STATE_TEXT: Record<AloneState, string> = {
  checking: 'Łączenie z kontem…',
  none: 'Bez logowania',
  back: 'Połączono'
};

export default function SmsAlone({ trail, state, onSignIn, onFull }: {
  trail: readonly string[];
  state: AloneState;
  onSignIn: () => void;
  onFull: () => void;
}) {
  return (
    <div className="wk-root wk-plain is-wide ph-alone">
      <header className="wk-plain-top" data-app-head="">
        <a className="wk-brandmark" href={viewPath('sms')}><b>RE</b>creatio</a>
        <span className="ph-alone-state" role="status">{STATE_TEXT[state]}</span>
        {state === 'none' && <button type="button" className="wk-btn wk-btn-line wk-btn-small" onClick={onSignIn}>Zaloguj się</button>}
        {state === 'back' && <button type="button" className="wk-btn wk-btn-small" onClick={onFull}>Pełna wersja</button>}
      </header>
      <main className="wk-main">
        <ViewGuard>
          <SmsApp who={null} trail={trail} />
        </ViewGuard>
      </main>
      <UiHosts />
    </div>
  );
}
