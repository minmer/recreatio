/**
 * 0131/0133 — „WYDARZENIA" und „WIZYTÓWKA": Bereiche mit einer Art als Karten auf einer Seite.
 *
 * <b>Wydarzenia</b> zeigt die Profile EINER Art (`type`: Wydarzenia, Grupy, Parafie i
 * organizacje, Kursy) gewählter Bereiche (und, auf Wunsch, der Bereiche darin) — dazu die,
 * die gebeten haben, hier zu stehen, und angenommen wurden. Im Katalog `recreatio.pl/events`
 * stehen von den Bitten nur freigegebene Karten; die gewählten Bereiche zeigt er wie jede Liste.
 *
 * <b>Wizytówka</b> (die Art heisst weiter `event`) zeigt EINE, grösser — eines Bereichs jeder
 * Art: gewählt im Baustein, oder — leer — aus der Adresse (`?wydarzenie=<obszar>`), damit eine
 * Seite jede zeigen kann.
 *
 * Eine Karte trägt nur, was öffentlich ist: Titel und Vorspann der Wizytówka (sonst der
 * Hauptseite), ihr Bild, Zeit und Ort des Haupttermins (mit dem offengelegten Schlüssel, hier
 * im Browser geöffnet), „Zapisy otwarte", wenn ein Formular annimmt — und nach dem Ende den
 * Weg zur Seite „Po wydarzeniu".
 *
 * <b>Je Grösse:</b> im Streifen das erste in einer Zeile; als Block wenige, knapp; hoch die
 * ganze Liste mit Bildern und Vorspann; über die ganze Breite ein Raster.
 */

import { useEffect, useState } from 'react';

import { t, useT, type T } from '../../core/i18n';

import { AreaPick, AreaPickMany } from '../../areas/AreaPick';
import type { AreaRow } from '../../areas/area';
import type { ControllerInfo } from '../../areas/controllers';
import { ControllerClause } from '../../areas/ControllerClause';
import { kindLabel, loadPublicProfile, openCard as openFace, type ProfileKind } from '../../areas/profile';
import { eventImageUrl, loadEvent, loadEvents, openCard, whenText, type EventCard, type EventWhen } from '../../events/events';
import { pagePath, parsePath } from '../../routes';
import { FadeImg } from '../../ui/fadeImage';
import { Loading } from '../../ui/Loading';
import { areasNow } from '../../workspace/viewData';
import { flag, maybeNumber, text, type EditorProps, type PartContext, type PartSize, type RawConfig } from '../part';
import { texts, textPart, withTexts } from './partTexts';

/* -- Gemeinsam ------------------------------------------------------------------------ */

/**
 * Die Worte einer Art — in der Liste, im Editor und in „co pokazuje": `moduleDataEvents.kind.<art>.*` (ganze Sätze je Art).
 * Die Wahl „Które": `moduleDataEvents.when.event.*` für Wydarzenia, `moduleDataEvents.when.kept.*` für alle anderen.
 */
const word = (t: T | ((key: string) => string), type: ProfileKind, what: 'label' | 'none' | 'noneEnded' | 'done' | 'showsStrip' | 'showsGrid' | 'showsList' | 'showsRow' | 'showsShort'): string =>
  t(`moduleDataEvents.kind.${type}.${what}`);
const whenWord = (t: T, type: ProfileKind, when: EventWhen): string => t(`moduleDataEvents.when.${type === 'event' ? 'event' : 'kept'}.${when}`);

const TYPES: readonly ProfileKind[] = ['event', 'group', 'organisation', 'course', 'school', 'class'];

const typeOf = (said: string): ProfileKind => ((TYPES as readonly string[]).includes(said) ? said as ProfileKind : 'event');

const WHENS: readonly EventWhen[] = ['coming', 'past', 'all'];

const whenOf = (said: string): EventWhen => ((WHENS as readonly string[]).includes(said) ? said as EventWhen : 'coming');

const filled = (said: string | null | undefined): string | null => {
  const t = (said ?? '').trim();
  return t === '' ? null : t;
};

/** Eine Karte mit dem, was dieser Browser aus ihr geöffnet hat. */
interface Shown {
  readonly card: EventCard;
  readonly title: string;
  readonly lead: string | null;
  readonly location: string | null;
  readonly when: string | null;
}

