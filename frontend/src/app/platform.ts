/**
 * WAS VOM GERÄT ABHÄNGT (Kapitel 13.2) — an dieser Stelle und sonst nirgends.
 *
 * Im Browser und in der Android-App läuft dasselbe Bündel. Was zwischen beiden
 * verschieden ist, steht hier hinter einer Schnittstelle; der Rest fragt nicht,
 * wo er läuft.
 *
 * <code>
 *                 Browser               Android-App
 *   vault         localStorage          Android Keystore (KeyVaultPlugin)
 *   notices       Notification          @capacitor/local-notifications
 *   saveBlob      <a download>          Dokumentenwähler (FileSaverPlugin)
 * </code>
 *
 * <b>Kein Push über fremde Dienste.</b> Benachrichtigt wird, solange die Seite
 * läuft — im Browser wie in der App. Dazu (0067): in der App fragt ein
 * Arbeiter des Systems auch bei geschlossener App nach Zahlen (`background`,
 * NotifyPlugin/NotifyWorker, höchstens alle 15 Minuten, nur mit Netz und
 * genug Akku), und Erinnerungen an Aufgaben stehen im Wecker des Systems
 * (`notices.plan`) — sie kommen, ohne dass jemand fragt.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/** Läuft das hier in der App (und nicht in einem Browser)? */
export const native: boolean = Capacitor.isNativePlatform();

/* -- Die Ablage ---------------------------------------------------------- */

interface KeyVaultPlugin {
  get(options: { slot: string }): Promise<{ value?: string }>;
  put(options: { slot: string; value: string }): Promise<void>;
  drop(options: { slot: string }): Promise<void>;
}

const KeyVault = registerPlugin<KeyVaultPlugin>('KeyVault');

/**
 * Kleines, das einen Neustart übersteht — und NICHT mehr.
 *
 * <b>Jeder Fehlschlag heisst „nichts da".</b> Ein gesperrter Speicher (privates
 * Fenster) oder ein Schlüssel, den das Gerät nicht mehr hat, ist eine Lage und
 * kein Absturz: wer liest, bekommt `null`, wer schreibt, `false`.
 */
export const vault = {
  async get(slot: string): Promise<string | null> {
    try {
      if (native) return (await KeyVault.get({ slot })).value ?? null;
      return localStorage.getItem(slot);
    } catch {
      return null;
    }
  },

  async put(slot: string, value: string): Promise<boolean> {
    try {
      if (native) await KeyVault.put({ slot, value });
      else localStorage.setItem(slot, value);
      return true;
    } catch {
      return false;
    }
  },

  async drop(slot: string): Promise<void> {
    try {
      if (native) await KeyVault.drop({ slot });
      else localStorage.removeItem(slot);
    } catch { /* gesperrt heisst: liegt ohnehin nichts */ }
  }
};

/* -- Benachrichtigungen --------------------------------------------------- */

export interface Notice {
  readonly title: string;
  readonly body: string;
  /** Dieselbe Marke ersetzt die vorige, statt eine zweite daneben zu legen. */
  readonly tag: string;
  /** Wohin ein Tippen führt — eine Adresse hinter der Raute. */
  readonly open?: string;
}

const CHANNEL = 'chat';

/** 0067 — eigene Kanäle: was neu ist (Anmeldungen, Links), und Erinnerungen an Aufgaben. */
const CHANNEL_NEWS = 'news';
const CHANNEL_TASKS = 'tasks';

/** Was geplant liegt — damit Veraltetes zurückgenommen werden kann (Android vergisst nichts von selbst). */
const PLANNED_SLOT = 'recreatio:notify:planned';

/** Im Browser: die Wecker dieses Tabs (bis morgen; länger hält ein Tab nicht offen). */
const webTimers = new Map<string, number>();

/** In der App gilt, was zuletzt nachgesehen wurde; `null` heisst: noch nie. */
let granted: boolean | null = null;

