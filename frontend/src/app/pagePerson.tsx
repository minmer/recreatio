/**
 * FÜR WEN auf dieser Seite gehandelt wird — EINMAL gewählt, oben, für alles.
 *
 * <b>Vorher fragte jeder Baustein selbst.</b> Oben standen je geöffnetem Link
 * ein aufklappbarer Kasten, die Rezerwacja fragte „Za kogo" noch einmal, das
 * Formular hatte sein eigenes „Kogo dotyczy". Drei Stellen für dieselbe Frage,
 * und nichts hielt sie beieinander: man konnte für Anna einen Termin nehmen
 * und im Formular darunter Jan eintragen, ohne es zu merken.
 *
 * <b>Jetzt eine Auswahl für die ganze Seite</b> (`PersonPicker`), und jeder
 * Baustein liest sie (`usePerson`):
 *
 * <code>
 *   ein Platz aus einem Link    — sein Zgłoszenie, seine Wiadomość, seine Termine
 *   eine eigene Person          — wenn angemeldet: aus der Rollenkarte,
 *                                 füllt das Formular vor, nimmt Termine
 * </code>
 *
 * <b>Die Wahl bleibt, solange der Tab offen ist</b> — je Haus in
 * `sessionStorage`, als Bequemlichkeit und nicht als Zustand, auf den sich
 * etwas verlassen müsste. Kein Schlüssel liegt darin, nur die Kennung.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { calledFrom } from './called';
import type { Ring } from './keys';
import { loadPerson, openMine } from './person';
import { keysFor } from './ringOf';
import { seatName, useSeats, type SeatView } from './seatContext';
import { freshSeat, seatsExactly } from './seatKeep';
import { whoIsThere } from './session';
import { subjectsFor } from './subject';

export type PagePerson =
  | { readonly kind: 'seat'; readonly id: string; readonly name: string; readonly seat: SeatView }
  | {
      readonly kind: 'role'; readonly id: string; readonly name: string;
      readonly isMine: boolean; readonly ring: Ring;
    };

export interface PersonChoice {
  readonly options: readonly PagePerson[];

  /** `null` — niemand aus der Liste: ein Besucher, oder „ich trage selbst ein". */
  readonly chosen: PagePerson | null;
  readonly choose: (id: string | null) => void;

  /** Die eigenen Personen werden noch geladen — dann nichts voreilig wählen. */
  readonly loading: boolean;
}

const PersonContext = createContext<PersonChoice | null>(null);

/** Die Wahl der Seite — oder `null`, wo es keine gibt (die Ansicht eines Platzes ohne Seite). */
export const usePerson = (): PersonChoice | null => useContext(PersonContext);

/* -- Die eigenen Personen ------------------------------------------------- */

interface Own { readonly roleId: string; readonly name: string; readonly isMine: boolean; readonly ring: Ring }

/**
 * Die Personen aus der Rollenkarte — mit Vor- und Nachnamen, sonst dem
 * Spitznamen, sonst dem Namen der Rolle.
 */
async function ownPersons(): Promise<readonly Own[]> {
  const who = await whoIsThere();
  if (who === null) return [];

  const { graph, ring } = await keysFor(who);
  if (ring === null) return [];

  const out: Own[] = [];

  for (const one of await subjectsFor('person', graph, ring)) {
    let name = one.name;

    try {
      /*
       * IMIĘ I NAZWISKO zuerst, wo sie bekannt sind — derselbe Name, den die
       * Kanzlei am Termin und in ihrer Liste sieht. Der Spitzname nur, wenn
       * es sonst nichts gibt.
       */
      name = calledFrom(await openMine(one.roleId, ring, (await loadPerson(one.roleId)).values))?.name ?? name;
    } catch {
      // Keine eigenen Angaben — dann der Name der Rolle.
    }

    out.push({ roleId: one.roleId, name: name ?? 'Osoba bez nazwy', isMine: one.isMine, ring });
  }

  return out;
}

/* -- Behalten, was gewählt war -------------------------------------------- */

const slot = (house: string) => `recreatio:who:${house}`;

