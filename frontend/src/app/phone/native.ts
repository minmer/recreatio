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

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/* -- Was das Telefon liefert ---------------------------------------------------------------- */

export interface NativeThread {
  readonly threadId: string;
  /** Die anderen in diesem Gespräch — so, wie das Telefon sie kennt. */
  readonly addresses: readonly string[];
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
}

export interface PhoneStatus {
  /** Ist diese App die SMS-App des Telefons? Nur dann kommen SMS hier an. */
  readonly defaultSms: boolean;
  readonly roleAvailable: boolean;
  readonly contacts: boolean;
  readonly phoneState: boolean;
  readonly notifications: boolean;
  readonly sims: readonly Sim[];
  readonly defaultSubId: number | null;
  /** Wie viele Kontakte aus recreatio im Adressbuch des Telefons stehen. */
  readonly written: number;
  readonly contactsSyncedAt: number | null;
  readonly archivedAt: number | null;
}

/** Ein Kontakt aus dem Adressbuch des Telefons (ohne die von recreatio geschriebenen). */
export interface PhoneBookContact {
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
  requestPhoneState(): Promise<{ granted: boolean }>;
  openSettings(): Promise<void>;
  threads(o: { limit?: number }): Promise<{ threads: NativeThread[] }>;
  messages(o: { threadId: string; before?: number; limit?: number }): Promise<{ messages: NativeMessage[]; more: boolean }>;
  part(o: { partId: string; maxBytes?: number }): Promise<{ type: string; data: string }>;
  send(o: SendRequest): Promise<{ threadId: string }>;
  threadOf(o: { addresses: readonly string[] }): Promise<{ threadId: string }>;
  markRead(o: { threadId: string }): Promise<void>;
  viewing(o: { threadId: string | null }): Promise<void>;
  remove(o: { id: string }): Promise<{ removed: boolean }>;
  search(o: { query: string; limit?: number }): Promise<{ hits: { threadId: string; id: string; date: number; snippet: string; address: string | null }[] }>;
  lookup(o: { numbers: readonly string[] }): Promise<{ names: Record<string, string> }>;
  contacts(): Promise<{ contacts: PhoneBookContact[] }>;
  writeContacts(o: { contacts: readonly WrittenContact[] }): Promise<{ added: number; updated: number; removed: number; total: number }>;
  exportMessages(o: { afterSms: number; afterMms: number; limit: number }): Promise<ExportPage>;
  archiveMarkers(): Promise<{ sms: number; mms: number }>;
  setArchiveMarkers(o: { sms: number; mms: number; at?: number }): Promise<void>;
  addListener(event: 'smsChanged', listener: (e: { threadId: string | null }) => void): Promise<PluginListenerHandle>;
}

export const Phone = registerPlugin<PhonePluginApi>('Phone');

/** Läuft hier die Ausgabe „sms" der App? Nur dann gibt es das Telefon. */
export const phoneHere = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Phone');
  } catch {
    return false;
  }
};

/* -- Für Archiv und Adressbuch: ein Weg, ob App oder Läufer ------------------------------------ */

export interface PhoneSource {
  exportMessages(o: { afterSms: number; afterMms: number; limit: number }): Promise<ExportPage>;
  archiveMarkers(): Promise<{ sms: number; mms: number }>;
  setArchiveMarkers(o: { sms: number; mms: number; at?: number }): Promise<void>;
  part(o: { partId: string; maxBytes?: number }): Promise<{ type: string; data: string }>;
  writeContacts(o: { contacts: readonly WrittenContact[] }): Promise<{ added: number; updated: number; removed: number; total: number }>;
}

/** Die Brücke des Läufers (RunnerHost.java, Ausgabe „sms") — synchron, Text hinein, Text heraus. */
interface RunnerPhoneBridge {
  exportMessages(json: string): string;
  archiveMarkers(): string;
  setArchiveMarkers(json: string): string;
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
  exportMessages: (o) => Phone.exportMessages(o),
  archiveMarkers: () => Phone.archiveMarkers(),
  setArchiveMarkers: (o) => Phone.setArchiveMarkers(o),
  part: (o) => Phone.part(o),
  writeContacts: (o) => Phone.writeContacts(o)
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
    exportMessages: async (o) => ask<ExportPage>(bridge.exportMessages(JSON.stringify(o))),
    archiveMarkers: async () => ask<{ sms: number; mms: number }>(bridge.archiveMarkers()),
    setArchiveMarkers: async (o) => { ask<unknown>(bridge.setArchiveMarkers(JSON.stringify(o))); },
    part: async (o) => ask<{ type: string; data: string }>(bridge.part(JSON.stringify(o))),
    writeContacts: async (o) => ask<{ added: number; updated: number; removed: number; total: number }>(bridge.writeContacts(JSON.stringify(o)))
  };
}
