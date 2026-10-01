/**
 * DIE ROZMOWA WIE EIN MESSENGER (0062).
 *
 * Blasen links und rechts, Tage dazwischen, Uhrzeit und Häkchen IN der Blase.
 * An jeder Nachricht ein Menü — rechte Maustaste, langes Drücken, oder das
 * kleine ⌄ beim Darüberfahren — mit Reaktionen, Antworten, Kopieren,
 * Weitergeben, Merken, Anheften, Bearbeiten, Löschen; nach rechts wischen
 * antwortet. Unten das Feld wie in Telegram oder WhatsApp: Emoji, 📎, und ein
 * Knopf, der Mikrofon ist, solange nichts dasteht, und Senden, sobald etwas
 * dasteht. Planen: rechte Maustaste oder langes Drücken auf Senden.
 *
 * <b>Nur das Gesicht.</b> Was eine Rozmowa holt, versiegelt und unterschreibt,
 * bleibt in ihrer Datei (`ChatPage`, `PageChatView`, `SeatChatView`): drei
 * Wege zum Dienst, ein Aussehen.
 */

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode
} from 'react';
import { createPortal } from 'react-dom';

import { authorOf, openMessage, type Attachment, type Opened, type SealedMessage, type SendOptions } from './chat';
import { PreferencesEditor, type useChatExtras } from './ChatExtras';
import { availableNow, downloadAttachment, photoForChat, uploadAttachment, type Features, type Mark } from './chatFeatures';
import { Modal } from './Modal';
import { saveBlob } from './platform';
import { call } from './session';

export interface Shown {
  readonly message: SealedMessage;
  readonly opened: Opened | null;
}

const cls = (...parts: readonly (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const failure = (e: unknown, fallback: string) => (e instanceof Error && e.message !== '' ? e.message : fallback);

/* -- Zeichen ------------------------------------------------------------------ */

/* Strichzeichnungen im Raster 24 × 24 (nach Feather/Lucide) — Emoji sähen auf jedem System anders aus. */
const PATHS = {
  send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>,
  mic: <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" /></>,
  clip: <path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />,
  smile: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
  back: <path d="M19 12H5m7 7-7-7 7-7" />,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  trash: <><path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  reply: <><path d="m9 14-5-5 5-5" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></>,
  forward: <><path d="m15 14 5-5-5-5" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /></>,
  edit: <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2 2 9.3l6.9-1z" />,
  pin: <><path d="M12 17v5" /><path d="M5 17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2z" /></>,
  history: <><path d="M1 4v6h6" /><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  'bell-off': <><path d="M13.7 21a2 2 0 0 1-3.4 0" /><path d="M18.6 13A17.9 17.9 0 0 1 18 8" /><path d="M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14" /><path d="M18 8a6 6 0 0 0-9.3-5" /><path d="m1 1 22 22" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M13 2v7h7" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  compose: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" /></>,
  archive: <><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>,
  play: <path d="M6 3l14 9-14 9z" />,
  ban: <><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>,
  bookmark: <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  hash: <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />,
  area: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></>
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg className="ch-i" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={label === undefined ? true : undefined}
      role={label === undefined ? undefined : 'img'} aria-label={label}>
      {PATHS[name]}
    </svg>
  );
}

/* -- Gesichter --------------------------------------------------------------------- */

/** Ein Farbton je Kennung — dieselbe Person hat überall dieselbe Farbe. */
export const hueOf = (seed: string): number => {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export const initialsOf = (name: string): string => {
  const words = name.replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w));
  if (words.length === 0) return '?';
  const first = (w: string) => Array.from(w.replace(/^[^\p{L}\p{N}]+/u, ''))[0] ?? '';
  const out = words.length === 1 ? Array.from(words[0]).slice(0, 2).join('') : first(words[0]) + first(words[words.length - 1]);
  return out.toLocaleUpperCase('pl-PL');
};

export function Avatar({ seed, name, icon, size = 'md' }: { seed: string; name: string; icon?: IconName; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cls('ch-ava', `is-${size}`, icon !== undefined && 'is-icon')} style={{ '--ch-h': hueOf(seed) } as CSSProperties} aria-hidden="true">
      {icon !== undefined ? <Icon name={icon} /> : initialsOf(name)}
    </span>
  );
}

/* -- Zeit und Grösse ------------------------------------------------------------------ */

