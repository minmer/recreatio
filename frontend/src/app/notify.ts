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
 *   der Wecker klingelt (0075)  sofort (App vorn, mit Firebase gebaut)
 * </code>
 *
 * <b>Mehrere Tabs fragen nicht mehrfach</b>: wer gefragt hat, sagt es den
 * anderen (BroadcastChannel), und die stellen ihre Uhr zurück.
 *
 * <b>Die App geschlossen</b>: dort fragt der Arbeiter des Systems
 * (`platform.background`, höchstens alle 15 min, nur mit Netz und genug Akku),
 * und Erinnerungen an Aufgaben liegen im Wecker des Systems (`notices.plan`).
 * Mit Firebase (0075) weckt der Dienst die App sofort — dann meldet sich das
 * Telefon gleich, nicht erst beim nächsten Takt.
 *
 * <b>Gemeldet wird auch, wenn die Seite vorn ist</b> (0075) — nur nicht die
 * Rozmowa, die gerade offen ist. In der App als Meldung des Systems, im
 * Browser als Hinweis auf der Seite (`onToast`).
 */

import { API, call, keepsKey, type Who } from './session';
import { background, native, notices } from './platform';
import { gatherNews, type ReminderNotice } from './notifyRich';
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
  readonly chats: { readonly unread: number; readonly loud: number; readonly list: readonly DigestChat[]; /** 0076 */ readonly newestAt?: string | null };
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
  /**
   * 0076 — nur in der App: der INHALT in der Meldung (wer schreibt, was, ein
   * Antwortfeld; Namen aus Anmeldungen; Titel der Aufgaben). Geöffnet wird auf
   * diesem Telefon; Firebase sieht davon nichts. Aus: nur Zahlen, wie bisher.
   */
  readonly contents: boolean;
}

export const DEFAULT_SETTINGS: NotifySettings = {
  chats: true, forms: true, links: true, reminders: true, backgroundMinutes: 15, contents: true
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

/** Was zuletzt gemeldet wurde — damit nur NEUES klingelt. `null`: noch nichts (der erste Stand ist Altes). */
let told: Told | null = null;

/** 0075 — weckt Firebase dieses Telefon? Dann meldet bei verdeckter Seite der Wecker, nicht die Seite (sonst doppelt). */
let pushActive = false;

/** 0076 — wer angemeldet ist: damit öffnet die Seite den Inhalt der Meldungen (App, vorn). */
let richWho: Who | null = null;

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
    void background.seen({
      unread: digest.chats.loud, forms: digest.registrations.count, links: digest.links, since: seenSince(),
      /* 0076 — welche Rozmowy noch Ungelesenes haben: die Meldungen der übrigen nimmt das Telefon weg. */
      chats: digest.chats.list.filter((c) => !c.quiet && c.unread > 0).map((c) => c.chatId)
    });
  } else if (told !== null) {
    /* Der andere Tab hat schon gemeldet — dasselbe klingelt hier nicht noch einmal. */
    told = toldOf(digest);
  }
}

/* -- Was klingelt ---------------------------------------------------------------- */

/** Was zuletzt gemeldet wurde: je Rozmowa die Zahl der Ungelesenen, dazu Anmeldungen und Links. */
export interface Told {
  readonly chats: Readonly<Record<string, number>>;
  readonly forms: number;
  readonly links: number;
}

export const toldOf = (digest: Digest): Told => ({
  chats: Object.fromEntries(digest.chats.list.map((c) => [c.chatId, c.unread])),
  forms: digest.registrations.count,
  links: digest.links
});

export interface Ringing {
  /** Rozmowy mit neuen Nachrichten — die neueste zuerst. */
  readonly chats: readonly DigestChat[];
  readonly forms: boolean;
  readonly links: boolean;
}

/**
 * WAS KLINGELT — rein, damit es sich prüfen lässt (`app-platform-check.mjs`).
 *
 * Neu ist, was über dem zuletzt Gemeldeten liegt, und zwar JE ROZMOWA: wer
 * eine Rozmowa liest, während in einer anderen etwas ankommt, dem sinkt die
 * Summe — die neue Nachricht klingelt trotzdem. Nie: beim ersten Stand (das
 * ist Altes), in stummen Rozmowy, in der Rozmowa, die gerade offen ist.
 */
export function whatRings(before: Told | null, digest: Digest, settings: NotifySettings, openChat: string | null): Ringing {
  if (before === null) return { chats: [], forms: false, links: false };
  const chats = !settings.chats ? [] : digest.chats.list
    .filter((c) => !c.quiet && c.chatId !== openChat && c.unread > (before.chats[c.chatId] ?? 0))
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  return {
    chats,
    forms: settings.forms && digest.registrations.count > before.forms,
    links: settings.links && digest.links > before.links
  };
}

