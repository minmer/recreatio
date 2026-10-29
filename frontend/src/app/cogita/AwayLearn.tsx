/**
 * NAUKA BEZ INTERNETU (2026-10-28) — `#/workspace/learn/bez-sieci/…`: die Powtórki, die dieses Gerät für die Zeit
 * ohne Netz hält (`offline.ts`), und ein Lauf daraus. Dieselbe Ansicht an drei Stellen:
 *
 * <code>
 *   in der Fassung ohne Netz (`shell/AloneShell.tsx`)   niemand angemeldet — erst ANMELDEN OHNE NETZ (`core/away.ts`)
 *   in der Nauka, Schlüsselbund offen                    der Schlüssel der Abschriften aus dem PasswordKey dieses Tabs
 *   in der Nauka, Schlüsselbund zu                       ohne Netz die Anmeldung auf dem Gerät, mit Netz das Passwort
 * </code>
 *
 * <b>Wer lernt</b>: mit offenem Bund die Person des Kontos (ihr Fortschritt aus dem Dienst, wenn er erreichbar ist);
 * sonst die Person aus der Abschrift — versiegelt wird mit ihrem öffentlichen Schlüssel, die Antworten warten in der
 * Ablage. Was ohne Netz beantwortet wird, kommt auch in die Abschrift, damit die nächste Runde damit rechnet.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { awayAccounts, awayKeyOf, awayNow, endAway, onAway, signInAway, type AwayAccount } from '../core/away';
import { fromBase64Url } from '../core/crypto';
import { idbKeys } from '../core/idb';
import type { Me } from '../core/me';
import { plural } from '../core/plural';
import { WorkspaceError, type Who } from '../core/session';
import { viewPath } from '../routes';
import { Unlock } from '../shell/Unlock';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PasswordInput } from '../ui/PasswordInput';
import { holderOfMe } from './holders';
import { Learner, targetOf } from './learn';
import { holderOfCopy, keepAnswers, offlineList, offlineSource, openOffline, type CopyKey, type OfflineRevision } from './offline';
import { RevisionRun } from './RevisionRun';
import './cogita.css';

const HOME = viewPath('learn', 'bez-sieci');

/** Womit sich die Abschriften öffnen — `undefined`: wird nachgesehen, `null`: erst anmelden. */
function useCopyKey(who: Who | null, again: number): CopyKey | null | undefined {
  const [found, setFound] = useState<CopyKey | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => onAway(() => setTick((n) => n + 1)), []);
  const accountId = who?.accountId ?? null;
  useEffect(() => {
    let alive = true;
    void (async () => {
      const away = awayNow();
      if (who === null) {
        if (alive) setFound(away === null ? null : { accountId: away.accountId, key: away.key });
        return;
      }
      const key = await awayKeyOf(who);
      if (alive) setFound(key === null ? null : { accountId: who.accountId, key });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, tick, again]);
  return found;
}

export function AwayLearn({ who, me, trail }: { who: Who | null; me: Me | null; trail: readonly string[] }) {
  const [again, setAgain] = useState(0);
  const by = useCopyKey(who, again);
  if (by === undefined) return <Loading label="Otwieranie…" />;
  if (by === null) return <AwayLogin who={who} onUnlocked={() => setAgain((n) => n + 1)} />;
  const chosen = trail[0];
  if (chosen !== undefined) return <AwayRun key={chosen} by={by} me={me} chosen={chosen} />;
  return <AwayCopies by={by} who={who} />;
}

/**
 * ANMELDEN OHNE NETZ — das Passwort prüft das Gerät (`core/away.ts`). Angemeldet, aber mit zugem Bund und ohne
 * bereitgelegtes Konto: das gewohnte Öffnen der Schlüssel (braucht den Dienst).
 */
function AwayLogin({ who, onUnlocked }: { who: Who | null; onUnlocked: () => void }) {
  const [accounts, setAccounts] = useState<readonly AwayAccount[] | null>(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void awayAccounts().then((found) => {
      if (!alive) return;
      const mine = who === null ? found : found.filter((a) => a.accountId === who.accountId);
      setAccounts(mine);
      if (mine.length === 1) setLoginId(mine[0].loginId);
    });
    return () => { alive = false; };
  }, [who]);

  if (accounts === null) return <Loading label="Sprawdzanie urządzenia…" />;

  if (accounts.length === 0) {
    if (who !== null) {
      return (
        <div className="cg wk-narrow">
          <Unlock who={who} why="Powtórki bez internetu są zapieczętowane Twoim kluczem." onDone={onUnlocked} />
        </div>
      );
    }
    return (
      <section className="wk-box wk-narrow" aria-labelledby="away-none">
        <div className="wk-box-head"><h2 className="wk-box-title" id="away-none">Nauka bez internetu</h2></div>
        <p className="wk-box-empty">
          Na tym urządzeniu nie ma nic do nauki bez internetu. Przygotowuje się to z siecią: zaloguj się, wybierz
          „Klucz zachowany na tym urządzeniu” (Konto → Bezpieczeństwo i klucze) i przejdź raz powtórkę, którą autor
          oznaczył „Trzymaj na urządzeniach bez internetu”. Potem zalogujesz się tutaj bez sieci.
        </p>
      </section>
    );
  }

  const go = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await signInAway(loginId, password);
      setPassword('');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zalogować bez internetu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-signin" onSubmit={(e) => { e.preventDefault(); if (!busy && password !== '') void go(); }} noValidate>
      <h1 className="wk-h1">Zaloguj się bez internetu</h1>
      <p className="wk-lede">
        Hasło sprawdza to urządzenie — bez usługi. Gdy wróci sieć, zalogujemy Cię tym samym kluczem, bez pytania o hasło.
      </p>
      {accounts.length > 1 ? (
        <label className="wk-field">
          <span>Konto</span>
          <select value={loginId} onChange={(e) => setLoginId(e.target.value)}>
            <option value="">— wybierz —</option>
            {accounts.map((a) => <option key={a.accountId} value={a.loginId}>{a.loginId}</option>)}
          </select>
        </label>
      ) : (
        <label className="wk-field">
          <span>Nazwa konta</span>
          <input value={loginId} autoComplete="username" readOnly={accounts.length === 1} onChange={(e) => setLoginId(e.target.value)} />
        </label>
      )}
      <label className="wk-field">
        <span>Hasło</span>
        <PasswordInput value={password} autoComplete="current-password" onChange={setPassword} />
      </label>
      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || password === '' || loginId === ''}>
          {busy ? 'Liczenie klucza…' : 'Zaloguj bez internetu'}
        </button>
      </div>
    </form>
  );
}

