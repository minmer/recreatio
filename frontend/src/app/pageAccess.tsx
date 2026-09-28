/**
 * WER AUF EINER SEITE MIT ZUGANG HANDELN DARF.
 *
 * Eine Seite kann nur für Menschen mit Zugang sein (`internal_for_role_id`):
 * wer seinen Link zu GENAU dieser Seite hat, wer die gewählte Rolle hält, und
 * wer die Seite führt. Der Dienst sagt beim Laden, welche der Links in diesem
 * Browser und welche der eigenen Personen dazugehören (`PageContent.access`).
 *
 * <b>Warum je Person und nicht nur je Browser.</b> Ein Browser hält oft mehr
 * als einen Link — auch einen alten aus einem anderen Formular desselben
 * Hauses. Mit ihm ließ sich hier ein Termin nehmen, und in der Kanzlei stand
 * dann „bez nazwy". Jetzt steht für so jemanden, dass es Zugang braucht.
 */

import { createContext, useContext } from 'react';

import type { PageAccess } from './page';
import type { PagePerson } from './pagePerson';

export const PageAccessContext = createContext<PageAccess | null>(null);

export const usePageAccess = (): PageAccess | null => useContext(PageAccessContext);

/** Darf DIESE Person hier handeln? Auf einer Seite ohne Zugangsregel: jeder. */
export function allows(access: PageAccess | null, person: PagePerson): boolean {
  if (access === null || !access.restricted) return true;
  return person.kind === 'seat'
    ? (access.seats ?? []).includes(person.id)
    : (access.roles ?? []).includes(person.id);
}

/**
 * STRONA TYLKO Z DOSTĘPEM — a ten, kto ją otwiera, go nie ma. Mówimy to wprost:
 * wcześniej stało tu „Nic tu jeszcze nie ma", i kto nie miał przy sobie linku,
 * myślał, że strona zniknęła.
 */
export function NoAccess({ verdict }: { verdict: 'needsaccess' | 'noaccess' }) {
  return (
    <section className="wk-form">
      <h1 className="wk-h1">Ta strona wymaga dostępu</h1>
      <p className="wk-lede">
        Otworzą ją tylko osoby, które mają do niej dostęp: przez swój link do tej strony (np. z SMS-a)
        albo przez konto, któremu go nadano.
      </p>
      {verdict === 'needsaccess' ? (
        <>
          <p>
            <strong>Dostałeś link?</strong> Otwórz go jeszcze raz — w całości, tak jak przyszedł.
          </p>
          <p>
            <strong>Masz konto z dostępem?</strong>{' '}
            <a className="wk-link" href="#/workspace">Zaloguj się</a>, a potem wróć na tę stronę.
          </p>
        </>
      ) : (
        <p>
          Jesteś zalogowany, ale ani Twoje konto, ani Twoje osoby, ani linki w tej przeglądarce nie mają
          dostępu do tej strony. Jeśli powinny — poproś o dostęp tych, którzy ją prowadzą, albo otwórz
          link, który dostałeś do tej strony.
        </p>
      )}
    </section>
  );
}
