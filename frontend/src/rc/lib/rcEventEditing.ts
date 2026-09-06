/**
 * Was am Bauplan einer Veranstaltung geaendert wird — und was Teilnehmer
 * beitragen.
 *
 * Getrennt von `rcEvents.ts`, weil das dort Gewachsene das LESEN und ANLEGEN
 * traegt. Hier steht, was danach kommt: umbenennen, umsortieren, entfernen,
 * hochladen, abhaken, fragen. Eine Datei mit vierzig Aufrufen ist keine Datei
 * mehr, sondern ein Verzeichnis mit Zeilennummern.
 */

import { rcFetch, type RcApi } from './rcApi';

// -- Bauplan ------------------------------------------------------------------

/**
 * Die Veranstaltung selbst.
 *
 * <b>Die Adresse steht nicht dabei.</b> Sie ist oeffentlich und bleibt: sie
 * steht auf dem Plakat, in der Nachricht, an der Tuer. Sie hier nebenbei
 * aenderbar zu machen hiesse, dass ein Tippfehler im Titel zur Gelegenheit
 * wird, jeden dieser Verweise abzureissen.
 */
export const rcUpdateEvent = (
  eventId: string,
  body: {
    title: string;
    summary?: string | null;
    category?: string | null;
    audience?: string | null;
    placesJson?: string | null;
    thumbnailUrl?: string | null;
    dateLabel?: string | null;
    startsUtc?: string | null;
    endsUtc?: string | null;
    isPublic?: boolean;
  }
) =>
  rcFetch<RcApi<'RcEventUpdatedResponse'>>(`/events/${eventId}/update`, { body, withUnlock: true });

export const rcUpdatePage = (
  pageId: string, body: { title: string; isVisible?: boolean }
) =>
  rcFetch<RcApi<'RcEventPageUpdatedResponse'>>(`/event-pages/${pageId}/update`, { body, withUnlock: true });

export const rcDeletePage = (pageId: string) =>
  rcFetch<RcApi<'RcEventDeletedResponse'>>(`/event-pages/${pageId}/delete`, { body: {}, withUnlock: true });

export const rcDeletePart = (partId: string) =>
  rcFetch<RcApi<'RcEventDeletedResponse'>>(`/event-parts/${partId}/delete`, { body: {}, withUnlock: true });

export const rcUpdateField = (
  fieldId: string,
  body: {
    label: string;
    helpText?: string | null;
    isRequired?: boolean;
    isHalfWidth?: boolean;
    optionsJson?: string | null;
  }
) =>
  rcFetch<RcApi<'RcEventFieldUpdatedResponse'>>(`/event-fields/${fieldId}/update`, { body, withUnlock: true });

export const rcDeleteField = (fieldId: string) =>
  rcFetch<RcApi<'RcEventDeletedResponse'>>(`/event-fields/${fieldId}/delete`, { body: {}, withUnlock: true });

/*
  DIE REIHENFOLGE GEHT VOLLSTAENDIG HIN, NICHT ALS „SCHIEBE DIESES HOCH".

  Zwei Leute, die gleichzeitig schieben, erzeugten damit eine Reihenfolge, die
  keiner von beiden wollte. Die Liste sagt, wie es NACHHER aussieht, und wer sie
  schickt, hat den Stand gesehen.

  Und sie ist die ADRESSE: `/event/recreatio/kal26/3` meint den dritten Teil,
  nicht einen bestimmten. Umsortieren verschiebt also, wohin ein verschickter
  Link fuehrt.
*/
export const rcReorderPages = (eventId: string, ids: readonly string[]) =>
  rcFetch<RcApi<'RcEventReorderedResponse'>>(`/events/${eventId}/pages/reorder`,
    { body: { ids }, withUnlock: true });

export const rcReorderParts = (pageId: string, ids: readonly string[]) =>
  rcFetch<RcApi<'RcEventReorderedResponse'>>(`/event-pages/${pageId}/parts/reorder`,
    { body: { ids }, withUnlock: true });

