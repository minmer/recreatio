/**
 * POWIADOMIENIA (0067) — was neu ist, für die ganze App, ohne den Akku
 * leerzusaugen.
 *
 * <b>Eine Frage für alles.</b> `/workspace/notifications` liefert in einem
 * Rutsch die Zahlen: ungelesene Nachrichten, neue Anmeldungen, eingelöste
 * Links, offene Aufgaben. Keine Inhalte — die liegen versiegelt.
 *
 * <b>Wie oft gefragt wird</b> (das Wichtigste an dieser Datei):
 *
 * <code>
 *   sichtbar                 alle 60 s (der Dienst darf auf 120 s strecken, wenn nichts offen ist)
 *   im Hintergrund           alle 5 min (der Browser drosselt ohnehin)
 *   Akku unter 20 %, ohne Strom   dreimal so selten
 *   ohne Netz                gar nicht — es geht weiter, sobald es wieder da ist
 *   nach einem Fehler        doppelt so lange, bis höchstens 15 min
 *   zurück in den Vordergrund  sofort, wenn die letzte Frage älter als 30 s ist
 * </code>
 *
 * <b>Mehrere Tabs fragen nicht mehrfach</b>: wer gefragt hat, sagt es den
 * anderen (BroadcastChannel), und die stellen ihre Uhr zurück.
 *
 * <b>Die App geschlossen</b>: dort fragt der Arbeiter des Systems
 * (`platform.background`, höchstens alle 15 min, nur mit Netz und genug Akku),
 * und Erinnerungen an Aufgaben liegen im Wecker des Systems (`notices.plan`).
 */

import { API, call } from './session';
import { background, notices } from './platform';
import { viewPath } from './routes';
import { toBase64Url } from './crypto';

export interface DigestChat {
  readonly chatId: string;
  readonly areaName: string;
  readonly kind: string;
  readonly unread: number;
  readonly lastMessageAt: string | null;
  readonly seatName: string | null;
  readonly quiet: boolean;
}

export interface DigestForm {
  readonly moduleId: string;
  readonly name: string;
  readonly count: number;
  readonly lastAt: string;
}

export interface Digest {
  readonly now: string;
  readonly since: string;
  readonly total: number;
  readonly chats: { readonly unread: number; readonly loud: number; readonly list: readonly DigestChat[] };
  readonly registrations: { readonly count: number; readonly list: readonly DigestForm[] };
  readonly links: number;
  readonly tasks: number;
  readonly nextPollSeconds: number;
}

/* -- Einstellungen (je Gerät) ------------------------------------------------ */

export interface NotifySettings {
  /** Was sich auf dem Gerät melden darf (in der Glocke steht immer alles). */
  readonly chats: boolean;
  readonly forms: boolean;
  readonly links: boolean;
  /** Erinnerungen an Aufgaben (am Anfang/in der Mitte/pod koniec, wie an der Aufgabe eingestellt). */
  readonly reminders: boolean;
  /** Nur in der App: wie oft im Hintergrund nachgesehen wird (0 = nie). */
  readonly backgroundMinutes: 0 | 15 | 30 | 60 | 180;
}

export const DEFAULT_SETTINGS: NotifySettings = {
  chats: true, forms: true, links: true, reminders: true, backgroundMinutes: 30
};

const SETTINGS_SLOT = 'recreatio:notify:settings';
const SEEN_SLOT = 'recreatio:notify:seen';
const DEVICE_SLOT = 'recreatio:notify:device';

export function loadSettings(): NotifySettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_SLOT) ?? 'null') as Partial<NotifySettings> | null;
    return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: NotifySettings): void {
  try { localStorage.setItem(SETTINGS_SLOT, JSON.stringify(next)); } catch { /* privat: dann nur für diesen Tab */ }
  store.settings = next;
  emit();
}

/** Seit wann „neu" gilt — für Anmeldungen und Links; zuletzt, als die Glocke geöffnet wurde. */
function seenSince(): string {
  try {
    const raw = localStorage.getItem(SEEN_SLOT);
    if (raw !== null && !Number.isNaN(Date.parse(raw))) return raw;
  } catch { /* nichts */ }
  return new Date(Date.now() - 3 * 86400_000).toISOString();
}

/* -- Wie lange bis zur nächsten Frage ------------------------------------------ */

export interface PaceInput {
  readonly visible: boolean;
  readonly online: boolean;
  readonly lowBattery: boolean;
  readonly failures: number;
  /** Der Rat des Dienstes (60 oder 120 s). */
  readonly hint: number | null;
}

/**
 * DIE TAKTUNG — rein, damit sie sich prüfen lässt (`app-platform-check.mjs`).
 * `null`: gar nicht fragen (ohne Netz; es geht beim nächsten `online` weiter).
 */
