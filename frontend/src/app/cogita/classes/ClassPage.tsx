/**
 * 2026-11-22 — `#/workspace/klasa/<klasse>/<baza>`: DIE SEITE EINER KLASSE. Hierher führt der QR-Code, den die Lehrerin zeigt
 * (`ClassesTab.tsx`), und hierher kommt ein Schüler jeden Tag zurück.
 *
 * Wer kommt, und was er sieht:
 *   - ohne Konto, mit dem Code: DREI WEGE — „Załóż konto" (empfohlen: die Fortschritte auf jedem Gerät; danach die kleine
 *     Werkstatt), „Mam już konto" (anmelden und beitreten), „Bez konta" (nur Name: eine Person des Links mit einem eigenen
 *     Link — der ist der Schlüssel, er wird gezeigt, um ihn zu behalten);
 *   - ohne Konto, als Person der Klasse (ihr Link): gleich die Karte;
 *   - mit Konto, Schüler: die Karte (und eine Lekcja, die gerade läuft); noch nicht drin, aber mit Code: „Dołącz";
 *   - mit Konto, Lehrerin: wohin sie die Klasse führt.
 *
 * Die Karte ist der Baustein „Widok" der Seiten (Krajobraz, `viewViews.tsx`) — derselbe für Konto und Person ohne Konto
 * (`pageLearner.tsx`); die Antworten gehen in die Klasse.
 */

import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { rich, useT } from '../../core/i18n';
import { forgetKeys, keysFor } from '../../core/ringOf';
import { signIn, WorkspaceError, type Who } from '../../core/session';
import { heldLinks } from '../../links/linkKeep';
import { linkSecrets, redeemLink, showLink, type LinkInfo } from '../../links/linkAccess';
import { createLinkPerson } from '../../links/linkPerson';
import { LinkClauses } from '../../links/JoinLink';
import { partSize } from '../../pages/part';
import { PersonProvider } from '../../pages/pagePerson';
import { personsOf } from '../../roles/roles';
import { viewPath } from '../../routes';
import { pageLink, seatsExactly, SEATS_EVENT } from '../../seats/seatKeep';
import { createAccount } from '../../shell/accountCreate';
import { Icon } from '../../ui/icons';
import { Loading } from '../../ui/Loading';
import { PasswordInput } from '../../ui/PasswordInput';
import { usePageBase } from '../pageBase';
import type { CogitaLibrary } from '../store';
import { loadSessions, type SessionRow } from '../live';
import { classAim, classIdOf } from './classModel';
import { forgetClasses, myClasses } from './classes';
import { chooseShell } from './shellChoice';
import './classes.css';

const ViewView = lazy(() => import('../../pages/parts/viewViews').then((m) => ({ default: m.ViewView })));

type Where = { readonly areaId: string; readonly libraryId: string };

export function ClassPage({ trail, who, onWho }: { trail: readonly string[]; who: Who | null; onWho?: (who: Who) => void }) {
  const t = useT();
  const where = classIdOf(trail);
  if (where === null) {
    return (
      <div className="cl-page wk-narrow">
        <h1 className="wk-h1">{t('cogitaClass.page.noClass')}</h1>
        <p className="wk-lede">{t('cogitaClass.page.scanAgain')}</p>
      </div>
    );
  }
  return <ClassHere where={where} who={who} onWho={onWho} />;
}

/* -- Der Code, mit dem man hierher kam ------------------------------------------------------------------------------ */

interface HeldClassLink { readonly token: string; readonly info: LinkInfo }

/** Der Link dieser Klasse, den dieser Browser hält (der QR-Code, eben geöffnet) — `null`: keiner; `undefined`: wird gelesen. */
function useClassLink(where: Where): HeldClassLink | null | undefined {
  const [found, setFound] = useState<HeldClassLink | null | undefined>(undefined);
  const aim = classAim(where.areaId, where.libraryId);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const mine = heldLinks().filter((one) => (one.aim ?? '').toLowerCase() === aim);
      let first: HeldClassLink | null = null;
      for (const one of mine) {
        try {
          const info = await showLink((await linkSecrets(one.token)).lookup);
          const here = { token: one.token, info };
          if (info.state === null) { if (alive) setFound(here); return; }
          first ??= here;
        } catch { /* ein Link, den es nicht mehr gibt */ }
      }
      if (alive) setFound(first);
    })();
    return () => { alive = false; };
  }, [aim]);
  return found;
}

