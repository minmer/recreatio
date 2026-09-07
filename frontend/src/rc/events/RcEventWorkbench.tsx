/**
 * Der Herausgeber einer Veranstaltung, unter eigener Adresse.
 *
 * <b>Warum er eine Adresse hat.</b> `…/kal26/edit` laesst sich verschicken, als
 * Lesezeichen ablegen und mit „zurueck" verlassen — dieselbe Regel, aus der
 * auch ein Teil eine Adresse hat. Der Herausgeber steckte bisher als Block
 * unter der Werkstattliste; wer daran arbeitete, konnte niemandem sagen, wo.
 *
 * <b>Drei Reiter, drei Zustaendigkeiten.</b>
 *
 * <code>
 *   Strony i części    was auf der Seite steht
 *   Zgłoszenia         wer sich gemeldet hat — und wer das lesen darf
 *   Ustawienia         Termin, Katalog, Veroeffentlichen
 * </code>
 *
 * Sie stehen NICHT alle untereinander. Der Bauplan ist lang, und wer die
 * Anmeldungen sehen will, will nicht erst an einundzwanzig Abschnitten vorbei.
 *
 * <b>Der Weg zurueck zur oeffentlichen Seite steht oben.</b> Wer baut, will
 * sehen, was dabei herauskommt — und zwar so, wie es ein Fremder sieht.
 */

import { useCallback, useEffect, useState } from 'react';

import { rcEvent, rcPublishEvent, type RcEventView } from '../lib/rcEvents';
import { rcUpdateEvent } from '../lib/rcEventEditing';
import { rcPath } from '../lib/rcRoute';
import { useRcError } from '../RcThreads';
import { RcEventEditor } from './RcEventEditor';
import { RcEventRegistrations } from './RcEventRegistrations';
import { RcEventAccessPanel } from './RcEventAccessPanel';
import { AreaRow, LinesRow, SelectRow, TextRow } from './parts/editorKit';
import { DEFAULT_THEMES, parseTheme, type Theme, type ThemeMode } from './shell/layers';

type Tab = 'parts' | 'signups' | 'settings';

export function RcEventWorkbench({
  collection, slug, unlocked, onSignIn
}: {
  collection: string;
  slug: string;
  unlocked: boolean;
  /** Die Anmeldeschublade oeffnen. Ohne sie waere „gesperrt" eine Sackgasse. */
  onSignIn: () => void;
}) {
  const describe = useRcError('pl');

  const [view, setView] = useState<RcEventView | null>(null);
  const [tab, setTab] = useState<Tab>('parts');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setView(await rcEvent(collection, slug)); }
    catch (e) { setError(describe(e)); }
  }, [collection, slug, describe]);

  useEffect(() => { void refresh(); }, [refresh]);

  /*
   * GESPERRT IST KEINE SACKGASSE.
   *
   * Der Herausgeber liest den Bereich der Veranstaltung, und der ist
   * verschlossen, bis das Konto aufgeschlossen wurde. Das nur
   * FESTZUSTELLEN — „zum Lesen entsperren" — laesst den Leser auf einer
   * schwarzen Seite ohne Knopf zurueck: er hat die Zeile in der Liste
   * angeklickt, sie hat ihn hierher gebracht, und hier hoert es auf.
   *
   * Also steht der Weg dabei, und der Weg zurueck auch.
   */
  if (!unlocked) {
    return (
      <div className="ew">
        <header className="ew-head">
          <a className="ew-back" href={rcPath('event', collection)}>← Katalog</a>
        </header>

        <section className="ew-panel">
          <h2 className="ew-h2">Zamknięte</h2>
          <p className="ec-note">
            Edytor czyta obszar wydarzenia, a ten jest zamknięty, dopóki nie
            odblokujesz konta swoim kluczem.
          </p>
          <button type="button" className="rc-btn" onClick={onSignIn}>
            Odblokuj
          </button>
        </section>
      </div>
    );
  }

  if (view === null) {
    return <div className="ew"><p className="ec-note">Wczytywanie…</p></div>;
  }

  /*
   * Wer die Veranstaltung nicht lesen darf, sieht hier nichts — und erfaehrt
   * das, statt einen leeren Herausgeber vorzufinden und ihn fuer kaputt zu
   * halten.
   */
  if (!view.mayRead) {
    return (
      <div className="ew">
        <p className="ec-note">Tego wydarzenia nie możesz edytować.</p>
        <a className="ew-back" href={rcPath('event', collection, slug)}>← Strona publiczna</a>
      </div>
    );
  }

  return (
    <div className="ew">
      <header className="ew-head">
        <a className="ew-back" href={rcPath('event', collection)}>← Wszystkie wydarzenia</a>
        <h1 className="ew-title">{view.title}</h1>
        <a className="ew-preview" href={rcPath('event', collection, slug)}>
          Podgląd strony publicznej
        </a>
      </header>

      <nav className="ew-tabs" aria-label="Zakładki">
        <Tabs current={tab} onPick={setTab} counts={view} />
      </nav>

      {/* Ein Entwurf ist nicht oeffentlich — als Warnung, nicht als Vermerk. */}
      {view.lifecycle === 'draft' && (
        <div className="ew-draft">
          <p>Szkic nie jest publiczny. Nikt z zewnątrz go nie otworzy i nie przyjmuje zapisów.</p>
          <button
            type="button"
            className="rc-btn"
            onClick={() => void rcPublishEvent(view.eventId).then(refresh)
              .catch((e: unknown) => setError(describe(e)))}
          >
            Opublikuj
          </button>
        </div>
      )}

      {error !== null && <p className="ap-error">{error}</p>}

      {tab === 'parts' && (
        <RcEventEditor collection={collection} slug={slug} onError={setError} />
      )}

      {tab === 'signups' && (
        <>
          <RcEventRegistrations view={view} onError={setError} />
          <RcEventAccessPanel view={view} onError={setError} />
        </>
      )}

      {tab === 'settings' && (
        <Settings
          view={view}
          onSave={(body) => void rcUpdateEvent(view.eventId, body).then(refresh)
            .catch((e: unknown) => setError(describe(e)))}
        />
      )}
    </div>
  );
}

