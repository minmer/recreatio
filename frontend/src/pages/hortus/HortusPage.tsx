import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import {
  bootstrapHortus,
  cancelHortusRequest,
  checkHortusAvailability,
  claimHortusAdmin,
  getHortusAdminStatus,
  getHortusAvailability,
  getHortusRequest,
  getHortusSite,
  submitHortusRequest,
  type HortusAdminStatusResponse,
  type HortusCheckResponse,
  type HortusOccupancyView,
  type HortusReservationPublicView,
  type HortusSiteResponse
} from '../../lib/api';
import { HortusItemEditor } from './HortusItemEditor';
import { HortusTimeline } from './HortusTimeline';
import {
  addDays,
  bookingUnitLabel,
  flattenResources,
  formatDateTime,
  formatMinutes,
  RESOURCE_KIND_LABELS,
  resolveTimeZone,
  shortTime,
  STATUS_LABELS,
  today
} from './hortusTime';
import { draftInterval, toItemRequest, type HortusDraftItem } from './hortusDraft';
import '../../styles/hortus.css';

const HortusAdminPanel = lazy(() =>
  import('./HortusAdminPanel').then((module) => ({ default: module.HortusAdminPanel }))
);

const DEFAULT_SLUG = 'hortus-dei';
const RANGE_OPTIONS = [7, 14, 30];

type Tab = 'plan' | 'status' | 'admin';