/** Einmal je Start: Kanal anlegen, Erlaubnis nachsehen, auf ein Tippen hören. */
const prepared: Promise<void> | null = native
  ? (async () => {
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL, name: 'Rozmowy', description: 'Nowe wiadomości w rozmowach', importance: 4, visibility: 0
      });
      await LocalNotifications.createChannel({
        id: CHANNEL_NEWS, name: 'Nowości', description: 'Nowe zgłoszenia z formularzy i dołączenia przez linki', importance: 3, visibility: 0
      });
      await LocalNotifications.createChannel({
        id: CHANNEL_TASKS, name: 'Zadania', description: 'Przypomnienia o zadaniach: na początku, w połowie, pod koniec', importance: 4, visibility: 0
      });
      granted = (await LocalNotifications.checkPermissions()).display === 'granted';
      await LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
        const open: unknown = notification.extra?.open;
        if (typeof open === 'string' && open !== '') window.location.hash = open;
      });

      /* Erlaubt wird auch in den Einstellungen — zurück in der App gilt der neue Stand. */
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        void LocalNotifications.checkPermissions()
          .then((now) => { granted = now.display === 'granted'; })
          .catch(() => undefined);
      });
    } catch {
      granted = false;
    }
  })()
  : null;

/** Die Nummer einer Marke: Android will eine Zahl, und dieselbe Marke dieselbe. FNV-1a, 31 Bit. */
function numberOf(tag: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < tag.length; i += 1) {
    hash ^= tag.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 1) || 1;
}

export const notices = {
  /** Gibt es hier überhaupt Benachrichtigungen? */
  available: native || (typeof window !== 'undefined' && 'Notification' in window),

  /** Darf jetzt eine gezeigt werden? Synchron — es wird in einer Schleife gefragt. */
  allowed(): boolean {
    if (native) return granted === true;
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  },

  /** Um Erlaubnis bitten. `true`: ab jetzt wird benachrichtigt. */
  async ask(): Promise<boolean> {
    if (native) {
      await prepared;
      try {
        granted = (await LocalNotifications.requestPermissions()).display === 'granted';
      } catch {
        granted = false;
      }
      return granted;
    }
    if (typeof Notification === 'undefined') return false;
    return (await Notification.requestPermission()) === 'granted';
  },

  /**
   * 0067 — ERINNERUNGEN PLANEN: die Liste ersetzt, was vorher geplant war.
   * In der App liegen sie im Wecker des Systems (ungenau erlaubt — kein
   * „genauer Wecker", den Google Play nur Weckern erlaubt); im Browser nur,
   * solange der Tab offen ist, und höchstens einen Tag voraus.
   */
  async plan(list: readonly (Notice & { at: Date })[]): Promise<void> {
    const wanted = new Map(list.map((n) => [n.tag, n]));

    if (native) {
      await prepared;
      let before: string[] = [];
      try { before = JSON.parse(localStorage.getItem(PLANNED_SLOT) ?? '[]') as string[]; } catch { before = []; }
      const stale = before.filter((tag) => !wanted.has(tag));
      if (stale.length > 0) {
        await LocalNotifications.cancel({ notifications: stale.map((tag) => ({ id: numberOf(tag) })) }).catch(() => undefined);
      }
      if (!notices.allowed()) { localStorage.setItem(PLANNED_SLOT, '[]'); return; }
      const fresh = list.filter((n) => n.at.getTime() > Date.now() + 30_000).slice(0, 60);
      if (fresh.length > 0) {
        await LocalNotifications.schedule({
          notifications: fresh.map((n) => ({
            id: numberOf(n.tag), title: n.title, body: n.body, channelId: CHANNEL_TASKS, smallIcon: 'ic_stat_recreatio',
            schedule: { at: n.at, allowWhileIdle: true }, extra: { open: n.open ?? '' }
          }))
        }).catch(() => undefined);
      }
      localStorage.setItem(PLANNED_SLOT, JSON.stringify(fresh.map((n) => n.tag)));
      return;
    }

    for (const [tag, timer] of webTimers) {
      if (!wanted.has(tag)) { window.clearTimeout(timer); webTimers.delete(tag); }
    }
    const horizon = Date.now() + 24 * 3600_000;
    for (const n of list) {
      if (webTimers.has(n.tag) || n.at.getTime() > horizon || n.at.getTime() < Date.now()) continue;
      webTimers.set(n.tag, window.setTimeout(() => { webTimers.delete(n.tag); notices.show(n); }, n.at.getTime() - Date.now()));
    }
  },

  /** Zeigen — wenn es erlaubt ist, sonst nichts. `news`: im Kanal „Nowości". */
  show(notice: Notice, channel: 'chat' | 'news' | 'tasks' = 'chat'): void {
    if (!notices.allowed()) return;

    if (native) {
      void LocalNotifications.schedule({
        notifications: [{
          id: numberOf(notice.tag),
          title: notice.title,
          body: notice.body,
          channelId: channel === 'news' ? CHANNEL_NEWS : channel === 'tasks' ? CHANNEL_TASKS : CHANNEL,
          smallIcon: 'ic_stat_recreatio',
          /*
           * Sofort, nicht geplant. Ohne das hielte das Plugin sie für einen
           * genauen Wecker und schickte den Menschen in die Einstellungen
           * „Wecker und Erinnerungen" — für eine Nachricht, die jetzt da ist.
           */
          isExactNotification: false,
          extra: { open: notice.open ?? '' }
        }]
      }).catch(() => undefined);
      return;
    }

    const shown = new Notification(notice.title, { body: notice.body, tag: notice.tag });
    const open = notice.open;
    if (open !== undefined) {
      shown.onclick = () => { window.focus(); window.location.hash = open; shown.close(); };
    }
  }
};