function Tabs({
  current, onPick, counts
}: {
  current: Tab;
  onPick: (tab: Tab) => void;
  counts: RcEventView;
}) {
  const parts = (counts.pages ?? []).reduce((sum, page) => sum + (page.parts ?? []).length, 0);

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'parts', label: 'Strony i części', badge: parts },
    { id: 'signups', label: 'Zgłoszenia i dostęp' },
    { id: 'settings', label: 'Ustawienia' }
  ];

  return (
    <>
      {tabs.map((one) => (
        <button
          key={one.id}
          type="button"
          className={`ew-tab${one.id === current ? ' is-active' : ''}`}
          aria-current={one.id === current ? 'page' : undefined}
          onClick={() => onPick(one.id)}
        >
          {one.label}
          {one.badge !== undefined && one.badge > 0 && (
            <span className="ew-badge">{one.badge}</span>
          )}
        </button>
      ))}
    </>
  );
}

/**
 * Ustawienia wydarzenia — te same pola co w starym module.
 *
 * <b>Podtytuł i zajawka to DWIE rzeczy.</b> Podtytuł stoi na stronie, pod
 * tytułem („Pielgrzymka rowerowa z Krakowa do Częstochowy"); zajawka stoi na
 * kafelku katalogu, gdzie miejsca jest mało i ton jest inny. Jedno pole na
 * oba znaczyłoby: albo za długie motto na kafelku, albo za suchy tekst na
 * stronie.
 *
 * <b>Adresu tu nie ma.</b> Jest publiczny i zostaje: stoi na plakacie, w
 * wiadomości, na drzwiach. Zrobienie go edytowalnym obok tytułu znaczyłoby,
 * że literówka staje się okazją do zerwania każdego z tych odnośników.
 */
