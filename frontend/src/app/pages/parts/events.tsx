/**
 * 0131 — „WYDARZENIA" und „WYDARZENIE": Wydarzenia als Karten auf einer Seite.
 *
 * <b>Wydarzenia</b> zeigt die Wydarzenia gewählter Bereiche (und, auf Wunsch, der
 * Bereiche darin) — dazu die, die gebeten haben, hier zu stehen, und angenommen
 * wurden. Im Katalog `recreatio.pl/events` nur, was der Betreiber freigegeben hat.
 *
 * <b>Wydarzenie</b> zeigt EINES, grösser: gewählt im Baustein, oder — leer — aus
 * der Adresse (`?wydarzenie=<obszar>`), damit eine Seite jedes zeigen kann.
 *
 * Eine Karte trägt nur, was öffentlich ist: Titel, Vorspann und Bild der Hauptseite,
 * Zeit und Ort des Haupttermins (Ort und Titel mit dem offengelegten Schlüssel des
 * Bereichs, hier im Browser geöffnet), „Zapisy otwarte", wenn ein Formular annimmt.
 *
 * <b>Je Grösse:</b> im Streifen das nächste in einer Zeile; als Block wenige, knapp;
 * hoch die ganze Liste mit Bildern und Vorspann; über die ganze Breite ein Raster.
 */

import { useEffect, useState } from 'react';

import { AreaPick, AreaPickMany } from '../../areas/AreaPick';
import type { AreaRow } from '../../areas/area';
import type { ControllerInfo } from '../../areas/controllers';
import { ControllerClause } from '../../areas/ControllerClause';
import { eventImageUrl, loadEvent, loadEvents, openCard, whenText, type EventCard, type EventWhen } from '../../events/events';
import { pagePath } from '../../routes';
import { FadeImg } from '../../ui/fadeImage';
import { Loading } from '../../ui/Loading';
import { areasNow } from '../../workspace/viewData';
import { definePart, flag, maybeNumber, text, type EditorProps, type PartContext, type PartSize, type RawConfig } from '../part';

/* -- Gemeinsam ------------------------------------------------------------------------ */

const WHEN: readonly { readonly value: EventWhen; readonly label: string }[] = [
  { value: 'coming', label: 'Nadchodzące i trwające' },
  { value: 'past', label: 'Minione' },
  { value: 'all', label: 'Wszystkie' }
];

const whenOf = (said: string): EventWhen => (WHEN.some((one) => one.value === said) ? said as EventWhen : 'coming');

/** Eine Karte mit dem, was dieser Browser aus ihr geöffnet hat. */
interface Shown {
  readonly card: EventCard;
  readonly title: string;
  readonly location: string | null;
  readonly when: string | null;
}

/** Der Titel steht auf der Seite; fehlt er, der des Haupttermins, sonst der Name des Bereichs. */
async function shownOf(card: EventCard): Promise<Shown> {
  const texts = await openCard(card).catch(() => ({ title: null, location: null }));
  return {
    card,
    title: (card.page.title ?? '').trim() || (texts.title ?? '').trim() || card.name,
    location: texts.location,
    when: whenText(card.item)
  };
}

function Tags({ one }: { one: Shown }) {
  const cancelled = one.card.item?.status === 'cancelled';
  if (one.card.kind === null && !one.card.open && !cancelled) return null;
  return (
    <span className="wk-tags">
      {one.card.kind !== null && <span className="wk-tag">{one.card.kind}</span>}
      {cancelled && <span className="wk-tag">odwołane</span>}
      {one.card.open && !cancelled && <span className="wk-tag wk-tag-open">Zapisy otwarte</span>}
    </span>
  );
}

