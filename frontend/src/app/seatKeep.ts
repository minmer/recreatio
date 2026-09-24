/**
 * Der Schlüssel eines Platzes — aus der Adresszeile heraus und in den Browser.
 *
 * <b>Warum nicht in ein Cookie.</b> Ein Cookie geht bei JEDEM Aufruf an den
 * Dienst. Der Platzschlüssel ist genau das, womit sich die Einsendung eines
 * Menschen öffnen lässt; ihn in ein Cookie zu legen hiesse, ihn dem Dienst bei
 * jedem Bild mitzuschicken — und damit wäre die ganze Bauweise dahin. Der
 * Dienst speichert Hüllen, die er nicht öffnen kann; ein Cookie machte ihn zu
 * dem, der den Schlüssel hat.
 *
 * <b>Der Weg, den das Haus schon kennt.</b> Für den PasswordKey steht er in
 * `kept.ts`: was bleiben soll, bleibt im `localStorage` dieses Browsers, und
 * der Dienst bekommt davon nichts. Hier gilt dasselbe, nur einfacher — ein
 * Platz hat keine Sitzung, unter der sich eine zweite Hälfte verwahren liesse.
 *
 * <b>Und es ist besser als vorher, nicht schlechter.</b> Bisher stand der
 * Schlüssel in der Adresszeile: im Verlauf, in jedem Lesezeichen, in jedem
 * Bildschirmfoto, in jedem „schau mal" über die Schulter. Ein Wert im
 * `localStorage` steht an keiner dieser Stellen — und an den Dienst geht er
 * weiterhin nie.
 *
 * <b>Wozu es sonst noch gut ist.</b> Solange er hier liegt, gilt er auf der
 * ganzen Adresse: wer seinen Link einmal geöffnet hat, sieht sein Eigenes auch
 * auf einer anderen Seite derselben Pfarrei, ohne den Link noch einmal
 * herauszusuchen.
 */

import { fromBase64Url, toBase64Url } from './crypto';

/** Die Fassung steht im Namen: ändert sich die Form, beginnt sie von vorn. */
const SLOT = 'recreatio:seat:v1';

/** Wie viele Plätze ein Browser behält, bevor der älteste weicht. */
const KEEP = 12;

interface Held {
  readonly token: string;

  /** Base64URL — hier liegt kein Byte-Feld, sondern Text. */
  readonly key: string;

  /** Wann er zuletzt gebraucht wurde. Der älteste weicht zuerst. */
  readonly at: number;
}

/**
 * Jeder Zugriff ist eingefasst.
 *
 * `localStorage` wirft, wenn der Browser ihn abgeschaltet hat oder die Seite
 * in einem privaten Fenster läuft. Ein Platz, der dann nicht bleibt, ist kein
 * Absturz — er gilt für dieses eine Bild, wie vorher auch.
 */
function read(): readonly Held[] {
  try {
    const raw = window.localStorage.getItem(SLOT);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((one): one is Held =>
      typeof one === 'object' && one !== null
      && typeof (one as Held).token === 'string'
      && typeof (one as Held).key === 'string');
  } catch {
    return [];
  }
}

function write(held: readonly Held[]): void {
  try {
    /* Der zuletzt gebrauchte zuerst, und nur so viele wie vereinbart. */
    const keep = [...held].sort((a, b) => b.at - a.at).slice(0, KEEP);
    window.localStorage.setItem(SLOT, JSON.stringify(keep));
  } catch {
    // Kein Platz, kein Speicher, kein Drama.
  }
}

/** Den Schlüssel zu diesem Platz behalten — oder seinen Zeitstempel auffrischen. */
export function remember(token: string, key: Uint8Array): void {
  const now = Date.now();
  const mine = { token, key: toBase64Url(key), at: now };

  write([mine, ...read().filter((one) => one.token !== token)]);
}

/**
 * Den Schlüssel zu diesem Platz — oder `null`.
 *
 * Ein Abruf frischt den Zeitstempel auf: wer seinen Platz benutzt, soll ihn
 * nicht verlieren, weil er zwölf andere Links angeklickt hat.
 */
export function recall(token: string): Uint8Array | null {
  const held = read();
  const mine = held.find((one) => one.token === token);
  if (mine === undefined) return null;

  try {
    const key = fromBase64Url(mine.key);
    write(held.map((one) => (one.token === token ? { ...one, at: Date.now() } : one)));
    return key;
  } catch {
    /* Unlesbar abgelegt — dann ist er fort, und das sagt der Aufrufer. */
    forget(token);
    return null;
  }
}

/**
 * Vergessen.
 *
 * <b>Es nimmt niemandem etwas weg ausser diesem Browser.</b> Der Platz steht
 * weiter; wer den Link noch hat, kommt wieder hinein. Das ist der Unterschied
 * zum Zurücknehmen durch die Kanzlei (`revokeSeat`), und beide sind nötig.
 */
export function forget(token: string): void {
  write(read().filter((one) => one.token !== token));
}

/** Welche Plätze dieser Browser gerade hält — der zuletzt gebrauchte zuerst. */
export const heldSeats = (): readonly string[] =>
  [...read()].sort((a, b) => b.at - a.at).map((one) => one.token);

/* -- Der Weg aus der Adresse heraus ---------------------------------------- */

/**
 * Trägt diese Adresse einen Platzschlüssel? Dann wegräumen — und sagen, wie die
 * Adresse ohne ihn heisst.
 *
 * <b>`null` heisst: hier war keiner</b>, und dann bleibt die Adresse, wie sie
 * ist. Jede andere Antwort ist die aufgeräumte Fassung, die der Aufrufer an
 * die Stelle der alten setzt.
 *
 * <b>Der Abdruck bleibt stehen.</b> `…/portal/<token>` ist weiterhin die
 * Adresse dieses Platzes — sie geht ohnehin an den Dienst, sie ist kein
 * Geheimnis, und ohne sie wüsste die Seite nicht mehr, welcher Platz gemeint
 * ist. Fort kommt nur der zweite Teil.
 */
export function keepFromAddress(hash: string): string | null {
  const marker = hash.indexOf('#');
  const path = marker >= 0 ? hash.slice(marker + 1) : hash;

  const raw = path.split(/[?&]/)[0];
  const segments = raw.split('/').filter((one) => one.length > 0);

  /*
   * ZWEI FORMEN, EIN SCHLÜSSEL.
   *
   * `…/<seite>/portal/<token>/<key>` gehört einer Seite — der Schüler liest
   * die Adresse seiner Schule und dahinter seinen Platz. `#/seat/<token>/<key>`
   * bleibt für Plätze, die unter keiner Seite hängen. Nur die erste hier zu
   * kennen hiesse, den Schlüssel in der zweiten stehen zu lassen.
   */
  const at = segments[0] === 'seat' ? 0 : segments.indexOf('portal');

  /* `<marker>/<token>/<key>` — ohne den dritten Teil ist nichts wegzuräumen. */
  if (at < 0 || segments.length < at + 3) return null;

  const token = segments[at + 1];
  const key = segments[at + 2];

  if (token === '' || key === '') return null;

  try {
    remember(token, fromBase64Url(key));
  } catch {
    /* Kein lesbarer Schlüssel. Dann steht er auch nicht in der Adresse
       herum — was nicht aufgeht, nützt dort niemandem. */
  }

  return `#/${segments.slice(0, at + 2).join('/')}`;
}
