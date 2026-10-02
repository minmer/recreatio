/**
 * DER KALENDER OHNE KONTO — für den, der einen Link mit Zugang hält (0073).
 *
 * <b>Das Formular der Links bietet ihn als Ziel an</b> („Kalendarz w
 * warsztacie") und sagt dazu: „z dostępem od razu, także bez konta". Wer so
 * einen Link öffnete, stand trotzdem vor „Zaloguj się" — der Arbeitsplatz
 * fragte nach einem Konto, bevor er den Link überhaupt ansah. Der Zugang war
 * da und ging an der Tür verloren.
 *
 * <b>Hier handelt der Browser als die Linkrollen</b> (`linkMe.ts`): derselbe
 * Kalender wie im Arbeitsplatz, auf die Kalender begrenzt, die die Links
 * sehen — lesen, und wo ein Link „pisze" sagt, eintragen und ändern. Aufgaben,
 * eigene Buchungen und die Einstellungen der Kalender gehören einem Konto und
 * fehlen deshalb.
 *
 * <b>Die Anmeldung bleibt einen Klick entfernt.</b> Wer ein Konto hat, will
 * vielleicht SEINEN Kalender sehen und nicht den des Links.
 */

import { useEffect, useState, type ReactNode } from 'react';

import { loadCalendars } from './calendar';
import { Calendar } from './CalendarApp';
import { accessWords, heldLinkKeys, type HeldInfo } from './linkAccess';
import { useLinkMe } from './linkMe';

export function LinkCalendar({ fallback, onSignIn }: {
  /** Was dasteht, wenn dieser Browser keinen Link hält, der einen Kalender sieht — die Anmeldung. */
  fallback: ReactNode;
  onSignIn: () => void;
}) {
  const me = useLinkMe(true);
  const [found, setFound] = useState<{ ids: readonly string[]; writes: boolean; links: readonly HeldInfo[] } | null>(null);

  useEffect(() => {
    if (me == null) return undefined;
    let alive = true;
    void (async () => {
      const calendars = await loadCalendars().then((got) => got.calendars.filter((c) => c.archived !== true), () => []);
      const links = await heldLinkKeys().then((keys) => keys.links.filter((one) => one.info !== null), () => [] as readonly HeldInfo[]);
      if (alive) setFound({ ids: calendars.map((c) => c.calendarId), writes: calendars.some((c) => c.mayWrite === true), links });
    })();
    return () => { alive = false; };
  }, [me]);

  if (me === undefined || (me !== null && found === null)) return <p className="wk-lede">Wczytywanie…</p>;
  if (me === null || found === null || found.ids.length === 0) return <>{fallback}</>;

  return (
    <>
      <h1 className="wk-h1">Kalendarz</h1>
      <p className="wk-note wk-link-calendar-note">
        Otwarte z linku, bez konta — {found.links.map((one) => accessWords(one.info!.areas)).join(' · ')}.
        {' '}{found.writes ? 'Możesz tu dopisywać i zmieniać terminy.' : 'Możesz tu czytać terminy.'}
        {' '}Masz konto? <button type="button" className="wk-link-btn" onClick={onSignIn}>Zaloguj się</button>, żeby zobaczyć swój kalendarz.
      </p>
      <Calendar me={me} scope={found.ids} />
    </>
  );
}
