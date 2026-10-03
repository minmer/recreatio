/**
 * DER KALENDER ALS BAUSTEIN EINER SEITE (0058) — die Termine eines oder
 * mehrerer Kalender, dort, wo die Gruppe ohnehin ist.
 *
 * <code>
 *   Streifen            der nächste Termin, eine Zeile
 *   schmal / Block      die nächsten Termine als Liste
 *   breit und hoch      die Woche im Stundenraster, mit ‹ Dziś ›
 *   Vollbild            Woche · Monat · Liste — und wer in dem Kalender
 *                       schreibt, trägt hier auch ein und ändert (derselbe
 *                       Kalender wie im Arbeitsplatz, nur auf diese begrenzt)
 * </code>
 *
 * <b>Jeder sieht, was er sehen darf — und zwar ALLES davon.</b> Wer angemeldet
 * ist, mit seinen Schlüsseln; wer mit einem persönlichen Link kommt, mit dem,
 * was sein Platz aufschliesst; wer einen Link mit Zugang hält, mit dem, was
 * dessen Rolle liest; jeder, was offen ausgehängt ist. Die Wege ADDIEREN sich:
 * vorher schloss der erste die anderen aus, und wer sich anmeldete, sah mit
 * demselben Link in der Hand weniger als ein Besucher ohne Konto.
 *
 * <b>Wer eintragen darf, trägt ein — mit Konto oder mit Link.</b> Ein Link,
 * der „pisze" sagt, schreibt auch (`linkMe.ts`): ohne Konto handelt der
 * Browser als die Linkrolle. Wer angemeldet ist, handelt als er selbst und
 * bekommt gesagt, dass er den Link dafür in sein Konto aufnimmt.
 *
 * Der Dienst gibt nichts anderes heraus — hier wird nur geöffnet.
 */

import { useEffect, useState, type CSSProperties } from 'react';

import { loadAreas, type AreaRow } from './area';
import { areaReader } from './areaRead';
import {
  emptyTexts, ITEM_LABEL, itemFieldAad, loadCalendars, loadItems, loadPublic, putText,
  type CalendarRow, type Days, type ItemKind, type ItemTexts
} from './calendar';
import { Calendar, ListView, MonthGrid, TimeGrid } from './CalendarApp';
import { hueOf, stepView, viewRange, type CalEvent, type CalView } from './calendarModel';
import { areaKeys } from './chat';
import { fromBase64Url, openText } from './crypto';
import { useHeldLinksStamp } from './HeldLinkBar';
import { ItemLink } from './ItemLink';
import { accessWords, heldLinkKeys, heldProofs, type HeldInfo } from './linkAccess';
import { useLinkMe } from './linkMe';
import { addDays, longDate, monthTitle, rangeTitle, sameDay, startOfDay } from './dayMath';
import { useNow } from './MassParts';
import { useMe, useWho, type Me } from './me';
import { Modal } from './Modal';
import type { PartContext } from './part';
import { usePerson } from './pagePerson';

const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

interface Detail { location: string | null; notes: string | null; link: string | null; linkLabel: string | null }

interface Opened {
  readonly events: readonly CalEvent[];
  readonly details: ReadonlyMap<string, Detail>;
  readonly calendars: readonly { id: string; areaId: string | null; title: string | null; description: string | null }[];
}

/**
 * Die Kalender des Bausteins, wie DIESER Mensch sie hat — mit „schreibt er
 * darin". `undefined`: wird noch geholt; leer: er hat keinen davon.
 */
function useOwnCalendars(identity: Me | null | undefined, ids: string): readonly CalendarRow[] | undefined {
  const [found, setFound] = useState<{ of: Me; ids: string; rows: readonly CalendarRow[] } | null>(null);

  useEffect(() => {
    if (identity == null) return undefined;
    let alive = true;
    const wanted = new Set(ids.split(','));
    loadCalendars()
      .then((got) => got.calendars.filter((c) => wanted.has(c.calendarId)), () => [] as readonly CalendarRow[])
      .then((rows) => { if (alive) setFound({ of: identity, ids, rows }); });
    return () => { alive = false; };
  }, [identity, ids]);

  if (identity === undefined) return undefined;
  if (identity === null) return [];
  return found !== null && found.of === identity && found.ids === ids ? found.rows : undefined;
}

