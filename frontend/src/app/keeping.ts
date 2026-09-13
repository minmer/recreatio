/**
 * Die Verwahrung des PasswordKey — Betriebsart und Geräte.
 *
 * <b>Getrennt von `kept.ts`.</b> Dort steht, WIE versiegelt wird (und sonst
 * nichts); hier, was der Dienst darüber weiss. Zusammengelegt müsste `kept.ts`
 * `call` aus `session.ts` holen — und `session.ts` holt `kept.ts`. Ein Kreis,
 * der heute trägt und an dem Tag bricht, an dem jemand die Reihenfolge ändert.
 */

import { call, type KeyKeeping } from './session';

export interface KeptDevice {
  readonly deviceId: string;
  readonly createdAt: string;

  /** `null`, solange nie geholt — also seit dem Anlegen nicht gebraucht. */
  readonly lastUsedAt: string | null;
}

export interface Kept {
  readonly keyKeeping: KeyKeeping;
  readonly devices: readonly KeptDevice[];
}

export const loadKept = (): Promise<Kept> => call<Kept>('/workspace/key/devices');

/**
 * Die Betriebsart setzen.
 *
 * <b>Auf `tab` umzuschalten wirft die verwahrten Hüllen weg</b> — alle, auf
 * allen Geräten, im selben Aufruf. Die Antwort sagt, wie viele es waren; das
 * gehört dem Menschen gezeigt, denn es ist der eigentliche Vorgang.
 */
export const setKeyKeeping = (
  mode: KeyKeeping
): Promise<{ keyKeeping: KeyKeeping; forgotten: number }> =>
  call('/workspace/key/mode', { method: 'POST', body: JSON.stringify({ mode }) });

/** Ein einzelnes Gerät vergessen — ohne die übrigen auszusperren. */
export const forgetKept = (deviceId: string): Promise<{ forgotten: number }> =>
  call(`/workspace/key?device=${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
