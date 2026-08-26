/**
 * Veranstaltungen im Browser — und der eine Weg, auf dem hier wirklich
 * verschlüsselt wird.
 *
 * Für fast alles auf dieser Plattform versiegelt der Server unter einem
 * Schlüssel, den er nur vom Aufrufer geliehen hat. Bei einer Anmeldung von
 * aussen geht das nicht: der Anmelder hat kein Konto und keinen Schlüssel.
 *
 * Also würfelt DIESER Browser einen Sitzungsschlüssel, versiegelt die Antworten
 * damit und verpackt den Schlüssel unter dem öffentlichen Annahmeschlüssel der
 * Veranstaltung. Der Server bekommt zwei Dinge, die er beide nicht öffnen kann.
 *
 * Das ist die einzige Stelle im Browser-Teil, an der ein Formatfehler still
 * bliebe: die Anmeldung ginge durch, und erst Wochen später — wenn jemand die
 * Liste öffnen will — fiele auf, dass niemand sie mehr lesen kann. Dagegen
 * steht der gemeinsame Testvektor (`npm run rc:test`, `rcWrap.test.ts`).
 */

import { rcFetch, type RcApi } from './rcApi';
import { RcField, newSymmetricKey, rcAad, seal, wrapKey } from './rcCrypto';
import { rcFromBase64Url, rcToBase64Url } from './rcBase64';

export type RcEvent = RcApi<'EventsEventSummary'>;
export type RcEventView = RcApi<'RcEventViewResponse'>;
export type RcEventPage = RcApi<'EventsPageView'>;
export type RcEventPart = RcApi<'EventsPartView'>;
export type RcEventField = RcApi<'EventsFieldView'>;
export type RcRegistration = RcApi<'RegistrationsRegistrationView'>;

export const RC_PART_KINDS = [
  'title', 'shortinfos', 'text', 'plan', 'map', 'faq',
  'form', 'costs', 'contact', 'gallery', 'files', 'people'
] as const;

export const RC_FIELD_KINDS = [
  'text', 'textarea', 'select', 'multiselect', 'checkbox',
  'number', 'date', 'email', 'phone'
] as const;

export type RcPartKind = (typeof RC_PART_KINDS)[number];
export type RcFieldKind = (typeof RC_FIELD_KINDS)[number];

/**
 * 12.9 — Die Klassen, absteigend nach Strenge. Die Vorgabe ist `special`, nicht
 * `normal`: bei einer Anmeldung ist Ernährung, Unverträglichkeit oder
 * Konfession der Normalfall. Wer weniger will, sagt es ausdrücklich — und
 * trifft damit eine Entscheidung, statt in sie hineinzurutschen.
 */
export const RC_DATA_CLASSES = ['normal', 'sensitive', 'special', 'secret'] as const;
export type RcDataClass = (typeof RC_DATA_CLASSES)[number];

// -- Lesen --------------------------------------------------------------------

export const rcEvents = () => rcFetch<RcApi<'RcEventsResponse'>>('/events', { withUnlock: true });

/**
 * Eine Veranstaltung ansehen. OHNE Konto lesbar, wenn sie veröffentlicht und
 * öffentlich ist — das ist der Zweck des ganzen Moduls.
 *
 * `withUnlock` wird trotzdem mitgeschickt: liegt ein Schlüssel bereit, kommen
 * die internen Teile mit. Liegt keiner bereit, ist das kein Fehler.
 */
export const rcEvent = (slug: string) =>
  rcFetch<RcEventView>(`/events/${encodeURIComponent(slug)}`, { withUnlock: true });

// -- Anlegen ------------------------------------------------------------------

export const rcCreateEvent = (
  areaId: string, slug: string, title: string,
  options: { startsUtc?: string; endsUtc?: string; isPublic?: boolean } = {}
) =>
  rcFetch<RcApi<'RcEventCreatedResponse'>>('/events', {
    body: {
      areaId, slug, title,
      startsUtc: options.startsUtc ?? null,
      endsUtc: options.endsUtc ?? null,
      isPublic: options.isPublic ?? true
    },
    withUnlock: true
  });

export const rcAddPage = (eventId: string, slug: string, title: string, sortOrder?: number) =>
  rcFetch<RcApi<'RcEventPageCreatedResponse'>>(`/events/${eventId}/pages`, {
    body: { slug, title, sortOrder: sortOrder ?? null },
    withUnlock: true
  });

