/**
 * GIBT ES DAS TELEFON? — das Wenige, was der Arbeitsplatz über die Ausgabe
 * „sms" wissen muss, ohne ihr Bündel zu laden: ob sie hier läuft, ob SMS und
 * Kontakte im Menü stehen, und wohin „Napisz SMS" führt.
 */

import { Capacitor } from '@capacitor/core';

import { useRemembered } from '../core/prefs';

/** Gemerkt am Konto, sobald die Ausgabe „sms" einmal lief — dann stehen SMS und Kontakte auch im Browser im Menü. */
export const PHONE_PREF = 'phone.on';

/** Läuft hier die Ausgabe „sms" der App? Nur dann gibt es das Telefon (den Baustein `Phone`). */
export const phoneHere = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Phone');
  } catch {
    return false;
  }
};

/** Stehen SMS und Kontakte im Menü? Auf dem Telefon immer; im Browser, wenn das Konto sie hat. */
export function usePhoneShown(): boolean {
  const [on] = useRemembered(PHONE_PREF, '');
  return phoneHere() || on === 'on';
}

/**
 * „Napisz SMS" aus einer Ansicht (Formularze → Osoby): in der Ausgabe „sms" ein
 * Blatt über der Seite, das gleich sendet (`SmsSheet`) — `true`. Sonst `false`,
 * und der Aufrufer öffnet die SMS-App des Geräts (`sms:`).
 */
export function smsInApp(number: string, body: string): boolean {
  if (!phoneHere()) return false;
  void import('./SmsSheet').then((m) => m.showSmsSheet(number, body));
  return true;
}
