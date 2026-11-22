/**
 * 2026-10-27 — WER AUF EINER SEITE LERNT (Powtórka, Przebieg, Mapa auf einer Seite).
 *
 * Kein eigener Weg: dieselbe Wahl wie für alles auf der Seite (`usePerson`, `pages/pagePerson.tsx`):
 * <code>
 *   eine eigene Person      angemeldet — die oben gewählte, sonst die erste: lernt als sie selbst
 *   ein Platz aus einem Link aus einem Formular oder vorgestellt: lernt als dieser Mensch
 *   nur ein Link            „Przedstaw się" — eine Person des Links (`createLinkPerson`, wie in der
 *                           Rozmowa), danach lernt man als sie
 *   niemand                 im Browser [L6], nach der Anmeldung mitzunehmen
 * </code>
 * Eine Person und ein Platz senden ihre Antworten versiegelt in den Bereich des Kurses (`targetFor`):
 * wer seine Przyjęcia liest, sieht ihre Postępy (Nauka → Postępy) — mit dem Namen, unter dem sie sich
 * vorgestellt haben. So gibt man jemandem einen Link zu einer Seite mit einer Powtórka und sieht, wie er lernt.
 *
 * 2026-11-01 — DER BEREICH DES ORTES: welcher das ist, sagt der Baustein („Odpowiedzi uczących się do",
 * `answersTo.ts`), sonst die Powtórka, sonst die Baza. Eine Baza kann so in vielen Kursen stehen — jeder bekommt
 * die Antworten seiner Uczący się. Vorgestellt wird man in DIESEM Bereich (dort sieht die Lehrerin den Namen, und
 * dorthin darf der Platz schicken); der Link muss ihn öffnen.
 */

import { useEffect, useState } from 'react';
import { useT } from '../core/i18n';

import { useMe, useWho } from '../core/me';
import { WorkspaceError } from '../core/session';
import { heldLinkKeys } from '../links/linkAccess';
import { heldLinks } from '../links/linkKeep';
import { createLinkPerson, portalOf } from '../links/linkPerson';
import { usePerson } from '../pages/pagePerson';
import { parsePath } from '../routes';
import { answersArea } from './answersTo';
import { holderOfMe, holderOfSeat, localHolder, useLearner } from './holders';
import type { Holder, Learner } from './learn';
import type { CogitaLibrary } from './store';
import './lesson/lesson.css';

/** Ein Link dieses Browsers, der den Bereich der Baza öffnet — mit ihm stellt man sich vor. */
export interface LearnLink {
  readonly areaId: string;
  readonly invitationId: string;
  readonly linkRoleId: string;
  readonly label: string;
}

export interface PageLearner {
  /** `null`: wird noch bestimmt. */
  readonly learner: Learner | null;
  /** Als wer gelernt wird. */
  readonly as: 'person' | 'seat' | 'local' | null;
  /** Der Lernende ist geladen (oder lässt sich nicht laden — dann lernt man ohne Aufzeichnung): man kann beginnen. */
  readonly ready: boolean;
  readonly name: string | null;
  /** Lernt man im Browser und öffnet ein Link dieses Browsers die Baza: sich vorstellen. */
  readonly link: LearnLink | null;
  /** Nach dem Vorstellen: den neuen Platz wählen, sobald die Seite ihn kennt. */
  readonly introduced: (token: string) => void;
}

