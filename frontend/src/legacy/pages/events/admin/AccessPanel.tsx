import { useCallback, useEffect, useState } from 'react';
import {
  createEventAccessLink,
  deleteEventAccessLink,
  deleteEventCard,
  deleteEventRegistration,
  getEventAccessLinks,
  getEventCards,
  getEventRegistrations,
  rotateEventAccessLink,
  setEventAccessLinkStatus,
  setEventRegistrationHidden,
  updateEventAccessLink,
  type EventAdminAccessLink,
  type EventAdminCardRow,
  type EventAdminPage,
  type EventAdminRegistrationRow
} from '../../../lib/api';
import { buildPeople, internalPagesOf, type Person } from './peopleList';

function linkUrl(token: string): string {
  return `${window.location.origin}/#/event/link/${token}`;
}

/** Strips a Polish number down to something a phone will dial. */
function dialable(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.startsWith('+') || digits.length !== 9 ? digits : `+48${digits}`;
}

/**
 * Fills the event's saved message in for one recipient. Two names, because they
 * are not the same message: `{osoba}` is who this is, in full, and `{imie}` is
 * how you greet them.
 */
function renderSms(
  template: string,
  values: { osoba: string; imie: string; wydarzenie: string; link: string }
): string {
  return template
    .replace(/\{osoba\}/g, values.osoba)
    .replace(/\{imie\}/g, values.imie)
    .replace(/\{wydarzenie\}/g, values.wydarzenie)
    .replace(/\{link\}/g, values.link);
}