export const rcPublishEvent = (eventId: string, archive = false) =>
  rcFetch<RcApi<'RcEventPublishedResponse'>>(`/events/${eventId}/publish`, {
    body: { archive },
    withUnlock: true
  });

/**
 * Ein Teil. `isPublic` entscheidet, ob der Inhalt im Klartext liegt oder unter
 * dem Epochenschlüssel des Bereichs — und das ist keine Einstellung, die man
 * später umlegt: die Datenbank lässt genau eine der beiden Formen zu.
 */
export const rcAddPart = (
  pageId: string, kind: RcPartKind,
  content: { isPublic?: boolean; menuLabel?: string; title?: string; intro?: string; configJson?: string } = {}
) =>
  rcFetch<RcApi<'RcEventPartCreatedResponse'>>(`/event-pages/${pageId}/parts`, {
    body: {
      kind,
      isPublic: content.isPublic ?? true,
      menuLabel: content.menuLabel ?? null,
      title: content.title ?? null,
      intro: content.intro ?? null,
      configJson: content.configJson ?? null,
      sortOrder: null
    },
    withUnlock: true
  });

export const rcUpdatePart = (
  partId: string,
  content: { menuLabel?: string; title?: string; intro?: string; configJson?: string; isVisible?: boolean }
) =>
  rcFetch<RcApi<'RcEventPartUpdatedResponse'>>(`/event-parts/${partId}`, {
    body: {
      menuLabel: content.menuLabel ?? null,
      title: content.title ?? null,
      intro: content.intro ?? null,
      configJson: content.configJson ?? null,
      isVisible: content.isVisible ?? null
    },
    withUnlock: true
  });

export const rcAddField = (
  partId: string, kind: RcFieldKind, label: string,
  options: {
    helpText?: string; options?: readonly string[]; isRequired?: boolean;
    isHalfWidth?: boolean; identityRole?: 'none' | 'name' | 'contact'; dataClass?: RcDataClass;
  } = {}
) =>
  rcFetch<RcApi<'RcEventFieldCreatedResponse'>>(`/event-parts/${partId}/fields`, {
    body: {
      kind, label,
      helpText: options.helpText ?? null,
      options: options.options === undefined ? null : [...options.options],
      isRequired: options.isRequired ?? false,
      isHalfWidth: options.isHalfWidth ?? false,
      identityRole: options.identityRole ?? 'none',
      // Bewusst NICHT hier vorbelegt: fehlt die Angabe, nimmt der Server
      // `special`. Hier `normal` hinzuschreiben wäre die stille Umkehr der
      // Vorgabe an der Stelle, an der niemand hinsieht.
      dataClass: options.dataClass ?? null
    },
    withUnlock: true
  });

// -- Anmelden -----------------------------------------------------------------

/**
 * Von aussen anmelden — ohne Konto, ohne Schlüssel.
 *
 * Der Ablauf, Schritt für Schritt, weil jeder einzelne einen Grund hat:
 *
 *   1. Ein Sitzungsschlüssel aus dem Zufallsgenerator. Je Anmeldung ein
 *      eigener: ein gemeinsamer wäre ein einziger Punkt, an dem alles auf
 *      einmal auffliegt.
 *   2. Jede Antwort damit versiegeln, unter der AAD dieser Anmeldung.
 *   3. Den Sitzungsschlüssel unter dem öffentlichen Annahmeschlüssel
 *      verpacken.
 *   4. Beides schicken. Der Server kann keines von beiden öffnen.
 *
 * Die Kennung der Anmeldung muss VOR dem Versiegeln feststehen — sie steckt in
 * der AAD. Sie wird deshalb hier gewürfelt und mitgeschickt, statt sie vom
 * Server vergeben zu lassen.
 */