/**
 * Die Bereiche der Links als Zeilen — NUR, um eine Gruppe beim Namen zu
 * nennen. Nichts daran sagt, was das Konto dort darf: es hat sie nicht.
 */
function linkAreas(links: readonly HeldInfo[], known: readonly AreaRow[]): AreaRow[] {
  const have = new Set(known.map((a) => a.areaId));
  const out: AreaRow[] = [];

  for (const area of links.flatMap((one) => one.info?.areas ?? [])) {
    if (have.has(area.areaId)) continue;
    have.add(area.areaId);
    out.push({
      areaId: area.areaId, name: area.name, currentEpoch: 0, heldEpochs: 0, publishedEpochs: 0, parentAreaId: null,
      publicLevel: 'none', seatLevel: 'own', myLevel: null, mayCertify: false
    });
  }

  return out;
}

/*
 * „Dopisz termin" auf der Kachel holt den Kalender ins ganze Fenster — und
 * dort soll gleich der neue Termin aufgehen, nicht erst nach einem zweiten
 * Klick. Die Kachel und das Vollbild sind zwei Bilder desselben Bausteins;
 * dazwischen trägt dieses Wort, wer gemeint war.
 */
let startsNew: string | null = null;

export function CalendarPartView({ title, calendarIds, ctx }: { title: string; calendarIds: readonly string[]; ctx: PartContext }) {
  const who = useWho();
  const me = useMe(who);

  /* Ohne Sitzung handeln die Links mit Zugang, die dieser Browser hält (`linkMe.ts`). */
  const linked = useLinkMe(who === null);

  /* WER HIER HANDELT: das Konto — oder, ohne Konto, die Links. */
  const identity = who === undefined ? undefined : who === null ? linked : me;
  const ids = calendarIds.join(',');
  const own = useOwnCalendars(identity, ids);
  const writes = own?.some((c) => c.mayWrite === true && c.archived !== true) ?? false;

  const head = <h2 className="wk-card-title">{title.trim() === '' ? 'Kalendarz' : title}</h2>;

  if (calendarIds.length === 0) {
    return <>{head}<p className="wk-card-muted">Tu pojawią się terminy — trzeba jeszcze wybrać kalendarz.</p></>;
  }

  if (ctx.whole === true && identity != null) {
    if (own === undefined) return <p className="wk-card-muted">Wczytywanie…</p>;

    /*
     * IM VOLLBILD DER GANZE KALENDER — für den, der ihn hat. Das Konto, wenn
     * es einen dieser Kalender überhaupt sieht (auch nur zum Lesen: dann mit
     * allem, was der Arbeitsplatz dazu zeigt); die Links, wenn sie hier
     * SCHREIBEN. Sonst der Aushang unten: er zeigt mehr als ein leerer
     * Kalender, in dem man nichts darf.
     */
    if (who === null ? writes : own.length > 0) {
      return (
        <div className="wk-cal-part is-whole">
          <Calendar me={identity} scope={calendarIds}
            startNew={() => { const wanted = startsNew === ctx.moduleId; startsNew = null; return wanted; }} />
        </div>
      );
    }
  }

  const openWhole = ctx.openWhole;

  return (
    <>
      {head}
      <ReadOnlyCalendar
        calendarIds={calendarIds} me={me ?? null} identity={identity ?? null} signedIn={who != null} ctx={ctx}
        onAdd={writes && ctx.whole !== true && openWhole !== undefined
          ? () => { startsNew = ctx.moduleId; openWhole(); }
          : undefined}
      />
    </>
  );
}

