/**
 * Eine Nummer bestätigen (0030/0031): scharfstellen, mit dem Link aus der SMS einlösen, im Portal selbst bestätigen.
 */

import { toBase64Url } from '../core/crypto';
import { call } from '../core/session';

/* -- Kleinkram -------------------------------------------------------------- */

export async function sha256Of(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

/* -- Eine Nummer bestätigen (0030) ----------------------------------------- */

/** Was an EINEM Wert an Bestätigung hängt. */
export interface ValueCheck {
  readonly fieldId: string;
  readonly sentAt: string;
  readonly expiresAt: string;
  readonly verifiedAt: string | null;

  /**
   * WIE bestätigt wurde (0031) — und die beiden sagen nicht dasselbe.
   *
   * `sms` heisst: jemand hat den Link geöffnet, der an diese Nummer ging —
   * unter ihr war also jemand erreichbar. `self` heisst: der Mensch hat in
   * seinem Portal bestätigt, dass die Angabe stimmt. Das zweite ist weniger,
   * und es als dasselbe anzuzeigen wäre eine Auskunft, die nicht stimmt.
   */
  readonly origin: 'sms' | 'self';
}

/**
 * Eine Bestätigung scharfstellen — und das Geheimnis behalten.
 *
 * <b>Der Dienst bekommt nur den Abdruck.</b> Das Geheimnis entsteht hier, geht
 * in die SMS und steht nirgends sonst; wer die Datenbank liest, sieht, DASS
 * eine Bestätigung aussteht, und kann sie nicht auslösen.
 *
 * Zurück kommt der Token — die Oberfläche baut daraus die Adresse.
 */
export async function armCheck(
  registrationId: string, fieldId: string, days?: number
): Promise<{ token: string; expiresAt: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));

  const done = await call<{ expiresAt: string }>(
    `/workspace/registration/${encodeURIComponent(registrationId)}/check`,
    {
      method: 'POST',
      body: JSON.stringify({
        fieldId,
        tokenSha256: toBase64Url(await sha256Of(token)),
        days: days ?? null
      })
    });

  return { token, expiresAt: done.expiresAt };
}

/**
 * Den Link einlösen — ohne Konto.
 *
 * <b>Zweimal klicken ist kein Fehler.</b> Wer denselben Link noch einmal
 * öffnet, sieht dasselbe wie beim ersten Mal; alles andere wäre eine Absage für
 * etwas, das schon geklappt hat.
 */
export const redeemCheck = (
  token: string
): Promise<{ verified: boolean; at: string; again: boolean }> =>
  call(`/verify/${encodeURIComponent(token)}`, { method: 'POST' });
