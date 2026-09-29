/**
 * Der Messplan auf einer Seite — der eine Baustein, der seinen Inhalt holt.
 *
 * <b>Er steht auch dann da, wenn sein `config` leer ist.</b> Im `config` steht
 * nur, WELCHER Kalender und wie viele Tage — die Messen selbst kommen erst
 * beim Aufruf. Deshalb hat er immer etwas zu zeigen (`hasContent`).
 *
 * <b>Der Baustein nennt einen KALENDER, nicht eine Adresse.</b> Das ist die
 * Antwort auf „welcher Bereich trägt den Messplan": der Kalender gehört einem
 * Bereich, und wer dessen Epochenschlüssel offengelegt hat, dessen Messen
 * hängen im Schaukasten — auf JEDER Seite, die den Kalender nennt, auch einer
 * fremden.
 *
 * <b>Ohne Kalender wird gesammelt.</b> Steht kein Kalender im `config`, zeigt
 * der Baustein alle Messen, die offen liegen, mit der Angabe woher. Das ist
 * kein Notbehelf, sondern der Dekanatsplan.
 *
 * <b>Was gezeigt wird, entscheidet die GRÖSSE</b> (`massShape.ts`): die
 * kleinen zeigen einen Blick auf jetzt (`MassGlance`), die grossen blättern —
 * vor und zurück, ein Kalender, Tag, Woche, Monat (`MassBrowser`).
 *
 * <b>Ein Fehlschlag schweigt nicht.</b> Der Besucher bekommt eine ruhige Zeile
 * statt einer leeren Kachel: eine Kachel, die nichts sagt, sieht für den, der
 * die Seite führt, genauso aus wie eine, die nichts zu sagen hat.
 */

import type { ReactNode } from 'react';

import { addDays, startOfDay } from './dayMath';
import { daysToLoad, massView, type MassView } from './massShape';
import { MassBrowser } from './MassBrowser';
import { Glance } from './MassGlance';
import { placeOf, useNow, usePlan } from './MassParts';
import type { PartSize } from './part';

export function MassCard({ title, calendar, days: wanted, size }: {
  title: string;
  calendar: string;

  /**
   * Wie viele Tage — oder `null`, wenn niemand es gesagt hat.
   *
   * <b>`null` ist nicht 7.</b> Ohne Angabe richtet sich die Zahl nach dem,
   * was in die Kachel passt; eine Vorgabe daraus zu machen hiesse, jede
   * flache Kachel mit sieben Tagen zu füllen, die sie nicht zeigen kann.
   */
  days: number | null;

  size: PartSize;
}) {
  const shown = massView(size, wanted);
  const now = useNow();

  return (
    <>
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {shown.browse === 'none'
        ? <Live shown={shown} calendar={calendar} now={now} />
        : <MassBrowser shown={shown} calendar={calendar} now={now} />}
    </>
  );
}

/** Die kleinen: ein Blick auf JETZT, nichts zu bedienen. Nach Mitternacht beginnt er einen Tag später. */
function Live({ shown, calendar, now }: { shown: MassView; calendar: string; now: Date }): ReactNode {
  const from = startOfDay(now);
  const { loaded, failed } = usePlan(calendar, from, addDays(from, daysToLoad(shown)), 'live');

  if (loaded === null) {
    return <p className="wk-card-muted">{failed ? 'Planu nie udało się wczytać.' : 'Wczytywanie…'}</p>;
  }

  return (
    <Glance
      shown={shown}
      services={loaded.masses}
      now={now}
      anchor={null}
      place={placeOf(calendar, loaded.masses)}
      calendarSet={calendar !== ''}
    />
  );
}

export default MassCard;
