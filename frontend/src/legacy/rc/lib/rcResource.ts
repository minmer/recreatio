/**
 * Belegung — die Browserseite.
 *
 * <b>Warum das kein Kalender ist.</b> Ein Kalendereintrag beantwortet „wann ist
 * dieser MENSCH belegt"; die Belegung beantwortet „ist diese SACHE frei". Der
 * Eigentümer ist ein anderer (eine Rolle gegen ein Zimmer), die Frage ist eine
 * andere, und die öffentliche Projektion ist eine andere. Geteilt wird die
 * Rechnerei — Überschneidungen, Zeitzonen —, nicht das Modell.
 *
 * <b>Die Regel des Moduls, in einem Satz:</b> die ZEIT liegt im Klartext, alles
 * andere nicht. Dieselbe Entscheidung wie im Kalender (`title_public` offen,
 * `title_sealed` versiegelt), hier auf Räume angewandt: wer fragt, erfährt, ob
 * der Juli frei ist — nicht, wer im Juli kommt.
 *
 * <b>Ohne Konto lesbar.</b> Eine Gruppe muss den Juli prüfen können, ohne sich
 * anzumelden. Deshalb trägt `rcFreeBusy` KEIN `withUnlock` — es gibt nichts zu
 * entsperren, weil nichts Verschlüsseltes zurückkommt.
 *
 * <b>Anmerkung zu den Formen.</b> Diese Schnittstellen stehen noch von Hand
 * hier, weil die Endpunkte noch nicht in `rc-openapi.json` stehen. Sobald sie
 * dort sind, treten `RcApi<'…'>`-Verweise an ihre Stelle (15.6) — von Hand
 * nachgebaute Formen sind genau die Stelle, an der eine Umbenennung im Server
 * still zu `undefined` im Browser wird.
 */

import { rcFetch } from './rcApi';
import { rcFromBase64Url, rcToBase64Url } from './rcBase64';
import { rcNewId } from './rcFormat';
import {
  RcField, newSymmetricKey, rcAad, seal, wrapKey, type RcFieldName
} from './rcCrypto';

/** Die drei Zustände aus Abschnitt 4.2. `held` ist der wichtige. */
export const RC_HOLD_STATES = ['free', 'held', 'confirmed'] as const;
export type RcHoldState = (typeof RC_HOLD_STATES)[number];

/**
 * Ein belegter Zeitraum, wie ihn die öffentliche Seite sieht.
 *
 * Es gibt hier absichtlich KEIN Feld für Gruppe, Zweck oder Kontakt. Nicht
 * „leer gelassen", sondern nicht vorhanden: ein Feld, das es gibt, wird
 * irgendwann gefüllt.
 */
export interface RcBusyPeriod {
  readonly from: string;
  readonly to: string;
  readonly state: Exclude<RcHoldState, 'free'>;
}

export interface RcFreeBusyResponse {
  readonly resourceId: string;
  readonly timeZone: string;
  readonly periods: readonly RcBusyPeriod[];
}

/**
 * Was frei und was belegt ist. Ohne Konto, ohne Schlüssel, ohne Sitzung.
 *
 * `from` und `to` sind Tage (`2027-07-01`), keine Zeitpunkte: ein Haus wird
 * nach Nächten belegt, nicht nach Minuten, und eine Uhrzeit in der Antwort
 * wäre eine Genauigkeit, die es nicht gibt.
 */
