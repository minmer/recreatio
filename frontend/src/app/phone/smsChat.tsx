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

import { Avatar, clock, cls, dayKey, dayLabel, full, Icon, PopMenu, useButtonMenu, hueOf, type MenuItem } from '../chat/ChatKit';
import { Modal } from '../ui/Modal';
import type { Line } from './native';
import { lineName, lineText, whyText, type LineChoice } from './lines';
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
  const [searching, setSearching] = useState(search !== '');
  const more = useButtonMenu();
  const stop = () => { onSearch(''); setSearching(false); };

  if (searching) {
    return (
      <header className="ch-head is-search">
        <span className="ch-head-ic"><Icon name="search" /></span>
        <input className="ch-search" autoFocus value={search} placeholder="Szukaj w rozmowie…" aria-label="Szukaj w rozmowie"
          onChange={(e) => onSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); stop(); } }} />
        <button type="button" className="ch-icon-btn" aria-label="Zamknij wyszukiwanie" onClick={stop}><Icon name="x" /></button>
      </header>
    );
  }

  return (
    <header className="ch-head ph-head">
      <a className="ch-icon-btn" href={back} aria-label="Wszystkie wiadomości" title="Wszystkie wiadomości"><Icon name="back" /></a>
      <Avatar seed={seed} name={title} icon={group ? 'users' : /\p{L}/u.test(title) ? undefined : 'user'} />
      <div className="ch-head-text">
        <h1 className="ch-head-title">
          <span>{title}</span>
          {muted && <span className="ch-quiet" title="Wyciszona — bez powiadomień"><Icon name="bell-off" label="wyciszona" /></span>}
        </h1>
        {sub !== undefined && <span className="ch-head-sub ph-head-sub">{sub}</span>}
      </div>
      {call !== null && (
        <a className="ch-icon-btn" href={`tel:${call.replace(/\s+/g, '')}`} aria-label="Zadzwoń" title="Zadzwoń"><Icon name="phone" /></a>
      )}
      <button type="button" className="ch-icon-btn" aria-label="Szukaj w rozmowie" title="Szukaj" onClick={() => setSearching(true)}>
        <Icon name="search" />
      </button>
      {menu.length > 0 && (
        <button type="button" className="ch-icon-btn" aria-label="Więcej opcji rozmowy" title="Więcej" aria-haspopup="menu"
          aria-expanded={more.open !== null} onClick={(e) => more.toggle(e.currentTarget)}>
          <Icon name="more" />
        </button>
      )}
      {more.open !== null && <PopMenu anchor={{ rect: more.open.rect }} from={more.open.from} label="Opcje rozmowy" items={menu} onClose={more.close} />}
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
    ...(choice.why === 'thread' ? [{ label: 'Jak dotąd: według grupy i ostatniej wiadomości', icon: 'refresh' as const, onSelect: () => onChoose(null) }] : [])
  ];
  return (
    <>
      <button type="button" className="ch-chip ph-line-chip" aria-haspopup="menu" aria-expanded={menu.open !== null}
        title={`Wysyłasz z numeru: ${lineText(current)} — ${whyText(choice)}`}
        onClick={(e) => { e.stopPropagation(); menu.toggle(e.currentTarget); }}>
        <Icon name="phone" />{lineName(current)}<Icon name="down" />
      </button>
      {menu.open !== null && (
        <PopMenu anchor={{ rect: menu.open.rect }} from={menu.open.from} label="Z którego numeru" items={items} onClose={menu.close}>
          <p className="ch-pop-head">Wysyłaj z numeru · {whyText(choice)}</p>
        </PopMenu>
      )}
    </>
  );
}

/** Geht dieses Gespräch ins Archiv? */
export function ArchiveMark({ on }: { on: boolean }) {
  return (
    <span className={cls('ph-arch', on && 'is-on')} title={on ? 'Ta rozmowa trafia do archiwum' : 'Ta rozmowa nie jest archiwizowana'}>
      <Icon name="archive" />{on ? 'w archiwum' : 'poza archiwum'}
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
}

const GAP = 10 * 60_000;

const fold = (text: string) => text.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/\p{M}/gu, '');