/** Hält dieser Browser eine Person ohne Konto in dieser Klasse? (ihr Link öffnet diese Seite) */
function useSeatHere(where: Where): boolean {
  const aim = classAim(where.areaId, where.libraryId);
  const [has, setHas] = useState(() => seatsExactly(aim).length > 0);
  useEffect(() => {
    const look = () => setHas(seatsExactly(aim).length > 0);
    look();
    window.addEventListener(SEATS_EVENT, look);
    return () => window.removeEventListener(SEATS_EVENT, look);
  }, [aim]);
  return has;
}

/** Die Rolle eines Kontos in dieser Klasse — `undefined`: wird nachgesehen. */
function useMembership(who: Who | null, where: Where, tick: number): { readonly role: 'lead' | 'member' | 'none'; readonly name: string | null; readonly base: string | null } | undefined {
  const [found, setFound] = useState<{ role: 'lead' | 'member' | 'none'; name: string | null; base: string | null } | undefined>(undefined);
  useEffect(() => {
    if (who === null) { setFound({ role: 'none', name: null, base: null }); return undefined; }
    let alive = true;
    setFound(undefined);
    void (async () => {
      const [lead, member] = await Promise.all([myClasses(true, where.libraryId, tick > 0), myClasses(false, where.libraryId, tick > 0)]);
      const at = (list: typeof lead) => list.find((c) => c.areaId.toLowerCase() === where.areaId);
      const l = at(lead);
      const m = at(member);
      const one = l ?? m;
      const base = one?.bases.find((b) => b.libraryId.toLowerCase() === where.libraryId)?.name ?? null;
      if (alive) setFound({ role: l !== undefined ? 'lead' : m !== undefined ? 'member' : 'none', name: one?.name ?? null, base });
    })().catch(() => { if (alive) setFound({ role: 'none', name: null, base: null }); });
    return () => { alive = false; };
  }, [who, where.areaId, where.libraryId, tick]);
  return found;
}

/* -- Die Seite ---------------------------------------------------------------------------------------------------- */

function ClassHere({ where, who, onWho }: { where: Where; who: Who | null; onWho?: (who: Who) => void }) {
  const t = useT();
  const [tick, setTick] = useState(0);
  /* Eine Person ohne Konto entsteht eben: erst wird ihr Link gezeigt (zum Behalten), dann die Karte. */
  const [keeping, setKeeping] = useState(false);
  const link = useClassLink(where);
  const seatHere = useSeatHere(where);
  const member = useMembership(who, where, tick);
  const className = member?.name ?? link?.info.areas.find((a) => a.areaId.toLowerCase() === where.areaId)?.name ?? null;
  const title = className ?? t('cogitaClass.page.aClass');

  /* Ohne Konto, als Person dieser Klasse: gleich lernen. */
  if (who === null && seatHere && !keeping) return <ClassLearn where={where} title={title} who={null} />;

  if (who !== null) {
    if (member === undefined) return <Loading label={t('cogitaClass.page.checking')} />;
    if (member.role === 'member') return <ClassLearn where={where} title={title} who={who} />;
    if (member.role === 'lead') {
      return (
        <div className="cl-page wk-narrow">
          <h1 className="wk-h1">{title}</h1>
          <p className="wk-lede">{t('cogitaClass.page.youLead')}</p>
          <div className="wk-actions">
            <a className="wk-btn" href={viewPath('learn', where.libraryId, 'klasy')}><Icon name="users" />{t('cogitaClass.page.toClasses')}</a>
            <a className="wk-btn wk-btn-line" href={viewPath('learn', where.libraryId, 'postepy', where.areaId)}>{t('cogitaClass.page.toProgress')}</a>
          </div>
        </div>
      );
    }
  }

  if (link === undefined) return <Loading label={t('cogitaClass.page.checking')} />;
  if (link === null || link.info.state !== null) {
    return (
      <div className="cl-page wk-narrow">
        <h1 className="wk-h1">{title}</h1>
        <p className="wk-lede">{link === null ? t('cogitaClass.page.noCode') : t('cogitaClass.page.codeDead')}</p>
        {who === null && <p>{rich(t('cogitaClass.page.haveAccount'), { a: (s) => <a className="wk-link" href={viewPath('learn')}>{s}</a> })}</p>}
      </div>
    );
  }

  return (
    <div className="cl-page wk-narrow">
      <h1 className="wk-h1">{t('cogitaClass.join.title', { name: className ?? link.info.label ?? '' })}</h1>
      {who === null
        ? <JoinChoices where={where} link={link} className={className ?? ''} hold={setKeeping} onWho={(made) => { forgetClasses(); setTick((n) => n + 1); onWho?.(made); }} />
        : <JoinAsMe who={who} where={where} link={link} onJoined={() => { forgetClasses(); setTick((n) => n + 1); }} />}
      <LinkClauses areas={link.info.areas} invitationId={link.info.invitationId} />
    </div>
  );
}

