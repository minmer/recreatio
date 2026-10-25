/**
 * Der Verlauf: Blasen links und rechts, Tage dazwischen, an jeder Nachricht ihr Menü.
 */

import { type CSSProperties, type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { call } from '../core/session';
import { Modal } from '../ui/Modal';
import { Attachments, kindOf } from './Attachments';
import type { Opened, SealedMessage } from './chat';
import type { Features, Mark } from './chatFeatures';
import { type Anchor, Avatar, Icon, type MenuItem, PopMenu, type Shown, authorOf, clock, cls, dayKey, dayLabel, failure, full, hueOf, whenLong } from './ChatKit';
import { later } from '../ui/later';

/* 0130 — das Fenster „Zgłoś" erst, wenn jemand meldet. */
const ReportDialog = later(() => import('../reports/ReportDialog').then((m) => m.ReportDialog), null);

/** Was der Meldende an einer Nachricht sieht — der Betreiber hat dazu keinen Schlüssel. */
const quoteOf = (item: Shown, author: string): string => {
  const files = item.opened?.attachments ?? [];
  return [
    `${author}, ${full(item.message.createdAt)}:`,
    item.opened?.text ?? '',
    files.length === 0 ? '' : `Załączniki: ${files.map((a) => a.name).join(', ')}`
  ].filter((line) => line.trim() !== '').join('\n');
};

/* -- Text ---------------------------------------------------------------------------- */

const URL_RE = /\bhttps?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]]/g;

/** Verweise werden klickbar, die Suche wird markiert — alles andere bleibt Text (React maskiert). */
function Linked({ text, mark }: { text: string; mark: string }) {
  const out: ReactNode[] = [];
  const marked = (part: string, key: string) => {
    const needle = mark.trim().toLocaleLowerCase('pl-PL');
    if (needle === '') { out.push(part); return; }
    const hay = part.toLocaleLowerCase('pl-PL');
    let at = 0;
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, at)) {
      if (i > at) out.push(part.slice(at, i));
      out.push(<mark key={`${key}-${i}`} className="ch-hit">{part.slice(i, i + needle.length)}</mark>);
      at = i + needle.length;
    }
    if (at < part.length) out.push(part.slice(at));
  };
  let at = 0;
  for (const found of text.matchAll(URL_RE)) {
    const i = found.index ?? 0;
    if (i > at) marked(text.slice(at, i), `t${at}`);
    out.push(<a key={`u${i}`} href={found[0]} target="_blank" rel="noopener noreferrer">{found[0]}</a>);
    at = i + found[0].length;
  }
  if (at < text.length) marked(text.slice(at), `t${at}`);
  return <>{out}</>;
}

/** Nur ein bis drei Emoji — dann gross und ohne Blase, wie überall. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣)+$/u;

function bigEmoji(text: string): boolean {
  const bare = text.replace(/\s/g, '');
  if (bare === '' || bare.length > 24 || !EMOJI_ONLY.test(bare)) return false;
  const Segmenter = (Intl as { Segmenter?: new (l: string, o: { granularity: 'grapheme' }) => { segment: (s: string) => Iterable<unknown> } }).Segmenter;
  const count = Segmenter === undefined ? Array.from(bare).length / 2 : Array.from(new Segmenter('pl', { granularity: 'grapheme' }).segment(bare)).length;
  return count <= 3;
}

/* -- Der Verlauf ------------------------------------------------------------------------------- */

/** Was ein Leser an einer Nachricht darf — sagt die Rozmowa, nicht der Verlauf. */
export interface MessageRules {
  readonly mine: (message: SealedMessage) => boolean;
  readonly author: (message: SealedMessage, opened: Opened | null) => string;
  /** Ein Zusatz am Namen — „z linku". */
  readonly note?: (message: SealedMessage) => string | null;
  readonly canEdit: (message: SealedMessage, opened: Opened | null) => boolean;
  readonly canDelete: (message: SealedMessage) => boolean;
  readonly canRestore: (message: SealedMessage) => boolean;
  readonly canPin: boolean;
  /** Mehr als zwei — dann stehen Namen und Bilder an den Blasen der anderen. */
  readonly group: boolean;
  /** Häkchen an den eigenen: gesendet ✓, gelesen ✓✓. */
  readonly receipts: boolean;
  /**
   * 0095 — NUR LESEN (ein Link ohne Person): an einer Nachricht nur „Kopiuj
   * tekst" — kein Antworten, keine Reaktion, kein Merken; dazu braucht es eine Person.
   */
  readonly readOnly?: boolean;
}

export interface MessageHandlers {
  readonly reply: (message: SealedMessage, opened: Opened, author: string) => void;
  readonly edit: (message: SealedMessage, opened: Opened) => void;
  readonly remove: (message: SealedMessage) => Promise<void>;
  readonly restore: (message: SealedMessage) => Promise<void>;
  readonly history: (message: SealedMessage) => void;
  readonly forward?: (opened: Opened) => void;

