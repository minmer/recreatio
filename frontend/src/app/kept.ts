/**
 * Der PasswordKey soll einen NEUSTART überstehen — ohne dass der Dienst ihn liest.
 *
 * <b>Zwei Hälften, und keine genügt allein.</b> Dieses Gerät behält einen
 * Zufallsschlüssel im `localStorage`; der Dienst behält den PasswordKey, unter
 * genau diesem Schlüssel versiegelt. Was wo liegt, entscheidet, was ein
 * Angreifer davon hat:
 *
 * <code>
 *   nur die Datenbank   Hüllen ohne Öffner                    nichts
 *   nur dieses Gerät    Öffner ohne Hülle*                    nichts
 *   beides zusammen     alles
 *
 *   * die Hülle gibt der Dienst nur gegen eine gültige Sitzung heraus
 * </code>
 *
 * <b>Warum die AAD auf das KONTO lautet und nicht auf das Gerät.</b> Auf einem
 * Rechner können zwei Menschen arbeiten; beide benutzen denselben
 * Geräteschlüssel, denn der gehört dem Browser. Nennte die AAD das Gerät,
 * hätten beide Hüllen dasselbe Etikett — und die eine ginge unter dem anderen
 * Konto auf. Der Kontoname trennt sie.
 *
 * <b>Was hier NICHT geschieht.</b> Der Schlüssel wird nicht im Klartext
 * abgelegt, weder hier noch dort. Was im `localStorage` liegt, ist der Öffner —
 * für sich genommen wertlos, solange niemand angemeldet ist.
 *
 * Die strenge Betriebsart (`tab`) benutzt diese Datei gar nicht: dort lebt der
 * Schlüssel nur im Speicher, und beim Umschalten wirft der Dienst die Hüllen weg.
 */

import { aad, Field, fromBase64Url, KEY_SIZE, open, seal, toBase64Url } from './crypto';

/** Die Fassung steht im Namen: ändert sich die Form, beginnt ein neues Gerät. */
const SLOT = 'recreatio:device:v1';

export interface Device {
  /** Sagt dem Dienst, WELCHE Hülle zu holen ist. Kein Geheimnis. */
  readonly id: string;
  /** Der Öffner. Verlässt dieses Gerät nie. */
  readonly key: Uint8Array;
}

/**
 * Das Etikett der Hülle.
 *
 * Auf das Konto, nicht auf das Gerät — siehe oben. `account_key` ist der Ort,
 * an dem sie liegt, und benennt damit die Sache, um die es geht.
 */
const keptAad = (accountId: string) =>
  aad('kernel', 'account_key', accountId, Field.AccountKeptKey, 1);

/**
 * Was im Speicher dieses Browsers liegt — oder `null`.
 *
 * <b>Jeder Zugriff ist eingefasst.</b> `localStorage` wirft, wenn der Browser
 * ihn sperrt (privates Fenster, abgeschaltete Seitendaten). Das ist kein
 * Fehler, sondern eine Einstellung — und die richtige Antwort darauf ist, den
 * Schlüssel eben nicht aufzubewahren, nicht ein Absturz.
 */
function stored(): Device | null {
  try {
    const raw = localStorage.getItem(SLOT);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { id, key } = parsed as { id?: unknown; key?: unknown };
    if (typeof id !== 'string' || typeof key !== 'string' || id === '') return null;

    const opener = fromBase64Url(key);
    return opener.length === KEY_SIZE ? { id, key: opener } : null;
  } catch {
    return null;
  }
}

/**
 * Dieses Gerät — vorhanden oder neu gewürfelt.
 *
 * `null` heisst: dieser Browser lässt nichts ablegen. Dann bleibt es beim
 * Schlüssel im Speicher, und nach dem Neuladen wird nach dem Passwort gefragt.
 */
/**
 * Nur NACHSEHEN, ob dieses Gerät schon eines ist.
 *
 * Getrennt von <see cref="device"/>, weil Nachsehen nichts anlegen darf: wer
 * bloss prüft, ob etwas verwahrt liegt, soll dabei keine Gerätekennung in den
 * Speicher schreiben.
 */
export const knownDevice = (): Device | null => stored();

export function device(): Device | null {
  const found = stored();
  if (found !== null) return found;

  try {
    const made: Device = {
      id: crypto.randomUUID(),
      key: crypto.getRandomValues(new Uint8Array(KEY_SIZE))
    };

    localStorage.setItem(SLOT, JSON.stringify({ id: made.id, key: toBase64Url(made.key) }));
    return made;
  } catch {
    return null;
  }
}

/**
 * Den Öffner wegwerfen.
 *
 * Danach ist jede Hülle, die noch beim Dienst liegt, für immer zu — auch die
 * dieses Geräts. Gedacht für „dieses Gerät vergessen", nicht fürs Abmelden:
 * beim Abmelden geht die Hülle weg, nicht der Öffner.
 */
export function forgetDevice(): void {
  try { localStorage.removeItem(SLOT); } catch { /* gesperrt heisst: liegt ohnehin nichts */ }
}

/** Den PasswordKey versiegeln — fertig für den Dienst, der ihn nicht öffnet. */
export const sealKept = async (
  accountId: string, on: Device, passwordKey: Uint8Array
): Promise<string> =>
  toBase64Url(await seal(on.key, keptAad(accountId), passwordKey));

/** Und zurück. Wirft, wenn die Hülle nicht zu diesem Gerät und Konto gehört. */
export const openKept = async (
  accountId: string, on: Device, sealedText: string
): Promise<Uint8Array> =>
  open(on.key, keptAad(accountId), fromBase64Url(sealedText));
