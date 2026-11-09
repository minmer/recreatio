/**
 * DIE SMS WIE DIE ROZMOWY (2026-10-19) — dieselben Bausteine und Klassen wie der Chat
 * (`ch-*`, `ChatKit`): der Kopf mit Bild, Name, Lupe und ⋮; Blasen links und rechts
 * auf der Wand; Tage, die oben kleben; der Knopf nach unten mit der Zahl des Neuen;
 * markieren mit der Leiste darüber.
 *
 * Was SMS anders haben, steht im Kopf neben dem Namen: von welcher eigenen Nummer
 * geschrieben wird (die Karte, `lines.ts`) und ob das Gespräch ins Archiv geht.
 * Langes Drücken markiert gleich (wie „Zaznacz" im Chat) — danach wählt jeder Tipp.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { Avatar, clock, cls, COPY_WHO_PREF, dayKey, dayLabel, full, Icon, PopMenu, useButtonMenu, hueOf, type MenuItem } from '../chat/ChatKit';
import { DayChip, flashRow, SEEK_PAGES } from '../chat/DayJump';
import { useT } from '../core/i18n';
import { useRemembered } from '../core/prefs';
import { viewPath } from '../routes';
import { Modal } from '../ui/Modal';
import type { Line } from './native';
import { lineName, lineText, whyIcon, whyText, type LineChoice } from './lines';
import { copyReadable, MessageReader, usePress, type Readable } from './reading';
import { Linked } from './smsShared';

const iso = (ms: number) => new Date(ms).toISOString();

/** Die Farbe eines Absenders in einer Gruppe — wie im Chat. */
const hueStyle = (seed: string): CSSProperties => ({ '--ch-h': hueOf(seed) } as CSSProperties);

/**
 * Ein Gespräch füllt das Fenster: es sagt das der Seite selbst, mit einer Klasse an <html>
 * (`phone.css`) — :has() kennen ältere WebViews nicht, und dort läge die untere Leiste über dem Feld.
 */
export function useRoomFrame(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('ph-in-room');
    return () => root.classList.remove('ph-in-room');
  }, []);
}

/* -- Der Kopf -------------------------------------------------------------------------------- */

/**
 * DER KOPF EINES GESPRÄCHS: zurück, Bild, Name — darunter die Nummer, die eigene Karte
 * (wählbar) und das Archiv; rechts Anrufen, die Lupe und ⋮.
 */