function ReadOnlyCalendar({ calendarIds, me, identity, signedIn, ctx, onAdd }: {
  calendarIds: readonly string[];

  /** Das Konto mit seinem Bund — `null`: niemand angemeldet (oder ohne Schlüssel in diesem Tab). */
  me: Me | null;

  /** Wer hier handelt, Konto oder Links — für die Namen der Gruppen. */
  identity: Me | null;
  signedIn: boolean;
  ctx: PartContext;

  /** Wer hier schreibt: ein neuer Termin (im ganzen Fenster). */
  onAdd?: () => void;
}) {
  const person = usePerson();
  const seat = person?.chosen?.kind === 'seat' ? person.chosen.seat.token : undefined;
  const now = useNow();
  const whole = ctx.whole === true;
  const big = whole || ((ctx.size.width === 'wide' || ctx.size.width === 'full') && ctx.size.height === 'tall');
  const strip = ctx.size.height === 'strip' && !whole;

  const [view, setView] = useState<CalView>(big ? 'week' : 'list');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [data, setData] = useState<(Opened & { from: number; to: number }) | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<CalEvent | null>(null);
  const [held, setHeld] = useState<readonly HeldInfo[]>([]);
  const linksStamp = useHeldLinksStamp();

  const shownView: CalView = big ? view : 'list';
  const range = shownView === 'list' ? { from: startOfDay(now), to: addDays(startOfDay(now), 30) } : viewRange(shownView, anchor);
  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();
  const ids = calendarIds.join(',');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = new Date(fromMs);
        const to = new Date(toMs);
        const list = ids.split(',').filter((one) => one !== '');

        /*
         * 0073 — die Links mit Zugang, die dieser Browser hält: IMMER, auch
         * angemeldet. Mit Konto kommt dazu, was das Konto liest; der Platz, der
         * oben auf der Seite gewählt ist, zählt in beiden Fällen.
         */
        const links = await heldProofs().catch(() => []);
        const days: Days[] = await Promise.all(list.map((id) => (me !== null
          ? loadItems(id, from, to, undefined, seat, links)
          : loadPublic(id, from, to, undefined, seat, links)).catch(() => null))).then((all) => all.filter((d): d is Days => d !== null));

        /*
         * Die Schlüssel: meine (einmal je Tab ausgepackt) — sonst die offen
         * ausgehängten, sonst die der Links in diesem Browser. Der Leser fragt
         * das Konto nicht noch einmal: das ist oben schon geschehen.
         */
        const reader = areaReader(null);
        const keyOf = async (areaId: string, epoch: number): Promise<Uint8Array | null> => {
          if (me !== null) {
            const mine = (await areaKeys(me.ring, areaId).catch(() => null))?.get(epoch);
            if (mine !== undefined) return mine;
          }
          return (await reader.key(areaId, epoch)) ?? null;
        };

        const events: CalEvent[] = [];
        const details = new Map<string, Detail>();
        /* Je Termin EINMAL geöffnet — auch für sein zweites, drittes Vorkommen (vorher blieben dort Ort und Notiz leer). */
        const texts = new Map<string, ItemTexts>();

        for (const day of days) {
          for (const o of day.occurrences) {
            let found = texts.get(o.itemId);
            if (found === undefined) {
              found = emptyTexts();
              for (const f of o.fields) {
                try {
                  const key = await keyOf(f.areaId, f.epoch);
                  if (key !== null) putText(found, f.field, await openText(key, itemFieldAad(o.itemId, f.field), fromBase64Url(f.sealed)));
                } catch { /* nicht für mich */ }
              }
              texts.set(o.itemId, found);
            }
            const key = `p:${o.itemId}:${o.occurrenceAt}`;
            details.set(key, { location: found.location, notes: found.notes, link: found.link, linkLabel: found.linkLabel });
            events.push({
              key,
              source: 'item',
              /* Ohne eigenen Titel: der Name des Kalenders („Spotkania z kandydatami") — nicht bloss die Art. */
              title: found.title ?? o.titlePublic ?? day.title ?? ITEM_LABEL[o.kind as ItemKind] ?? 'termin',
              start: new Date(o.startsAt),
              end: new Date(o.endsAt),
              allDay: o.allDay,
              areaId: o.visibilityAreaId,
              calendarId: day.calendarId,
              cancelled: o.status === 'cancelled',
              /* 0074 — Teile stehen in ihrem Ganzen, auch hier. */
              program: { itemId: o.itemId, parentItemId: o.parentItemId ?? null, position: o.position ?? null },
              ...(found.link === null ? {} : { link: { url: found.link, label: found.linkLabel } })
            });
          }
        }

        events.sort((a, b) => a.start.getTime() - b.start.getTime());

        /* Wie die Gruppen heissen — für das Konto wie für die Links. Ein Besucher hat keine. */
        const found = identity !== null ? (await loadAreas().catch(() => ({ areas: [] as readonly AreaRow[] }))).areas : [];

        /*
         * Welche Links dieser Browser hält — für den Hinweis an den Angemeldeten,
         * der damit schreiben könnte, und für die NAMEN der Gruppen, die sein
         * Konto nicht hat: sonst stünde bei jedem Termin des Links „inna grupa".
         */
        const mine = signedIn && links.length > 0 ? (await heldLinkKeys().catch(() => null))?.links ?? [] : [];

        if (!alive) return;
        setAreas([...found, ...linkAreas(mine, found)]);
        setHeld(mine);
        setData({
          from: fromMs, to: toMs, events, details,
          calendars: days.map((d) => ({ id: d.calendarId, areaId: d.areaId ?? null, title: d.title ?? null, description: d.description ?? null }))
        });
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [ids, me, identity, signedIn, seat, fromMs, toMs, linksStamp]);

  if (failed) return <p className="wk-card-muted">Nie udało się wczytać terminów.</p>;
  if (data === null) return <p className="wk-card-muted">Wczytywanie…</p>;

  const upcoming = data.events.filter((e) => e.end.getTime() >= now.getTime());
  const descriptions = data.calendars.filter((c) => c.description !== null && c.description.trim() !== '');

  if (strip) {
    const next = upcoming[0];
    return (
      <p className="wk-cal-part-next">
        {next === undefined ? 'W najbliższym czasie nic.' : <>Najbliższy: <strong>{next.title}</strong> · {longDate(next.start)}{next.allDay ? '' : `, ${time(next.start)}`}</>}
      </p>
    );
  }

  const label = shownView === 'day' ? longDate(anchor) : shownView === 'month' ? monthTitle(anchor) : rangeTitle(range.from, range.to);
  const days = shownView === 'day' ? [anchor] : Array.from({ length: 7 }, (_, i) => addDays(range.from, i));
  const detail = open === null ? null : data.details.get(open.key);

  /*
   * ANGEMELDET, UND EIN LINK IN DIESEM BROWSER SCHREIBT HIER — das Konto aber
   * nicht. Dann handelt das Konto (mit Sitzung zählt beim Dienst nur es), und
   * der Link muss hinein: ein Knopf, kein Rätsel, warum „pisze" nicht schreibt.
   */
  const here = new Set(data.calendars.map((c) => c.areaId).filter((id): id is string => id !== null));
  const joinable = onAdd !== undefined ? [] : held.filter((one) => one.info !== null
    /* Ohne Bund in diesem Tab lässt sich nicht sagen, ob das Konto ihn schon hat — dann nichts behaupten. */
    && me !== null && !me.ring.has(one.info.roleId)
    && one.info.areas.some((a) => here.has(a.areaId) && (a.capability === 'write' || a.capability === 'admin')));

  return (
    <div className="wk-cal-part">
      {joinable.map((one) => (
        <p key={one.token} className="wk-note wk-cal-part-join">
          <span>
            Link{one.info!.label !== null ? ` „${one.info!.label}”` : ''} w tej przeglądarce pozwala tu dopisywać terminy
            ({accessWords(one.info!.areas)}). Jesteś zalogowany — dodaj go do konta, a będziesz pisać jako Ty.
          </span>
          <a className="wk-btn wk-btn-line" href={`#/dolacz/${one.token}`}>Dodaj do konta</a>
        </p>
      ))}

      {descriptions.length > 0 && (whole || ctx.size.height === 'tall') && (
        <div className="wk-cal-part-rules">
          {descriptions.map((c) => (
            <p key={c.id} style={{ '--ev-h': hueOf(c.id) } as CSSProperties}>
              {descriptions.length > 1 && c.title !== null && <strong>{c.title}: </strong>}{c.description}
            </p>
          ))}
        </div>
      )}

      {big && (
        <div className="wk-cal2-bar">
          <div className="wk-mass-nav">
            <button type="button" className="wk-mass-step" aria-label="Wcześniej" onClick={() => setAnchor(stepView(shownView, anchor, -1))}>‹</button>
            <button type="button" className="wk-mass-today" aria-pressed={sameDay(anchor, now)} onClick={() => setAnchor(startOfDay(new Date()))}>Dziś</button>
            <button type="button" className="wk-mass-step" aria-label="Później" onClick={() => setAnchor(stepView(shownView, anchor, 1))}>›</button>
          </div>
          <p className="wk-mass-range">{label}</p>
          <div className="wk-seg" role="group" aria-label="Widok">
            {([['week', 'Tydzień'], ['month', 'Miesiąc'], ['list', 'Lista']] as const).map(([value, text]) => (
              <button key={value} type="button" aria-pressed={view === value}
                className={view === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => setView(value)}>{text}</button>
            ))}
          </div>
          {onAdd !== undefined && <div className="wk-cal2-add"><button type="button" className="wk-btn" onClick={onAdd}>+ Termin</button></div>}
        </div>
      )}

      {shownView === 'week' || shownView === 'day' ? (
        <TimeGrid days={days} events={data.events} marks={[]} now={now} areas={areas} readOnly
          onDay={(day) => { setAnchor(day); setView('week'); }} onSlot={() => undefined} onOpen={setOpen} onTasks={() => undefined} />
      ) : shownView === 'month' ? (
        <MonthGrid anchor={anchor} from={range.from} events={data.events} marks={[]} now={now} readOnly
          onDay={(day) => { setAnchor(day); setView('week'); }} onSlot={() => undefined} onOpen={setOpen} onTasks={() => undefined} />
      ) : (
        <ListView from={range.from} events={big ? data.events : upcoming.slice(0, ctx.size.height === 'tall' ? 12 : 5)}
          marks={[]} now={now} areas={areas} onOpen={setOpen} onTasks={() => undefined} />
      )}

      {/* Klein: derselbe Weg zum Eintragen, unter der Liste. */}
      {!big && onAdd !== undefined && (
        <div className="wk-actions"><button type="button" className="wk-btn wk-btn-quiet" onClick={onAdd}>+ Termin</button></div>
      )}

      {open !== null && (
        <Modal title={open.title} onClose={() => setOpen(null)}>
          <p className="wk-ev-when">{longDate(open.start)}{open.allDay ? '' : `, ${time(open.start)}–${time(open.end)}`}</p>
          {detail?.location && <p><strong>Miejsce:</strong> {detail.location}</p>}
          {detail?.notes && <p className="wk-ev-notes">{detail.notes}</p>}
          {detail?.link && <p><ItemLink url={detail.link} label={detail.linkLabel} /></p>}
          {open.cancelled && <p className="wk-note">Ten termin jest odwołany.</p>}
          <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => setOpen(null)}>Zamknij</button></div>
        </Modal>
      )}
    </div>
  );
}

export default CalendarPartView;
