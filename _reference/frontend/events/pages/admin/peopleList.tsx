import type {
  EventAdminAccessLink,
  EventAdminCardRow,
  EventAdminPage,
  EventAdminRegistrationRow
} from '../../../lib/api';

/**
 * One person, however they got here.
 *
 * A registration, an access link and a participant card are three rows about
 * the same human being. Listed as three sections they meant reading the same
 * name three times and working out which row belonged to which — so they are
 * joined into one row per person: name, phone, and everything else on demand.
 */
export type Person = {
  key: string;
  name: string;
  phone: string | null;
  registration: EventAdminRegistrationRow | null;
  link: EventAdminAccessLink | null;
  card: EventAdminCardRow | null;
};

/** A contact worth offering as a call. An e-mail address is not one. */
export function phoneOf(...candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate || candidate.includes('@')) continue;
    if (candidate.replace(/\D/g, '').length >= 9) return candidate.trim();
  }
  return null;
}

export function buildPeople(
  registrations: EventAdminRegistrationRow[],
  links: EventAdminAccessLink[],
  cards: EventAdminCardRow[]
): Person[] {
  const cardByLink = new Map(cards.map((card) => [card.accessLinkId, card]));
  const linkByRegistration = new Map(
    links.filter((link) => link.registrationId).map((link) => [link.registrationId as string, link])
  );
  const used = new Set<string>();

  const people: Person[] = registrations.map((registration) => {
    const link = linkByRegistration.get(registration.id) ?? null;
    if (link) used.add(link.id);
    return {
      key: `r-${registration.id}`,
      name: registration.participantName ?? link?.recipientName ?? '— bez nazwiska —',
      phone: phoneOf(registration.participantContact, link?.recipientContact),
      registration,
      link,
      card: link ? cardByLink.get(link.id) ?? null : null
    };
  });

  // Links made by hand, with no submission behind them.
  for (const link of links) {
    if (used.has(link.id)) continue;
    people.push({
      key: `l-${link.id}`,
      name: link.recipientName,
      phone: phoneOf(link.recipientContact),
      registration: null,
      link,
      card: cardByLink.get(link.id) ?? null
    });
  }

  return people.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

/** Which internal pages exist, for the grant checkboxes. */
export function internalPagesOf(pages: EventAdminPage[]): EventAdminPage[] {
  return pages.filter((page) => page.kind === 'internal');
}