/* -- 0067: Im Hintergrund nachsehen (nur in der App) ----------------------- */

interface NotifyPluginApi {
  configure(options: {
    api: string; token: string; intervalMinutes: number; chats: boolean; forms: boolean; links: boolean;
  }): Promise<void>;
  stop(): Promise<void>;
  seen(options: { unread: number; forms: number; links: number; since: string }): Promise<void>;
  status(): Promise<{ configured: boolean; intervalMinutes: number }>;
}

const NotifyNative = registerPlugin<NotifyPluginApi>('Notify');

/**
 * Der Arbeiter der App (`NotifyWorker.java`): fragt `/notify/digest` mit dem
 * Gerätekennzeichen — nur Zahlen, nur mit Netz und genug Akku, höchstens alle
 * 15 Minuten (Android lässt es nicht öfter, und es soll auch nicht).
 */
export const background = {
  available: native,
  configure: (options: Parameters<NotifyPluginApi['configure']>[0]) =>
    native ? NotifyNative.configure(options) : Promise.resolve(),
  stop: () => (native ? NotifyNative.stop().catch(() => undefined) : Promise.resolve()),
  /** Was die App gerade gezeigt hat — der Arbeiter meldet nur, was DARÜBER hinaus neu ist. */
  seen: (options: Parameters<NotifyPluginApi['seen']>[0]) =>
    native ? NotifyNative.seen(options).catch(() => undefined) : Promise.resolve(),
  status: () => (native ? NotifyNative.status().catch(() => ({ configured: false, intervalMinutes: 0 })) : Promise.resolve({ configured: false, intervalMinutes: 0 }))
};

/* -- Eine Datei ablegen --------------------------------------------------- */

interface FileSaverPlugin {
  begin(options: { name: string; mime: string }): Promise<{ handle?: string }>;
  append(options: { handle: string; data: string }): Promise<void>;
  end(options: { handle: string }): Promise<void>;
  abort(options: { handle: string }): Promise<void>;
}

const FileSaver = registerPlugin<FileSaverPlugin>('FileSaver');

/** Ein Stück je Aufruf über die Brücke. Base64 macht daraus 1,3 MB — klein genug für jeden Aufruf. */
const PIECE = 1024 * 1024;

/** Base64 (nicht URL-sicher: so will es `android.util.Base64.DEFAULT`). */
const base64Of = (part: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const url = String(reader.result);
    resolve(url.slice(url.indexOf(',') + 1));
  };
  reader.onerror = () => reject(reader.error ?? new Error('read'));
  reader.readAsDataURL(part);
});

/**
 * Eine Datei ablegen.
 *
 * Im Browser lädt sie herunter wie immer. In der App fragt das System, WOHIN —
 * `cancelled` heisst, der Mensch hat es sich anders überlegt, und ist kein Fehler.
 */
export async function saveBlob(blob: Blob, name: string): Promise<'saved' | 'cancelled'> {
  if (!native) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return 'saved';
  }

  const { handle } = await FileSaver.begin({ name, mime: blob.type.split(';')[0].trim() });
  if (handle === undefined) return 'cancelled';

  try {
    for (let at = 0; at < blob.size; at += PIECE) {
      await FileSaver.append({ handle, data: await base64Of(blob.slice(at, at + PIECE)) });
    }
    await FileSaver.end({ handle });
    return 'saved';
  } catch (error) {
    await FileSaver.abort({ handle }).catch(() => undefined);
    throw error;
  }
}
