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
import type { Ring, SealedRole } from './keys';
import { Modal } from './Modal';
import { PersonCard } from './PersonCard';
import { forget as forgetState } from './prefs';
import { keysFor } from './ringOf';
import { myRoleNames } from './roleNames';
import { selfOf } from './roles';
import { loadMySeats, openMine as openMySeat, type MySeat } from './seat';
import { PasswordInput } from './PasswordInput';
import { useCrumbs } from './crumbTrail';
import { viewPath } from './routes';
import { WorkspaceLook } from './WorkspaceLook';
import {
  deleteAccount, deletionPreview, keepHeldKey, WorkspaceError,
  type DeletionPreview, type KeyKeeping, type Who
} from './session';

/** 0094 — `#/workspace/account/widok`: Wygląd warsztatu; sonst das Konto. */
export function Account({ who, trail = [] }: { who: Who; trail?: readonly string[] }) {
  if (trail[0] === 'widok') return <LookPage />;
  return <AccountPage who={who} />;
}

function LookPage() {
  useCrumbs([{ label: 'Wygląd warsztatu', href: null }]);
  return <WorkspaceLook />;
}

function AccountPage({ who }: { who: Who }) {
  const [mode, setMode] = useState<KeyKeeping | null>(null);
  const [devices, setDevices] = useState<readonly KeptDevice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  /* Welches der verwahrten Geräte dieses ist — die Ablage antwortet in der App erst nach einer Runde. */
  const [here, setHere] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void knownDevice().then((found) => { if (alive) setHere(found?.id ?? null); });
    return () => { alive = false; };
  }, []);

  /*
   * Der Bund und die eigene Person. Beides wird für „Moje dane" gebraucht: die
   * Angaben liegen unter dem Rollenschlüssel, und den hält der Bund.
   */
  const [ring, setRing] = useState<Ring | null>(null);
  const [person, setPerson] = useState<SealedRole | null>(null);

  useEffect(() => {
    let alive = true;

    void keysFor(who)
      .then(({ ring: bund, graph }) => {
        if (!alive) return;
        setRing(bund);

        /*
         * Die eigene PERSON, nicht die Kontorolle. „Account" ist ein Pęk
         * kluczy und hat keinen Geburtstag.
         */
        setPerson(selfOf(graph));
      })
      .catch(() => { if (alive) setRing(null); });

    return () => { alive = false; };
  }, [who]);

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

      {/* 0094 — was der Arbeitsplatz zeigt: eigene Seite, weil sie wächst. */}
      <h2 className="wk-h2">Wygląd warsztatu</h2>
      <p className="wk-hint">
        Widok prosty czy rozszerzony w każdej części, kolejność powiadomień,
        Twoje widoki:{' '}
        <a href={viewPath('account', 'widok')} data-look-link="">ustaw wygląd warsztatu</a>.
      </p>

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

      {ring !== null && person !== null && (
        <PersonCard roleId={person.id} ring={ring} />
      )}

      {ring !== null && person === null && (
        <>
          <h2 className="wk-h2">Moje dane</h2>
          <p className="wk-note">
            Dane należą do <strong>osoby</strong>, a konto osobą nie jest — to
            pęk kluczy. Załóż osobę w zakładce „Role", wtedy będzie komu je
            przypisać.
          </p>
        </>
      )}

      {ring !== null && <MySeats ring={ring} />}

      <h2 className="wk-h2">Prywatność</h2>
      <p className="wk-hint">
        Co przechowujemy, kto jest administratorem danych i jakie masz prawa:{' '}
        <a href="/prywatnosc/">polityka prywatności</a>.
      </p>

      <DeleteAccount who={who} />
    </>
  );
}

/* -- Das Konto löschen -------------------------------------------------------- */

/**
 * Das Konto löschen — vom Menschen selbst (Google Play verlangt es in der App
 * und im Netz; hier ist beides dieselbe Seite).
 *
 * <b>Erst sagen, was geschieht, dann fragen.</b> Die Vorschau kommt vom Dienst
 * und nennt besonders, was danach NIEMAND mehr öffnet — eine Gruppe, deren
 * einziger Schlüsselhalter dieses Konto ist. Wer das nicht will, gibt vorher
 * jemandem Zugang.
 *
 * <b>Name tippen und Passwort:</b> das eine gegen den falschen Knopf, das
 * andere gegen das offen liegengelassene Telefon.
 */
