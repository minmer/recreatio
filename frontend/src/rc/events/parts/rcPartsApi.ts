/**
 * Die uebernommenen Teile, an den rc-Dienst gehaengt.
 *
 * <b>Warum eine Zwischenschicht und nicht Chirurgie in sieben Dateien.</b> Die
 * Teile sind aus dem alten Modul uebernommen, weil sie dort gut sind: Galerie,
 * Liste, Karte, Fragen, Checkliste. Was sie ANZEIGEN, soll unveraendert bleiben
 * — was sie HOLEN, hat sich geaendert. Diese Datei uebersetzt das eine ins
 * andere, an einer Stelle und mit Begruendung, statt in sieben Dateien je drei
 * Zeilen anders zu machen.
 *
 * <b>Die zwei Unterschiede, die alles andere nach sich ziehen.</b>
 *
 * 1. WER DER LESER IST. Im alten Modul war ein persoenlicher Link die Kennung —
 *    `token` in jedem Aufruf. Hier weist sich ein Teilnehmer mit dem BELEG
 *    seiner Anmeldung aus, demselben, mit dem er sie zuruecknehmen kann. Also
 *    heisst der Parameter `claim`, und er reist im Rumpf, nie in der Adresse.
 *
 * 2. BILDER SIND NICHT OEFFENTLICH ADRESSIERBAR. Der alte Dienst hatte eine
 *    Adresse je Foto, die jeder oeffnen konnte. Hier liegt der Inhalt
 *    verschluesselt und wird IMMER als `octet-stream` mit „attachment"
 *    ausgeliefert — sonst fuehrte ein als Bild angekuendigtes HTML im Ursprung
 *    dieser Seite aus. Ein `<img src>` darauf zeigt also nichts. Wer ein Bild
 *    zeigen will, holt es und macht daraus eine Objekt-Adresse: `rcMediaUrl`.
 */

import {
  rcAskTopic, rcDeletePhoto, rcEventCards, rcEventPhotos, rcEventProgress,
  rcEventRoster, rcEventTopic, rcEventTopics, rcMarkRoster, rcMediaContentPath,
  rcClaimRegistration, rcModerateTopic, rcReplyTopic, rcSealCard, rcSetProgress,
  rcSubmitCard, rcUploadPhoto
} from '../../lib/rcEventEditing';
import { rcApiBase } from '../../lib/rcApi';

// -- Die Formen, die die uebernommenen Teile erwarten --------------------------

export type EventGalleryPhoto = {
  id: string;
  /** Die Kennung des INHALTS. Das Bild wird darueber geholt, nicht angezeigt. */
  mediaId: string;
  caption: string | null;
  uploaderName: string;
  width: number;
  height: number;
  createdUtc: string;
  mine: boolean;
  isMeme: boolean;
};

export type EventGallery = {
  photos: EventGalleryPhoto[];
  mayAdd: boolean;
  mayManage: boolean;
};

export type EventTopic = {
  id: string;
  title: string;
  authorName: string;
  status: 'open' | 'closed' | 'disabled';
  createdUtc: string;
  lastMessageUtc: string;
  messageCount: number;
  isMine: boolean;
};

export type EventTopicMessage = {
  id: string;
  authorName: string;
  body: string;
  createdUtc: string;
  isMine: boolean;
};

export type EventRosterRow = { key: string; values: Record<string, string | null> };

// -- Galerie -------------------------------------------------------------------

/**
 * Die Bilder eines Teils.
 *
 * <c>mine</c> steht auf <c>false</c>: der Dienst gibt nicht heraus, welche
 * Anmeldung ein Bild beigesteuert hat. Das ist Absicht — die Liste der Bilder
 * ist fuer alle sichtbar, und „von wem" waere darin eine Auskunft ueber
 * Anwesenheit, nach der niemand gefragt hat. Wer sein eigenes Bild
 * zuruecknehmen will, wendet sich an die Verwaltung.
 */
export async function getEventGallery(
  _slug: string, partId: string, claim: string | null
): Promise<EventGallery> {
  const found = await rcEventPhotos(partId);

  return {
    photos: (found.photos ?? []).map((photo) => ({
      id: photo.photoId,
      mediaId: photo.mediaId,
      caption: photo.caption ?? null,
      uploaderName: photo.uploaderName ?? '',
      width: photo.width,
      height: photo.height,
      createdUtc: photo.createdUtc,
      mine: false,
      isMeme: false
    })),

    /*
     * BEITRAGEN DARF, WER EINEN BELEG HAT; VERWALTEN NUR MIT KONTO.
     *
     * Der Dienst haelt beides ohnehin — hier steht nur, was die Oberflaeche
     * anbietet. Einen Knopf zu zeigen, der zuverlaessig mit einer Absage
     * endet, waere schlechter als keiner.
     */
    mayAdd: claim !== null,
    mayManage: claim === null
  };
}