export async function rcSubmitRegistration(
  partId: string,
  registrationId: string,
  intakePublicKeyBase64Url: string,
  answers: ReadonlyMap<string, string>,
  consentTextId?: string
) {
  const sessionKey = newSymmetricKey();
  const aad = rcAad('events', 'registration', registrationId, RcField.EventAnswer, 1);

  const sealedAnswers: { fieldId: string; sealed: string }[] = [];
  for (const [fieldId, value] of answers) {
    if (value.trim().length === 0) continue;
    sealedAnswers.push({
      fieldId,
      sealed: rcToBase64Url(await seal(sessionKey, aad, new TextEncoder().encode(value)))
    });
  }

  // Der verpackte Schlüssel liegt an EINEM ANDEREN Platz als die Antworten:
  // er gehört derselben Anmeldung, ist aber ein Schlüssel und keine Antwort.
  //
  // Der erste Anlauf verpackte unter der Antwort-AAD, während der Server unter
  // der Veranstaltungs-AAD auspackte. Beide Seiten waren für sich schlüssig,
  // und nichts ging auf. Der gemeinsame Testvektor fand das nicht — er prüft
  // das Format, nicht die Verabredung darüber, welcher Platz gemeint ist.
  const wrapAad = rcAad('events', 'registration', registrationId, RcField.EventIntakeKey, 1);

  const spki = rcFromBase64Url(intakePublicKeyBase64Url);
  const wrapped = await wrapKey(spki, wrapAad, sessionKey);

  return rcFetch<RcApi<'RcRegistrationSubmittedResponse'>>(`/event-parts/${partId}/registrations`, {
    body: {
      registrationId,
      answers: null,
      sealedAnswers,
      sessionKeyWrapped: rcToBase64Url(wrapped),
      roleId: null,
      consentTextId: consentTextId ?? null
    }
  });
}

/**
 * Von innen anmelden — als Mitglied mit eigenem Schlüssel.
 *
 * Hier schickt der Browser Klartext über TLS und der Server versiegelt unter
 * dem Epochenschlüssel. Das ist kein Rückschritt: wer den Epochenschlüssel
 * ohnehin hat, gewinnt nichts dadurch, selbst zu versiegeln — und der Server
 * erfährt nichts, was er nicht ohnehin herausgeben dürfte.
 */
export const rcSubmitAsMember = (
  partId: string, roleId: string, answers: ReadonlyMap<string, string>, consentTextId?: string
) =>
  rcFetch<RcApi<'RcRegistrationSubmittedResponse'>>(`/event-parts/${partId}/registrations`, {
    body: {
      answers: [...answers].map(([fieldId, value]) => ({ fieldId, value })),
      sealedAnswers: null,
      sessionKeyWrapped: null,
      roleId,
      consentTextId: consentTextId ?? null
    },
    withUnlock: true
  });

export const rcRegistrations = (partId: string) =>
  rcFetch<RcApi<'RcRegistrationsResponse'>>(`/event-parts/${partId}/registrations`, { withUnlock: true });

export const rcWithdrawRegistration = (registrationId: string, claim?: string) =>
  rcFetch<RcApi<'RcRegistrationWithdrawnResponse'>>(`/registrations/${registrationId}/withdraw`, {
    body: { claim: claim ?? null },
    withUnlock: true
  });

// -- Kleinigkeiten, die die Oberfläche braucht -------------------------------

/**
 * Nimmt diese Veranstaltung Anmeldungen entgegen?
 *
 * Ein Entwurf tut es nicht, und ohne Annahmeschlüssel geht es auch nicht. Die
 * Oberfläche rechnet es selbst aus, damit sie es SAGEN kann, statt ein Formular
 * anzubieten, dessen Absenden mit einer Absage endet.
 */
export function rcTakesRegistrations(view: RcEventView): boolean {
  return view.lifecycle === 'published'
    && view.intakePublicKey !== null && view.intakePublicKey !== undefined;
}

/** Alle Teile über alle Seiten, in Reihenfolge. Für Menüs und Zählungen. */
export function rcAllParts(view: RcEventView): readonly RcEventPart[] {
  return view.pages.flatMap((page) => page.parts);
}

/**
 * Fehlende Pflichtangaben — dieselbe Regel, die auch der Server prüft.
 *
 * Sie steht hier NICHT, weil der Server ihr nicht traute, sondern damit
 * niemand ein ausgefülltes Formular abschickt und es unausgefüllt
 * zurückbekommt. Die Regel gilt trotzdem dort: eine, die der Klient
 * durchsetzt, ist keine.
 */
export function rcMissingRequired(
  fields: readonly RcEventField[],
  answers: ReadonlyMap<string, string>
): readonly RcEventField[] {
  return fields.filter((f) => f.isRequired && (answers.get(f.fieldId) ?? '').trim().length === 0);
}