export function SmsHeader({ back, title, seed, group = false, sub, menu, search, onSearch, call = null, muted = false }: {
  back: string;
  title: string;
  seed: string;
  group?: boolean;
  sub?: ReactNode;
  menu: readonly MenuItem[];
  search: string;
  onSearch: (text: string) => void;
  /** Eine Nummer zum Anrufen — `null`: keine (eine Gruppe, ein Absender ohne Nummer). */
  call?: string | null;
  muted?: boolean;
}) {
  const t = useT();
  const [searching, setSearching] = useState(search !== '');
  const more = useButtonMenu();
  const stop = () => { onSearch(''); setSearching(false); };

  if (searching) {
    return (
      <header className="ch-head is-search">
        <span className="ch-head-ic"><Icon name="search" /></span>
        <input className="ch-search" autoFocus value={search} placeholder={t('phoneChat.head.searchPh')} aria-label={t('phoneChat.head.search')}
          onChange={(e) => onSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
        <button type="button" className="ch-icon-btn" aria-label={t('phoneChat.head.closeSearch')} onClick={stop}><Icon name="x" /></button>
      </header>
    );
  }

  return (
    <header className="ch-head ph-head">
      <a className="ch-icon-btn" href={back} aria-label={t('phoneChat.head.all')} title={t('phoneChat.head.all')}><Icon name="back" /></a>
      <Avatar seed={seed} name={title} icon={group ? 'users' : /\p{L}/u.test(title) ? undefined : 'user'} />
      <div className="ch-head-text">
        <h1 className="ch-head-title">
          <span>{title}</span>
          {muted && <span className="ch-quiet" title={t('phoneChat.head.mutedTitle')}><Icon name="bell-off" label={t('phoneChat.head.muted')} /></span>}
        </h1>
        {sub !== undefined && <span className="ch-head-sub ph-head-sub">{sub}</span>}
      </div>
      {call !== null && (
        <a className="ch-icon-btn" href={`tel:${call.replace(/\s+/g, '')}`} aria-label={t('phoneChat.head.call')} title={t('phoneChat.head.call')}><Icon name="phone" /></a>
      )}
      <button type="button" className="ch-icon-btn" aria-label={t('phoneChat.head.search')} title={t('common.search')} onClick={() => setSearching(true)}>
        <Icon name="search" />
      </button>
      {menu.length > 0 && (
        <button type="button" className="ch-icon-btn" aria-label={t('phoneChat.head.moreOptions')} title={t('common.more')} aria-haspopup="menu"
          aria-expanded={more.open !== null} onClick={(e) => more.toggle(e.currentTarget)}>
          <Icon name="more" />
        </button>
      )}
      {more.open !== null && <PopMenu anchor={{ rect: more.open.rect }} from={more.open.from} label={t('phoneChat.head.options')} items={menu} onClose={more.close} />}
    </header>
  );
}

/**
 * DIE EIGENE NUMMER, VON DER GESCHRIEBEN WIRD — ein Plättchen im Kopf. Mit nur einer
 * Karte steht nichts da; mit zweien wählt man hier, und das bleibt für dieses Gespräch.
 */
export function LineChip({ lines, choice, onChoose }: {
  lines: readonly Line[];
  choice: LineChoice;
  /** Eine Karte für dieses Gespräch — `null`: wieder nach Gruppe und Gewohnheit. */
  onChoose: (line: Line | null) => void;
}) {
  const t = useT();
  const menu = useButtonMenu();
  if (lines.length < 2 || choice.line === null) return null;
  const current = choice.line;
  const items: MenuItem[] = [
    ...lines.map((l) => ({
      label: lineText(l),
      icon: 'phone' as const,
      checked: l.subId === current.subId,
      onSelect: () => onChoose(l)
    })),
    ...(choice.why === 'thread' ? [{ label: t('phoneChat.line.reset'), icon: 'refresh' as const, onSelect: () => onChoose(null) }] : [])
  ];
  return (
    <>
      <button type="button" className="ch-chip ph-line-chip" aria-haspopup="menu" aria-expanded={menu.open !== null}
        title={t('phoneChat.line.title', { line: lineText(current), why: whyText(choice) })} data-why={choice.why}
        onClick={(e) => { e.stopPropagation(); menu.toggle(e.currentTarget); }}>
        <Icon name={whyIcon(choice.why)} />{lineName(current)}<Icon name="down" />
      </button>
      {menu.open !== null && (
        <PopMenu anchor={{ rect: menu.open.rect }} from={menu.open.from} label={t('phoneChat.line.which')} items={items} onClose={menu.close}>
          <p className="ch-pop-head ph-why-head"><Icon name={whyIcon(choice.why)} />{t('phoneChat.line.head', { why: whyText(choice) })}</p>
        </PopMenu>
      )}
    </>
  );
}

/**
 * Geht dieses Gespräch ins Archiv? Wenn nicht und `onAdd` gesetzt ist (2026-11-09): ein Knopf,
 * der es gleich hineinnimmt — statt des Umwegs über ⋮ oder die Einstellungen des Archivs.
 */
export function ArchiveMark({ on, onAdd }: { on: boolean; onAdd?: () => void }) {
  const t = useT();
  if (!on && onAdd !== undefined) {
    return (
      <button type="button" className="ch-chip ph-line-chip ph-arch-add" title={t('phoneChat.arch.addTitle')} onClick={onAdd}>
        <Icon name="plus" />{t('phoneChat.arch.add')}
      </button>
    );
  }
  return (
    <span className={cls('ph-arch', on && 'is-on')} title={on ? t('phoneChat.arch.onTitle') : t('phoneChat.arch.offTitle')}>
      <Icon name="archive" />{on ? t('phoneChat.arch.on') : t('phoneChat.arch.off')}
    </span>
  );
}

/* -- Der Verlauf ------------------------------------------------------------------------------- */

/** Eine Nachricht, wie der Verlauf sie zeigt — vom Telefon oder aus dem Archiv. */
export interface SmsItem {
  readonly key: string;
  readonly mine: boolean;
  /** Millisekunden. */
  readonly at: number;
  readonly body: string;
  readonly subject?: string | null;
  /** In einer Gruppe: wer schrieb (bei fremden). */
  readonly author?: string | null;
  readonly authorSeed?: string;
  readonly state?: 'sending' | 'failed' | null;
  /** Bilder, Filme, Töne einer MMS. */
  readonly media?: ReactNode;
  /** Was über dem Text steht (eine MMS, die noch nicht geladen ist). */
  readonly note?: ReactNode;
  /** Knöpfe unter der Blase („Wyślij ponownie"). */
  readonly tools?: ReactNode;
  /** Mit zwei Karten: über welche Karte (Nummer) die Nachricht ging oder kam — ein kleines Zeichen; `simTitle` sagt es aus. */
  readonly sim?: string;
  readonly simTitle?: string;
}

const GAP = 10 * 60_000;

const fold = (text: string) => text.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

/* -- Wo man stand ------------------------------------------------------------------------------ */

/**
 * Wo ein Verlauf stand, als man ging: am Ende — oder welche Nachricht unten im Blick war
 * und wie weit über dem unteren Rand. Unten verankert, wie alles hier.
 */
interface Place {
  readonly end: boolean;
  readonly key: string;
  readonly below: number;
}

const PLACES = 'sms.places';
const PLACES_MAX = 150;
/** Wie oft beim Wiederherstellen Früheres nachgeladen wird, bis die Nachricht da ist. */
const RESTORE_PAGES = 20;
/** In der Reihenfolge des Merkens — die älteste fällt zuerst. */
const placesHere = new Map<string, { readonly place: Place; readonly lasting: boolean }>();
let placesRead = false;

const isPlace = (p: unknown): p is Place => p !== null && typeof p === 'object'
  && typeof (p as Place).end === 'boolean' && typeof (p as Place).key === 'string' && typeof (p as Place).below === 'number';

function placeNamed(name: string): Place | null {
  if (!placesRead) {
    placesRead = true;
    try {
      const stored = JSON.parse(localStorage.getItem(PLACES) ?? '{}') as unknown;
      if (stored !== null && typeof stored === 'object' && !Array.isArray(stored)) {
        for (const [n, p] of Object.entries(stored)) if (isPlace(p) && !placesHere.has(n)) placesHere.set(n, { place: p, lasting: true });
      }
    } catch {
      // ohne gemerkte Stellen
    }
  }
  return placesHere.get(name)?.place ?? null;
}

/** `lasting`: auch über das Schliessen der App hinaus — nur für Namen ohne Telefonnummern darin. */
function keepPlace(name: string, place: Place, lasting: boolean): void {
  placeNamed(name);
  placesHere.delete(name);
  placesHere.set(name, { place, lasting });
  for (const old of placesHere.keys()) {
    if (placesHere.size <= PLACES_MAX) break;
    placesHere.delete(old);
  }
  if (!lasting) return;
  try {
    const out: Record<string, Place> = {};
    for (const [n, p] of placesHere) if (p.lasting) out[n] = p.place;
    localStorage.setItem(PLACES, JSON.stringify(out));
  } catch {
    // voll oder gesperrt: dann nur, bis die App schliesst
  }
}

/** Die Nachricht unten im Blick — die letzte, deren Oberkante über dem unteren Rand liegt. */
function placeOf(el: HTMLElement, end: boolean): Place {
  if (end) return { end: true, key: '', below: 0 };
  const rows = el.querySelectorAll<HTMLElement>('.ch-row[data-key]');
  const bottom = el.getBoundingClientRect().bottom;
  let hit = -1;
  for (let lo = 0, hi = rows.length - 1; lo <= hi;) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].getBoundingClientRect().top < bottom) { hit = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (hit < 0) return { end: true, key: '', below: 0 };
  return { end: false, key: rows[hit].dataset.key ?? '', below: Math.round(bottom - rows[hit].getBoundingClientRect().bottom) };
}