const clock = (at: string) => new Date(at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const full = (at: string) => new Date(at).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dayKey = (at: string) => new Date(at).toDateString();
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const capital = (s: string) => s.charAt(0).toLocaleUpperCase('pl-PL') + s.slice(1);

/** Die Tagesmarke im Verlauf: Dzisiaj, Wczoraj, der Wochentag, sonst das Datum. */
export function dayLabel(at: string, now = new Date()): string {
  const d = new Date(at);
  const days = Math.round((midnight(now) - midnight(d)) / 86_400_000);
  if (days === 0) return 'Dzisiaj';
  if (days === 1) return 'Wczoraj';
  if (days > 1 && days < 7) return capital(d.toLocaleDateString('pl-PL', { weekday: 'long' }));
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
}

/** Die Zeit in der Liste der Rozmowy: heute die Uhrzeit, dann „wczoraj", der Wochentag, das Datum. */
export function listTime(at: string, now = new Date()): string {
  const d = new Date(at);
  const days = Math.round((midnight(now) - midnight(d)) / 86_400_000);
  if (days === 0) return clock(at);
  if (days === 1) return 'wczoraj';
  if (days > 1 && days < 7) return d.toLocaleDateString('pl-PL', { weekday: 'short' });
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export const whenLong = (at: string) => new Date(at).toLocaleString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const sizeOf = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;

/** Polnische Mehrzahl: 1 uczestnik, 2 uczestników … nein: 2 uczestnicy, 5 uczestników. */
export const plural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

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

const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/* -- Menüs ------------------------------------------------------------------------------ */

export interface MenuItem {
  readonly label: string;
  readonly icon?: IconName;
  readonly onSelect: () => void;
  readonly danger?: boolean;
  readonly checked?: boolean;
  readonly disabled?: boolean;
}

/** Wo ein Menü aufgeht: an einem Punkt (rechte Maustaste) oder an einem Knopf. */
export type Anchor = { readonly x: number; readonly y: number } | { readonly rect: DOMRect; readonly above?: boolean };

const TOKENS = ['--wk-ground', '--wk-surface', '--wk-ink', '--wk-muted', '--wk-line', '--wk-accent', '--wk-on-accent', '--wk-danger', '--wk-soft', '--ch-mine-mix', '--ch-name-l'];

/**
 * DIE FARBEN DORT, WO DAS MENÜ AUFGEHT. Es steht am Rand des Dokuments (ein
 * Portal — in einer Kachel mit Breitenabfrage wäre „fest" sonst die Kachel);
 * dort gälten die Farben der App, und im dunklen Slajd ginge ein helles auf.
 */
function themeOf(from: Element | null | undefined): CSSProperties {
  if (from === null || from === undefined) return {};
  const style = getComputedStyle(from);
  const out: Record<string, string> = {};
  for (const token of TOKENS) {
    const value = style.getPropertyValue(token).trim();
    if (value !== '') out[token] = value;
  }
  if (style.colorScheme !== '') out.colorScheme = style.colorScheme;
  return out as CSSProperties;
}

export function PopMenu({ anchor, from, items = [], label, onClose, children, kind = 'menu' }: {
  anchor: Anchor;
  from?: Element | null;
  items?: readonly MenuItem[];
  label: string;
  onClose: () => void;
  children?: ReactNode;
  kind?: 'menu' | 'emoji';
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [spot, setSpot] = useState<{ left: number; top: number } | null>(null);
  const [theme] = useState(() => themeOf(from));

  useLayoutEffect(() => {
    const el = box.current;
    if (el === null) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const m = 8;
    let left: number;
    let top: number;
    if ('x' in anchor) {
      left = anchor.x + w > vw - m ? anchor.x - w : anchor.x;
      top = anchor.y + h > vh - m ? anchor.y - h : anchor.y;
    } else {
      const r = anchor.rect;
      left = r.right - w < m ? r.left : r.right - w;
      top = anchor.above === true ? r.top - h - 6 : r.bottom + 6;
      if (anchor.above !== true && top + h > vh - m) top = r.top - h - 6;
      if (anchor.above === true && top < m) top = r.bottom + 6;
    }
    setSpot({ left: Math.max(m, Math.min(left, vw - w - m)), top: Math.max(m, Math.min(top, vh - h - m)) });
  }, [anchor]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('[role^=menuitem]:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true });

    const down = (e: PointerEvent) => {
      const target = e.target as Node;
      if (box.current?.contains(target) || from?.contains(target)) return;
      close.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      close.current();
    };
    /*
     * Wer rollt, geht weg — gemeint ist die HAND (Rad, Finger), nicht `scroll`:
     * der Verlauf rollt auch von selbst nach unten, wenn eine Nachricht kommt,
     * und das Menü verschwände dann unter dem Zeiger.
     */
    const away = (e: Event) => {
      if (e.target instanceof Node && box.current?.contains(e.target)) return;
      close.current();
    };

    /* Der Finger, der das Menü mit langem Drücken öffnete, liegt noch auf: erst ein neuer zählt. */
    let fresh = false;
    const touched = () => { fresh = true; };
    const swiped = (e: Event) => { if (fresh) away(e); };

    /* Nur eine andere BREITE schliesst — die Tastatur des Telefons ändert bloss die Höhe. */
    const wide = window.innerWidth;
    const resized = () => { if (window.innerWidth !== wide) close.current(); };

    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('wheel', away, { capture: true, passive: true });
    document.addEventListener('touchstart', touched, { capture: true, passive: true });
    document.addEventListener('touchmove', swiped, { capture: true, passive: true });
    window.addEventListener('resize', resized);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('wheel', away, true);
      document.removeEventListener('touchstart', touched, true);
      document.removeEventListener('touchmove', swiped, true);
      window.removeEventListener('resize', resized);
      const now = document.activeElement;
      if ((now === null || now === document.body) && before !== null && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [from]);

  /* Pfeiltasten wandern, Tab verlässt das Menü. */
  const walk = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') { close.current(); return; }
    const all = Array.from(box.current?.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)') ?? []);
    if (all.length === 0) return;
    const i = all.indexOf(document.activeElement as HTMLElement);
    const step = kind === 'emoji' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') ? (e.key === 'ArrowRight' ? 1 : -1)
      : e.key === 'ArrowDown' ? (kind === 'emoji' ? 8 : 1) : e.key === 'ArrowUp' ? (kind === 'emoji' ? -8 : -1) : 0;
    let next = -1;
    if (step !== 0) next = ((i < 0 ? 0 : i + step) % all.length + all.length) % all.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = all.length - 1;
    if (next >= 0) { e.preventDefault(); all[next].focus(); }
  };

  return createPortal(
    <div
      ref={box}
      className={cls('ch-layer', 'ch-pop', kind === 'emoji' && 'is-emoji')}
      role="menu"
      aria-label={label}
      style={{ ...theme, left: spot?.left ?? 0, top: spot?.top ?? 0, visibility: spot === null ? 'hidden' : 'visible' }}
      onKeyDown={walk}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          aria-checked={item.checked}
          className={cls('ch-pop-item', item.danger === true && 'is-danger')}
          disabled={item.disabled}
          onClick={() => { close.current(); item.onSelect(); }}
        >
          <span className="ch-pop-ic">{item.icon !== undefined && <Icon name={item.icon} />}</span>
          <span className="ch-pop-label">{item.label}</span>
          {item.checked === true && <span className="ch-pop-check"><Icon name="check" /></span>}
        </button>
      ))}
    </div>,
    document.body
  );
}

/** Ein Menü an einem Knopf — auf, zu, und wieder zu, wenn man den Knopf noch einmal drückt. */
export function useButtonMenu() {
  const [open, setOpen] = useState<{ rect: DOMRect; from: Element } | null>(null);
  const toggle = (el: Element) => setOpen((was) => (was === null ? { rect: el.getBoundingClientRect(), from: el } : null));
  return { open, toggle, close: () => setOpen(null) };
}

/* -- Der Kopf ------------------------------------------------------------------------------ */

/**
 * DER KOPF EINER ROZMOWA: zurück, Bild, Name, darunter wer schreibt oder wie
 * viele dabei sind; rechts die Lupe und ⋮. Auf einer Seite (`compact`) ohne
 * Namen — den trägt dort schon die Kachel.
 */
export function ChatHeader({ back, title, avatar, subtitle, menu, search, onSearch, quiet = false, heading = 'h1', compact = false }: {
  back?: string;
  title?: string;
  avatar?: ReactNode;
  subtitle?: ReactNode;
  menu: readonly MenuItem[];
  search: string;
  onSearch: (text: string) => void;
  quiet?: boolean;
  heading?: 'h1' | 'h2' | 'p';
  compact?: boolean;
}) {
  const [searching, setSearching] = useState(search !== '');
  const more = useButtonMenu();
  const Title = heading;
  const stop = () => { onSearch(''); setSearching(false); };

  if (searching) {
    return (
      <header className={cls('ch-head', 'is-search', compact && 'is-compact')}>
        <span className="ch-head-ic"><Icon name="search" /></span>
        <input
          className="ch-search"
          autoFocus
          value={search}
          placeholder="Szukaj w rozmowie…"
          aria-label="Szukaj w rozmowie"
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); stop(); } }}
        />
        <button type="button" className="ch-icon-btn" aria-label="Zamknij wyszukiwanie" onClick={stop}><Icon name="x" /></button>
      </header>
    );
  }

  const bell = quiet ? <span className="ch-quiet" title="Tryb cichy — powiadomienia są wyciszone"><Icon name="bell-off" label="wyciszona" /></span> : null;

  return (
    <header className={cls('ch-head', compact && 'is-compact')}>
      {back !== undefined && (
        <a className="ch-icon-btn ch-back" href={back} aria-label="Wróć do listy rozmów" title="Rozmowy"><Icon name="back" /></a>
      )}
      {avatar}
      <div className="ch-head-text">
        {title !== undefined && <Title className="ch-head-title"><span>{title}</span>{bell}</Title>}
        {(subtitle !== undefined || (title === undefined && quiet)) && (
          <span className="ch-head-sub">{title === undefined && bell}{subtitle}</span>
        )}
      </div>
      <button type="button" className="ch-icon-btn" aria-label="Szukaj w rozmowie" title="Szukaj" onClick={() => setSearching(true)}>
        <Icon name="search" />
      </button>
      <button
        type="button"
        className="ch-icon-btn"
        aria-label="Więcej opcji rozmowy"
        title="Więcej"
        aria-haspopup="menu"
        aria-expanded={more.open !== null}
        onClick={(e) => more.toggle(e.currentTarget)}
      >
        <Icon name="more" />
      </button>
      {more.open !== null && (
        <PopMenu anchor={{ rect: more.open.rect }} from={more.open.from} label="Opcje rozmowy" items={menu} onClose={more.close} />
      )}
    </header>
  );
}