/**
 * DER VERLAUF: Tage als Abschnitte (das Datum klebt oben, solange sein Tag zu sehen ist),
 * Folgen eines Absenders, die Zeit in der Blase. Unten bleibt, wer unten war; was oben
 * nachgeladen wird, schiebt nichts weg; wer weiter oben liest, bekommt den Knopf nach
 * unten mit der Zahl dessen, was inzwischen kam.
 */
export function SmsLog({ items, failed = null, more = false, onEarlier, group = false, search = '', tail, empty, pickActions, follow = 0, title }: {
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
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const seen = useRef<{ first: string | null; last: string | null; count: number }>({ first: null, last: null, count: 0 });
  const [away, setAway] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [reading, setReading] = useState(false);

  const needle = fold(search.trim());
  const visible = useMemo(() => (items === null ? [] : needle === '' ? items : items.filter((m) => fold(m.body).includes(needle))), [items, needle]);
  const first = visible[0]?.key ?? null;
  const last = visible[visible.length - 1]?.key ?? null;

  /* Nach dem Zeichnen, vor dem Anzeigen: oben nachgeladen → an derselben Stelle; unten → mit; sonst zählen. */
  useLayoutEffect(() => {
    const el = box.current;
    if (el === null) return;
    const was = seen.current;
    if (anchor.current !== null && first !== was.first) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    } else if (last !== was.last && was.last !== null) {
      setFresh((n) => n + Math.max(1, visible.length - was.count));
    }
    seen.current = { first, last, count: visible.length };
  }, [visible, first, last, tail]);

  /* Gesendet: ans Ende. */
  useEffect(() => {
    if (follow === 0) return;
    stick.current = true;
    const el = box.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [follow]);

  /* Die Tastatur geht auf, ein Bild ist geladen: wer unten war, bleibt unten. */
  useEffect(() => {
    const el = box.current;
    const content = inner.current;
    if (el === null || content === null || typeof ResizeObserver === 'undefined') return undefined;
    const keep = new ResizeObserver(() => { if (stick.current) el.scrollTop = el.scrollHeight; });
    keep.observe(el);
    keep.observe(content);
    return () => keep.disconnect();
  }, []);

  const earlier = () => {
    const el = box.current;
    if (el !== null) anchor.current = el.scrollHeight;
    onEarlier?.();
  };

  const onScroll = () => {
    const el = box.current;
    if (el === null) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
    stick.current = atEnd;
    setAway(!atEnd);
    if (atEnd) setFresh(0);
    if (el.scrollTop < 160 && more && anchor.current === null) earlier();
  };

  const toBottom = () => {
    const el = box.current;
    if (el === null) return;
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setFresh(0);
  };

  const toggle = (key: string) => setPicked((had) => {
    const next = new Set(had ?? []);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next.size === 0 ? null : next;
  });
  const chosen = picked === null ? [] : visible.filter((m) => picked.has(m.key));
  const readable: Readable[] = chosen.map((m) => ({
    key: m.key, who: m.mine ? 'Ty' : m.author ?? title, at: m.at, body: m.body !== '' ? m.body : m.media !== undefined ? '[MMS]' : ''
  }));
  useEffect(() => { setPicked(null); }, [title]);

  /* Je Tag ein Abschnitt — das Datum klebt nur, solange sein Tag zu sehen ist. */
  const blocks: { key: string; nodes: ReactNode[] }[] = [];
  let rows: ReactNode[] = [];
  visible.forEach((m, i) => {
    const prev = visible[i - 1];
    const newDay = prev === undefined || dayKey(iso(prev.at)) !== dayKey(iso(m.at));
    if (newDay) {
      rows = [];
      blocks.push({ key: `d-${m.key}`, nodes: rows });
      rows.push(<div key={`d-${m.key}`} className="ch-day" role="separator"><span>{dayLabel(iso(m.at))}</span></div>);
    }
    const start = newDay || prev === undefined || prev.mine !== m.mine || (prev.author ?? '') !== (m.author ?? '') || m.at - prev.at > GAP;
    rows.push(
      <SmsRow key={m.key} m={m} start={start} group={group} search={search}
        picked={picked === null ? null : picked.has(m.key)} onPick={() => toggle(m.key)} />
    );
  });

  return (
    <div className="ch-log-wrap">
      {picked !== null && (
        <div className="ch-pickbar" role="toolbar" aria-label="Zaznaczone wiadomości">
          <button type="button" className="ch-icon-btn" aria-label="Anuluj zaznaczenie" title="Anuluj" onClick={() => setPicked(null)}><Icon name="x" /></button>
          <strong className="ch-pickbar-count"><span className="ph-pick-word">Zaznaczone: </span>{chosen.length}</strong>
          <span className="ch-pickbar-actions">
            <button type="button" className="wk-btn wk-btn-small" disabled={chosen.length === 0} onClick={() => setReading(true)}><Icon name="eye" />Wyświetl</button>
            <button type="button" className="wk-link-btn" disabled={chosen.length === 0} onClick={() => copyReadable(readable)}>Kopiuj</button>
            {pickActions?.(chosen, () => setPicked(null))}
          </span>
        </div>
      )}

      <div className={cls('ch-log', picked !== null && 'is-picking')} ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions">
        <div className="ch-log-in" ref={inner}>
          {more && <button type="button" className="ch-earlier" onClick={earlier}>Wczytaj wcześniejsze</button>}
          {failed !== null && <p className="ch-empty ph-error">{failed}</p>}
          {items === null && failed === null && <p className="ch-empty">Wczytywanie rozmowy…</p>}
          {items !== null && items.length === 0 && tail === undefined && <p className="ch-empty">{empty ?? 'Nie ma tu jeszcze wiadomości.'}</p>}
          {items !== null && items.length > 0 && visible.length === 0 && (
            <p className="ch-empty">{`Nic nie pasuje do „${search}” we wczytanych wiadomościach.`}</p>
          )}
          {blocks.map((b) => <section key={b.key} className="ch-dayblock">{b.nodes}</section>)}
          {tail}
        </div>
      </div>

      {(away || fresh > 0) && (
        <button type="button" className="ch-jump" aria-label={fresh > 0 ? `Nowe wiadomości: ${fresh} — przewiń na dół` : 'Przewiń na dół'} onClick={toBottom}>
          <Icon name="chevron" />
          {fresh > 0 && <span className="ch-jump-count">{fresh}</span>}
        </button>
      )}

      {reading && <MessageReader title={title} items={readable} onClose={() => setReading(false)} />}
    </div>
  );
}

/** Eine Zeile: die Blase, links oder rechts — langes Drücken markiert. */
function SmsRow({ m, start, group, search, picked, onPick }: {
  m: SmsItem; start: boolean; group: boolean; search: string; picked: boolean | null; onPick: () => void;
}) {
  const picking = picked !== null;
  /* Lange drücken (rechte Maustaste) markiert; solange markiert wird, markiert auch ein Tipp. */
  const press = usePress(onPick, () => { if (picking) onPick(); });
  const failed = m.state === 'failed';
  const meta = (live: boolean) => (
    <>
      {failed && <span className="ph-meta-failed">nie wysłano</span>}
      {m.state === 'sending' && <Icon name="clock" />}
      <time dateTime={iso(m.at)} title={live ? full(iso(m.at)) : undefined}>{clock(iso(m.at))}</time>
      {m.mine && m.state !== 'failed' && m.state !== 'sending' && <span className="ch-ticks" title="Wysłana">✓</span>}
    </>
  );
  const pad = <span className="ch-meta-pad" aria-hidden="true">{meta(false)}</span>;
  const textOnly = m.media === undefined && m.note === undefined;
  return (
    <div className={cls('ch-row', m.mine ? 'is-mine' : 'is-theirs', start && 'is-start', picking && 'is-picking', picked === true && 'is-picked')}
      aria-selected={picking ? picked === true : undefined} {...press}
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
  const pick = (until: number) => { onClose(); onMute(until); };
  return (
    <Modal title="Wyciszyć rozmowę?" onClose={onClose}>
      <p className="ch-confirm">Wiadomości dalej przychodzą i są w rozmowie — telefon tylko o nich nie powiadamia.</p>
      <div className="ch-plan-quick">
        <button type="button" className="ch-chip" onClick={() => pick(Date.now() + 8 * 3_600_000)}>Na 8 godzin</button>
        <button type="button" className="ch-chip" onClick={() => pick(Date.now() + 7 * 86_400_000)}>Na tydzień</button>
        <button type="button" className="ch-chip" onClick={() => pick(0)}>Na zawsze</button>
      </div>
      <div className="wk-actions">
        <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
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
  const [alsoArchive, setAlsoArchive] = useState(true);
  return (
    <Modal title={`Zablokować: ${title}?`} onClose={onClose}>
      <p className="ch-confirm">
        Telefon nie przyjmie już od tego nadawcy SMS ani MMS. Blokada działa w całym telefonie — także dla połączeń.
        Rozmowa zniknie z telefonu. Odblokować można w SMS → ⋮ → Zablokowane numery.
      </p>
      {archived && (
        <label className="ch-plan-silent">
          <input type="checkbox" checked={alsoArchive} onChange={(e) => setAlsoArchive(e.target.checked)} />
          <span>Usuń ją też z archiwum</span>
        </label>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-danger" onClick={() => { onClose(); onBlock(archived && alsoArchive); }}>
          <Icon name="ban" />Zablokuj i usuń
        </button>
        <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
      </div>
    </Modal>
  );
}

/** Wann eine geplante hinausgeht — schnell gewählt oder genau (wie „Zaplanuj wysłanie" im Chat). */
export function PlanDialog({ onPlan, onClose, note }: { onPlan: (at: number) => void; onClose: () => void; note?: string }) {
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [value, setValue] = useState(() => local(new Date(Date.now() + 3_600_000)));
  const [failed, setFailed] = useState<string | null>(null);
  const now = new Date();
  const atHour = (days: number, hour: number) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d; };
  const monday = atHour(((8 - now.getDay()) % 7) || 7, 9);
  const quick = [
    { label: 'Za godzinę', at: new Date(now.getTime() + 3_600_000) },
    ...(now.getHours() < 17 ? [{ label: 'Dziś o 18:00', at: atHour(0, 18) }] : []),
    { label: 'Jutro o 9:00', at: atHour(1, 9) },
    { label: 'W poniedziałek o 9:00', at: monday }
  ];
  const plan = (d: Date) => {
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now() + 30_000) { setFailed('Wybierz przyszły termin.'); return; }
    if (d.getTime() > Date.now() + 365 * 86_400_000) { setFailed('Najdalej za rok.'); return; }
    onClose();
    onPlan(d.getTime());
  };
  return (
    <Modal title="Wyślij później" onClose={onClose}>
      <div className="ch-plan-quick">
        {quick.map((q) => <button key={q.label} type="button" className="ch-chip" onClick={() => plan(q.at)}>{q.label}</button>)}
      </div>
      <label className="wk-field">
        <span>Dokładny termin</span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => plan(new Date(value))}><Icon name="clock" />Zaplanuj</button>
        <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
      </div>
      {note !== undefined && <p className="ch-compose-line">{note}</p>}
    </Modal>
  );
}
