import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  claimEvent2Admin,
  createEvent2Page,
  createEvent2Part,
  createEvent2Site,
  deleteEvent2Page,
  deleteEvent2Site,
  getEvent2AdminSite,
  getEvent2AdminSites,
  getEvent2AdminStatus,
  reorderEvent2Parts,
  updateEvent2Page,
  updateEvent2Site,
  type Event2AdminSite,
  type Event2AdminSiteSummary,
  type Event2AdminStatus,
  type Event2PartKind
} from '../../../../lib/api';
import { AreaRow, CheckRow, LinesRow, TextRow } from '../parts/editorKit';
import { PART_MODULES, partLabel } from '../parts/registry';
import { defaultLayersJson } from '../shell/layers';
import { getPartModule } from '../parts/registry';
import { AccessPanel } from './AccessPanel';
import { ImportPanel } from './ImportPanel';
import { PartEditor } from './PartEditor';

function publicUrl(slug: string): string {
  return `${window.location.origin}/#/event/event2/site/${slug}`;
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function Event2AdminPage() {
  const [status, setStatus] = useState<Event2AdminStatus | null>(null);
  const [sites, setSites] = useState<Event2AdminSiteSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showImport, setShowImport] = useState(false);

  const loadSites = useCallback(async () => {
    try {
      setSites(await getEvent2AdminSites());
      setError(null);
    } catch (loadError: unknown) {
      if (loadError instanceof ApiError && (loadError.status === 401 || loadError.status === 403)) return;
      setError(errorText(loadError, 'Nie udało się pobrać listy wydarzeń.'));
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getEvent2AdminStatus()
      .then(async (response) => {
        if (!active) return;
        setStatus(response);
        if (response.isCurrentUserAdmin) await loadSites();
      })
      .catch((statusError: unknown) => {
        if (active) setError(errorText(statusError, 'Nie udało się sprawdzić uprawnień.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadSites]);

  const claim = async () => {
    try {
      await claimEvent2Admin();
      const refreshed = await getEvent2AdminStatus();
      setStatus(refreshed);
      if (refreshed.isCurrentUserAdmin) await loadSites();
    } catch (claimError: unknown) {
      setError(errorText(claimError, 'Nie udało się przejąć panelu.'));
    }
  };

  const create = async () => {
    if (newSlug.trim().length === 0 || newTitle.trim().length === 0) {
      setError('Podaj adres i tytuł wydarzenia.');
      return;
    }
    try {
      const created = await createEvent2Site({
        slug: newSlug.trim(),
        title: newTitle.trim(),
        subtitle: null,
        summary: null,
        category: null,
        audience: null,
        places: null,
        thumbnailUrl: null,
        startDate: null,
        endDate: null,
        dateLabel: null,
        themeJson: null,
        isPublished: false
      });
      setNewSlug('');
      setNewTitle('');
      await loadSites();
      setSelected(created.id);
    } catch (createError: unknown) {
      setError(errorText(createError, 'Nie udało się utworzyć wydarzenia.'));
    }
  };

  if (loading) {
    return (
      <div className="e2a">
        <p className="e2a-hint">Ładowanie…</p>
      </div>
    );
  }

  if (!status?.isCurrentUserAdmin) {
    return (
      <div className="e2a">
        <header className="e2a-head">
          <h1>Kreator wydarzeń</h1>
          <p>Buduj stronę wydarzenia z gotowych części i nadawaj dostęp do stron wewnętrznych.</p>
        </header>
        <section className="e2a-panel">
          {status?.hasAdmin ? (
            <p>Panel jest przypisany do: {status.adminDisplayName ?? 'innego użytkownika'}.</p>
          ) : (
            <>
              <p>Panel nie ma jeszcze przypisanego administratora.</p>
              <button type="button" className="e2a-cta" onClick={() => void claim()}>
                Przejmij panel
              </button>
            </>
          )}
          {error ? <p className="e2a-error">{error}</p> : null}
        </section>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="e2a">
        <SiteEditor
          siteId={selected}
          onBack={() => {
            setSelected(null);
            void loadSites();
          }}
        />
      </div>
    );
  }

  return (
    <div className="e2a">
      <header className="e2a-head">
        <h1>Kreator wydarzeń</h1>
        <p>
          Najpierw powstaje strona publiczna. Potem dokładasz strony wewnętrzne i nadajesz do nich dostęp osobom, które
          się zapisały.
        </p>
      </header>

      <section className="e2a-panel">
        <header>
          <h3>Nowe wydarzenie</h3>
          <p>Zacznij od pustego wydarzenia albo zaimportuj gotowy JSON.</p>
        </header>
        <div className="e2a-grid">
          <TextRow label="Adres (slug)" value={newSlug} onChange={setNewSlug} placeholder="rajd-2026" />
          <TextRow label="Tytuł" value={newTitle} onChange={setNewTitle} placeholder="Rajd 2026" />
        </div>
        {error ? <p className="e2a-error">{error}</p> : null}
        <div className="e2a-actions">
          <button type="button" className="e2a-cta" onClick={() => void create()}>
            Utwórz puste wydarzenie
          </button>
          <button type="button" onClick={() => setShowImport((current) => !current)}>
            {showImport ? 'Ukryj import z JSON' : 'Importuj z JSON'}
          </button>
        </div>
      </section>

      {showImport ? (
        <ImportPanel
          mode={{ kind: 'site' }}
          onImported={(result) => {
            void loadSites();
            setSelected(result.siteId);
          }}
        />
      ) : null}

      <section className="e2a-panel">
        <header>
          <h3>Wydarzenia ({sites.length})</h3>
        </header>
        {sites.length === 0 ? (
          <p className="e2a-hint">Brak wydarzeń.</p>
        ) : (
          <ul className="e2a-site-list">
            {sites.map((site) => (
              <li key={site.id}>
                <button type="button" onClick={() => setSelected(site.id)}>
                  <strong>{site.title}</strong>
                  <span className="e2a-sub">/{site.slug}</span>
                  <span className={`e2a-pill ${site.isPublished ? 'is-live' : ''}`}>
                    {site.isPublished ? 'Opublikowane' : 'Szkic'}
                  </span>
                  <span className="e2a-sub">
                    {site.pageCount} stron · {site.partCount} części · {site.linkCount} linków ·{' '}
                    {site.registrationCount} zgłoszeń
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Site editor ──────────────────────────────────────────────────────────────

function SiteEditor({ siteId, onBack }: { siteId: string; onBack: () => void }) {
  const [data, setData] = useState<Event2AdminSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [tab, setTab] = useState<'pages' | 'access' | 'settings'>('pages');
  const [newPartKind, setNewPartKind] = useState<Event2PartKind>('text');
  const [showPartImport, setShowPartImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getEvent2AdminSite(siteId);
      setData(response);
      setActivePageId((current) => current ?? response.pages[0]?.id ?? null);
      setError(null);
    } catch (loadError: unknown) {
      setError(errorText(loadError, 'Nie udało się pobrać wydarzenia.'));
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <p className="e2a-hint">Ładowanie…</p>;
  if (!data) return <p className="e2a-error">{error ?? 'Nie znaleziono wydarzenia.'}</p>;

  const activePage = data.pages.find((page) => page.id === activePageId) ?? data.pages[0] ?? null;

  const addPart = async () => {
    if (!activePage) return;
    const module = getPartModule(newPartKind);
    const label = partLabel(newPartKind);
    try {
      await createEvent2Part(activePage.id, {
        kind: newPartKind,
        menuLabel: label,
        title: newPartKind === 'title' ? null : label,
        intro: null,
        configJson: module?.defaultConfigJson() ?? null,
        layersJson: defaultLayersJson(label),
        isVisible: true
      });
      await load();
    } catch (addError: unknown) {
      setError(errorText(addError, 'Nie udało się dodać części.'));
    }
  };

  const movePart = async (index: number, direction: -1 | 1) => {
    if (!activePage) return;
    const ordered = [...activePage.parts].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    await reorderEvent2Parts(activePage.id, ordered.map((part) => part.id));
    await load();
  };

  const addPage = async () => {
    const title = window.prompt('Nazwa nowej strony wewnętrznej (np. „Prowadzący trasę”)');
    if (!title || title.trim().length === 0) return;
    try {
      const created = await createEvent2Page(siteId, {
        slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: title.trim(),
        menuLabel: title.trim(),
        description: null
      });
      await load();
      setActivePageId(created.id);
    } catch (addError: unknown) {
      setError(errorText(addError, 'Nie udało się dodać strony.'));
    }
  };

  const removePage = async () => {
    if (!activePage || activePage.kind === 'public') return;
    if (!window.confirm(`Usunąć stronę „${activePage.menuLabel}” razem ze wszystkimi jej częściami?`)) return;
    await deleteEvent2Page(activePage.id);
    setActivePageId(null);
    await load();
  };

  const sortedParts = activePage ? [...activePage.parts].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  return (
    <div className="e2a-editor">
      <div className="e2a-editor-head">
        <button type="button" className="e2a-ghost" onClick={onBack}>
          ← Wszystkie wydarzenia
        </button>
        <strong>{data.site.title}</strong>
        <a className="e2a-ghost" href={publicUrl(data.site.slug)} target="_blank" rel="noreferrer">
          Podgląd strony publicznej
        </a>
      </div>

      <nav className="e2a-tabs">
        <button type="button" className={tab === 'pages' ? 'active' : ''} onClick={() => setTab('pages')}>
          Strony i części
        </button>
        <button type="button" className={tab === 'access' ? 'active' : ''} onClick={() => setTab('access')}>
          Zgłoszenia i dostęp
        </button>
        <button type="button" className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          Ustawienia
        </button>
      </nav>

      {error ? <p className="e2a-error">{error}</p> : null}

      {tab === 'pages' ? (
        <>
          <section className="e2a-panel">
            <header>
              <h3>Strony</h3>
              <p>Strona publiczna jest jedna. Strony wewnętrzne widzi tylko ten, komu nadasz do nich dostęp.</p>
            </header>
            <div className="e2a-page-tabs">
              {data.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className={page.id === activePage?.id ? 'active' : ''}
                  onClick={() => setActivePageId(page.id)}
                >
                  {page.kind === 'internal' ? <span className="e2a-page-mark">●</span> : null}
                  {page.menuLabel}
                  <span className="e2a-sub">{page.parts.length}</span>
                </button>
              ))}
              <button type="button" className="e2a-add-page" onClick={() => void addPage()}>
                + Strona wewnętrzna
              </button>
            </div>
          </section>

          {activePage ? (
            <>
              <PageSettings page={activePage} onSaved={() => void load()} onRemove={removePage} />

              <section className="e2a-panel">
                <header>
                  <h3>Części strony „{activePage.menuLabel}”</h3>
                  <p>Kolejność części to kolejność slajdów na stronie.</p>
                </header>

                <div className="e2a-add-part">
                  <select
                    value={newPartKind}
                    onChange={(event) => setNewPartKind(event.target.value as Event2PartKind)}
                  >
                    {PART_MODULES.map((module) => (
                      <option key={module.kind} value={module.kind}>
                        {module.label} — {module.description}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="e2a-cta" onClick={() => void addPart()}>
                    Dodaj część
                  </button>
                  <button type="button" onClick={() => setShowPartImport((current) => !current)}>
                    {showPartImport ? 'Ukryj import' : 'Importuj z JSON'}
                  </button>
                </div>

                {showPartImport ? (
                  <ImportPanel
                    mode={{ kind: 'parts', pageId: activePage.id, pageLabel: activePage.menuLabel }}
                    onImported={() => void load()}
                  />
                ) : null}

                {sortedParts.length === 0 ? (
                  <p className="e2a-hint">Ta strona nie ma jeszcze części.</p>
                ) : (
                  <div className="e2a-part-list">
                    {sortedParts.map((part, index) => (
                      <PartEditor
                        key={part.id}
                        part={part}
                        isFirst={index === 0}
                        isLast={index === sortedParts.length - 1}
                        onMove={(direction) => void movePart(index, direction)}
                        onChanged={() => void load()}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'access' ? <AccessPanel siteId={siteId} pages={data.pages} /> : null}

      {tab === 'settings' ? <SiteSettings data={data} siteId={siteId} onSaved={() => void load()} onBack={onBack} /> : null}
    </div>
  );
}

function PageSettings({
  page,
  onSaved,
  onRemove
}: {
  page: Event2AdminSite['pages'][number];
  onSaved: () => void;
  onRemove: () => void;
}) {
  const [menuLabel, setMenuLabel] = useState(page.menuLabel);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [description, setDescription] = useState(page.description ?? '');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setMenuLabel(page.menuLabel);
    setTitle(page.title);
    setSlug(page.slug);
    setDescription(page.description ?? '');
  }, [page]);

  const save = async () => {
    setPending(true);
    try {
      await updateEvent2Page(page.id, {
        slug: slug.trim(),
        title: title.trim(),
        menuLabel: menuLabel.trim(),
        description: description.trim() || null
      });
      onSaved();
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="e2a-panel">
      <header>
        <h3>Ustawienia strony</h3>
        <p>{page.kind === 'public' ? 'To jest strona publiczna wydarzenia.' : 'Strona wewnętrzna.'}</p>
      </header>
      <div className="e2a-grid">
        <TextRow label="Etykieta" value={menuLabel} onChange={setMenuLabel} />
        <TextRow label="Tytuł" value={title} onChange={setTitle} />
      </div>
      <TextRow label="Adres (slug)" value={slug} onChange={setSlug} />
      <TextRow label="Opis" value={description} onChange={setDescription} />
      <div className="e2a-actions">
        <button type="button" className="e2a-cta" onClick={() => void save()} disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz stronę'}
        </button>
        {page.kind !== 'public' ? (
          <button type="button" className="e2a-danger" onClick={onRemove}>
            Usuń stronę
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SiteSettings({
  data,
  siteId,
  onSaved,
  onBack
}: {
  data: Event2AdminSite;
  siteId: string;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [slug, setSlug] = useState(data.site.slug);
  const [title, setTitle] = useState(data.site.title);
  const [subtitle, setSubtitle] = useState(data.site.subtitle ?? '');
  const [summary, setSummary] = useState(data.catalogue.summary ?? '');
  const [category, setCategory] = useState(data.catalogue.category ?? '');
  const [audience, setAudience] = useState(data.catalogue.audience ?? '');
  const [places, setPlaces] = useState<string[]>(data.catalogue.places);
  const [thumbnailUrl, setThumbnailUrl] = useState(data.catalogue.thumbnailUrl ?? '');
  const [startDate, setStartDate] = useState(data.catalogue.startDate ?? '');
  const [endDate, setEndDate] = useState(data.catalogue.endDate ?? '');
  const [dateLabel, setDateLabel] = useState(data.site.dateLabel ?? '');
  const [published, setPublished] = useState(data.isPublished);
  const [accent, setAccent] = useState('#4c7dd6');
  const [ground, setGround] = useState('#080d15');
  const [ink, setInk] = useState('#eef2f8');
  const [muted, setMuted] = useState('#a3b2c9');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const theme = data.site.themeJson ? (JSON.parse(data.site.themeJson) as Record<string, string>) : {};
      setAccent(theme.accent ?? '#4c7dd6');
      setGround(theme.ground ?? '#080d15');
      setInk(theme.ink ?? '#eef2f8');
      setMuted(theme.muted ?? '#a3b2c9');
    } catch {
      // Malformed stored theme just falls back to the defaults above.
    }
  }, [data.site.themeJson]);

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      await updateEvent2Site(siteId, {
        slug: slug.trim(),
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        summary: summary.trim() || null,
        category: category.trim() || null,
        audience: audience.trim() || null,
        places,
        thumbnailUrl: thumbnailUrl.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
        dateLabel: dateLabel.trim() || null,
        themeJson: JSON.stringify({ accent, ground, ink, muted }),
        isPublished: published
      });
      onSaved();
    } catch (saveError: unknown) {
      setError(errorText(saveError, 'Nie udało się zapisać.'));
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Usunąć wydarzenie „${title}” ze wszystkimi stronami, linkami i zgłoszeniami?`)) return;
    await deleteEvent2Site(siteId);
    onBack();
  };

  return (
    <section className="e2a-panel">
      <header>
        <h3>Ustawienia wydarzenia</h3>
        <p>Adres publiczny: {publicUrl(data.site.slug)}</p>
      </header>

      <div className="e2a-grid">
        <TextRow label="Adres (slug)" value={slug} onChange={setSlug} />
        <TextRow label="Tytuł" value={title} onChange={setTitle} />
      </div>
      <TextRow label="Podtytuł" value={subtitle} onChange={setSubtitle} hint="Hasło na samej stronie wydarzenia." />

      <fieldset className="e2e-group">
        <legend>Dane do przeglądu wydarzeń</legend>
        <p className="e2e-hint">
          To, po czym wydarzenie da się znaleźć, przefiltrować i posortować na liście wszystkich wydarzeń.
        </p>

        <AreaRow
          label="Krótki opis"
          rows={2}
          hint="Jedno–dwa zdania na kafelku listy."
          value={summary}
          onChange={setSummary}
        />

        <div className="e2a-grid">
          <TextRow
            label="Grupa wydarzeń"
            value={category}
            hint="Np. Pielgrzymka rowerowa, Warsztaty muzyczne."
            onChange={setCategory}
          />
          <TextRow
            label="Dla kogo"
            value={audience}
            hint="Np. Młodzież 16–30, Rodziny."
            onChange={setAudience}
          />
        </div>

        <LinesRow
          label="Główne miejsca"
          values={places}
          rows={3}
          hint="Jedno miejsce na linię, w kolejności trasy. Po nich działa filtr miejsc."
          onChange={setPlaces}
        />

        <div className="e2a-grid">
          <label className="e2e-row">
            <span>Data rozpoczęcia</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="e2e-row">
            <span>Data zakończenia</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>

        <TextRow
          label="Termin — zapis własny"
          value={dateLabel}
          hint="Zostaw puste, żeby wyliczyć z dat powyżej."
          onChange={setDateLabel}
        />

        <TextRow
          label="Miniatura"
          value={thumbnailUrl}
          hint="Adres obrazka na kafelku listy."
          onChange={setThumbnailUrl}
        />
      </fieldset>

      <fieldset className="e2e-group">
        <legend>Motyw</legend>
        <div className="e2a-colors">
          <label>
            <span>Akcent</span>
            <input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} />
          </label>
          <label>
            <span>Tło</span>
            <input type="color" value={ground} onChange={(event) => setGround(event.target.value)} />
          </label>
          <label>
            <span>Tekst</span>
            <input type="color" value={ink} onChange={(event) => setInk(event.target.value)} />
          </label>
          <label>
            <span>Tekst drugorzędny</span>
            <input type="color" value={muted} onChange={(event) => setMuted(event.target.value)} />
          </label>
        </div>
      </fieldset>

      <CheckRow label="Opublikowane (widoczne pod adresem publicznym)" checked={published} onChange={setPublished} />

      {error ? <p className="e2a-error">{error}</p> : null}

      <div className="e2a-actions">
        <button type="button" className="e2a-cta" onClick={() => void save()} disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </button>
        <button type="button" className="e2a-danger" onClick={() => void remove()}>
          Usuń wydarzenie
        </button>
      </div>
    </section>
  );
}