/** "Grupa: 3" per line ⇄ structured assignments. */
function parseAssignments(raw: string) {
  return raw
    .split('\n')
    .map((line) => {
      const separator = line.indexOf(':');
      if (separator === -1) return null;
      const label = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      return label.length > 0 && value.length > 0 ? { label, value } : null;
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null);
}

function formatAssignments(entries: Array<{ label: string; value: string }>): string {
  return entries.map((entry) => `${entry.label}: ${entry.value}`).join('\n');
}

/**
 * One list of people, not three lists of records.
 *
 * A row is a name and a phone number — the two things an organizer reaches for
 * on the day — and everything else waits behind "Więcej": the submitted answers,
 * the individual link with its grants, and the signed card. Before this the same
 * person appeared in a registrations table, again in a links list and again in a
 * cards list, with their name and contact repeated in all three.
 */
export function AccessPanel({
  siteId,
  pages,
  eventTitle,
  smsTemplate
}: {
  siteId: string;
  pages: EventAdminPage[];
  eventTitle: string;
  /** The event's saved SMS, or null when none has been written yet. */
  smsTemplate: string | null;
}) {
  const internalPages = internalPagesOf(pages);

  const [registrations, setRegistrations] = useState<EventAdminRegistrationRow[]>([]);
  const [links, setLinks] = useState<EventAdminAccessLink[]>([]);
  const [cards, setCards] = useState<EventAdminCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const smsHref = (link: EventAdminAccessLink) => {
    const name = link.recipientName.trim();
    const text = renderSms(smsTemplate ?? '{wydarzenie}: {link}', {
      osoba: name,
      // Everything up to the first space. A name with no space is its own first
      // name, which is also the right answer for a one-word nickname.
      imie: name.split(/\s+/)[0] || name,
      wydarzenie: eventTitle,
      link: linkUrl(link.token)
    });
    return `sms:${dialable(link.recipientContact ?? '')}?body=${encodeURIComponent(text)}`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [registrationRows, linkRows, cardRows] = await Promise.all([
        getEventRegistrations(siteId),
        getEventAccessLinks(siteId),
        // Cards are the newest table; an un-patched database should cost the
        // list its card column, not the whole panel.
        getEventCards(siteId).catch(() => [] as EventAdminCardRow[])
      ]);
      setRegistrations(registrationRows);
      setLinks(linkRows);
      setCards(cardRows);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać danych.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = async (person: Person) => {
    const registration = person.registration;
    if (!registration) return;

    const name = registration.participantName?.trim();
    if (!name) {
      setError(
        'To zgłoszenie nie ma imienia i nazwiska. Oznacz w formularzu pole jako „imię i nazwisko uczestnika”, albo utwórz link ręcznie.'
      );
      return;
    }
    try {
      await createEventAccessLink(siteId, {
        recipientName: name,
        recipientContact: registration.participantContact,
        personalNote: null,
        internalNote: null,
        pageIds: [],
        assignments: null,
        registrationId: registration.id
      });
      await load();
    } catch (grantError: unknown) {
      setError(grantError instanceof Error ? grantError.message : 'Nie udało się nadać dostępu.');
    }
  };

  const toggleHidden = async (registration: EventAdminRegistrationRow) => {
    try {
      await setEventRegistrationHidden(registration.id, !registration.isHidden);
      await load();
    } catch (hideError: unknown) {
      setError(hideError instanceof Error ? hideError.message : 'Nie udało się zmienić widoczności.');
    }
  };

  const removeRegistration = async (registration: EventAdminRegistrationRow) => {
    const who = registration.participantName ?? 'to zgłoszenie';
    if (!window.confirm(`Usunąć ${who} na stałe? Odpowiedzi z formularza zostaną skasowane bez możliwości cofnięcia.`)) {
      return;
    }
    try {
      await deleteEventRegistration(registration.id);
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć zgłoszenia.');
    }
  };

  const removeCard = async (card: EventAdminCardRow) => {
    if (!window.confirm('Usunąć kartę uczestnika ze zgodami? Zgłoszenie i link zostają.')) return;
    try {
      await deleteEventCard(card.id);
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć karty.');
    }
  };

  const togglePage = async (link: EventAdminAccessLink, pageId: string) => {
    const next = link.pageIds.includes(pageId)
      ? link.pageIds.filter((entry) => entry !== pageId)
      : [...link.pageIds, pageId];

    await updateEventAccessLink(link.id, {
      recipientName: link.recipientName,
      recipientContact: link.recipientContact,
      personalNote: link.personalNote,
      internalNote: link.internalNote,
      pageIds: next,
      assignments: link.assignments,
      registrationId: link.registrationId
    });
    await load();
  };

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(linkUrl(token));
      setCopied(token);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Przeglądarka nie pozwoliła skopiować linku — skopiuj go ręcznie z pola obok.');
    }
  };

  const hiddenCount = registrations.filter((row) => row.isHidden).length;
  const people = buildPeople(
    showHidden ? registrations : registrations.filter((row) => !row.isHidden),
    links,
    cards
  );

  return (
    <div className="eva-access">
      {error ? <p className="eva-error">{error}</p> : null}
      {loading ? <p className="eva-hint">Ładowanie…</p> : null}

      <section className="eva-panel">
        <header>
          <h3>Uczestnicy ({people.length})</h3>
          <p>Zgłoszenie, link osobisty i karta jednej osoby w jednym wierszu. Szczegóły pod „Więcej”.</p>
          {hiddenCount > 0 ? (
            <label className="eve-check">
              <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
              <span>Pokaż ukryte ({hiddenCount})</span>
            </label>
          ) : null}
        </header>

        {people.length === 0 ? (
          <p className="eva-hint">Nikt się jeszcze nie zgłosił.</p>
        ) : (
          <ul className="eva-people">
            {people.map((person) => (
              <li key={person.key} className={person.registration?.isHidden ? 'is-hidden' : undefined}>
                <div className="eva-person-head">
                  <strong>{person.name}</strong>

                  {/* One tap to call: the number is what an organizer actually
                      reaches for on the day. */}
                  {person.phone ? (
                    <a className="eva-phone" href={`tel:${dialable(person.phone)}`}>
                      {person.phone}
                    </a>
                  ) : (
                    <span className="eva-sub">brak telefonu</span>
                  )}

                  <span className="eva-person-tags">
                    {person.registration?.isHidden ? <span className="eva-pill">ukryte</span> : null}
                    {person.link ? (
                      person.link.status === 'active' ? (
                        <span className="eva-pill is-live">link</span>
                      ) : (
                        <span className="eva-pill">unieważniony</span>
                      )
                    ) : (
                      <span className="eva-pill">bez linku</span>
                    )}
                    {person.card ? <span className="eva-pill is-live">karta</span> : null}
                  </span>

                  <button
                    type="button"
                    className="eva-more"
                    onClick={() => setOpenKey(openKey === person.key ? null : person.key)}
                  >
                    {openKey === person.key ? 'Mniej' : 'Więcej'}
                  </button>
                </div>

                {openKey === person.key ? (
                  <PersonDetails
                    person={person}
                    internalPages={internalPages}
                    copied={copied}
                    smsHref={smsHref}
                    onCopy={copy}
                    onGrant={() => void grant(person)}
                    onTogglePage={togglePage}
                    onToggleHidden={toggleHidden}
                    onRemoveRegistration={removeRegistration}
                    onRemoveCard={removeCard}
                    onSaved={() => void load()}
                    onError={setError}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <ManualLinkForm siteId={siteId} onCreated={() => void load()} />
      </section>
    </div>
  );
}

/** Everything about one person, opened on demand. */
function PersonDetails({
  person,
  internalPages,
  copied,
  smsHref,
  onCopy,
  onGrant,
  onTogglePage,
  onToggleHidden,
  onRemoveRegistration,
  onRemoveCard,
  onSaved,
  onError
}: {
  person: Person;
  internalPages: EventAdminPage[];
  copied: string | null;
  smsHref: (link: EventAdminAccessLink) => string;
  onCopy: (token: string) => void;
  onGrant: () => void;
  onTogglePage: (link: EventAdminAccessLink, pageId: string) => Promise<void>;
  onToggleHidden: (registration: EventAdminRegistrationRow) => Promise<void>;
  onRemoveRegistration: (registration: EventAdminRegistrationRow) => Promise<void>;
  onRemoveCard: (card: EventAdminCardRow) => Promise<void>;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const { registration, link, card } = person;

  return (
    <div className="eva-person-body">
      {registration ? (
        <section>
          <h4>
            Zgłoszenie · {registration.partLabel}
            <span className="eva-sub"> {new Date(registration.submittedUtc).toLocaleString('pl-PL')}</span>
          </h4>
          <dl className="eva-answers">
            {registration.values.map((value, index) => (
              <div key={index}>
                <dt>{value.fieldLabel}</dt>
                <dd>{value.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
          <div className="eva-actions">
            <button type="button" onClick={() => void onToggleHidden(registration)}>
              {registration.isHidden ? 'Przywróć' : 'Ukryj'}
            </button>
            <button type="button" className="eva-danger" onClick={() => void onRemoveRegistration(registration)}>
              Usuń zgłoszenie
            </button>
          </div>
        </section>
      ) : null}

      <section>
        <h4>Dostęp</h4>
        {link ? (
          <>
            {internalPages.length > 0 ? (
              <div className="eva-grants">
                {internalPages.map((page) => (
                  <label key={page.id} className="eve-check">
                    <input
                      type="checkbox"
                      checked={link.pageIds.includes(page.id)}
                      onChange={() => void onTogglePage(link, page.id)}
                    />
                    <span>{page.menuLabel}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="eva-hint">Wydarzenie nie ma jeszcze stron wewnętrznych.</p>
            )}

            <div className="eva-link-row">
              <input className="eva-linkbox" readOnly value={linkUrl(link.token)} />
              <button type="button" onClick={() => onCopy(link.token)}>
                {copied === link.token ? 'Skopiowano' : 'Kopiuj'}
              </button>
              {link.recipientContact ? (
                <a className="eva-sms" href={smsHref(link)}>
                  SMS
                </a>
              ) : null}
            </div>

            <p className="eva-sub">
              {link.viewCount} otwarć
              {link.lastViewedUtc ? ` · ostatnio ${new Date(link.lastViewedUtc).toLocaleString('pl-PL')}` : ''}
              {link.contactVerifiedUtc
                ? ` · numer potwierdzony ${new Date(link.contactVerifiedUtc).toLocaleDateString('pl-PL')}`
                : ' · numer niepotwierdzony'}
            </p>

            <LinkDetails link={link} onSaved={onSaved} onCopyError={onError} />
          </>
        ) : (
          <div className="eva-actions">
            <p className="eva-hint">Ta osoba nie ma jeszcze linku osobistego.</p>
            <button type="button" className="eva-cta" onClick={onGrant}>
              Nadaj dostęp
            </button>
          </div>
        )}
      </section>

      {card ? (
        <section>
          <h4>
            Karta uczestnika
            <span className="eva-sub">
              {' '}
              podpis: {card.signerName}
              {card.signerRole === 'guardian' ? ' (rodzic / opiekun)' : ''} ·{' '}
              {new Date(card.updatedUtc).toLocaleString('pl-PL')}
              {card.isMinor ? ' · niepełnoletni' : ''}
            </span>
          </h4>
          <dl className="eva-answers">
            {Object.entries(card.data)
              .filter(([, value]) => (value ?? '').trim().length > 0)
              .map(([code, value]) => (
                <div key={code}>
                  <dt>{code}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          <ul className="eva-warnings">
            {card.consents.map((consent) => (
              <li key={consent.code}>
                {consent.accepted ? '✓' : '✗'} {consent.label}
              </li>
            ))}
          </ul>
          <div className="eva-actions">
            <button type="button" className="eva-danger" onClick={() => void onRemoveCard(card)}>
              Usuń kartę
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ManualLinkForm({ siteId, onCreated }: { siteId: string; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [pending, setPending] = useState(false);

  const create = async () => {
    if (name.trim().length === 0) return;
    setPending(true);
    try {
      await createEventAccessLink(siteId, {
        recipientName: name.trim(),
        recipientContact: contact.trim() || null,
        personalNote: null,
        internalNote: null,
        pageIds: [],
        assignments: null,
        registrationId: null
      });
      setName('');
      setContact('');
      onCreated();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="eva-inline-form">
      <input placeholder="Imię i nazwisko" value={name} onChange={(event) => setName(event.target.value)} />
      <input placeholder="Kontakt (opcjonalnie)" value={contact} onChange={(event) => setContact(event.target.value)} />
      <button type="button" className="eva-cta" onClick={() => void create()} disabled={pending}>
        {pending ? 'Tworzenie…' : 'Utwórz link ręcznie'}
      </button>
    </div>
  );
}

function LinkDetails({
  link,
  onSaved,
  onCopyError
}: {
  link: EventAdminAccessLink;
  onSaved: () => void;
  onCopyError: (message: string) => void;
}) {
  const [personalNote, setPersonalNote] = useState(link.personalNote ?? '');
  const [internalNote, setInternalNote] = useState(link.internalNote ?? '');
  const [assignments, setAssignments] = useState(formatAssignments(link.assignments));
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    try {
      await updateEventAccessLink(link.id, {
        recipientName: link.recipientName,
        recipientContact: link.recipientContact,
        personalNote: personalNote.trim() || null,
        internalNote: internalNote.trim() || null,
        pageIds: link.pageIds,
        assignments: parseAssignments(assignments),
        registrationId: link.registrationId
      });
      onSaved();
    } catch (saveError: unknown) {
      onCopyError(saveError instanceof Error ? saveError.message : 'Nie udało się zapisać.');
    } finally {
      setPending(false);
    }
  };

  const rotate = async () => {
    if (!window.confirm('Wygenerować nowy link? Poprzedni przestanie działać natychmiast.')) return;
    await rotateEventAccessLink(link.id);
    onSaved();
  };

  const remove = async () => {
    if (
      !window.confirm(
        'Usunąć ten link osobisty? Razem z nim znika karta uczestnika wypełniona z tego linku — zgłoszenie zostaje. ' +
          'Żeby tylko odciąć dostęp, użyj „Unieważnij”.'
      )
    ) {
      return;
    }
    await deleteEventAccessLink(link.id);
    onSaved();
  };

  return (
    <div className="eva-link-details">
      <label className="eve-row">
        <span>Notatka dla odbiorcy</span>
        <textarea rows={2} value={personalNote} onChange={(event) => setPersonalNote(event.target.value)} />
      </label>
      <label className="eve-row">
        <span>Notatka wewnętrzna (niewidoczna dla odbiorcy)</span>
        <textarea rows={2} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} />
      </label>
      <label className="eve-row">
        <span>Przypisania — „Etykieta: wartość”, po jednym na linię</span>
        <textarea
          rows={3}
          value={assignments}
          placeholder={'Grupa: 3\nZbiórka: 7:40, brama B'}
          onChange={(event) => setAssignments(event.target.value)}
        />
      </label>

      <div className="eva-actions">
        <button type="button" className="eva-cta" onClick={() => void save()} disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </button>
        <button
          type="button"
          onClick={() => void setEventAccessLinkStatus(link.id, link.status === 'active' ? 'revoked' : 'active').then(onSaved)}
        >
          {link.status === 'active' ? 'Unieważnij' : 'Przywróć'}
        </button>
        <button type="button" onClick={() => void rotate()}>
          Nowy token
        </button>
        <button type="button" className="eva-danger" onClick={() => void remove()}>
          Usuń
        </button>
      </div>
    </div>
  );
}
