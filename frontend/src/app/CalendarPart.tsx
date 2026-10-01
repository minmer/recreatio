/**
 * DER KALENDER ALS BAUSTEIN EINER SEITE (0058) — die Termine eines oder
 * mehrerer Kalender, dort, wo die Gruppe ohnehin ist.
 *
 * <code>
 *   Streifen            der nächste Termin, eine Zeile
 *   schmal / Block      die nächsten Termine als Liste
 *   breit und hoch      die Woche im Stundenraster, mit ‹ Dziś ›
 *   Vollbild            Woche · Monat · Liste — und wer den Kalender führt,
 *                       trägt hier auch ein und ändert (derselbe Kalender
 *                       wie im Arbeitsplatz, nur auf diese Kalender begrenzt)
 * </code>
 *
 * <b>Jeder sieht, was er sehen darf.</b> Wer angemeldet ist, mit seinen
 * Schlüsseln; wer mit einem persönlichen Link kommt, mit dem, was sein Platz
 * aufschliesst; jeder andere, was offen ausgehängt ist. Der Dienst gibt
 * nichts anderes heraus — hier wird nur geöffnet.
 */

import { useEffect, useState, type CSSProperties } from 'react';

import { loadAreas, loadPublicKey, type AreaRow } from './area';
import { emptyTexts, ITEM_LABEL, itemFieldAad, loadItems, loadPublic, putText, type Days, type ItemKind, type ItemTexts } from './calendar';
import { Calendar, ListView, MonthGrid, TimeGrid } from './CalendarApp';
import { hueOf, stepView, viewRange, type CalEvent, type CalView } from './calendarModel';
import { areaKeys } from './chat';
import { fromBase64Url, openText } from './crypto';
import { useHeldLinksStamp } from './HeldLinkBar';
import { ItemLink } from './ItemLink';
import { heldAreaKey, heldProofs } from './linkAccess';
import { addDays, longDate, monthTitle, rangeTitle, sameDay, startOfDay } from './dayMath';
import { useNow } from './MassParts';
import { useMe, type Me } from './me';
import { Modal } from './Modal';
import type { PartContext } from './part';
import { usePerson } from './pagePerson';
import { whoIsThere, type Who } from './session';

const time = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

interface Detail { location: string | null; notes: string | null; link: string | null; linkLabel: string | null }

interface Opened {
  readonly events: readonly CalEvent[];
  readonly details: ReadonlyMap<string, Detail>;
  readonly calendars: readonly { id: string; title: string | null; description: string | null }[];
}

/** Angemeldet? Dann mit Schlüsselbund — sonst \`null\`. */
function useSignedIn(): Me | null | undefined {
  const [who, setWho] = useState<Who | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    whoIsThere().then((found) => { if (alive) setWho(found); }).catch(() => { if (alive) setWho(null); });
    return () => { alive = false; };
  }, []);
  return useMe(who);
}

export function CalendarPartView({ title, calendarIds, ctx }: { title: string; calendarIds: readonly string[]; ctx: PartContext }) {
  const me = useSignedIn();
  const head = <h2 className="wk-card-title">{title.trim() === '' ? 'Kalendarz' : title}</h2>;

  if (calendarIds.length === 0) {
    return <>{head}<p className="wk-card-muted">Tu pojawią się terminy — trzeba jeszcze wybrać kalendarz.</p></>;
  }

  /* Im Vollbild, angemeldet: der ganze Kalender — wer ihn führt, trägt ein. */
  if (ctx.whole === true && me != null) {
    return <div className="wk-cal-part is-whole"><Calendar me={me} scope={calendarIds} /></div>;
  }

  return <>{head}<ReadOnlyCalendar calendarIds={calendarIds} me={me ?? null} ctx={ctx} /></>;
}

function ReadOnlyCalendar({ calendarIds, me, ctx }: { calendarIds: readonly string[]; me: Me | null; ctx: PartContext }) {
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
        /* 0073 — ohne Konto auch die Links mit Zugang, die dieser Browser hält. */
        const links = me === null ? await heldProofs().catch(() => []) : [];
        const days: Days[] = await Promise.all(list.map((id) => (me !== null
          ? loadItems(id, from, to)
          : loadPublic(id, from, to, undefined, seat, links)).catch(() => null))).then((all) => all.filter((d): d is Days => d !== null));

        /* Die Schlüssel: meine — oder die offen ausgehängten, oder die der Links in diesem Browser. */
        const publicKeys = new Map<string, Promise<Uint8Array | null>>();
        const keyOf = async (areaId: string, epoch: number): Promise<Uint8Array | null> => {
          if (me !== null) return (await areaKeys(me.ring, areaId)).get(epoch) ?? null;
          if (!publicKeys.has(areaId)) {
            publicKeys.set(areaId, loadPublicKey(areaId).then((k) => (k.epoch === epoch ? fromBase64Url(k.key) : null)).catch(() => null));
          }
          return (await publicKeys.get(areaId)!) ?? (links.length > 0 ? heldAreaKey(areaId, epoch) : null);
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
        const found = me !== null ? (await loadAreas().catch(() => ({ areas: [] }))).areas : [];
        if (!alive) return;
        setAreas(found);
        setData({ from: fromMs, to: toMs, events, details, calendars: days.map((d) => ({ id: d.calendarId, title: d.title ?? null, description: d.description ?? null })) });
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [ids, me, seat, fromMs, toMs, linksStamp]);

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

  return (
    <div className="wk-cal-part">
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