const atEndOf = (el: HTMLElement) => el.scrollHeight - el.scrollTop - el.clientHeight < 64;

/**
 * Die Nachricht der Stelle wieder so weit über den unteren Rand. `null`: sie ist nicht (mehr) da;
 * sonst, um wie viele Pixel es daneben blieb (der Anfang oder das Ende des Geladenen hält auf).
 */
function putPlace(el: HTMLElement, place: Place): number | null {
  const row = el.querySelector<HTMLElement>(`.ch-row[data-key="${CSS.escape(place.key)}"]`);
  if (row === null) return null;
  el.scrollTop += row.getBoundingClientRect().bottom - (el.getBoundingClientRect().bottom - place.below);
  return Math.round(el.getBoundingClientRect().bottom - row.getBoundingClientRect().bottom - place.below);
}

/**
 * Zum Neuen ab `target` (der Trenner oder die erste neue Nachricht): passt alles Neue in den
 * Blick, das Ende — sonst steht es oben, unter dem klebenden Tag. `true`: am Ende.
 */
function showFrom(el: HTMLElement, target: HTMLElement, smooth = false): boolean {
  const top = target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
  const fits = el.scrollHeight - top <= el.clientHeight;
  const to = fits ? el.scrollHeight : Math.max(0, top - 40);
  if (smooth) el.scrollTo({ top: to, behavior: 'smooth' }); else el.scrollTop = to;
  return fits;
}

/**
 * DER VERLAUF: Tage als Abschnitte (das Datum klebt oben, solange sein Tag zu sehen ist),
 * Folgen eines Absenders, die Zeit in der Blase. Beim ersten Öffnen das Ende; danach die
 * Stelle, an der man ging (`place`) — ausser es kam Neues (`firstNew`): dann dorthin, mit
 * „Nieprzeczytane" davor. Wird der Verlauf niedriger (die Tastatur, ein Feld mit mehr
 * Zeilen), bleibt unten, was unten war, und oben verschwindet etwas. Was oben nachgeladen
 * wird, schiebt nichts weg; wer weiter oben liest, bekommt den Knopf nach unten mit der
 * Zahl dessen, was inzwischen kam — er führt zur ersten davon.
 */
