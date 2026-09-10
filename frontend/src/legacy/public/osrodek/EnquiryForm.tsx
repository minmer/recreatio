/**
 * Das Anfrageformular (Abschnitt 4.2).
 *
 * <b>Vermittelt, nicht abgeschlossen.</b> Keine Zahlung, keine Anzahlung, keine
 * Stornobedingung — und deshalb auch keine Pflichten aus einem Reisevertrag.
 * Der Satz dazu steht ÜBER dem Formular und nicht im Kleingedruckten: wer ein
 * Formular mit Datum und Personenzahl ausfüllt, glaubt zu buchen, solange ihm
 * niemand sagt, dass er fragt.
 *
 * <b>Offen eingesandt, versiegelt abgelegt.</b> Der Server nimmt Klartext
 * entgegen — die Gruppe hat keinen Schlüssel — und versiegelt gegen den
 * öffentlichen Annahmeschlüssel des Hauses. Lesen kann es nur, wer den privaten
 * Teil hält. Das ist der Weg der Anmeldung von aussen (`RcRegistrations`),
 * nicht der des Kandidatenformulars: dort füllt ein angemeldetes Mitglied mit
 * eigenem Epochenschlüssel aus.
 *
 * Der Unterschied wird auf der Seite auch gesagt (`sealedNote`) — die Angaben
 * liegen versiegelt, aber sie sind einmal durch den Dienst gegangen, und das
 * ist ein anderer Schutz als Ende zu Ende.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { rcResourceView, rcSendEnquiry } from '../../rc/lib/rcResource';
import type { PublicCopy } from '../content';

const HOUSE = 'limanowa';

type Phase = 'idle' | 'sending' | 'sent' | 'failed';

export function EnquiryForm({ copy }: { copy: PublicCopy }) {
  const t = copy.osrodek.enquiry;

  const [groupName, setGroupName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contact, setContact] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [people, setPeople] = useState('');
  const [groupKind, setGroupKind] = useState('');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');

  // Der öffentliche Annahmeschlüssel. Ohne ihn kann der Browser nicht
  // versiegeln — und dann wird auch NICHT gesendet.
  const [intakeKey, setIntakeKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    rcResourceView(HOUSE)
      .then((view) => { if (alive) setIntakeKey(view.intakePublicKey); })
      .catch(() => { if (alive) setIntakeKey(null); });
    return () => { alive = false; };
  }, []);

  const filled = groupName.trim() !== '' && contact.trim() !== '' && from !== '' && to !== '';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!filled || phase === 'sending' || !intakeKey) return;

    setPhase('sending');
    try {
      await rcSendEnquiry(HOUSE, intakeKey, {
        groupName: groupName.trim(),
        contactPerson: contactPerson.trim(),
        contact: contact.trim(),
        from,
        to,
        people: people.trim() === '' ? null : Number(people),
        groupKind: groupKind.trim(),
        note: note.trim()
      });
      setPhase('sent');
    } catch {
      setPhase('failed');
    }
  }

  /*
   * Kein Annahmeschlüssel, kein Formular.
   *
   * Die Alternative wäre, dasselbe Formular zu zeigen und den Klartext zum
   * Dienst zu schicken — mit einem Satz darunter, der Verschlüsselung
   * verspricht. Das wäre die eine Zeile, die aus einer ehrlichen Seite eine
   * unehrliche macht. Dann lieber eine Anschrift, die wirklich funktioniert.
   */
  if (intakeKey === null) {
    return (
      <section className="pub-sec pub-enq" aria-labelledby="h-enq">
        <h2 className="pub-h2" id="h-enq">{t.title}</h2>
        <p className="pub-standing">{t.brokeredNotBooked}</p>
        <p className="pub-warn">{t.failed}</p>
      </section>
    );
  }

  if (phase === 'sent') {
    return (
      <section className="pub-sec pub-enq" aria-labelledby="h-enq">
        <h2 className="pub-h2" id="h-enq">{t.title}</h2>
        <p className="pub-done">{t.sent}</p>
        <p className="pub-p">{t.sentBody}</p>
      </section>
    );
  }

  return (
    <section className="pub-sec pub-enq" aria-labelledby="h-enq">
      <h2 className="pub-h2" id="h-enq">{t.title}</h2>
      <p className="pub-p">{t.intro}</p>

      {/* Der Satz, der den Unterschied macht. Über dem Formular. */}
      <p className="pub-standing">{t.brokeredNotBooked}</p>

      <form className="pub-form" onSubmit={submit}>
        <label className="pub-field">
          <span>{t.groupName}</span>
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
        </label>

        <label className="pub-field">
          <span>{t.contactPerson}</span>
          <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
        </label>

        <label className="pub-field">
          <span>{t.contact}</span>
          <input value={contact} onChange={(e) => setContact(e.target.value)} required />
        </label>

        <div className="pub-field-row">
          <label className="pub-field">
            <span>{t.from}</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </label>
          <label className="pub-field">
            <span>{t.to}</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
          </label>
          <label className="pub-field">
            <span>{t.people}</span>
            <input
              type="number"
              min="1"
              value={people}
              onChange={(e) => setPeople(e.target.value)}
            />
          </label>
        </div>

        <label className="pub-field">
          <span>{t.groupKind}</span>
          <input value={groupKind} onChange={(e) => setGroupKind(e.target.value)} />
        </label>

        <label className="pub-field">
          <span>{t.note}</span>
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <button type="submit" className="pub-btn" disabled={!filled || phase === 'sending'}>
          {phase === 'sending' ? t.sending : t.submit}
        </button>

        {phase === 'failed' && <p className="pub-warn">{t.failed}</p>}
        <p className="pub-note">{t.sealedNote}</p>
      </form>
    </section>
  );
}
