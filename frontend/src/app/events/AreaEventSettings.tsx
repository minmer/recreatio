/**
 * 0131 — WYDARZENIE in den Ustawienia eines Bereichs.
 *
 * Ein Bereich wird zum Wydarzenie durch eine Marke: sie nennt die Hauptseite
 * (eine, die ich führe), den Haupttermin (ein Termin ohne Wiederholung in einem
 * Kalender des Bereichs), einen Rodzaj und ein Bild der Hauptseite — und hält sonst
 * nichts. Hier steht auch, was fehlt, damit es auf Listen erscheint und Zapisy
 * annehmen (Administrator danych, jawny Bereich, öffentliche Seite), und in welchen
 * fremden Listen es steht oder stehen möchte.
 */

import { useEffect, useState, type ReactNode } from 'react';

import type { AreaRow } from '../areas/area';
import { CONTROLLER_EVENT } from '../areas/controllers';
import { loadCalendars, type CalendarRow } from '../calendar/calendar';
import { PickCalendarItem } from '../calendar/PickCalendar';
import type { Ring } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { isImageType, loadPageImages, type PageImageRow } from '../pages/pageImages';
import { PickPage } from '../pages/PickPage';
import { pagePath, viewPath } from '../routes';
import { ask, toast } from '../ui/dialogs';
import { FadeImg } from '../ui/fadeImage';
import { Loading } from '../ui/Loading';
import {
  askListing, CATALOGUE_PATH, clearAreaEvent, eventImageUrl, loadAreaEvent, loadEvent, loadListings, LISTING_WORDS, setAreaEvent, whenText,
  type AreaEventState, type EventCard, type Listing
} from './events';

const failure = (e: unknown, fallback: string): string => (e instanceof WorkspaceError ? e.message : fallback);

/** Eine Adresse, wie man sie kopiert („recreatio.pl/#/parafia/wydarzenia?x"), als Pfad. */
export const listPathOf = (address: string): string => {
  const raw = address.trim();
  const at = raw.indexOf('#/');
  return (at >= 0 ? raw.slice(at + 2) : raw).split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').toLowerCase();
};