export function SmsLog({ items, failed = null, more = false, onEarlier, group = false, search = '', tail, empty, pickActions, follow = 0, title, place, lasting = false, firstNew }: {
  items: readonly SmsItem[] | null;
  failed?: string | null;
  more?: boolean;
  onEarlier?: () => void;
  group?: boolean;
  search?: string;
  /** Nach der letzten: geplante, wartende, aus dem Browser. */
  tail?: ReactNode;
  empty?: string;
  /** Was mit den markierten geht (ausser Wyświetl und Kopiuj). */
  pickActions?: (chosen: readonly SmsItem[], done: () => void) => ReactNode;
  /** Ändert sich der Wert, geht es ans Ende (gesendet). */
  follow?: number;
  /** Für den Leser: wie das Gespräch heisst. */
  title: string;
  /** Unter diesem Namen merkt sich der Verlauf, wo man stand. */
  place?: string;
  /** Auch über das Schliessen der App hinaus (im Gerät) — nur, wenn der Name keine Telefonnummer enthält. */
  lasting?: boolean;
  /**
   * Die erste Nachricht, die beim Öffnen neu (ungelesen) war: dorthin statt zur gemerkten Stelle.
   * `null`: nichts Neues; nicht gesetzt: noch nicht bekannt — die gemerkte Stelle wartet darauf.
   */
  firstNew?: string | null;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const seen = useRef<{ first: string | null; last: string | null }>({ first: null, last: null });
  /* Zum ersten Mal: das Ende. Sonst die gemerkte Stelle — notfalls mit früheren Seiten, bis ihre Nachricht da ist. */
  const [from] = useState(() => (place === undefined ? null : placeNamed(place)));
  const restoring = useRef<{ readonly place: Place; pages: number } | null>(from !== null && !from.end ? { place: from, pages: 0 } : null);
  /* Wer nicht am Ende ist: die Nachricht unten im Blick — an ihr hält sich der Verlauf, wenn sich Höhen ändern. */
  const pin = useRef<Place | null>(null);
  /* Zu welcher neuen schon gegangen wurde; die erste von dem, was kam, während man weiter oben las. */
  const shownNew = useRef<string | null>(null);
  const freshFrom = useRef<string | null>(null);
  const giveUp = useRef<number | undefined>(undefined);
  const saveSoon = useRef<number | undefined>(undefined);
  /* Ein Tag, zu dem gesprungen wird (das Datum als Knopf) — notfalls mit früheren Seiten. */
  const seek = useRef<{ readonly start: number; pages: number } | null>(null);
  const seekGiveUp = useRef<number | undefined>(undefined);
  /* Beginnt oder endet das Markieren, rücken die Zeilen ein oder aus: die Zeile unter dem Finger bleibt, wo sie war. */
  const still = useRef<{ readonly key: string; readonly top: number } | null>(null);
  const [away, setAway] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [reading, setReading] = useState(false);
  /* Kopieren mit „wer und wann" oder nur die Texte — gemerkt (dieselbe Wahl wie in den Rozmowy). */
  const [copyWho, setCopyWho] = useRemembered(COPY_WHO_PREF, 'yes');
  const withWho = copyWho !== 'no';
  const copyMenu = useButtonMenu();

  const needle = fold(search.trim());
  const visible = useMemo(() => (items === null ? [] : needle === '' ? items : items.filter((m) => fold(m.body).includes(needle))), [items, needle]);
  const first = visible[0]?.key ?? null;
  const last = visible[visible.length - 1]?.key ?? null;

  const earlier = () => {
    const el = box.current;
    if (el !== null) anchor.current = el.scrollHeight;
    onEarlier?.();
  };

  /*
    ZU EINEM TAG (das Datum als Knopf, `DayJump`): liegt er vor dem Geladenen, erst Früheres
    nachladen; dann die erste Nachricht ab diesem Tag oben, unter dem klebenden Datum — gab es
    an dem Tag keine, die nächste danach; liegt er nach der letzten, das Ende.
  */
  const trySeek = (el: HTMLElement): void => {
    const wanted = seek.current;
    if (wanted === null || items === null) return;
    const oldest = visible[0]?.at;
    if (oldest !== undefined && oldest > wanted.start && more && wanted.pages < SEEK_PAGES) {
      if (anchor.current === null) {
        wanted.pages++;
        earlier();
        window.clearTimeout(seekGiveUp.current);
        seekGiveUp.current = window.setTimeout(() => { if (seek.current === wanted) { seek.current = null; anchor.current = null; } }, 5000);
      }
      return;
    }
    seek.current = null;
    window.clearTimeout(seekGiveUp.current);
    restoring.current = null;
    const target = visible.find((m) => m.at >= wanted.start) ?? null;
    const row = target === null ? null : el.querySelector<HTMLElement>(`.ch-row[data-key="${CSS.escape(target.key)}"]`);
    if (row === null) {
      stick.current = true;
      el.scrollTop = el.scrollHeight;
      return;
    }
    el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top - 52;
    stick.current = atEndOf(el);
    pin.current = stick.current ? null : placeOf(el, false);
    setAway(!stick.current);
    flashRow(row);
  };
  const jumpToDay = (start: number) => {
    seek.current = { start, pages: 0 };
    const el = box.current;
    if (el !== null) trySeek(el);
  };

  /* Die Zeile, die beim Ein- oder Ausrücken stehen bleiben soll: die gedrückte — sonst die in der Mitte. */
  const keepStill = (key?: string) => {
    const el = box.current;
    if (el === null) return;
    const top = el.getBoundingClientRect().top;
    let row = key === undefined ? null : el.querySelector<HTMLElement>(`.ch-row[data-key="${CSS.escape(key)}"]`);
    if (row === null) {
      const middle = top + el.clientHeight / 2;
      row = [...el.querySelectorAll<HTMLElement>('.ch-row[data-key]')].find((r) => r.getBoundingClientRect().bottom >= middle) ?? null;
    }
    if (row !== null) still.current = { key: row.dataset.key ?? '', top: row.getBoundingClientRect().top - top };
  };
  /* Fertig markiert (Kopiuj, Przekaż, der Leser zu, ✕): die Auswahl ist weg. */
  const endPicking = () => {
    if (picked === null) return;
    keepStill();
    setPicked(null);
  };

  /* Merken, wo man steht — nicht während der Suche (dann steht nur ein Teil da) und nicht, solange noch gesucht wird, wo man war. */
  const save = useRef<() => void>(() => undefined);
  save.current = () => {
    if (place === undefined || restoring.current !== null || needle !== '' || items === null || items.length === 0) return;
    const here = stick.current ? { end: true, key: '', below: 0 } : pin.current;
    if (here !== null) keepPlace(place, here, lasting);
  };

  /* Nach dem Zeichnen, vor dem Anzeigen: oben nachgeladen → an derselben Stelle; die gemerkte Stelle; unten → mit; sonst zählen. */
  useLayoutEffect(() => {
    const el = box.current;
    if (el === null) return;
    const was = seen.current;
    if (anchor.current !== null && first !== was.first) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
    }
    /* Ein Tag wird angesprungen: das geht vor — bis er da ist. */
    if (seek.current !== null) {
      trySeek(el);
      seen.current = { first, last };
      return;
    }
    /* Neues beim Öffnen: dorthin — einmal, sobald bekannt ist, was neu war. */
    let toNew: HTMLElement | null = null;
    if (typeof firstNew === 'string' && shownNew.current !== firstNew && needle === '') {
      shownNew.current = firstNew;
      toNew = el.querySelector<HTMLElement>('.ch-unread');
    }
    const wanted = restoring.current;
    if (toNew !== null) {
      restoring.current = null;
      window.clearTimeout(giveUp.current);
      stick.current = showFrom(el, toNew);
      pin.current = stick.current ? null : placeOf(el, false);
      setAway(!stick.current);
    } else if (wanted !== null) {
      if (items !== null && firstNew === undefined) {
        el.scrollTop = el.scrollHeight;
      } else if (items !== null) {
        const miss = items.length > 0 && needle === '' ? putPlace(el, wanted.place) : null;
        /* Steht die Nachricht zu weit oben im Geladenen, hält dessen Anfang sie auf: erst Früheres laden. */
        const short = miss !== null && Math.abs(miss) > 2 && el.scrollTop <= 0 && more && wanted.pages < RESTORE_PAGES;
        if (miss !== null && !short) {
          restoring.current = null;
          stick.current = atEndOf(el);
          pin.current = stick.current ? null : wanted.place;
          setAway(!stick.current);
        } else if (items.length > 0 && needle === '' && more && wanted.pages < RESTORE_PAGES) {
          /* Bis die Seite kommt, das Ende; bleibt sie aus, dort bleiben. */
          el.scrollTop = el.scrollHeight;
          if (anchor.current === null) {
            wanted.pages++;
            earlier();
            window.clearTimeout(giveUp.current);
            giveUp.current = window.setTimeout(() => {
              if (restoring.current !== wanted) return;
              restoring.current = null;
              anchor.current = null;
              stick.current = true;
              const now = box.current;
              if (now !== null) now.scrollTop = now.scrollHeight;
            }, 4000);
          }
        } else {
          restoring.current = null;
          stick.current = true;
          el.scrollTop = el.scrollHeight;
        }
      }
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    } else if (last !== was.last && was.last !== null) {
      /* Gezählt ab der bisher letzten — oben kann zugleich eine wegfallen (das Archiv zeigt die letzten n). */
      const after = visible.findIndex((m) => m.key === was.last);
      if (freshFrom.current === null) freshFrom.current = after < 0 ? last : visible[after + 1]?.key ?? last;
      setFresh((n) => n + (after < 0 ? 1 : visible.length - 1 - after));
    }
    seen.current = { first, last };
  }, [visible, first, last, tail, items, more, needle, firstNew]);

  /* Gesendet: ans Ende. */
  useEffect(() => {
    if (follow === 0) return;
    restoring.current = null;
    seek.current = null;
    stick.current = true;
    const el = box.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [follow]);

  /* Markieren beginnt oder endet: die Zeilen rücken ein oder aus — die gemerkte Zeile bleibt, wo sie war. */
  const picking = picked !== null;
  useLayoutEffect(() => {
    const el = box.current;
    const wanted = still.current;
    still.current = null;
    if (el === null || wanted === null) return;
    const row = el.querySelector<HTMLElement>(`.ch-row[data-key="${CSS.escape(wanted.key)}"]`);
    if (row === null) return;
    el.scrollTop += row.getBoundingClientRect().top - el.getBoundingClientRect().top - wanted.top;
    stick.current = atEndOf(el);
    pin.current = stick.current ? null : placeOf(el, false);
  }, [picking]);

  /*
    Der Verlauf wird niedriger oder höher (die Tastatur, das Feld mit einer Zeile mehr), ein
    Bild lädt nach: wer am Ende war, bleibt am Ende; sonst bleibt unten, was unten war —
    oben verschwindet etwas. (Das Verankern des Browsers ist im Verlauf aus, `overflow-anchor`.)
  */
  useEffect(() => {
    const el = box.current;
    const content = inner.current;
    if (el === null || content === null || typeof ResizeObserver === 'undefined') return undefined;
    const keep = new ResizeObserver(() => {
      if (stick.current) { el.scrollTop = el.scrollHeight; return; }
      if (restoring.current === null && pin.current !== null) putPlace(el, pin.current);
    });
    keep.observe(el);
    keep.observe(content);
    return () => keep.disconnect();
  }, []);

  /* Wer geht (oder die App in den Hintergrund legt), hinterlässt seine Stelle. */
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') save.current(); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.clearTimeout(saveSoon.current);
      window.clearTimeout(giveUp.current);
      window.clearTimeout(seekGiveUp.current);
      save.current();
    };
  }, []);

  /*
    Nur wer nach oben rollt, verlässt das Ende. Kommt das Ereignis erst, nachdem der Verlauf
    gewachsen ist (ein Bild, die Schrift), sähe es sonst „nicht am Ende" — und das Ende bliebe
    zurück, gleich beim Öffnen.
  */
  const lastTop = useRef(0);
  const onScroll = () => {
    const el = box.current;
    if (el === null || restoring.current !== null) return;
    const atEnd = atEndOf(el);
    const up = el.scrollTop < lastTop.current - 1;
    lastTop.current = el.scrollTop;
    if (atEnd) stick.current = true; else if (up) stick.current = false;
    pin.current = stick.current ? null : placeOf(el, false);
    setAway(!atEnd);
    if (atEnd) { setFresh(0); freshFrom.current = null; }
    if (el.scrollTop < 160 && more && anchor.current === null) earlier();
    window.clearTimeout(saveSoon.current);
    saveSoon.current = window.setTimeout(() => save.current(), 300);
  };

  /* ↓: mit einer Zahl zur ersten dessen, was kam (passt alles in den Blick: ans Ende); ohne ans Ende. */
  const toBottom = () => {
    const el = box.current;
    if (el === null) return;
    const from = freshFrom.current === null ? null : el.querySelector<HTMLElement>(`.ch-row[data-key="${CSS.escape(freshFrom.current)}"]`);
    freshFrom.current = null;
    setFresh(0);
    if (from !== null && !showFrom(el, from, true)) return;
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const toggle = (key: string) => {
    /* Der erste markiert (die gedrückte Zeile bleibt stehen); der letzte fällt weg (die mittlere bleibt). */
    if (picked === null) keepStill(key);
    else if (picked.size === 1 && picked.has(key)) keepStill();
    setPicked((had) => {
      const next = new Set(had ?? []);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next.size === 0 ? null : next;
    });
  };
  const chosen = picked === null ? [] : visible.filter((m) => picked.has(m.key));
  const readable: Readable[] = chosen.map((m) => ({
    key: m.key, who: m.mine ? t('phoneChat.log.you') : m.author ?? title, at: m.at, body: m.body !== '' ? m.body : m.media !== undefined ? '[MMS]' : ''
  }));
  useEffect(() => { setPicked(null); }, [title]);
  const copyNow = (who: boolean) => { copyReadable(readable, who); endPicking(); };
  const copyItems: MenuItem[] = [
    { label: t('phoneChat.log.copyText'), icon: 'copy', checked: !withWho, onSelect: () => { setCopyWho('no'); copyNow(false); } },
    { label: t('phoneChat.log.copyWho'), icon: 'copy', checked: withWho, onSelect: () => { setCopyWho('yes'); copyNow(true); } }
  ];

  /* Je Tag ein Abschnitt — das Datum klebt nur, solange sein Tag zu sehen ist. */
  const blocks: { key: string; nodes: ReactNode[] }[] = [];
  let rows: ReactNode[] = [];
  visible.forEach((m, i) => {
    const prev = visible[i - 1];
    const newDay = prev === undefined || dayKey(iso(prev.at)) !== dayKey(iso(m.at));
    if (newDay) {
      rows = [];
      blocks.push({ key: `d-${m.key}`, nodes: rows });
      rows.push(<div key={`d-${m.key}`} className="ch-day" role="separator"><DayChip at={m.at} onPick={jumpToDay}>{dayLabel(iso(m.at))}</DayChip></div>);
    }
    const isNew = m.key === firstNew && needle === '';
    if (isNew) rows.push(<div key="new" className="ch-unread" role="separator"><span>{t('phoneChat.log.unread')}</span></div>);
    const start = isNew || newDay || prev === undefined || prev.mine !== m.mine || (prev.author ?? '') !== (m.author ?? '') || m.at - prev.at > GAP;
    rows.push(
      <SmsRow key={m.key} m={m} start={start} group={group} search={search}
        picked={picked === null ? null : picked.has(m.key)} onPick={() => toggle(m.key)} />
    );
  });

  return (
    <div className="ch-log-wrap">
      {picked !== null && (
        <div className="ch-pickbar" role="toolbar" aria-label={t('phoneChat.log.picked')}>
          <button type="button" className="ch-icon-btn" aria-label={t('phoneChat.log.cancelPick')} title={t('common.cancel')} onClick={endPicking}><Icon name="x" /></button>
          <strong className="ch-pickbar-count"><span className="ph-pick-word">{t('phoneChat.log.pickedCount')} </span>{chosen.length}</strong>
          <span className="ch-pickbar-actions">
            <button type="button" className="wk-btn wk-btn-small" disabled={chosen.length === 0} onClick={() => setReading(true)}><Icon name="eye" />{t('phoneChat.log.show')}</button>
            <span className="ch-copy">
              <button type="button" className="wk-link-btn" disabled={chosen.length === 0} title={withWho ? t('phoneChat.log.copyWhoTitle') : t('phoneChat.log.copyTextTitle')}
                onClick={() => copyNow(withWho)}>{t('common.copy')}</button>
              <button type="button" className="wk-link-btn ch-copy-how" aria-label={t('phoneChat.log.copyHow')} aria-haspopup="menu" aria-expanded={copyMenu.open !== null}
                disabled={chosen.length === 0} onClick={(e) => copyMenu.toggle(e.currentTarget)}><Icon name="down" /></button>
            </span>
            {pickActions?.(chosen, endPicking)}
          </span>
          {copyMenu.open !== null && (
            <PopMenu anchor={{ rect: copyMenu.open.rect }} from={copyMenu.open.from} label={t('phoneChat.log.copyHow')} items={copyItems} onClose={copyMenu.close}>
              <p className="ch-pop-head">{t('phoneChat.log.copyRemembered')}</p>
            </PopMenu>
          )}
        </div>
      )}

      <div className={cls('ch-log', picked !== null && 'is-picking')} ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions">
        <div className="ch-log-in" ref={inner}>
          {more && <button type="button" className="ch-earlier" onClick={earlier}>{t('phoneChat.log.earlier')}</button>}
          {failed !== null && <p className="ch-empty ph-error">{failed}</p>}
          {items === null && failed === null && <p className="ch-empty">{t('phoneChat.log.loading')}</p>}
          {items !== null && items.length === 0 && tail === undefined && <p className="ch-empty">{empty ?? t('phoneChat.log.empty')}</p>}
          {items !== null && items.length > 0 && visible.length === 0 && (
            <p className="ch-empty">{t('phoneChat.log.noMatch', { search })}</p>
          )}
          {blocks.map((b) => <section key={b.key} className="ch-dayblock">{b.nodes}</section>)}
          {tail}
        </div>
      </div>

      {(away || fresh > 0) && (
        <button type="button" className="ch-jump" aria-label={fresh > 0 ? t('phoneChat.log.newJump', { count: fresh }) : t('phoneChat.log.toBottom')} onClick={toBottom}>
          <Icon name="chevron" />
          {fresh > 0 && <span className="ch-jump-count">{fresh}</span>}
        </button>
      )}

      {reading && <MessageReader title={title} items={readable} withWho={withWho} onClose={() => { setReading(false); endPicking(); }} />}
    </div>
  );
}