/* -- Beitreten mit dem eigenen Konto ------------------------------------------------------------------------------ */

/** Den Link als die erste Person des Kontos einlösen — danach ist sie in der Klasse (Rolle der Uczniowie). */
async function joinAs(who: Who, link: HeldClassLink, noPerson: string): Promise<void> {
  const { ring, graph } = await keysFor(who);
  const person = personsOf(graph)[0];
  /* Ohne Schlüssel oder ohne Person geht es nicht. */
  if (ring === null || person === undefined) throw new WorkspaceError(noPerson);
  await redeemLink(ring, person, link.token, link.info);
  forgetKeys();
  forgetClasses();
}

function JoinAsMe({ who, where, link, onJoined }: { who: Who; where: Where; link: HeldClassLink; onJoined: () => void }) {
  const t = useT();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (!consent || busy) return;
    setBusy(true);
    setFailed(null);
    void joinAs(who, link, t('cogitaClass.join.noPerson')).then(onJoined, (err: unknown) => setFailed(err instanceof WorkspaceError ? err.message : t('cogitaClass.join.failed'))).finally(() => setBusy(false));
  };
  return (
    <form className="cl-form" onSubmit={go} data-class-join="me">
      <p className="wk-lede">{t('cogitaClass.join.asMe', { login: who.loginId })}</p>
      <Consent checked={consent} onChange={setConsent} name={link.info.areas.find((a) => a.areaId.toLowerCase() === where.areaId)?.name ?? ''} />
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={!consent || busy}>{busy ? t('cogitaClass.join.joining') : t('cogitaClass.join.join')}</button>
      </div>
    </form>
  );
}

/* -- Drei Wege ohne Konto ----------------------------------------------------------------------------------------- */

type Way = 'new' | 'in' | 'guest';

function JoinChoices({ where, link, className, hold, onWho }: { where: Where; link: HeldClassLink; className: string; hold: (yes: boolean) => void; onWho: (who: Who) => void }) {
  const t = useT();
  const [way, setWay] = useState<Way | null>(null);
  if (way === null) {
    return (
      <>
        <p className="wk-lede">{t('cogitaClass.join.lede')}</p>
        <div className="cl-ways" role="list">
          <WayCard best icon="user" title={t('cogitaClass.join.newTitle')} says={t('cogitaClass.join.newSays')} onPick={() => setWay('new')} way="new" badge={t('cogitaClass.join.easiest')} />
          <WayCard icon="key" title={t('cogitaClass.join.inTitle')} says={t('cogitaClass.join.inSays')} onPick={() => setWay('in')} way="in" />
          <WayCard icon="link" title={t('cogitaClass.join.guestTitle')} says={t('cogitaClass.join.guestSays')} onPick={() => setWay('guest')} way="guest" />
        </div>
      </>
    );
  }
  return (
    <>
      <button type="button" className="wk-link-btn cl-back" onClick={() => setWay(null)} data-class-back="">‹ {t('cogitaClass.join.otherWay')}</button>
      {way === 'new' && <NewAccount link={link} className={className} onWho={onWho} />}
      {way === 'in' && <SignInAndJoin where={where} link={link} className={className} onWho={onWho} />}
      {way === 'guest' && <AsGuest where={where} link={link} className={className} hold={hold} />}
    </>
  );
}

function WayCard({ icon, title, says, onPick, best = false, badge, way }: { icon: 'user' | 'key' | 'link'; title: string; says: string; onPick: () => void; best?: boolean; badge?: string; way: Way }) {
  return (
    <button type="button" role="listitem" className={best ? 'cl-way is-best' : 'cl-way'} onClick={onPick} data-class-way={way}>
      <span className="cl-way-ic" aria-hidden="true"><Icon name={icon} /></span>
      <span className="cl-way-text">
        <strong>{title}{badge !== undefined && <span className="cl-badge">{badge}</span>}</strong>
        <span>{says}</span>
      </span>
      <Icon name="next" />
    </button>
  );
}