export const rcReorderFields = (partId: string, ids: readonly string[]) =>
  rcFetch<RcApi<'RcEventReorderedResponse'>>(`/event-parts/${partId}/fields/reorder`,
    { body: { ids }, withUnlock: true });

// -- Bilder und Dateien -------------------------------------------------------

export type RcEventPhoto = RcApi<'RcEventPhotosResponse'>['photos'][number];
export type RcEventDocument = RcApi<'RcEventDocumentsResponse'>['documents'][number];

export const rcEventPhotos = (partId: string) =>
  rcFetch<RcApi<'RcEventPhotosResponse'>>(`/event-parts/${partId}/photos`, { withUnlock: true });

/**
 * Ein Bild hochladen.
 *
 * <b>Breite und Hoehe reisen mit</b>, aus dem Browser gemessen. Ohne sie muss
 * die Galerie jedes Bild erst laden, um zu wissen, wie hoch seine Kachel wird —
 * und springt beim Laden jedes einzelnen. Der Dienst koennte sie ausrechnen,
 * muesste das Bild dafuer aber entschluesseln und dekodieren; er hat den
 * Schluessel im Moment des Hochladens ohnehin nicht mehr als noetig.
 */
export const rcUploadPhoto = (
  partId: string,
  file: File,
  extra: { caption?: string; uploaderName?: string; width?: number; height?: number } = {}
) => {
  const form = new FormData();
  form.append('file', file);
  if (extra.caption !== undefined) form.append('caption', extra.caption);
  if (extra.uploaderName !== undefined) form.append('uploaderName', extra.uploaderName);
  if (extra.width !== undefined) form.append('width', String(extra.width));
  if (extra.height !== undefined) form.append('height', String(extra.height));

  return rcFetch<RcApi<'RcEventPhotoUploadedResponse'>>(
    `/event-parts/${partId}/photos`, { body: form, withUnlock: true });
};

export const rcDeletePhoto = (photoId: string) =>
  rcFetch<RcApi<'RcEventDeletedResponse'>>(`/event-photos/${photoId}/delete`, { body: {}, withUnlock: true });

export const rcEventDocuments = (eventId: string) =>
  rcFetch<RcApi<'RcEventDocumentsResponse'>>(`/events/${eventId}/documents`, { withUnlock: true });

export const rcUploadDocument = (eventId: string, file: File, label?: string) => {
  const form = new FormData();
  form.append('file', file);
  if (label !== undefined) form.append('label', label);

  return rcFetch<RcApi<'RcEventDocumentUploadedResponse'>>(
    `/events/${eventId}/documents`, { body: form, withUnlock: true });
};

export const rcDeleteDocument = (documentId: string) =>
  rcFetch<RcApi<'RcEventDeletedResponse'>>(`/event-documents/${documentId}/delete`, { body: {}, withUnlock: true });

/**
 * Die Adresse des Inhalts.
 *
 * <b>Kein `<img src>`.</b> Der Dienst liefert IMMER als Anhang und immer als
 * `octet-stream` — sonst fuehrte ein als Bild angekuendigtes HTML im Ursprung
 * dieser Seite aus. Wer das Bild zeigen will, holt es und macht daraus eine
 * Objekt-Adresse; `rcPhotoBlobUrl` tut genau das.
 */
export const rcMediaContentPath = (mediaId: string) => `/event-media/${mediaId}/content`;

// -- Beitraege der Teilnehmer -------------------------------------------------

export type RcRosterCell = RcApi<'RcEventRosterResponse'>['cells'][number];

export const rcEventRoster = (partId: string) =>
  rcFetch<RcApi<'RcEventRosterResponse'>>(`/event-parts/${partId}/roster`, { withUnlock: true });