/** Eine Zeile: die Blase, links oder rechts — langes Drücken markiert. */
function SmsRow({ m, start, group, search, picked, onPick }: {
  m: SmsItem; start: boolean; group: boolean; search: string; picked: boolean | null; onPick: () => void;
}) {
  const t = useT();
  const picking = picked !== null;
  /* Lange drücken (rechte Maustaste) markiert; solange markiert wird, markiert auch ein Tipp. */
  const press = usePress(onPick, () => { if (picking) onPick(); });
  const failed = m.state === 'failed';
  const meta = (live: boolean) => (
    <>
      {failed && <span className="ph-meta-failed">{t('phoneChat.row.notSent')}</span>}
      {m.state === 'sending' && <Icon name="clock" />}
      {m.sim !== undefined && <span className="ph-sim" title={live ? m.simTitle : undefined} aria-label={live ? m.simTitle : undefined}>{m.sim}</span>}
      <time dateTime={iso(m.at)} title={live ? full(iso(m.at)) : undefined}>{clock(iso(m.at))}</time>
      {m.mine && m.state !== 'failed' && m.state !== 'sending' && <span className="ch-ticks" title={t('phoneChat.row.sent')}>✓</span>}
    </>
  );
  const pad = <span className="ch-meta-pad" aria-hidden="true">{meta(false)}</span>;
  /* Mit „Wyślij ponownie" darunter steht die Zeit als eigene Zeile über dem Knopf — unten in der Ecke lag sie auf ihm. */
  const textOnly = m.media === undefined && m.note === undefined && (m.tools === undefined || picking);
  return (
    <div className={cls('ch-row', m.mine ? 'is-mine' : 'is-theirs', start && 'is-start', picking && 'is-picking', picked === true && 'is-picked')}
      data-key={m.key} aria-selected={picking ? picked === true : undefined} {...press}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(); } }} tabIndex={0}>
      {picking && <span className="ch-pick" aria-hidden="true">{picked && <Icon name="check" />}</span>}
      <div className={cls('ch-bubble', failed && 'ph-failed', m.media !== undefined && m.body === '' && 'is-media')}>
        {group && !m.mine && start && m.author && (
          <div className="ch-author" style={hueStyle(m.authorSeed ?? m.author)}>{m.author}</div>
        )}
        {m.subject && <div className="ph-subject">{m.subject}</div>}
        {m.note}
        {m.media !== undefined && <div className="ch-atts">{m.media}</div>}
        {m.body !== '' && <div className="ch-text"><Linked text={m.body} live={!picking} mark={search} />{textOnly && pad}</div>}
        <span className={cls('ch-meta', (!textOnly || m.body === '') && 'is-block')}>{meta(true)}</span>
        {m.tools !== undefined && !picking && <div className="ph-tools">{m.tools}</div>}
      </div>
    </div>
  );
}

