/**
 * Konto — die eigenen Angaben, die eigenen Plätze, das Löschen. Wie das Konto
 * es mit dem Schlüssel hält, steht seit 2026-10-17 auf einer eigenen Seite
 * (`#/workspace/account/bezpieczenstwo`, „Bezpieczeństwo i klucze"): dort ist
 * auch die EINE Erklärung, wie die Schlüssel arbeiten — statt grauer Absätze
 * auf jeder Seite.
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

import { forgetKept, loadKept, setKeyKeeping, type KeptDevice } from '../core/keeping';
import { knownDevice } from '../core/kept';
import type { Ring, SealedRole } from '../core/keys';
import { Modal } from '../ui/Modal';
import { PersonCard } from './PersonCard';
import { TRANSFER, TransferPage } from './TransferPage';
import { forget as forgetState } from '../core/prefs';
import { keysFor } from '../core/ringOf';
import { myRoleNames } from '../roles/roleNames';
import { selfOf } from '../roles/roles';
import { loadMySeats, type MySeat } from '../seats/seat';
import { plural } from '../core/plural';
import { PasswordInput } from '../ui/PasswordInput';
import { useCrumbs } from '../shell/crumbTrail';
import { WorkspaceLook } from '../notify/WorkspaceLook';
import { viewPath } from '../routes';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import {
  deleteAccount, deletionPreview, keepHeldKey, WorkspaceError,
  type DeletionPreview, type KeyKeeping, type Who
} from '../core/session';
import { Loading } from '../ui/Loading';
import { forgetAway } from '../core/away';

/** `#/workspace/account/widok` (und `…/powiadomienia`): Powiadomienia; `…/bezpieczenstwo`: Bezpieczeństwo i klucze; `…/przeniesienie`: Przeniesienie danych; sonst das Konto. */
export function Account({ who, trail = [] }: { who: Who; trail?: readonly string[] }) {
  if (trail[0] === 'widok' || trail[0] === 'powiadomienia') return <LookPage who={who} />;
  if (trail[0] === SECURITY) return <SecurityPage who={who} />;
  if (trail[0] === TRANSFER) return <TransferPage who={who} />;
  return <AccountPage who={who} />;
}

/** Die Adresse der Seite über Schlüssel und Geräte (Menü des Kontos, Suche). */
export const SECURITY = 'bezpieczenstwo';

function LookPage({ who }: { who: Who }) {
  useCrumbs([{ label: 'Powiadomienia', href: null }]);
  return <WorkspaceLook who={who} />;
}

/**
 * Wie dieses Konto es mit dem Schlüssel hält, und welche Geräte ihn verwahren —
 * ganz auf „Bezpieczeństwo i klucze", als eine Zeile im Konto.
 */
function useKeeping(who: Who) {
  const [mode, setMode] = useState<KeyKeeping | null>(null);
  const [devices, setDevices] = useState<readonly KeptDevice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /* Welches der verwahrten Geräte dieses ist — die Ablage antwortet in der App erst nach einer Runde. */
  const [here, setHere] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void knownDevice().then((found) => { if (alive) setHere(found?.id ?? null); });
    return () => { alive = false; };
  }, []);

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

    try {
      const done = await setKeyKeeping(wanted);

      if (wanted === 'tab') {
        /* 2026-10-28 — „Tylko w pamięci": auch die Powtórki ohne Netz und das Anmelden ohne Netz gehen von diesem Gerät. */
        await forgetAway(who.accountId).catch(() => undefined);
        toast(done.forgotten === 0
          ? 'Od teraz klucz żyje tylko w pamięci.'
          : `Usunięto zachowane klucze (${done.forgotten}). Po restarcie zapytamy o hasło.`, { kind: 'ok' });
      } else {
        /*
         * Gleich verwahren, wenn dieser Tab den Schlüssel hat. Sonst sagte die
         * Einstellung „zachowany", und zachowane wäre er erst nach dem nächsten
         * Anmelden — also genau dann nicht, wenn man es gerade eingeschaltet hat.
         */
        const now = await keepHeldKey(who);
        toast(now ? 'Klucz jest zachowany na tym urządzeniu.' : 'Włączone. Klucz zostanie zachowany przy następnym logowaniu.', { kind: 'ok' });
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

    try {
      await forgetKept(deviceId);
      await look();
      toast('Urządzenie zapyta o hasło przy następnym otwarciu.', { kind: 'ok' });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    } finally {
      setBusy(null);
    }
  };

  return { mode, devices, here, busy, failed, choose, forget };
}

