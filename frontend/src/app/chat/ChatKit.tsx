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

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { authorOf as roleOrSeatOf, type Opened, type SealedMessage } from './chat';
import { ICON_PATHS, type IconName } from '../ui/icons';

/*
 * 0095 — WER SPRICHT, für die Gruppen im Verlauf, die Farbe und das Bild: die
 * PERSON, nicht nur die Rolle — zwei Menschen, die beide durch „Rada" schreiben,
 * sind zwei Absender.
 */
export const authorOf = (message: SealedMessage): string =>
  message.authorPersonId != null && message.authorPersonId !== message.authorRoleId
    ? `${roleOrSeatOf(message)}|${message.authorPersonId}`
    : roleOrSeatOf(message);

export interface Shown {
  readonly message: SealedMessage;
  readonly opened: Opened | null;
}

export const cls = (...parts: readonly (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
export const failure = (e: unknown, fallback: string) => (e instanceof Error && e.message !== '' ? e.message : fallback);

/* -- Zeichen ------------------------------------------------------------------ */

/* Strichzeichnungen im Raster 24 × 24 (nach Feather/Lucide) — die eine Sammlung der Anwendung (ui/icons.tsx). */
const PATHS = ICON_PATHS;

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

export const clock = (at: string) => new Date(at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
export const full = (at: string) => new Date(at).toLocaleString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const dayKey = (at: string) => new Date(at).toDateString();
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

export const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

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
      {menu.length > 0 && <button
        type="button"
        className="ch-icon-btn"
        aria-label="Więcej opcji rozmowy"
        title="Więcej"
        aria-haspopup="menu"
        aria-expanded={more.open !== null}
        onClick={(e) => more.toggle(e.currentTarget)}
      >
        <Icon name="more" />
      </button>}
      {more.open !== null && (
        <PopMenu anchor={{ rect: more.open.rect }} from={more.open.from} label="Opcje rozmowy" items={menu} onClose={more.close} />
      )}
    </header>
  );
}

export const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