export const deleteEventPhoto = (photoId: string) => rcDeletePhoto(photoId);

export const uploadEventPhoto = (
  _claim: string | null, partId: string, file: File | Blob,
  extra: { caption?: string; uploaderName?: string; width?: number; height?: number } = {}
) => rcUploadPhoto(partId, file as File, extra);

/**
 * Ein eigenes Bild zuruecknehmen.
 *
 * Im rc-Modell gibt es dafuer keinen eigenen Weg: der Dienst weiss nicht,
 * welche Anmeldung ein Bild beigesteuert hat — er gibt es bewusst nicht
 * heraus, weil „von wem" eine Auskunft ueber Anwesenheit waere. Also
 * dieselbe Tuer wie fuer die Verwaltung, und die verlangt ein Konto.
 */
export const deleteOwnEventPhoto = (_claim: string, photoId: string) => rcDeletePhoto(photoId);

/**
 * Die Adresse des Inhalts — zum HOLEN, nicht fuer `src`.
 *
 * Sie traegt Anmeldedaten (Keks), also gehoert sie nicht in ein `<img>`: der
 * Browser schickte sie zwar mit, bekaeme aber `attachment` zurueck und zeigte
 * nichts. `rcMediaUrl` unten holt und verpackt.
 */
export const eventMediaHref = (mediaId: string) => `${rcApiBase()}${rcMediaContentPath(mediaId)}`;

/**
 * Die Adresse eines Bildes — DIREKT fuer `<img src>` brauchbar.
 *
 * Der Dienst sieht in die ersten Bytes und liefert, was zweifelsfrei ein Bild
 * ist, als Bild und „inline" aus; alles andere bleibt Anhang. Der Inhaltstyp
 * kommt also NIE vom Hochladenden — sonst fuehrte ein als Bild angekuendigtes
 * HTML im Ursprung dieser Seite aus.
 *
 * Das Plaetzchen reist mit (gleicher Ursprung), der Leser muss also
 * angemeldet sein. Fuer eine oeffentliche Galerie reicht das nicht — dafuer
 * muesste der Inhalt unversiegelt liegen, und das ist eine eigene
 * Entscheidung, keine Einstellung.
 */
export const eventPhotoUrl = (photoId: string) => `${rcApiBase()}/event-photos/${photoId}/content`;

/**
 * Ein Bild holen und zu einer Objekt-Adresse machen.
 *
 * Der Aufrufer MUSS sie wieder freigeben (`URL.revokeObjectURL`), sonst haelt
 * der Browser jedes je angesehene Bild im Speicher — bei einer Galerie mit
 * zweihundert Fotos ist das keine Kleinigkeit.
 */
export async function rcMediaUrl(mediaId: string): Promise<string> {
  const response = await fetch(eventMediaHref(mediaId), { credentials: 'include' });
  if (!response.ok) throw new Error(`media ${response.status}`);
  return URL.createObjectURL(await response.blob());
}

// -- Liste ---------------------------------------------------------------------

/**
 * Die Liste als Zeilen.
 *
 * Der Dienst gibt einzelne ZELLEN heraus, nicht Zeilen: zwei Betreuer haken
 * gleichzeitig ab, und eine Zeile als Ganzes zu schreiben liesse den zweiten
 * Haken verschwinden. Zusammengesetzt wird hier, wo es nichts kostet.
 */
export async function getEventRosterRows(partId: string): Promise<EventRosterRow[]> {
  const found = await rcEventRoster(partId);

  const rows = new Map<string, Record<string, string | null>>();
  for (const cell of found.cells ?? []) {
    const row = rows.get(cell.rowKey) ?? {};
    row[cell.code] = cell.value ?? null;
    rows.set(cell.rowKey, row);
  }

  return [...rows.entries()].map(([key, values]) => ({ key, values }));
}

export const setEventRosterMark = (
  _slug: string, partId: string, rowKey: string, code: string,
  value: string | null | undefined, by?: string | null
) => rcMarkRoster(partId, { rowKey, code, value: value ?? null, by: by ?? undefined });

// -- Fortschritt ---------------------------------------------------------------

