/**
 * DOŁĄCZ — `#/dolacz/<geheimnis>` (0065).
 *
 * <b>Erst sehen, dann entscheiden.</b> Wer den Link öffnet, sieht, wozu er
 * einlädt (Name, Bereiche, Stufe), bevor etwas geschieht. Angemeldet sein
 * muss er erst zum Annehmen — und dann wählt er, ALS WER (eine seiner
 * Personen): der Zugang hängt an einem Menschen, nicht am Konto.
 */

import { useEffect, useState } from 'react';

import { accessWords, linkSecrets, redeemLink, showLink, type LinkArea, type LinkInfo } from './linkAccess';
import { ControllerClause } from '../areas/ControllerClause';
import { loadCalendars } from '../calendar/calendar';
import { useLinkMe } from './linkMe';
import type { SealedRole } from '../core/keys';
import { forgetKeys, keysFor } from '../core/ringOf';
import { personsOf } from '../roles/roles';
import { tilesPath, viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { Unlock } from '../shell/Unlock';
import { LinkChatsSection } from '../chat/LinkChatJoin';
import type { Ring } from '../core/keys';
import { Loading } from '../ui/Loading';
import { useT } from '../core/i18n';

/** 0074 — was eine Stufe in einem Bereich heisst, ausführlich (`links.levelSays.*`). */
const LEVELS: ReadonlySet<string> = new Set(['read', 'write', 'admin']);
const levelSays = (t: (key: string) => string, capability: string): string => (LEVELS.has(capability) ? t(`links.levelSays.${capability}`) : capability);

/** Warum ein Link nicht mehr gilt (`links.join.state.*`). */
const STATES: ReadonlySet<string> = new Set(['revoked', 'expired', 'used']);
const stateSays = (t: (key: string) => string, state: string): string => (STATES.has(state) ? t(`links.join.state.${state}`) : t('links.join.dead'));

export function JoinLink({ token, who }: { token: string | null; who: Who }) {
  const t = useT();
  const [info, setInfo] = useState<LinkInfo | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [ring, setRing] = useState<Ring | null>(null);
  const [persons, setPersons] = useState<readonly SealedRole[]>([]);
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (token === null || token === '') throw new WorkspaceError(t('links.join.noInvite'));
        const { lookup } = await linkSecrets(token);
        const found = await showLink(lookup);
        if (alive) setInfo(found);
      } catch (e) {
        if (alive) { setInfo(null); setFailed(e instanceof WorkspaceError ? e.message : t('links.join.noSuchInvite')); }
      }

      try {
        const keys = await keysFor(who);
        if (!alive) return;
        setRing(keys.ring);
        const own = personsOf(keys.graph);
        setPersons(own);
        if (keys.ring !== null) setNames(await keys.ring.names());
      } catch {
        // Ohne Schlüssel fragt die Ansicht nach dem Passwort.
      }
    })();
    return () => { alive = false; };
  }, [token, who, tick]);

  if (info === undefined) return <Loading label={t('links.join.checking')} />;

  if (info === null) {
    return (
      <>
        <h1 className="wk-h1">{t('links.join.title')}</h1>
        <p className="wk-error">{failed}</p>
        <p><a className="wk-link" href={tilesPath()}>{t('links.join.toWorkspace')}</a></p>
      </>
    );
  }

  const person = persons.find((p) => p.id === pick) ?? persons[0] ?? null;

  if (done) {
    return (
      <>
        <h1 className="wk-h1">{t('links.join.joined')}</h1>
        <p className="wk-lede">{t('links.join.joinedLede', { access: accessWords(info.areas) })}</p>
        <div className="wk-actions">
          {info.aim !== null && <a className="wk-btn" href={`#/${info.aim}`}>{t('links.join.goOn')}</a>}
          <a className={info.aim !== null ? 'wk-link-btn' : 'wk-btn'} href={viewPath('areas')}>{t('links.join.seeAreas')}</a>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="wk-h1">{info.label !== null ? t('links.join.titleNamed', { label: info.label }) : t('links.join.title')}</h1>

      <dl className="wk-facts">
        <div className="wk-fact"><dt>{t('links.join.access')}</dt><dd><ul className="wk-link-access">{info.areas.length === 0 ? <li>—</li> : info.areas.map((a) => <li key={a.areaId}><strong>{a.name}</strong> — {levelSays(t, a.capability)}</li>)}</ul></dd></div>
        <div className="wk-fact"><dt>{t('links.join.validUntil')}</dt><dd>{new Date(info.expiresAt).toLocaleDateString(t.locale)}</dd></div>
        {info.once && <div className="wk-fact"><dt>{t('links.join.link')}</dt><dd>{t('links.item.once')}</dd></div>}
        {info.aim !== null && <div className="wk-fact"><dt>{t('links.join.opens')}</dt><dd><a href={`#/${info.aim}`}>{`recreatio.pl/#/${info.aim}`}</a></dd></div>}
      </dl>

      <LinkClauses areas={info.areas} invitationId={info.invitationId} />

      {info.state !== null ? (
        <p className="wk-warn">{stateSays(t, info.state)}</p>
      ) : ring === null ? (
        <Unlock who={who} why={t('links.join.unlockWhy')} onDone={() => { forgetKeys(); setTick((n) => n + 1); }} />
      ) : person === null ? (
        <p className="wk-blocker">{t('links.join.noPerson')}</p>
      ) : (
        <form className="wk-form" onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setFailed(null);
          void redeemLink(ring, person, token!, info)
            .then(() => { forgetKeys(); setDone(true); })
            .catch((err) => setFailed(err instanceof WorkspaceError ? err.message : t('links.join.failed')))
            .finally(() => setBusy(false));
        }}>
          {persons.length > 1 && (
            <label className="wk-field">
              <span>{t('links.join.as')}</span>
              <select value={person.id} onChange={(e) => setPick(e.target.value)}>
                {persons.map((p) => <option key={p.id} value={p.id}>{names.get(p.id) ?? p.id.slice(0, 8)}</option>)}
              </select>
            </label>
          )}
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('links.join.joining') : t('links.join.join')}</button>
            <a className="wk-link-btn" href={tilesPath()}>{t('links.bar.notNow')}</a>
          </div>
        </form>
      )}
    </>
  );
}