export function HortusPage({
  copy,
  onNavigate,
  showProfileMenu
}: {
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
  showProfileMenu: boolean;
}) {
  const [site, setSite] = useState<HortusSiteResponse | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<HortusAdminStatusResponse | null>(null);
  const [setupPending, setSetupPending] = useState(false);
  const [tab, setTab] = useState<Tab>('plan');

  const [windowStart, setWindowStart] = useState(today());
  const [windowDays, setWindowDays] = useState(14);
  const [occupancies, setOccupancies] = useState<HortusOccupancyView[]>([]);

  const [items, setItems] = useState<HortusDraftItem[]>([]);
  const [check, setCheck] = useState<HortusCheckResponse | null>(null);
  const [checkPending, setCheckPending] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [organization, setOrganization] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [purposeNote, setPurposeNote] = useState('');
  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ code: string; token: string } | null>(null);

  const [lookupCode, setLookupCode] = useState('');
  const [lookupToken, setLookupToken] = useState('');
  const [lookupResult, setLookupResult] = useState<HortusReservationPublicView | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  const place = site?.place ?? null;
  const timeZone = resolveTimeZone(place?.timeZoneIana ?? place?.timeZoneId);
  const resourceNodes = useMemo(() => flattenResources(site?.resources ?? []), [site]);
  const publicNodes = useMemo(
    () => resourceNodes.filter((resource) => resource.isActive && resource.isPubliclyBookable),
    [resourceNodes]
  );

  const loadSite = useCallback(async () => {
    try {
      const response = await getHortusSite(DEFAULT_SLUG);
      setSite(response);
      setSiteError(null);
    } catch (error: unknown) {
      setSiteError(error instanceof Error ? error.message : 'Nie udało się wczytać danych miejsca.');
    }
  }, []);

  const loadAdminStatus = useCallback(async () => {
    try {
      setAdminStatus(await getHortusAdminStatus());
    } catch {
      setAdminStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadSite();
  }, [loadSite]);

  useEffect(() => {
    void loadAdminStatus();
  }, [loadAdminStatus, showProfileMenu]);

  useEffect(() => {
    if (!site?.isProvisioned) {
      setOccupancies([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await getHortusAvailability(
          DEFAULT_SLUG,
          windowStart,
          addDays(windowStart, windowDays - 1)
        );
        if (!cancelled) setOccupancies(response.occupancies);
      } catch {
        if (!cancelled) setOccupancies([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [site?.isProvisioned, windowStart, windowDays, submitted]);

  // The basket is re-checked as it is edited, so a group learns about a clash while still choosing.
  useEffect(() => {
    if (items.length === 0) {
      setCheck(null);
      return;
    }

    let cancelled = false;
    setCheckPending(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await checkHortusAvailability(DEFAULT_SLUG, items.map(toItemRequest));
        if (!cancelled) setCheck(response);
      } catch (error: unknown) {
        if (!cancelled) {
          setCheck({
            isAvailable: false,
            items: [],
            conflicts: [
              {
                resourceId: '',
                resourceName: '',
                reason: 'capacity',
                message: error instanceof Error ? cleanError(error.message) : 'Nie udało się sprawdzić terminu.',
                blockingCode: null,
                blockingStatus: null,
                fromUtc: '',
                untilUtc: ''
              }
            ],
            warnings: []
          });
        }
      } finally {
        if (!cancelled) setCheckPending(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [items]);

  const drafts = useMemo(() => {
    if (!place) return [];
    return items.flatMap((item) => {
      const interval = draftInterval(item, place);
      if (!interval) return [];
      const resource = resourceNodes.find((node) => node.id === item.resourceId);
      return [{ resourceId: item.resourceId, label: resource?.name ?? 'Wybór', ...interval }];
    });
  }, [items, place, resourceNodes]);

  const handleClaimAdmin = async () => {
    setSetupPending(true);
    try {
      await claimHortusAdmin();
      await loadAdminStatus();
    } catch (error: unknown) {
      setSiteError(error instanceof Error ? cleanError(error.message) : 'Nie udało się przejąć roli koordynatora.');
    } finally {
      setSetupPending(false);
    }
  };

  const handleBootstrap = async () => {
    setSetupPending(true);
    try {
      await bootstrapHortus();
      await loadSite();
      await loadAdminStatus();
    } catch (error: unknown) {
      setSiteError(error instanceof Error ? cleanError(error.message) : 'Nie udało się przygotować miejsca.');
    } finally {
      setSetupPending(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (items.length === 0) {
      setSubmitError('Wybierz przynajmniej jedną część miejsca.');
      return;
    }

    setSubmitPending(true);
    try {
      const response = await submitHortusRequest(DEFAULT_SLUG, {
        groupName,
        organization: organization || null,
        contactName,
        contactEmail,
        contactPhone,
        guestCount: guestCount ? Number(guestCount) : null,
        purposeNote: purposeNote || null,
        items: items.map(toItemRequest)
      });
      setSubmitted({ code: response.code, token: response.token });
      setItems([]);
      setCheck(null);
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? cleanError(error.message) : 'Nie udało się wysłać zgłoszenia.');
    } finally {
      setSubmitPending(false);
    }
  };

  const handleLookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLookupError(null);
    setLookupPending(true);
    try {
      setLookupResult(await getHortusRequest(DEFAULT_SLUG, lookupCode.trim(), lookupToken.trim()));
    } catch {
      setLookupResult(null);
      setLookupError('Nie znaleziono rezerwacji o takim numerze i kluczu.');
    } finally {
      setLookupPending(false);
    }
  };

  const handleCancel = async () => {
    if (!lookupResult) return;
    setLookupPending(true);
    try {
      setLookupResult(await cancelHortusRequest(DEFAULT_SLUG, lookupResult.code, lookupToken.trim()));
    } catch (error: unknown) {
      setLookupError(error instanceof Error ? cleanError(error.message) : 'Nie udało się odwołać rezerwacji.');
    } finally {
      setLookupPending(false);
    }
  };

  const isCoordinator = adminStatus?.isCurrentUserAdmin === true;

  return (
    <div className="portal-page hortus-page">
      <main className="hortus-main">
        <header className="hortus-hero">
          <p className="tag">REcreatio</p>
          <h1>{place?.name ?? 'Hortus Dei'}</h1>
          <p className="hortus-motto">{place?.motto}</p>
          {place?.description ? <p className="hortus-lead">{place.description}</p> : null}
          <dl className="hortus-facts">
            {place?.addressLine ? (
              <div>
                <dt>Adres</dt>
                <dd>{place.addressLine}</dd>
              </div>
            ) : null}
            {place?.contactName || place?.contactPhone || place?.contactEmail ? (
              <div>
                <dt>Koordynator</dt>
                <dd>
                  {place?.contactName}
                  {place?.contactPhone ? ` · ${place.contactPhone}` : ''}
                  {place?.contactEmail ? ` · ${place.contactEmail}` : ''}
                </dd>
              </div>
            ) : null}
            {place ? (
              <div>
                <dt>Doba</dt>
                <dd>
                  od {shortTime(place.checkInTime)} do {shortTime(place.checkOutTime)}
                </dd>
              </div>
            ) : null}
          </dl>
        </header>

        {siteError ? <p className="hortus-error">{siteError}</p> : null}

        {site && !site.isProvisioned ? (
          <section className="hortus-card hortus-setup">
            <h2>Rezerwacje nie są jeszcze uruchomione</h2>
            <p>
              Strona czeka na koordynatora. Po zalogowaniu można przejąć tę rolę i utworzyć układ
              miejsca — całe Hortus Dei, dom główny z kaplicą i jadalnią, dwa domki oraz ogród.
            </p>
            {showProfileMenu && adminStatus && !adminStatus.hasAdmin ? (
              <button className="cta" type="button" onClick={() => void handleClaimAdmin()} disabled={setupPending}>
                {setupPending ? 'Ustawianie…' : 'Zostań koordynatorem Hortus Dei'}
              </button>
            ) : null}
            {showProfileMenu && isCoordinator ? (
              <button className="cta" type="button" onClick={() => void handleBootstrap()} disabled={setupPending}>
                {setupPending ? 'Przygotowywanie…' : 'Utwórz układ miejsca'}
              </button>
            ) : null}
            {adminStatus?.hasAdmin && !isCoordinator ? (
              <p className="hortus-hint">Koordynator: {adminStatus.adminDisplayName ?? 'ustawiony'}.</p>
            ) : null}
          </section>
        ) : null}

        {site?.isProvisioned ? (
          <>
            <nav className="hortus-tabs">
              <button type="button" className={tab === 'plan' ? 'is-active' : ''} onClick={() => setTab('plan')}>
                Rezerwacja
              </button>
              <button type="button" className={tab === 'status' ? 'is-active' : ''} onClick={() => setTab('status')}>
                Moje zgłoszenie
              </button>
              {isCoordinator ? (
                <button type="button" className={tab === 'admin' ? 'is-active' : ''} onClick={() => setTab('admin')}>
                  Panel koordynatora
                </button>
              ) : null}
            </nav>

            {tab === 'plan' ? (
              <>
                <section className="hortus-card">
                  <div className="hortus-card-head">
                    <h2>Co jest wolne</h2>
                    <div className="hortus-window-controls">
                      <button type="button" onClick={() => setWindowStart(addDays(windowStart, -windowDays))}>
                        ←
                      </button>
                      <input
                        type="date"
                        value={windowStart}
                        onChange={(event) => setWindowStart(event.target.value || today())}
                      />
                      <button type="button" onClick={() => setWindowStart(addDays(windowStart, windowDays))}>
                        →
                      </button>
                      <select value={windowDays} onChange={(event) => setWindowDays(Number(event.target.value))}>
                        {RANGE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option} dni
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setWindowStart(today())}>
                        dziś
                      </button>
                    </div>
                  </div>
                  <p className="hortus-hint">
                    Jasne końcówki pasków to czas techniczny — sprzątanie i przygotowanie części dla
                    kolejnej grupy. Części oznaczone jako dzielone mogą przyjąć więcej niż jedną grupę naraz.
                  </p>
                  <HortusTimeline
                    resources={publicNodes}
                    occupancies={occupancies}
                    from={windowStart}
                    days={windowDays}
                    timeZone={timeZone}
                    drafts={drafts}
                  />
                </section>

                <section className="hortus-card">
                  <h2>Części miejsca</h2>
                  <ul className="hortus-resource-grid">
                    {publicNodes.map((resource) => (
                      <li key={resource.id} className={`hortus-resource-card hortus-color-${resource.colorToken}`}>
                        <div className="hortus-resource-head">
                          <h3>{resource.name}</h3>
                          <span className="hortus-chip">{RESOURCE_KIND_LABELS[resource.kind] ?? resource.kind}</span>
                        </div>
                        {resource.description ? <p>{resource.description}</p> : null}
                        <ul className="hortus-resource-facts">
                          <li>Rezerwacja: {bookingUnitLabel(resource.bookingUnit)}</li>
                          <li>
                            {resource.capacity > 1
                              ? `Do ${resource.capacity} grup jednocześnie`
                              : 'Na wyłączność jednej grupy'}
                          </li>
                          {resource.guestCapacity ? <li>Do {resource.guestCapacity} osób</li> : null}
                          {resource.technicalMinutesAfter > 0 ? (
                            <li>Czas techniczny po: {formatMinutes(resource.technicalMinutesAfter)}</li>
                          ) : null}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="hortus-card">
                  <h2>Zgłoszenie rezerwacji</h2>
                  {!place?.publicRequestsEnabled ? (
                    <p className="hortus-warning">
                      Zgłoszenia przez stronę są chwilowo wyłączone. Prosimy o kontakt z koordynatorem.
                    </p>
                  ) : null}

                  {place ? (
                    <HortusItemEditor resources={resourceNodes} place={place} items={items} onChange={setItems} />
                  ) : null}

                  {checkPending ? <p className="hortus-hint">Sprawdzanie dostępności…</p> : null}
                  {check && !checkPending ? (
                    <div className={`hortus-check ${check.isAvailable ? 'is-free' : 'is-busy'}`}>
                      <strong>{check.isAvailable ? 'Termin jest wolny.' : 'Termin koliduje z inną rezerwacją.'}</strong>
                      <ul>
                        {check.conflicts.map((conflict, index) => (
                          <li key={`conflict-${index}`}>{conflict.message}</li>
                        ))}
                        {check.warnings.map((warning, index) => (
                          <li key={`warning-${index}`} className="hortus-warning">
                            Uwaga: o ten termin prosi już inna grupa ({warning.resourceName}). Decyduje koordynator.
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <form className="hortus-form" onSubmit={(event) => void handleSubmit(event)}>
                    <div className="hortus-field-row">
                      <label>
                        Nazwa grupy *
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={groupName}
                          onChange={(event) => setGroupName(event.target.value)}
                        />
                      </label>
                      <label>
                        Parafia / wspólnota
                        <input
                          type="text"
                          maxLength={200}
                          value={organization}
                          onChange={(event) => setOrganization(event.target.value)}
                        />
                      </label>
                      <label>
                        Liczba osób
                        <input
                          type="number"
                          min={1}
                          value={guestCount}
                          onChange={(event) => setGuestCount(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="hortus-field-row">
                      <label>
                        Osoba odpowiedzialna *
                        <input
                          type="text"
                          required
                          maxLength={200}
                          value={contactName}
                          onChange={(event) => setContactName(event.target.value)}
                        />
                      </label>
                      <label>
                        E-mail
                        <input
                          type="email"
                          maxLength={180}
                          value={contactEmail}
                          onChange={(event) => setContactEmail(event.target.value)}
                        />
                      </label>
                      <label>
                        Telefon
                        <input
                          type="tel"
                          maxLength={32}
                          value={contactPhone}
                          onChange={(event) => setContactPhone(event.target.value)}
                        />
                      </label>
                    </div>
                    <label className="hortus-field-wide">
                      Cel spotkania, uwagi
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={purposeNote}
                        onChange={(event) => setPurposeNote(event.target.value)}
                      />
                    </label>

                    {submitError ? <p className="hortus-error">{submitError}</p> : null}

                    <button
                      className="cta"
                      type="submit"
                      disabled={submitPending || items.length === 0 || !place?.publicRequestsEnabled}
                    >
                      {submitPending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
                    </button>
                    <p className="hortus-hint">
                      Zgłoszenie trafia do koordynatora. Rezerwacja jest wiążąca dopiero po potwierdzeniu.
                    </p>
                  </form>

                  {submitted ? (
                    <div className="hortus-receipt">
                      <h3>Zgłoszenie przyjęte</h3>
                      <p>
                        Numer: <strong>{submitted.code}</strong>
                      </p>
                      <p>
                        Klucz dostępu: <code>{submitted.token}</code>
                      </p>
                      <p className="hortus-hint">
                        Zachowaj numer i klucz — pozwalają sprawdzić status lub odwołać zgłoszenie w
                        zakładce „Moje zgłoszenie”.
                      </p>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}

            {tab === 'status' ? (
              <section className="hortus-card">
                <h2>Moje zgłoszenie</h2>
                <form className="hortus-form" onSubmit={(event) => void handleLookup(event)}>
                  <div className="hortus-field-row">
                    <label>
                      Numer zgłoszenia
                      <input
                        type="text"
                        required
                        value={lookupCode}
                        placeholder="HD-XXXXXX"
                        onChange={(event) => setLookupCode(event.target.value)}
                      />
                    </label>
                    <label className="hortus-field-wide">
                      Klucz dostępu
                      <input
                        type="text"
                        required
                        value={lookupToken}
                        onChange={(event) => setLookupToken(event.target.value)}
                      />
                    </label>
                  </div>
                  <button className="cta" type="submit" disabled={lookupPending}>
                    {lookupPending ? 'Szukanie…' : 'Sprawdź'}
                  </button>
                </form>

                {lookupError ? <p className="hortus-error">{lookupError}</p> : null}

                {lookupResult ? (
                  <div className="hortus-lookup-result">
                    <p>
                      <strong>{lookupResult.groupName}</strong> — status:{' '}
                      <span className={`hortus-status hortus-status-${lookupResult.status}`}>
                        {STATUS_LABELS[lookupResult.status] ?? lookupResult.status}
                      </span>
                    </p>
                    <ul className="hortus-item-list">
                      {lookupResult.items.map((item) => (
                        <li key={item.id}>
                          <strong>{item.resourceName}</strong>{' '}
                          {formatDateTime(item.startUtc, timeZone)} – {formatDateTime(item.endUtc, timeZone)}
                          {item.technicalMinutesAfter > 0 ? (
                            <span className="hortus-hint">
                              {' '}
                              (+ {formatMinutes(item.technicalMinutesAfter)} czasu technicznego)
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {lookupResult.status === 'pending' || lookupResult.status === 'confirmed' ? (
                      <button type="button" className="hortus-danger" onClick={() => void handleCancel()} disabled={lookupPending}>
                        Odwołaj zgłoszenie
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            {tab === 'admin' && isCoordinator ? (
              <Suspense fallback={<p className="hortus-hint">Wczytywanie panelu…</p>}>
                <HortusAdminPanel slug={DEFAULT_SLUG} onSiteChanged={() => void loadSite()} />
              </Suspense>
            ) : null}
          </>
        ) : null}
      </main>

      <footer className="portal-footer hortus-footer">
        <a className="portal-brand portal-footer-brand" href="/#/">
          <img src="/logo_inv.svg" alt="Recreatio" />
        </a>
        <span>{copy.footer.headline}</span>
        <a className="ghost" href="/#/section-1" onClick={() => onNavigate('home')}>
          {copy.nav.home}
        </a>
      </footer>
    </div>
  );
}

/** API errors arrive as the raw JSON body; show the message inside it when there is one. */
export function cleanError(message: string): string {
  try {
    const parsed = JSON.parse(message) as { error?: string };
    return parsed.error ?? message;
  } catch {
    return message;
  }
}
