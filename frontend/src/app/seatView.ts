/**
 * EINEN PLATZ AUFMACHEN — wo immer man gerade steht.
 *
 * <b>Es stand in `SeatPortal`, und deshalb galt es nur dort.</b> Der Platz
 * eines Menschen ging auf, solange er auf SEINER Seite stand; ging er eine
 * Seite weiter, war alles wieder zu — obwohl der Schlüssel im Browser lag.
 * Die Behauptung „gilt auf der ganzen Adresse" war damit unwahr, und zwar
 * leise: es sah aus, als hätte man den Link nie geöffnet.
 *
 * <b>Hier ist es ein Haken</b>, und zwei Ansichten benutzen ihn: das Portal
 * selbst und jede öffentliche Seite, auf der ein behaltener Platz gilt
 * (`PublicPage`). Ein Platz, zwei Orte, ein Weg ihn aufzumachen.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadPublicKey } from './area';
import { loadPublic, type Occurrence } from './calendar';
import { aad, Field, fromBase64Url, openText } from './crypto';
import { openSubmitted } from './form';
import { loadPortal, openGrants, openPortal, type Portal } from './seat';
import type { SeatView } from './seatContext';
import { recall, remember } from './seatKeep';
import { WorkspaceError } from './session';

interface Shared {
  readonly name: string;
  readonly when: string;
  readonly what: string | null;
}

/** Was nicht aufgeht, ist `null` — ein kaputter Link ist kein Absturz. */
function quiet<T>(todo: () => T): T | null {
  try { return todo(); } catch { return null; }
}

export interface Opened {
  /** `undefined` = noch nicht nachgesehen, `null` = ging nicht. */
  readonly portal: Portal | null | undefined;
  readonly failed: string | null;

  /** `null`, solange nichts offen ist — dann gibt es auch nichts zu zeigen. */
  readonly seat: SeatView | null;

  readonly reload: () => void;
}

/**
 * @param keyText Der Schlüssel aus dem Link, wenn einer dabei war. Sonst der
 *   behaltene — und das ist nach dem ersten Mal der Normalfall.
 */
export function useSeat(token: string, keyText: string | null): Opened {
  const [portal, setPortal] = useState<Portal | null | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [seatKey, setSeatKey] = useState<Uint8Array | null>(null);
  const [shared, setShared] = useState<readonly Shared[]>([]);
  const [sharedNames, setSharedNames] = useState<readonly string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  const [mine, setMine] = useState<
    readonly { fieldId: string; label: string | null; value: string | null }[]
  >([]);

  const look = useCallback(async () => {
    try {
      const found = await loadPortal(token);
      setPortal(found);
      setFailed(null);
      setSharedNames(found.grants.map((g) => g.areaName));

      /*
       * AUS DEM LINK ODER AUS DEM BROWSER — in dieser Reihenfolge.
       *
       * Der Link gilt, wenn einer da ist: wer einen NEUEN bekommen hat
       * (`relink`), soll den neuen benutzen und nicht den alten, der noch
       * herumliegt. Sonst der behaltene, und das ist der Normalfall — nach
       * dem ersten Mal steht er nicht mehr in der Adresse.
       */
      const fromLink = keyText === null ? null : quiet(() => fromBase64Url(keyText));
      const held = fromLink ?? recall(token);

      if (held === null) return;

      let key: Uint8Array;
      try {
        const opened = await openPortal(found, held);
        key = opened.seatKey;
        setSeatKey(key);

        /* Er geht auf — also ist er der richtige, und er darf bleiben. */
        remember(token, held);
        setNote(opened.personal);
      } catch {
        setSeatKey(null);
        setNote(null);
        return;
      }

      /*
       * WAS ER SELBST EINGETRAGEN HAT (0027) — beim Firmling sein Formular.
       *
       * Der Wert hängt am Platz, die FRAGE dagegen an der Epoche des Bereichs.
       * Die liegt bei einem öffentlichen Formular offen — sonst hätte er es nie
       * ausfüllen können. Bleibt sie zu, steht die Antwort trotzdem da, nur
       * ohne Beschriftung.
       */
      if (found.submitted.length > 0) {
        const epochs = new Map<string, Uint8Array>();

        for (const areaId of new Set(found.submitted.map((s) => s.areaId))) {
          try {
            epochs.set(areaId, fromBase64Url((await loadPublicKey(areaId)).key));
          } catch {
            // Nicht offengelegt. Die Antwort bleibt lesbar, die Frage nicht.
          }
        }

        setMine(await openSubmitted(found.submitted, key, epochs));
      }

      /*
       * Das Gemeinsame. Der Klassenschlüssel steckt im Platz; das Token sagt
       * dem Dienst, welche Bereiche er herausgeben darf — der Schlüssel selbst
       * geht nie hinaus.
       */
      const keys = await openGrants(found.grants, key);
      const rows: Shared[] = [];

      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 30);

      for (const grant of found.grants) {
        const classKey = keys.get(grant.areaId);
        if (classKey === undefined) continue;

        for (const calendar of grant.calendars) {
          let days;
          try { days = await loadPublic(calendar.calendarId, from, to, undefined, token); }
          catch { continue; }

          for (const one of days.occurrences) {
            rows.push({
              name: grant.areaName,
              when: one.startsAt,
              what: await titleOf(one, classKey.key)
            });
          }
        }
      }

      rows.sort((a, b) => a.when.localeCompare(b.when));
      setShared(rows);
    } catch (e) {
      setPortal(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć.');
    }
  }, [token, keyText]);

  useEffect(() => { void look(); }, [look]);

  const seat: SeatView | null = portal === undefined || portal === null ? null : {
    token,
    seatKey,
    recipientName: portal.recipientName,
    note,
    submitted: portal.submitted,
    opened: mine,
    shared,
    sharedNames,
    expiresAt: portal.expiresAt,
    reload: () => void look()
  };

  return { portal, failed, seat, reload: () => void look() };
}

/** Der Titel eines Eintrags — offen, wenn er offen ist, sonst aufgemacht. */
async function titleOf(one: Occurrence, key: Uint8Array): Promise<string | null> {
  if (one.titlePublic !== null && one.titlePublic !== '') return one.titlePublic;

  const sealed = one.fields.find((f) => f.field === 'title');
  if (sealed === undefined) return null;

  try {
    return await openText(
      key,
      aad('calendar', 'item', one.itemId, Field.CalendarEventTitle, 1),
      fromBase64Url(sealed.sealed)
    );
  } catch {
    return null;
  }
}
