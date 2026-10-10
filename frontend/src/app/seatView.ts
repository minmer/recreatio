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

import { areaReader } from './areaRead';
import { loadPublic, type Occurrence } from './calendar';
import { aad, Field, fromBase64Url, openText } from './crypto';
import { openSubmitted, type OwnAnswer } from './form';
import { isChallenge, loadPortal, openGrants, openPortal, type Portal } from './seat';
import { openSeatRoles } from './memberRole';
import type { SeatChallenge } from './seatCheck';
import type { SeatView } from './seatContext';
import { openSteps, type SeatForm } from './steps';
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

  /**
   * Der Link wartet auf seine ERSTE Bestätigung (0046). Dann ist `portal`
   * noch `undefined` und `seat` `null`: es kam nichts, was etwas aufschliesst.
   */
  readonly challenge: SeatChallenge | null;

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

  const [mine, setMine] = useState<readonly OwnAnswer[]>([]);
  const [forms, setForms] = useState<readonly SeatForm[]>([]);
  const [challenge, setChallenge] = useState<SeatChallenge | null>(null);

  const look = useCallback(async () => {
    try {
      const reply = await loadPortal(token);

      /*
       * ERST BESTÄTIGEN (0046). Der Dienst hat nur die Fragen geschickt — die
       * Seite zeigt sie (`FirstOpen`) und holt danach alles noch einmal.
       */
      if (isChallenge(reply)) {
        setChallenge(reply);
        setPortal(undefined);
        setSeatKey(null);
        setFailed(null);
        return;
      }

      const found = reply;
      setChallenge(null);
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
       * Der Wert hängt am Platz, die FRAGE dagegen am Schlüssel des
       * FORMULARbereichs (0042). Der liegt bei einem öffentlichen Formular
       * offen; bei einem Formular nur für die Menschen eines Bereichs kommt
       * er aus dem Link oder der eigenen Zuteilung (`areaReader`). Bleibt er
       * zu, steht die Antwort trotzdem da, nur ohne Beschriftung.
       */
      const reader = areaReader();

      if (found.submitted.length > 0) {
        const epochs = new Map<string, Uint8Array>();

        for (const one of found.submitted) {
          const areaId = one.labelAreaId ?? one.areaId;
          if (epochs.has(areaId)) continue;

          const labelKey = await reader.key(areaId, one.labelEpoch ?? one.epoch);
          if (labelKey !== undefined) epochs.set(areaId, labelKey);
        }

        setMine(await openSubmitted(found.submitted, key, epochs));
      }

      /*
       * WAS ER NOCH TUN MUSS (0047). Die von Hand angelegten Schritte liegen
       * unter dem Schlüssel des Formulars — wie seine Fragen, und auf
       * demselben Weg geholt; einer aus einer Epoche, die dieser Browser
       * nicht liest, bleibt ohne Beschriftung, aber er steht da.
       */
      const stepKeys = new Map<string, Uint8Array>();
      for (const one of (found.forms ?? []).flatMap((f) => f.steps)) {
        const slot = `${one.areaId}:${one.epoch}`;
        if (stepKeys.has(slot)) continue;

        const stepKey = await reader.key(one.areaId, one.epoch);
        if (stepKey !== undefined) stepKeys.set(slot, stepKey);
      }

      const opened: SeatForm[] = [];
      for (const form of found.forms ?? []) {
        opened.push({
          ...form,
          steps: await openSteps(form.steps, (areaId, epoch) => stepKeys.get(`${areaId}:${epoch}`))
        });
      }
      setForms(opened);

      /*
       * Das Gemeinsame. Der Klassenschlüssel steckt im Platz; das Token sagt
       * dem Dienst, welche Bereiche er herausgeben darf — der Schlüssel selbst
       * geht nie hinaus.
       */
      const keys = await openGrants(found.grants, key);
      const rows: Shared[] = [];

      /*
       * 0091 — UND WAS SEINE ROLLE AUFSCHLIESST (die seines Formulars): ihre
       * Bereiche mit ihren Kalendern, wie die Klasse. Schon gezeigte Bereiche
       * kommen nicht doppelt.
       */
      const viaRoles = await openSeatRoles(found.seatId, key, found.roles).catch(() => null);
      const fromRoles = (viaRoles?.areas ?? []).filter((a) => !found.grants.some((g) => g.areaId === a.areaId));
      if (fromRoles.length > 0) setSharedNames([...found.grants.map((g) => g.areaName), ...fromRoles.map((a) => a.name)]);

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

      for (const area of fromRoles) {
        const epochs = viaRoles?.areaKeys.get(area.areaId);
        if (epochs === undefined) continue;
        for (const calendar of area.calendars) {
          let days;
          try { days = await loadPublic(calendar.calendarId, from, to, undefined, token); }
          catch { continue; }

          for (const one of days.occurrences) {
            /* Ein Titel liegt unter der Epoche, in der er entstand — die Rolle hat sie alle, seit sie dabei ist. */
            const sealedTitle = one.fields.find((f) => f.field === 'title');
            const roleKey = sealedTitle === undefined ? undefined : epochs.get(sealedTitle.epoch);
            rows.push({ name: area.name, when: one.startsAt, what: roleKey === undefined ? one.titlePublic : await titleOf(one, roleKey) });
          }
        }
      }

      rows.sort((a, b) => a.when.localeCompare(b.when));
      setShared(rows);
    } catch (e) {
      setChallenge(null);
      setPortal(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć.');
    }
  }, [token, keyText]);

  useEffect(() => { void look(); }, [look]);

  /* Stabil — wer es in eine Abhängigkeitsliste schreibt, soll nicht bei jedem Zeichnen neu rechnen. */
  const reload = useCallback(() => { void look(); }, [look]);

  const seat: SeatView | null = portal === undefined || portal === null ? null : {
    token,
    seatId: portal.seatId,
    seatKey,
    recipientName: portal.recipientName,
    note,
    submitted: portal.submitted,
    opened: mine,
    forms,
    shared,
    sharedNames,
    expiresAt: portal.expiresAt,
    reload
  };

  return { portal, failed, seat, challenge, reload };
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