interface CopyRow {
  readonly libraryId: string;
  readonly revisionId: string;
  readonly savedAt: number;
  readonly copy: OfflineRevision | null;
}

/** Was das Gerät für dieses Konto hält — geöffnet, mit Namen; und was noch auf das Netz wartet. */
function AwayCopies({ by, who }: { by: CopyKey; who: Who | null }) {
  const [rows, setRows] = useState<readonly CopyRow[] | null>(null);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const list = await offlineList(by.accountId);
      const opened = await Promise.all(list.map(async (r) => ({ ...r, copy: await openOffline(by, r.libraryId, r.revisionId) })));
      if (!alive) return;
      setRows(opened);
      const roles = new Set(opened.flatMap((r) => (r.copy?.holder == null ? [] : [r.copy.holder.roleId])));
      let n = 0;
      for (const roleId of roles) n += (await idbKeys('outbox', `r:${roleId}:`)).length;
      if (alive) setWaiting(n);
    })();
    return () => { alive = false; };
  }, [by]);
  const away = awayNow();
  return (
    <div className="cg cg-overview wk-narrow">
      {who === null && away !== null && (
        <p className="wk-note">
          Zalogowano bez internetu: <strong>{away.loginId}</strong>.{' '}
          <button type="button" className="wk-link-btn" onClick={endAway}>Wyloguj</button>
        </p>
      )}
      <section className="wk-box" aria-labelledby="away-copies">
        <div className="wk-box-head"><h2 className="wk-box-title" id="away-copies">Na tym urządzeniu bez internetu</h2></div>
        {rows === null ? <div className="wk-box-body"><Loading /></div>
          : rows.length === 0 ? (
            <p className="wk-box-empty">
              Nic. Autor może oznaczyć powtórkę „Trzymaj na urządzeniach bez internetu” — wtedy po pierwszym przejściu
              z siecią zostanie tutaj (tylko gdy klucz jest zachowany na tym urządzeniu).
            </p>
          )
          : rows.map((r) => (
            <a key={`${r.libraryId}:${r.revisionId}`} className="wk-line" href={viewPath('learn', 'bez-sieci', `${r.libraryId}:${r.revisionId}`)}>
              <span className="wk-line-ic"><Icon name="cap" /></span>
              <span className="wk-line-text">
                <span className="wk-line-title">{r.copy?.name ?? 'Powtórka (nie otwiera się)'}</span>
                <span className="wk-line-sub">
                  {r.copy === null ? '' : `${r.copy.cards.length} ${plural(r.copy.cards.length, 'karta', 'karty', 'kart')} · `}
                  zapisana {new Date(r.savedAt).toLocaleDateString('pl-PL')}
                </span>
              </span>
              <span className="wk-line-end"><Icon name="next" /></span>
            </a>
          ))}
      </section>
      {waiting > 0 && (
        <p className="wk-note" role="status">
          {waiting} {plural(waiting, 'paczka odpowiedzi czeka', 'paczki odpowiedzi czekają', 'paczek odpowiedzi czeka')} na internet — wyślą się same, gdy wróci sieć i będziesz zalogowany.
        </p>
      )}
    </div>
  );
}