/** Die Rozmowa, die gerade auf dem Bildschirm steht — `null`, wenn keine (oder die Seite verdeckt ist). */
export function openChatOf(hash: string, shown: boolean): string | null {
  if (!shown) return null;
  const base = `${viewPath('chat')}/`;
  if (!hash.startsWith(base)) return null;
  const id = hash.slice(base.length).split(/[/?&]/)[0];
  try { return decodeURIComponent(id) || null; } catch { return id || null; }
}

/* -- Hinweise auf der Seite (Browser, Seite vorn) ------------------------------------- */

export interface Toast {
  readonly id: number;
  readonly title: string;
  readonly body: string;
  readonly open?: string;
}

const toastListeners = new Set<(toast: Toast) => void>();
let toastCount = 0;

/** Wer Hinweise zeigt (die Glocke). Gibt das Abmelden zurück. */
export function onToast(fn: (toast: Toast) => void): () => void {
  toastListeners.add(fn);
  return () => { toastListeners.delete(fn); };
}

/**
 * MELDEN — in der App als Meldung des Systems (auch vorn: so klingelt ein
 * Telefon); im Browser bei verdeckter Seite ebenso, bei sichtbarer als Hinweis
 * auf der Seite. Ist die Seite verdeckt und weckt Firebase das Telefon, meldet
 * der Wecker (PushService) — nicht auch noch die Seite.
 */
function tell(notice: { title: string; body: string; tag: string; open: string }, channel: 'chat' | 'news'): void {
  const shown = visible();
  if (!shown && native && pushActive) return;
  if (notices.allowed() && (native || !shown)) { notices.show(notice, channel); return; }
  if (!shown) return;
  toastCount += 1;
  const toast: Toast = { id: toastCount, title: notice.title, body: notice.body, open: notice.open };
  for (const fn of toastListeners) fn(toast);
}

/**
 * KLINGELN — nur bei NEUEM, nur, was in den Einstellungen erlaubt ist. Die
 * Marke ist die der Rozmowa: eine zweite Meldung ersetzt die erste (auch die
 * aus der Liste der Rozmowy, ChatPage.tsx).
 */
function ring(digest: Digest): void {
  const openChat = openChatOf(window.location.hash, visible());
  const plan = whatRings(told, digest, store.settings, openChat);
  told = toldOf(digest);

  /*
   * 0076 — IN DER APP MIT INHALT: wer schreibt, was, ein Antwortfeld. Geöffnet
   * hier (die Seite hat den Schlüssel); was neu klingelt, entscheidet das
   * Telefon. Ist die Seite verdeckt und Firebase weckt, macht das der Läufer.
   */
  const anything = plan.chats.length > 0 || plan.forms || plan.links;
  if (anything && native && store.settings.contents && richWho !== null && (visible() || !pushActive)) {
    const who = richWho;
    void gatherNews(who, {
      since: seenSince(), skipChat: openChat, replyable: keepsKey(who), settings: store.settings
    }).then((news) => {
      if (news.state === 'open') return background.present(news);
      ringPlain(digest, plan);
      return undefined;
    }).catch(() => ringPlain(digest, plan));
    return;
  }
  ringPlain(digest, plan);
}

/** Ohne Inhalt: nur, wo es etwas gibt und wie viel (wie 0067). */
function ringPlain(digest: Digest, plan: Ringing): void {
  const [newest, ...others] = plan.chats;
  if (newest !== undefined) {
    const more = others.reduce((n, c) => n + c.unread, 0);
    tell({
      title: newest.unread === 1 ? 'Nowa wiadomość' : `Nowe wiadomości: ${newest.unread}`,
      body: more === 0 ? chatLabel(newest) : `${chatLabel(newest)} · i ${more} w innych rozmowach`,
      tag: newest.chatId,
      open: viewPath('chat', newest.chatId)
    }, 'chat');
  }
  if (plan.forms) {
    const form = digest.registrations.list[0];
    tell({
      title: digest.registrations.count === 1 ? 'Nowe zgłoszenie' : `Nowe zgłoszenia: ${digest.registrations.count}`,
      body: form === undefined ? 'Ktoś wypełnił formularz.' : form.name,
      tag: 'forms',
      open: form === undefined ? viewPath('modules') : viewPath('modules', 'form', form.moduleId)
    }, 'news');
  }
  if (plan.links) {
    tell({ title: 'Ktoś dołączył przez link', body: 'Zobacz linki dostępu w Obszarach.', tag: 'links', open: viewPath('areas') }, 'news');
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
  if (told !== null) told = { ...told, forms: 0, links: 0 };
}

/**
 * DEN TAKT STARTEN — einmal je Tab, solange jemand angemeldet ist. Die
 * Horcher stellen die Uhr nur um; sie fragen nie öfter, als `nextDelay` sagt.
 */
export function start(who: Who | null = null): () => void {
  if (running) return () => undefined;
  running = true;
  richWho = who;
  store.settings = loadSettings();

  /* 0076 — wer eine Rozmowa öffnet, braucht ihre Meldung nicht mehr. */
  const onHash = () => {
    const chatId = openChatOf(window.location.hash, true);
    if (chatId !== null) void background.dismiss(chatId);
  };
  window.addEventListener('hashchange', onHash);
  onHash();

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

  /* 0075 — der Wecker, während die App vorn ist: sofort nachsehen. */
  const offCheck = background.onCheck(() => void refresh());

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
    window.removeEventListener('hashchange', onHash);
    offCheck();
    richWho = null;
  };
}

