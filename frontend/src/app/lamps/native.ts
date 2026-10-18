/**
 * DER SENDER IM TELEFON (2026-10-18) — der Baustein `Lamp` der Ausgabe „sms"
 * (`android/app/src/sms/…/LampPlugin.java`): eine echte BLE-Werbung über
 * `BluetoothLeAdvertiser`, nicht Web Bluetooth (das kann nicht werben).
 *
 * <code>
 *   support            Bluetooth da und an? Werben möglich? Erlaubnis?
 *   requestPermission  „Urządzenia w pobliżu" (BLUETOOTH_ADVERTISE, Android 12+)
 *   send               Ramki nacheinander: starten, Rückruf abwarten, halten, stoppen
 *   stop               das Laufende (und Wartende) abbrechen
 *   openSettings       die Bluetooth-Einstellungen des Telefons
 *
 *   requestScanPermission, startScan, stopScan — vom Pilot lernen (learn.ts):
 *   was das Telefon hört, kommt gebündelt als `lampScan`, das Ende als `lampScanEnd`
 *   setTimers, timerStatus, setTimersOn — die Timer (timers.ts): der Plan liegt im
 *   Telefon, ein Wecker sendet zur Zeit, auch bei geschlossener App
 * </code>
 *
 * Im Browser und in der gewöhnlichen App gibt es ihn nicht (`lampHere()`):
 * dort lassen sich Lampen und Sygnały einstellen, aber nicht senden.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type PermissionWord = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

/** Wie ein Senden ausging — dieselben Wörter wie in `LampPlugin.java`. */
export type LampCode =
  | 'ok'
  | 'no-bluetooth' | 'bluetooth-off' | 'no-advertiser' | 'no-permission'
  | 'data-too-large' | 'too-many-advertisers' | 'already-started' | 'internal-error' | 'feature-unsupported'
  | 'no-callback' | 'stopped' | 'paused' | 'bad-frame' | 'error'
  /* Nur im Browser gesetzt: es gibt hier keinen Sender. */
  | 'unavailable';

export interface LampSupport {
  /** Hat das Telefon Bluetooth? */
  readonly bluetooth: boolean;
  /** Bluetooth Low Energy (FEATURE_BLUETOOTH_LE). */
  readonly le: boolean;
  readonly enabled: boolean;
  /** Gibt Android einen `BluetoothLeAdvertiser` her? (Nur bei eingeschaltetem Bluetooth bekannt.) */
  readonly advertiser: boolean;
  /** `isMultipleAdvertisementSupported` — mehrere Werbungen zugleich. */
  readonly multiple: boolean;
  /** `isLeExtendedAdvertisingSupported` (Android 8+). */
  readonly extended: boolean;
  /** `getLeMaximumAdvertisingDataLength` — 31 für Legacy. */
  readonly maxLength: number;
  /** Senden: BLUETOOTH_ADVERTISE (Android 12+; davor bei der Installation erteilt). */
  readonly permission: PermissionWord;
  /** Hören: BLUETOOTH_SCAN (Android 12+), davor die genaue Lage. */
  readonly scanPermission: PermissionWord;
  readonly scanner: boolean;
  /** Bis Android 11 hört ein Scan nur bei eingeschalteter Lokalisierung. */
  readonly locationNeeded: boolean;
  readonly locationOn: boolean;
  readonly sdk: number;
}

/** Ein gehörtes Paket. */
export interface NativePacket {
  readonly address: string;
  readonly rssi: number;
  /** Was Android liefert (Werbung + Scan-Antwort, mit Nullen aufgefüllt), hex. */
  readonly hex: string;
  /** Uhrzeit in ms, aus dem Zeitstempel des Empfangs. */
  readonly at: number;
  readonly name: string | null;
}

export type ScanCode =
  | 'ok'
  | 'no-bluetooth' | 'bluetooth-off' | 'no-scanner' | 'no-permission' | 'location-off'
  | 'already-started' | 'registration-failed' | 'internal-error' | 'feature-unsupported' | 'out-of-resources' | 'too-frequently'
  | 'timeout' | 'stopped' | 'paused' | 'error';