/* -- Was jede Rozmowa im Menü ⋮ hat ------------------------------------------------------------- */

interface Planned extends SealedMessage {
  readonly sendAt: string;
  readonly state: string;
  readonly preview: string;
}

/** Die eigenen geplanten Nachrichten — mit dem Text, den nur der Absender öffnen kann. */
export function useScheduled(endpoint: string, keys: ReadonlyMap<number, Uint8Array>) {
  const [list, setList] = useState<readonly Planned[]>([]);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    const load = () => call<{ messages: (SealedMessage & { sendAt: string; state: string })[] }>(`${endpoint}/scheduled`)
      .then(async (found) => {
        const opened = await Promise.all(found.messages.map(async (m) => {
          const o = await openMessage(keys, m);
          const files = o?.attachments?.length ?? 0;
          return { ...m, preview: o === null ? 'Wiadomość bez dostępnego klucza' : o.text !== '' ? o.text : files > 0 ? `Załącznik (${files})` : '' };
        }));
        if (live) setList(opened);
      })
      .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 15_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [endpoint, keys, round]);

  return {
    list,
    refresh: () => setRound((n) => n + 1),
    drop: (id: string) => setList((was) => was.filter((m) => m.messageId !== id))
  };
}

/**
 * WAS JEDE ROZMOWA IM MENÜ ⋮ HAT — Zapisane, Przypięte, Zaplanowane,
 * Powiadomienia; wer moderiert, dazu „Kto może pisać". Dazu die Leiste unter
 * dem Kopf (Filter, Fehler), das Plättchen der geplanten über dem Feld und
 * was der Kopf über den Zustand sagt.
 */
