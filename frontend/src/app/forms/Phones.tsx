/**
 * Telefonnummern als Plättchen — eine oder mehrere, jede mit ihrem ×.
 *
 * <b>Die Vorwahl schreibt die Maschine.</b> Wer „600 700 800" tippt, meint eine
 * polnische Nummer; das `+48` davorzusetzen ist Arbeit, die niemand von Hand
 * tun sollte. Wer eine ausländische Nummer hat, schreibt sie mit `+` — dann
 * bleibt sie, wie sie ist (`phone.ts`).
 *
 * <b>Ein Plättchen entsteht beim Loslassen, nicht beim Abschicken.</b> Enter,
 * Komma oder das Verlassen des Feldes machen aus dem Getippten einen Eintrag.
 * Wer stattdessen erst beim Absenden erführe, dass seine Nummer nicht zählt,
 * erführe es an der falschen Stelle.
 *
 * <b>Was nicht wie eine Nummer aussieht, bleibt stehen.</b> Es verschwindet
 * nicht und es wird auch nicht zu einem Plättchen — es steht weiter im Feld,
 * daneben steht warum. Eine halb gelöschte Eingabe ist schlimmer als eine, die
 * noch nicht angenommen wurde.
 */

import { useState } from 'react';

import { normalisePhone, splitPhones, joinPhones, withPhone } from './phone';

export function Phones({ value, disabled, onChange }: {
  /** Der gespeicherte Wert: eine Nummer je Zeile. */
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const numbers = splitPhones(value);

  const [typed, setTyped] = useState('');
  const [rejected, setRejected] = useState(false);

  const take = (): boolean => {
    if (typed.trim() === '') return true;

    const next = withPhone(numbers, typed);

    if (!next.added && normalisePhone(typed) === null) {
      setRejected(true);
      return false;
    }

    onChange(joinPhones([...next.numbers]));
    setTyped('');
    setRejected(false);
    return true;
  };

  const drop = (one: string) =>
    onChange(joinPhones(numbers.filter((n) => n !== one)));

  return (
    <>
      {numbers.length > 0 && (
        <ul className="wk-chips">
          {numbers.map((one) => (
            <li className="wk-chip" key={one}>
              <span>{one}</span>
              <button
                type="button"
                className="wk-chip-x"
                disabled={disabled}
                aria-label={`Usuń ${one}`}
                onClick={() => drop(one)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="tel"
        inputMode="tel"
        value={typed}
        disabled={disabled}
        placeholder={numbers.length === 0 ? '600 700 800' : 'dodaj kolejny…'}
        onChange={(e) => {
          const text = e.target.value;

          /*
           * Ein Komma heisst „diese Nummer ist fertig" — so schreibt man
           * mehrere hintereinander, ohne die Hand von der Tastatur zu nehmen.
           * Alles VOR dem ersten Komma wird genommen, alles danach bleibt im
           * Feld stehen.
           */
          const comma = text.indexOf(',');

          if (comma < 0) {
            setTyped(text);
            setRejected(false);
            return;
          }

          const first = text.slice(0, comma);
          const rest = text.slice(comma + 1).trim();
          const next = withPhone(numbers, first);

          if (next.added) {
            onChange(joinPhones([...next.numbers]));
            setTyped(rest);
            setRejected(false);
            return;
          }

          /* Keine Nummer — das Komma fällt weg, das Getippte bleibt stehen. */
          setTyped((first + ' ' + rest).trim());
          setRejected(normalisePhone(first) === null && first.trim() !== '');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            /*
             * NICHT das Formular abschicken. Enter heisst in einem Feld mit
             * Plättchen „diese Nummer ist fertig" und nicht „ich bin fertig".
             */
            e.preventDefault();
            take();
            return;
          }

          /* Rücktaste im leeren Feld nimmt das letzte Plättchen zurück. */
          if (e.key === 'Backspace' && typed === '' && numbers.length > 0) {
            e.preventDefault();
            drop(numbers[numbers.length - 1]);
          }
        }}
        onBlur={() => take()}
      />

      {rejected && (
        <span className="wk-blocker">
          To nie wygląda na numer. Zostaje w polu — popraw go albo usuń.
        </span>
      )}

      {numbers.length === 0 && !rejected && (
        <span className="wk-hint">
          Wpisz numer i naciśnij Enter. <strong>+48 dopisze się samo</strong>;
          numer zagraniczny zacznij od <code>+</code>.
        </span>
      )}
    </>
  );
}

export default Phones;
