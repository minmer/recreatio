/**
 * Co już wiadomo o zalogowanym — do wstępnego wypełnienia formularza.
 *
 * <b>Skąd to się bierze.</b> Imię, nazwisko i telefon leżą jako osobno
 * zaszyfrowane dane przy osobistej roli konta (`rcPerson`). Serwer ich nie
 * czyta; czyta je przeglądarka, która ma klucze.
 *
 * <b>Dlaczego cicha porażka.</b> Brak konta, brak kluczy, brak sieci —
 * wszystkie znaczą to samo: nie ma czym wypełnić. Formularz zostaje pusty i
 * człowiek wpisuje sam. Błąd byłby tu gorszy niż milczenie: on nie prosił o
 * wypełnienie, tylko o formularz.
 *
 * <b>Odczyt jest zapisywany.</b> To dane osobowe klasy `personal` (12.9), więc
 * każde ich otwarcie zostawia wpis — także własne. Rejestr, który pomija
 * najczęstszy przypadek, nie odpowiada później na nic.
 */

import { rcRoles } from '../lib/rcChat';
import { rcDataValues } from '../lib/rcPerson';
import { rcPhones } from './rcPhone';

/**
 * Nazwy pól formularza zgłoszenia, na które przekładają się dane osobowe.
 *
 * Jedno do jednego: profil trzyma imię osobno od nazwiska, a formularz też —
 * więc nic nie trzeba sklejać ani później rozdzielać.
 */
const TO_APPLY: Record<string, string> = {
  PersonGivenName: 'given',
  PersonSurname: 'surname',
  PersonPhone: 'phone',
  PersonBorn: 'born'
};

/** Pola, w których kilka wartości ma sens — każda w swoim wierszu. */
const MANY = new Set(['phone']);

export async function rcMyPersonFields(): Promise<Record<string, string>> {
  try {
    const roles = await rcRoles();
    const person = (roles.roles ?? []).find((r) => r.kind === 'person');
    if (person?.roleId === undefined || person.roleId === null) return {};

    const values = await rcDataValues(person.roleId);

    const out: Record<string, string> = {};

    for (const item of values.values ?? []) {
      const value = (item.value ?? '').trim();
      if (value === '') continue;

      const target = TO_APPLY[item.field ?? ''];
      if (target === undefined) continue;

      /*
       * Telefonów bywa kilka — własny i do rodzica — i formularz przyjmuje je
       * wszystkie, po jednym w wierszu. Wcześniej wygrywał pierwszy, a reszta
       * przepadała po cichu: człowiek widział jeden numer i nie wiedział, że
       * drugi w ogóle był.
       */
      if (MANY.has(target)) {
        out[target] = out[target] === undefined ? value : `${out[target]}\n${value}`;
        continue;
      }

      // Poza tym pierwszy wygrywa: jednego pola nie da się wypełnić dwa razy.
      if (out[target] === undefined) out[target] = value;
    }

    // Numery z profilu też przechodzą przez tę samą formę co wpisane ręcznie.
    if (out.phone !== undefined) out.phone = rcPhones(out.phone).join('\n');

    return out;
  } catch {
    return {};
  }
}
