/**
 * THUNDERBIRD (0125) — Połączenia: Programme, die grosse Anhänge als Pliki przez
 * link ablegen (der Dodatek `frontend/thunderbird`). „Połącz Thunderbirda" macht
 * den Kod połączenia und zeigt ihn EINMAL; die Liste sagt, was verbunden ist, wann
 * es zuletzt etwas schickte und was es gerade teilt — und trennt.
 *
 * Unter „Pliki przez link" (`Shares.tsx`), auf dem Telefon und im Browser.
 */

import { useCallback, useEffect, useState } from 'react';

import { plural } from '../core/plural';
import { WorkspaceError } from '../core/session';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { Modal } from '../ui/Modal';
import type { PhoneCtx } from './phoneContext';
import { connectDevice, disconnectDevice, loadDevices, type ShareDevice } from './share';
import { sizeText } from './shareSeal';

const day = (at: string) => new Date(at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

/** Wo die Seite den Dodatek anbietet (`npm run thunderbird:xpi` legt ihn nach public/). */
const ADDON = '/thunderbird/recreatio-filelink.xpi';

export function ShareConnections({ ctx, onChanged }: { ctx: PhoneCtx; onChanged: () => void }) {
  /* `old`: ein Dienst vor 0125 — dann gibt es hier noch nichts zu verbinden. */
  const [devices, setDevices] = useState<readonly ShareDevice[] | 'old' | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices((await loadDevices(ctx)) ?? 'old');
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać połączeń.');
    }
  }, [ctx]);
  useEffect(() => { void load(); }, [load]);

  const drop = async (device: ShareDevice) => {
    const yes = await ask({
      title: `Odłączyć ${device.name ?? 'ten program'}?`,
      body: 'Nowe załączniki nie pójdą już stąd jako link. Pliki wysłane wcześniej działają do swojego terminu — usuniesz je na liście wyżej.',
      confirm: 'Odłącz', danger: true
    });
    if (!yes) return;
    try {
      await disconnectDevice(ctx, device.id);
      toast('Odłączono — ten Thunderbird nie doda już plików.');
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : 'Nie udało się odłączyć.');
    }
    await load();
    onChanged();
  };

  return (
    <section className="ph-conn" aria-labelledby="ph-conn-title">
      <h2 id="ph-conn-title" className="wk-h2">Thunderbird</h2>
      <p className="ph-shares-intro">
        Duże załączniki w Thunderbirdzie mogą iść jako taki sam link — zaszyfrowane, zanim opuszczą komputer, widoczne tu na liście.
        Thunderbird nie loguje się na Twoje konto: dostaje kod, który pozwala tylko dodawać pliki i usuwać te, które sam dodał.
      </p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {devices === null && failed === null && <Loading lines={1} label="Wczytywanie połączeń…" />}
      {devices === 'old' && <p className="wk-empty">Usługa recreatio.pl jeszcze tego nie obsługuje — będzie to możliwe po jej aktualizacji.</p>}
      {Array.isArray(devices) && devices.length > 0 && (
        <ul className="ph-shares" aria-label="Połączone programy">
          {devices.map((d) => (
            <li key={d.id} className="ph-share">
              <span className="ph-share-name"><Icon name="mail" />{d.name ?? 'Program pocztowy'}</span>
              <small>
                połączono {day(d.createdAt)} · {d.lastUsedAt === null ? 'jeszcze nic nie wysłał' : `ostatnio ${day(d.lastUsedAt)}`}
                {d.shares > 0 ? ` · teraz ${d.shares} ${plural(d.shares, 'plik', 'pliki', 'plików')} (${sizeText(d.bytes)})` : ''}
              </small>
              <span className="ph-share-tools">
                <button type="button" className="wk-link-btn wk-danger-link" onClick={() => void drop(d)}><Icon name="ban" />Odłącz</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {Array.isArray(devices) && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => setConnecting(true)}><Icon name="plus" />Połącz Thunderbirda</button>
        </div>
      )}
      {connecting && <ConnectDialog ctx={ctx} onClose={() => { setConnecting(false); void load(); }} />}
    </section>
  );
}

/** Ein Programm verbinden: erst der Name, dann der Kod — einmal gezeigt, mit den drei Schritten in Thunderbird. */
function ConnectDialog({ ctx, onClose }: { ctx: PhoneCtx; onClose: () => void }) {
  const [name, setName] = useState('Thunderbird');
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      setCode((await connectDevice(ctx, name)).code);
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : 'Nie udało się utworzyć kodu połączenia.');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (code === null) return;
    void navigator.clipboard?.writeText(code).then(() => toast('Skopiowano kod połączenia.'))
      .catch(() => toast('Nie udało się skopiować — zaznacz kod i skopiuj go ręcznie.'));
  };

  return (
    <Modal title="Połącz Thunderbirda" onClose={onClose} wide>
      {code === null ? (
        <div className="wk-form">
          <label className="wk-field">
            <span>Nazwa połączenia</span>
            <input value={name} maxLength={60} placeholder="np. Thunderbird — laptop" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void make()}>
              <Icon name="key" />{busy ? 'Tworzenie kodu…' : 'Utwórz kod połączenia'}
            </button>
            <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
          </div>
        </div>
      ) : (
        <div className="wk-form">
          <ol className="ph-conn-steps">
            <li>
              Zainstaluj w Thunderbirdzie dodatek <a href={ADDON} download="recreatio-filelink.xpi">recreatio-filelink.xpi</a>:
              Dodatki i motywy → ⚙ → Zainstaluj dodatek z pliku.
            </li>
            <li>Ustawienia → Redagowanie → Załączniki → Dodaj → <b>recreatio.pl</b>.</li>
            <li>
              Wklej ten kod i kliknij „Połącz”. Kod widać tylko teraz — nie wysyłaj go nikomu: kto go ma, może dodawać pliki do Twojego konta.
            </li>
          </ol>
          <label className="wk-field">
            <span>Kod połączenia</span>
            <textarea className="ph-conn-code" readOnly rows={4} value={code} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={copy}><Icon name="copy" />Kopiuj kod</button>
            <button type="button" className="wk-link-btn" onClick={onClose}>Gotowe</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ShareConnections;
