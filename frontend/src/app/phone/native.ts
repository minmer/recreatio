/**
 * DAS TELEFON SELBST — was die Ausgabe „sms" der App (ein eigener Build, nur für
 * ein Telefon gedacht) der Seite gibt: SMS und MMS aus dem Speicher des
 * Telefons, Senden, das Adressbuch, und dasselbe für den Läufer im Hintergrund.
 *
 * <b>Zwei Wege zu denselben Handgriffen.</b> In der App spricht die Seite mit
 * dem Baustein `Phone` (Capacitor). Der Läufer (`runner.ts`, eine unsichtbare
 * WebView ohne Capacitor) hat dafür `window.RecreatioPhone` — dieselben Namen,
 * Text hinein, Text heraus. `PhoneSource` macht aus beiden eines, damit Archiv
 * und Adressbuch nur einmal geschrieben sind.
 *
 * In der gewöhnlichen App (Google Play) und im Browser gibt es beides nicht:
 * `phoneHere()` ist dann `false`, und was das Telefon braucht, erscheint nicht.
 */

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/* -- Was das Telefon liefert ---------------------------------------------------------------- */

export interface NativeThread {
  readonly threadId: string;
  /** Die anderen in diesem Gespräch — so, wie das Telefon sie kennt. */
  readonly addresses: readonly string[];
  /** Ihre Namen aus dem Adressbuch des Telefons, Stelle für Stelle — `null`, wo es keinen gibt. */
  readonly names: readonly (string | null)[];
  readonly snippet: string;
  /** Millisekunden. */
  readonly date: number;
  readonly unread: number;
  readonly count: number;
  readonly attachment: boolean;
  readonly error: boolean;
}

/** Ein Teil einer MMS, der kein Text ist (Bild, Film, Ton, vCard …). */
export interface NativePart {
  readonly partId: string;
  readonly type: string;
  readonly name: string | null;
  readonly size: number;
}

export type MessageBox = 'in' | 'out' | 'outbox' | 'failed' | 'queued' | 'draft';

export interface NativeMessage {
  /** `sms:123` oder `mms:45` — so heisst sie im Speicher des Telefons. */
  readonly id: string;
  readonly kind: 'sms' | 'mms';
  readonly threadId: string;
  readonly box: MessageBox;
  /** Millisekunden. */
  readonly date: number;
  readonly sentAt: number | null;
  /** Wer schrieb (bei eingehenden) — bei SMS auch, an wen (ausgehend). */
  readonly address: string | null;
  /** Alle anderen im Gespräch (aus dem Gespräch des Telefons). */
  readonly peers: readonly string[];
  readonly body: string;
  readonly subject: string | null;
  readonly read: boolean;
  /** Ausgehend: `pending` wird gesendet, `failed` ging nicht hinaus. */
  readonly status: 'none' | 'pending' | 'complete' | 'failed';
  readonly subId: number | null;
  readonly parts: readonly NativePart[];
  /** Eine MMS, die noch nicht geladen ist. */
  readonly pending: boolean;
}

export interface Sim {
  readonly subId: number;
  readonly slot: number;
  readonly name: string;
  readonly number: string | null;
  /** Wie gross eine MMS über diese Karte sein darf (Bytes) — was der Netzbetreiber dem Telefon sagt. */
  readonly mmsMax?: number;
}

export interface PhoneStatus {
  /** Ist diese App die SMS-App des Telefons? Nur dann kommen SMS hier an. */
  readonly defaultSms: boolean;
  readonly roleAvailable: boolean;
  readonly contacts: boolean;
  /** Darf die App SMS lesen — als SMS-App, oder auf einem alten Telefon nur dafür erlaubt (`requestSmsRead`). */
  readonly smsRead: boolean;
  readonly phoneState: boolean;
  readonly notifications: boolean;
  readonly sims: readonly Sim[];
  readonly defaultSubId: number | null;
  /** Wie viele Kontakte aus recreatio im Adressbuch des Telefons stehen. */
  readonly written: number;
  readonly contactsSyncedAt: number | null;
  readonly archivedAt: number | null;
  /** Google Messages ist installiert — mit Czat (RCS) kommen manche Nachrichten dort an, nicht hier. */
  readonly otherSms: boolean;
  /** Wie sich dieses Telefon im Browser nennt („Google Pixel 8"). */
  readonly device: string;
}