function DeleteAccount({ who }: { who: Who }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setPreview(null);
    setFailed(null);
    void deletionPreview()
      .then((found) => { if (alive) setPreview(found); })
      .catch((e: unknown) => { if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się sprawdzić konta.'); });
    void myRoleNames(who).then((found) => { if (alive) setNames(found); }).catch(() => undefined);
    return () => { alive = false; };
  }, [open, who]);

  const ready = typed.trim().toLowerCase() === who.loginId.toLowerCase() && password !== '' && !busy;

  /* Gruppen, die mitgehen — getrennt vom eigenen Kalender, weil sie anderen etwas bedeuten können. */
  const groups = preview?.deletedAreas.filter((a) => !a.personal) ?? [];

  const go = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await deleteAccount(who, typed.trim(), password);
      forgetState();
      setPassword('');
      setGone(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć konta.');
    } finally {
      setBusy(false);
    }
  };

  /* Danach gibt es hier nichts mehr: neu laden, und die Anmeldung steht da. */
  if (gone) {
    return (
      <Modal title="Konto usunięte" onClose={() => window.location.reload()}>
        <p>Konto <strong>{who.loginId}</strong> zostało usunięte. Na tym urządzeniu nie ma już jego kluczy.</p>
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => window.location.reload()}>Zakończ</button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <h2 className="wk-h2">Usunięcie konta</h2>
      <p className="wk-hint">
        Usuwa konto na zawsze — na wszystkich urządzeniach. Nie da się tego cofnąć.
      </p>
      <div className="wk-actions">
        <button type="button" className="wk-link-btn wk-danger-link" onClick={() => setOpen(true)}>Usuń konto…</button>
      </div>

      {open && (
        <Modal title="Usunąć konto?" onClose={() => { if (!busy) setOpen(false); }}>
          {preview === null && failed === null && <p className="wk-hint">Sprawdzanie, co zostanie usunięte…</p>}

          {preview !== null && (
            <>
              <p><strong>Zostanie usunięte:</strong></p>
              <ul className="wk-delete-list">
                <li>
                  konto <strong>{preview.loginId}</strong>, logowanie i sesje na wszystkich urządzeniach
                  {preview.devices > 0 ? ` (zachowane klucze: ${preview.devices})` : ''};
                </li>
                <li>
                  {preview.persons === 1 ? 'Twoja osoba i jej dane' : `Twoje osoby (${preview.persons}) i ich dane`}
                  {' '}— klucze, nazwy, dane osobowe;
                </li>
                {preview.deletedAreas.some((a) => a.personal) && <li>Twój osobisty kalendarz i zadania;</li>}
                {preview.messages > 0 && (
                  <li>treść Twoich wiadomości ({preview.messages}) — w rozmowach zostanie „wiadomość usunięta”;</li>
                )}
                <li>Twoje przyszłe rezerwacje terminów.</li>
              </ul>

              <p>
                <strong>Zostaje</strong>, bo należy do wspólnot: zgłoszenia wysłane w formularzach, minione terminy
                {preview.pages.length > 0 ? `, strony: ${preview.pages.join(', ')}` : ''}.
              </p>

              {(groups.length > 0 || preview.orphanedAreas.length > 0 || preview.offices.length > 0) && (
                <div className="wk-note wk-delete-warn">
                  <p><strong>Uwaga — tylko Ty masz do tego klucze.</strong></p>
                  {groups.length > 0 && (
                    <>
                      <p>Te grupy zostaną <strong>usunięte</strong> razem z kontem — z kalendarzami, zadaniami i rozmowami:</p>
                      <ul>{groups.map((a) => <li key={a.id}>„{a.name}”</li>)}</ul>
                    </>
                  )}
                  {(preview.orphanedAreas.length > 0 || preview.offices.length > 0) && (
                    <>
                      <p>To zostanie, ale nikt już tego nie otworzy ani nie poprowadzi:</p>
                      <ul>
                        {preview.orphanedAreas.map((a) => <li key={a.id}>obszar „{a.name}”</li>)}
                        {preview.offices.map((id) => <li key={id}>rola „{names.get(id) ?? 'bez nazwy'}”</li>)}
                      </ul>
                    </>
                  )}
                  <p>Jeśli mają działać dalej, najpierw nadaj komuś dostęp.</p>
                </div>
              )}

              <label className="wk-field">
                <span>Wpisz nazwę konta: <strong>{who.loginId}</strong></span>
                <input value={typed} autoComplete="off" autoCapitalize="none" onChange={(e) => setTyped(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>Hasło</span>
                <PasswordInput value={password} autoComplete="current-password" onChange={setPassword} />
              </label>
            </>
          )}

          {failed !== null && <p className="wk-error">{failed}</p>}

          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-danger" disabled={!ready || preview === null} onClick={() => void go()}>
              {busy ? 'Usuwanie…' : 'Usuń konto na zawsze'}
            </button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setOpen(false)}>Anuluj</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* -- Die Plätze, die ich halte ---------------------------------------------- */

/**
 * Was aus dem Binden geworden ist.
 *
 * Ohne diese Liste wäre das Binden ein Eintrag, den niemand wiedersieht: der
 * Platzschlüssel liegt unter dem Rollenschlüssel, und genau deshalb kommt man
 * hier auch ohne den ursprünglichen Link heran.
 */
function MySeats({ ring }: { ring: Ring }) {
  const [seats, setSeats] = useState<readonly MySeat[] | null>(null);
  const [notes, setNotes] = useState<Map<string, string | null>>(new Map());

  useEffect(() => {
    let alive = true;

    void loadMySeats()
      .then(async ({ seats: found }) => {
        if (!alive) return;
        setSeats(found);

        const opened = new Map<string, string | null>();
        for (const seat of found) {
          try { opened.set(seat.seatId, await openMySeat(seat, ring)); }
          catch { opened.set(seat.seatId, null); }
        }
        if (alive) setNotes(opened);
      })
      .catch(() => { if (alive) setSeats([]); });

    return () => { alive = false; };
  }, [ring]);

  if (seats === null || seats.length === 0) return null;

  return (
    <>
      <h2 className="wk-h2">Moje miejsca</h2>

      <ul className="wk-list">
        {seats.map((seat) => (
          <li className="wk-row" key={seat.seatId}>
            <span>
              <strong>{seat.areaName}</strong>
              {seat.recipientName !== null && (
                <span className="wk-row-side"> · {seat.recipientName}</span>
              )}
              {notes.get(seat.seatId) != null && (
                <p className="wk-card-text" style={{ whiteSpace: 'pre-wrap' }}>
                  {notes.get(seat.seatId)}
                </p>
              )}
            </span>
            <span className="wk-row-side">{seat.status === 'revoked' ? 'link wycofany' : ''}</span>
          </li>
        ))}
      </ul>

      <p className="wk-hint">
        Docierasz tu bez linku — klucz miejsca jest zapakowany kluczem Twojej
        osoby. Nawet wycofany link tego nie zabiera.
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
