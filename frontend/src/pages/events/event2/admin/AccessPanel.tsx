import { useCallback, useEffect, useState } from 'react';
import {
  createEvent2AccessLink,
  deleteEvent2AccessLink,
  getEvent2AccessLinks,
  getEvent2Registrations,
  rotateEvent2AccessLink,
  setEvent2AccessLinkStatus,
  updateEvent2AccessLink,
  type Event2AdminAccessLink,
  type Event2AdminPage,
  type Event2AdminRegistrationRow
} from '../../../../lib/api';

function linkUrl(token: string): string {
  return `${window.location.origin}/#/event/event2/link/${token}`;
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
export function AccessPanel({ siteId, pages }: { siteId: string; pages: Event2AdminPage[] }) {
  const internalPages = pages.filter((page) => page.kind === 'internal');

  const [registrations, setRegistrations] = useState<Event2AdminRegistrationRow[]>([]);
  const [links, setLinks] = useState<Event2AdminAccessLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [registrationRows, linkRows] = await Promise.all([
        getEvent2Registrations(siteId),
        getEvent2AccessLinks(siteId)
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

  const grantFromRegistration = async (row: Event2AdminRegistrationRow) => {
    const name = row.participantName?.trim();
    if (!name) {
      setError(
        'To zgłoszenie nie ma imienia i nazwiska. Oznacz w formularzu pole jako „imię i nazwisko uczestnika”, albo utwórz link ręcznie.'
      );
      return;
    }
    try {
      await createEvent2AccessLink(siteId, {
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

  const togglePage = async (link: Event2AdminAccessLink, pageId: string) => {
    const next = link.pageIds.includes(pageId)
      ? link.pageIds.filter((entry) => entry !== pageId)
      : [...link.pageIds, pageId];

    await updateEvent2AccessLink(link.id, {
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

  return (
    <div className="e2a-access">
      {error ? <p className="e2a-error">{error}</p> : null}
      {loading ? <p className="e2a-hint">Ładowanie…</p> : null}

      <section className="e2a-panel">
        <header>
          <h3>Zgłoszenia ({registrations.length})</h3>
          <p>Osoby, które wypełniły formularz. Nadaj dostęp, żeby wygenerować dla nich link osobisty.</p>
        </header>

        {registrations.length === 0 ? (
          <p className="e2a-hint">Brak zgłoszeń.</p>
        ) : (
          <div className="e2a-table-wrap">
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
                {registrations.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.participantName ?? '— bez nazwiska —'}</strong>
                      {row.participantContact ? <div className="e2a-sub">{row.participantContact}</div> : null}
                    </td>
                    <td>
                      {row.partLabel}
                      <div className="e2a-sub">{row.pageLabel}</div>
                    </td>
                    <td>{new Date(row.submittedUtc).toLocaleString('pl-PL')}</td>
                    <td>
                      <dl className="e2a-answers">
                        {row.values.map((value, index) => (
                          <div key={index}>
                            <dt>{value.fieldLabel}</dt>
                            <dd>{value.value ?? '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                    <td>
                      {row.accessLinkId ? (
                        <span className="e2a-pill is-live">nadany</span>
                      ) : (
                        <button type="button" className="e2a-cta" onClick={() => void grantFromRegistration(row)}>
                          Nadaj dostęp
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="e2a-panel">
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
          <p className="e2a-hint">Brak linków.</p>
        ) : (
          <div className="e2a-link-list">
            {links.map((link) => (
              <article className="e2a-link" key={link.id}>
                <header>
                  <div>
                    <strong>{link.recipientName}</strong>
                    {link.recipientContact ? <span className="e2a-sub"> · {link.recipientContact}</span> : null}
                  </div>
                  <div className="e2a-link-stats">
                    <span className={`e2a-pill ${link.status === 'active' ? 'is-live' : ''}`}>{link.status}</span>
                    <span className="e2a-sub">
                      {link.viewCount} otwarć
                      {link.lastViewedUtc ? ` · ${new Date(link.lastViewedUtc).toLocaleString('pl-PL')}` : ''}
                    </span>
                  </div>
                </header>

                {internalPages.length > 0 ? (
                  <div className="e2a-grants">
                    {internalPages.map((page) => (
                      <label key={page.id} className="e2e-check">
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

                {link.internalNote ? <p className="e2a-internal">{link.internalNote}</p> : null}

                <div className="e2a-link-row">
                  <input className="e2a-linkbox" readOnly value={linkUrl(link.token)} />
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
      await createEvent2AccessLink(siteId, {
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
    <div className="e2a-inline-form">
      <input placeholder="Imię i nazwisko" value={name} onChange={(event) => setName(event.target.value)} />
      <input placeholder="Kontakt (opcjonalnie)" value={contact} onChange={(event) => setContact(event.target.value)} />
      <button type="button" className="e2a-cta" onClick={() => void create()} disabled={pending}>
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
  link: Event2AdminAccessLink;
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
      await updateEvent2AccessLink(link.id, {
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
    await rotateEvent2AccessLink(link.id);
    onSaved();
  };

  const remove = async () => {
    if (!window.confirm('Usunąć ten link osobisty?')) return;
    await deleteEvent2AccessLink(link.id);
    onSaved();
  };

  return (
    <div className="e2a-link-details">
      <label className="e2e-row">
        <span>Notatka dla odbiorcy</span>
        <textarea rows={2} value={personalNote} onChange={(event) => setPersonalNote(event.target.value)} />
      </label>
      <label className="e2e-row">
        <span>Notatka wewnętrzna (niewidoczna dla odbiorcy)</span>
        <textarea rows={2} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} />
      </label>
      <label className="e2e-row">
        <span>Przypisania — „Etykieta: wartość”, po jednym na linię</span>
        <textarea
          rows={3}
          value={assignments}
          placeholder={'Grupa: 3\nZbiórka: 7:40, brama B'}
          onChange={(event) => setAssignments(event.target.value)}
        />
      </label>

      <div className="e2a-actions">
        <button type="button" className="e2a-cta" onClick={() => void save()} disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </button>
        <button
          type="button"
          onClick={() => void setEvent2AccessLinkStatus(link.id, link.status === 'active' ? 'revoked' : 'active').then(onSaved)}
        >
          {link.status === 'active' ? 'Unieważnij' : 'Przywróć'}
        </button>
        <button type="button" onClick={() => void rotate()}>
          Nowy token
        </button>
        <button type="button" className="e2a-danger" onClick={() => void remove()}>
          Usuń
        </button>
      </div>
    </div>
  );
}
