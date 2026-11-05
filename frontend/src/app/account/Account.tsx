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

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { forgetKept, loadKept, setKeyKeeping, type KeptDevice } from '../core/keeping';
import { knownDevice } from '../core/kept';
import type { Ring, SealedRole } from '../core/keys';
import { Modal } from '../ui/Modal';
import { PersonCard } from './PersonCard';
import { PersonsJsonPanel } from './PersonsJsonPanel';
import { TRANSFER, TransferPage } from './TransferPage';
import { LANGUAGE, LanguagePage } from './LanguagePage';
import { forget as forgetState } from '../core/prefs';
import { keysFor } from '../core/ringOf';
import { myRoleNames } from '../roles/roleNames';
import { selfOf } from '../roles/roles';
import { loadMySeats, type MySeat } from '../seats/seat';
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
import { LANG_NAME, rich, useT, type T } from '../core/i18n';

/** <b>…</b> fett, <em>…</em> betont — für Sätze mit Auszeichnung. */
const marks = {
  b: (s: string, key: number) => <strong key={key}>{s}</strong>,
  em: (s: string, key: number) => <em key={key}>{s}</em>
};

/** `#/workspace/account/widok` (und `…/powiadomienia`): Powiadomienia; `…/bezpieczenstwo`: Bezpieczeństwo i klucze; `…/przeniesienie`: Przeniesienie danych; sonst das Konto. */
export function Account({ who, trail = [] }: { who: Who; trail?: readonly string[] }) {
  if (trail[0] === 'widok' || trail[0] === 'powiadomienia') return <LookPage who={who} />;
  if (trail[0] === SECURITY) return <SecurityPage who={who} />;
  if (trail[0] === TRANSFER) return <TransferPage who={who} />;
  if (trail[0] === LANGUAGE) return <LanguagePage />;
  if (trail[0] === AI_ACCESS) return <Suspense fallback={<Loading />}><AiConnectionsPage who={who} /></Suspense>;
  return <AccountPage who={who} />;
}

/** 0138 — Dostęp dla AI: die MCP-Verbindungen und ihre Bereiche (`aiAccess/AiConnections.tsx`). */
export const AI_ACCESS = 'dostep-ai';
const AiConnectionsPage = lazy(() => import('../aiAccess/AiConnections').then((m) => ({ default: m.AiConnectionsPage })));

/** Die Adresse der Seite über Schlüssel und Geräte (Menü des Kontos, Suche). */
export const SECURITY = 'bezpieczenstwo';

function LookPage({ who }: { who: Who }) {
  const t = useT();
  useCrumbs([{ label: t('account.look.crumb'), href: null }]);
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
  const t = useT();

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
      setFailed(e instanceof WorkspaceError ? e.message : t('account.keeping.loadFailed'));
    }
  }, [t]);

  useEffect(() => { void look(); }, [look]);

  const choose = async (wanted: KeyKeeping) => {
    if (wanted === mode) return;

    setBusy(wanted === 'tab' ? t('account.keeping.removing') : t('account.keeping.enabling'));
    setFailed(null);

    try {
      const done = await setKeyKeeping(wanted);

      if (wanted === 'tab') {
        /* 2026-10-28 — „Tylko w pamięci": auch die Powtórki ohne Netz und das Anmelden ohne Netz gehen von diesem Gerät. */
        await forgetAway(who.accountId).catch(() => undefined);
        toast(done.forgotten === 0
          ? t('account.keeping.memoryOnly')
          : t('account.keeping.removed', { count: done.forgotten }), { kind: 'ok' });
      } else {
        /*
         * Gleich verwahren, wenn dieser Tab den Schlüssel hat. Sonst sagte die
         * Einstellung „zachowany", und zachowane wäre er erst nach dem nächsten
         * Anmelden — also genau dann nicht, wenn man es gerade eingeschaltet hat.
         */
        const now = await keepHeldKey(who);
        toast(now ? t('account.keeping.keptHere') : t('account.keeping.keptNext'), { kind: 'ok' });
      }

      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('account.keeping.changeFailed'));
    } finally {
      setBusy(null);
    }
  };

  const forget = async (deviceId: string) => {
    setBusy(t('account.keeping.removingOne'));
    setFailed(null);

    try {
      await forgetKept(deviceId);
      await look();
      toast(t('account.keeping.forgotten'), { kind: 'ok' });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('account.keeping.removeFailed'));
    } finally {
      setBusy(null);
    }
  };

  return { mode, devices, here, busy, failed, choose, forget };
}