/** Ein Lauf aus einer Abschrift — die Antworten in die Ablage und in die Abschrift. */
function AwayRun({ by, me, chosen }: { by: CopyKey; me: Me | null; chosen: string }) {
  /* Abschrift UND Lernender zusammen: begänne der Lauf vor dem Lernenden, rechnete er ohne die Geschichte (die Sperre hielte alles zurück). */
  const [ready, setReady] = useState<{ copy: OfflineRevision | null; learner: Learner | null } | undefined>(undefined);
  /*
   * Der Lauf hängt am Konto, an der Person und an der Abschrift — nicht an den Objekten: kommt das Netz zurück, prüft
   * die App die Sitzung neu, und `me`/`by` sind neue Objekte derselben Sache. Mitten im Lauf finge er sonst neu an.
   */
  const byNow = useRef(by);
  byNow.current = by;
  const meNow = useRef(me);
  meNow.current = me;
  const person = me?.person.id ?? '';
  useEffect(() => {
    const by = byNow.current;
    const me = meNow.current;
    let alive = true;
    let made: Learner | null = null;
    let off = () => undefined as void;
    let timer = 0;
    const [libraryId, revisionId] = chosen.split(':');
    void (async () => {
      const copy = libraryId === undefined || revisionId === undefined ? null : await openOffline(by, libraryId, revisionId);
      if (!alive) return;
      if (copy === null) { setReady({ copy: null, learner: null }); return; }
      const holder = me !== null ? holderOfMe(me, copy.holder?.roleId) : holderOfCopy(copy);
      if (holder === null) { setReady({ copy, learner: null }); return; }
      /*
       * 2026-10-27/28 — der Schlüssel der Annahme: der jetzige, wenn der Dienst antwortet, sonst der aus der Abschrift.
       * Ohne ihn läse der Kurs diese Antworten nie (vorher blieb er ohne Netz leer).
       */
      const kept = copy.target?.intake ?? null;
      const fresh = copy.target === null ? null : await targetOf(copy.target.areaId).catch(() => null);
      const target = copy.target === null ? null : { areaId: copy.target.areaId, intake: fresh?.intake ?? (kept === null ? null : fromBase64Url(kept)) };
      made = new Learner(copy.libraryId, holder, target);
      await made.load().catch(() => undefined);
      /* Was schon beantwortet war — der Dienst ist ohne Netz nicht zu erreichen. */
      made.remember(copy.answers ?? []);
      if (!alive) return;
      const learning = made;
      let known = learning.progress.answers.size;
      /* Was ohne Netz dazukommt, auch in die Abschrift — gebündelt, nicht bei jedem Tippen. */
      off = learning.subscribe(() => {
        if (learning.progress.answers.size === known) return;
        known = learning.progress.answers.size;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { void keepAnswers(by, copy, [...learning.progress.answers.values()]).catch(() => undefined); }, 800);
      });
      setReady({ copy, learner: learning });
    })();
    const leave = () => { void made?.flush().catch(() => undefined); };
    window.addEventListener('pagehide', leave);
    return () => {
      alive = false;
      off();
      window.removeEventListener('pagehide', leave);
      window.clearTimeout(timer);
      /* Beim Verlassen: was noch nicht versiegelt ist, in die Ablage — und in die Abschrift. */
      const was = made;
      if (was !== null) {
        void was.flush().catch(() => undefined);
        void openOffline(by, libraryId ?? '', revisionId ?? '').then((copy) => (copy === null ? false : keepAnswers(by, copy, [...was.progress.answers.values()]))).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- das Konto, die Person, die Abschrift (oben)
  }, [by.accountId, person, chosen]);
  /* Mit der Sperre „Najpierw podstawy" der Abschrift (vorher fiel sie ohne Netz weg). */
  const copy = ready?.copy ?? null;
  const source = useMemo(() => (copy === null ? null : offlineSource(copy)), [copy]);
  if (ready === undefined) return <Loading label="Otwieranie powtórki…" />;
  if (source === null) {
    return <p className="wk-error">Tej powtórki nie ma na tym urządzeniu. <a className="wk-link" href={HOME}>Wszystkie powtórki bez internetu</a></p>;
  }
  return <RevisionRun lib={null} learner={ready.learner} source={source} onClose={() => { window.location.hash = HOME.slice(1); }} />;
}

export default AwayLearn;
