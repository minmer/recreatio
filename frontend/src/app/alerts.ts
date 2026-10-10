/**
 * CZEKA NA CIEBIE (0094) — die Liste der Dinge, die sich melden können, und
 * in welcher Reihenfolge sie dastehen.
 *
 * <b>Jeder ordnet selbst.</b> Für die Kanzlei sind neue Zgłoszenia das Erste,
 * für einen Katecheten die Rozmowy, für den Hausverwalter die Reservierungen.
 * Die Arten stehen in einer Liste; jede lässt sich ein- und ausschalten und
 * nach oben oder unten schieben (`moveAlert`, `toggleAlert`). Gemerkt wird
 * das für das Konto (versiegelt, `prefs.ts`) — die Glocke und der Teil
 * „Czeka na Ciebie" auf der Seite des Warsztat folgen derselben Ordnung.
 *
 * <b>Woher die Zahlen kommen</b>: aus der einen Frage der Glocke
 * (`/workspace/notifications`, `notify.ts`) — Zgłoszenia, Rozmowy, Links,
 * Aufgaben, und seit 0094 Reservierungen, die auf ein Ja warten, und Schritte
 * der Kanzlei nach ihrer Frist. Die Termine von heute kommen aus dem eigenen
 * Kalender (der Teil lädt sie, die Glocke nicht).
 *
 * <b>Ein Widok obszaru</b> zeigt nur, was zu seinen Bereichen gehört
 * (`scope`); was keinem Bereich gehört (Links, die Summe der Aufgaben), steht
 * nur im Widok ohne Bereich.
 */

import type { Digest } from './notify';
import { chatLabel } from './notify';
import { useRemembered } from './prefs';
import { viewPath } from './routes';

export type AlertKind = 'forms' | 'chats' | 'bookings' | 'steps' | 'tasks' | 'today' | 'links';

export interface AlertKindDef {
  readonly kind: AlertKind;
  readonly label: string;
  readonly says: string;
  /** Zählt sie in der Zahl an der Glocke? (Termine von heute sind nichts Neues.) */
  readonly counts: boolean;
}

export const ALERT_KINDS: readonly AlertKindDef[] = [
  { kind: 'forms', label: 'Nowe zgłoszenia', says: 'Ktoś wysłał formularz — do przejrzenia.', counts: true },
  { kind: 'chats', label: 'Nieprzeczytane wiadomości', says: 'Rozmowy, w których ktoś napisał.', counts: true },
  { kind: 'bookings', label: 'Rezerwacje do potwierdzenia', says: 'Ktoś prosi o termin albo miejsce i czeka na Twoje „tak".', counts: true },
  { kind: 'steps', label: 'Kroki po terminie', says: 'Rzeczy do odhaczenia przez kancelarię, których termin minął (np. zgoda na papierze).', counts: true },
  { kind: 'tasks', label: 'Zadania na teraz', says: 'Zadania otwarte teraz albo zaległe.', counts: false },
  { kind: 'today', label: 'Terminy dziś', says: 'Spotkania i msze, które są dzisiaj.', counts: false },
  { kind: 'links', label: 'Dołączenia przez link', says: 'Ktoś dołączył przez Twój link.', counts: true }
];

const KNOWN = new Set<string>(ALERT_KINDS.map((one) => one.kind));

export interface AlertSettings {
  /** Alle Arten, in der gewünschten Reihenfolge. */
  readonly order: readonly AlertKind[];
  /** Was ausgeschaltet ist. */
  readonly off: readonly AlertKind[];
}

export const DEFAULT_ALERTS: AlertSettings = { order: ALERT_KINDS.map((one) => one.kind), off: [] };

/**
 * Duldsam gelesen: Unbekanntes fällt weg, Doppeltes zählt einmal, und eine
 * Art, die es damals noch nicht gab, kommt an ihrer Stelle der Vorgabe dazu
 * (hinter die, die vor ihr steht).
 */
export function readAlerts(text: string | null | undefined): AlertSettings {
  let raw: { order?: unknown; off?: unknown } = {};
  try { raw = JSON.parse(text ?? '') as typeof raw; } catch { return DEFAULT_ALERTS; }
  const list = (value: unknown): AlertKind[] => (Array.isArray(value) ? value : [])
    .filter((one): one is AlertKind => typeof one === 'string' && KNOWN.has(one))
    .filter((one, i, all) => all.indexOf(one) === i);

  const order = list(raw.order);
  for (const [i, kind] of DEFAULT_ALERTS.order.entries()) {
    if (order.includes(kind)) continue;
    const before = DEFAULT_ALERTS.order.slice(0, i).reverse().find((one) => order.includes(one));
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, kind);
  }
  return { order, off: list(raw.off) };
}

export const alertsJson = (settings: AlertSettings): string => JSON.stringify({ order: settings.order, off: settings.off });

/** Eine Art eine Stelle nach oben (-1) oder unten (+1). Am Rand bleibt sie, wo sie ist. */
export function moveAlert(settings: AlertSettings, kind: AlertKind, by: -1 | 1): AlertSettings {
  const order = [...settings.order];
  const at = order.indexOf(kind);
  const to = at + by;
  if (at < 0 || to < 0 || to >= order.length) return settings;
  [order[at], order[to]] = [order[to], order[at]];
  return { ...settings, order };
}

export const toggleAlert = (settings: AlertSettings, kind: AlertKind, on: boolean): AlertSettings => ({
  ...settings,
  off: on ? settings.off.filter((one) => one !== kind) : [...new Set([...settings.off, kind])]
});

