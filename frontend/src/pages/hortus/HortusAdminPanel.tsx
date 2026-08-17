import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkHortusAdminAvailability,
  createHortusReservation,
  createHortusResource,
  decideHortusReservation,
  deleteHortusReservation,
  deleteHortusResource,
  getHortusAdminResources,
  getHortusReservations,
  getHortusTimeline,
  updateHortusResource,
  updateHortusSettings,
  type HortusCheckResponse,
  type HortusOccupancyView,
  type HortusPlaceView,
  type HortusReservationKind,
  type HortusReservationView,
  type HortusResourceUpsert,
  type HortusResourceView,
  type HortusSiteResponse
} from '../../lib/api';
import { HortusItemEditor } from './HortusItemEditor';
import { HortusTimeline } from './HortusTimeline';
import { cleanError } from './HortusPage';
import {
  addDays,
  bookingUnitLabel,
  flattenResources,
  formatDateTime,
  formatMinutes,
  shortTime,
  STATUS_LABELS,
  today
} from './hortusTime';
import { toItemRequest, type HortusDraftItem } from './hortusDraft';

type Section = 'queue' | 'calendar' | 'new' | 'resources' | 'settings';

const SECTION_LABELS: Record<Section, string> = {
  queue: 'Zgłoszenia',
  calendar: 'Kalendarz',
  new: 'Nowy wpis',
  resources: 'Części miejsca',
  settings: 'Ustawienia'
};

const EMPTY_RESOURCE_FORM: HortusResourceUpsert = {
  parentId: null,
  slug: '',
  name: '',
  description: '',
  kind: 'other',
  bookingUnit: 'slot',
  capacity: 1,
  guestCapacity: null,
  technicalMinutesBefore: 0,
  technicalMinutesAfter: 60,
  isPubliclyBookable: true,
  isActive: true,
  sortOrder: 100,
  colorToken: 'sage'
};