function Consent({ checked, onChange, name }: { checked: boolean; onChange: (yes: boolean) => void; name: string }) {
  const t = useT();
  return (
    <label className="wk-check cl-consent">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-class-consent="" />
      <span>{t('cogitaClass.join.consent', { name })}</span>
    </label>
  );
}

/** Was im Formular fehlt — ein Satz, oder `null`. */
function missing(t: ReturnType<typeof useT>, f: { given?: string; surname?: string; login?: string; password?: string; consent: boolean; newAccount?: boolean }): string | null {
  if (f.given !== undefined && f.given.trim() === '') return t('cogitaClass.join.needGiven');
  if (f.surname !== undefined && f.surname.trim() === '') return t('cogitaClass.join.needSurname');
  if (f.login !== undefined && f.login.trim().length < (f.newAccount === true ? 3 : 1)) return f.newAccount === true ? t('shell.signIn.loginShort') : t('shell.signIn.needLogin');
  if (f.password !== undefined && f.password.length < (f.newAccount === true ? 8 : 1)) return f.newAccount === true ? t('shell.signIn.passwordShort') : t('shell.signIn.needPassword');
  if (!f.consent) return t('cogitaClass.join.needConsent');
  return null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="wk-field">
      <span>{label}</span>
      {children}
      {hint !== undefined && <small className="cl-field-hint">{hint}</small>}
    </label>
  );
}

function NewAccount({ link, className, onWho }: { link: HeldClassLink; className: string; onWho: (who: Who) => void }) {
  const t = useT();
  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const problem = missing(t, { given, surname, login, password, consent, newAccount: true });
  const go = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem !== null || busy !== null) return;
    setFailed(null);
    setBusy(t('cogitaClass.join.busyAccount'));
    void (async () => {
      try {
        const { who, personFailed } = await createAccount(login, password, `${given.trim()} ${surname.trim()}`);
        setPassword('');
        if (personFailed !== null) { setFailed(personFailed); onWho(who); return; }
        setBusy(t('cogitaClass.join.busyJoin'));
        await joinAs(who, link, t('cogitaClass.join.noPerson'));
        /* Wer über eine Klasse ein Konto anlegt, sieht die kleine Werkstatt — nur die Nauka (`LearnerShell.tsx`). */
        await chooseShell(who.accountId, 'learn').catch(() => undefined);
        onWho(who);
      } catch (err) {
        setFailed(err instanceof WorkspaceError ? err.message : t('cogitaClass.join.failed'));
        setBusy(null);
      }
    })();
  };
  return (
    <form className="cl-form" onSubmit={go} noValidate data-class-form="new">
      <h2 className="wk-h2">{t('cogitaClass.join.newTitle')}</h2>
      <div className="cl-row">
        <Field label={t('cogitaClass.join.given')}><input value={given} onChange={(e) => setGiven(e.target.value)} autoComplete="given-name" autoFocus data-class-given="" /></Field>
        <Field label={t('cogitaClass.join.surname')}><input value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" data-class-surname="" /></Field>
      </div>
      <Field label={t('shell.signIn.login')} hint={t('cogitaClass.join.loginHint')}><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" data-class-login="" /></Field>
      <Field label={t('shell.signIn.password')} hint={t('cogitaClass.join.passwordHint')}><PasswordInput value={password} onChange={setPassword} autoComplete="new-password" /></Field>
      <Consent checked={consent} onChange={setConsent} name={className} />
      {tried && problem !== null && <p className="wk-blocker" role="status">{problem}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="cl-busy" role="status"><span className="cl-spin" aria-hidden="true" />{busy}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy !== null} data-class-submit="">{t('cogitaClass.join.newGo')}</button>
      </div>
    </form>
  );
}

