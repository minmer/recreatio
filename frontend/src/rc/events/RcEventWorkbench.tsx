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
        <RcEventEditor lang='pl' collection={collection} slug={slug} onError={setError} />
      )}

      {tab === 'signups' && (
        <RcEventRegistrations view={view} onError={setError} />
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
 * Termin, Katalogfelder, Sichtbarkeit.
 *
 * <b>Die Adresse steht nicht dabei</b>, und das ist Absicht: sie ist
 * oeffentlich und bleibt. Sie hier neben dem Titel aenderbar zu machen hiesse,
 * dass ein Tippfehler zur Gelegenheit wird, jedes Plakat abzureissen.
 */
function Settings({
  view, onSave
}: {
  view: RcEventView;
  onSave: (body: Parameters<typeof rcUpdateEvent>[1]) => void;
}) {
  const [title, setTitle] = useState(view.title);
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [audience, setAudience] = useState('');
  const [places, setPlaces] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [starts, setStarts] = useState(view.startsUtc?.slice(0, 10) ?? '');
  const [ends, setEnds] = useState(view.endsUtc?.slice(0, 10) ?? '');

  const day = (text: string) => (text.trim() === '' ? null : `${text}T00:00:00Z`);

  return (
    <section className="ew-panel">
      <h2 className="ew-h2">Ustawienia wydarzenia</h2>

      <div className="ew-form">
        <label className="mo-field ew-wide">
          <span>Tytuł</span>
          <input type="text" value={title} maxLength={200}
            onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="mo-field ew-wide">
          <span>Zajawka do katalogu</span>
          <input type="text" value={summary} maxLength={400}
            placeholder="Pielgrzymka rowerowa z Krakowa do Częstochowy"
            onChange={(e) => setSummary(e.target.value)} />
          <em className="fe-hint">Krótkie zdanie na kafelku. Nie podtytuł na stronie.</em>
        </label>

        <label className="mo-field">
          <span>Początek</span>
          <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)} />
        </label>

        <label className="mo-field">
          <span>Koniec</span>
          <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
        </label>

        <label className="mo-field ew-wide">
          <span>Termin słownie</span>
          <input type="text" value={dateLabel} maxLength={120}
            placeholder="Adwent 2026"
            onChange={(e) => setDateLabel(e.target.value)} />
          <em className="fe-hint">
            Zastępuje daty w katalogu, gdy powiedzą mniej niż nazwa okresu.
          </em>
        </label>

        {/*
          Grupa i miejsca budują filtry katalogu. Wolny tekst — nowa rodzina
          wydarzeń nie ma czekać na zmianę w programie; katalog składa listę z
          tego, co zastanie.
        */}
        <label className="mo-field">
          <span>Grupa</span>
          <input type="text" value={category} maxLength={80}
            placeholder="Pielgrzymka rowerowa"
            onChange={(e) => setCategory(e.target.value)} />
        </label>

        <label className="mo-field">
          <span>Dla kogo</span>
          <input type="text" value={audience} maxLength={160}
            placeholder="Młodzież 16–30"
            onChange={(e) => setAudience(e.target.value)} />
        </label>

        <label className="mo-field ew-wide">
          <span>Miejsca</span>
          <input type="text" value={places}
            placeholder="Kraków, Częstochowa"
            onChange={(e) => setPlaces(e.target.value)} />
          <em className="fe-hint">Po przecinku, w kolejności trasy.</em>
        </label>
      </div>

      <button
        type="button"
        className="rc-btn"
        onClick={() => onSave({
          title: title.trim(),
          summary: summary.trim() || null,
          category: category.trim() || null,
          audience: audience.trim() || null,
          /*
            Die Orte gehen als JSON-Liste. Aus „Kraków, Częstochowa" wird
            `["Kraków","Częstochowa"]` — der Katalog siebt danach, und aus einem
            Fliesstext liesse sich das nur raten.
          */
          placesJson: places.trim() === ''
            ? null
            : JSON.stringify(places.split(',').map((one) => one.trim()).filter((one) => one !== '')),
          dateLabel: dateLabel.trim() || null,
          startsUtc: day(starts),
          endsUtc: day(ends)
        })}
      >
        Zapisz ustawienia
      </button>
    </section>
  );
}

export default RcEventWorkbench;