export function AreaEventSettings({ area, ring, editable }: { area: AreaRow; ring: Ring | null; editable: boolean }) {
  const [state, setState] = useState<AreaEventState | 'failed' | null>(null);
  /* Die Karte, wie sie draussen steht — `null`: (noch) nicht öffentlich. */
  const [card, setCard] = useState<EventCard | null | undefined>(undefined);
  const [round, setRound] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setState(null);
    setCard(undefined);
    void loadAreaEvent(area.areaId).then(
      (found) => {
        if (!alive) return;
        setState(found);
        if (found.mark === null) { setCard(null); return; }
        void loadEvent(area.areaId).then((one) => { if (alive) setCard(one.event); }, () => { if (alive) setCard(null); });
      },
      () => { if (alive) setState('failed'); });
    return () => { alive = false; };
  }, [area.areaId, round]);

  /* Ändert sich der Administrator danych (gleich darüber auf derselben Seite), stimmt die Liste „was fehlt" nicht mehr. */
  useEffect(() => {
    const again = () => setRound((n) => n + 1);
    window.addEventListener(CONTROLLER_EVENT, again);
    return () => window.removeEventListener(CONTROLLER_EVENT, again);
  }, []);

  const reload = () => setRound((n) => n + 1);

  if (state === null) return <Loading lines={2} />;
  if (state === 'failed') return <p className="wk-error">Nie udało się wczytać ustawień wydarzenia.</p>;

  const mark = state.mark;

  if (editing) {
    return (
      <MarkForm
        area={area}
        state={state}
        onDone={() => { setEditing(false); reload(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (mark === null) {
    return (
      <div className="wk-event-settings" data-area-event="none">
        <p className="wk-lede">Wydarzenie to obszar z główną stroną i głównym terminem — pokazuje się w listach „Wydarzenia”.</p>
        {editable && (
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" data-event-mark="" onClick={() => setEditing(true)}>Oznacz jako wydarzenie</button>
          </div>
        )}
      </div>
    );
  }

  const unmark = async () => {
    const yes = await ask({
      title: 'Zdjąć oznaczenie wydarzenia?',
      body: 'Obszar, strona, termin i formularze zostają; wydarzenie zniknie z list „Wydarzenia”.',
      confirm: 'Zdejmij',
      danger: true
    });
    if (!yes) return;
    setBusy(true);
    try {
      await clearAreaEvent(area.areaId);
      toast('Zdjęto oznaczenie wydarzenia.', { kind: 'ok' });
      reload();
    } catch (e) {
      toast(failure(e, 'Nie udało się zdjąć oznaczenia.'), { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wk-event-settings" data-area-event="marked">
      <dl className="wk-facts">
        <div className="wk-fact">
          <dt>Strona</dt>
          <dd>{mark.path === null ? <span className="wk-card-muted">nie wybrano</span> : <a className="wk-link" href={pagePath(mark.path)}>recreatio.pl/{mark.path}</a>}</dd>
        </div>
        <div className="wk-fact">
          <dt>Główny termin</dt>
          <dd>
            {mark.itemId === null ? <span className="wk-card-muted">nie wybrano</span>
              : card !== null && card !== undefined && card.item !== null ? (whenText(card.item) ?? 'wybrany')
              : 'wybrany'}
          </dd>
        </div>
        {mark.kind !== null && (
          <div className="wk-fact">
            <dt>Rodzaj</dt>
            <dd>{mark.kind}</dd>
          </div>
        )}
      </dl>
      {mark.imageId !== null && (
        <figure className="wk-event-settings-image">
          <FadeImg src={eventImageUrl(mark.imageId)} alt="Zdjęcie wydarzenia" loading="lazy" decoding="async" />
        </figure>
      )}

      <Readiness area={area} state={state} card={card} />

      {editable && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy} onClick={() => setEditing(true)}>Zmień</button>
          <button type="button" className="wk-link-btn" disabled={busy} data-event-unmark="" onClick={() => void unmark()}>Zdejmij oznaczenie</button>
        </div>
      )}

      <Listings areaId={area.areaId} editable={editable} />
      {ring === null && editable && <p className="wk-note">Klucze nie są otwarte w tej karcie — zmiany zapiszesz, ale terminów z zaszyfrowanym tytułem nie zobaczysz po nazwie.</p>}
    </div>
  );
}

/* -- Was fehlt ---------------------------------------------------------------------- */

function Check({ ok, children }: { ok: boolean | null; children: ReactNode }) {
  return (
    <li className={ok === true ? 'is-ok' : ok === false ? 'is-missing' : 'is-unknown'}>
      <span className="wk-event-check-mark" aria-hidden="true">{ok === true ? '✓' : ok === false ? '✗' : '·'}</span>
      <span>{children}</span>
    </li>
  );
}

function Readiness({ area, state, card }: { area: AreaRow; state: AreaEventState; card: EventCard | null | undefined }) {
  const settings = viewPath('areas', area.areaId, 'dostep');
  return (
    <section className="wk-event-ready" aria-label="Co jest gotowe">
      <ul className="wk-event-checks">
        <Check ok={state.controller !== null}>
          {state.controller !== null
            ? <>Administrator danych: {state.controller.name}</>
            : <>Brak administratora danych — formularze wydarzenia nic nie przyjmą. Wskaż go wyżej, w „Administrator danych”.</>}
        </Check>
        <Check ok={state.public}>
          {state.public
            ? 'Obszar jest jawny — każdy przeczyta datę, miejsce i tytuł terminu.'
            : <>Obszar nie jest jawny — wydarzenie nie pojawi się na listach. <a className="wk-link" href={settings}>Dostęp → Dla wszystkich</a></>}
        </Check>
        <Check ok={card === undefined ? null : card !== null}>
          {card === undefined ? 'Sprawdzanie karty…'
            : card !== null ? 'Karta wydarzenia jest widoczna publicznie.'
            : 'Karta jeszcze się nie pokazuje: strona musi być publiczna (bez ograniczonego dostępu), a termin widoczny dla wszystkich.'}
        </Check>
        <Check ok={card === undefined || card === null ? null : card.open}>
          {card !== undefined && card !== null && card.open ? 'Zapisy otwarte — formularz przyjmuje zgłoszenia.' : 'Zapisy: brak otwartego formularza na publicznej stronie wydarzenia.'}
        </Check>
      </ul>
    </section>
  );
}

/* -- Markieren und ändern ------------------------------------------------------------- */

function MarkForm({ area, state, onDone, onCancel }: {
  area: AreaRow; state: AreaEventState; onDone: () => void; onCancel: () => void;
}) {
  const mark = state.mark;
  const [path, setPath] = useState(mark?.path ?? '');
  const [calendars, setCalendars] = useState<readonly CalendarRow[] | null>(null);
  const [calendarId, setCalendarId] = useState('');
  const [itemId, setItemId] = useState(mark?.itemId ?? '');
  const [kind, setKind] = useState(mark?.kind ?? '');
  const [imageId, setImageId] = useState(mark?.imageId ?? '');
  const [images, setImages] = useState<readonly PageImageRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* Die Kalender dieses Bereichs — der Haupttermin liegt in einem von ihnen. */
  useEffect(() => {
    let alive = true;
    void loadCalendars().then(({ calendars: all }) => {
      if (!alive) return;
      const own = all.filter((c) => c.areaId === area.areaId && c.archived !== true);
      setCalendars(own);
      if (own.length > 0) setCalendarId((was) => was !== '' ? was : (own.find((c) => c.isDefault === true) ?? own[0]).calendarId);
    }, () => { if (alive) setCalendars([]); });
    return () => { alive = false; };
  }, [area.areaId]);

  /* Die Bilder der gewählten Seite. */
  useEffect(() => {
    if (path === '') { setImages([]); return undefined; }
    let alive = true;
    setImages(null);
    void loadPageImages(path).then(
      ({ images: all }) => { if (alive) setImages(all.filter((one) => isImageType(one.contentType))); },
      () => { if (alive) setImages([]); });
    return () => { alive = false; };
  }, [path]);

  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      /* Bilder noch nicht geladen: das Bild bleibt, wie es ist (`null`); sonst das gewählte oder keines (''). */
      const image = path === '' || images === null ? null : images.some((one) => one.id === imageId) ? imageId : '';
      await setAreaEvent(area.areaId, { path: path === '' ? null : path, itemId: itemId === '' ? null : itemId, kind: kind.trim() === '' ? null : kind.trim(), imageId: image });
      toast(mark === null ? 'Obszar jest teraz wydarzeniem.' : 'Zapisano wydarzenie.', { kind: 'ok' });
      onDone();
    } catch (e) {
      setFailed(failure(e, 'Nie udało się zapisać wydarzenia.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-form wk-event-mark" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="wk-field">
        <span>Główna strona wydarzenia</span>
        <PickPage value={path} busy={busy} onPick={(next) => { setPath(next); setImageId(''); }} />
      </div>

      <div className="wk-field">
        <span>Główny termin (bez powtórzeń)</span>
        {calendars === null ? <Loading lines={1} /> : calendars.length === 0 ? (
          <p className="wk-note">Ten obszar nie ma jeszcze kalendarza — dodaj termin w <a className="wk-link" href={viewPath('calendar')}>Kalendarzu</a>, wybierając ten obszar.</p>
        ) : (
          <>
            {calendars.length > 1 && (
              <select value={calendarId} disabled={busy} onChange={(e) => { setCalendarId(e.target.value); setItemId(''); }}>
                {calendars.map((c) => <option key={c.calendarId} value={c.calendarId}>{c.title}</option>)}
              </select>
            )}
            <PickCalendarItem calendarId={calendarId} value={itemId} busy={busy} withParts={false} onPick={(id) => setItemId(id)} />
          </>
        )}
      </div>

      <label className="wk-field">
        <span>Rodzaj (opcjonalnie)</span>
        <input value={kind} disabled={busy} maxLength={40} placeholder="np. rekolekcje, pielgrzymka, koncert" onChange={(e) => setKind(e.target.value)} />
      </label>

      {path !== '' && (
        <div className="wk-field">
          <span>Zdjęcie na karcie</span>
          {images === null ? <Loading lines={1} /> : images.length === 0 ? (
            <p className="wk-note">Na tej stronie nie ma jeszcze zdjęć — dodaj je w edytorze strony (Pliki strony).</p>
          ) : (
            <div className="wk-event-images" role="radiogroup" aria-label="Zdjęcie na karcie">
              <label className={`wk-event-pick${imageId === '' ? ' is-on' : ''}`}>
                <input type="radio" name="event-image" checked={imageId === ''} disabled={busy} onChange={() => setImageId('')} />
                <span className="wk-event-pick-none">bez zdjęcia</span>
              </label>
              {images.map((one) => (
                <label key={one.id} className={`wk-event-pick${imageId === one.id ? ' is-on' : ''}`}>
                  <input type="radio" name="event-image" checked={imageId === one.id} disabled={busy} onChange={() => setImageId(one.id)} />
                  <FadeImg src={eventImageUrl(one.id)} alt={one.name ?? 'zdjęcie strony'} loading="lazy" decoding="async" />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy} data-event-save="">{busy ? 'Zapisywanie…' : mark === null ? 'Oznacz jako wydarzenie' : 'Zapisz'}</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={onCancel}>Anuluj</button>
      </div>
    </form>
  );
}

/* -- In fremden Listen ------------------------------------------------------------------ */

function Listings({ areaId, editable }: { areaId: string; editable: boolean }) {
  const [list, setList] = useState<readonly Listing[] | 'failed' | null>(null);
  const [round, setRound] = useState(0);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadListings(areaId).then((out) => { if (alive) setList(out.listings); }, () => { if (alive) setList('failed'); });
    return () => { alive = false; };
  }, [areaId, round]);

  const askFor = async (path: string) => {
    if (path === '') { setFailed('Podaj adres strony z listą „Wydarzenia”.'); return; }
    setBusy(true);
    setFailed(null);
    try {
      const out = await askListing(areaId, { path });
      toast(out.state === 'shown' ? 'Wydarzenie jest już na tej liście.'
        : out.catalogue ? 'Prośba wysłana — zdecyduje operator serwisu.'
        : 'Prośba wysłana — zdecyduje ten, kto prowadzi tę listę.', { kind: 'ok' });
      setAddress('');
      setRound((n) => n + 1);
    } catch (e) {
      setFailed(failure(e, 'Nie udało się wysłać prośby.'));
    } finally {
      setBusy(false);
    }
  };

  const inCatalogue = list !== null && list !== 'failed' && list.some((one) => one.path === CATALOGUE_PATH && one.state !== 'refused');

  return (
    <section className="wk-event-listings" aria-labelledby={`event-listings-${areaId}`}>
      <h3 className="wk-h3" id={`event-listings-${areaId}`}>Na innych listach</h3>
      {list === null ? <Loading lines={1} /> : list === 'failed' ? <p className="wk-error">Nie udało się wczytać list.</p> : list.length === 0 ? (
        <p className="wk-card-muted">Wydarzenie nie stoi jeszcze na żadnej obcej liście.</p>
      ) : (
        <ul className="wk-event-listing-rows">
          {list.map((one) => (
            <li key={one.moduleId} data-listing={one.state}>
              {one.path === null ? <span>lista bez strony</span> : <a className="wk-link" href={pagePath(one.path)}>recreatio.pl/{one.path}</a>}
              <span className={one.state === 'shown' ? 'wk-tag wk-tag-open' : 'wk-tag'}>{LISTING_WORDS[one.state]}</span>
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <form className="wk-event-ask" onSubmit={(e) => { e.preventDefault(); void askFor(listPathOf(address)); }}>
          <label className="wk-field">
            <span>Pokaż też na…</span>
            <input value={address} disabled={busy} placeholder="adres strony z listą, np. recreatio.pl/#/parafia/wydarzenia" onChange={(e) => setAddress(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn wk-btn-line wk-btn-small" disabled={busy || address.trim() === ''}>Poproś</button>
            {!inCatalogue && (
              <button type="button" className="wk-link-btn" disabled={busy} data-event-catalogue="" onClick={() => void askFor(CATALOGUE_PATH)}>
                Poproś o miejsce w katalogu recreatio.pl/{CATALOGUE_PATH} — decyduje operator serwisu
              </button>
            )}
          </div>
          {failed !== null && <p className="wk-error" role="alert">{failed}</p>}
        </form>
      )}
    </section>
  );
}