/** Die eingeschalteten Arten, in ihrer Reihenfolge. */
export const shownKinds = (settings: AlertSettings): AlertKind[] => settings.order.filter((one) => !settings.off.includes(one));

/* -- Die Einträge ----------------------------------------------------------------------------------- */

export interface AlertItem {
  readonly kind: AlertKind;
  readonly key: string;
  readonly label: string;
  /** Wie viel — oder `null` (ein Termin). */
  readonly count: number | null;
  /** Wie die Zahl heisst: „3 nowe", „2 wiadomości", „18:00". */
  readonly detail: string;
  readonly href: string;
  /** Lässt sich als gesehen abhaken (✓): ein Formular, die Links. */
  readonly seen?: { readonly form: string } | { readonly links: true };
}

/** Ein Termin von heute, schon geöffnet (der Titel). */
export interface TodayItem {
  readonly key: string;
  readonly title: string;
  readonly at: string;
  readonly areaId: string;
  readonly href: string;
}

const plural = (n: number, one: string, few: string, many: string): string => {
  const tens = n % 100;
  const last = n % 10;
  return n === 1 ? one : last >= 2 && last <= 4 && (tens < 12 || tens > 14) ? few : many;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/**
 * WAS JETZT DASTEHT — in der Reihenfolge der Einstellung, je Art das Dringendste
 * zuerst. `scope`: nur, was zu diesen Bereichen gehört (`null`: alles).
 */
export function alertItems(
  digest: Digest | null, today: readonly TodayItem[] | null, settings: AlertSettings, scope: ReadonlySet<string> | null
): AlertItem[] {
  const inScope = (areaId: string | null | undefined) => scope === null || (areaId != null && scope.has(areaId));
  const out: AlertItem[] = [];

  for (const kind of shownKinds(settings)) {
    if (kind === 'forms') {
      for (const f of digest?.registrations.list ?? []) {
        if (!inScope(f.areaId)) continue;
        out.push({ kind, key: `f${f.moduleId}`, label: f.name, count: f.count, detail: `${f.count} ${plural(f.count, 'nowe', 'nowe', 'nowych')}`, href: viewPath('modules', 'form', f.moduleId), seen: { form: f.moduleId } });
      }
    } else if (kind === 'chats') {
      for (const c of (digest?.chats.list ?? []).filter((one) => one.unread > 0)) {
        if (!inScope(c.areaId)) continue;
        out.push({ kind, key: `c${c.chatId}`, label: c.quiet ? `${chatLabel(c)} (wyciszona)` : chatLabel(c), count: c.unread, detail: `${c.unread} ${plural(c.unread, 'wiadomość', 'wiadomości', 'wiadomości')}`, href: viewPath('chat', c.chatId) });
      }
    } else if (kind === 'bookings') {
      for (const b of digest?.bookings?.list ?? []) {
        if (!inScope(b.areaId)) continue;
        out.push({ kind, key: `b${b.resourceId ?? b.name}`, label: b.name, count: b.count, detail: `${b.count} do potwierdzenia`, href: b.resourceId === undefined ? viewPath('bookings') : viewPath('bookings', b.resourceId) });
      }
    } else if (kind === 'steps') {
      for (const s of digest?.steps?.list ?? []) {
        if (!inScope(s.areaId)) continue;
        out.push({ kind, key: `s${s.moduleId ?? s.name}`, label: s.name, count: s.count, detail: `${s.count} ${plural(s.count, 'krok', 'kroki', 'kroków')} po terminie`, href: s.moduleId === undefined ? viewPath('modules') : viewPath('modules', 'form', s.moduleId) });
      }
    } else if (kind === 'tasks') {
      if (scope === null && (digest?.tasks ?? 0) > 0) {
        out.push({ kind, key: 'tasks', label: 'Do zrobienia teraz', count: digest!.tasks, detail: `${digest!.tasks} ${plural(digest!.tasks, 'zadanie', 'zadania', 'zadań')}`, href: viewPath('tasks') });
      }
    } else if (kind === 'today') {
      for (const t of today ?? []) {
        if (!inScope(t.areaId)) continue;
        out.push({ kind, key: `t${t.key}`, label: t.title, count: null, detail: time(t.at), href: t.href });
      }
    } else if (kind === 'links') {
      if (scope === null && (digest?.links ?? 0) > 0) {
        out.push({ kind, key: 'links', label: 'Dołączyli przez link', count: digest!.links, detail: `${digest!.links}`, href: viewPath('areas'), seen: { links: true } });
      }
    }
  }
  return out;
}

/** Die Zahl an der Glocke: was neu ist, nur eingeschaltete Arten. */
export function alertCount(digest: Digest | null, settings: AlertSettings): number {
  if (digest === null) return 0;
  const on = new Set(shownKinds(settings));
  const counted = (kind: AlertKind) => on.has(kind) && ALERT_KINDS.find((one) => one.kind === kind)!.counts;
  return (counted('chats') ? digest.chats.unread : 0)
    + (counted('forms') ? digest.registrations.count : 0)
    + (counted('links') ? digest.links : 0)
    + (counted('bookings') ? digest.bookings?.count ?? 0 : 0)
    + (counted('steps') ? digest.steps?.count ?? 0 : 0);
}

export const alertLabel = (kind: AlertKind): string => ALERT_KINDS.find((one) => one.kind === kind)?.label ?? kind;

/** Die Einstellung dieses Kontos — und wie man sie ändert (gemerkt versiegelt, `prefs.ts`). */
export function useAlertSettings(): [AlertSettings, (next: AlertSettings) => void] {
  const [text, setText] = useRemembered('alerts', '');
  return [readAlerts(text), (next) => setText(alertsJson(next))];
}