/**
 * Ohne Anmeldung, auf `#/dolacz/<T>`: der Link gilt in diesem Browser schon
 * (`linkKeep`). Diese Seite sagt, WAS er hier gibt und wohin es geht — das
 * Ziel, der Kalender.
 *
 * <b>Kein „dem Konto hinzufügen"</b> (Wunsch 2026-10-03): das wird nur dem
 * angeboten, der angemeldet ist. Vorher stand hier zuerst die Anmeldung, und
 * wer kein Konto hatte, hielt den Link für einen, der ein Konto verlangt. Die
 * Anmeldung bleibt einen Klick entfernt — für den, der schon eines hat; erst
 * danach fragt `JoinLink`, ob der Link ins Konto soll.
 */
export function JoinWithoutAccount({ token, onSignIn }: { token: string | null; onSignIn: () => void }) {
  const t = useT();
  const [info, setInfo] = useState<LinkInfo | null | undefined>(undefined);
  const me = useLinkMe(true);
  const [calendar, setCalendar] = useState(false);

  useEffect(() => {
    let alive = true;
    if (token === null || token === '') { setInfo(null); return undefined; }
    void linkSecrets(token).then((s) => showLink(s.lookup))
      .then((found) => { if (alive) setInfo(found); }, () => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [token]);

  /* Der Kalender — nur, wenn die Bereiche dieses Links einen haben. */
  useEffect(() => {
    if (me == null || info == null) return undefined;
    let alive = true;
    const areas = new Set(info.areas.map((a) => a.areaId));
    loadCalendars()
      .then((got) => got.calendars.some((c) => areas.has(c.areaId) && c.archived !== true), () => false)
      .then((has) => { if (alive) setCalendar(has); });
    return () => { alive = false; };
  }, [me, info]);

  if (info === undefined) return <Loading label={t('links.join.checkingLink')} />;

  const signIn = (
    <p className="wk-hint">
      {t('links.join.haveAccount')} <button type="button" className="wk-link-btn" onClick={onSignIn}>{t('common.signIn')}</button>
    </p>
  );

  if (info === null) {
    return (
      <>
        <h1 className="wk-h1">{t('links.bar.label')}</h1>
        <p className="wk-error">{t('links.join.noSuchLink')}</p>
        {signIn}
      </>
    );
  }

  const writes = info.areas.some((a) => a.capability === 'write' || a.capability === 'admin');

  return (
    <>
      <h1 className="wk-h1">{info.label !== null ? t('links.join.linkNamed', { label: info.label }) : t('links.bar.label')}</h1>

      <dl className="wk-facts">
        <div className="wk-fact"><dt>{t('links.join.access')}</dt><dd><ul className="wk-link-access">{info.areas.length === 0 ? <li>—</li> : info.areas.map((a) => <li key={a.areaId}><strong>{a.name}</strong> — {levelSays(t, a.capability)}</li>)}</ul></dd></div>
        <div className="wk-fact"><dt>{t('links.join.validUntilLink')}</dt><dd>{new Date(info.expiresAt).toLocaleDateString(t.locale)}</dd></div>
      </dl>

      <LinkClauses areas={info.areas} invitationId={info.invitationId} />

      {info.state !== null ? (
        <p className="wk-warn">{stateSays(t, info.state)}</p>
      ) : (
        <>
          <p className="wk-lede">
            {!calendar ? t('links.join.guest') : writes ? t('links.join.guestCalendarWrites') : t('links.join.guestCalendar')}
          </p>
          {(info.aim !== null || calendar) && (
            <div className="wk-actions">
              {info.aim !== null && <a className="wk-btn" href={`#/${info.aim}`}>{t('common.open')}</a>}
              {calendar && <a className={info.aim !== null ? 'wk-btn wk-btn-line' : 'wk-btn'} href={viewPath('calendar')}>{t('app.view.calendar')}</a>}
            </div>
          )}

          {/* 0095 — die Rozmowy dieses Links: mit der eigenen Person, sonst „Przedstaw się". */}
          <LinkChatsSection invitationId={info.invitationId} />
        </>
      )}

      {signIn}
    </>
  );
}

export default JoinLink;

/**
 * 0129 — WER FÜR DIE DATEN DER BEREICHE GERADESTEHT, in die der Link führt: je
 * Administrator eine Klausel (mehrere Bereiche teilen oft denselben). Gesperrt
 * wird ein Link dafür nie — er sagt es nur. Dazu „Zgłoś" für den Link selbst.
 */
export function LinkClauses({ areas, invitationId }: { areas: readonly LinkArea[]; invitationId: string }) {
  if (areas.every((a) => a.controller === undefined)) return null;
  const seen = new Set<string>();
  const shown: { key: string; controller: LinkArea['controller'] }[] = [];
  for (const a of areas) {
    const key = a.controller === null || a.controller === undefined ? 'none' : (a.controller.id ?? a.controller.name);
    if (seen.has(key)) continue;
    seen.add(key);
    shown.push({ key, controller: a.controller ?? null });
  }
  return (
    <section className="wk-link-clauses">
      {shown.map((one, i) => (
        <ControllerClause key={one.key} controller={one.controller ?? null} context="collect"
          report={i === shown.length - 1 ? { kind: 'link', id: invitationId } : null} />
      ))}
    </section>
  );
}