function AccountPage({ who }: { who: Who }) {
  const keeping = useKeeping(who);

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

  const { mode, devices } = keeping;

  return (
    <div className="wk-narrow ui-page wk-account">
      {ring === null && <Loading lines={3} />}

      {ring !== null && person !== null && (
        <PersonCard roleId={person.id} ring={ring} />
      )}

      {ring !== null && person === null && (
        <>
          <h2 className="wk-h2">Moje dane</h2>
          <p className="wk-note">
            Dane należą do <strong>osoby</strong>, a konto osobą nie jest. Załóż osobę w „Role", wtedy będzie komu je przypisać.
          </p>
        </>
      )}

      <section className="wk-box" aria-label="Logowanie i klucze">
        <a className="wk-line wk-line-first" href={viewPath('account', SECURITY)}>
          <span className="wk-line-ic is-info"><Icon name="shield" /></span>
          <span className="wk-line-text">
            <span className="wk-line-title">Bezpieczeństwo i klucze</span>
            <span className="wk-line-sub">
              {mode === null ? 'Konto ' + who.loginId
                : `${mode === 'kept' ? 'Klucz zachowany' : 'Klucz tylko w pamięci'}${devices.length > 0 ? ` · ${devices.length} ${plural(devices.length, 'urządzenie', 'urządzenia', 'urządzeń')}` : ''}`}
            </span>
          </span>
          <span className="wk-line-end"><Icon name="next" /></span>
        </a>
        <a className="wk-line" href={viewPath('account', TRANSFER)}>
          <span className="wk-line-ic"><Icon name="refresh" /></span>
          <span className="wk-line-text">
            <span className="wk-line-title">Przeniesienie danych</span>
            <span className="wk-line-sub">Dane sprzed zmian platformy — do obecnej postaci</span>
          </span>
          <span className="wk-line-end"><Icon name="next" /></span>
        </a>
      </section>

      {ring !== null && <MySeats ring={ring} />}

      <DeleteAccount who={who} />
    </div>
  );
}

/**
 * BEZPIECZEŃSTWO I KLUCZE — die eine Seite, die erklärt, wie die Schlüssel
 * arbeiten; dazu die Wahl, wie lange der Schlüssel lebt, und die Geräte.
 */