/** Eine eigene Nummer (eine Karte) — `known`: die Karte nennt sie selbst, sonst eingetragen (oder `null`). */
export interface Line {
  readonly subId: number;
  readonly slot: number;
  readonly name: string;
  readonly number: string | null;
  readonly known: boolean;
}

/** Eine geplante SMS dieses Telefons — selbst geplant oder aus dem Browser übernommen (`outboxId`). */
export interface ScheduledEntry {
  readonly id: string;
  readonly to: readonly string[];
  readonly body: string;
  /** Millisekunden. */
  readonly sendAt: number;
  readonly subId: number;
  readonly threadId: string;
  readonly state: 'scheduled' | 'sending' | 'sent' | 'failed';
  readonly createdAt: number;
  readonly doneAt?: number;
  readonly error?: string;
  readonly outboxArea?: string;
  readonly outboxId?: string;
}

export interface ScheduleRequest {
  readonly id?: string;
  readonly to: readonly string[];
  readonly body: string;
  /** Fehlt oder vorbei: gleich. */
  readonly sendAt?: number;
  readonly subId?: number;
  readonly outboxArea?: string;
  readonly outboxId?: string;
}

/** Eine Seite eines Gesprächs: die Nachrichten, wer darin ist, und wie sie im Adressbuch heissen. */
export interface ThreadPage {
  readonly messages: NativeMessage[];
  readonly more: boolean;
  readonly peers: string[];
  readonly names: Record<string, string>;
}

/** Ein Kontakt aus dem Adressbuch des Telefons (ohne die von recreatio geschriebenen). */
export interface PhoneBookContact {
  /** Die Rohkontakte dahinter, `raw:12,raw:40` — bleibt, auch wenn das Telefon Kontakte zusammenlegt. */
  readonly lookupKey: string;
  readonly name: string;
  readonly given: string | null;
  readonly family: string | null;
  readonly org: string | null;
  readonly title: string | null;
  readonly phones: readonly { readonly number: string; readonly label: string | null }[];
  readonly emails: readonly { readonly address: string; readonly label: string | null }[];
  readonly note: string | null;
  readonly birthday: string | null;
  readonly groups: readonly string[];
}

/** Ein Kontakt, wie recreatio ihn in das Adressbuch des Telefons schreibt. */
export interface WrittenContact {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly given: string | null;
  readonly family: string | null;
  readonly org: string | null;
  readonly title: string | null;
  readonly phones: readonly { readonly number: string; readonly label: string | null }[];
  readonly emails: readonly { readonly address: string; readonly label: string | null }[];
  readonly note: string | null;
  readonly birthday: string | null;
}

export interface ExportPage {
  readonly messages: readonly NativeMessage[];
  readonly nextSms: number;
  readonly nextMms: number;
  readonly done: boolean;
  /** Etwas, das noch hinausgeht (oder geladen wird), hielt die Seite an — das Gespräch später noch einmal. */
  readonly blocked?: boolean;
}

/** Was `exportMessages` bekommt: ein Gespräch (`threadId`) oder das ganze Telefon, ab den Marken. */
export interface ExportRequest {
  readonly threadId?: string;
  readonly afterSms: number;
  readonly afterMms: number;
  readonly limit: number;
}

export interface SendRequest {
  readonly to: readonly string[];
  readonly body: string;
  readonly subId?: number | null;
  /** Mehrere Empfänger: `true` — eine MMS an alle (eine Gruppe), sonst je einer eine SMS. */
  readonly group?: boolean;
  readonly attachment?: { readonly type: string; readonly data: string; readonly name: string } | null;
}

/* -- Der Baustein der App -------------------------------------------------------------------- */