export function nextDelay(pace: PaceInput): number | null {
  if (!pace.online) return null;
  let seconds = pace.visible ? Math.max(60, Math.min(pace.hint ?? 60, 300)) : 300;
  if (pace.lowBattery) seconds *= 3;
  if (pace.failures > 0) seconds = Math.min(900, seconds * 2 ** Math.min(pace.failures, 4));
  return Math.min(seconds, 900) * 1000;
}

/* -- Der gemeinsame Stand ------------------------------------------------------ */

interface Store {
  digest: Digest | null;
  settings: NotifySettings;
  lastAt: number;
  failures: number;
}

const store: Store = { digest: null, settings: loadSettings(), lastAt: 0, failures: 0 };
const listeners = new Set<() => void>();

/* Ein Bild je Änderung — `useSyncExternalStore` will dasselbe Objekt, solange sich nichts geändert hat. */
let snapshot: { digest: Digest | null; settings: NotifySettings } = { digest: store.digest, settings: store.settings };
const emit = () => {
  snapshot = { digest: store.digest, settings: store.settings };
  for (const fn of listeners) fn();
};

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const current = (): { digest: Digest | null; settings: NotifySettings } => snapshot;

/* -- Der Takt ------------------------------------------------------------------ */

let timer: number | null = null;
let running = false;
let lowBattery = false;
const channel: BroadcastChannel | null = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('recreatio-notify');

/** Was zuletzt gemeldet wurde — damit nur NEUES klingelt. */
let told = { loud: -1, forms: -1, links: -1 };

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

function schedule(): void {
  if (timer !== null) { window.clearTimeout(timer); timer = null; }
  if (!running) return;
  const delay = nextDelay({
    visible: visible(), online: navigator.onLine, lowBattery, failures: store.failures,
    hint: store.digest?.nextPollSeconds ?? null
  });
  if (delay === null) return;
  timer = window.setTimeout(() => void refresh(), delay);
}

/** Jetzt fragen — und danach den Takt neu stellen. */
export async function refresh(): Promise<void> {
  if (!running) return;
  try {
    const digest = await call<Digest>(`/workspace/notifications?since=${encodeURIComponent(seenSince())}`);
    store.failures = 0;
    accept(digest, true);
  } catch {
    store.failures += 1;
  } finally {
    schedule();
  }
}

function accept(digest: Digest, mine: boolean): void {
  store.digest = digest;
  store.lastAt = Date.now();
  emit();
  if (mine) {
    channel?.postMessage({ digest });
    ring(digest);
    void background.seen({ unread: digest.chats.loud, forms: digest.registrations.count, links: digest.links, since: seenSince() });
  }
}

/**
 * KLINGELN — nur bei NEUEM, nur, wenn die Seite nicht vorne ist (sonst sieht
 * man die Glocke), nur, was in den Einstellungen erlaubt ist, und nur, wenn
 * das Gerät es darf. Die Marke ersetzt die vorige Meldung derselben Art.
 */
function ring(digest: Digest): void {
  const first = told.loud < 0;
  const before = told;
  told = { loud: digest.chats.loud, forms: digest.registrations.count, links: digest.links };
  if (first || visible() || !notices.allowed()) return;

  const s = store.settings;
  if (s.chats && digest.chats.loud > before.loud) {
    const newest = [...digest.chats.list].filter((c) => !c.quiet)
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))[0];
    notices.show({
      title: digest.chats.loud === 1 ? 'Nowa wiadomość' : `Nowe wiadomości: ${digest.chats.loud}`,
      body: newest === undefined ? 'W rozmowach jest coś nowego.' : `${chatLabel(newest)}`,
      tag: newest?.chatId ?? 'chats',
      open: newest === undefined ? viewPath('chat') : viewPath('chat', newest.chatId)
    });
  }
  if (s.forms && digest.registrations.count > before.forms) {
    const form = digest.registrations.list[0];
    notices.show({
      title: digest.registrations.count === 1 ? 'Nowe zgłoszenie' : `Nowe zgłoszenia: ${digest.registrations.count}`,
      body: form === undefined ? 'Ktoś wypełnił formularz.' : form.name,
      tag: 'forms',
      open: form === undefined ? viewPath('modules') : viewPath('modules', 'form', form.moduleId)
    }, 'news');
  }
  if (s.links && digest.links > before.links) {
    notices.show({ title: 'Ktoś dołączył przez link', body: 'Zobacz linki dostępu w Obszarach.', tag: 'links', open: viewPath('areas') }, 'news');
  }
}

/** Wie eine Rozmowa in einer Meldung heisst — der Name des Bereichs, bei einem Platz die Person. */
export const chatLabel = (c: DigestChat): string =>
  c.kind === 'seat' && c.seatName !== null ? `Rozmowa z: ${c.seatName}` : c.areaName;