/**
 * Der Titel: der der Wizytówka, sonst der der Hauptseite, sonst der des Haupttermins, sonst
 * der Name des Bereichs. Der Vorspann: der der Wizytówka, sonst der der Hauptseite.
 */
async function shownOf(card: EventCard): Promise<Shown> {
  const [face, texts] = await Promise.all([
    card.card == null ? null : openFace(card.card, card.areaId, null).catch(() => null),
    /* Ohne die Wizytówka: nur Titel und Ort des Haupttermins. */
    openCard({ ...card, card: null }).catch(() => ({ title: null, location: null }))
  ]);
  return {
    card,
    title: filled(face?.title) ?? filled(card.page.title) ?? filled(texts.title) ?? card.name,
    lead: filled(face?.lead) ?? filled(card.page.lead),
    location: filled(texts.location),
    when: whenText(card.item)
  };
}

/** Vorbei: abgesagt nicht mitgezählt. Nach dem Ende kein „Zapisy otwarte" mehr. */
const doneOf = (card: EventCard): boolean => card.ended === true && card.item?.status !== 'cancelled';

function Tags({ one, withType = false }: { one: Shown; withType?: boolean }) {
  const t = useT();
  const card = one.card;
  const cancelled = card.item?.status === 'cancelled';
  const done = doneOf(card);
  const open = card.open && !cancelled && !done;
  const type = withType ? card.type ?? null : null;
  if (type === null && card.kind === null && !open && !cancelled && !done) return null;
  return (
    <span className="wk-tags">
      {type !== null && <span className="wk-tag">{kindLabel(type)}</span>}
      {card.kind !== null && <span className="wk-tag">{card.kind}</span>}
      {cancelled && <span className="wk-tag">{t('moduleDataEvents.cancelled')}</span>}
      {done && <span className="wk-tag">{word(t, card.type ?? 'event', 'done')}</span>}
      {open && <span className="wk-tag wk-tag-open">{t('moduleDataEvents.open')}</span>}
    </span>
  );
}

/** Nach dem Ende: der Weg zur Seite „Po wydarzeniu" — der Dienst nennt sie erst dann. */
function After({ card }: { card: EventCard }) {
  const t = useT();
  if (card.after == null) return null;
  return <a className="wk-event-after" href={pagePath(card.after.path)}>{t('moduleDataEvents.after')}</a>;
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
        {rich && one.lead !== null && <p className="wk-event-lead">{one.lead}</p>}
        {rich && one.card.organiser !== null && <span className="wk-event-who">{one.card.organiser}</span>}
        <Tags one={one} />
        <After card={one.card} />
      </div>
    </li>
  );
}

/* -- „Wydarzenia": die Liste -------------------------------------------------------- */

interface ListConfig {
  readonly title: string;
  readonly type: ProfileKind;
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
    type: typeOf(text(raw, 'type')),
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
  const t = useT();
  const [list, setList] = useState<readonly Shown[] | 'failed' | null>(null);
  const areasKey = config.areas.join(',');

