/**
 * WER AUF EINER SEITE MIT ZUGANG HANDELN DARF.
 *
 * Eine Seite kann nur für Menschen mit Zugang sein (gebunden an Bereiche, 0051):
 * wer einen Link aus einem dieser Bereiche (oder zu GENAU dieser Seite) hat,
 * wer einen dieser Bereiche liest, und wer die Seite führt. Der Dienst sagt beim Laden, welche der Links in diesem
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
import { rich, useT } from '../core/i18n';

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
  const t = useT();
  return (
    <section className="wk-form">
      <h1 className="wk-h1">{t('pages.access.title')}</h1>
      <p className="wk-lede">{t('pages.access.lede')}</p>
      {verdict === 'needsaccess' ? (
        <>
          <p>{rich(t('pages.access.gotLink'), { b: (s, k) => <strong key={k}>{s}</strong> })}</p>
          <p>{rich(t('pages.access.hasAccount'), {
            b: (s, k) => <strong key={k}>{s}</strong>,
            link: (s, k) => <a key={k} className="wk-link" href="#/workspace">{s}</a>
          })}</p>
        </>
      ) : (
        <p>{t('pages.access.noAccess')}</p>
      )}
    </section>
  );
}