function SignInAndJoin({ where, link, className, onWho }: { where: Where; link: HeldClassLink; className: string; onWho: (who: Who) => void }) {
  const t = useT();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const problem = missing(t, { login, password, consent });
  const go = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem !== null || busy !== null) return;
    setFailed(null);
    setBusy(t('shell.unlock.busy'));
    void (async () => {
      try {
        const who = await signIn(login.trim(), password);
        setPassword('');
        setBusy(t('cogitaClass.join.busyJoin'));
        /* Schon in der Klasse (ein zweites Gerät): nichts einzulösen. */
        const inside = (await myClasses(false, where.libraryId, true)).some((c) => c.areaId.toLowerCase() === where.areaId);
        if (!inside) await joinAs(who, link, t('cogitaClass.join.noPerson'));
        onWho(who);
      } catch (err) {
        setFailed(err instanceof WorkspaceError ? err.message : t('cogitaClass.join.failed'));
        setBusy(null);
      }
    })();
  };
  return (
    <form className="cl-form" onSubmit={go} noValidate data-class-form="in">
      <h2 className="wk-h2">{t('cogitaClass.join.inTitle')}</h2>
      <Field label={t('shell.signIn.login')}><input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus data-class-login="" /></Field>
      <Field label={t('shell.signIn.password')}><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></Field>
      <Consent checked={consent} onChange={setConsent} name={className} />
      {tried && problem !== null && <p className="wk-blocker" role="status">{problem}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="cl-busy" role="status"><span className="cl-spin" aria-hidden="true" />{busy}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy !== null} data-class-submit="">{t('cogitaClass.join.inGo')}</button>
      </div>
    </form>
  );
}

function AsGuest({ where, link, className, hold }: { where: Where; link: HeldClassLink; className: string; hold: (yes: boolean) => void }) {
  const t = useT();
  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const aim = classAim(where.areaId, where.libraryId);
  const problem = missing(t, { given, surname, consent });
  const go = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (problem !== null || busy) return;
    setBusy(true);
    setFailed(null);
    hold(true);
    void createLinkPerson({ areaId: where.areaId, invitationId: link.info.invitationId, linkRoleId: link.info.roleId }, given, surname, aim, { group: className })
      .then((person) => setMade(`${window.location.origin}${window.location.pathname}${pageLink(aim, person.token, person.keyText)}`))
      .catch((err: unknown) => { hold(false); setFailed(err instanceof WorkspaceError ? err.message : t('cogitaClass.join.failed')); })
      .finally(() => setBusy(false));
  };
  if (made !== null) return <KeepLink url={made} onStart={() => hold(false)} />;
  return (
    <form className="cl-form" onSubmit={go} noValidate data-class-form="guest">
      <h2 className="wk-h2">{t('cogitaClass.join.guestTitle')}</h2>
      <p className="cl-note">{t('cogitaClass.join.guestNote')}</p>
      <div className="cl-row">
        <Field label={t('cogitaClass.join.given')}><input value={given} onChange={(e) => setGiven(e.target.value)} autoComplete="given-name" autoFocus data-class-given="" /></Field>
        <Field label={t('cogitaClass.join.surname')}><input value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" data-class-surname="" /></Field>
      </div>
      <Consent checked={consent} onChange={setConsent} name={className} />
      {tried && problem !== null && <p className="wk-blocker" role="status">{problem}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy} data-class-submit="">{busy ? t('cogitaClass.join.joining') : t('cogitaClass.join.guestGo')}</button>
      </div>
    </form>
  );
}

