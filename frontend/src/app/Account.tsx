/**
 * Konto — wie dieses Konto es mit dem Schlüssel hält.
 *
 * <b>Die Wahl ist echt und hat zwei Seiten.</b> Sie wird deshalb ausgeschrieben
 * und nicht als Häkchen mit dem Wort „sicher" daneben angeboten: ein Häkchen
 * lässt offen, wovor es schützt und was es kostet, und beides ist hier konkret.
 *
 * <b>Was der Dienst in keinem Fall bekommt.</b> Auch in der bequemen Fassung
 * liegt beim Dienst nur die HÜLLE — der PasswordKey, versiegelt unter einem
 * Zufallsschlüssel, der dieses Gerät nie verlässt. Die Datenbank allein ergibt
 * nichts, das Gerät allein ergibt nichts.
 *
 * <b>Umschalten auf „nur w pamięci" wirft weg.</b> Nicht „ab jetzt nicht mehr",
 * sondern: die vorhandenen Hüllen sind fort, auf allen Geräten. Das steht am
 * Knopf, bevor er gedrückt wird.
 */

import { useCallback, useEffect, useState } from 'react';

import { forgetKept, loadKept, setKeyKeeping, type KeptDevice } from './keeping';
import { knownDevice } from './kept';
import { keepHeldKey, WorkspaceError, type KeyKeeping, type Who } from './session';

export function Account({ who }: { who: Who }) {
  const [mode, setMode] = useState<KeyKeeping | null>(null);
  const [devices, setDevices] = useState<readonly KeptDevice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const here = knownDevice()?.id ?? null;

  const look = useCallback(async () => {
    try {
      const found = await loadKept();
      setMode(found.keyKeeping);
      setDevices(found.devices);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać ustawień.');
    }
  }, []);

  useEffect(() => { void look(); }, [look]);

  const choose = async (wanted: KeyKeeping) => {
    if (wanted === mode) return;

    setBusy(wanted === 'tab' ? 'Usuwanie zachowanych kluczy…' : 'Włączanie…');
    setFailed(null);
    setSaid(null);

    try {
      const done = await setKeyKeeping(wanted);

      if (wanted === 'tab') {
        setSaid(done.forgotten === 0
          ? 'Nic nie było zachowane — od teraz klucz żyje tylko w pamięci.'
          : `Usunięto zachowane klucze (${done.forgotten}). Po restarcie zapytamy o hasło.`);
      } else {
        /*
         * Gleich verwahren, wenn dieser Tab den Schlüssel hat. Sonst sagte die
         * Einstellung „zachowany", und zachowane wäre er erst nach dem nächsten
         * Anmelden — also genau dann nicht, wenn man es gerade eingeschaltet hat.
         */
        const now = await keepHeldKey(who);
        setSaid(now
          ? 'Klucz jest zachowany na tym urządzeniu.'
          : 'Włączone. Klucz zostanie zachowany przy następnym logowaniu.');
      }

      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zmienić ustawienia.');
    } finally {
      setBusy(null);
    }
  };

  const forget = async (deviceId: string) => {
    setBusy('Usuwanie…');
    setFailed(null);
    setSaid(null);

    try {
      await forgetKept(deviceId);
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    } finally {
      setBusy(null);
    }
  };

  if (mode === null && failed === null) return <p className="wk-lede">Wczytywanie…</p>;

  return (
    <>
      <p className="wk-lede">
        Hasło nigdy nie opuszcza Twojego urządzenia — z niego liczy się klucz,
        którym otwiera się wszystko inne. Tutaj decydujesz, jak długo ten klucz
        ma żyć.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {said !== null && <p className="wk-done">{said}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      <h2 className="wk-h2">Klucz</h2>

      <Choice
        chosen={mode === 'kept'}
        disabled={busy !== null}
        title="Zachowany — nie pyta po restarcie"
        onPick={() => void choose('kept')}
      >
        <p className="wk-hint">
          Klucz leży u usługi <strong>zapieczętowany</strong> losowym kluczem
          tego urządzenia, którego usługa nie zna i nigdy nie dostanie. Sama
          baza danych nie wystarczy, samo urządzenie też nie — potrzebne są
          obie połowy naraz.
        </p>
        <p className="wk-hint">
          Koszt: kto ma dostęp do tego urządzenia <em>i</em> do Twojej
          zalogowanej sesji, ma wszystko.
        </p>
      </Choice>

      <Choice
        chosen={mode === 'tab'}
        disabled={busy !== null}
        title="Tylko w pamięci — pyta po każdym restarcie"
        onPick={() => void choose('tab')}
      >
        <p className="wk-hint">
          Klucz żyje wyłącznie w pamięci otwartych kart. Karty dzielą go między
          sobą, więc druga karta nie pyta o hasło — ale kiedy zamkniesz
          ostatnią, klucza nie ma nigdzie.
        </p>
        <p className="wk-hint">
          Przełączenie tutaj <strong>usuwa</strong> to, co już jest zachowane —
          na wszystkich urządzeniach, od razu.
        </p>
      </Choice>

      <h2 className="wk-h2">Urządzenia</h2>

      {devices.length === 0 ? (
        <p className="wk-empty">
          Nic nie jest nigdzie zachowane.
        </p>
      ) : (
        <ul className="wk-list">
          {devices.map((one) => (
            <li className="wk-row" key={one.deviceId}>
              <span>
                <code>{one.deviceId.slice(0, 8)}</code>
                {one.deviceId === here && <strong> · to urządzenie</strong>}
                <span className="wk-row-side">
                  {' · '}
                  {one.lastUsedAt === null
                    ? 'jeszcze nieużywane'
                    : `ostatnio ${when(one.lastUsedAt)}`}
                </span>
              </span>

              <button
                type="button" className="wk-link-btn" disabled={busy !== null}
                onClick={() => void forget(one.deviceId)}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="wk-hint">
        Usunięcie urządzenia nie wylogowuje go — zabiera mu tylko zachowany
        klucz. Przy następnym otwarciu poprosi o hasło.
      </p>
    </>
  );
}

/**
 * Eine Wahl, die aussieht wie eine Wahl.
 *
 * Kein Schalter: zwei benannte Möglichkeiten nebeneinander, jede mit dem, was
 * sie kostet. Ein Schalter zeigt nur eine Seite und nennt die andere nicht.
 */
function Choice({ chosen, disabled, title, onPick, children }: {
  chosen: boolean;
  disabled: boolean;
  title: string;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="wk-form" data-chosen={chosen}>
      <div className="wk-actions">
        <button
          type="button"
          className={chosen ? 'wk-btn' : 'wk-link-btn'}
          disabled={disabled || chosen}
          onClick={onPick}
        >
          {chosen ? `✓ ${title}` : title}
        </button>
      </div>
      {children}
    </section>
  );
}

/** Kurz und ohne Uhrzeit — „wann zuletzt" ist eine Frage nach dem Tag. */
function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';

  return at.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default Account;
