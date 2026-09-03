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

/** Nazwy pól formularza zgłoszenia, na które przekładają się dane osobowe. */
const TO_APPLY: Record<string, string> = {
  PersonGivenName: 'name',
  PersonSurname: 'name',
  PersonPhone: 'contact',
  PersonBorn: 'born'
};

export async function rcMyPersonFields(): Promise<Record<string, string>> {
  try {
    const roles = await rcRoles();
    const person = (roles.roles ?? []).find((r) => r.kind === 'person');
    if (person?.roleId === undefined || person.roleId === null) return {};

    const values = await rcDataValues(person.roleId);

    /*
     * Imię i nazwisko trafiają do JEDNEGO pola formularza i muszą się w nim
     * spotkać w dobrej kolejności. Zbieram je osobno, bo `values` przychodzi w
     * kolejności zapisu, a nie czytania.
     */
    let given = '', surname = '';
    const out: Record<string, string> = {};

    for (const item of values.values ?? []) {
      const value = (item.value ?? '').trim();
      if (value === '') continue;

      if (item.field === 'PersonGivenName') { given = value; continue; }
      if (item.field === 'PersonSurname') { surname = value; continue; }

      const target = TO_APPLY[item.field ?? ''];
      // Pierwszy wygrywa: telefonów może być kilka, a formularz ma jedno pole.
      if (target !== undefined && out[target] === undefined) out[target] = value;
    }

    const full = [given, surname].filter((p) => p !== '').join(' ');
    if (full !== '') out.name = full;

    return out;
  } catch {
    return {};
  }
}