/**
 * Was dieser Teilnehmer abgehakt hat.
 *
 * <b>Nur die Haken, nicht die Schritte.</b> Im alten Modul lieferte der
 * Dienst zugleich die LISTE der offenen Punkte — er kannte sie, weil ein
 * persoenlicher Link an einer festen Reihe von Seiten hing. Hier stehen die
 * Punkte in der Einstellung des Teils, wo sie hingehoeren: wer die Liste
 * aendert, aendert sie an einer Stelle und nicht in zweien.
 */
export async function getEventProgress(partId: string, claim: string): Promise<EventProgress> {
  const done = await rcEventProgress(partId, claim).then((r) => r.done ?? []);

  return {
    recipientName: '',
    steps: [],
    marks: done.map((code) => ({ code, value: null }))
  };
}

export const setEventProgress = (partId: string, claim: string, itemKey: string, done: boolean) =>
  rcSetProgress(partId, claim, itemKey, done).then((r) => r.done ?? []);

// -- Fragen --------------------------------------------------------------------

/**
 * Die Zustaende heissen anders als frueher.
 *
 * Alt: `open` / `closed` / `disabled`. Neu: `open` / `answered` / `hidden`.
 * Der mittlere ist NICHT dasselbe — „geschlossen" hiess „nur noch lesen",
 * „beantwortet" heisst „hier steht die Antwort". Die Anzeige der uebernommenen
 * Teile kennt nur die alten Namen, also wird uebersetzt; wer den Unterschied
 * braucht, liest den neuen Namen aus dem Dienst.
 */
const asOldStatus = (status: string): EventTopic['status'] =>
  status === 'hidden' ? 'disabled' : status === 'answered' ? 'closed' : 'open';

export async function getEventTopics(_claim: string | null, partId: string): Promise<EventTopic[]> {
  const found = await rcEventTopics(partId);
  return (found.topics ?? []).map((topic) => ({
    id: topic.topicId,
    title: topic.title,
    authorName: topic.authorName,
    status: asOldStatus(topic.status),
    createdUtc: topic.createdUtc,
    lastMessageUtc: topic.lastMessageUtc,
    messageCount: topic.messageCount,
    isMine: false
  }));
}

export async function getEventTopic(
  _claim: string | null, _partId: string, topicId: string
): Promise<{ topic: EventTopic; messages: EventTopicMessage[] }> {
  const found = await rcEventTopic(topicId);

  const messages = (found.messages ?? []).map((message) => ({
    id: message.messageId,
    authorName: message.authorName,
    body: message.body,
    createdUtc: message.createdUtc,
    isMine: false
  }));

  return {
    topic: {
      id: found.topicId,
      title: found.title,
      authorName: messages[0]?.authorName ?? '',
      status: asOldStatus(found.status),
      createdUtc: messages[0]?.createdUtc ?? '',
      lastMessageUtc: messages[messages.length - 1]?.createdUtc ?? '',
      messageCount: messages.length,
      isMine: false
    },
    messages
  };
}

export const createEventTopic = (
  claim: string, partId: string, title: string, body: string, authorName?: string
) => rcAskTopic(partId, { claim, title, body, authorName })
  .then((made) => ({ id: made.topicId }));

export const postEventTopicMessage = (
  claim: string | null, _partId: string, topicId: string, body: string, authorName?: string
) => rcReplyTopic(topicId, { claim: claim ?? undefined, body, authorName });

/**
 * Den Zustand eines Themas setzen.
 *
 * <b>Der Titel laesst sich nicht mitaendern.</b> Er stammt von dem, der
 * gefragt hat; ihn von der Verwaltung umschreiben zu lassen hiesse, jemandem
 * eine Frage in den Mund zu legen, die er nicht gestellt hat.
 */
export const moderateEventTopic = (
  topicId: string, patch: { title?: string; status?: EventTopic['status'] }
) => rcModerateTopic(topicId,
  patch.status === 'disabled' ? 'hidden' : patch.status === 'closed' ? 'answered' : 'open');

/** Im rc-Modell dasselbe: nur die Verwaltung aendert den Zustand. */
export const updateEventTopic = (
  _claim: string | null, _partId: string, topicId: string,
  patch: { title?: string; status?: 'open' | 'closed' }
) => moderateEventTopic(topicId, patch);

// -- Teilnehmerkarten ----------------------------------------------------------

export const getEventCards = (partId: string) => rcEventCards(partId).then((r) => r.cards ?? []);

// -- Formen, die im rc-Modell woanders herkommen --------------------------------