function AccountPage({ who }: { who: Who }) {
  const t = useT();
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

  /* 2026-10-29 — nach einem JSON-Import liest „Moje dane" neu (eigener Stand in `PersonCard`). */
  const [imported, setImported] = useState(0);

  return (
    <div className="wk-narrow ui-page wk-account">
      {ring === null && <Loading lines={3} />}

      {ring !== null && person !== null && (
        <>
          <PersonCard key={imported} roleId={person.id} ring={ring} />
          <PersonsJsonPanel who={who} onImported={() => setImported((n) => n + 1)} />
        </>
      )}

      {ring !== null && person === null && (
        <>
          <h2 className="wk-h2">{t('account.page.myData')}</h2>
          <p className="wk-note">{rich(t('account.page.noPerson'), marks)}</p>
        </>
      )}

      <section className="wk-box" aria-label={t('account.page.loginKeys')}>
        <a className="wk-line wk-line-first" href={viewPath('account', SECURITY)}>
          <span className="wk-line-ic is-info"><Icon name="shield" /></span>
          <span className="wk-line-text">
            <span className="wk-line-title">{t('account.security.title')}</span>
            <span className="wk-line-sub">
              {mode === null ? t('account.page.accountOf', { login: who.loginId })
                : devices.length > 0
                  ? t('account.page.keepingDevices', { mode: mode === 'kept' ? t('account.page.keyKept') : t('account.page.keyMemory'), devices: t('account.page.devices', { count: devices.length }) })
                  : mode === 'kept' ? t('account.page.keyKept') : t('account.page.keyMemory')}
            </span>
          </span>
          <span className="wk-line-end"><Icon name="next" /></span>
        </a>
        <a className="wk-line" href={viewPath('account', LANGUAGE)}>
          <span className="wk-line-ic"><Icon name="globe" /></span>
          <span className="wk-line-text">
            <span className="wk-line-title">{t('i18n.title')}</span>
            <span className="wk-line-sub">{LANG_NAME[t.lang]}</span>
          </span>
          <span className="wk-line-end"><Icon name="next" /></span>
        </a>
        <a className="wk-line" href={viewPath('account', TRANSFER)}>
          <span className="wk-line-ic"><Icon name="refresh" /></span>
          <span className="wk-line-text">
            <span className="wk-line-title">{t('account.page.transfer')}</span>
            <span className="wk-line-sub">{t('account.page.transferSub')}</span>
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
  const t = useT();
  useCrumbs([{ label: t('account.security.title'), href: null }]);
  const { mode, devices, here, busy, failed, choose, forget } = useKeeping(who);

  /* Geräte ohne Namen: dieses, und die anderen nach dem Tag, an dem sie dazukamen. */
  const ordered = [...devices].sort((a, b) => (a.deviceId === here ? -1 : b.deviceId === here ? 1 : a.createdAt.localeCompare(b.createdAt)));

  return (
    <div className="wk-narrow ui-page wk-security">
      <PageHeader title={t('account.security.title')} meta={t('account.page.accountOf', { login: who.loginId })} />

      <section aria-labelledby="sec-how">
        <h2 className="wk-h2" id="sec-how">{t('account.security.how')}</h2>
        <ul className="wk-security-how">
          {(['password', 'browser', 'access', 'link', 'lost'] as const).map((k) => <li key={k}>{rich(t(`account.security.point.${k}`), marks)}</li>)}
        </ul>
      </section>

      <section aria-labelledby="sec-key">
        <h2 className="wk-h2" id="sec-key">{t('account.security.keyHere')}</h2>
        {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        {mode === null && failed === null ? <Loading lines={2} /> : (
          <fieldset className="ui-choices" disabled={busy !== null}>
            <legend className="ui-sr">{t('account.security.howLong')}</legend>
            <Choice name="keeping" chosen={mode === 'kept'} title={t('account.security.keptTitle')} onPick={() => void choose('kept')}>
              {rich(t('account.security.keptText'), marks)}
            </Choice>
            <Choice name="keeping" chosen={mode === 'tab'} title={t('account.security.tabTitle')} onPick={() => void choose('tab')}>
              {rich(t('account.security.tabText'), marks)}
            </Choice>
          </fieldset>
        )}
        {busy !== null && <p className="wk-hint" role="status">{busy}</p>}
      </section>

      <section aria-labelledby="sec-devices">
        <h2 className="wk-h2" id="sec-devices">{t('account.security.devices')}</h2>
        {ordered.length === 0 ? (
          <p className="wk-empty">{t('account.security.noDevices')}</p>
        ) : (
          <div className="wk-box">
            {ordered.map((one, i) => (
              <div className={`wk-line${i === 0 ? ' wk-line-first' : ''}`} key={one.deviceId}>
                <span className="wk-line-ic"><Icon name={one.deviceId === here ? 'phone' : 'key'} /></span>
                <span className="wk-line-text">
                  <span className="wk-line-title">{one.deviceId === here ? t('account.security.thisDevice') : t('account.security.otherDevice', { date: when(one.createdAt, t) })}</span>
                  <span className="wk-line-sub">{one.lastUsedAt === null ? t('account.security.unused') : t('account.security.lastUsed', { date: when(one.lastUsedAt, t) })}</span>
                </span>
                <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy !== null} onClick={() => void forget(one.deviceId)}>
                  {t('account.security.forget')}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="wk-hint">{t('account.security.forgetHint')}</p>
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
  const t = useT();

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setPreview(null);
    setFailed(null);
    void deletionPreview()
      .then((found) => { if (alive) setPreview(found); })
      .catch((e: unknown) => { if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('account.delete.checkFailed')); });
    void myRoleNames(who).then((found) => { if (alive) setNames(found); }).catch(() => undefined);
    return () => { alive = false; };
  }, [open, who, t]);

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
      setFailed(e instanceof WorkspaceError ? e.message : t('account.delete.failed'));
    } finally {
      setBusy(false);
    }
  };

  /* Danach gibt es hier nichts mehr: neu laden, und die Anmeldung steht da. */
  if (gone) {
    return (
      <Modal title={t('account.delete.goneTitle')} onClose={() => window.location.reload()}>
        <p>{rich(t('account.delete.goneText', { login: who.loginId }), marks)}</p>
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => window.location.reload()}>{t('account.delete.finish')}</button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <section className="wk-danger-zone" aria-labelledby="account-delete">
        <div>
          <h2 className="wk-h2" id="account-delete">{t('account.delete.title')}</h2>
          <p className="wk-hint">{t('account.delete.lead')}</p>
        </div>
        <button type="button" className="wk-btn wk-btn-danger" onClick={() => setOpen(true)}>{t('account.delete.open')}</button>
      </section>

      {open && (
        <Modal title={t('account.delete.ask')} onClose={() => { if (!busy) setOpen(false); }}>
          {preview === null && failed === null && <Loading label={t('account.delete.checking')} />}

          {preview !== null && (
            <>
              <p><strong>{t('account.delete.willGo')}</strong></p>
              <ul className="wk-delete-list">
                <li>
                  {rich(t(preview.devices === 0 ? 'account.delete.accountItem' : 'account.delete.accountItemKeys', { login: preview.loginId, count: preview.devices }), marks)}
                </li>
                <li>
                  {preview.persons === 1 ? t('account.delete.person') : t('account.delete.persons', { count: preview.persons })}
                </li>
                {preview.deletedAreas.some((a) => a.personal) && <li>{t('account.delete.personal')}</li>}
                {preview.messages > 0 && (
                  <li>{t('account.delete.messages', { count: preview.messages })}</li>
                )}
                <li>{t('account.delete.bookings')}</li>
              </ul>

              <p>
                {rich(preview.pages.length > 0 ? t('account.delete.staysPages', { pages: preview.pages.join(', ') }) : t('account.delete.stays'), marks)}
              </p>

              {(groups.length > 0 || preview.orphanedAreas.length > 0 || preview.offices.length > 0) && (
                <div className="wk-note wk-delete-warn">
                  <p><strong>{t('account.delete.onlyYou')}</strong></p>
                  {groups.length > 0 && (
                    <>
                      <p>{rich(t('account.delete.groups'), marks)}</p>
                      <ul>{groups.map((a) => <li key={a.id}>„{a.name}”</li>)}</ul>
                    </>
                  )}
                  {(preview.orphanedAreas.length > 0 || preview.offices.length > 0) && (
                    <>
                      <p>{t('account.delete.orphans')}</p>
                      <ul>
                        {preview.orphanedAreas.map((a) => <li key={a.id}>{t('account.delete.orphanArea', { name: a.name })}</li>)}
                        {preview.offices.map((id) => <li key={id}>{t('account.delete.orphanRole', { name: names.get(id) ?? t('account.delete.noName') })}</li>)}
                      </ul>
                    </>
                  )}
                  <p>{t('account.delete.giveAccess')}</p>
                </div>
              )}

              {/* 0129 — wer danach für die Daten nicht mehr geradesteht. */}
              {(preview.endingControllers ?? []).length > 0 && (
                <div className="wk-note wk-delete-warn" data-ending-controllers="">
                  <p>{t('account.delete.controllers')}</p>
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
                <span>{rich(t('account.delete.typeLogin', { login: who.loginId }), marks)}</span>
                <input value={typed} autoComplete="off" autoCapitalize="none" onChange={(e) => setTyped(e.target.value)} />
              </label>
              <label className="wk-field">
                <span>{t('account.delete.password')}</span>
                <PasswordInput value={password} autoComplete="current-password" onChange={setPassword} />
              </label>
            </>
          )}

          {failed !== null && <p className="wk-error">{failed}</p>}

          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-danger" disabled={!ready || preview === null} onClick={() => void go()}>
              {busy ? t('account.keeping.removingOne') : t('account.delete.go')}
            </button>
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setOpen(false)}>{t('common.cancel')}</button>
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
  const t = useT();

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
      <h2 className="wk-h2">{t('account.seats.title')}</h2>

      <ul className="wk-list">
        {seats.map((seat) => (
          <li className="wk-row" key={seat.seatId}>
            <span>
              <strong>{seat.areaName}</strong>
              {seat.recipientName !== null && (
                <span className="wk-row-side"> · {seat.recipientName}</span>
              )}
            </span>
            <span className="wk-row-side">{seat.status === 'revoked' ? t('account.seats.revoked') : ''}</span>
          </li>
        ))}
      </ul>

      <p className="wk-hint">{t('account.seats.hint')}</p>
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
function when(iso: string, t: T): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';

  return at.toLocaleDateString(t.locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

export default Account;