interface PhonePluginApi {
  status(): Promise<PhoneStatus>;
  requestDefault(): Promise<{ defaultSms: boolean }>;
  requestContacts(): Promise<{ granted: boolean }>;
  /** Nur SMS lesen dürfen — ein altes Telefon, das archivieren soll, ohne SMS-App zu werden. */
  requestSmsRead(): Promise<{ granted: boolean }>;
  requestPhoneState(): Promise<{ granted: boolean }>;
  openSettings(): Promise<void>;
  threads(o: { limit?: number }): Promise<{ threads: NativeThread[] }>;
  messages(o: { threadId: string; before?: number; limit?: number }): Promise<ThreadPage>;
  part(o: { partId: string; maxBytes?: number }): Promise<{ type: string; data: string }>;
  send(o: SendRequest): Promise<{ threadId: string }>;
  threadOf(o: { addresses: readonly string[] }): Promise<{ threadId: string }>;
  markRead(o: { threadId: string }): Promise<void>;
  viewing(o: { threadId: string | null }): Promise<void>;
  remove(o: { id: string }): Promise<{ removed: boolean }>;
  /** Eine angekündigte MMS noch einmal laden. */
  retryMms(o: { id: string }): Promise<{ started: boolean }>;
  /** „Sprawdź nowe wiadomości": angekündigte MMS noch einmal laden; ist die App (noch) die SMS-App? */
  recheck(): Promise<{ defaultSms: boolean; otherSms: boolean; mmsRetried: number }>;
  lines(): Promise<{ lines: Line[] }>;
  setLine(o: { subId: number; number: string | null }): Promise<void>;
  schedule(o: ScheduleRequest): Promise<{ entry: ScheduledEntry }>;
  unschedule(o: { id: string }): Promise<{ removed: boolean }>;
  scheduled(): Promise<{ entries: ScheduledEntry[] }>;
  forgetScheduled(o: { id: string }): Promise<void>;
  /** Die Kontakte gleich im Hintergrund ins Adressbuch (der Läufer). */
  contactsSoon(): Promise<void>;
  /** Kontakte nur im Gerät (ohne Konto), die schon in recreatio sind, aus dem Gerät entfernen — `keys` wie `lookupKey`. */
  dropLocal(o: { keys: readonly string[] }): Promise<{ removed: number }>;
  search(o: { query: string; limit?: number }): Promise<{ hits: { threadId: string; id: string; date: number; snippet: string; address: string | null }[] }>;
  lookup(o: { numbers: readonly string[] }): Promise<{ names: Record<string, string> }>;
  contacts(): Promise<{ contacts: PhoneBookContact[] }>;
  writeContacts(o: { contacts: readonly WrittenContact[] }): Promise<{ added: number; updated: number; removed: number; total: number }>;
  exportMessages(o: ExportRequest): Promise<ExportPage>;
  archiveState(): Promise<{ state: string }>;
  setArchiveState(o: { state: string; at?: number }): Promise<void>;
  /** 2026-10-19 — still: `until` ms (0 = für immer, &lt; 0 = wieder laut); die Nachrichten kommen, gemeldet wird nichts. */
  mute(o: { threadId: string; until: number }): Promise<void>;
  /** {Gespräch: Ende} — 0 heisst für immer. */
  mutes(): Promise<{ muted: Record<string, number> }>;
  /** Sperren (im Telefon — auch für Anrufe — und hier); mit `threadId` ist das Gespräch danach fort. */
  block(o: { numbers: readonly string[]; threadId?: string }): Promise<{ blocked: number; deleted: number; system: boolean }>;
  unblock(o: { number: string }): Promise<void>;
  blocked(): Promise<{ numbers: string[]; system: boolean }>;
  /** Ein Gespräch vom Telefon löschen — das Archiv bleibt, wie es ist. */
  deleteThread(o: { threadId: string }): Promise<{ deleted: number }>;
  /** 2026-10-26 — was nicht hinausging (fehlgeschlagen, hängengeblieben), älter als `before` (ms): zählen, löschen. */
  unsent(o: { before: number; threadId?: string }): Promise<{ count: number }>;
  dropUnsent(o: { before: number; threadId?: string }): Promise<{ deleted: number }>;
  /** Die Karte je Gespräch für Antworten aus der Meldung — {Gespräch: subId}, -1 = keine eigene. */
  threadSubs(o: { subs: Record<string, number> }): Promise<void>;
  addListener(event: 'smsChanged', listener: (e: { threadId: string | null }) => void): Promise<PluginListenerHandle>;
}

export const Phone = registerPlugin<PhonePluginApi>('Phone');

/** Läuft hier die Ausgabe „sms" der App? (in `here.ts`, damit der Arbeitsplatz es fragen kann, ohne dieses Bündel zu laden) */
export { phoneHere } from './here';

/* -- Für Archiv und Adressbuch: ein Weg, ob App oder Läufer ------------------------------------ */

