import { useCallback, useEffect, useState } from 'react';
import {
  createEventAccessLink,
  deleteEventAccessLink,
  deleteEventRegistration,
  getEventAccessLinks,
  getEventRegistrations,
  rotateEventAccessLink,
  setEventAccessLinkStatus,
  setEventRegistrationHidden,
  updateEventAccessLink,
  type EventAdminAccessLink,
  type EventAdminPage,
  type EventAdminRegistrationRow
} from '../../../lib/api';

function linkUrl(token: string): string {
  return `${window.location.origin}/#/event/link/${token}`;
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
 * Registrations on the left, links on the right. Granting access to someone who
 * registered is one button — that is the whole point of the identity fields.
 */
export function AccessPanel({ siteId, pages }: { siteId: string; pages: EventAdminPage[] }) {
  const internalPages = pages.filter((page) => page.kind === 'internal');

  const [registrations, setRegistrations] = useState<EventAdminRegistrationRow[]>([]);
  const [links, setLinks] = useState<EventAdminAccessLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [registrationRows, linkRows] = await Promise.all([
        getEventRegistrations(siteId),
        getEventAccessLinks(siteId)
      ]);
      setRegistrations(registrationRows);
      setLinks(linkRows);
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

  const grantFromRegistration = async (row: EventAdminRegistrationRow) => {
    const name = row.participantName?.trim();
    if (!name) {
      setError(
        'To zgłoszenie nie ma imienia i nazwiska. Oznacz w formularzu pole jako „imię i nazwisko uczestnika”, albo utwórz link ręcznie.'
      );
      return;
    }
    try {
      await createEventAccessLink(siteId, {
        recipientName: name,
        recipientContact: row.participantContact,
        personalNote: null,
        internalNote: null,
        pageIds: [],
        assignments: null,
        registrationId: row.id
      });
      await load();
    } catch (grantError: unknown) {
      setError(grantError instanceof Error ? grantError.message : 'Nie udało się nadać dostępu.');
    }
  };

  const toggleHidden = async (row: EventAdminRegistrationRow) => {
    try {
      await setEventRegistrationHidden(row.id, !row.isHidden);
      await load();
    } catch (hideError: unknown) {
      setError(hideError instanceof Error ? hideError.message : 'Nie udało się zmienić widoczności.');
    }
  };

  const removeRegistration = async (row: EventAdminRegistrationRow) => {
    const who = row.participantName ?? 'to zgłoszenie';
    if (!window.confirm(`Usunąć ${who} na stałe? Odpowiedzi z formularza zostaną skasowane bez możliwości cofnięcia.`)) {
      return;
    }
    try {
      await deleteEventRegistration(row.id);
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć zgłoszenia.');
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
  const visibleRegistrations = showHidden ? registrations : registrations.filter((row) => !row.isHidden);

  return (
    <div className="eva-access">
      {error ? <p className="eva-error">{error}</p> : null}
      {loading ? <p className="eva-hint">Ładowanie…</p> : null}

      <section className="eva-panel">
        <header>
          <h3>Zgłoszenia ({visibleRegistrations.length})</h3>
          <p>
            Osoby, które wypełniły formularz. Nadaj dostęp, żeby wygenerować dla nich link osobisty. Ukryte
            zgłoszenia nie liczą się do statystyk, ale zachowują odpowiedzi.
          </p>
          {hiddenCount > 0 ? (
            <label className="eve-check">
              <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
              <span>Pokaż ukryte ({hiddenCount})</span>
            </label>
          ) : null}
        </header>

        {visibleRegistrations.length === 0 ? (
          <p className="eva-hint">{hiddenCount > 0 ? 'Wszystkie zgłoszenia są ukryte.' : 'Brak zgłoszeń.'}</p>
        ) : (
          <div className="eva-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Osoba</th>
                  <th>Formularz</th>
                  <th>Data</th>
                  <th>Odpowiedzi</th>
                  <th>Dostęp</th>
                </tr>
              </thead>
              <tbody>
                {visibleRegistrations.map((row) => (
                  <tr key={row.id} className={row.isHidden ? 'is-hidden' : undefined}>
                    <td>
                      <strong>{row.participantName ?? '— bez nazwiska —'}</strong>
                      {row.isHidden ? <span className="eva-pill">ukryte</span> : null}
                      {row.participantContact ? <div className="eva-sub">{row.participantContact}</div> : null}
                    </td>
                    <td>
                      {row.partLabel}
                      <div className="eva-sub">{row.pageLabel}</div>
                    </td>
                    <td>{new Date(row.submittedUtc).toLocaleString('pl-PL')}</td>
                    <td>
                      <dl className="eva-answers">
                        {row.values.map((value, index) => (
                          <div key={index}>
                            <dt>{value.fieldLabel}</dt>
                            <dd>{value.value ?? '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                    <td className="eva-actions-cell">
                      {row.accessLinkId ? (
                        <span className="eva-pill is-live">nadany</span>
                      ) : row.isHidden ? null : (
                        <button type="button" className="eva-cta" onClick={() => void grantFromRegistration(row)}>
                          Nadaj dostęp
                        </button>
                      )}
                      <button type="button" onClick={() => void toggleHidden(row)}>
                        {row.isHidden ? 'Przywróć' : 'Ukryj'}
                      </button>
                      <button type="button" className="eva-danger" onClick={() => void removeRegistration(row)}>
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="eva-panel">
        <header>
          <h3>Linki osobiste ({links.length})</h3>
          <p>
            {internalPages.length === 0
              ? 'Najpierw dodaj stronę wewnętrzną — bez niej link pokazuje tylko stronę publiczną.'
              : 'Zaznacz, które strony wewnętrzne otwiera każdy link.'}
          </p>
        </header>

        <ManualLinkForm siteId={siteId} onCreated={() => void load()} />

        {links.length === 0 ? (
          <p className="eva-hint">Brak linków.</p>
        ) : (
          <div className="eva-link-list">
            {links.map((link) => (
              <article className="eva-link" key={link.id}>
                <header>
                  <div>
                    <strong>{link.recipientName}</strong>
                    {link.recipientContact ? <span className="eva-sub"> · {link.recipientContact}</span> : null}
                  </div>
                  <div className="eva-link-stats">
                    <span className={`eva-pill ${link.status === 'active' ? 'is-live' : ''}`}>{link.status}</span>
                    <span className="eva-sub">
                      {link.viewCount} otwarć
                      {link.lastViewedUtc ? ` · ${new Date(link.lastViewedUtc).toLocaleString('pl-PL')}` : ''}
                    </span>
                  </div>
                </header>

                {internalPages.length > 0 ? (
                  <div className="eva-grants">
                    {internalPages.map((page) => (
                      <label key={page.id} className="eve-check">
                        <input
                          type="checkbox"
                          checked={link.pageIds.includes(page.id)}
                          onChange={() => void togglePage(link, page.id)}
                        />
                        <span>{page.menuLabel}</span>
                      </label>
                    ))}
                  </div>
                ) : null}

                {link.internalNote ? <p className="eva-internal">{link.internalNote}</p> : null}

                <div className="eva-link-row">
                  <input className="eva-linkbox" readOnly value={linkUrl(link.token)} />
                  <button type="button" onClick={() => void copy(link.token)}>
                    {copied === link.token ? 'Skopiowano' : 'Kopiuj'}
                  </button>
                  <button type="button" onClick={() => setEditing(editing === link.id ? null : link.id)}>
                    {editing === link.id ? 'Zwiń' : 'Szczegóły'}
                  </button>
                </div>

                {editing === link.id ? (
                  <LinkDetails link={link} onSaved={() => void load()} onCopyError={setError} />
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
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
    if (!window.confirm('Usunąć ten link osobisty?')) return;
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