function recallChoice(house: string): string | null | undefined {
  try {
    const said = window.sessionStorage.getItem(slot(house));
    return said === null ? undefined : said === '' ? null : said;
  } catch {
    return undefined;
  }
}

function keepChoice(house: string, id: string | null): void {
  try { window.sessionStorage.setItem(slot(house), id ?? ''); } catch { /* ohne Speicher gilt es für dieses Bild */ }
}

/* -- Der Rahmen ------------------------------------------------------------ */

export function PersonProvider({ path, children }: { path: string; children: ReactNode }) {
  const seats = useSeats();
  const [own, setOwn] = useState<readonly Own[] | null>(null);
  const house = path.split('/')[0] ?? '';

  useEffect(() => {
    let alive = true;
    ownPersons()
      .then((found) => { if (alive) setOwn(found); })
      .catch(() => { if (alive) setOwn([]); });
    return () => { alive = false; };
  }, []);

  const options = useMemo<readonly PagePerson[]>(() => [
    ...seats.filter((seat) => seat.seatKey !== null).map((seat, at): PagePerson =>
      ({ kind: 'seat', id: seat.token, name: seatName(seat, at), seat })),
    ...(own ?? []).map((one): PagePerson =>
      ({ kind: 'role', id: one.roleId, name: one.name, isMine: one.isMine, ring: one.ring }))
  ], [seats, own]);

  const [picked, setPicked] = useState<string | null | undefined>(() => recallChoice(house));

  /*
   * WER, SOLANGE NIEMAND GEWÄHLT HAT: der Link, der gerade hierher geführt
   * hat; sonst ein Platz, dessen Link auf GENAU diese Seite zeigt; sonst die
   * eigene Person. Ein Platz einer ANDEREN Seite des Hauses ist wählbar, aber
   * nicht vorgewählt: wer vom Portal seines ersten Kindes zum Formular geht,
   * um das zweite anzumelden, soll es nicht aus Versehen beim ersten eintragen.
   */
  const fallback = useMemo(() => {
    const fresh = freshSeat();
    const exact = new Set(seatsExactly(path));
    return options.find((one) => one.kind === 'seat' && one.id === fresh?.token && fresh.under === path)
      ?? options.find((one) => one.kind === 'seat' && exact.has(one.id))
      ?? options.find((one) => one.kind === 'role' && one.isMine)
      ?? null;
  }, [options, path]);

  const chosen = picked === undefined
    ? fallback
    : picked === null ? null : options.find((one) => one.id === picked) ?? fallback;

  const choice = useMemo<PersonChoice>(() => ({
    options,
    chosen,
    loading: own === null,
    choose: (id) => { setPicked(id); keepChoice(house, id); }
  }), [options, chosen, own, house]);

  return <PersonContext.Provider value={choice}>{children}</PersonContext.Provider>;
}

/* -- Die Auswahl, oben ---------------------------------------------------- */

/**
 * EINE Auswahl, oben auf der Seite. Nur, wenn es etwas zu wählen gibt: wer
 * genau einen Link geöffnet hat, der schon gilt, braucht keine Liste mit
 * einem Eintrag.
 */
export function PersonPicker() {
  const choice = usePerson();
  /* Eine Liste mit EINEM Eintrag nur dann, wenn er nicht schon gewählt ist. */
  if (choice === null || choice.options.length === 0) return null;
  if (choice.options.length === 1 && choice.chosen?.id === choice.options[0].id) return null;

  const seats = choice.options.filter((one) => one.kind === 'seat');
  const roles = choice.options.filter((one) => one.kind === 'role');

  return (
    <label className="wk-person-pick">
      <span>Za kogo</span>
      <select
        value={choice.chosen?.id ?? ''}
        onChange={(e) => choice.choose(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">— nikt z listy —</option>
        {seats.length > 0 && (
          <optgroup label="Z linku">
            {seats.map((one) => <option key={one.id} value={one.id}>{one.name}</option>)}
          </optgroup>
        )}
        {roles.length > 0 && (
          <optgroup label="Z konta">
            {roles.map((one) => (
              <option key={one.id} value={one.id}>{one.name}{one.kind === 'role' && one.isMine ? ' (ja)' : ''}</option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}
