/**
 * EIN TERMIN — anlegen, ändern, löschen; so, wie man es aus jedem Kalender
 * kennt: Titel, wann, ganztägig, Wiederholung, Ort, Notiz — und in welchem
 * Kalender.
 *
 * <b>Der Kalender gibt die Regeln vor</b> (0058): wer den Termin sieht, wie
 * lange er dauert, was er ist (Treffen, Messe), ob und von wem er reserviert
 * werden kann. Hier lässt sich jede davon für DIESEN Termin ändern — mehr
 * Plätze, nur für eine Gruppe, für andere Leute sichtbar.
 *
 * <b>Wer da sein muss</b>: Menschen der Gruppe, an den Termin geheftet — für
 * die ganze Reihe oder nur für dieses Vorkommen.
 *
 * <b>Bei einer Reihe wird gefragt, was gemeint ist</b>: nur dieser Termin
 * (verschieben oder absagen — mehr kann ein einzelnes Vorkommen nicht) oder
 * die ganze Reihe.
 *
 * <b>Was man hier nicht ändert, sagt es</b>: eine Messe (an ihr hängen
 * Intentionen) — nur, wer sie feiert; eine Buchung (sie gehört dem, der sie
 * genommen hat).
 */

import type { AreaRow } from '../areas/area';
import { type CalendarRow } from './calendar';
import { type CalEvent } from './calendarModel';
import type { Me } from '../core/me';
import { Details } from './EventDetails';
import { Editor } from './EventEditor';

/**
 * Ein neuer Termin ab dieser Zeit — oder ein bestehender.
 *
 * 0070 — ein neuer kann ein TEIL eines anderen sein (`parentItemId`: ein
 * Punkt im Programm) und aus einer Rozmowa kommen (`origin`, mit Titel).
 */
export type EventTarget = {
    readonly at: 'new'; readonly start: Date; readonly end: Date; readonly allDay: boolean; readonly calendarId?: string;
    readonly parentItemId?: string; readonly parentTitle?: string;
    readonly origin?: { readonly chatId: string; readonly topicId: string | null };
    readonly title?: string;
  }
  | { readonly at: 'event'; readonly event: CalEvent };

export function EventDialog({ me, areas, calendars, scope, target, events, onClose, onSaved, onOpenPart }: {
  me: Me;
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  /** Nur diese Kalender (ein Kalender-Baustein auf einer Seite) — fehlt: alle, in denen ich schreibe. */
  scope?: readonly string[];
  target: EventTarget;
  /** 0070 — die geladenen Termine: daraus die Teile dieses Termins und sein Ganzes. */
  events?: readonly CalEvent[];
  onClose: () => void;
  onSaved: () => void;
  /** 2026-10-17 — einen Punkt des Programms öffnen. */
  onOpenPart?: (part: CalEvent) => void;
}) {
  if (target.at === 'event' && (target.event.source !== 'item' || !target.event.item?.editable)) {
    return <Details me={me} areas={areas} calendars={calendars} event={target.event} onClose={onClose} onSaved={onSaved} />;
  }

  return <Editor me={me} areas={areas} calendars={calendars} scope={scope} target={target} events={events}
    onClose={onClose} onSaved={onSaved} onOpenPart={onOpenPart} />;
}

export default EventDialog;