  /* 0066/0068/0070 — aus einer Nachricht wird etwas: eine Aufgabe, ein Termin; oder sie wandert in ein Thema. */
  readonly task?: (message: SealedMessage, opened: Opened) => void;
  readonly appointment?: (message: SealedMessage, opened: Opened) => void;
  readonly moveTopic?: (message: SealedMessage) => void;

  /** 0101 — die markierten zusammen in ein Thema; `done` hebt die Markierung auf, wenn es geklappt hat. */
  readonly collect?: (messages: readonly SealedMessage[], done: () => void) => void;
}

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const GROUP_GAP = 5 * 60_000;

const at = (message: SealedMessage) => new Date(message.createdAt).getTime();

interface OpenMenu {
  readonly anchor: Anchor;
  readonly from: Element | null;
  readonly item: Shown;
  readonly author: string;
}

export function ChatLog({ endpoint, items, features, matches, rules, on, more, onEarlier, empty, onFiles, unreadAfter = null, search = '', filter = 'all' }: {
  endpoint: string;
  /** `undefined` — wird noch geholt. */
  items: readonly Shown[] | undefined;
  features: Features | null;
  matches: (id: string, opened: Opened | null) => boolean;
  rules: MessageRules;
  on: MessageHandlers;
  more: boolean;
  onEarlier: () => Promise<void>;
  empty: string;
  onFiles?: (files: File[]) => void;
  /** Bis wann gelesen war, als die Rozmowa aufging — davor steht „Nieprzeczytane". */
  unreadAfter?: string | null;
  search?: string;
  filter?: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const loadingEarlier = useRef(false);
  const seen = useRef<{ first?: string; last?: string; height: number; count: number; placed: boolean; view: string }>({ height: 0, count: 0, placed: false, view: '' });
  const [away, setAway] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const [confirm, setConfirm] = useState<SealedMessage | null>(null);
  /* 0130 — welche Nachricht gerade gemeldet wird, mit dem Namen, wie ihn der Meldende sieht. */
  const [report, setReport] = useState<{ item: Shown; author: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pinAt, setPinAt] = useState(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const marks = useMemo(() => {
    const out = new Map<string, Mark[]>();
    for (const m of features?.marks ?? []) {
      const list = out.get(m.messageId);
      if (list === undefined) out.set(m.messageId, [m]); else list.push(m);
    }
    return out;
  }, [features]);

  /* Reagieren, merken, anheften: noch einmal dasselbe nimmt es zurück. */
  const mark = useCallback((id: string, kind: string, value: string) => {
    const had = (marks.get(id) ?? []).some((m) => (m.mine || kind === 'pin') && m.kind === kind && m.value === value);
    void call(`${endpoint}/marks`, { method: 'POST', body: JSON.stringify({ messageId: id, kind, value: had ? null : value }) })
      .then(() => {
        window.dispatchEvent(new Event('chat-feature-changed'));
        if (kind === 'star') say(had ? 'Usunięto z zapisanych.' : 'Zapisano — znajdziesz ją w menu ⋮ „Zapisane wiadomości".');
        if (kind === 'pin') say(had ? 'Odpięto.' : 'Przypięto dla wszystkich.');
      })
      .catch((e: unknown) => say(failure(e, 'Nie udało się.')));
  }, [endpoint, marks, say]);

  const all = items ?? [];
  const visible = all.filter(({ message, opened }) => matches(message.messageId, opened));
  const order = visible.map((v) => v.message.messageId);
  const view = `${search}|${filter}`;

  /* Wer wem antwortet: der Name steht im Zitat, wenn die Nachricht geladen ist. */
  const byId = useMemo(() => new Map((items ?? []).map((one) => [one.message.messageId, one])), [items]);

  const pinned = all.filter(({ message }) => message.deletedAt === null && (marks.get(message.messageId) ?? []).some((m) => m.kind === 'pin')).reverse();
  const pin = pinned.length === 0 ? null : pinned[pinAt % pinned.length];

  /*
   * WO DER VERLAUF STEHT. Beim ersten Bild bei der ersten ungelesenen, sonst
   * unten. Frühere oben angefügt: dieselbe Stelle bleibt im Blick. Neue
   * unten: mit, wenn man unten war (oder selbst schrieb) — sonst zählt der
   * Knopf „↓" mit.
   *
   * Ohne Liste der Abhängigkeiten, also nach JEDEM Zeichnen: das Anfügen oben
   * braucht die Höhe von unmittelbar davor. Gesetzt wird nur, wenn sich die
   * erste oder letzte Nachricht änderte — beim nächsten Mal ist das vorbei.
   */
  useLayoutEffect(() => {
    const el = box.current;
    if (el === null) return;
    const was = seen.current;
    const first = visible[0]?.message.messageId;
    const last = visible[visible.length - 1]?.message.messageId;

    if (was.view !== view) {
      el.scrollTop = el.scrollHeight;
      stick.current = true;
    } else if (!was.placed && visible.length > 0) {
      const divider = el.querySelector<HTMLElement>('.ch-unread');
      if (divider !== null && divider.offsetTop > el.clientHeight / 2) {
        el.scrollTop = Math.max(0, divider.offsetTop - 16);
        stick.current = false;
      } else {
        el.scrollTop = el.scrollHeight;
      }
      was.placed = true;
    } else if (was.first !== undefined && first !== was.first && last === was.last) {
      el.scrollTop += el.scrollHeight - was.height;
    } else if (last !== undefined && last !== was.last) {
      const newest = visible[visible.length - 1];
      if (stick.current || rules.mine(newest.message)) {
        el.scrollTop = el.scrollHeight;
        stick.current = true;
        setFresh(0);
      } else {
        setFresh((n) => n + Math.max(1, visible.length - was.count));
      }
    }
    seen.current = { first, last, height: el.scrollHeight, count: visible.length, placed: was.placed, view };
  });

  /* Bilder laden nach: wer unten war, bleibt unten. */
  useEffect(() => {
    const el = box.current;
    const content = inner.current;
    if (el === null || content === null || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
      seen.current.height = el.scrollHeight;
    });
    watch.observe(content);
    return () => watch.disconnect();
  }, []);

  const earlier = useCallback(() => {
    if (loadingEarlier.current) return;
    loadingEarlier.current = true;
    void onEarlier().catch(() => undefined).finally(() => { loadingEarlier.current = false; });
  }, [onEarlier]);

  const onScroll = () => {
    const el = box.current;
    if (el === null) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stick.current = gap < 80;
    setAway(gap > 240);
    if (stick.current) setFresh(0);
    if (el.scrollTop < 60 && more && seen.current.placed) earlier();
  };

  const toBottom = () => {
    const el = box.current;
    if (el === null) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    stick.current = true;
    setFresh(0);
  };

  const jumpTo = (id: string) => {
    const el = box.current;
    const row = el?.querySelector<HTMLElement>(`#message-${CSS.escape(id)}`);
    if (el == null || row == null) { say('Ta wiadomość jest wcześniej — wczytaj wcześniejsze.'); return; }
    el.scrollTo({ top: row.offsetTop - el.clientHeight / 2 + row.offsetHeight / 2, behavior: 'smooth' });
    row.classList.remove('is-flash');
    void row.offsetWidth;
    row.classList.add('is-flash');
    window.setTimeout(() => row.classList.remove('is-flash'), 1700);
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); say('Skopiowano.'); } catch { say('Nie udało się skopiować.'); }
  };

  /*
   * 0101 — MARKIEREN. Wer mit der Maus über mehrere Nachrichten zieht, markiert
   * NACHRICHTEN (nicht Text quer durch den Verlauf); „Zaznacz" im Menü (auch
   * nach langem Drücken) beginnt dasselbe. Danach schaltet ein Klick eine
   * Nachricht an oder ab; oben stehen die Zahl und was sich damit tun lässt —
   * „Do tematu" trägt sie in ein Thema zusammen. Esc oder ✕ hört auf.
   */
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const drag = useRef<{ from: string; base: ReadonlySet<string>; moved: boolean } | null>(null);
  const swallow = useRef(false);
  const picking = picked !== null;
  useEffect(() => {
    if (!picking) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicked(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);
  const togglePick = (id: string) => setPicked((was) => {
    const next = new Set(was ?? []);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next.size === 0 ? null : next;
  });
  const rowOf = (target: EventTarget | null): string | null => {
    const row = target instanceof Element ? target.closest('.ch-row') : null;
    return row !== null && row.id.startsWith('message-') ? row.id.slice('message-'.length) : null;
  };
  const chosen = picked === null ? [] : visible.filter((v) => picked.has(v.message.messageId));

  /* -- Die Zeilen: Tage, „Nieprzeczytane", Gruppen einer Person ----------------- */

  /*
   * 0101 — JE TAG EIN ABSCHNITT. Das Datum klebt oben, solange sein Tag zu
   * sehen ist — und nur so lange: lagen alle Daten in EINEM Behälter, klebten
   * sie übereinander („5 Wczoraj a": das breitere schaute unter dem schmaleren hervor).
   */
  const blocks: { key: string; nodes: ReactNode[] }[] = [];
  let rows: ReactNode[] = [];
  let unreadPlaced = false;
  const unreadAt = unreadAfter === null ? null : new Date(unreadAfter).getTime();
  visible.forEach((item, i) => {
    const { message } = item;
    const prev = visible[i - 1]?.message;
    const next = visible[i + 1]?.message;
    const mine = rules.mine(message);
    const newDay = prev === undefined || dayKey(prev.createdAt) !== dayKey(message.createdAt);
    if (newDay) {
      rows = [];
      blocks.push({ key: `d-${message.messageId}`, nodes: rows });
      rows.push(<div key={`d-${message.messageId}`} className="ch-day" role="separator"><span>{dayLabel(message.createdAt)}</span></div>);
    }
    let divider = false;
    if (!unreadPlaced && unreadAt !== null && !mine && at(message) > unreadAt && search === '' && filter === 'all') {
      unreadPlaced = true;
      divider = true;
      rows.push(<div key="unread" className="ch-unread" role="separator"><span>Nieprzeczytane</span></div>);
    }
    const start = newDay || divider || prev === undefined || authorOf(prev) !== authorOf(message) || at(message) - at(prev) > GROUP_GAP;
    const end = next === undefined || authorOf(next) !== authorOf(message) || at(next) - at(message) > GROUP_GAP
      || dayKey(next.createdAt) !== dayKey(message.createdAt);
    const author = rules.author(message, item.opened);
    const quoted = item.opened?.replyTo === undefined ? undefined : byId.get(item.opened.replyTo);

    rows.push(
      <MessageRow
        key={message.messageId}
        endpoint={endpoint}
        item={item}
        mine={mine}
        start={start}
        end={end}
        author={author}
        note={rules.note?.(message) ?? null}
        group={rules.group}
        receipts={rules.receipts}
        marks={marks.get(message.messageId) ?? []}
        features={features}
        replyAuthor={quoted === undefined ? null : rules.author(quoted.message, quoted.opened)}
        search={search}
        picked={picked === null ? null : picked.has(message.messageId)}
        onMenu={(anchor, from) => { if (picked === null) setMenu({ anchor, from, item, author }); }}
        onJump={jumpTo}
        onReact={(emoji) => mark(message.messageId, 'reaction', emoji)}
        onHistory={() => on.history(message)}
        onSwipe={() => { if (rules.readOnly !== true && item.opened !== null && message.deletedAt === null) on.reply(message, item.opened, author); }}
      />
    );
  });

  return (
    <div
      className={cls('ch-log-wrap', dragging && 'is-dragging')}
      onDragOver={(e) => {
        if (onFiles === undefined || !Array.from(e.dataTransfer.types).includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => {
        if (onFiles === undefined) return;
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onFiles(files);
      }}
    >
      {/* 0101 — was markiert ist, und was sich damit tun lässt. */}
      {picked !== null && (
        <div className="ch-pickbar" role="toolbar" aria-label="Zaznaczone wiadomości" data-pickbar="">
          <button type="button" className="ch-icon-btn" aria-label="Anuluj zaznaczenie" title="Anuluj (Esc)" onClick={() => setPicked(null)}>
            <Icon name="x" />
          </button>
          <strong className="ch-pickbar-count">Zaznaczone: {chosen.length}</strong>
          <span className="ch-pickbar-actions">
            {on.collect !== undefined && rules.readOnly !== true && (
              <button type="button" className="wk-btn wk-btn-small" disabled={chosen.length === 0} data-pick-collect=""
                onClick={() => on.collect!(chosen.map((v) => v.message), () => setPicked(null))}>
                <Icon name="hash" /> Do tematu
              </button>
            )}
            <button type="button" className="wk-link-btn" disabled={chosen.length === 0} onClick={() => {
              void copy(chosen.filter((v) => v.opened !== null && v.message.deletedAt === null)
                .map((v) => `${rules.author(v.message, v.opened)}, ${clock(v.message.createdAt)}: ${v.opened!.text || 'Załącznik'}`).join('\n'));
            }}>Kopiuj</button>
          </span>
        </div>
      )}

      {pin !== null && (
        <button type="button" className="ch-pinbar" onClick={() => { jumpTo(pin.message.messageId); setPinAt((n) => n + 1); }}>
          <Icon name="pin" />
          <span className="ch-pinbar-text">
            <strong>{pinned.length > 1 ? `Przypięta wiadomość ${(pinAt % pinned.length) + 1} z ${pinned.length}` : 'Przypięta wiadomość'}</strong>
            <span>{pin.opened?.text || (pin.opened?.attachments?.length ? 'Załącznik' : 'Wiadomość')}</span>
          </span>
        </button>
      )}

      <div className={cls('ch-log', picking && 'is-picking')} ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions"
        onMouseDown={(e) => {
          swallow.current = false;
          if (e.button !== 0) { drag.current = null; return; }
          const id = rowOf(e.target);
          const control = e.target instanceof Element && e.target.closest('a, button, input, textarea, select, audio, video') !== null;
          drag.current = id === null || control ? null : { from: id, base: picked ?? new Set(), moved: false };
        }}
        onMouseMove={(e) => {
          const d = drag.current;
          if (d === null || (e.buttons & 1) === 0) return;
          const id = rowOf(e.target);
          if (id === null || (id === d.from && !d.moved)) return;
          const a = order.indexOf(d.from);
          const b = order.indexOf(id);
          if (a < 0 || b < 0) return;
          /* Über die eigene Blase hinaus: aus der Textauswahl wird eine Auswahl von Nachrichten. */
          d.moved = true;
          window.getSelection()?.removeAllRanges();
          e.preventDefault();
          setPicked(new Set([...d.base, ...order.slice(Math.min(a, b), Math.max(a, b) + 1)]));
        }}
        onMouseUp={() => { if (drag.current?.moved === true) swallow.current = true; drag.current = null; }}
        onClickCapture={(e) => {
          if (swallow.current) { swallow.current = false; e.preventDefault(); e.stopPropagation(); return; }
          if (picked === null) return;
          const id = rowOf(e.target);
          if (id === null) return;
          e.preventDefault();
          e.stopPropagation();
          togglePick(id);
        }}
        onContextMenuCapture={(e) => { if (picked !== null && rowOf(e.target) !== null) { e.preventDefault(); e.stopPropagation(); } }}
      >
        <div className="ch-log-in" ref={inner}>
          {more && all.length > 0 && (
            <button type="button" className="ch-earlier" onClick={earlier}>Wczytaj wcześniejsze</button>
          )}
          {items === undefined && <p className="ch-empty">Wczytywanie…</p>}
          {items !== undefined && all.length === 0 && <p className="ch-empty">{empty}</p>}
          {items !== undefined && all.length > 0 && visible.length === 0 && (
            <p className="ch-empty">{search !== '' ? `Nic nie pasuje do „${search}" we wczytanych wiadomościach.` : 'Nie ma tu takich wiadomości.'}</p>
          )}
          {blocks.map((b) => <section key={b.key} className="ch-dayblock">{b.nodes}</section>)}
        </div>
      </div>

      {(away || fresh > 0) && (
        <button type="button" className="ch-jump" aria-label={fresh > 0 ? `Nowe wiadomości: ${fresh} — przewiń na dół` : 'Przewiń na dół'} onClick={toBottom}>
          <Icon name="chevron" />
          {fresh > 0 && <span className="ch-jump-count">{fresh}</span>}
        </button>
      )}

      {dragging && <div className="ch-drop" aria-hidden="true"><Icon name="clip" /> Upuść, aby dołączyć</div>}
      {toast !== null && <p className="ch-toast" role="status">{toast}</p>}

      {menu !== null && (
        <MessageMenu
          menu={menu}
          marks={marks.get(menu.item.message.messageId) ?? []}
          rules={rules}
          on={on}
          onClose={() => setMenu(null)}
          onMark={mark}
          onCopy={(text) => void copy(text)}
          onDelete={setConfirm}
          onPick={(id) => setPicked(new Set([id]))}
          onRestore={(message) => { void on.restore(message).then(() => say('Przywrócono.')).catch((e: unknown) => say(failure(e, 'Nie udało się przywrócić.'))); }}
          onReport={(item, author) => setReport({ item, author })}
        />
      )}

      {report !== null && (
        <ReportDialog
          what={{ itemKind: 'message', itemId: report.item.message.messageId, quote: quoteOf(report.item, report.author) }}
          onClose={() => setReport(null)}
        />
      )}

      {confirm !== null && (
        <Modal title="Usunąć wiadomość?" onClose={() => setConfirm(null)}>
          <p className="ch-confirm">
            {rules.mine(confirm)
              ? 'Inni zobaczą, że była, ale nie jej treść. Możesz ją później przywrócić.'
              : 'Usuwasz ją jako prowadzący. Uczestnicy zobaczą, że wiadomość usunięto; przywrócić ją może prowadzący.'}
          </p>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-danger" onClick={() => {
              const target = confirm;
              setConfirm(null);
              void on.remove(target).then(() => say('Usunięto.')).catch((e: unknown) => say(failure(e, 'Nie udało się usunąć.')));
            }}>Usuń</button>
            <button type="button" className="wk-link-btn" onClick={() => setConfirm(null)}>Anuluj</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MessageMenu({ menu, marks, rules, on, onClose, onMark, onCopy, onDelete, onRestore, onPick, onReport }: {
  menu: OpenMenu;
  marks: readonly Mark[];
  rules: MessageRules;
  on: MessageHandlers;
  onClose: () => void;
  onMark: (id: string, kind: string, value: string) => void;
  onCopy: (text: string) => void;
  onDelete: (message: SealedMessage) => void;
  onRestore: (message: SealedMessage) => void;
  /** 0101 — Markieren beginnen, mit dieser Nachricht. */
  onPick: (id: string) => void;
  /** 0130 — eine Nachricht eines anderen dem Betreiber melden. */
  onReport: (item: Shown, author: string) => void;
}) {
  const { message, opened } = menu.item;
  const id = message.messageId;
  const gone = message.deletedAt !== null;
  const items: MenuItem[] = [];

  /* 0130 — melden kann, wer sie lesen kann: auch nur lesend, nie die eigene, nie eine schon gesperrte. */
  const reportable = !gone && opened !== null && message.blocked !== true && !rules.mine(message);

  if (!gone && opened !== null && rules.readOnly === true) {
    if (opened.text !== '') items.push({ label: 'Kopiuj tekst', icon: 'copy', onSelect: () => onCopy(opened.text) });
    if (reportable) items.push({ label: 'Zgłoś', icon: 'alert', onSelect: () => onReport(menu.item, menu.author) });
  } else if (!gone && opened !== null) {
    items.push({ label: 'Odpowiedz', icon: 'reply', onSelect: () => on.reply(message, opened, menu.author) });
    items.push({ label: 'Zaznacz', icon: 'check', onSelect: () => onPick(id) });
    if (opened.text !== '') items.push({ label: 'Kopiuj tekst', icon: 'copy', onSelect: () => onCopy(opened.text) });
    if (on.forward !== undefined) {
      const forward = on.forward;
      items.push({ label: 'Przekaż dalej', icon: 'forward', onSelect: () => forward(opened) });
    }
    const starred = marks.some((m) => m.mine && m.kind === 'star');
    items.push({ label: starred ? 'Usuń z zapisanych' : 'Zapisz', icon: 'star', onSelect: () => onMark(id, 'star', '1') });
    if (rules.canPin) {
      const pinned = marks.some((m) => m.kind === 'pin');
      items.push({ label: pinned ? 'Odepnij' : 'Przypnij', icon: 'pin', onSelect: () => onMark(id, 'pin', '1') });
    }
    if (rules.canEdit(message, opened)) items.push({ label: 'Edytuj', icon: 'edit', onSelect: () => on.edit(message, opened) });
    if (message.editedAt != null) items.push({ label: 'Historia zmian', icon: 'history', onSelect: () => on.history(message) });
    if (on.task !== undefined) {
      const task = on.task;
      items.push({ label: 'Utwórz zadanie', icon: 'check', onSelect: () => task(message, opened) });
    }
    if (on.appointment !== undefined) {
      const appointment = on.appointment;
      items.push({ label: 'Dodaj do kalendarza', icon: 'clock', onSelect: () => appointment(message, opened) });
    }
    if (on.moveTopic !== undefined) {
      const move = on.moveTopic;
      items.push({ label: 'Przenieś do tematu', icon: 'hash', onSelect: () => move(message) });
    }
    if (reportable) items.push({ label: 'Zgłoś', icon: 'alert', onSelect: () => onReport(menu.item, menu.author) });
  }
  if (gone && rules.canRestore(message)) items.push({ label: 'Przywróć', icon: 'history', onSelect: () => onRestore(message) });
  if (!gone && rules.canDelete(message)) items.push({ label: 'Usuń', icon: 'trash', danger: true, onSelect: () => onDelete(message) });
  if (items.length === 0) items.push({ label: 'Nic do zrobienia z tą wiadomością', disabled: true, onSelect: () => undefined });

  return (
    <PopMenu anchor={menu.anchor} from={menu.from} label="Opcje wiadomości" items={items} onClose={onClose}>
      {!gone && opened !== null && rules.readOnly !== true && (
        <div className="ch-pop-reacts" role="group" aria-label="Reakcje">
          {REACTIONS.map((emoji) => {
            const pressed = marks.some((m) => m.mine && m.kind === 'reaction' && m.value === emoji);
            return (
              <button key={emoji} type="button" role="menuitemcheckbox" aria-checked={pressed} aria-label={`Reakcja ${emoji}`}
                className={pressed ? 'is-on' : undefined} onClick={() => { onClose(); onMark(id, 'reaction', emoji); }}>
                {emoji}
              </button>
            );
          })}
        </div>
      )}
    </PopMenu>
  );
}

function MessageRow({ endpoint, item, mine, start, end, author, note, group, receipts, marks, features, replyAuthor, search, picked = null, onMenu, onJump, onReact, onHistory, onSwipe }: {
  endpoint: string;
  item: Shown;
  mine: boolean;
  start: boolean;
  end: boolean;
  author: string;
  note: string | null;
  group: boolean;
  receipts: boolean;
  marks: readonly Mark[];
  features: Features | null;
  replyAuthor: string | null;
  search: string;
  /** 0101 — `null`: es wird nicht markiert; sonst, ob diese markiert ist. */
  picked?: boolean | null;
  onMenu: (anchor: Anchor, from: Element | null) => void;
  onJump: (id: string) => void;
  onReact: (emoji: string) => void;
  onHistory: () => void;
  onSwipe: () => void;
}) {
  const { message, opened } = item;
  const gone = message.deletedAt !== null;
  const text = opened?.text ?? '';
  const files = opened?.attachments ?? [];
  const big = !gone && opened !== null && files.length === 0 && opened.replyTo === undefined && opened.forwarded !== true && bigEmoji(text);
  const pinned = marks.some((m) => m.kind === 'pin');
  const starred = marks.some((m) => m.mine && m.kind === 'star');

  /* Reaktionen gezählt, meine hervorgehoben. */
  const reactions: { value: string; count: number; mine: boolean }[] = [];
  for (const m of marks) {
    if (m.kind !== 'reaction') continue;
    const had = reactions.find((r) => r.value === m.value);
    if (had === undefined) reactions.push({ value: m.value, count: 1, mine: m.mine });
    else { had.count += 1; had.mine ||= m.mine; }
  }

  /* Gelesen — von wem ausser dem Verfasser selbst, seit die Nachricht da ist. */
  const readBy = !mine || !receipts || gone ? 0 : (features?.receipts ?? []).filter((r) =>
    r.readAt !== null && new Date(r.readAt).getTime() >= at(message)
    && !(message.authorRoleId !== null && r.roleIds.includes(message.authorRoleId))
    && !(message.authorSeatId !== null && r.seatId === message.authorSeatId)).length;

  const meta = (live: boolean) => (
    <>
      {pinned && <Icon name="pin" />}
      {starred && <Icon name="star" />}
      {message.editedAt != null && !gone && (live
        ? <button type="button" className="ch-edited" title={`Edytowano ${whenLong(message.editedAt)} — pokaż wersje`} onClick={onHistory}>edytowano</button>
        : <span className="ch-edited">edytowano</span>)}
      <time dateTime={message.createdAt} title={live ? full(message.createdAt) : undefined}>{clock(message.createdAt)}</time>
      {mine && receipts && !gone && (
        <span className={cls('ch-ticks', readBy > 0 && 'is-read')} title={readBy > 0 ? `Przeczytana (${readBy})` : 'Wysłana'}
          aria-label={live ? (readBy > 0 ? `przeczytana przez ${readBy}` : 'wysłana') : undefined}>
          {readBy > 0 ? '✓✓' : '✓'}
        </span>
      )}
    </>
  );
  const pad = <span className="ch-meta-pad" aria-hidden="true">{meta(false)}</span>;

  const visual = files.length > 0 && files.every((a) => kindOf(a) === 'image' || kindOf(a) === 'video');
  const metaOn = text !== '' || gone || opened === null ? 'text' : reactions.length > 0 ? 'reacts' : visual ? 'media' : 'block';

  /* -- Gesten: langes Drücken öffnet das Menü, nach rechts wischen antwortet. -- */
  const press = useRef<{ x: number; y: number; timer: number; sideways: boolean } | null>(null);
  const [shift, setShift] = useState(0);
  const end0 = () => {
    if (press.current !== null) window.clearTimeout(press.current.timer);
    press.current = null;
    setShift(0);
  };

  const openHere = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, audio, video, input, textarea') !== null) return;
    const selection = window.getSelection();
    if (selection !== null && selection.toString() !== '' && e.currentTarget.contains(selection.anchorNode)) return;
    e.preventDefault();
    onMenu({ x: e.clientX, y: e.clientY }, e.currentTarget);
  };

  return (
    <div
      id={`message-${message.messageId}`}
      className={cls('ch-row', mine ? 'is-mine' : 'is-theirs', start && 'is-start', end && 'is-end', group && !mine && 'has-ava',
        picked !== null && 'is-picking', picked === true && 'is-picked')}
      aria-selected={picked === null ? undefined : picked}
      style={shift > 0 ? { transform: `translateX(${shift}px)` } : undefined}
      onPointerDown={(e) => {
        if (e.pointerType !== 'touch') return;
        const x = e.clientX;
        const y = e.clientY;
        const target = e.currentTarget;
        press.current = {
          x, y, sideways: false,
          timer: window.setTimeout(() => { if (press.current !== null && !press.current.sideways) onMenu({ x, y }, target); }, 480)
        };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p === null) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) window.clearTimeout(p.timer);
        if (!p.sideways && dx > 12 && dx > Math.abs(dy) * 1.6) p.sideways = true;
        if (p.sideways) setShift(Math.max(0, Math.min(dx, 84)));
      }}
      onPointerUp={() => {
        if (shift > 56) onSwipe();
        end0();
      }}
      onPointerCancel={end0}
    >
      {picked !== null && <span className="ch-pick" aria-hidden="true">{picked && <Icon name="check" />}</span>}
      {group && !mine && (
        <span className="ch-ava-slot">{end && <Avatar seed={authorOf(message)} name={author} size="sm" />}</span>
      )}
      {shift > 0 && <span className="ch-swipe" style={{ opacity: Math.min(1, shift / 56) }}><Icon name="reply" /></span>}
      <div className={cls('ch-bubble', gone && 'is-gone', big && 'is-emoji', visual && text === '' && 'is-media')} onContextMenu={openHere}>
        {/* 0095 — die eigene trägt eine Zeile, wenn sie mehr sagt als „Ty" (durch eine Rolle, eine andere eigene Person). */}
        {group && (!mine || author !== 'Ty') && start && (
          <div className="ch-author" style={{ '--ch-h': hueOf(authorOf(message)) } as CSSProperties}>
            {author}{note !== null && <span className="ch-author-note"> · {note}</span>}
          </div>
        )}

        {gone ? (
          <div className="ch-text ch-gone">
            <Icon name="ban" /> {message.deletedBy === 'moderator' ? 'Wiadomość usunięta przez prowadzącego' : 'Wiadomość usunięta'}{pad}
          </div>
        ) : message.blocked === true ? (
          /* 0130 — nach einer Meldung gesperrt: der Dienst schickt keinen Inhalt. */
          <div className="ch-text ch-gone" data-message-blocked=""><Icon name="ban" /> Wiadomość zablokowana po zgłoszeniu.{pad}</div>
        ) : opened === null ? (
          <div className="ch-text ch-gone"><Icon name="lock" /> Nie do odczytania — brak klucza tej epoki.{pad}</div>
        ) : (
          <>
            {opened.forwarded === true && <div className="ch-fwd"><Icon name="forward" /> Przekazana</div>}
            {opened.replyTo !== undefined && (
              <button type="button" className="ch-quote" onClick={() => onJump(opened.replyTo!)}
                style={{ '--ch-h': hueOf(replyAuthor ?? 'x') } as CSSProperties}>
                <strong>{replyAuthor ?? 'Odpowiedź'}</strong>
                <span>{opened.replyText || 'Załącznik'}</span>
              </button>
            )}
            {files.length > 0 && <Attachments endpoint={endpoint} list={files} />}
            {text !== '' && <div className="ch-text"><Linked text={text} mark={search} />{metaOn === 'text' && pad}</div>}
          </>
        )}

        {reactions.length > 0 && (
          <div className="ch-reacts">
            {reactions.map((r) => (
              <button key={r.value} type="button" className={cls('ch-react', r.mine && 'is-mine')} aria-pressed={r.mine}
                aria-label={`Reakcja ${r.value}: ${r.count}${r.mine ? ', w tym Twoja' : ''}`} onClick={() => onReact(r.value)}>
                <span>{r.value}</span>{r.count > 1 && <span className="ch-react-n">{r.count}</span>}
              </button>
            ))}
            {metaOn === 'reacts' && pad}
          </div>
        )}

        <span className={cls('ch-meta', metaOn === 'block' && 'is-block', metaOn === 'media' && 'on-media')}>{meta(true)}</span>

        <button type="button" className="ch-more" aria-label="Opcje wiadomości" aria-haspopup="menu"
          onClick={(e) => onMenu({ rect: e.currentTarget.getBoundingClientRect() }, e.currentTarget)}>
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

/* -- Was nach einer Aktion an der Liste geändert wird --------------------------------------------- */

export const withEdit = (was: readonly Shown[], id: string, done: { version: number; editedAt: string; epoch: number; bodySealed: string }, text: string): Shown[] =>
  was.map((w) => (w.message.messageId === id && w.opened !== null
    ? { message: { ...w.message, version: done.version, editedAt: done.editedAt, epoch: done.epoch, bodySealed: done.bodySealed }, opened: { ...w.opened, text } }
    : w));

export const withDelete = (was: readonly Shown[], id: string, by: 'author' | 'moderator'): Shown[] =>
  was.map((w) => (w.message.messageId === id
    ? { message: { ...w.message, deletedAt: new Date().toISOString(), bodySealed: null, deletedBy: by }, opened: null }
    : w));

/** Die eigene letzte, die sich noch bearbeiten lässt — für den Pfeil nach oben im leeren Feld. */
export function lastEditable(list: readonly Shown[], can: (message: SealedMessage, opened: Opened | null) => boolean): Shown | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const one = list[i];
    if (one.opened !== null && one.message.deletedAt === null && can(one.message, one.opened)) return one;
  }
  return null;
}