/** Wie mehrere weitergeleitet werden — gemerkt, wie beim Kopieren. */
const FORWARD_PREF = 'sms.forwardHow';

/**
 * PRZEKAŻ (2026-11-09) — die markierten Nachrichten in eine neue SMS, der dritte Knopf der Leiste
 * neben Wyświetl und Kopiuj. Eine allein wie bisher (`nowa?tekst=`); mehrere als EINE lange
 * Nachricht (untereinander) oder JEDE ALS EIGENE SMS (`nowa?sms=…&sms=…`, gesendet der Reihe
 * nach). Die Wahl steht unter ▾ und bleibt gemerkt. Nur Text: eine MMS ohne Text geht nicht mit.
 */
export function ForwardButton({ chosen, done }: { chosen: readonly SmsItem[]; done: () => void }) {
  const t = useT();
  const [howText, setHowText] = useRemembered(FORWARD_PREF, 'one');
  const menu = useButtonMenu();
  const texts = chosen.map((m) => m.body).filter((b) => b.trim() !== '');
  const each = howText === 'each';
  const go = (separately: boolean) => {
    if (texts.length === 0) return;
    done();
    const query = texts.length > 1 && separately
      ? texts.map((b) => `sms=${encodeURIComponent(b)}`).join('&')
      : `tekst=${encodeURIComponent(texts.join('\n'))}`;
    window.location.hash = `${viewPath('sms', 'nowa')}?${query}`;
  };
  const items: MenuItem[] = [
    { label: t('phoneChat.fwd.one'), icon: 'forward', checked: !each, onSelect: () => { setHowText('one'); go(false); } },
    { label: t('phoneChat.fwd.each', { count: texts.length }), icon: 'forward', checked: each, onSelect: () => { setHowText('each'); go(true); } }
  ];
  const many = texts.length > 1;
  return (
    <span className="ch-copy">
      <button type="button" className="wk-link-btn" disabled={texts.length === 0}
        title={texts.length === 0 ? t('phoneChat.fwd.noText') : many ? (each ? t('phoneChat.fwd.eachTitle', { count: texts.length }) : t('phoneChat.fwd.oneTitle')) : undefined}
        onClick={() => go(each)}>{t('phoneSms.thread.forward')}</button>
      {many && (
        <button type="button" className="wk-link-btn ch-copy-how" aria-label={t('phoneChat.fwd.how')} aria-haspopup="menu" aria-expanded={menu.open !== null}
          onClick={(e) => menu.toggle(e.currentTarget)}><Icon name="down" /></button>
      )}
      {menu.open !== null && (
        <PopMenu anchor={{ rect: menu.open.rect }} from={menu.open.from} label={t('phoneChat.fwd.how')} items={items} onClose={menu.close}>
          <p className="ch-pop-head">{t('phoneChat.fwd.remembered')}</p>
        </PopMenu>
      )}
    </span>
  );
}