/** Der eigene Link einer Person ohne Konto — er ist der Schlüssel; ohne ihn sind die Fortschritte auf keinem anderen Gerät. */
function KeepLink({ url, onStart }: { url: string; onStart: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [kept, setKept] = useState(false);
  return (
    <section className="cl-keep" data-class-keep="">
      <h2 className="wk-h2">{t('cogitaClass.keep.title')}</h2>
      <p className="wk-lede">{t('cogitaClass.keep.lede')}</p>
      <input className="wk-link-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} data-class-own-link="" />
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-line" onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setKept(true); }); }}>{copied ? t('common.copied') : t('common.copy')}</button>
        {typeof navigator.share === 'function' && (
          <button type="button" className="wk-btn wk-btn-line" onClick={() => void navigator.share({ url, title: t('cogitaClass.keep.shareTitle') }).then(() => setKept(true)).catch(() => undefined)}>{t('cogitaClass.keep.sendToMe')}</button>
        )}
      </div>
      <p className="cl-note">{t('cogitaClass.keep.how')}</p>
      <label className="wk-check">
        <input type="checkbox" checked={kept} onChange={(e) => setKept(e.target.checked)} data-class-kept="" />
        <span>{t('cogitaClass.keep.done')}</span>
      </label>
      <div className="wk-actions">
        {/* Der Platz steht schon in diesem Browser (`seatKeep`) — die Seite zeigt dann die Karte. */}
        <button type="button" className="wk-btn" disabled={!kept} onClick={onStart} data-class-start="">{t('cogitaClass.keep.start')}</button>
      </div>
    </section>
  );
}

/* -- Lernen in der Klasse ----------------------------------------------------------------------------------------- */

/** Der Widok, den die Klasse zeigt: die Weltkarte der Baza, sonst ein Krajobraz, sonst der erste Widok. */
export function worldViewOf(lib: CogitaLibrary): string | null {
  const views = lib.docs('view');
  const data = (d: (typeof views)[number]) => d.data as { landscape?: { style?: unknown }; mode?: unknown };
  return (views.find((d) => data(d).landscape?.style === 'world') ?? views.find((d) => data(d).landscape !== undefined || data(d).mode === 'landscape') ?? views[0])?.id ?? null;
}

function ClassLearn({ where, title, who }: { where: Where; title: string; who: Who | null }) {
  const t = useT();
  const { lib } = usePageBase(where.libraryId);
  const view = useMemo(() => (lib == null ? null : worldViewOf(lib)), [lib, lib?.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const aim = classAim(where.areaId, where.libraryId);
  const live = useLiveLessons(who, where);
  const size = useMemo(() => partSize({ colSpan: 6, rowSpan: 5 }), []);
  return (
    <div className="cl-learn" data-class-learn="">
      <header className="cl-learn-head">
        <h1 className="wk-h1">{title}</h1>
        {who !== null && (
          <nav className="cl-learn-links" aria-label={t('cogitaClass.page.more')}>
            {/* Die eigenen Fortschritte — dieselbe Ansicht wie in der Nauka (Postępy), mit den Antworten dieser Klasse. */}
            <a className="wk-btn wk-btn-line" href={viewPath('learn', where.libraryId, 'postepy')} data-class-own-progress=""><Icon name="list" />{t('cogitaClass.page.ownProgress')}</a>
            <a className="wk-link-btn" href={viewPath('learn', where.libraryId)}>{t('cogitaClass.page.wholeBase')}</a>
          </nav>
        )}
      </header>
      {live.map((s) => (
        <a key={s.sessionId} className="cl-live" href={viewPath('learn', where.libraryId, 'sesje', s.sessionId)} data-class-live={s.sessionId}>
          <span className="cl-live-dot" aria-hidden="true" />
          <strong>{s.state === 'paused' ? t('cogitaUnit.home.homework') : t('cogitaClass.page.liveNow')}</strong>
          <span>{s.state === 'paused' ? t('cogitaUnit.home.homeworkOpen') : t('cogitaClass.page.liveJoin')}</span>
        </a>
      ))}
      {lib === undefined ? <Loading label={t('cogitaClass.page.opening')} />
        : lib === null ? <p className="wk-error">{t('cogitaClass.page.noBase')}</p>
        : view === null ? <p className="wk-lede">{t('cogitaClass.page.noMap')}</p>
        : (
          <PersonProvider path={aim}>
            <Suspense fallback={<Loading />}>
              <ViewView config={{ title: '', library: where.libraryId, view, mode: 'krajobraz', answers: where.areaId, rewards: '', switching: false }}
                ctx={{ moduleId: `class-${where.areaId}`, size, whole: true }} />
            </Suspense>
          </PersonProvider>
        )}
    </div>
  );
}

/** Lekcje, die in dieser Klasse gerade laufen (nur mit Konto — eine Person ohne Konto kommt mit dem Code an der Tafel hinein). */
function useLiveLessons(who: Who | null, where: Where): readonly SessionRow[] {
  const [live, setLive] = useState<readonly SessionRow[]>([]);
  useEffect(() => {
    if (who === null) { setLive([]); return undefined; }
    let alive = true;
    const look = () => void loadSessions(where.areaId, where.libraryId)
      /* 2026-11-22 (Homer) — dazu eine Einheit zwischen den Stunden (pausiert, mit Code): dort stehen die Hausaufgaben. */
      .then((r) => { if (alive) setLive(r.sessions.filter((s) => s.kind === 'lesson' && (s.state === 'running' || s.state === 'lobby' || (s.state === 'paused' && s.joinCode !== null)))); }, () => undefined);
    look();
    const timer = window.setInterval(look, 20_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [who, where.areaId, where.libraryId]);
  return live;
}