function Settings({
  view, onSave
}: {
  view: RcEventView;
  onSave: (body: Parameters<typeof rcUpdateEvent>[1]) => void;
}) {
  const [title, setTitle] = useState(view.title);
  const [subtitle, setSubtitle] = useState(view.subtitle ?? '');
  const [summary, setSummary] = useState(view.summary ?? '');
  const [category, setCategory] = useState(view.category ?? '');
  const [audience, setAudience] = useState(view.audience ?? '');
  const [places, setPlaces] = useState<string[]>(() => readPlaces(view.placesJson));
  const [thumbnailUrl, setThumbnailUrl] = useState(view.thumbnailUrl ?? '');
  const [dateLabel, setDateLabel] = useState(view.dateLabel ?? '');
  const [starts, setStarts] = useState(view.startsUtc?.slice(0, 10) ?? '');
  const [ends, setEnds] = useState(view.endsUtc?.slice(0, 10) ?? '');
  const [theme, setTheme] = useState<Theme>(() => parseTheme(view.themeJson ?? null));

  /*
   * Ponowne wczytanie, gdy kopia z serwera zmieni się pod spodem. Bez tego
   * następny zapis wysłałby stan sprzed tamtej zmiany i po cichu ją cofnął.
   */
  useEffect(() => {
    setTitle(view.title);
    setSubtitle(view.subtitle ?? '');
    setSummary(view.summary ?? '');
    setCategory(view.category ?? '');
    setAudience(view.audience ?? '');
    setPlaces(readPlaces(view.placesJson));
    setThumbnailUrl(view.thumbnailUrl ?? '');
    setDateLabel(view.dateLabel ?? '');
    setStarts(view.startsUtc?.slice(0, 10) ?? '');
    setEnds(view.endsUtc?.slice(0, 10) ?? '');
    setTheme(parseTheme(view.themeJson ?? null));
  }, [view]);

  const day = (text: string) => (text.trim() === '' ? null : `${text}T00:00:00Z`);

  /*
   * Przełączenie trybu bierze CAŁY zestaw barw, nie sam tryb. Ciemny gradient
   * pod jasnym wydarzeniem cofnąłby tryb już przy pierwszej części.
   */
  const switchMode = (mode: ThemeMode) => setTheme({ ...DEFAULT_THEMES[mode], mode });

  return (
    <section className="eva-panel">
      <header><h3>Ustawienia wydarzenia</h3></header>

      <div className="eva-grid">
        <TextRow label="Tytuł" value={title} onChange={setTitle} />
        <TextRow label="Podtytuł" value={subtitle} onChange={setSubtitle}
          hint="Hasło na samej stronie wydarzenia." />
      </div>

      <AreaRow label="Krótki opis" rows={2} value={summary} onChange={setSummary}
        hint="Na kafelku w katalogu. To nie jest podtytuł." />

      <div className="eva-grid">
        <TextRow label="Grupa wydarzeń" value={category} onChange={setCategory}
          hint={'Np. „Pielgrzymka rowerowa" — katalog buduje z tego filtr.'} />
        <TextRow label="Dla kogo" value={audience} onChange={setAudience}
          hint={'Np. „Młodzież 16–30".'} />
      </div>

      <LinesRow label="Miejsca" rows={3} values={places} onChange={setPlaces}
        hint="Po jednym w wierszu, w kolejności trasy. Katalog filtruje po nich." />

      <div className="eva-grid">
        <TextRow label="Początek (RRRR-MM-DD)" value={starts} onChange={setStarts} />
        <TextRow label="Koniec (RRRR-MM-DD)" value={ends} onChange={setEnds} />
      </div>

      <TextRow label="Termin słownie" value={dateLabel} onChange={setDateLabel}
        hint="Zastępuje daty w katalogu, gdy powiedzą mniej niż nazwa okresu." />

      <TextRow label="Miniatura (adres)" value={thumbnailUrl} onChange={setThumbnailUrl} />

      <details className="eva-fold">
        <summary>Barwy wydarzenia</summary>
        <div className="eva-fold-body">
          <SelectRow<ThemeMode>
            label="Tryb"
            value={theme.mode}
            options={[{ value: 'dark', label: 'Ciemny' }, { value: 'light', label: 'Jasny' }]}
            onChange={switchMode}
          />
          <div className="eva-grid">
            <TextRow label="Akcent" value={theme.accent}
              onChange={(accent) => setTheme({ ...theme, accent })} />
            <TextRow label="Tło" value={theme.ground}
              onChange={(ground) => setTheme({ ...theme, ground })} />
            <TextRow label="Tekst" value={theme.ink}
              onChange={(ink) => setTheme({ ...theme, ink })} />
            <TextRow label="Tekst poboczny" value={theme.muted}
              onChange={(muted) => setTheme({ ...theme, muted })} />
          </div>
        </div>
      </details>

      <div className="eva-actions">
        <button
          type="button"
          className="eva-cta"
          disabled={title.trim() === ''}
          onClick={() => onSave({
            title: title.trim(),
            subtitle: subtitle.trim() || null,
            summary: summary.trim() || null,
            category: category.trim() || null,
            audience: audience.trim() || null,
            placesJson: places.length === 0 ? null : JSON.stringify(places),
            thumbnailUrl: thumbnailUrl.trim() || null,
            dateLabel: dateLabel.trim() || null,
            startsUtc: day(starts),
            endsUtc: day(ends),
            themeJson: JSON.stringify(theme)
          })}
        >
          Zapisz ustawienia
        </button>
      </div>
    </section>
  );
}

/** Kaputte Ortsangabe kostet die Orte, nicht das Formular. */
function readPlaces(placesJson: string | null | undefined): string[] {
  if (placesJson === null || placesJson === undefined || placesJson.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(placesJson);
    return Array.isArray(parsed)
      ? parsed.filter((one): one is string => typeof one === 'string')
      : [];
  } catch { return []; }
}