export function usePageLearner(lib: CogitaLibrary | null | undefined, answers: string | null = null): PageLearner {
  const person = usePerson();
  const me = useMe(useWho());
  const chosen = person?.chosen ?? null;
  /* Ohne Wahl oben: die erste eigene Person — angemeldet lernt man als man selbst. */
  const role = chosen?.kind === 'role' ? chosen : chosen === null ? person?.options.find((o) => o.kind === 'role') ?? null : null;
  const seat = chosen?.kind === 'seat' ? chosen.seat : null;
  const [holder, setHolder] = useState<{ holder: Holder; as: PageLearner['as']; name: string | null } | null>(null);
  const [link, setLink] = useState<LearnLink | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);
  const roleId = role?.id ?? null;
  const loading = person?.loading === true || me === undefined;

  useEffect(() => {
    let alive = true;
    if (loading) { setHolder(null); return undefined; }
    if (seat !== null) {
      void holderOfSeat(seat).then(
        (h) => { if (alive) setHolder(h === null ? { holder: localHolder(), as: 'local', name: null } : { holder: h, as: 'seat', name: seat.recipientName }); },
        () => { if (alive) setHolder({ holder: localHolder(), as: 'local', name: null }); }
      );
    } else if (me != null && (roleId === null || me.roles.some((r) => r.id === roleId))) {
      const id = roleId ?? me.person.id;
      setHolder({ holder: holderOfMe(me, id), as: 'person', name: role?.name ?? me.names.get(id) ?? null });
    } else {
      setHolder({ holder: localHolder(), as: 'local', name: null });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, seat?.token, seat?.seatKey === null, roleId, me]);

  /*
   * Lernt man im Browser: öffnet ein Link dieses Browsers den Bereich, in den die Antworten gehen (der Ort, sonst die
   * Baza)? Dann kann man sich vorstellen — als Mensch dieses Bereichs. Öffnet er ihn nicht (die Antworten gehen in den
   * Bereich der Prowadzący IM Kurs, der Link öffnet den Kurs), dann im Bereich der Baza — der Dienst nimmt die Antworten
   * auch in einen Bereich darin, wenn er Przyjęcia hat.
   */
  const said = lib == null ? null : answersArea(answers, lib.settings().storageAreaId);
  const baseArea = lib?.areaId ?? null;
  useEffect(() => {
    let alive = true;
    const wanted = [said, baseArea].filter((x): x is string => x !== null);
    if (wanted.length === 0 || holder?.as !== 'local' || heldLinks().length === 0) { setLink(null); return undefined; }
    void heldLinkKeys().then((keys) => {
      for (const areaId of wanted) {
        const opens = keys.roles.find((r) => r.areas.some((a) => a.areaId.toLowerCase() === areaId.toLowerCase())) ?? null;
        const info = opens === null ? null : keys.links.find((l) => l.token === opens.token)?.info ?? null;
        if (info !== null && keys.areaKeys.has(areaId)) {
          if (alive) setLink({ areaId, invitationId: info.invitationId, linkRoleId: info.roleId, label: info.label ?? 'link' });
          return;
        }
      }
      if (alive) setLink(null);
    }, () => { if (alive) setLink(null); });
    return () => { alive = false; };
  }, [said, baseArea, holder?.as]);

  /* Der eben vorgestellte Platz: gewählt, sobald die Seite ihn unter ihren Personen hat. */
  useEffect(() => {
    if (waiting === null || person === null) return;
    if (person.options.some((o) => o.kind === 'seat' && o.id === waiting)) { person.choose(waiting); setWaiting(null); }
  }, [waiting, person]);

  const { learner, failed } = useLearner(lib ?? null, holder?.holder ?? null, answers);
  return {
    learner: holder === null ? null : learner, as: holder?.as ?? null, name: holder?.name ?? null, link, introduced: setWaiting,
    ready: holder !== null && (learner !== null || failed !== null)
  };
}

/**
 * SICH VORSTELLEN, UM ZU LERNEN — Imię, Nazwisko: eine Person des Links (wie in der Rozmowa). Danach
 * gehen die Antworten an den Kurs, und wer ihn prowadzi, sieht, wie man lernt.
 *
 * 2026-11-22 (Part B, B3) — EIN SCHÜLER OHNE KONTO: dazu Klasse und Schule (sie stehen mit dem Namen — die Lehrerin sieht
 * sie überall, wo sie den Namen sieht) und die Zustimmung zur Teilnahme (ohne sie wird niemand angelegt). Angelegt wird ein
 * leichter Zugang ohne Passwort: der persönliche Link IST der Zugang — er steht danach zum Behalten da (wer ihn hat, lernt
 * als diese Person; dafür ist er da, nicht für Noten).
 */