export const rcFreeBusy = (resourceSlug: string, from: string, to: string) =>
  rcFetch<RcFreeBusyResponse>(
    `/resources/${encodeURIComponent(resourceSlug)}/free-busy`
    + `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

/** Was jemand ins Formular schreibt. Verlässt den Browser NICHT im Klartext. */
export interface RcEnquiryInput {
  readonly groupName: string;
  readonly contactPerson: string;
  readonly contact: string;
  readonly from: string;
  readonly to: string;
  readonly people: number | null;
  readonly groupKind: string;
  readonly note: string;
}

export interface RcEnquirySentResponse {
  readonly enquiryId: string;
  readonly received: boolean;
}

export interface RcResourceView {
  readonly resourceId: string;
  readonly slug: string;
  readonly title: string;
  readonly timeZone: string;
  readonly capacity: number | null;
  readonly intakePublicKey: string | null;
}

/** Was über ein Haus öffentlich bekannt ist — samt Annahmeschlüssel. */
export const rcResourceView = (slug: string) =>
  rcFetch<RcResourceView>(`/resources/${encodeURIComponent(slug)}`);

/**
 * Eine Anfrage einsenden.
 *
 * <b>Versiegelt wird HIER, nicht auf dem Server.</b> Der Weg ist der der
 * Anmeldung von aussen (`rcSubmitRegistration`), nicht der des
 * Kandidatenformulars: dort füllt ein angemeldetes Mitglied mit eigenem
 * Epochenschlüssel aus, hier hält die anfragende Gruppe gar keinen Schlüssel.
 *
 *   1. Einen Sitzungsschlüssel würfeln.
 *   2. Jedes Feld damit versiegeln — je Feld unter EIGENER AAD (3.13), damit
 *      sich die Telefonnummer nicht ins Bemerkungsfeld schieben lässt.
 *   3. Den Sitzungsschlüssel unter dem öffentlichen Annahmeschlüssel verpacken.
 *   4. Beides schicken. Der Dienst kann keines von beiden öffnen.
 *
 * Die Kennung muss VOR dem Versiegeln feststehen — sie steckt in jeder AAD.
 * Sie wird deshalb hier gewürfelt und mitgeschickt.
 *
 * <b>Was im Klartext bleibt, und warum:</b> Anfang, Ende und Personenzahl.
 * Ohne sie liesse sich eine Anfrage keinem Zeitraum zuordnen, und der Hausherr
 * müsste jede einzelne öffnen, um zu wissen, ob sie ihn angeht. Das ist
 * dieselbe Grenze wie im ganzen Modul: die Zeit ist nicht der Inhalt.
 */
export async function rcSendEnquiry(
  resourceSlug: string,
  intakePublicKeyBase64Url: string,
  input: RcEnquiryInput
): Promise<RcEnquirySentResponse> {
  const enquiryId = rcNewId();
  const sessionKey = newSymmetricKey();
  const encoder = new TextEncoder();

  const sealField = async (value: string, field: RcFieldName): Promise<string | null> => {
    if (value.trim().length === 0) return null;
    const aad = rcAad('resource', 'enquiry', enquiryId, field, 1);
    return rcToBase64Url(await seal(sessionKey, aad, encoder.encode(value.trim())));
  };

  const groupNameSealed = await sealField(input.groupName, RcField.EnquiryGroupName);
  const contactSealed = await sealField(input.contact, RcField.EnquiryContact);

  if (groupNameSealed === null || contactSealed === null) {
    throw new Error('Gruppenname und Kontakt sind Pflicht.');
  }

  // Der verpackte Schlüssel liegt an einem ANDEREN Platz als die Felder: er
  // gehört derselben Anfrage, ist aber ein Schlüssel und keine Angabe. Genau
  // an dieser Stelle sind die beiden Seiten bei den Veranstaltungen einmal
  // auseinandergelaufen — jede für sich schlüssig, und nichts ging auf.
  const wrapAad = rcAad('resource', 'enquiry', enquiryId, RcField.EnquiryIntakeKey, 1);
  const wrapped = await wrapKey(rcFromBase64Url(intakePublicKeyBase64Url), wrapAad, sessionKey);

  return rcFetch<RcEnquirySentResponse>(
    `/resources/${encodeURIComponent(resourceSlug)}/enquiries`, {
      body: {
        enquiryId,
        from: input.from,
        to: input.to,
        people: input.people,
        sessionKeyWrapped: rcToBase64Url(wrapped),
        groupNameSealed,
        contactPersonSealed: await sealField(input.contactPerson, RcField.EnquiryContactPerson),
        contactSealed,
        groupKindSealed: await sealField(input.groupKind, RcField.EnquiryGroupKind),
        noteSealed: await sealField(input.note, RcField.EnquiryNote)
      }
    });
}

// -- Was die Oberfläche wissen muss ------------------------------------------

/** Ein Tag im Monatsraster. */
export interface RcDay {
  readonly date: string;
  readonly state: RcHoldState;
  /** Liegt der Tag ausserhalb des gezeigten Monats? Dann grau, aber sichtbar. */
  readonly outside: boolean;
}

const dayText = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  + `-${String(d.getUTCDate()).padStart(2, '0')}`;

/**
 * Den Monat in Tage auflösen und jeden Tag einfärben.
 *
 * <b>Gerechnet wird in UTC-Mitternacht</b>, nicht in der Zeitzone des Lesers.
 * Ein Tag ist hier ein Kalendertag und kein Zeitpunkt; ihn durch die Zeitzone
 * des Browsers zu schicken verschöbe ihn für jeden Leser anders, und der Plan
 * stimmte für niemanden mehr. Dieselbe Lehre wie beim Messplan.
 */
export function rcMonthDays(
  year: number,
  month: number,
  periods: readonly RcBusyPeriod[]
): readonly RcDay[] {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));

  // Montag als erster Tag der Woche: 0 = Montag … 6 = Sonntag.
  const lead = (first.getUTCDay() + 6) % 7;
  const days: RcDay[] = [];

  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - lead);

  const tail = (7 - ((lead + last.getUTCDate()) % 7)) % 7;
  const total = lead + last.getUTCDate() + tail;

  for (let i = 0; i < total; i += 1) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    const date = dayText(day);

    // Der strengere Zustand gewinnt: liegt ein Tag in einem bestätigten und
    // einem vorgemerkten Zeitraum, ist er bestätigt. Andersherum stünde ein
    // belegter Tag als „vorgemerkt" da, und jemand fragte umsonst an.
    let state: RcHoldState = 'free';
    for (const period of periods) {
      if (date >= period.from && date <= period.to) {
        if (period.state === 'confirmed') { state = 'confirmed'; break; }
        state = 'held';
      }
    }

    days.push({ date, state, outside: day.getUTCMonth() !== month });
  }

  return days;
}

/** Der erste und letzte Tag eines Monats als Text — die Spanne für die Abfrage. */
export function rcMonthRange(year: number, month: number): readonly [string, string] {
  return [
    dayText(new Date(Date.UTC(year, month, 1))),
    dayText(new Date(Date.UTC(year, month + 1, 0)))
  ];
}