/** Eine Karte in der Liste — `rich`: mit Bild, Vorspann und Veranstalter. */
function EventItem({ one, rich }: { one: Shown; rich: boolean }) {
  const href = pagePath(one.card.page.path);
  const image = rich && one.card.page.imageId !== null ? one.card.page.imageId : null;
  return (
    <li className={`wk-event${image === null ? '' : ' has-image'}`} data-event={one.card.areaId}>
      {image !== null && (
        <a className="wk-event-image" href={href} tabIndex={-1} aria-hidden="true">
          <FadeImg src={eventImageUrl(image)} alt="" loading="lazy" decoding="async" />
        </a>
      )}
      <div className="wk-event-body">
        <a className="wk-event-title" href={href}>{one.title}</a>
        {one.when !== null && <span className="wk-event-when">{one.when}</span>}
        {one.location !== null && <span className="wk-event-where">{one.location}</span>}
        {rich && one.card.page.lead !== null && one.card.page.lead.trim() !== '' && <p className="wk-event-lead">{one.card.page.lead}</p>}
        {rich && one.card.organiser !== null && <span className="wk-event-who">{one.card.organiser}</span>}
        <Tags one={one} />
      </div>
    </li>
  );
}

/* -- „Wydarzenia": die Liste -------------------------------------------------------- */

interface ListConfig {
  readonly title: string;
  readonly areas: readonly string[];
  readonly deep: boolean;
  readonly kind: string;
  readonly when: EventWhen;
  readonly limit: number | null;
}

const idsOf = (value: string): readonly string[] => value.split(',').map((one) => one.trim()).filter((one) => one !== '');

const readList = (raw: RawConfig): ListConfig => {
  const limit = maybeNumber(raw, 'limit');
  return {
    title: text(raw, 'title'),
    areas: idsOf(text(raw, 'areas')),
    deep: flag(raw, 'deep', true),
    kind: text(raw, 'kind'),
    when: whenOf(text(raw, 'when')),
    limit: limit === null || limit < 1 ? null : Math.min(limit, 200)
  };
};

/** Wie viele eine Kachel dieser Grösse zeigt — der Rest steht im Vollbild. */
const countFor = (size: PartSize, whole: boolean, limit: number | null): number => {
  if (whole || size.height === 'tall') return limit ?? 24;
  if (size.height === 'strip') return 1;
  return Math.min(limit ?? 24, size.width === 'narrow' ? 3 : 4);
};

