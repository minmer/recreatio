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
 */

import { useEffect, useState } from 'react';

import { useMe, useWho } from '../core/me';
import { WorkspaceError } from '../core/session';
import { heldLinkKeys } from '../links/linkAccess';
import { heldLinks } from '../links/linkKeep';
import { createLinkPerson } from '../links/linkPerson';
import { usePerson } from '../pages/pagePerson';
import { parsePath } from '../routes';
import { holderOfMe, holderOfSeat, localHolder, useLearner } from './holders';
import type { Holder, Learner } from './learn';
import type { CogitaLibrary } from './store';

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

export function usePageLearner(lib: CogitaLibrary | null | undefined): PageLearner {
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

  /* Lernt man im Browser: öffnet ein Link dieses Browsers den Bereich der Baza? Dann kann man sich vorstellen. */
  const areaId = lib?.areaId ?? null;
  useEffect(() => {
    let alive = true;
    if (areaId === null || holder?.as !== 'local' || heldLinks().length === 0) { setLink(null); return undefined; }
    void heldLinkKeys().then((keys) => {
      const opens = keys.roles.find((r) => r.areas.some((a) => a.areaId === areaId)) ?? null;
      const info = opens === null ? null : keys.links.find((l) => l.token === opens.token)?.info ?? null;
      if (alive) setLink(info === null || !keys.areaKeys.has(areaId) ? null : { areaId, invitationId: info.invitationId, linkRoleId: info.roleId, label: info.label ?? 'link' });
    }, () => { if (alive) setLink(null); });
    return () => { alive = false; };
  }, [areaId, holder?.as]);

  /* Der eben vorgestellte Platz: gewählt, sobald die Seite ihn unter ihren Personen hat. */
  useEffect(() => {
    if (waiting === null || person === null) return;
    if (person.options.some((o) => o.kind === 'seat' && o.id === waiting)) { person.choose(waiting); setWaiting(null); }
  }, [waiting, person]);

  const { learner, failed } = useLearner(lib ?? null, holder?.holder ?? null);
  return {
    learner: holder === null ? null : learner, as: holder?.as ?? null, name: holder?.name ?? null, link, introduced: setWaiting,
    ready: holder !== null && (learner !== null || failed !== null)
  };
}

/**
 * SICH VORSTELLEN, UM ZU LERNEN — Imię, Nazwisko: eine Person des Links (wie in der Rozmowa). Danach
 * gehen die Antworten an den Kurs, und wer ihn prowadzi, sieht, wie man lernt.
 */
export function IntroduceToLearn({ link, onDone }: { link: LearnLink; onDone: (token: string) => void }) {
  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const join = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const made = await createLinkPerson(link, given, surname, parsePath(window.location.hash).page ?? null);
      onDone(made.token);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się — spróbuj jeszcze raz.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="wk-form cg-learn-intro" data-learn-introduce="" onSubmit={(e) => { e.preventDefault(); void join(); }}>
      <p className="wk-card-muted">Przedstaw się, a Twoje postępy zobaczy prowadzący kurs („{link.label}”) — i będą na Ciebie czekać także na innym urządzeniu z tym linkiem.</p>
      <div className="cg-row">
        <label className="wk-field"><span>Imię</span><input value={given} maxLength={80} autoComplete="given-name" data-learn-given="" onChange={(e) => setGiven(e.target.value)} /></label>
        <label className="wk-field"><span>Nazwisko</span><input value={surname} maxLength={100} autoComplete="family-name" data-learn-surname="" onChange={(e) => setSurname(e.target.value)} /></label>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" data-learn-go="" disabled={busy || given.trim() === '' || surname.trim() === ''}>{busy ? 'Chwila…' : 'Przedstaw się i ucz się'}</button>
      </div>
    </form>
  );
}

/**
 * Ein Satz unter der Powtórka: als wer man lernt, und wer es sieht — ein Platz und eine Person, wenn der Kurs
 * seinen Bereich für Antworten nennt, schicken sie dorthin (`targetFor`); sonst bleiben sie beim Konto.
 */
export function LearnerLine({ learner, lib }: { learner: PageLearner; lib: CogitaLibrary }) {
  if (learner.as === null) return null;
  const who = learner.name ?? (learner.as === 'seat' ? 'osoba z linku' : 'Ty');
  const office = learner.as === 'seat' || lib.settings().storageAreaId !== undefined;
  return (
    <p className="wk-card-muted" data-learner-as={learner.as}>
      {learner.as === 'local' ? 'Bez konta postępy zostają w tej przeglądarce.'
        : office ? `Uczysz się jako ${who} — postępy widzi też prowadzący kurs.` : `Uczysz się jako ${who} — postępy zostają na Twoim koncie.`}
    </p>
  );
}