function SecurityPage({ who }: { who: Who }) {
  useCrumbs([{ label: 'Bezpieczeństwo i klucze', href: null }]);
  const { mode, devices, here, busy, failed, choose, forget } = useKeeping(who);

  /* Geräte ohne Namen: dieses, und die anderen nach dem Tag, an dem sie dazukamen. */
  const ordered = [...devices].sort((a, b) => (a.deviceId === here ? -1 : b.deviceId === here ? 1 : a.createdAt.localeCompare(b.createdAt)));

  return (
    <div className="wk-narrow ui-page wk-security">
      <PageHeader title="Bezpieczeństwo i klucze" meta={`Konto ${who.loginId}`} />

      <section aria-labelledby="sec-how">
        <h2 className="wk-h2" id="sec-how">Jak to działa</h2>
        <ul className="wk-security-how">
          <li><strong>Hasło zostaje na urządzeniu.</strong> Przeglądarka liczy z niego klucz; do usługi idzie tylko dowód, że go znasz.</li>
          <li><strong>Dane są szyfrowane w przeglądarce.</strong> Imiona, nazwy, wiadomości i odpowiedzi trafiają do usługi już zaszyfrowane.</li>
          <li><strong>Dostęp to klucz.</strong> Kto ma klucz obszaru, czyta jego dane; nadanie dostępu przekazuje klucz, wycofanie zmienia go na nowy.</li>
          <li><strong>Link też jest kluczem.</strong> Osoba z linkiem widzi tylko to, do czego link prowadzi — i tylko dopóki go nie wycofasz.</li>
          <li><strong>Hasła nie da się odzyskać.</strong> Bez niego nikt, także administrator, nie otworzy Twoich kluczy.</li>
        </ul>
      </section>

      <section aria-labelledby="sec-key">
        <h2 className="wk-h2" id="sec-key">Klucz na tym urządzeniu</h2>
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        {mode === null && failed === null ? <Loading lines={2} /> : (
          <fieldset className="ui-choices" disabled={busy !== null}>
            <legend className="ui-sr">Jak długo żyje klucz</legend>
            <Choice name="keeping" chosen={mode === 'kept'} title="Zachowany — nie pyta po restarcie" onPick={() => void choose('kept')}>
              Usługa przechowuje go zapieczętowanego kluczem tego urządzenia, którego sama nie zna. Kto ma to urządzenie <em>i</em> Twoją sesję, ma wszystko.
            </Choice>
            <Choice name="keeping" chosen={mode === 'tab'} title="Tylko w pamięci — pyta po każdym restarcie" onPick={() => void choose('tab')}>
              Klucz żyje tylko w otwartych kartach. Wybranie tego <strong>usuwa</strong> zachowane klucze na wszystkich urządzeniach.
            </Choice>
          </fieldset>
        )}
        {busy !== null && <p className="wk-hint" role="status">{busy}</p>}
      </section>

      <section aria-labelledby="sec-devices">
        <h2 className="wk-h2" id="sec-devices">Urządzenia z zachowanym kluczem</h2>
        {ordered.length === 0 ? (
          <p className="wk-empty">Klucz nie jest nigdzie zachowany.</p>
        ) : (
          <div className="wk-box">
            {ordered.map((one, i) => (
              <div className={`wk-line${i === 0 ? ' wk-line-first' : ''}`} key={one.deviceId}>
                <span className="wk-line-ic"><Icon name={one.deviceId === here ? 'phone' : 'key'} /></span>
                <span className="wk-line-text">
                  <span className="wk-line-title">{one.deviceId === here ? 'To urządzenie' : `Inne urządzenie, dodane ${when(one.createdAt)}`}</span>
                  <span className="wk-line-sub">{one.lastUsedAt === null ? 'jeszcze nieużywane' : `ostatnio ${when(one.lastUsedAt)}`}</span>
                </span>
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy !== null} onClick={() => void forget(one.deviceId)}>
                  Zapomnij
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="wk-hint">Zapomniane urządzenie nie jest wylogowane — przy następnym otwarciu zapyta o hasło.</p>
      </section>

    </div>
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
      <section className="wk-danger-zone" aria-labelledby="account-delete">
        <div>
          <h2 className="wk-h2" id="account-delete">Usunięcie konta</h2>
          <p className="wk-hint">Na zawsze i na wszystkich urządzeniach. Najpierw zobaczysz, co zniknie.</p>
        </div>
        <button type="button" className="wk-btn wk-btn-danger" onClick={() => setOpen(true)}>Usuń konto…</button>
      </section>

      {open && (
        <Modal title="Usunąć konto?" onClose={() => { if (!busy) setOpen(false); }}>
          {preview === null && failed === null && <Loading label="Sprawdzanie, co zostanie usunięte…" />}

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

              {/* 0129 — wer danach für die Daten nicht mehr geradesteht. */}
              {(preview.endingControllers ?? []).length > 0 && (
                <div className="wk-note wk-delete-warn" data-ending-controllers="">
                  <p>
                    Ci administratorzy danych przestaną obowiązywać — formularze, rezerwacje i rozmowy tych obszarów niczego
                    nie przyjmą, dopóki ktoś nie wskaże nowego:
                  </p>
                  <ul>
                    {preview.endingControllers!.map((c) => (
                      <li key={c.name}>
                        <strong>{c.name}</strong>{c.areas.length > 0 && <> — {c.areas.map((a) => `„${a}”`).join(', ')}</>}
                      </li>
                    ))}
                  </ul>
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

  useEffect(() => {
    let alive = true;

    void loadMySeats(ring)
      .then(({ seats: found }) => { if (alive) setSeats(found); })
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
            </span>
            <span className="wk-row-side">{seat.status === 'revoked' ? 'link wycofany' : ''}</span>
          </li>
        ))}
      </ul>

      <p className="wk-hint">Tu docierasz także bez linku.</p>
    </>
  );
}

/**
 * Eine Wahl, die aussieht wie eine Wahl.
 *
 * Kein Schalter: benannte Möglichkeiten untereinander, jede mit dem, was sie
 * kostet — als Karten mit einem Kreis (`ui-choice`). Ein Schalter zeigt nur
 * eine Seite und nennt die andere nicht.
 */
function Choice({ name, chosen, title, onPick, children }: {
  name: string;
  chosen: boolean;
  title: string;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="ui-choice" data-chosen={chosen}>
      <input type="radio" name={name} checked={chosen} onChange={() => { if (!chosen) onPick(); }} />
      <span className="ui-choice-title">{title}</span>
      <span className="ui-choice-text">{children}</span>
    </label>
  );
}

/** Kurz und ohne Uhrzeit — „wann zuletzt" ist eine Frage nach dem Tag. */
function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';

  return at.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default Account;