export function HortusAdminPanel({ slug, onSiteChanged }: { slug: string; onSiteChanged: () => void }) {
  const [section, setSection] = useState<Section>('queue');
  const [site, setSite] = useState<HortusSiteResponse | null>(null);
  const [reservations, setReservations] = useState<HortusReservationView[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [windowStart, setWindowStart] = useState(today());
  const [windowDays, setWindowDays] = useState(14);
  const [occupancies, setOccupancies] = useState<HortusOccupancyView[]>([]);

  const place = site?.place ?? null;
  const timeZone = place?.timeZoneIana || 'Europe/Warsaw';
  const resourceNodes = useMemo(() => flattenResources(site?.resources ?? []), [site]);

  const loadResources = useCallback(async () => {
    try {
      setSite(await getHortusAdminResources(slug));
    } catch (err: unknown) {
      setError(err instanceof Error ? cleanError(err.message) : 'Nie udało się wczytać części miejsca.');
    }
  }, [slug]);

  const loadReservations = useCallback(async () => {
    try {
      const response = await getHortusReservations(slug, statusFilter);
      setReservations(response.reservations);
      setPendingCount(response.pendingCount);
    } catch (err: unknown) {
      setError(err instanceof Error ? cleanError(err.message) : 'Nie udało się wczytać zgłoszeń.');
    }
  }, [slug, statusFilter]);

  const loadTimeline = useCallback(async () => {
    try {
      const response = await getHortusTimeline(slug, windowStart, addDays(windowStart, windowDays - 1));
      setOccupancies(response.occupancies);
    } catch {
      setOccupancies([]);
    }
  }, [slug, windowStart, windowDays]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const refreshAll = async () => {
    await Promise.all([loadReservations(), loadTimeline()]);
  };

  const decide = async (
    reservation: HortusReservationView,
    status: 'confirmed' | 'rejected' | 'cancelled',
    force = false
  ) => {
    setBusy(true);
    setError(null);
    try {
      await decideHortusReservation(slug, reservation.id, { status, force });
      await refreshAll();
    } catch (err: unknown) {
      const message = err instanceof Error ? cleanError(err.message) : 'Nie udało się zmienić statusu.';
      setError(
        status === 'confirmed'
          ? `${message} Możesz potwierdzić mimo kolizji przyciskiem „potwierdź mimo to”.`
          : message
      );
    } finally {
      setBusy(false);
    }
  };

  const removeBlock = async (reservation: HortusReservationView) => {
    setBusy(true);
    try {
      await deleteHortusReservation(slug, reservation.id);
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? cleanError(err.message) : 'Nie udało się usunąć blokady.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="hortus-card hortus-admin">
      <div className="hortus-card-head">
        <h2>Panel koordynatora</h2>
        {pendingCount > 0 ? <span className="hortus-chip hortus-chip-alert">{pendingCount} oczekuje</span> : null}
      </div>

      <nav className="hortus-subtabs">
        {(Object.keys(SECTION_LABELS) as Section[]).map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'is-active' : ''}
            onClick={() => setSection(key)}
          >
            {SECTION_LABELS[key]}
          </button>
        ))}
      </nav>

      {error ? <p className="hortus-error">{error}</p> : null}

      {section === 'queue' ? (
        <div className="hortus-queue">
          <div className="hortus-field-row">
            <label>
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="pending">Oczekujące</option>
                <option value="confirmed">Potwierdzone</option>
                <option value="rejected">Odrzucone</option>
                <option value="cancelled">Odwołane</option>
                <option value="all">Wszystkie</option>
              </select>
            </label>
          </div>

          {reservations.length === 0 ? <p className="hortus-empty">Brak wpisów w tym widoku.</p> : null}

          <ul className="hortus-reservation-list">
            {reservations.map((reservation) => (
              <li key={reservation.id} className={`hortus-reservation hortus-status-border-${reservation.status}`}>
                <div className="hortus-reservation-head">
                  <div>
                    <strong>{reservation.groupName}</strong>{' '}
                    <span className="hortus-code">{reservation.code}</span>
                    {reservation.kind === 'block' ? <span className="hortus-chip">blokada</span> : null}
                  </div>
                  <span className={`hortus-status hortus-status-${reservation.status}`}>
                    {STATUS_LABELS[reservation.status] ?? reservation.status}
                  </span>
                </div>

                <div className="hortus-reservation-body">
                  <ul className="hortus-item-list">
                    {reservation.items.map((item) => (
                      <li key={item.id}>
                        <strong>{item.resourceName}</strong> {formatDateTime(item.startUtc, timeZone)} –{' '}
                        {formatDateTime(item.endUtc, timeZone)}
                        {item.technicalMinutesBefore > 0 || item.technicalMinutesAfter > 0 ? (
                          <span className="hortus-hint">
                            {' '}
                            (techniczny: przed {formatMinutes(item.technicalMinutesBefore)}, po{' '}
                            {formatMinutes(item.technicalMinutesAfter)})
                          </span>
                        ) : null}
                        {item.note ? <span className="hortus-hint"> — {item.note}</span> : null}
                      </li>
                    ))}
                  </ul>

                  {reservation.kind === 'reservation' ? (
                    <p className="hortus-contact">
                      {reservation.contactName}
                      {reservation.organization ? ` · ${reservation.organization}` : ''}
                      {reservation.contactPhone ? ` · ${reservation.contactPhone}` : ''}
                      {reservation.contactEmail ? ` · ${reservation.contactEmail}` : ''}
                      {reservation.guestCount ? ` · ${reservation.guestCount} os.` : ''}
                    </p>
                  ) : null}
                  {reservation.purposeNote ? <p className="hortus-note">{reservation.purposeNote}</p> : null}
                  {reservation.adminNote ? <p className="hortus-note hortus-note-admin">{reservation.adminNote}</p> : null}
                </div>

                <div className="hortus-reservation-actions">
                  {reservation.status !== 'confirmed' ? (
                    <button type="button" className="cta" disabled={busy} onClick={() => void decide(reservation, 'confirmed')}>
                      Potwierdź
                    </button>
                  ) : null}
                  {reservation.status !== 'confirmed' ? (
                    <button
                      type="button"
                      className="hortus-ghost"
                      disabled={busy}
                      onClick={() => void decide(reservation, 'confirmed', true)}
                    >
                      Potwierdź mimo to
                    </button>
                  ) : null}
                  {reservation.status === 'pending' ? (
                    <button type="button" className="hortus-ghost" disabled={busy} onClick={() => void decide(reservation, 'rejected')}>
                      Odrzuć
                    </button>
                  ) : null}
                  {reservation.status !== 'cancelled' ? (
                    <button type="button" className="hortus-ghost" disabled={busy} onClick={() => void decide(reservation, 'cancelled')}>
                      Odwołaj
                    </button>
                  ) : null}
                  {reservation.kind === 'block' ? (
                    <button type="button" className="hortus-danger" disabled={busy} onClick={() => void removeBlock(reservation)}>
                      Usuń blokadę
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {section === 'calendar' ? (
        <div>
          <div className="hortus-window-controls">
            <button type="button" onClick={() => setWindowStart(addDays(windowStart, -windowDays))}>
              ←
            </button>
            <input type="date" value={windowStart} onChange={(event) => setWindowStart(event.target.value || today())} />
            <button type="button" onClick={() => setWindowStart(addDays(windowStart, windowDays))}>
              →
            </button>
            <select value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}>
              {[7, 14, 30, 60].map((option) => (
                <option key={option} value={option}>
                  {option} dni
                </option>
              ))}
            </select>
          </div>
          <HortusTimeline
            resources={resourceNodes}
            occupancies={occupancies}
            from={windowStart}
            days={windowDays}
            timeZone={timeZone}
          />
        </div>
      ) : null}

      {section === 'new' && place ? (
        <HortusNewEntryForm
          slug={slug}
          place={place}
          resources={resourceNodes}
          onSaved={() => void refreshAll()}
        />
      ) : null}

      {section === 'resources' && place ? (
        <HortusResourceManager
          slug={slug}
          resources={site?.resources ?? []}
          onChanged={async () => {
            await loadResources();
            onSiteChanged();
          }}
        />
      ) : null}

      {section === 'settings' && place ? (
        <HortusSettingsForm
          slug={slug}
          place={place}
          onSaved={async () => {
            await loadResources();
            onSiteChanged();
          }}
        />
      ) : null}
    </section>
  );
}

/** Manual booking, or a technical block that closes a part for cleaning or repairs. */
function HortusNewEntryForm({
  slug,
  place,
  resources,
  onSaved
}: {
  slug: string;
  place: HortusPlaceView;
  resources: ReturnType<typeof flattenResources>;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<HortusReservationKind>('reservation');
  const [groupName, setGroupName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [items, setItems] = useState<HortusDraftItem[]>([]);
  const [check, setCheck] = useState<HortusCheckResponse | null>(null);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      setCheck(null);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const response = await checkHortusAdminAvailability(slug, items.map(toItemRequest));
        if (!cancelled) setCheck(response);
      } catch {
        if (!cancelled) setCheck(null);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [items, slug]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const created = await createHortusReservation(slug, {
        kind,
        status: 'confirmed',
        groupName: groupName || (kind === 'block' ? 'Przerwa techniczna' : 'Rezerwacja'),
        contactName: contactName || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        guestCount: guestCount ? Number(guestCount) : null,
        adminNote: adminNote || null,
        items: items.map(toItemRequest),
        force
      });
      setMessage(`Zapisano: ${created.code}`);
      setItems([]);
      setGroupName('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setGuestCount('');
      setAdminNote('');
      setForce(false);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? cleanError(err.message) : 'Nie udało się zapisać wpisu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="hortus-form" onSubmit={(event) => void submit(event)}>
      <div className="hortus-unit-switch" role="group" aria-label="Rodzaj wpisu">
        <button type="button" className={kind === 'reservation' ? 'is-active' : ''} onClick={() => setKind('reservation')}>
          Rezerwacja grupy
        </button>
        <button type="button" className={kind === 'block' ? 'is-active' : ''} onClick={() => setKind('block')}>
          Blokada techniczna
        </button>
      </div>
      <p className="hortus-hint">
        {kind === 'block'
          ? 'Blokada zamyka część niezależnie od limitu grup — na sprzątanie, remont czy przerwę w sezonie.'
          : 'Wpis koordynatora jest od razu potwierdzony i zajmuje kalendarz.'}
      </p>

      <div className="hortus-field-row">
        <label>
          {kind === 'block' ? 'Opis blokady' : 'Nazwa grupy'}
          <input type="text" maxLength={200} value={groupName} onChange={(event) => setGroupName(event.target.value)} />
        </label>
        {kind === 'reservation' ? (
          <>
            <label>
              Osoba odpowiedzialna
              <input type="text" maxLength={200} value={contactName} onChange={(event) => setContactName(event.target.value)} />
            </label>
            <label>
              Telefon
              <input type="tel" maxLength={32} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
            </label>
          </>
        ) : null}
      </div>

      {kind === 'reservation' ? (
        <div className="hortus-field-row">
          <label>
            E-mail
            <input type="email" maxLength={180} value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
          </label>
          <label>
            Liczba osób
            <input type="number" min={1} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} />
          </label>
        </div>
      ) : null}

      <label className="hortus-field-wide">
        Notatka koordynatora
        <textarea rows={2} maxLength={2000} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} />
      </label>

      <HortusItemEditor resources={resources} place={place} items={items} onChange={setItems} isAdmin />

      {check ? (
        <div className={`hortus-check ${check.isAvailable ? 'is-free' : 'is-busy'}`}>
          <strong>{check.isAvailable ? 'Termin wolny.' : 'Kolizja terminów.'}</strong>
          <ul>
            {check.conflicts.map((conflict, index) => (
              <li key={index}>{conflict.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="hortus-checkbox">
        <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
        Zapisz mimo kolizji
      </label>

      {error ? <p className="hortus-error">{error}</p> : null}
      {message ? <p className="hortus-success">{message}</p> : null}

      <button className="cta" type="submit" disabled={busy || items.length === 0}>
        {busy ? 'Zapisywanie…' : 'Zapisz wpis'}
      </button>
    </form>
  );
}

/** Capacity and technical minutes per part — the two numbers the whole engine runs on. */
function HortusResourceManager({
  slug,
  resources,
  onChanged
}: {
  slug: string;
  resources: HortusResourceView[];
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<HortusResourceUpsert>(EMPTY_RESOURCE_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nodes = useMemo(() => flattenResources(resources), [resources]);

  const startEdit = (resource: HortusResourceView) => {
    setEditing(resource.id);
    setError(null);
    setForm({
      parentId: resource.parentId,
      slug: resource.slug,
      name: resource.name,
      description: resource.description,
      kind: resource.kind,
      bookingUnit: resource.bookingUnit,
      capacity: resource.capacity,
      guestCapacity: resource.guestCapacity,
      technicalMinutesBefore: resource.technicalMinutesBefore,
      technicalMinutesAfter: resource.technicalMinutesAfter,
      isPubliclyBookable: resource.isPubliclyBookable,
      isActive: resource.isActive,
      sortOrder: resource.sortOrder,
      colorToken: resource.colorToken
    });
  };

  const startCreate = () => {
    setEditing('new');
    setError(null);
    const lastSortOrder = resources.length > 0 ? resources[resources.length - 1].sortOrder : 0;
    setForm({ ...EMPTY_RESOURCE_FORM, sortOrder: lastSortOrder + 10 });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editing === 'new') {
        await createHortusResource(slug, form);
      } else if (editing) {
        await updateHortusResource(slug, editing, form);
      }
      setEditing(null);
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? cleanError(err.message) : 'Nie udało się zapisać części.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (resource: HortusResourceView) => {
    setBusy(true);
    setError(null);
    try {
      await deleteHortusResource(slug, resource.id);
      await onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? cleanError(err.message) : 'Nie udało się usunąć części.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hortus-resources-admin">
      <div className="hortus-table-wrap">
        <table className="hortus-table">
          <thead>
            <tr>
              <th>Część</th>
              <th>Rezerwacja</th>
              <th>Grup naraz</th>
              <th>Techniczny przed / po</th>
              <th>Widoczna</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {nodes.map((resource) => (
              <tr key={resource.id} className={resource.isActive ? '' : 'is-inactive'}>
                <td style={{ paddingLeft: `${0.5 + resource.depth * 1}rem` }}>
                  {resource.name}
                  <span className="hortus-hint"> /{resource.slug}</span>
                </td>
                <td>{bookingUnitLabel(resource.bookingUnit)}</td>
                <td>{resource.capacity}</td>
                <td>
                  {formatMinutes(resource.technicalMinutesBefore)} / {formatMinutes(resource.technicalMinutesAfter)}
                </td>
                <td>{resource.isPubliclyBookable ? 'tak' : 'tylko koordynator'}</td>
                <td className="hortus-table-actions">
                  <button type="button" className="hortus-link-button" onClick={() => startEdit(resource)}>
                    edytuj
                  </button>
                  <button type="button" className="hortus-link-button" disabled={busy} onClick={() => void remove(resource)}>
                    usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="hortus-ghost" onClick={startCreate}>
        Dodaj część miejsca
      </button>

      {error ? <p className="hortus-error">{error}</p> : null}

      {editing ? (
        <form className="hortus-form hortus-resource-form" onSubmit={(event) => void save(event)}>
          <h3>{editing === 'new' ? 'Nowa część miejsca' : 'Edycja części'}</h3>
          <div className="hortus-field-row">
            <label>
              Nazwa
              <input type="text" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label>
              Identyfikator
              <input type="text" required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
            </label>
            <label>
              Część nadrzędna
              <select
                value={form.parentId ?? ''}
                onChange={(event) => setForm({ ...form, parentId: event.target.value || null })}
              >
                <option value="">— brak (poziom główny)</option>
                {nodes
                  .filter((node) => node.id !== editing)
                  .map((node) => (
                    <option key={node.id} value={node.id}>
                      {'— '.repeat(node.depth)}
                      {node.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="hortus-field-row">
            <label>
              Rodzaj
              <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
                {['whole', 'house', 'room', 'chapel', 'dining', 'grill', 'garden', 'other'].map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sposób rezerwacji
              <select
                value={form.bookingUnit}
                onChange={(event) => setForm({ ...form, bookingUnit: event.target.value as HortusResourceUpsert['bookingUnit'] })}
              >
                <option value="night">noclegi</option>
                <option value="slot">godziny</option>
                <option value="both">noclegi lub godziny</option>
              </select>
            </label>
            <label>
              Grup jednocześnie
              <input
                type="number"
                min={1}
                max={50}
                value={form.capacity}
                onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })}
              />
            </label>
            <label>
              Miejsc dla osób
              <input
                type="number"
                min={0}
                value={form.guestCapacity ?? ''}
                onChange={(event) =>
                  setForm({ ...form, guestCapacity: event.target.value === '' ? null : Number(event.target.value) })
                }
              />
            </label>
          </div>

          <div className="hortus-field-row">
            <label>
              Czas techniczny przed (min)
              <input
                type="number"
                min={0}
                step={15}
                value={form.technicalMinutesBefore}
                onChange={(event) => setForm({ ...form, technicalMinutesBefore: Number(event.target.value) })}
              />
            </label>
            <label>
              Czas techniczny po (min)
              <input
                type="number"
                min={0}
                step={15}
                value={form.technicalMinutesAfter}
                onChange={(event) => setForm({ ...form, technicalMinutesAfter: Number(event.target.value) })}
              />
            </label>
            <label>
              Kolejność
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
              />
            </label>
          </div>

          <label className="hortus-field-wide">
            Opis
            <textarea
              rows={2}
              value={form.description ?? ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>

          <div className="hortus-field-row">
            <label className="hortus-checkbox">
              <input
                type="checkbox"
                checked={form.isPubliclyBookable}
                onChange={(event) => setForm({ ...form, isPubliclyBookable: event.target.checked })}
              />
              Można rezerwować ze strony
            </label>
            <label className="hortus-checkbox">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              Aktywna
            </label>
          </div>

          <div className="hortus-form-actions">
            <button className="cta" type="submit" disabled={busy}>
              {busy ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button type="button" className="hortus-ghost" onClick={() => setEditing(null)}>
              Anuluj
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function HortusSettingsForm({
  slug,
  place,
  onSaved
}: {
  slug: string;
  place: HortusPlaceView;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: place.name,
    motto: place.motto,
    description: place.description,
    addressLine: place.addressLine,
    contactName: place.contactName,
    contactEmail: place.contactEmail,
    contactPhone: place.contactPhone,
    timeZoneId: place.timeZoneId,
    checkInTime: shortTime(place.checkInTime),
    checkOutTime: shortTime(place.checkOutTime),
    defaultTechnicalMinutes: place.defaultTechnicalMinutes,
    minLeadDays: place.minLeadDays,
    publicRequestsEnabled: place.publicRequestsEnabled
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateHortusSettings(slug, form);
      setMessage('Zapisano ustawienia.');
      await onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? cleanError(err.message) : 'Nie udało się zapisać ustawień.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="hortus-form" onSubmit={(event) => void save(event)}>
      <div className="hortus-field-row">
        <label>
          Nazwa miejsca
          <input type="text" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="hortus-field-wide">
          Motto
          <input type="text" value={form.motto} onChange={(event) => setForm({ ...form, motto: event.target.value })} />
        </label>
      </div>

      <label className="hortus-field-wide">
        Opis
        <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </label>

      <div className="hortus-field-row">
        <label className="hortus-field-wide">
          Adres
          <input type="text" value={form.addressLine} onChange={(event) => setForm({ ...form, addressLine: event.target.value })} />
        </label>
        <label>
          Koordynator
          <input type="text" value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} />
        </label>
      </div>

      <div className="hortus-field-row">
        <label>
          E-mail
          <input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
        </label>
        <label>
          Telefon
          <input type="tel" value={form.contactPhone} onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} />
        </label>
        <label>
          Strefa czasowa
          <input type="text" value={form.timeZoneId} onChange={(event) => setForm({ ...form, timeZoneId: event.target.value })} />
        </label>
      </div>

      <div className="hortus-field-row">
        <label>
          Zakwaterowanie od
          <input
            type="time"
            value={form.checkInTime}
            onChange={(event) => setForm({ ...form, checkInTime: event.target.value })}
          />
        </label>
        <label>
          Wyjazd do
          <input
            type="time"
            value={form.checkOutTime}
            onChange={(event) => setForm({ ...form, checkOutTime: event.target.value })}
          />
        </label>
        <label>
          Domyślny czas techniczny (min)
          <input
            type="number"
            min={0}
            step={15}
            value={form.defaultTechnicalMinutes}
            onChange={(event) => setForm({ ...form, defaultTechnicalMinutes: Number(event.target.value) })}
          />
        </label>
        <label>
          Minimalne wyprzedzenie (dni)
          <input
            type="number"
            min={0}
            value={form.minLeadDays}
            onChange={(event) => setForm({ ...form, minLeadDays: Number(event.target.value) })}
          />
        </label>
      </div>

      <label className="hortus-checkbox">
        <input
          type="checkbox"
          checked={form.publicRequestsEnabled}
          onChange={(event) => setForm({ ...form, publicRequestsEnabled: event.target.checked })}
        />
        Przyjmuj zgłoszenia przez stronę
      </label>

      {error ? <p className="hortus-error">{error}</p> : null}
      {message ? <p className="hortus-success">{message}</p> : null}

      <button className="cta" type="submit" disabled={busy}>
        {busy ? 'Zapisywanie…' : 'Zapisz ustawienia'}
      </button>
    </form>
  );
}