/** „Gesehen": was jetzt in der Glocke steht, gilt nicht mehr als neu. */
export function markSeen(): void {
  const now = store.digest?.now ?? new Date().toISOString();
  try { localStorage.setItem(SEEN_SLOT, now); } catch { /* nichts */ }
  if (store.digest !== null) {
    store.digest = { ...store.digest, registrations: { count: 0, list: [] }, links: 0, total: store.digest.chats.unread };
    emit();
  }
  told = { ...told, forms: 0, links: 0 };
}

/**
 * DEN TAKT STARTEN — einmal je Tab, solange jemand angemeldet ist. Die
 * Horcher stellen die Uhr nur um; sie fragen nie öfter, als `nextDelay` sagt.
 */
export function start(): () => void {
  if (running) return () => undefined;
  running = true;
  store.settings = loadSettings();

  const onVisible = () => {
    if (visible() && Date.now() - store.lastAt > 30_000) void refresh();
    else schedule();
  };
  const onOnline = () => void refresh();
  const onMessage = (event: MessageEvent<{ digest?: Digest }>) => {
    if (event.data?.digest !== undefined) { accept(event.data.digest, false); schedule(); }
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', schedule);
  channel?.addEventListener('message', onMessage);

  /* Der Akku, wo der Browser ihn verrät (Chrome, Android-WebView). */
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (e: string, fn: () => void) => void }> };
  void nav.getBattery?.().then((battery) => {
    const check = () => { lowBattery = battery.level < 0.2 && !battery.charging; };
    check();
    battery.addEventListener('levelchange', check);
    battery.addEventListener('chargingchange', check);
  }).catch(() => undefined);

  void refresh();

  return () => {
    running = false;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', schedule);
    channel?.removeEventListener('message', onMessage);
  };
}

/* -- Erinnerungen an Aufgaben ---------------------------------------------------- */

export interface Reminder {
  readonly taskId: string;
  readonly occurrenceAt: string;
  readonly kind: 'start' | 'middle' | 'end';
  readonly at: Date;
  readonly title: string;
}

const REMINDER_WORD: Record<Reminder['kind'], string> = {
  start: 'Czas zacząć',
  middle: 'Połowa czasu minęła',
  end: 'Zbliża się koniec'
};

/** Die Erinnerungen in den Wecker — ersetzt, was vorher geplant war. */
export async function planReminders(list: readonly Reminder[]): Promise<void> {
  if (!store.settings.reminders) { await notices.plan([]); return; }
  await notices.plan(list.map((r) => ({
    tag: `task:${r.taskId}:${r.occurrenceAt}:${r.kind}`,
    title: r.title,
    body: REMINDER_WORD[r.kind],
    at: r.at,
    open: viewPath('tasks')
  })));
}

/* -- Das Gerät (nur in der App) ----------------------------------------------------- */

interface DeviceRow {
  readonly deviceId: string;
  readonly label: string | null;
  readonly platform: string;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
}

export const loadDevices = (): Promise<{ devices: readonly DeviceRow[] }> => call('/workspace/notify-devices');
export const dropDevice = (deviceId: string): Promise<{ revoked: boolean }> =>
  call(`/workspace/notify-devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });

/**
 * DEN ARBEITER IM HINTERGRUND einschalten (oder umstellen, oder aus). Das
 * Gerät bekommt einmal einen Zufallswert; hier liegt nur, unter welcher
 * Kennung der Dienst ihn kennt.
 */
export async function applyBackground(settings: NotifySettings): Promise<void> {
  if (!background.available) return;

  if (settings.backgroundMinutes === 0) {
    await stopBackground();
    return;
  }

  let device: { deviceId: string; token: string } | null = null;
  try { device = JSON.parse(localStorage.getItem(DEVICE_SLOT) ?? 'null'); } catch { device = null; }

  if (device === null) {
    const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const made = await call<{ deviceId: string }>('/workspace/notify-devices', {
      method: 'POST', body: JSON.stringify({ token, label: 'Telefon (aplikacja)', platform: 'android' })
    });
    device = { deviceId: made.deviceId, token };
    localStorage.setItem(DEVICE_SLOT, JSON.stringify(device));
  }

  await background.configure({
    api: API, token: device.token, intervalMinutes: Math.max(15, settings.backgroundMinutes),
    chats: settings.chats, forms: settings.forms, links: settings.links
  });
}

export async function stopBackground(): Promise<void> {
  await background.stop();
  try {
    const device = JSON.parse(localStorage.getItem(DEVICE_SLOT) ?? 'null') as { deviceId: string } | null;
    if (device !== null) await dropDevice(device.deviceId).catch(() => undefined);
    localStorage.removeItem(DEVICE_SLOT);
  } catch { /* nichts */ }
}

/** Beim Abmelden: kein Arbeiter, keine Wecker, keine Zahlen von gestern. */
export async function forgetNotifications(): Promise<void> {
  running = false;
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  store.digest = null;
  told = { loud: -1, forms: -1, links: -1 };
  emit();
  await notices.plan([]).catch(() => undefined);
  await stopBackground();
}