/** Eine, die noch nicht hinaus ist (geplant, wartend, aus dem Browser) — gestrichelt, rechts. */
export function PlannedRow({ text, meta, failed = false, tools }: { text: string; meta: string; failed?: boolean; tools?: ReactNode }) {
  return (
    <div className="ch-row is-mine is-start">
      <div className={cls('ch-bubble', 'ph-planned', failed && 'ph-failed')}>
        <div className="ch-text"><Linked text={text} /></div>
        <span className={cls('ch-meta', 'is-block', failed && 'is-failed')}>{meta}</span>
        {tools !== undefined && <div className="ph-tools">{tools}</div>}
      </div>
    </div>
  );
}

/* -- Dialoge ----------------------------------------------------------------------------------- */

/** Wie lange still: acht Stunden, eine Woche, für immer. */
export function MuteDialog({ onMute, onClose }: { onMute: (until: number) => void; onClose: () => void }) {
  const t = useT();
  const pick = (until: number) => { onClose(); onMute(until); };
  return (
    <Modal title={t('phoneChat.mute.title')} onClose={onClose}>
      <p className="ch-confirm">{t('phoneChat.mute.body')}</p>
      <div className="ch-plan-quick">
        <button type="button" className="ch-chip" onClick={() => pick(Date.now() + 8 * 3_600_000)}>{t('phoneChat.mute.hours8')}</button>
        <button type="button" className="ch-chip" onClick={() => pick(Date.now() + 7 * 86_400_000)}>{t('phoneChat.mute.week')}</button>
        <button type="button" className="ch-chip" onClick={() => pick(0)}>{t('phoneChat.mute.forever')}</button>
      </div>
      <div className="wk-actions">
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Modal>
  );
}