export interface NativeFrame {
  /** 0…0xFFFF. */
  readonly manufacturerId: number;
  /** Die Daten des Herstellers NACH der Kennung, hex. */
  readonly data: string;
  readonly durationMs: number;
  /** Pause nach dieser Ramka, bevor die nächste startet. */
  readonly gapMs: number;
}

export interface NativeFrameResult {
  readonly index: number;
  readonly code: LampCode;
  readonly requestedMs: number;
  /** Wie lange Android bis zum Rückruf brauchte. */
  readonly startMs?: number;
  /** Uhrzeit (ms) des Rückrufs „gestartet" und des Stopps. */
  readonly startedAt?: number;
  readonly stoppedAt?: number;
  /** Wie lange wirklich geworben wurde (vom Rückruf bis zum Stopp). */
  readonly heldMs?: number;
}

export interface NativeSendResult {
  readonly code: LampCode;
  /** Was Android dazu sagte (Ausnahme, Fehlerzahl) — technisch, für die Fehlersuche. */
  readonly detail: string | null;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly frames: readonly NativeFrameResult[];
}

/** Ein Timer, wie das Telefon ihn ablegt: Minute des Tages, Tage als Bits (0 = jeden Tag), die Ramki je Aktion. */
export interface NativeTimer {
  readonly id: string;
  readonly name: string;
  readonly minute: number;
  /** Bit 0 = Montag … Bit 6 = Sonntag; 0 = jeden Tag. */
  readonly days: number;
  readonly actions: readonly { readonly label: string; readonly frames: readonly NativeFrame[] }[];
}

/** Ein Lauf eines Timers im Telefon. */
export interface TimerRun {
  /** Die geplante Zeit (ms) und wann er wirklich lief. */
  readonly at: number;
  readonly ranAt: number;
  readonly timerId: string;
  readonly name: string;
  readonly ok: number;
  readonly total: number;
  readonly failed: readonly { readonly label: string; readonly code: LampCode; readonly detail: string | null }[];
}

export interface TimerStatus {
  /** Führt dieses Telefon die Timer aus? */
  readonly on: boolean;
  /** Wurde das auf diesem Telefon schon einmal entschieden? (Sonst schaltet der erste Timer es ein.) */
  readonly decided: boolean;
  /** Genaue Wecker erlaubt? Sonst können sie sich um Minuten verspäten (Android 12). */
  readonly exact: boolean;
  readonly count: number;
  readonly next: { readonly at: number; readonly names: readonly string[] } | null;
  readonly log: readonly TimerRun[];
}

export interface LampNative {
  support(): Promise<LampSupport>;
  requestPermission(): Promise<{ granted: boolean }>;
  send(options: { frames: readonly NativeFrame[] }): Promise<NativeSendResult>;
  stop(): Promise<{ stopped: boolean }>;
  openSettings(): Promise<void>;

  requestScanPermission(): Promise<{ granted: boolean }>;
  /** `minRssi`: Leiseres kommt gar nicht erst an; `maxMs`: danach endet der Scan von selbst. */
  startScan(options: { minRssi: number; maxMs: number }): Promise<{ code: ScanCode; detail: string | null }>;
  stopScan(): Promise<{ stopped: boolean }>;
  addListener(event: 'lampScan', listener: (e: { packets: NativePacket[] }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'lampScanEnd', listener: (e: { code: ScanCode; detail: string | null }) => void): Promise<PluginListenerHandle>;

  /** Den Plan der Timer ablegen und den Wecker stellen; `enable`: auf diesem Telefon ein- oder ausschalten. */
  setTimers(options: { timers: readonly NativeTimer[]; enable?: boolean }): Promise<TimerStatus>;
  timerStatus(): Promise<TimerStatus>;
  setTimersOn(options: { on: boolean }): Promise<TimerStatus>;
}

export const LampRadio = registerPlugin<LampNative>('Lamp');

/** Läuft hier die Ausgabe „sms" mit dem Sender? */
export const lampHere = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Lamp');
  } catch {
    return false;
  }
};
