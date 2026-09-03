/**
 * Pfarrei im Browser — Messplan, Intentionen, Gaben.
 *
 * Der Unterschied zu den Veranstaltungen steckt in einer einzigen Zeile:
 *
 *   Bei einer Veranstaltung ist ein ABSCHNITT öffentlich oder intern.
 *   Bei einer Intention ist ein FELD öffentlich und ein anderes intern —
 *   in derselben Zeile, gleichzeitig gültig.
 *
 * Das ist kein Sonderfall, sondern der Alltag: „in einer bestimmten Absicht"
 * steht im Schaukasten, wofür und von wem geht die Gemeinde nichts an. Der
 * Altbestand hatte das bereits richtig; übernommen wurde die Aufteilung, nicht
 * der Code.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcParish = RcApi<'ParishParishSummary'>;
export type RcMass = RcApi<'ParishMassView'>;
export type RcIntention = RcApi<'ParishIntentionView'>;

// -- Lesen --------------------------------------------------------------------

export const rcParishes = () =>
  rcFetch<RcApi<'RcParishesResponse'>>('/parishes', { withUnlock: true });

/**
 * Der Messplan. OHNE Konto abrufbar — er hängt am Schaukasten.
 *
 * Zu jeder Messe stehen die ÖFFENTLICHEN Texte der Intentionen. Was intern
 * dazu vermerkt ist, kommt hier nicht vor; dafür gibt es `rcIntentions`, und
 * das verlangt einen Schlüssel.
 */
export const rcMasses = (slug: string, from?: string, to?: string) => {
  const query = new URLSearchParams();
  if (from !== undefined) query.set('from', from);
  if (to !== undefined) query.set('to', to);
  const tail = query.toString();
  return rcFetch<RcApi<'RcMassesResponse'>>(
    `/parishes/${encodeURIComponent(slug)}/masses${tail === '' ? '' : `?${tail}`}`);
};

/** Die Intentionen MIT dem, was intern dazu steht. Verlangt einen Schlüssel. */
export const rcIntentions = (parishId: string) =>
  rcFetch<RcApi<'RcIntentionsResponse'>>(`/parishes/${parishId}/intentions`, { withUnlock: true });

// -- Anlegen ------------------------------------------------------------------

export type RcParishSite = RcApi<'RcParishSiteResponse'>;

/**
 * Was die Pfarrei auf ihrer Startseite zeigt.
 *
 * Ohne Konto lesbar — es ist die öffentliche Seite. Das Feld `configured` ist
 * falsch, solange niemand gewählt hat; daran erkennt der zweite Schritt des
 * Anlegens, dass er noch aussteht.
 */
export const rcParishSite = (parishId: string) =>
  rcFetch<RcParishSite>(`/parishes/${parishId}/site`);

/** Die Bausteine gehen als JSON-Liste hinaus — der Server deutet sie nicht. */
export const rcSaveParishSite = (parishId: string, theme: string, modules: readonly string[]) =>
  rcFetch<RcParishSite>(`/parishes/${parishId}/site`, {
    method: 'PUT',
    body: { theme, modules: JSON.stringify(modules) },
    withUnlock: true
  });

export const rcCreateParish = (areaId: string, slug: string, name: string, location?: string) =>
  rcFetch<RcApi<'RcParishCreatedResponse'>>('/parishes', {
    body: { areaId, slug, name, location: location ?? null },
    withUnlock: true
  });

export const rcAddMass = (
  parishId: string, startsUtc: string, church: string,
  options: { title?: string; note?: string; isCollective?: boolean; durationMinutes?: number; kind?: string } = {}
) =>
  rcFetch<RcApi<'RcMassCreatedResponse'>>(`/parishes/${parishId}/masses`, {
    body: {
      startsUtc, church,
      title: options.title ?? null,
      note: options.note ?? null,
      isCollective: options.isCollective ?? false,
      durationMinutes: options.durationMinutes ?? null,
      kind: options.kind ?? null
    },
    withUnlock: true
  });

/**
 * Eine Intention. `publicText` ist Pflicht — ohne ihn stünde sie nirgends im
 * Plan, und dann wäre sie keine Intention, sondern eine Notiz.
 *
 * `internalText` und `donorRef` sind es nicht: nicht jede Intention hat einen
 * internen Vermerk, und nicht jede einen genannten Stifter.
 */
export const rcAddIntention = (
  parishId: string, publicText: string,
  options: { internalText?: string; donorRef?: string; massId?: string } = {}
) =>
  rcFetch<RcApi<'RcIntentionCreatedResponse'>>(`/parishes/${parishId}/intentions`, {
    body: {
      publicText,
      internalText: options.internalText ?? null,
      donorRef: options.donorRef ?? null,
      massId: options.massId ?? null
    },
    withUnlock: true
  });

/**
 * Eine Gabe. Der Betrag reist als ZEICHENKETTE, nicht als Zahl.
 *
 * Ein Geldbetrag als Gleitkommazahl ist ein Rundungsfehler, der auf eine
 * Gelegenheit wartet. Er wird ohnehin versiegelt und nie gerechnet — also
 * bleibt er, was er ist: das, was jemand hingeschrieben hat.
 */
export const rcAddOffering = (
  intentionId: string, amount: string,
  options: { currency?: string; donorRef?: string; receivedOn?: string } = {}
) =>
  rcFetch<RcApi<'RcOfferingCreatedResponse'>>(`/intentions/${intentionId}/offerings`, {
    body: {
      amount,
      currency: options.currency ?? 'PLN',
      donorRef: options.donorRef ?? null,
      receivedOn: options.receivedOn ?? null
    },
    withUnlock: true
  });

// -- Was die Oberfläche wissen muss ------------------------------------------

/**
 * Hat diese Intention einen internen Teil, den der Leser nicht öffnen kann?
 *
 * Der Unterschied zu „hat gar keinen" ist wichtig: eine Intention ohne
 * internen Vermerk ist vollständig sichtbar, eine mit einem verschlossenen ist
 * es nicht. Beide gleich darzustellen hiesse, dem Leser zu verschweigen, dass
 * er nur einen Teil sieht (15.9).
 */
export function rcIntentionSealed(intention: RcIntention): boolean {
  return intention.unreadable !== null && intention.unreadable !== undefined;
}

/**
 * Der Plan nach Tagen, wie er gedruckt wird.
 *
 * Gruppiert wird nach dem ÖRTLICHEN Datum des Lesers, nicht nach UTC. Eine
 * Abendmesse um 22 Uhr rutscht sonst auf den Folgetag, und der Plan stimmt für
 * niemanden mehr.
 */
export function rcMassesByDay(
  masses: readonly RcMass[],
  lang: string
): readonly (readonly [string, readonly RcMass[]])[] {
  const days = new Map<string, RcMass[]>();

  for (const mass of masses) {
    const day = new Date(mass.startsUtc).toLocaleDateString(lang, {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const list = days.get(day);
    if (list === undefined) days.set(day, [mass]);
    else list.push(mass);
  }

  return [...days];
}