/* -- Erinnerungen an Aufgaben ---------------------------------------------------- */

/**
 * Die Erinnerungen in den Wecker — ersetzt, was vorher geplant war. Die Liste
 * rechnet `notifyRich.remindersFor` (dieselbe, die der Läufer im Hintergrund
 * plant); in der App trägt die Meldung „Zrobione" (0076).
 */
export async function planReminders(list: readonly ReminderNotice[]): Promise<void> {
  if (!store.settings.reminders) { await notices.plan([]); return; }
  await notices.plan(list.map((r) => ({
    tag: r.tag, title: r.title, body: r.body, at: new Date(r.at), open: r.open, taskId: r.taskId, occurrenceAt: r.occurrenceAt
  })));
}

/* -- Das Gerät (nur in der App) ----------------------------------------------------- */

export interface DeviceRow {
  readonly deviceId: string;
  readonly label: string | null;
  readonly platform: string;
  readonly createdAt: string;
  readonly lastSeenAt: string | null;
  /** 0075 — hat der Dienst eine Firebase-Kennung dieses Geräts, wann ging zuletzt ein Wecker hin, was schlug fehl? */
  readonly push?: boolean;
  readonly pushAt?: string | null;
  readonly pushError?: string | null;
}

export interface DeviceList {
  readonly devices: readonly DeviceRow[];
  /** 0075 — schickt dieser Dienst überhaupt Push (ist Firebase eingerichtet)? */
  readonly push?: { readonly available: boolean };
}

export const loadDevices = (): Promise<DeviceList> => call('/workspace/notify-devices');
export const dropDevice = (deviceId: string): Promise<{ revoked: boolean }> =>
  call(`/workspace/notify-devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });

/** Unter welcher Kennung der Dienst DIESES Gerät kennt (nur in der App). */
export function thisDevice(): { deviceId: string; token: string } | null {
  try { return JSON.parse(localStorage.getItem(DEVICE_SLOT) ?? 'null') as { deviceId: string; token: string } | null; } catch { return null; }
}

/** Weckt der Dienst dieses Gerät? Er schickt Push, und er hat die Kennung. */
const pushFor = (listed: DeviceList | null, deviceId: string): boolean =>
  listed?.push?.available === true && listed.devices.some((d) => d.deviceId === deviceId && d.push === true);

/**
 * DEN ARBEITER IM HINTERGRUND einschalten (oder umstellen, oder aus). Das
 * Gerät bekommt einmal einen Zufallswert; hier liegt nur, unter welcher
 * Kennung der Dienst ihn kennt.
 *
 * 0075 — läuft bei JEDEM Start der App: ist das Gerät beim Dienst nicht mehr
 * bekannt (anderswo „Odłącz", oder der Arbeiter bekam 401), meldet es sich
 * neu an; und die Firebase-Kennung geht wieder hin (sie kann sich ändern).
 */
export async function applyBackground(settings: NotifySettings): Promise<void> {
  if (!background.available) return;

  if (settings.backgroundMinutes === 0) {
    await stopBackground();
    return;
  }

  let device = thisDevice();
  const listed = await loadDevices().catch(() => null);
  if (device !== null && listed !== null && !listed.devices.some((d) => d.deviceId === device?.deviceId)) device = null;

  if (device === null) {
    const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const made = await call<{ deviceId: string }>('/workspace/notify-devices', {
      method: 'POST', body: JSON.stringify({ token, label: 'Telefon (aplikacja)', platform: 'android' })
    });
    device = { deviceId: made.deviceId, token };
    localStorage.setItem(DEVICE_SLOT, JSON.stringify(device));
  }

  const done = await background.configure({
    api: API, token: device.token, intervalMinutes: Math.max(15, settings.backgroundMinutes),
    chats: settings.chats, forms: settings.forms, links: settings.links,
    contents: settings.contents, reminders: settings.reminders
  });

  pushActive = pushFor(listed, device.deviceId);
  /* Die Kennung geht im Hintergrund an den Dienst — kurz danach nachsehen, ob sie ankam. */
  if (done.push === true && listed?.push?.available === true && !pushActive) {
    const id = device.deviceId;
    window.setTimeout(() => {
      void loadDevices().then((again) => { pushActive = pushFor(again, id); }).catch(() => undefined);
    }, 10_000);
  }
}

export async function stopBackground(): Promise<void> {
  pushActive = false;
  await background.stop();
  try {
    const device = thisDevice();
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
  told = null;
  emit();
  await notices.plan([]).catch(() => undefined);
  await stopBackground();
}
