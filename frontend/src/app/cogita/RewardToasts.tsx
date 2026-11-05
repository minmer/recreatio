/**
 * 2026-11-05 (Prompt 17) — MELDUNGEN AM RAND: ein Bonus („Cel dnia osiągnięty! +50"), ein Abzeichen (das Zeichen springt
 * auf, Name und Grund; antippen öffnet „Odznaki i poziomy"), eine neue Stufe (der Balken läuft voll, die Krone wächst und
 * glänzt, „Poziom 5: Mistrz" — der grösste Moment, etwa 2 s), ein Tag der Serie, ein erobertes Gebiet.
 *
 * <b>Eine nach der anderen</b>: höchstens eine steht, je 3–4 s; was zugleich kommt, wird zusammengefasst („+3 odznaki").
 * Jede Meldung genau einmal (feste Kennung — auch wenn mehrere Tafeln auf der Seite dasselbe Ereignis sehen). Sie stehen
 * oben am Rand, nie über der Frage; ein Klick oder Esc schliesst. Ein eigener kleiner Baum am Ende von <body> — jede Tafel
 * kann melden, ohne dass es einen Ort im Baum dafür geben muss.
 */

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';

import type { BadgeIcon } from './rewards';
import { RewardIcon } from './RewardViews';
import { motionLevel } from '../ui/motion';

export interface RewardToast {
  /** Fest (aus dem Ereignis): dieselbe Meldung kommt nie zweimal. */
  readonly id: string;
  readonly kind: 'bonus' | 'goal' | 'badge' | 'badges' | 'level' | 'streak' | 'region';
  readonly title: string;
  readonly line?: string;
  readonly icon?: BadgeIcon;
  readonly points?: number;
  /** Eine neue Stufe: von wo der Balken voll läuft (0–1). */
  readonly level?: { readonly from: number };
  /** Antippen: dorthin (die Seite der Abzeichen). */
  readonly open?: () => void;
  readonly openLabel?: string;
}

const seen = new Set<string>();
const queue: RewardToast[] = [];
let current: RewardToast | null = null;
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const emit = () => { version += 1; for (const f of listeners) f(); };

function showNext(): void {
  current = queue.shift() ?? null;
  emit();
  if (current === null) return;
  if (timer !== null) clearTimeout(timer);
  const ms = current.kind === 'level' ? 2600 : 3600;
  timer = setTimeout(dismissToast, motionLevel() === 'off' ? ms + 600 : ms);
}

/** Die stehende Meldung schliessen (die nächste kommt kurz danach). */
export function dismissToast(): void {
  if (timer !== null) { clearTimeout(timer); timer = null; }
  if (current === null) return;
  current = null;
  emit();
  if (queue.length > 0) setTimeout(showNext, 180);
}

/**
 * Meldungen anmelden. Schon gezeigte (dieselbe Kennung) fallen weg; drei Abzeichen und mehr auf einmal werden eine Meldung.
 * Die Reihenfolge: Gebiet, Bonus/Ziel, Serie, Abzeichen, Stufe (der grösste Moment zuletzt).
 */
export function pushToasts(list: readonly RewardToast[]): void {
  const fresh = list.filter((t) => !seen.has(t.id));
  if (fresh.length === 0) return;
  for (const t of fresh) seen.add(t.id);
  const badges = fresh.filter((t) => t.kind === 'badge');
  const rest = fresh.filter((t) => t.kind !== 'badge');
  const merged: RewardToast[] = badges.length >= 3
    ? [{ id: `badges:${badges.map((b) => b.id).join('+')}`, kind: 'badges', title: `+${badges.length}`, line: badges.map((b) => b.title).join(' · '), icon: badges[0]!.icon ?? 'medal', ...(badges[0]!.open === undefined ? {} : { open: badges[0]!.open, openLabel: badges[0]!.openLabel }) }]
    : badges;
  const rank: Readonly<Record<RewardToast['kind'], number>> = { region: 0, bonus: 1, goal: 1, streak: 2, badge: 3, badges: 3, level: 4 };
  queue.push(...[...rest, ...merged].sort((a, b) => rank[a.kind] - rank[b.kind]));
  ensureHost();
  if (current === null) showNext();
}

/** Für Prüfungen: was gerade steht und wartet. */
export function toastState(): { readonly current: RewardToast | null; readonly waiting: number } {
  return { current, waiting: queue.length };
}

/* -- Der Ort am Rand ---------------------------------------------------------------------------------------------------- */

let hosted = false;
function ensureHost(): void {
  if (hosted || typeof document === 'undefined') return;
  hosted = true;
  const el = document.createElement('div');
  el.className = 'cg-rw-toast-host';
  document.body.appendChild(el);
  createRoot(el).render(<ToastHost />);
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

function ToastHost() {
  useSyncExternalStore(subscribe, () => version, () => version);
  const t = current;
  useEffect(() => {
    if (t === null) return undefined;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissToast(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [t]);
  return (
    <div className="cg-rw-toasts" role="status" aria-live="polite" data-rw-toasts={t === null ? 0 : 1}>
      {t !== null && <ToastCard key={t.id} toast={t} />}
    </div>
  );
}

function ToastCard({ toast }: { toast: RewardToast }) {
  const bar = useRef<HTMLSpanElement>(null);
  /* Die Stufe: der Balken beginnt, wo er stand, und läuft voll (CSS-Variable vor dem Zeichnen). */
  useLayoutEffect(() => { bar.current?.style.setProperty('--cg-rw-from', `${Math.round(Math.max(0, Math.min(1, toast.level?.from ?? 0)) * 100)}%`); }, [toast]);
  const icon: BadgeIcon = toast.icon ?? (toast.kind === 'level' ? 'crown' : toast.kind === 'streak' ? 'flame' : toast.kind === 'goal' || toast.kind === 'bonus' ? 'target' : toast.kind === 'region' ? 'star' : 'medal');
  const activate = () => { toast.open?.(); dismissToast(); };
  return (
    <button type="button" className={`cg-rw-toast is-${toast.kind}`} onClick={activate} data-rw-toast={toast.kind} data-rw-toast-id={toast.id}
      aria-label={`${toast.title}${toast.line === undefined ? '' : ` — ${toast.line}`}${toast.open !== undefined && toast.openLabel !== undefined ? ` (${toast.openLabel})` : ''}`}>
      <span className="cg-rw-toast-icon" aria-hidden><RewardIcon name={icon} /></span>
      <span className="cg-rw-toast-body">
        <strong>{toast.title}{toast.points !== undefined && toast.points > 0 ? <span className="cg-rw-toast-pts"> +{toast.points}</span> : null}</strong>
        {toast.line !== undefined && <span className="cg-rw-toast-line">{toast.line}</span>}
        {toast.kind === 'level' && <span ref={bar} className="cg-rw-toast-bar" aria-hidden><span /></span>}
        {toast.open !== undefined && toast.openLabel !== undefined && <span className="cg-rw-toast-open">{toast.openLabel} ›</span>}
      </span>
    </button>
  );
}