/**
 * ZABLOKOWAĆ — das Telefon nimmt von dort nichts mehr an (auch keine Anrufe: die Sperre
 * gilt im ganzen Telefon); das Gespräch geht vom Telefon, auf Wunsch auch aus dem Archiv.
 */
export function BlockDialog({ title, archived, onBlock, onClose }: {
  title: string;
  archived: boolean;
  onBlock: (alsoArchive: boolean) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [alsoArchive, setAlsoArchive] = useState(true);
  return (
    <Modal title={t('phoneChat.block.title', { title })} onClose={onClose}>
      <p className="ch-confirm">
        {t('phoneChat.block.body')}
      </p>
      {archived && (
        <label className="ch-plan-silent">
          <input type="checkbox" checked={alsoArchive} onChange={(e) => setAlsoArchive(e.target.checked)} />
          <span>{t('phoneChat.block.alsoArchive')}</span>
        </label>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-danger" onClick={() => { onClose(); onBlock(archived && alsoArchive); }}>
          <Icon name="ban" />{t('phoneChat.block.confirm')}
        </button>
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
    </Modal>
  );
}

/** Wann eine geplante hinausgeht — schnell gewählt oder genau (wie „Zaplanuj wysłanie" im Chat). */
export function PlanDialog({ onPlan, onClose, note }: { onPlan: (at: number) => void; onClose: () => void; note?: string }) {
  const t = useT();
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [value, setValue] = useState(() => local(new Date(Date.now() + 3_600_000)));
  const [failed, setFailed] = useState<string | null>(null);
  const now = new Date();
  const atHour = (days: number, hour: number) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d; };
  const monday = atHour(((8 - now.getDay()) % 7) || 7, 9);
  const quick = [
    { label: t('phoneChat.plan.inHour'), at: new Date(now.getTime() + 3_600_000) },
    ...(now.getHours() < 17 ? [{ label: t('phoneChat.plan.today18'), at: atHour(0, 18) }] : []),
    { label: t('phoneChat.plan.tomorrow9'), at: atHour(1, 9) },
    { label: t('phoneChat.plan.monday9'), at: monday }
  ];
  const plan = (d: Date) => {
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now() + 30_000) { setFailed(t('phoneChat.plan.future')); return; }
    if (d.getTime() > Date.now() + 365 * 86_400_000) { setFailed(t('phoneChat.plan.year')); return; }
    onClose();
    onPlan(d.getTime());
  };
  return (
    <Modal title={t('phoneSms.compose.later')} onClose={onClose}>
      <div className="ch-plan-quick">
        {quick.map((q) => <button key={q.label} type="button" className="ch-chip" onClick={() => plan(q.at)}>{q.label}</button>)}
      </div>
      <label className="wk-field">
        <span>{t('phoneChat.plan.exact')}</span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => plan(new Date(value))}><Icon name="clock" />{t('phoneChat.plan.plan')}</button>
        <button type="button" className="wk-link-btn" onClick={onClose}>{t('common.cancel')}</button>
      </div>
      {note !== undefined && <p className="ch-compose-line">{note}</p>}
    </Modal>
  );
}
