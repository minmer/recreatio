/**
 * Eine Veranstaltungsseite gruenden — ein Formular, ein Aufruf.
 *
 * <b>Alles entsteht zusammen oder gar nichts.</b> Bereich (Schluessel, Epochen,
 * Kette), Verwaltungsrolle und der Eintrag selbst gehen in EINER
 * serialisierbaren Transaktion durch den Server. Der Browser hat das bei den
 * Pfarreien einmal in drei Schritten getan, und zwischen zwei Anfragen gibt es
 * kein Zurueck: brach die zweite ab, blieb die erste stehen. Sichtbar wurde das
 * als Liste gleichnamiger Bereiche, die zu nichts gehoerten.
 *
 * <b>Die Anschrift des Verantwortlichen ist Pflicht, nicht Zierde.</b> Eine
 * Veranstaltung nimmt Anmeldungen entgegen; ein Formular, das personenbezogene
 * Daten aufnimmt, muss sagen, WER sie verarbeitet und unter welcher Anschrift.
 * Das nachzureichen hiesse: ein Formular, das schon annimmt, bevor jemand sagen
 * kann, wer einsteht.
 *
 * <b>Ein eigener Bereich, auch wenn eine Pfarrei veranstaltet.</b> Sonst bekaeme,
 * wer beim Pfarrfest die Anmeldungen fuehrt, den Epochenschluessel der Pfarrei —
 * und mit ihm die Firmkandidaten und die Krankenliste.
 *
 * <b>Was hier entsteht, ist die SEITE, nicht ein Fest.</b> Sie traegt die
 * Adresse, den Verantwortlichen und das Amt; die einzelnen Veranstaltungen
 * kommen danach hinein und bekommen dort je einen eigenen Bereich. Vorher war
 * das eine Ebene: wer „recreatio" anlegte, bekam eine Veranstaltung dieses
 * Namens — und beim naechsten Fest denselben Vorgang noch einmal, mitsamt
 * zweiter Klausel.
 *
 * <b>Die Rollen kommen von oben.</b> Der Werkstattrahmen hat sie schon geladen;
 * sie hier ein zweites Mal zu holen hiesse, denselben Aufruf zweimal zu stellen
 * und danach zwei Wahrheiten zu haben, sobald eine davon aelter ist.
 */

import { useMemo, useState } from 'react';

import { rcCopy, type RcLang } from '../i18n';
import type { RcRole } from '../lib/rcChat';
import { rcFoundEventCollection } from '../lib/rcEvents';
import { rcFoundReady, rcSlugComplaint } from './rcFound';
import { rcPath } from '../lib/rcRoute';
import { RcRequestError } from '../lib/rcApi';
import { useRcError } from '../RcThreads';

