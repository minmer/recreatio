/**
 * Die Person: ein Steckbrief aus EINZELN verschlüsselten Angaben.
 *
 * <b>Warum es hier keine Tabelle `rc_person` gibt.</b> Ein Steckbrief als Zeile
 * wäre EIN Geheimtext für vier Angaben — und damit unteilbar. Genau das ist der
 * Punkt, an dem „gib ihm nur meine Telefonnummer" unmöglich wird: entweder er
 * bekommt den Schlüssel und sieht alles, oder er bekommt keinen und sieht
 * nichts.
 *
 * Deshalb ist jede Angabe ein eigenes Datenelement (`rc_data_item`) mit einem
 * eigenen Schlüssel, das an der Rolle der Person hängt. Freigeben heißt dann
 * genau das, wonach es klingt: EINEN Schlüssel weiterreichen, für EINE Angabe.
 *
 * Das ist derselbe Mechanismus, den die Plattform schon für personenbezogene
 * Daten benutzt (12.3.2, 12.9) — mit Protokollpflicht und mit Löschung durch
 * Schlüsselvernichtung. Ein zweiter, eigener Weg für Personen wäre ein zweiter
 * Weg, der dieselben Pflichten noch einmal erfüllen müsste.
 */

import { rcFetch } from './rcApi';
import type { RcApi } from './rcApi';

export type RcDataValues = RcApi<'RcDataValuesResponse'>;
export type RcDataValue = RcApi<'DataItemsDataValueView'>;
export type RcDataItems = RcApi<'RcDataItemsResponse'>;
export type RcAccountMap = RcApi<'RcAccountMapResponse'>;
export type RcMapNode = RcApi<'AccountMapNodeView'>;
export type RcMapEdge = RcApi<'AccountMapEdgeView'>;

/**
 * Die vier Angaben eines Steckbriefs, in der Reihenfolge, in der sie auf der
 * Seite stehen.
 *
 * Die Namen sind die der serverseitigen Aufzählung `RcField` — sie werden
 * NICHT frei getippt, sondern hier einmal festgehalten. Ein Tippfehler wäre
 * sonst ein stillschweigend anderes Etikett (3.13), und der Geheimtext ginge
 * Monate später nicht mehr auf.
 */
export const RC_PERSON_FIELDS = [
  'PersonGivenName',
  'PersonSurname',
  'PersonPhone',
  'PersonBorn'
] as const;

export type RcPersonField = (typeof RC_PERSON_FIELDS)[number];

/**
 * Felder, die MEHRFACH vorkommen dürfen.
 *
 * Ein Mensch hat einen Geburtstag und in aller Regel einen Vornamen, aber er
 * hat eine Handynummer, eine im Pfarrbüro und vielleicht noch die vom
 * Festnetz. Ein einzelnes Feld dafür zwänge dazu, alle drei in eine Zeile zu
 * schreiben — und dann ist es EIN Datenelement mit EINEM Schlüssel, und die
 * dienstliche Nummer lässt sich nicht mehr weitergeben, ohne die private
 * mitzugeben. Genau das, was die einzelne Verschlüsselung verhindern soll.
 *
 * Die Datenbank erlaubt es ohnehin: es gibt keinen Eindeutigkeitsschlüssel auf
 * (`owner_role_id`, `aad_field`). Was fehlte, war die Ansicht.
 */
export const RC_PERSON_REPEATABLE: readonly RcPersonField[] = ['PersonPhone'];

export const rcRepeats = (field: RcPersonField): boolean =>
  RC_PERSON_REPEATABLE.includes(field);

/**
 * Alle vier sind `personal` (12.9): protokollpflichtig, freigebbar, kein Zweck
 * beim Lesen nötig.
 *
 * Ein Geburtsdatum ist keine besondere Kategorie nach Art. 9 — es gehört nicht
 * zu Gesundheit, Herkunft oder Überzeugung. `special` wäre hier also nicht
 * strenger, sondern falsch: es verlangte bei jedem Blick einen Zweck und
 * machte die Seite unbenutzbar, ohne irgendetwas zu schützen.
 */
export const RC_PERSON_CLASS = 'personal';

/** Ist dieses Feld eines des Steckbriefs? */
export const rcIsPersonField = (field: string): field is RcPersonField =>
  (RC_PERSON_FIELDS as readonly string[]).includes(field);

// -- Der Graph des Kontos -----------------------------------------------------

export const rcAccountMap = () =>
  rcFetch<RcAccountMap>('/account/map', { withUnlock: true });

// -- Die Angaben --------------------------------------------------------------

export const rcDataValues = (roleId: string) =>
  rcFetch<RcDataValues>(`/data/values?roleId=${encodeURIComponent(roleId)}`, { withUnlock: true });

export const rcCreateData = (
  ownerRoleId: string, field: RcPersonField, value: string
) =>
  rcFetch<RcApi<'RcDataItemCreatedResponse'>>('/data', {
    body: { ownerRoleId, dataClass: RC_PERSON_CLASS, field, value, module: 'person', objectType: 'person' },
    withUnlock: true
  });

export const rcUpdateData = (dataItemId: string, value: string) =>
  rcFetch<RcApi<'RcDataItemUpdatedResponse'>>(`/data/${dataItemId}`, {
    body: { value }, withUnlock: true
  });

/** Freigeben: derselbe Elementschlüssel, unter dem Verpackungsschlüssel der anderen Rolle. */
export const rcShareData = (dataItemId: string, toRoleId: string) =>
  rcFetch<RcApi<'RcDataSharedResponse'>>(`/data/${dataItemId}/share`, {
    body: { toRoleId }, withUnlock: true
  });

/** 12.3.2 — Löschen heisst hier: alle Schlüssel dazu vernichten. */
export const rcDestroyData = (dataItemId: string, reason?: string) =>
  rcFetch<RcApi<'RcDataDestroyedResponse'>>(`/data/${dataItemId}/destroy`, {
    body: { reason }, withUnlock: true
  });

export const rcDataAccessLog = (dataItemId: string) =>
  rcFetch<RcApi<'RcAccessLogResponse'>>(`/data/${dataItemId}/access-log`, { withUnlock: true });