export function useChatChrome({ endpoint, extras, keys, canModerate = false, onPolicy }: {
  endpoint: string;
  extras: ReturnType<typeof useChatExtras>;
  keys: ReadonlyMap<number, Uint8Array>;
  canModerate?: boolean;
  onPolicy?: () => void;
}) {
  const scheduled = useScheduled(endpoint, keys);
  const [panel, setPanel] = useState<'prefs' | 'scheduled' | 'policy' | null>(null);
  const f = extras.features;
  const filter = extras.filter;

  const items: MenuItem[] = [
    { label: 'Zapisane wiadomości', icon: 'star', checked: filter === 'star', disabled: f === null, onSelect: () => extras.setFilter(filter === 'star' ? 'all' : 'star') },
    { label: 'Przypięte wiadomości', icon: 'pin', checked: filter === 'pin', disabled: f === null, onSelect: () => extras.setFilter(filter === 'pin' ? 'all' : 'pin') },
    { label: scheduled.list.length > 0 ? `Zaplanowane (${scheduled.list.length})` : 'Zaplanowane', icon: 'clock', onSelect: () => setPanel('scheduled') },
    { label: 'Powiadomienia i dostępność', icon: 'bell', disabled: f === null, onSelect: () => setPanel('prefs') },
    ...(canModerate ? [{ label: 'Kto może pisać', icon: 'users' as const, disabled: f === null, onSelect: () => setPanel('policy') }] : [])
  ];

  const banner = (
    <>
      {extras.loadError !== null && (
        <p className="ch-bar is-error" role="alert">Nie udało się wczytać funkcji rozmowy. {extras.loadError}</p>
      )}
      {filter !== 'all' && (
        <p className="ch-bar">
          <Icon name={filter === 'star' ? 'star' : 'pin'} />
          <span>Tylko {filter === 'star' ? 'zapisane' : 'przypięte'} wiadomości</span>
          <button type="button" className="wk-link-btn" onClick={() => extras.setFilter('all')}>Pokaż wszystkie</button>
        </p>
      )}
    </>
  );

  const chip = scheduled.list.length === 0 ? null : (
    <button type="button" className="ch-chip ch-sched-chip" onClick={() => setPanel('scheduled')}>
      <Icon name="clock" /> {scheduled.list.length === 1 ? '1 zaplanowana wiadomość' : `Zaplanowane: ${scheduled.list.length}`}
    </button>
  );

  const dialogs = (
    <>
      {panel === 'prefs' && f !== null && (
        <Modal title="Powiadomienia i dostępność" onClose={() => setPanel(null)}>
          <PreferencesEditor key={endpoint} value={f.settings ?? f.common} inherited={f.settings === null} onSave={async (p) => {
            await call(`${endpoint}/preferences`, { method: 'PUT', body: JSON.stringify({ settings: p }) });
            await extras.refresh();
          }} />
        </Modal>
      )}
      {panel === 'scheduled' && <ScheduledDialog endpoint={endpoint} scheduled={scheduled} onClose={() => setPanel(null)} />}
      {panel === 'policy' && f !== null && (
        <PolicyDialog endpoint={endpoint} policy={f.postingPolicy} onClose={() => setPanel(null)}
          onDone={() => { void extras.refresh(); onPolicy?.(); }} />
      )}
    </>
  );

  const status = {
    typing: (f?.typing ?? 0) > 0,
    quiet: f !== null && (f.effective.muted || !availableNow(f.effective)),
    channel: f?.postingPolicy === 'writers',
    available: f?.receipts.filter((r) => r.available === true).length ?? 0,
    away: f?.receipts.filter((r) => r.available === false).length ?? 0
  };

  return { items, banner, chip, dialogs, status, scheduled };
}

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function ScheduledDialog({ endpoint, scheduled, onClose }: {
  endpoint: string;
  scheduled: ReturnType<typeof useScheduled>;
  onClose: () => void;
}) {
  const [said, setSaid] = useState<string | null>(null);

  return (
    <Modal title="Zaplanowane wiadomości" onClose={onClose}>
      {scheduled.list.length === 0 ? (
        <p className="wk-hint">
          W tej rozmowie nic nie czeka. Wiadomość zaplanujesz, klikając prawym przyciskiem (albo przytrzymując) przycisk wysyłania.
        </p>
      ) : (
        <ul className="ch-planned">
          {scheduled.list.map((m) => (
            <li key={m.messageId}>
              <p className="ch-planned-text">{m.preview || 'Wiadomość'}</p>
              <p className={m.state === 'failed' ? 'wk-error' : 'wk-hint'}>
                {whenLong(m.sendAt)} — {m.state === 'failed' ? 'niewysłana: zmienił się dostęp albo klucz. Anuluj i zaplanuj ponownie.' : 'czeka na wysłanie'}
              </p>
              <div className="ch-planned-tools">
                {m.state === 'pending' && (
                  <Reschedule endpoint={endpoint} messageId={m.messageId} sendAt={m.sendAt}
                    onDone={(text) => { setSaid(text); scheduled.refresh(); }} />
                )}
                <button type="button" className="wk-link-btn" onClick={() => {
                  void call(`${endpoint}/scheduled/${m.messageId}`, { method: 'DELETE' })
                    .then(() => { scheduled.drop(m.messageId); setSaid('Anulowano.'); })
                    .catch((e: unknown) => setSaid(failure(e, 'Nie udało się anulować.')));
                }}>Anuluj wysłanie</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {said !== null && <p className="wk-hint" role="status">{said}</p>}
    </Modal>
  );
}

function Reschedule({ endpoint, messageId, sendAt, onDone }: { endpoint: string; messageId: string; sendAt: string; onDone: (text: string) => void }) {
  const [value, setValue] = useState(() => localInput(new Date(sendAt)));
  return (
    <span className="ch-reschedule">
      <input type="datetime-local" aria-label="Nowy termin wysyłki" value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="button" className="wk-link-btn" onClick={() => {
        if (value === '' || new Date(value).getTime() <= Date.now()) { onDone('Wybierz przyszły termin.'); return; }
        void call(`${endpoint}/scheduled/${messageId}`, { method: 'PUT', body: JSON.stringify({ sendAt: new Date(value).toISOString() }) })
          .then(() => onDone('Zmieniono termin.'))
          .catch((e: unknown) => onDone(failure(e, 'Nie udało się zmienić terminu.')));
      }}>Zmień termin</button>
    </span>
  );
}

const POLICIES = [
  { value: 'legacy', label: 'Dotychczasowe zasady', hint: 'Piszą ci, którzy pisali do tej pory.' },
  { value: 'members', label: 'Wszyscy uczestnicy', hint: 'Każdy w rozmowie może pisać.' },
  { value: 'writers', label: 'Kanał', hint: 'Publikują tylko osoby z prawem zapisu (write/admin); pozostali czytają i reagują.' }
] as const;

function PolicyDialog({ endpoint, policy, onDone, onClose }: { endpoint: string; policy: string; onDone: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <Modal title="Kto może pisać" onClose={onClose}>
      <div className="ch-options" role="radiogroup" aria-label="Kto może pisać">
        {POLICIES.map((p) => (
          <label key={p.value} className="ch-option">
            <input type="radio" name="ch-policy" checked={policy === p.value} disabled={busy} onChange={() => {
              setBusy(true);
              setFailed(null);
              void call(`${endpoint}/policy`, { method: 'PUT', body: JSON.stringify({ postingPolicy: p.value }) })
                .then(() => { onDone(); onClose(); })
                .catch((e: unknown) => setFailed(failure(e, 'Nie udało się zmienić.')))
                .finally(() => setBusy(false));
            }} />
            <span><strong>{p.label}</strong><small>{p.hint}</small></span>
          </label>
        ))}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </Modal>
  );
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

  /* -- Die Zeilen: Tage, „Nieprzeczytane", Gruppen einer Person ----------------- */

  const rows: ReactNode[] = [];
  let unreadPlaced = false;
  const unreadAt = unreadAfter === null ? null : new Date(unreadAfter).getTime();
  visible.forEach((item, i) => {
    const { message } = item;
    const prev = visible[i - 1]?.message;
    const next = visible[i + 1]?.message;
    const mine = rules.mine(message);
    const newDay = prev === undefined || dayKey(prev.createdAt) !== dayKey(message.createdAt);
    if (newDay) {
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
        onMenu={(anchor, from) => setMenu({ anchor, from, item, author })}
        onJump={jumpTo}
        onReact={(emoji) => mark(message.messageId, 'reaction', emoji)}
        onHistory={() => on.history(message)}
        onSwipe={() => { if (item.opened !== null && message.deletedAt === null) on.reply(message, item.opened, author); }}
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
      {pin !== null && (
        <button type="button" className="ch-pinbar" onClick={() => { jumpTo(pin.message.messageId); setPinAt((n) => n + 1); }}>
          <Icon name="pin" />
          <span className="ch-pinbar-text">
            <strong>{pinned.length > 1 ? `Przypięta wiadomość ${(pinAt % pinned.length) + 1} z ${pinned.length}` : 'Przypięta wiadomość'}</strong>
            <span>{pin.opened?.text || (pin.opened?.attachments?.length ? 'Załącznik' : 'Wiadomość')}</span>
          </span>
        </button>
      )}

      <div className="ch-log" ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions">
        <div className="ch-log-in" ref={inner}>
          {more && all.length > 0 && (
            <button type="button" className="ch-earlier" onClick={earlier}>Wczytaj wcześniejsze</button>
          )}
          {items === undefined && <p className="ch-empty">Wczytywanie…</p>}
          {items !== undefined && all.length === 0 && <p className="ch-empty">{empty}</p>}
          {items !== undefined && all.length > 0 && visible.length === 0 && (
            <p className="ch-empty">{search !== '' ? `Nic nie pasuje do „${search}" we wczytanych wiadomościach.` : 'Nie ma tu takich wiadomości.'}</p>
          )}
          {rows}
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
          onRestore={(message) => { void on.restore(message).then(() => say('Przywrócono.')).catch((e: unknown) => say(failure(e, 'Nie udało się przywrócić.'))); }}
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

function MessageMenu({ menu, marks, rules, on, onClose, onMark, onCopy, onDelete, onRestore }: {
  menu: OpenMenu;
  marks: readonly Mark[];
  rules: MessageRules;
  on: MessageHandlers;
  onClose: () => void;
  onMark: (id: string, kind: string, value: string) => void;
  onCopy: (text: string) => void;
  onDelete: (message: SealedMessage) => void;
  onRestore: (message: SealedMessage) => void;
}) {
  const { message, opened } = menu.item;
  const id = message.messageId;
  const gone = message.deletedAt !== null;
  const items: MenuItem[] = [];

  if (!gone && opened !== null) {
    items.push({ label: 'Odpowiedz', icon: 'reply', onSelect: () => on.reply(message, opened, menu.author) });
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
  }
  if (gone && rules.canRestore(message)) items.push({ label: 'Przywróć', icon: 'history', onSelect: () => onRestore(message) });
  if (!gone && rules.canDelete(message)) items.push({ label: 'Usuń', icon: 'trash', danger: true, onSelect: () => onDelete(message) });
  if (items.length === 0) items.push({ label: 'Nic do zrobienia z tą wiadomością', disabled: true, onSelect: () => undefined });

  return (
    <PopMenu anchor={menu.anchor} from={menu.from} label="Opcje wiadomości" items={items} onClose={onClose}>
      {!gone && opened !== null && (
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

function MessageRow({ endpoint, item, mine, start, end, author, note, group, receipts, marks, features, replyAuthor, search, onMenu, onJump, onReact, onHistory, onSwipe }: {
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
      className={cls('ch-row', mine ? 'is-mine' : 'is-theirs', start && 'is-start', end && 'is-end', group && !mine && 'has-ava')}
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
      {group && !mine && (
        <span className="ch-ava-slot">{end && <Avatar seed={authorOf(message)} name={author} size="sm" />}</span>
      )}
      {shift > 0 && <span className="ch-swipe" style={{ opacity: Math.min(1, shift / 56) }}><Icon name="reply" /></span>}
      <div className={cls('ch-bubble', gone && 'is-gone', big && 'is-emoji', visual && text === '' && 'is-media')} onContextMenu={openHere}>
        {group && !mine && start && (
          <div className="ch-author" style={{ '--ch-h': hueOf(authorOf(message)) } as CSSProperties}>
            {author}{note !== null && <span className="ch-author-note"> · {note}</span>}
          </div>
        )}

        {gone ? (
          <div className="ch-text ch-gone">
            <Icon name="ban" /> {message.deletedBy === 'moderator' ? 'Wiadomość usunięta przez prowadzącego' : 'Wiadomość usunięta'}{pad}
          </div>
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

/* -- Anhänge -------------------------------------------------------------------------- */

/** Bis zu dieser Grösse öffnen sich Bilder und Sprachnachrichten von selbst, sobald sie ins Bild kommen. */
const AUTO_BYTES = 6 * 1024 * 1024;

const kindOf = (a: Attachment): 'image' | 'audio' | 'video' | 'file' =>
  /^image\/(png|jpeg|gif|webp|avif)$/.test(a.type) ? 'image'
  : a.type.startsWith('audio/') ? 'audio'
  : a.type.startsWith('video/') ? 'video'
  : 'file';

const isVoice = (a: Attachment) => a.name.startsWith('voice-');

/** Ein Anhang, im Browser entschlüsselt — auf Wunsch, oder von selbst, sobald er zu sehen ist. */
function useOpenedFile(endpoint: string, a: Attachment, auto: boolean) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const spot = useRef<HTMLElement | null>(null);
  const alive = useRef(true);
  const made = useRef<{ url: string; blob: Blob } | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (made.current !== null) { URL.revokeObjectURL(made.current.url); made.current = null; }
    };
  }, []);

  const load = useCallback(async (): Promise<Blob | null> => {
    if (made.current !== null) return made.current.blob;
    setBusy(true);
    setFailed(null);
    try {
      const blob = await downloadAttachment(endpoint, a);
      if (!alive.current) return null;
      const made1 = { url: URL.createObjectURL(blob), blob };
      made.current = made1;
      setUrl(made1.url);
      return blob;
    } catch (e) {
      if (alive.current) setFailed(failure(e, 'Nie udało się pobrać.'));
      return null;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [endpoint, a]);

  useEffect(() => {
    const el = spot.current;
    if (!auto || el === null || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver((seen) => {
      if (seen.some((s) => s.isIntersecting)) { watch.disconnect(); void load(); }
    }, { rootMargin: '300px' });
    watch.observe(el);
    return () => watch.disconnect();
  }, [auto, load]);

  const save = async () => {
    const blob = await load();
    if (blob !== null) await saveBlob(blob, a.name).catch(() => setFailed('Nie udało się zapisać pliku.'));
  };

  return { url, busy, failed, load, save, spot };
}

function Attachments({ endpoint, list }: { endpoint: string; list: readonly Attachment[] }) {
  const media = list.filter((a) => kindOf(a) === 'image' || kindOf(a) === 'video');
  const rest = list.filter((a) => !media.includes(a));
  return (
    <div className="ch-atts">
      {media.length > 0 && (
        <div className={cls('ch-media', media.length > 1 && 'is-grid')}>
          {media.map((a) => <Media key={a.id} endpoint={endpoint} a={a} />)}
        </div>
      )}
      {rest.map((a) => (kindOf(a) === 'audio'
        ? <Sound key={a.id} endpoint={endpoint} a={a} />
        : <FileRow key={a.id} endpoint={endpoint} a={a} />))}
    </div>
  );
}

function Media({ endpoint, a }: { endpoint: string; a: Attachment }) {
  const image = kindOf(a) === 'image';
  const file = useOpenedFile(endpoint, a, image && a.size <= AUTO_BYTES);
  const [zoom, setZoom] = useState(false);

  if (file.url === null) {
    return (
      <button type="button" className="ch-media-slot" ref={(el) => { file.spot.current = el; }} disabled={file.busy}
        onClick={() => void file.load()} aria-label={`${image ? 'Pokaż zdjęcie' : 'Odtwórz film'} ${a.name}, ${sizeOf(a.size)}`}>
        <Icon name={image ? 'image' : 'play'} />
        <span>{file.busy ? 'Odszyfrowywanie…' : file.failed ?? `${image ? 'Zdjęcie' : 'Film'} · ${sizeOf(a.size)}`}</span>
      </button>
    );
  }

  if (!image) return <video className="ch-video" controls src={file.url} aria-label={a.name} />;

  return (
    <>
      <button type="button" className="ch-photo" onClick={() => setZoom(true)} aria-label={`Powiększ: ${a.name}`}>
        <img src={file.url} alt={a.name} />
      </button>
      {zoom && (
        <Modal title={a.name} wide onClose={() => setZoom(false)}>
          <img className="ch-zoom" src={file.url} alt={a.name} />
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void file.save()}>Zapisz zdjęcie</button>
            <span className="wk-hint">{sizeOf(a.size)}</span>
          </div>
        </Modal>
      )}
    </>
  );
}

function Sound({ endpoint, a }: { endpoint: string; a: Attachment }) {
  const file = useOpenedFile(endpoint, a, a.size <= AUTO_BYTES);
  const voice = isVoice(a);
  return (
    <div className="ch-sound" ref={(el) => { file.spot.current = el; }}>
      <span className="ch-sound-head">
        <Icon name={voice ? 'mic' : 'music'} />
        <span className="ch-file-name">{voice ? 'Wiadomość głosowa' : a.name}</span>
        <small>{sizeOf(a.size)}</small>
      </span>
      {file.url !== null ? <audio controls preload="metadata" src={file.url} /> : (
        <button type="button" className="wk-link-btn" disabled={file.busy} onClick={() => void file.load()}>
          {file.busy ? 'Odszyfrowywanie…' : 'Odtwórz'}
        </button>
      )}
      {file.failed !== null && <span className="wk-error">{file.failed}</span>}
    </div>
  );
}

function FileRow({ endpoint, a }: { endpoint: string; a: Attachment }) {
  const file = useOpenedFile(endpoint, a, false);
  return (
    <button type="button" className="ch-file" disabled={file.busy} onClick={() => void file.save()} title={`Pobierz ${a.name}`}>
      <span className="ch-file-ic"><Icon name={file.busy ? 'clock' : 'download'} /></span>
      <span className="ch-file-text">
        <span className="ch-file-name">{a.name}</span>
        <small>{file.failed ?? (file.busy ? 'Odszyfrowywanie…' : `${sizeOf(a.size)} · pobierz`)}</small>
      </span>
    </button>
  );
}

/* -- Das Feld ---------------------------------------------------------------------------- */

export interface ReplyTarget {
  readonly id: string;
  readonly text: string;
  readonly author: string;
}

export interface EditTarget {
  readonly id: string;
  readonly text: string;
}

export interface ComposerHandle {
  addFiles: (files: readonly File[]) => void;
  focus: () => void;
}

const EMOJI = [
  '😀', '😂', '🥲', '😊', '😍', '🥰', '😘', '😉', '😎', '🤔', '😮', '😢', '😭', '😡', '🙄', '😴',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👋', '🤝', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🔥',
  '✨', '🎉', '🎂', '🌹', '☀️', '⛪', '✝️', '🕯️', '📖', '✅', '❌', '❓', '❗', '👀', '💡', '📌'
];

/** Das Mikrofon — Aufnahme, Zeit, verwerfen oder senden. Höchstens fünf Minuten. */
function useRecorder(onOverflow: (file: File) => void) {
  const supported = typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia !== undefined && typeof MediaRecorder !== 'undefined';
  const [state, setState] = useState<'idle' | 'asking' | 'recording'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const waiting = useRef<((file: File | null) => void) | null>(null);
  const keep = useRef(true);
  const tick = useRef<number | undefined>(undefined);
  const limit = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  const overflow = useRef(onOverflow);
  overflow.current = onOverflow;

  const release = () => {
    window.clearInterval(tick.current);
    window.clearTimeout(limit.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      keep.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    };
  }, []);

  const start = async () => {
    if (!supported || state !== 'idle') return;
    setState('asking');
    setFailed(null);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) { mic.getTracks().forEach((t) => t.stop()); return; }
      stream.current = mic;
      const rec = new MediaRecorder(mic);
      recorder.current = rec;
      chunks.current = [];
      keep.current = true;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        release();
        const type = rec.mimeType || chunks.current[0]?.type || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = !keep.current || chunks.current.length === 0 ? null
          : new File(chunks.current, `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`, { type });
        if (alive.current) { setState('idle'); setSeconds(0); }
        const done = waiting.current;
        waiting.current = null;
        if (done !== null) done(file);
        else if (file !== null && alive.current) overflow.current(file);
      };
      rec.start(250);
      const began = Date.now();
      setSeconds(0);
      setState('recording');
      tick.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - began) / 1000)), 250);
      limit.current = window.setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 300_000);
    } catch (e) {
      release();
      if (alive.current) {
        setState('idle');
        setFailed(e instanceof DOMException && e.name === 'NotAllowedError' ? 'Brak zgody na mikrofon.' : 'Mikrofon jest niedostępny.');
      }
    }
  };

  const finish = (keepIt: boolean): Promise<File | null> => new Promise((resolve) => {
    const rec = recorder.current;
    if (rec === null || rec.state !== 'recording') { resolve(null); return; }
    keep.current = keepIt;
    waiting.current = resolve;
    rec.stop();
  });

  return { supported, state, seconds, failed, start, send: () => finish(true), cancel: () => { void finish(false); } };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function FileChip({ file, busy, onRemove }: { file: File; busy: boolean; onRemove: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith('image/')) return undefined;
    const url = URL.createObjectURL(file);
    setThumb(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const name = file.name.startsWith('voice-') ? 'Nagranie głosowe' : file.name;
  return (
    <span className="ch-file-chip">
      {thumb !== null ? <img src={thumb} alt="" /> : <span className="ch-file-ic"><Icon name={file.type.startsWith('audio/') ? 'music' : 'file'} /></span>}
      <span className="ch-file-text"><span className="ch-file-name">{name}</span><small>{sizeOf(file.size)}</small></span>
      <button type="button" className="ch-icon-btn is-small" aria-label={`Usuń plik ${name}`} disabled={busy} onClick={onRemove}><Icon name="x" /></button>
    </span>
  );
}

/** Wann eine geplante Nachricht hinausgeht — schnell gewählt oder genau. Wie in Telegram: gewählt heisst gesendet. */
function PlanDialog({ onPlan, onClose }: { onPlan: (iso: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(() => localInput(new Date(Date.now() + 3_600_000)));
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
    onPlan(d.toISOString());
  };

  return (
    <Modal title="Zaplanuj wysłanie" onClose={onClose}>
      <div className="ch-plan-quick">
        {quick.map((q) => <button key={q.label} type="button" className="ch-chip" onClick={() => plan(q.at)}>{q.label}</button>)}
      </div>
      <label className="wk-field">
        <span>Dokładny termin</span>
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => plan(new Date(value))}>Zaplanuj</button>
        <button type="button" className="wk-link-btn" onClick={onClose}>Anuluj</button>
      </div>
      <p className="wk-hint">Wiadomość wyjdzie o tej porze, nawet gdy nie będzie Cię w aplikacji. Zaplanowane są w menu ⋮ rozmowy.</p>
    </Modal>
  );
}

export const Composer = forwardRef<ComposerHandle, {
  endpoint: string;
  /** Warum hier nicht geschrieben wird — dann steht statt des Feldes dieser Satz. */
  readOnly?: string | null;
  placeholder?: string;
  reply: ReplyTarget | null;
  onClearReply: () => void;
  editing: EditTarget | null;
  onCancelEdit: () => void;
  onSaveEdit: (text: string) => Promise<void>;
  onSend: (text: string, options: SendOptions) => Promise<void>;
  /** Pfeil nach oben im leeren Feld: die eigene letzte bearbeiten. */
  onEditLast?: () => void;
  onScheduled?: () => void;
  /** Über dem Feld — der Name, unter dem ein Mensch mit Link schreibt; die geplanten. */
  before?: ReactNode;
  /** Links neben dem Feld — als wen (Telegram: „Wyślij jako"). */
  sendAs?: ReactNode;
  /** Gesendet werden kann gerade nicht — und das ist der Grund. */
  blocked?: string | null;
}>(function Composer({ endpoint, readOnly = null, placeholder = 'Wiadomość', reply, onClearReply, editing, onCancelEdit, onSaveEdit, onSend, onEditLast, onScheduled, before, sendAs, blocked = null }, ref) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<readonly File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pop, setPop] = useState<{ kind: 'attach' | 'emoji' | 'send'; rect: DOMRect; from: Element } | null>(null);
  const [planning, setPlanning] = useState(false);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const picker = useRef<HTMLInputElement | null>(null);
  const shrinkNext = useRef(true);
  const draft = useRef('');
  const wasEditing = useRef<string | null>(null);
  const lastTyping = useRef(0);
  const hold = useRef<number | undefined>(undefined);
  const held = useRef(false);

  /* Wie viele Fotos gerade verkleinert werden — so lange wartet „Wyślij". */
  const [preparing, setPreparing] = useState(0);

  /* Was schon hochgeladen ist: scheitert die Nachricht danach, lädt ein zweiter Versuch es nicht noch einmal hoch. */
  const uploaded = useRef(new WeakMap<File, Attachment>());

  /**
   * Dateien ins Feld. `shrink`: Fotos so, wie sie in eine Rozmowa gehören
   * (`photoForChat`) — aus „Zdjęcia i filmy", der Kamera, dem Einfügen und
   * dem Hineinziehen. Über „Plik" kommt das Original.
   */
  const addFiles = useCallback((more: readonly File[], shrink = true) => {
    if (more.length === 0) return;
    if (!shrink) { setFiles((was) => [...was, ...more].slice(0, 8)); return; }
    setPreparing((n) => n + 1);
    void Promise.all(more.map((one) => photoForChat(one).catch(() => one)))
      .then((ready) => setFiles((was) => [...was, ...ready].slice(0, 8)))
      .finally(() => setPreparing((n) => n - 1));
  }, []);
  useEffect(() => { if (files.length >= 8) setNotice('Najwyżej 8 plików w jednej wiadomości.'); }, [files.length]);

  const recorder = useRecorder((file) => addFiles([file]));
  useImperativeHandle(ref, () => ({ addFiles, focus: () => area.current?.focus() }), [addFiles]);

  /* Bearbeiten: der Text der Nachricht ins Feld, der Entwurf beiseite — und danach zurück. */
  const editingId = editing?.id ?? null;
  const editingText = editing?.text ?? '';
  useEffect(() => {
    if (editingId !== null && wasEditing.current === null) draft.current = area.current?.value ?? '';
    if (editingId !== null) {
      setText(editingText);
      window.requestAnimationFrame(() => {
        const el = area.current;
        if (el !== null) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
    } else if (wasEditing.current !== null) {
      setText(draft.current);
    }
    wasEditing.current = editingId;
  }, [editingId, editingText]);

  const replyId = reply?.id ?? null;
  useEffect(() => { if (replyId !== null) area.current?.focus(); }, [replyId]);

  useEffect(() => {
    if (notice === null) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* Das Feld wächst mit dem Text — bis zu einer Höhe, dann rollt es. */
  useLayoutEffect(() => {
    const el = area.current;
    if (el === null) return;
    /* Leer: eine Zeile — ein langer Platzhalter („Wiadomość jako …") soll das Feld nicht aufblähen. */
    if (text === '') { el.style.height = ''; return; }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const typing = () => {
    if (Date.now() - lastTyping.current < 4000) return;
    lastTyping.current = Date.now();
    void call(`${endpoint}/typing`, { method: 'POST' }).catch(() => undefined);
  };

  const deliver = async (body: string, list: readonly File[], sendAt?: string): Promise<boolean> => {
    setBusy('Wysyłanie…');
    setFailed(null);
    try {
      const attachments: Attachment[] = [];
      for (const [i, file] of list.entries()) {
        const done = uploaded.current.get(file);
        if (done !== undefined) { attachments.push(done); continue; }
        const which = list.length > 1 ? `pliku ${i + 1} z ${list.length}` : 'pliku';
        setBusy(`Szyfrowanie ${which}…`);
        const one = await uploadAttachment(endpoint, file, (part) => setBusy(`Wysyłanie ${which} · ${Math.min(99, Math.round(part * 100))}%`));
        uploaded.current.set(file, one);
        attachments.push(one);
      }
      setBusy('Wysyłanie…');
      await onSend(body, {
        attachments,
        ...(reply !== null ? { replyTo: reply.id, replyText: (reply.text || 'Załącznik').slice(0, 500) } : {}),
        ...(sendAt !== undefined ? { sendAt } : {})
      });
      onClearReply();
      if (sendAt !== undefined) { setNotice(`Zaplanowano na ${whenLong(sendAt)}.`); onScheduled?.(); }
      return true;
    } catch (e) {
      setFailed(failure(e, 'Nie udało się wysłać.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const send = async (sendAt?: string) => {
    if (busy !== null) return;
    const body = text.trim();
    if (editing !== null) {
      if (body === '') return;
      if (body === editing.text.trim()) { onCancelEdit(); return; }
      setBusy('Zapisywanie…');
      setFailed(null);
      try { await onSaveEdit(body); } catch (e) { setFailed(failure(e, 'Nie udało się zapisać.')); } finally { setBusy(null); }
      return;
    }
    if (blocked !== null) { setFailed(blocked); return; }
    if (preparing > 0) return;
    if (body === '' && files.length === 0) return;
    if (await deliver(body, files, sendAt)) { setText(''); setFiles([]); }
  };

  const sendVoice = async () => {
    const file = await recorder.send();
    if (file === null) return;
    if (blocked !== null) { addFiles([file]); setFailed(blocked); return; }
    await deliver('', [file]);
  };

  /*
   * DIE AUSWAHL ÖFFNEN. Das Feld ist nicht `display: none`, sondern nur
   * unsichtbar, und es bekommt den Fokus, bevor es sich öffnet: sonst gäbe das
   * schliessende Menü den Fokus an das Textfeld zurück — und auf dem Telefon
   * spränge die Tastatur über (oder vor) die Auswahl der Fotos.
   */
  const choose = (accept: string, how: { shrink: boolean; camera?: boolean }) => {
    const input = picker.current;
    if (input === null) return;
    shrinkNext.current = how.shrink;
    input.accept = accept;
    input.multiple = how.camera !== true;
    if (how.camera === true) input.setAttribute('capture', 'environment'); else input.removeAttribute('capture');
    input.focus({ preventScroll: true });
    input.click();
  };

  const insert = (emoji: string) => {
    const el = area.current;
    const from = el?.selectionStart ?? text.length;
    const to = el?.selectionEnd ?? text.length;
    setText(text.slice(0, from) + emoji + text.slice(to));
    window.requestAnimationFrame(() => {
      if (el === null) return;
      el.focus();
      el.setSelectionRange(from + emoji.length, from + emoji.length);
    });
  };

  const toggle = (kind: 'attach' | 'emoji' | 'send', el: Element) =>
    setPop((was) => (was?.kind === kind ? null : { kind, rect: el.getBoundingClientRect(), from: el }));

  if (readOnly !== null) {
    return <div className="ch-compose is-readonly"><Icon name="lock" /><span>{readOnly}</span></div>;
  }

  const content = text.trim() !== '' || files.length > 0 || preparing > 0;
  const line = failed ?? recorder.failed ?? busy ?? (preparing > 0 ? 'Przygotowywanie zdjęć…' : null) ?? notice;

  return (
    <form className="ch-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      {before}

      {(reply !== null || editing !== null) && (
        <div className="ch-context">
          <Icon name={editing !== null ? 'edit' : 'reply'} />
          <span className="ch-context-text" style={reply !== null && editing === null ? { '--ch-h': hueOf(reply.author) } as CSSProperties : undefined}>
            <strong>{editing !== null ? 'Edycja wiadomości' : `Odpowiedź: ${reply!.author}`}</strong>
            <span>{(editing !== null ? editing.text : reply!.text) || 'Załącznik'}</span>
          </span>
          <button type="button" className="ch-icon-btn is-small" aria-label={editing !== null ? 'Anuluj edycję' : 'Anuluj odpowiedź'}
            onClick={editing !== null ? onCancelEdit : onClearReply}>
            <Icon name="x" />
          </button>
        </div>
      )}

      {files.length > 0 && editing === null && (
        <div className="ch-files">
          {files.map((file, i) => (
            <FileChip key={`${file.name}-${i}`} file={file} busy={busy !== null} onRemove={() => setFiles((was) => was.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}

      {recorder.state !== 'idle' ? (
        <div className="ch-rec">
          <button type="button" className="ch-icon-btn" aria-label="Odrzuć nagranie" title="Odrzuć" onClick={recorder.cancel}><Icon name="trash" /></button>
          <span className="ch-rec-dot" aria-hidden="true" />
          <span className="ch-rec-time" role="timer" aria-live="off">{mmss(recorder.seconds)}</span>
          <span className="ch-rec-hint">{recorder.state === 'asking' ? 'Otwieranie mikrofonu…' : 'Nagrywanie · najwyżej 5 minut'}</span>
          <button type="button" className="ch-send" aria-label="Wyślij nagranie" title="Wyślij" disabled={recorder.state !== 'recording' || busy !== null}
            onClick={() => void sendVoice()}>
            <Icon name="send" />
          </button>
        </div>
      ) : (
        <div className="ch-compose-row">
          {sendAs}
          <div className="ch-field">
            <button type="button" className="ch-icon-btn" aria-label="Wstaw emoji" title="Emoji" aria-haspopup="menu"
              onClick={(e) => toggle('emoji', e.currentTarget)}>
              <Icon name="smile" />
            </button>
            <textarea
              ref={area}
              value={text}
              rows={1}
              placeholder={placeholder}
              aria-label="Wiadomość"
              onChange={(e) => { setText(e.target.value); if (editing === null) typing(); }}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files);
                if (pasted.length === 0 || editing !== null) return;
                if (e.clipboardData.getData('text') === '') e.preventDefault();
                addFiles(pasted);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !coarsePointer() && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                  return;
                }
                if (e.key === 'Escape' && (editing !== null || reply !== null)) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (editing !== null) onCancelEdit(); else onClearReply();
                  return;
                }
                if (e.key === 'ArrowUp' && text === '' && editing === null && onEditLast !== undefined) {
                  e.preventDefault();
                  onEditLast();
                }
              }}
            />
            {editing === null && (
              <button type="button" className="ch-icon-btn" aria-label="Dołącz plik" title="Dołącz" aria-haspopup="menu" disabled={busy !== null}
                onClick={(e) => toggle('attach', e.currentTarget)}>
                <Icon name="clip" />
              </button>
            )}
          </div>
          {content || editing !== null || !recorder.supported ? (
            <button
              type="submit"
              className="ch-send"
              aria-label={editing !== null ? 'Zapisz zmianę' : 'Wyślij'}
              title={editing !== null ? 'Zapisz' : 'Wyślij · prawy przycisk albo przytrzymanie: zaplanuj'}
              disabled={busy !== null || preparing > 0 || (!content && editing === null)}
              onContextMenu={(e) => { if (editing !== null) return; e.preventDefault(); toggle('send', e.currentTarget); }}
              onPointerDown={(e) => {
                if (e.pointerType !== 'touch' || editing !== null) return;
                held.current = false;
                const el = e.currentTarget;
                hold.current = window.setTimeout(() => { held.current = true; toggle('send', el); }, 500);
              }}
              onPointerUp={() => window.clearTimeout(hold.current)}
              onPointerLeave={() => window.clearTimeout(hold.current)}
              onPointerCancel={() => window.clearTimeout(hold.current)}
              onClick={(e) => { if (held.current) { e.preventDefault(); held.current = false; } }}
            >
              <Icon name={editing !== null ? 'check' : 'send'} />
            </button>
          ) : (
            <button type="button" className="ch-send" aria-label="Nagraj wiadomość głosową" title="Nagraj wiadomość głosową"
              disabled={busy !== null || files.length >= 8} onClick={() => void recorder.start()}>
              <Icon name="mic" />
            </button>
          )}
        </div>
      )}

      <input ref={picker} type="file" multiple className="ch-picker" tabIndex={-1} aria-label="Wybierz pliki"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? []), shrinkNext.current); e.target.value = ''; }} />

      {line !== null && (
        <p className={cls('ch-compose-line', (failed !== null || recorder.failed !== null) && 'is-error')} role={failed !== null ? 'alert' : 'status'}>{line}</p>
      )}

      {pop?.kind === 'attach' && (
        <PopMenu anchor={{ rect: pop.rect, above: true }} from={pop.from} label="Dołącz" onClose={() => setPop(null)} items={[
          ...(coarsePointer() ? [{ label: 'Zrób zdjęcie', icon: 'camera' as const, onSelect: () => choose('image/*', { shrink: true, camera: true }) }] : []),
          { label: 'Zdjęcia i filmy', icon: 'image', onSelect: () => choose('image/*,video/*', { shrink: true }) },
          { label: 'Plik — bez zmniejszania', icon: 'file', onSelect: () => choose('', { shrink: false }) },
          { label: 'Muzyka i nagrania', icon: 'music', onSelect: () => choose('audio/*', { shrink: false }) }
        ]} />
      )}
      {pop?.kind === 'send' && (
        <PopMenu anchor={{ rect: pop.rect, above: true }} from={pop.from} label="Wysyłanie" onClose={() => setPop(null)} items={[
          { label: 'Zaplanuj wysłanie…', icon: 'clock', onSelect: () => setPlanning(true) }
        ]} />
      )}
      {pop?.kind === 'emoji' && (
        <PopMenu anchor={{ rect: pop.rect, above: true }} from={pop.from} label="Emoji" kind="emoji" onClose={() => setPop(null)}>
          <div className="ch-emoji-grid">
            {EMOJI.map((emoji) => (
              <button key={emoji} type="button" role="menuitem" aria-label={emoji} onClick={() => insert(emoji)}>{emoji}</button>
            ))}
          </div>
        </PopMenu>
      )}
      {planning && <PlanDialog onClose={() => setPlanning(false)} onPlan={(iso) => void send(iso)} />}
    </form>
  );
});

/**
 * ALS WEN ICH SCHREIBE — links neben dem Feld, wie „Wyślij jako" in Telegram.
 * Nur wenn es mehr als eine Wahl gibt; der Name steht dann auch im Feld
 * („Wiadomość jako …"), damit niemand als „Rada" schreibt und es erst an der
 * Antwort merkt.
 */
export function SendAs({ speakers, speaker, nameOf, onPick }: {
  speakers: readonly string[];
  speaker: string;
  nameOf: (id: string) => string;
  onPick: (id: string) => void;
}) {
  const menu = useButtonMenu();
  return (
    <>
      <button type="button" className="ch-sendas" aria-label={`Piszesz jako ${nameOf(speaker)} — zmień`} title={`Piszesz jako ${nameOf(speaker)}`}
        aria-haspopup="menu" aria-expanded={menu.open !== null} onClick={(e) => menu.toggle(e.currentTarget)}>
        <Avatar seed={speaker} name={nameOf(speaker)} size="sm" />
      </button>
      {menu.open !== null && (
        <PopMenu anchor={{ rect: menu.open.rect, above: true }} from={menu.open.from} label="Piszesz jako" onClose={menu.close}
          items={speakers.map((id) => ({ label: nameOf(id), checked: id === speaker, onSelect: () => onPick(id) }))}>
          <p className="ch-pop-head">Piszesz jako</p>
        </PopMenu>
      )}
    </>
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