/** Ein leerer Wert LOESCHT die Zelle — „nie gesetzt" und „zurueckgenommen" sind zweierlei. */
export const rcMarkRoster = (
  partId: string, body: { rowKey: string; code: string; value: string | null; by?: string }
) =>
  rcFetch<RcApi<'RcEventRosterMarkedResponse'>>(`/event-parts/${partId}/roster`,
    { body: { ...body, value: body.value ?? '' }, withUnlock: true });

/*
  Der Beleg reist im RUMPF, auch beim Lesen. In einer Adresse stuende er im
  Verlauf des Browsers, im Verweis der naechsten Seite und im Protokoll jedes
  Zwischenservers — dieselbe Entscheidung wie bei `rcClaimRegistration`.
*/
export const rcEventProgress = (partId: string, claim: string) =>
  rcFetch<RcApi<'RcEventProgressResponse'>>(`/event-parts/${partId}/progress`, { body: { claim } });

export const rcSetProgress = (partId: string, claim: string, itemKey: string, done: boolean) =>
  rcFetch<RcApi<'RcEventProgressResponse'>>(`/event-parts/${partId}/progress/set`,
    { body: { claim, itemKey, done } });

export type RcEventCard = RcApi<'RcEventCardsResponse'>['cards'][number];

/**
 * Die Karte abgeben — FERTIG VERSCHLOSSEN.
 *
 * Der Browser wuerfelt einen Sitzungsschluessel, verschliesst damit die Karte
 * und verpackt den Schluessel mit dem oeffentlichen Annahmeschluessel der
 * Veranstaltung. Der Dienst legt Bytes ab, die er nicht oeffnen kann — genau
 * wie bei einer Anmeldung, und aus demselben Grund: hier stehen Ernaehrung,
 * Unvertraeglichkeit, Medikamente.
 */
export const rcSubmitCard = (
  partId: string,
  body: {
    claim: string;
    dataSealed: string;
    consentsSealed?: string | null;
    sessionKeyWrapped: string;
    clauseText?: string | null;
    isMinor?: boolean;
    signerRole?: 'participant' | 'guardian';
  }
) => rcFetch<RcApi<'RcEventCardSubmittedResponse'>>(`/event-parts/${partId}/card`, { body });

/** Die Karten, VERSIEGELT wie sie liegen. Geoeffnet wird im Browser. */
export const rcEventCards = (partId: string) =>
  rcFetch<RcApi<'RcEventCardsResponse'>>(`/event-parts/${partId}/cards`, { withUnlock: true });

export type RcEventTopic = RcApi<'RcEventTopicsResponse'>['topics'][number];

export const rcEventTopics = (partId: string) =>
  rcFetch<RcApi<'RcEventTopicsResponse'>>(`/event-parts/${partId}/topics`, { withUnlock: true });

export const rcAskTopic = (
  partId: string, body: { claim: string; authorName?: string; title: string; body: string }
) => rcFetch<RcApi<'RcEventTopicCreatedResponse'>>(`/event-parts/${partId}/topics`, { body });

export const rcEventTopic = (topicId: string) =>
  rcFetch<RcApi<'RcEventTopicResponse'>>(`/event-topics/${topicId}`, { withUnlock: true });

/**
 * Antworten — als Teilnehmer mit Beleg, oder als Verwaltung mit Konto.
 *
 * `withUnlock` reist mit, damit der Dienst eine Antwort der Verwaltung als
 * solche erkennt. Ohne Konto ist das kein Fehler: dann zaehlt der Beleg.
 */
export const rcReplyTopic = (
  topicId: string, body: { claim?: string; authorName?: string; body: string }
) => rcFetch<RcApi<'RcEventTopicRepliedResponse'>>(`/event-topics/${topicId}/messages`,
  { body, withUnlock: true });

export const rcModerateTopic = (topicId: string, status: 'open' | 'answered' | 'hidden') =>
  rcFetch<RcApi<'RcEventTopicModeratedResponse'>>(`/event-topics/${topicId}/moderate`,
    { body: { status }, withUnlock: true });