export interface PhoneSource {
  /** 0116 — die eigenen Nummern, die geplanten SMS, wie das Telefon heisst. */
  lines(): Promise<{ lines: Line[] }>;
  device(): Promise<{ device: string }>;
  schedule(o: ScheduleRequest): Promise<{ entry: ScheduledEntry }>;
  unschedule(o: { id: string }): Promise<{ removed: boolean }>;
  scheduled(): Promise<{ entries: ScheduledEntry[] }>;
  forgetScheduled(o: { id: string }): Promise<void>;
  threads(o: { limit?: number }): Promise<{ threads: NativeThread[] }>;
  exportMessages(o: ExportRequest): Promise<ExportPage>;
  /** Bis wohin dieses Telefon archiviert hat (als Text, `smsArchive.ts` deutet ihn). */
  archiveState(): Promise<{ state: string }>;
  setArchiveState(o: { state: string; at?: number }): Promise<void>;
  part(o: { partId: string; maxBytes?: number }): Promise<{ type: string; data: string }>;
  writeContacts(o: { contacts: readonly WrittenContact[] }): Promise<{ added: number; updated: number; removed: number; total: number }>;
}

/** Die Brücke des Läufers (RunnerHost.java, Ausgabe „sms") — synchron, Text hinein, Text heraus. */
interface RunnerPhoneBridge {
  lines(): string;
  device(): string;
  schedule(json: string): string;
  unschedule(json: string): string;
  scheduled(): string;
  forgetScheduled(json: string): string;
  threads(json: string): string;
  exportMessages(json: string): string;
  archiveState(): string;
  setArchiveState(json: string): string;
  part(json: string): string;
  writeContacts(json: string): string;
}

declare global {
  interface Window {
    RecreatioPhone?: RunnerPhoneBridge;
  }
}

/** In der App: der Baustein. */
export const pluginSource: PhoneSource = {
  threads: (o) => Phone.threads(o),
  exportMessages: (o) => Phone.exportMessages(o),
  archiveState: () => Phone.archiveState(),
  setArchiveState: (o) => Phone.setArchiveState(o),
  part: (o) => Phone.part(o),
  writeContacts: (o) => Phone.writeContacts(o),
  lines: () => Phone.lines(),
  device: async () => ({ device: (await Phone.status()).device }),
  schedule: (o) => Phone.schedule(o),
  unschedule: (o) => Phone.unschedule(o),
  scheduled: () => Phone.scheduled(),
  forgetScheduled: (o) => Phone.forgetScheduled(o)
};

/** Im Läufer: die Brücke — oder `null`, wenn es sie nicht gibt (gewöhnliche App). */
export function bridgeSource(): PhoneSource | null {
  const bridge = typeof window === 'undefined' ? undefined : window.RecreatioPhone;
  if (bridge === undefined) return null;
  const ask = <T>(answer: string): T => {
    const parsed = JSON.parse(answer) as T & { error?: string };
    if (parsed !== null && typeof parsed === 'object' && typeof parsed.error === 'string') throw new Error(parsed.error);
    return parsed;
  };
  return {
    threads: async (o) => ask<{ threads: NativeThread[] }>(bridge.threads(JSON.stringify(o))),
    exportMessages: async (o) => ask<ExportPage>(bridge.exportMessages(JSON.stringify(o))),
    archiveState: async () => ask<{ state: string }>(bridge.archiveState()),
    setArchiveState: async (o) => { ask<unknown>(bridge.setArchiveState(JSON.stringify(o))); },
    part: async (o) => ask<{ type: string; data: string }>(bridge.part(JSON.stringify(o))),
    writeContacts: async (o) => ask<{ added: number; updated: number; removed: number; total: number }>(bridge.writeContacts(JSON.stringify(o))),
    lines: async () => ask<{ lines: Line[] }>(bridge.lines()),
    device: async () => ask<{ device: string }>(bridge.device()),
    schedule: async (o) => ask<{ entry: ScheduledEntry }>(bridge.schedule(JSON.stringify(o))),
    unschedule: async (o) => ask<{ removed: boolean }>(bridge.unschedule(JSON.stringify(o))),
    scheduled: async () => ask<{ entries: ScheduledEntry[] }>(bridge.scheduled()),
    forgetScheduled: async (o) => { ask<unknown>(bridge.forgetScheduled(JSON.stringify(o))); }
  };
}