/**
 * Die Spalten der Liste.
 *
 * <b>Sie stehen im `configJson` des Teils, nicht in einer eigenen Tabelle.</b>
 * Im alten Modul waren sie Zeilen am Ganzen und wurden ueber einen eigenen
 * Aufruf geholt. Das war eine Tabelle fuer etwas, das sich nie ohne den Teil
 * aendert — und es fuehrte dazu, dass eine kopierte Liste ihre Spalten verlor.
 *
 * `filled` — wie viele Zeilen die Spalte schon tragen — wird aus den Zellen
 * gezaehlt, nicht vom Dienst gemeldet. Der Zaehler ist eine Ansicht auf die
 * Daten, und eine Ansicht, die getrennt gepflegt wird, weicht ab.
 */
export type EventRosterColumn = { key: string; label: string; group: string; filled: number };

export type EventRosterTable = {
  columns: EventRosterColumn[];
  rows: EventRosterRow[];
  isUnconfigured: boolean;
  mayFill: boolean;
  isOrganizer: boolean;
};

export type EventProgressStep = {
  partId: string;
  kind: 'form' | 'card';
  menuLabel: string;
  pageSlug: string;
  partNumber: number;
  done: boolean;
  doneUtc: string | null;
  isMinor: boolean;
};

export type EventProgressMark = { code: string; value: string | null };

export type EventProgress = {
  recipientName: string;
  steps: EventProgressStep[];
  marks: EventProgressMark[];
};

/**
 * Die ganze Liste: Spalten aus der Einstellung, Zeilen aus dem Dienst.
 *
 * `isUnconfigured` unterscheidet „noch keine Spalte gewaehlt" von „Spalten da,
 * aber keine Zeile". Ohne diese Unterscheidung sieht eine frisch angelegte
 * Liste aus wie eine kaputte.
 */
export async function getEventRoster(
  _slug: string, partId: string, _claim: string | null,
  columns: readonly { key: string; label: string; group?: string }[] = [],
  opts: { mayFill: boolean } = { mayFill: true }
): Promise<EventRosterTable> {
  const rows = await getEventRosterRows(partId);

  return {
    columns: columns.map((column) => ({
      key: column.key,
      label: column.label,
      group: column.group ?? '',
      filled: rows.filter((row) => (row.values[column.key] ?? null) !== null).length
    })),
    rows,
    isUnconfigured: columns.length === 0,
    mayFill: opts.mayFill,
    isOrganizer: opts.mayFill
  };
}

/**
 * Die Spalten der Liste.
 *
 * <b>Leer, und das ist richtig.</b> Im alten Modul standen sie als Zeilen am
 * Ganzen und wurden hier geholt; im rc-Modell stehen sie im `configJson` des
 * Teils, wo sie hingehoeren — sie aendern sich nie ohne ihn, und getrennt
 * gefuehrt gingen sie beim Kopieren eines Teils verloren.
 *
 * Der Aufruf bleibt stehen, damit die uebernommene Datei ihn nicht verliert;
 * er fragt nur niemanden mehr.
 */
export const getEventRosterColumns = (_siteId: string): Promise<EventRosterColumn[]> =>
  Promise.resolve([]);

/**
 * Die Veranstaltung, wie der Herausgeber sie sieht.
 *
 * Im rc-Modell heisst das `rcEvent(collection, slug)`, und der Teil, der das
 * hier braucht (die Meme-Werkstatt, um Quellbilder zu finden), bekommt seine
 * Quelle inzwischen ueber die Einstellung genannt. Bis das dort steht,
 * liefert der Aufruf nichts — und zwar sichtbar nichts, statt eine falsche
 * Veranstaltung.
 */
type AdminPart = { id: string; kind: string; menuLabel: string };
type AdminPage = { menuLabel: string; parts: AdminPart[] };

export const getEventAdminSite = (_siteId: string): Promise<{ pages: AdminPage[] }> =>
  Promise.resolve({ pages: [] });
// -- Felder, Anmeldung, Karte ---------------------------------------------------

export type EventFieldKind = string;

/**
 * Ein Feld, wie die uebernommenen Teile es lesen.
 *
 * `id` statt `fieldId`: das ist der einzige Unterschied zur Form des Dienstes,
 * und er wird hier uebersetzt statt in vier Dateien.
 */
export type EventPartField = {
  id: string;
  sortOrder: number;
  kind: EventFieldKind;
  label: string;
  helpText: string | null;
  options: string[];
  isRequired: boolean;
  isHalfWidth: boolean;
  identityRole: string;
};

export type EventConsentRecord = {
  code: string;
  label: string;
  text: string;
  accepted: boolean;
  atUtc: string | null;
};