function EventsView({ config, ctx }: { config: ListConfig; ctx: PartContext }) {
  const [list, setList] = useState<readonly Shown[] | 'failed' | null>(null);
  const areasKey = config.areas.join(',');

  useEffect(() => {
    let alive = true;
    setList(null);
    void (async () => {
      try {
        const out = await loadEvents({
          areas: config.areas, deep: config.deep, kind: config.kind, when: config.when, limit: config.limit ?? 24, module: ctx.moduleId
        });
        const opened = await Promise.all(out.events.map(shownOf));
        if (alive) setList(opened);
      } catch {
        if (alive) setList('failed');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- die Liste der Bereiche zählt als Text
  }, [areasKey, config.deep, config.kind, config.when, config.limit, ctx.moduleId]);

  const whole = ctx.whole === true;
  const strip = ctx.size.height === 'strip' && !whole;
  const title = config.title !== '' ? config.title : 'Wydarzenia';
  const head = <h2 className="wk-card-title">{title}</h2>;

  if (list === null) return <>{head}<Loading lines={strip ? 1 : 3} /></>;
  if (list === 'failed') return <>{head}<p className="wk-card-muted">Nie udało się wczytać wydarzeń.</p></>;
  if (list.length === 0) {
    return <>{head}<p className="wk-card-muted">{config.when === 'past' ? 'Nie było tu jeszcze wydarzeń.' : 'Na razie nie ma tu wydarzeń.'}</p></>;
  }

  if (strip) {
    const next = list[0];
    return (
      <>
        {head}
        <p className="wk-events-strip">
          <a className="wk-event-title" href={pagePath(next.card.page.path)}>{next.title}</a>
          {next.when !== null && <span className="wk-event-when">{next.when}</span>}
          <Tags one={next} />
          {list.length > 1 && <span className="wk-card-muted">i {list.length - 1} więcej</span>}
        </p>
      </>
    );
  }

  const shown = list.slice(0, countFor(ctx.size, whole, config.limit));
  const rich = whole || ctx.size.height === 'tall';
  const grid = whole || ctx.size.width === 'full' || (ctx.size.width === 'wide' && rich);

  return (
    <>
      {head}
      <ul className={`wk-events${grid ? ' is-grid' : ''}${rich ? ' is-rich' : ' is-compact'}`}>
        {shown.map((one) => <EventItem key={one.card.areaId} one={one} rich={rich} />)}
      </ul>
      {list.length > shown.length && (
        <p className="wk-card-muted">I jeszcze {list.length - shown.length} — {ctx.openWhole !== undefined
          ? <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>pokaż wszystkie</button>
          : 'pełna lista w pełnym ekranie'}.</p>
      )}
    </>
  );
}

/** Die Bereiche, die ich sehe — für beide Editoren. */
function useAreas(): readonly AreaRow[] | null {
  const [areas, setAreas] = useState<readonly AreaRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    void areasNow().then((list) => { if (alive) setAreas(list); }, () => { if (alive) setAreas([]); });
    return () => { alive = false; };
  }, []);
  return areas;
}

function EventsEditor({ raw, onSet, busy }: EditorProps) {
  const areas = useAreas();
  const config = readList(raw);

  return (
    <>
      <label className="wk-field">
        <span>Nagłówek</span>
        <input value={raw.title ?? ''} disabled={busy} placeholder="Wydarzenia" onChange={(e) => onSet({ title: e.target.value })} />
      </label>

      <div className="wk-field">
        <span>Wydarzenia z obszarów</span>
        {areas === null ? <Loading lines={2} /> : (
          <AreaPickMany
            label="Wydarzenia z obszarów"
            areas={areas}
            only={areas.filter((a) => a.personal !== true)}
            value={config.areas}
            onChange={(next) => onSet({ areas: next.join(',') })}
          />
        )}
      </div>

      <label className="wk-check">
        <input type="checkbox" checked={config.deep} disabled={busy} onChange={(e) => onSet({ deep: e.target.checked ? 'yes' : 'no' })} />
        <span>także z obszarów w nich</span>
      </label>

      <label className="wk-field">
        <span>Tylko rodzaj (opcjonalnie)</span>
        <input value={raw.kind ?? ''} disabled={busy} placeholder="np. rekolekcje" maxLength={40} onChange={(e) => onSet({ kind: e.target.value })} />
      </label>

      <label className="wk-field">
        <span>Które</span>
        <select value={config.when} disabled={busy} onChange={(e) => onSet({ when: e.target.value })}>
          {WHEN.map((one) => <option key={one.value} value={one.value}>{one.label}</option>)}
        </select>
      </label>

      <label className="wk-field">
        <span>Najwyżej</span>
        <input type="number" min={1} max={200} value={raw.limit ?? ''} disabled={busy} placeholder="24" onChange={(e) => onSet({ limit: e.target.value })} />
      </label>

      <p className="wk-note">
        {config.areas.length === 0 ? 'Bez wybranych obszarów lista pokaże tylko wydarzenia, które poprosiły o miejsce i zostały przyjęte. ' : ''}
        Inne wydarzenia mogą poprosić o miejsce na tej liście — prośby trafiają do „Sprawy” osoby, która prowadzi stronę.
      </p>
    </>
  );
}

export const eventsPart = definePart<ListConfig>({
  kind: 'events',
  label: 'Wydarzenia',
  use: 'Wydarzenia wybranych obszarów jako karty (data, miejsce, zdjęcie, „Zapisy otwarte”); inne wydarzenia mogą poprosić o miejsce na liście.',
  box: { colSpan: 6, rowSpan: 3 },

  example: { title: 'Wydarzenia w parafii', areas: '<id-obszaru-1>,<id-obszaru-2>', deep: 'yes', kind: 'rekolekcje', when: 'coming', limit: '12' },
  fields: [],
  extra: [
    { key: 'title', shape: 'line', says: 'nagłówek listy; puste — „Wydarzenia”' },
    { key: 'areas', shape: 'ids', says: 'obszary, z których lista bierze wydarzenia (identyfikatory) — najprościej wybrać w edytorze; puste — tylko wydarzenia przyjęte na prośbę' },
    { key: 'deep', shape: 'line', says: '"yes" — także wydarzenia obszarów w nich (zwykle), "no" — tylko tych obszarów' },
    { key: 'kind', shape: 'line', says: 'tylko wydarzenia tego rodzaju (np. "rekolekcje"); puste — wszystkie' },
    { key: 'when', shape: 'line', says: '"coming" — nadchodzące i trwające (zwykle), "past" — minione, "all" — wszystkie' },
    { key: 'limit', shape: 'line', says: 'najwyżej tyle wydarzeń (1–200); puste — 24' }
  ],
  Editor: EventsEditor,

  read: readList,
  /* Auch ohne Bereiche zeigt sie etwas: die Wydarzenia, die hier stehen dürfen. */
  hasContent: () => true,

  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Najbliższe wydarzenie w jednym wierszu.'
    : size.height === 'tall'
      ? (size.width === 'full' || size.width === 'wide' ? 'Wszystkie wydarzenia jako siatka kart ze zdjęciami i opisem.' : 'Wszystkie wydarzenia ze zdjęciami i opisem, jedno pod drugim.')
      : size.width === 'full'
        ? 'Do czterech najbliższych w rzędzie — data, miejsce, rodzaj.'
        : 'Do czterech najbliższych krótko — data i miejsce.',

  View: EventsView
});

/* -- „Wydarzenie": eines ------------------------------------------------------------- */

interface OneConfig {
  readonly title: string;
  readonly area: string;
}

/** `?wydarzenie=<obszar>` aus der Adresse — eine Seite für viele Wydarzenia. */
function useHashParam(name: string): string {
  const read = () => {
    if (typeof window === 'undefined') return '';
    const hash = window.location.hash;
    const at = hash.indexOf('?');
    return at < 0 ? '' : (new URLSearchParams(hash.slice(at + 1)).get(name) ?? '').trim();
  };
  const [value, setValue] = useState(read);
  useEffect(() => {
    const again = () => setValue(read());
    window.addEventListener('hashchange', again);
    return () => window.removeEventListener('hashchange', again);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `read` hängt nur am Namen
  }, [name]);
  return value;
}

interface One {
  readonly shown: Shown;
  readonly forms: number;
  readonly controller: ControllerInfo | null;
}

function EventView({ config, ctx }: { config: OneConfig; ctx: PartContext }) {
  const fromAddress = useHashParam('wydarzenie');
  const areaId = config.area !== '' ? config.area : fromAddress;
  const [one, setOne] = useState<One | 'failed' | null>(null);

  useEffect(() => {
    if (areaId === '') { setOne('failed'); return undefined; }
    let alive = true;
    setOne(null);
    void (async () => {
      try {
        const out = await loadEvent(areaId);
        const shown = await shownOf(out.event);
        if (alive) setOne({ shown, forms: out.forms.length, controller: out.controller });
      } catch {
        if (alive) setOne('failed');
      }
    })();
    return () => { alive = false; };
  }, [areaId]);

  const whole = ctx.whole === true;
  const strip = ctx.size.height === 'strip' && !whole;
  const head = config.title !== '' ? <h2 className="wk-card-title">{config.title}</h2> : null;

  if (one === null) return <>{head}<Loading lines={strip ? 1 : 3} /></>;
  if (one === 'failed') {
    return <>{head}<p className="wk-card-muted">{areaId === '' ? 'Tu pojawi się wydarzenie — wybierz je w ustawieniach modułu albo podaj w adresie (?wydarzenie=…).' : 'Tego wydarzenia nie ma albo nie jest publiczne.'}</p></>;
  }

  const s = one.shown;
  const href = pagePath(s.card.page.path);

  if (strip) {
    return (
      <>
        {head}
        <p className="wk-events-strip">
          <a className="wk-event-title" href={href}>{s.title}</a>
          {s.when !== null && <span className="wk-event-when">{s.when}</span>}
          <Tags one={s} />
        </p>
      </>
    );
  }

  const tall = whole || ctx.size.height === 'tall';
  const image = s.card.page.imageId;
  const side = !tall && (ctx.size.width === 'wide' || ctx.size.width === 'full');

  return (
    <>
      {head}
      <div className={`wk-event-one${side ? ' is-side' : ''}${tall ? ' is-tall' : ''}`} data-event={s.card.areaId}>
        {image !== null && (
          <a className="wk-event-image" href={href} tabIndex={-1} aria-hidden="true">
            <FadeImg src={eventImageUrl(image)} alt="" loading="lazy" decoding="async" />
          </a>
        )}
        <div className="wk-event-body">
          <a className="wk-event-title" href={href}>{s.title}</a>
          {s.when !== null && <span className="wk-event-when">{s.when}</span>}
          {s.location !== null && <span className="wk-event-where">{s.location}</span>}
          {s.card.page.lead !== null && s.card.page.lead.trim() !== '' && <p className="wk-event-lead">{s.card.page.lead}</p>}
          {tall && s.card.organiser !== null && <span className="wk-event-who">Organizuje: {s.card.organiser}</span>}
          <Tags one={s} />
          {one.forms > 0 && s.card.item?.status !== 'cancelled' && <a className="wk-btn wk-btn-small wk-event-go" href={href}>Zapisz się</a>}
        </div>
      </div>
      {tall && <ControllerClause controller={one.controller} context="page" className="is-footer" report={{ kind: 'event', id: s.card.areaId }} />}
    </>
  );
}

function EventEditor({ raw, onSet, busy }: EditorProps) {
  const areas = useAreas();
  return (
    <>
      <label className="wk-field">
        <span>Nagłówek (opcjonalnie)</span>
        <input value={raw.title ?? ''} disabled={busy} placeholder="np. Najbliższe rekolekcje" onChange={(e) => onSet({ title: e.target.value })} />
      </label>
      <div className="wk-field">
        <span>Które wydarzenie</span>
        {areas === null ? <Loading lines={1} /> : (
          <AreaPick
            label="Które wydarzenie"
            areas={areas}
            only={areas.filter((a) => a.personal !== true)}
            value={raw.area ?? ''}
            onChange={(area) => onSet({ area })}
            extras={[{ value: '', label: '— z adresu strony (?wydarzenie=…) —' }]}
          />
        )}
      </div>
      <p className="wk-note">
        Pusty wybór: strona pokaże wydarzenie podane w adresie, np. #/strona?wydarzenie=&lt;identyfikator obszaru&gt; — jedna strona dla wielu wydarzeń.
      </p>
    </>
  );
}

export const eventPart = definePart<OneConfig>({
  kind: 'event',
  label: 'Wydarzenie',
  use: 'Jedno wydarzenie jako duża karta — wybrane tutaj albo podane w adresie strony (?wydarzenie=…).',
  box: { colSpan: 4, rowSpan: 3 },

  example: { title: 'Najbliższe rekolekcje', area: '<id-obszaru-wydarzenia>' },
  fields: [],
  extra: [
    { key: 'title', shape: 'line', says: 'nagłówek nad kartą; puste — bez nagłówka' },
    { key: 'area', shape: 'line', says: 'obszar wydarzenia (identyfikator) — najprościej wybrać w edytorze; puste — wydarzenie z adresu strony (?wydarzenie=<id>)' }
  ],
  Editor: EventEditor,

  read: (raw: RawConfig): OneConfig => ({ title: text(raw, 'title'), area: text(raw, 'area') }),
  /* Ohne Wahl zeigt er das Wydarzenie aus der Adresse. */
  hasContent: () => true,

  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nazwa, data i „Zapisy otwarte” w jednym wierszu.'
    : size.height === 'tall'
      ? 'Duże zdjęcie, data, miejsce, opis, organizator, „Zapisz się” i kto odpowiada za treść.'
      : size.width === 'wide' || size.width === 'full'
        ? 'Zdjęcie obok: nazwa, data, miejsce, opis i „Zapisz się”.'
        : 'Zdjęcie, nazwa, data, miejsce i „Zapisz się”.',

  View: EventView
});