export function IntroduceToLearn({ link, onDone }: { link: LearnLink; onDone: (token: string) => void }) {
  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');
  const [group, setGroup] = useState('');
  const [school, setSchool] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const t = useT();
  const join = async () => {
    if (!consent) return;
    setBusy(true);
    setFailed(null);
    try {
      const person = await createLinkPerson(link, given, surname, parsePath(window.location.hash).page ?? null, { group, school });
      const base = typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;
      keepOwnLink(`${base}${portalOf(person)}`);
      onDone(person.token);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('cogitaLearnRun.intro.failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="wk-form cg-learn-intro" data-learn-introduce="" onSubmit={(e) => { e.preventDefault(); void join(); }}>
      <p className="wk-card-muted">{t('cogitaLearnRun.intro.text', { course: link.label })}</p>
      <div className="cg-row">
        <label className="wk-field"><span>{t('cogitaLearnRun.intro.given')}</span><input value={given} maxLength={80} autoComplete="given-name" data-learn-given="" onChange={(e) => setGiven(e.target.value)} /></label>
        <label className="wk-field"><span>{t('cogitaLearnRun.intro.surname')}</span><input value={surname} maxLength={100} autoComplete="family-name" data-learn-surname="" onChange={(e) => setSurname(e.target.value)} /></label>
      </div>
      <div className="cg-row">
        <label className="wk-field"><span>{t('cogitaLearnRun.intro.group')}</span><input value={group} maxLength={40} data-learn-group="" onChange={(e) => setGroup(e.target.value)} /></label>
        <label className="wk-field"><span>{t('cogitaLearnRun.intro.school')}</span><input value={school} maxLength={60} autoComplete="organization" data-learn-school="" onChange={(e) => setSchool(e.target.value)} /></label>
      </div>
      <label className="wk-check" data-learn-consent="">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{t('cogitaLearnRun.intro.consent')}</span>
      </label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" data-learn-go="" disabled={busy || !consent || given.trim() === '' || surname.trim() === ''}>{busy ? t('cogitaLearnRun.intro.busy') : t('cogitaLearnRun.intro.go')}</button>
      </div>
    </form>
  );
}

/*
  2026-11-22 (Part B, B3) — DER PERSÖNLICHE LINK ZUM BEHALTEN. Gleich nach dem Vorstellen wählt die Seite den neuen Platz (das Feld
  „Przedstaw się" verschwindet) — darum steht der Link in diesem Tab (sessionStorage), bis man ihn wegklickt, und jeder Lernbaustein
  zeigt ihn (`OwnLinkNote`).
*/
const OWN_LINK = 'recreatio:cogita:own-link';
const keepOwnLink = (url: string) => { try { sessionStorage.setItem(OWN_LINK, url); } catch { /* nur jetzt nicht */ } };

export function OwnLinkNote() {
  const t = useT();
  const [url, setUrl] = useState<string | null>(() => { try { return sessionStorage.getItem(OWN_LINK); } catch { return null; } });
  if (url === null) return null;
  return (
    <div className="wk-form cg-learn-intro" data-learn-introduced="">
      <p><strong>{t('cogitaLearnRun.intro.madeTitle')}</strong></p>
      <p className="wk-card-muted">{t('cogitaLearnRun.intro.madeText')}</p>
      <p className="cg-learn-link" data-learn-own-link={url}><a href={url}>{url}</a></p>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-line" onClick={() => void navigator.clipboard?.writeText(url)}>{t('cogitaLearnRun.intro.copy')}</button>
        <button type="button" className="wk-btn" data-learn-continue="" onClick={() => { try { sessionStorage.removeItem(OWN_LINK); } catch { /* */ } setUrl(null); }}>{t('cogitaLearnRun.intro.continue')}</button>
      </div>
    </div>
  );
}

/**
 * Ein Satz unter der Powtórka: als wer man lernt, und wer es sieht — wohin die Antworten wirklich gehen (`targetFor`):
 * in einen Bereich mit Przyjęcia, dann sieht es, wer ihn prowadzi; sonst bleiben sie beim Konto.
 */
export function LearnerLine({ learner, lib }: { learner: PageLearner; lib: CogitaLibrary }) {
  const t = useT();
  if (learner.as === null) return null;
  const who = learner.name ?? (learner.as === 'seat' ? t('cogitaLearnRun.intro.linkPerson') : t('cogitaLearnRun.intro.you'));
  const target = learner.learner?.target ?? null;
  const office = target !== null ? target.own !== true && (target.intake !== null || target.areaKey !== undefined) : learner.as === 'seat' || lib.settings().storageAreaId !== undefined;
  return (
    <p className="wk-card-muted" data-learner-as={learner.as} data-learner-office={office ? '' : undefined}>
      {learner.as === 'local' ? t('cogitaLearnRun.run.noAccount')
        : office ? t('cogitaLearnRun.intro.asOffice', { who }) : t('cogitaLearnRun.intro.asOwn', { who })}
    </p>
  );
}