  useEffect(() => {
    let alive = true;
    setList(null);
    void (async () => {
      try {
        const out = await loadEvents({
          areas: config.areas, type: config.type, deep: config.deep, kind: config.kind, when: config.when,
          limit: config.limit ?? 24, module: ctx.moduleId
        });
        const opened = await Promise.all(out.events.map(shownOf));
        if (alive) setList(opened);
      } catch {
        if (alive) setList('failed');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- die Liste der Bereiche zählt als Text
  }, [areasKey, config.type, config.deep, config.kind, config.when, config.limit, ctx.moduleId]);

  const whole = ctx.whole === true;
  const strip = ctx.size.height === 'strip' && !whole;
  const head = <h2 className="wk-card-title">{config.title !== '' ? config.title : word(t, config.type, 'label')}</h2>;

  if (list === null) return <>{head}<Loading lines={strip ? 1 : 3} /></>;
  if (list === 'failed') return <>{head}<p className="wk-card-muted">{t('moduleDataEvents.failed')}</p></>;
  if (list.length === 0) return <>{head}<p className="wk-card-muted">{word(t, config.type, config.when === 'past' ? 'noneEnded' : 'none')}</p></>;

  if (strip) {
    const next = list[0];
    return (
      <>
        {head}
        <p className="wk-events-strip">
          <a className="wk-event-title" href={pagePath(next.card.page.path)}>{next.title}</a>
          {next.when !== null && <span className="wk-event-when">{next.when}</span>}
          <Tags one={next} />
          <After card={next.card} />
          {list.length > 1 && <span className="wk-card-muted">{t('moduleDataCogita.v.andMore', { count: list.length - 1 })}</span>}
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
        <p className="wk-card-muted">{t('moduleDataEvents.more', { count: list.length - shown.length })}{ctx.openWhole !== undefined
          ? <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>{t('moduleDataEvents.showAll')}</button>
          : t('moduleDataEvents.fullList')}.</p>
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
  const t = useT();
  const areas = useAreas();
  const config = readList(raw);
  const label = word(t, config.type, 'label');

  return (
    <>
      <label className="wk-field">
        <span>{t('moduleDataCogita.f.heading')}</span>
        <input value={raw.title ?? ''} disabled={busy} placeholder={label} onChange={(e) => onSet({ title: e.target.value })} />
      </label>

      <label className="wk-field">
        <span>{t('moduleDataEvents.type')}</span>
        <select value={config.type} disabled={busy} onChange={(e) => onSet({ type: e.target.value })}>
          {TYPES.map((one) => <option key={one} value={one}>{word(t, one, 'label')}</option>)}
        </select>
      </label>

      <div className="wk-field">
        <span>{t('moduleDataEvents.fromAreas', { label })}</span>
        {areas === null ? <Loading lines={2} /> : (
          <AreaPickMany
            label={t('moduleDataEvents.fromAreas', { label })}
            areas={areas}
            only={areas.filter((a) => a.personal !== true)}
            value={config.areas}
            onChange={(next) => onSet({ areas: next.join(',') })}
          />
        )}
      </div>

      <label className="wk-check">
        <input type="checkbox" checked={config.deep} disabled={busy} onChange={(e) => onSet({ deep: e.target.checked ? 'yes' : 'no' })} />
        <span>{t('moduleDataEvents.deep')}</span>
      </label>

      <label className="wk-field">
        <span>{t('moduleDataEvents.kindOnly')}</span>
        <input value={raw.kind ?? ''} disabled={busy} placeholder={t('moduleDataEvents.kindPh')} maxLength={40} onChange={(e) => onSet({ kind: e.target.value })} />
      </label>

      <label className="wk-field">
        <span>{t('moduleDataEvents.which')}</span>
        <select value={config.when} disabled={busy} onChange={(e) => onSet({ when: e.target.value })}>
          {WHENS.map((one) => <option key={one} value={one}>{whenWord(t, config.type, one)}</option>)}
        </select>
      </label>

      <label className="wk-field">
        <span>{t('moduleDataEvents.limit')}</span>
        <input type="number" min={1} max={200} value={raw.limit ?? ''} disabled={busy} placeholder="24" onChange={(e) => onSet({ limit: e.target.value })} />
      </label>

      <p className="wk-note">
        {config.areas.length === 0 ? t('moduleDataEvents.noAreasNote') : ''}
        {t('moduleDataEvents.askNote')}
      </p>
    </>
  );
}

export const eventsPart = textPart<ListConfig>(texts({ label: 'moduleDataEvents.kind.event.label', use: 'moduleDataEvents.list.use' }), {
  kind: 'events',
  box: { colSpan: 6, rowSpan: 3 },

  example: withTexts({ type: 'event', deep: 'yes', when: 'coming', limit: '12' }, texts({ title: 'moduleDataEvents.list.exTitle', areas: 'moduleDataEvents.list.exAreas', kind: 'moduleDataEvents.list.exKind' })),
  fields: [],
  extra: [
    withTexts({ key: 'title', shape: 'line' } as const, texts({ says: 'moduleDataEvents.list.sTitle' })),
    withTexts({ key: 'type', shape: 'line' } as const, texts({ says: 'moduleDataEvents.list.sType' })),
    withTexts({ key: 'areas', shape: 'ids' } as const, texts({ says: 'moduleDataEvents.list.sAreas' })),
    withTexts({ key: 'deep', shape: 'line' } as const, texts({ says: 'moduleDataEvents.list.sDeep' })),
    withTexts({ key: 'kind', shape: 'line' } as const, texts({ says: 'moduleDataEvents.list.sKind' })),
    withTexts({ key: 'when', shape: 'line' } as const, texts({ says: 'moduleDataEvents.list.sWhen' })),
    withTexts({ key: 'limit', shape: 'line' } as const, texts({ says: 'moduleDataEvents.list.sLimit' }))
  ],
  Editor: EventsEditor,

  read: readList,
  /* Auch ohne Bereiche zeigt sie etwas: die Karten, die hier stehen dürfen. */
  hasContent: () => true,

  fullscreen: true,
  shows: (config, size) => word(t, config.type, size.height === 'strip' ? 'showsStrip'
    : size.height === 'tall' ? (size.width === 'full' || size.width === 'wide' ? 'showsGrid' : 'showsList')
      : size.width === 'full' ? 'showsRow' : 'showsShort'),

  View: EventsView
});

/* -- „Wizytówka": eine ---------------------------------------------------------------- */

interface OneConfig {
  readonly title: string;
  readonly area: string;
}

/** `?wydarzenie=<obszar>` aus der Adresse — eine Seite für viele. */
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
  /** Die Hauptseite — `null`: keine. */
  readonly href: string | null;
  readonly forms: number;
  readonly controller: ControllerInfo | null;
}

/**
 * Die Wizytówka eines Bereichs jeder Art (`/area/{id}/profile`). Steht er mit öffentlicher
 * Hauptseite in Listen, kommt deren Karte dazu: Titel und Vorspann der Hauptseite, wer
 * veranstaltet, ob abgesagt.
 */
async function oneOf(areaId: string): Promise<One> {
  const [profile, listed] = await Promise.all([
    loadPublicProfile(areaId),
    loadEvent(areaId).then((one) => one.event, () => null)
  ]);
  const path = profile.main?.path ?? listed?.page.path ?? null;
  const card: EventCard = {
    areaId,
    type: profile.kind,
    kind: profile.category,
    name: filled(profile.name) ?? kindLabel(profile.kind),
    organiser: listed?.organiser ?? null,
    page: {
      path: path ?? '',
      title: listed?.page.title ?? null,
      lead: listed?.page.lead ?? null,
      imageId: profile.imageId ?? listed?.page.imageId ?? null
    },
    card: profile.card,
    after: profile.after,
    ended: profile.ended,
    item: profile.item === null ? null : { ...profile.item, status: listed?.item?.status ?? null },
    open: profile.forms.length > 0,
    via: 'rule'
  };
  return { shown: await shownOf(card), href: path === null ? null : pagePath(path), forms: profile.forms.length, controller: profile.controller };
}

function EventView({ config, ctx }: { config: OneConfig; ctx: PartContext }) {
  const t = useT();
  const fromAddress = useHashParam('wydarzenie');
  const areaId = config.area !== '' ? config.area : fromAddress;
  const [one, setOne] = useState<One | 'failed' | null>(null);

  useEffect(() => {
    if (areaId === '') { setOne('failed'); return undefined; }
    let alive = true;
    setOne(null);
    void oneOf(areaId).then((found) => { if (alive) setOne(found); }, () => { if (alive) setOne('failed'); });
    return () => { alive = false; };
  }, [areaId]);

  const whole = ctx.whole === true;
  const strip = ctx.size.height === 'strip' && !whole;
  const head = config.title !== '' ? <h2 className="wk-card-title">{config.title}</h2> : null;

  if (one === null) return <>{head}<Loading lines={strip ? 1 : 3} /></>;
  if (one === 'failed') {
    return (
      <>
        {head}
        <p className="wk-card-muted">{areaId === ''
          ? t('moduleDataEvents.one.empty')
          : t('moduleDataEvents.one.none')}</p>
      </>
    );
  }

  const s = one.shown;
  const href = one.href;
  /* Auf ihrer eigenen Hauptseite: Titel und Vorspann stehen schon im Kopf der Seite, das Formular darunter. */
  const own = s.card.page.path !== '' && parsePath(window.location.hash).page === s.card.page.path;
  const title = own ? null : href === null ? <span className="wk-event-title">{s.title}</span> : <a className="wk-event-title" href={href}>{s.title}</a>;
  const join = !own && one.forms > 0 && href !== null && s.card.item?.status !== 'cancelled' && !doneOf(s.card);

  if (strip) {
    return (
      <>
        {head}
        <p className="wk-events-strip">
          {title}
          {s.when !== null && <span className="wk-event-when">{s.when}</span>}
          <Tags one={s} withType />
          <After card={s.card} />
        </p>
      </>
    );
  }

  const tall = whole || ctx.size.height === 'tall';
  const image = s.card.page.imageId === null ? null : <FadeImg src={eventImageUrl(s.card.page.imageId)} alt="" loading="lazy" decoding="async" />;
  const side = !tall && (ctx.size.width === 'wide' || ctx.size.width === 'full');

  return (
    <>
      {head}
      <div className={`wk-event-one${side ? ' is-side' : ''}${tall ? ' is-tall' : ''}`} data-event={s.card.areaId}>
        {image !== null && (href === null
          ? <span className="wk-event-image">{image}</span>
          : <a className="wk-event-image" href={href} tabIndex={-1} aria-hidden="true">{image}</a>)}
        <div className="wk-event-body">
          {title}
          {s.when !== null && <span className="wk-event-when">{s.when}</span>}
          {s.location !== null && <span className="wk-event-where">{s.location}</span>}
          {!own && s.lead !== null && <p className="wk-event-lead">{s.lead}</p>}
          {tall && s.card.organiser !== null && <span className="wk-event-who">{t('moduleDataEvents.one.organiser', { name: s.card.organiser })}</span>}
          <Tags one={s} withType />
          {(join || s.card.after != null) && (
            <span className="wk-event-actions">
              {join && <a className="wk-btn wk-btn-small" href={href}>{t('moduleDataEvents.one.join')}</a>}
              <After card={s.card} />
            </span>
          )}
        </div>
      </div>
      {tall && <ControllerClause controller={one.controller} context="page" className="is-footer" report={{ kind: 'event', id: s.card.areaId }} />}
    </>
  );
}

function EventEditor({ raw, onSet, busy }: EditorProps) {
  const t = useT();
  const areas = useAreas();
  return (
    <>
      <label className="wk-field">
        <span>{t('moduleDataEvents.one.heading')}</span>
        <input value={raw.title ?? ''} disabled={busy} placeholder={t('moduleDataEvents.one.headingPh')} onChange={(e) => onSet({ title: e.target.value })} />
      </label>
      <div className="wk-field">
        <span>{t('moduleDataEvents.one.area')}</span>
        {areas === null ? <Loading lines={1} /> : (
          <AreaPick
            label={t('moduleDataEvents.one.area')}
            areas={areas}
            only={areas.filter((a) => a.personal !== true)}
            value={raw.area ?? ''}
            onChange={(area) => onSet({ area })}
            extras={[{ value: '', label: t('moduleDataEvents.one.fromAddress') }]}
            disabled={busy}
          />
        )}
      </div>
      <p className="wk-note">
        {t('moduleDataEvents.one.note')}
      </p>
    </>
  );
}

export const eventPart = textPart<OneConfig>(texts({ label: 'moduleDataEvents.one.label', use: 'moduleDataEvents.one.use' }), {
  kind: 'event',
  box: { colSpan: 4, rowSpan: 3 },

  example: texts({ title: 'moduleDataEvents.one.exTitle', area: 'moduleDataEvents.one.exArea' }),
  fields: [],
  extra: [
    withTexts({ key: 'title', shape: 'line' } as const, texts({ says: 'moduleDataEvents.one.sTitle' })),
    withTexts({ key: 'area', shape: 'line' } as const, texts({ says: 'moduleDataEvents.one.sArea' }))
  ],
  Editor: EventEditor,

  read: (raw: RawConfig): OneConfig => ({ title: text(raw, 'title'), area: text(raw, 'area') }),
  /* Ohne Wahl zeigt er die Wizytówka aus der Adresse. */
  hasContent: () => true,

  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? t('moduleDataEvents.one.showsStrip')
    : size.height === 'tall'
      ? t('moduleDataEvents.one.showsTall')
      : size.width === 'wide' || size.width === 'full'
        ? t('moduleDataEvents.one.showsSide')
        : t('moduleDataEvents.one.showsBlock'),

  View: EventView
});