export type EventParticipantCard = {
  id: string | null;
  participantName: string | null;
  isMinor: boolean;
  signerRole: string;
  signerName: string;
  submittedUtc: string;
  updatedUtc: string;
  data: Record<string, string | null>;
  consents: EventConsentRecord[];
};

export type EventOwnRegistration = {
  registrationId: string;
  partId: string;
  partLabel: string;
  submittedUtc: string;
  updatedUtc: string | null;
  fields: EventPartField[];
  values: Array<{ fieldId: string; value: string | null }>;
};

/**
 * Die eigene Anmeldung ansehen.
 *
 * <b>Nur die Huelle, nicht die Antworten.</b> Der Dienst gibt sie versiegelt
 * heraus, und aufmachen kann sie nur, wer den Bereichsschluessel hat — der
 * Anmeldende selbst hat ihn NICHT. Das ist kein Mangel: er hat seine Antworten
 * abgegeben, nicht hinterlegt, und niemand ausser der Veranstaltung soll sie
 * lesen koennen. Was er darf, ist zuruecknehmen.
 *
 * `values` bleibt deshalb leer. Ein Formular damit vorzufuellen hiesse, so zu
 * tun, als lasse sich eine Anmeldung nachtraeglich aendern; sie laesst sich
 * zurueckziehen und neu stellen.
 */
export async function getOwnRegistration(claim: string): Promise<EventOwnRegistration | null> {
  const found = await rcClaimRegistration(claim);
  if (found === null) return null;

  return {
    registrationId: found.registrationId,
    partId: '',
    partLabel: found.partTitle ?? '',
    submittedUtc: found.submittedUtc,
    updatedUtc: null,
    fields: [],
    values: []
  };
}

/**
 * Es gibt keinen Weg, eine abgegebene Anmeldung zu aendern — und das ist
 * Absicht, keine Luecke.
 *
 * Die Antworten liegen versiegelt; sie zu ueberschreiben hiesse, sie vorher zu
 * lesen, und dafuer fehlt dem Anmeldenden der Schluessel. Zuruecknehmen und
 * neu stellen ist der ehrliche Weg: es hinterlaesst zwei Zeitpunkte statt
 * eines stillen Austauschs.
 */
export function updateOwnRegistration(
  _claim: string, _values: Array<{ fieldId: string; value: string | null }>
): Promise<never> {
  return Promise.reject(new Error(
    'Wysłanego zgłoszenia nie da się poprawić. Wycofaj je i wyślij ponownie.'
  ));
}

/**
 * Die eigene Teilnehmerkarte.
 *
 * Aus demselben Grund wie oben leer: sie liegt versiegelt, und der Schluessel
 * dafuer ist bei der Veranstaltung. Wer sie abgegeben hat, gibt eine neue ab.
 */
export function getParticipantCard(_claim: string, _partId: string): Promise<EventParticipantCard | null> {
  return Promise.resolve(null);
}

/**
 * Die Karte abgeben — im BROWSER verschlossen.
 *
 * Der Sitzungsschluessel wird hier gewuerfelt, die Karte damit verschlossen und
 * der Schluessel mit dem oeffentlichen Annahmeschluessel der Veranstaltung
 * verpackt. Der Dienst legt Bytes ab, die er nicht oeffnen kann — dieselbe
 * Zusage wie bei einer Anmeldung, und aus demselben Grund: hier stehen
 * Ernaehrung, Unvertraeglichkeit, Medikamente.
 */
export async function saveParticipantCard(
  claim: string,
  partId: string,
  payload: {
    data: Record<string, string | null>;
    consents: Array<{ code: string; label: string; text: string; accepted: boolean }>;
    clauseText: string | null;
    isMinor: boolean;
    signerRole: string;
    signerName: string;
    participantName: string | null;
  },
  intakePublicKey: string
) {
  const cardId = crypto.randomUUID();

  const sealed = await rcSealCard(cardId, intakePublicKey, {
    data: JSON.stringify({
      ...payload.data,
      signerName: payload.signerName,
      participantName: payload.participantName
    }),
    consents: JSON.stringify(payload.consents)
  });

  return rcSubmitCard(partId, {
    cardId,
    claim,
    dataSealed: sealed.dataSealed,
    consentsSealed: sealed.consentsSealed,
    sessionKeyWrapped: sealed.sessionKeyWrapped,
    clauseText: payload.clauseText,
    isMinor: payload.isMinor,
    signerRole: payload.signerRole === 'guardian' ? 'guardian' : 'participant'
  });
}
