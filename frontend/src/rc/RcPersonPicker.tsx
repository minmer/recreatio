/**
 * Als wen die Seite geöffnet ist — und wie man das wechselt.
 *
 * <b>Wann er überhaupt erscheint.</b> Nur bei mehr als einer Person. Ein Konto
 * mit genau einer — der übliche Fall — bekommt keine Wahl vorgesetzt, die keine
 * ist. Eine Schaltfläche mit einem einzigen Eintrag ist kein Angebot, sondern
 * eine Frage, auf die es nur eine Antwort gibt.
 *
 * <b>Warum an zwei Stellen.</b> In der Anmeldeschublade steht, WER man gerade
 * ist — das gehört dorthin, wo auch „Abmelden" steht. Auf der Pfarrseite steht
 * es noch einmal, weil dort die Folge sichtbar wird: welches Kind das Zeugnis
 * bekommt, wessen Anmeldung man sieht. Eine Wahl, deren Wirkung man erst zwei
 * Klicks später bemerkt, wird falsch getroffen.
 *
 * <b>Kein eigener Zustand.</b> Die Wahl liegt in `rcActivePerson` und wird von
 * dort gelesen — auch die aus einem anderen Tab. Zwei Fenster, die verschiedene
 * Personen zeigen, wären schlimmer als gar keine Wahl.
 */

import { useEffect, useState } from 'react';

import { rcRoles } from './lib/rcChat';
import {
  rcOnActivePerson, rcResolvePerson, rcSetActivePerson
} from './lib/rcActivePerson';

export type RcPerson = { readonly roleId: string; readonly name: string };

/**
 * Die Personen eines Kontos, in stabiler Reihenfolge.
 *
 * <b>Die Reihenfolge muss stehen.</b> Sie entscheidet, wer gilt, solange
 * niemand gewählt hat — und eine Liste, die sich bei jedem Laden umsortiert,
 * wechselt dann von selbst das Kind. Deshalb nach Namen und, wo der fehlt,
 * nach Kennung: beide ändern sich nicht.
 */
export function usePersons(signedIn: boolean): readonly RcPerson[] {
  const [persons, setPersons] = useState<readonly RcPerson[]>([]);

  useEffect(() => {
    if (!signedIn) { setPersons([]); return; }

    let alive = true;
    void (async () => {
      try {
        const found = await rcRoles();
        if (!alive) return;

        const mine = (found.roles ?? [])
          .filter((r) => r.kind === 'person' && r.hasKey)
          .map((r) => ({
            roleId: r.roleId,
            name: (r.displayName ?? '').trim()
          }))
          .sort((a, b) =>
            a.name === b.name ? a.roleId.localeCompare(b.roleId) : a.name.localeCompare(b.name));

        setPersons(mine);
      } catch {
        // Gesperrt oder nicht erreichbar: dann gibt es keine Wahl zu treffen.
        if (alive) setPersons([]);
      }
    })();
    return () => { alive = false; };
  }, [signedIn]);

  return persons;
}

/** Wer gerade gilt — mit Rücksicht auf eine Wahl, die ins Leere zeigt. */
export function useActivePerson(accountId: string, persons: readonly RcPerson[]): string | null {
  const [, bump] = useState(0);

  useEffect(() => rcOnActivePerson(() => bump((n) => n + 1)), []);

  return rcResolvePerson(accountId, persons);
}

export function RcPersonPicker({
  accountId, persons, active, className
}: {
  accountId: string;
  persons: readonly RcPerson[];
  active: string | null;
  /** Damit dieselbe Wahl in der Werkstatt und auf einer Pfarrseite passt. */
  className?: string;
}) {
  // Eine Wahl zwischen einem ist keine.
  if (persons.length < 2) return null;

  return (
    <label className={className ?? 'rc-person-pick'}>
      <span>Otwarte jako</span>
      <select
        value={active ?? ''}
        onChange={(e) => rcSetActivePerson(accountId, e.target.value)}
      >
        {persons.map((person) => (
          <option key={person.roleId} value={person.roleId}>
            {person.name === '' ? 'Osoba bez imienia' : person.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default RcPersonPicker;