export function RcFoundEvent({
  lang, roles, onFounded
}: {
  lang: RcLang;
  roles: readonly RcRole[];
  onFounded: (slug: string) => void;
}) {
  const t = rcCopy[lang].events;
  const f = t.found;
  const describe = useRcError(lang);

  /*
   * Nur Rollen mit Schluessel. Eine Rolle, die man im Graphen sieht, aber nicht
   * aufschliessen kann, taugt nicht als gruendende: der Server braucht ihren
   * Schluessel, um den Bereichsschluessel darunter zu verschliessen — und
   * abgelehnt wuerde erst nach dem Absenden.
   */
  const mine = useMemo(
    () => roles.filter((r) => r.hasKey).map((r) => ({
      roleId: r.roleId,
      kind: r.kind,
      name: (r.displayName ?? '').trim() === '' ? r.roleId.slice(0, 8) : (r.displayName ?? '')
    })),
    [roles]
  );

  /*
   * Die persoenliche Rolle gruendet ueblicherweise: sie darf es meistens, und
   * sie bleibt beim Konto, wenn ein Amt an jemand anderen uebergeht.
   */
  const preferred = useMemo(
    () => mine.find((r) => r.kind === 'person')?.roleId ?? mine[0]?.roleId ?? '',
    [mine]
  );

  const [founderRaw, setFounder] = useState('');
  const [organizerRaw, setOrganizer] = useState('');
  const founder = founderRaw === '' ? preferred : founderRaw;
  const organizer = organizerRaw === '' ? founder : organizerRaw;

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);

  const draft = {
    founderRoleId: founder, slug, title,
    organizerName: name, organizerAddress: address
  };

  const ready = rcFoundReady(draft) && !busy;

  const send = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const done = await rcFoundEventCollection({
        founderRoleId: founder,
        organizerRoleId: organizer === '' ? null : organizer,
        slug,
        title: title.trim(),
        organizerName: name.trim(),
        organizerAddress: address.trim(),
        organizerEmail: email.trim()
      });

      setMade(done.slug);
      onFounded(done.slug);
    } catch (e) {
      /*
       * Die vergebene Adresse kommt als `permission_denied` mit 409 zurueck.
       * Den allgemeinen Satz dazu zu zeigen hiesse „du darfst nicht" — und das
       * ist falsch: man darf, die Adresse ist nur schon weg.
       */
      setError(e instanceof RcRequestError && e.status === 409 ? f.taken : describe(e));
    } finally { setBusy(false); }
  };

  if (made !== null) {
    return (
      <div className="fe-done">
        <p className="rc-note">{f.done}</p>
        <a className="rc-btn" href={rcPath('event', made)}>{f.open}</a>
      </div>
    );
  }

  return (
    <div className="fe">
      <h5 className="rc-chat-h">{t.create}</h5>
      <p className="rc-note">{f.lead}</p>

      <div className="fe-form">
        <label className="mo-field">
          <span>{f.as}</span>
          <select value={founder} disabled={busy} onChange={(e) => setFounder(e.target.value)}>
            {mine.map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.name} ({f.kinds[r.kind] ?? r.kind})
              </option>
            ))}
          </select>
        </label>

        {/*
          Der Veranstalter ist oft jemand anderes als der Gruendende: die
          Sekretaerin legt die Veranstaltung der Pfarrei an. Was fuer eine Art
          Veranstalter das ist — Person, Amt, Gemeinschaft — traegt die Rolle
          selbst; danach wird also nicht ein zweites Mal gefragt.
        */}
        <label className="mo-field">
          <span>{f.by}</span>
          <select value={organizer} disabled={busy} onChange={(e) => setOrganizer(e.target.value)}>
            {mine.map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.name} ({f.kinds[r.kind] ?? r.kind})
              </option>
            ))}
          </select>
        </label>

        <label className="mo-field fe-wide">
          <span>{t.eventTitle}</span>
          <input
            type="text"
            value={title}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="mo-field fe-wide">
          <span>{t.address}</span>
          <input
            type="text"
            value={slug}
            maxLength={48}
            disabled={busy}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </label>

        {rcSlugComplaint(slug) && <p className="ap-error fe-wide">{f.slugBad}</p>}

        <p className="ps-muted fe-wide">{t.addressHint} {f.stays}</p>
      </div>

      <fieldset className="fe-rodo">
        <legend>{f.rodo}</legend>

        <p className="ps-muted">{f.rodoWhy}</p>

        <label className="mo-field fe-wide">
          <span>{f.rodoName}</span>
          <input
            type="text"
            value={name}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="mo-field fe-wide">
          <span>{f.rodoAddress}</span>
          <input
            type="text"
            value={address}
            maxLength={400}
            disabled={busy}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>

        <label className="mo-field fe-wide">
          <span>{f.rodoEmail}</span>
          <input
            type="email"
            value={email}
            maxLength={200}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </fieldset>

      {error !== null && <p className="ap-error">{error}</p>}

      <button type="button" className="rc-btn" disabled={!ready} onClick={() => void send()}>
        {busy ? f.going : f.go}
      </button>
    </div>
  );
}

export default RcFoundEvent;
