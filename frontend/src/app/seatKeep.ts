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

  /**
   * Zu WELCHER Seite dieser Platz gehört — die, an der sein Link hing.
   *
   * <b>Damit eine Seite ihren Platz findet, ohne zu fragen.</b> Sonst
   * müsste jede öffentliche Seite für jeden behaltenen Platz beim Dienst
   * nachschlagen, wohin er gehört — zwölf Aufrufe, um meistens nichts zu
   * finden. Im Link steht es ohnehin: `#/<seite>?miejsce=…` (und in alten
   * Links alles vor `portal`).
   */
  readonly under: string | null;

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

/**
 * Den Schlüssel zu diesem Platz behalten — oder seinen Zeitstempel auffrischen.
 *
 * <b>`under` nur, wenn es bekannt ist.</b> Wer aus dem Link kommt, weiss es;
 * wer den Platz später noch einmal öffnet, nicht unbedingt — und dann soll
 * das, was schon dasteht, nicht mit `null` überschrieben werden.
 */
export function remember(token: string, key: Uint8Array, under?: string | null): void {
  const held = read();
  const was = held.find((one) => one.token === token);

  const mine: Held = {
    token,
    key: toBase64Url(key),
    under: under === undefined ? was?.under ?? null : under,
    at: Date.now()
  };

  write([mine, ...held.filter((one) => one.token !== token)]);
}

/**
 * DIE PLÄTZE, DIE ZU DIESER SEITE GEHÖREN — ALLE, nicht einer.
 *
 * <b>Es war einer, und das war zu wenig.</b> Wer zwei Links geöffnet hat —
 * die eigenen Kinder, zwei Gruppen, zwei Rollen in derselben Pfarrei —, sah
 * danach nur noch den zuletzt geöffneten. Der andere Schlüssel lag weiter
 * im Browser; die Seite fragte bloss nicht nach ihm.
 *
 * <b>Erst genau, dann grosszügig.</b> Die, die genau unter dieser Seite
 * stehen, kommen zuerst; danach die übrigen desselben Hauses, der zuletzt
 * gebrauchte vorn — denn „mein Eigenes auch auf einer anderen Seite der
 * Pfarrei" ist der ganze Zweck.
 *
 * <b>Aber nicht über Häuser hinweg.</b> Der Platz eines Schülers darf sich
 * nicht auf der Seite einer fremden Pfarrei auftun: derselbe Browser, zwei
 * Welten. Der erste Schritt der Adresse trennt sie.
 */
export function seatsFor(path: string): readonly string[] {
  const held = [...read()].sort((a, b) => b.at - a.at);
  const house = path.split('/')[0];

  const exact = held.filter((one) => one.under === path);
  const same = house === undefined || house === ''
    ? []
    : held.filter((one) => one.under !== null && one.under !== path && one.under.split('/')[0] === house);

  return [...exact, ...same].map((one) => one.token);
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
 * Das Wort, hinter dem ein Platz an JEDER Seite hängt: `#/<seite>?miejsce=<token>.<key>`.
 *
 * <b>Vorher war der Platz eine eigene Unterseite</b> — `…/candidate/portal/<token>/<key>`
 * —, und der Link öffnete nicht die Seite, die die Kanzlei gewählt hatte,
 * sondern eine eingebaute Ansicht UNTER ihr. Jetzt öffnet er die Seite
 * selbst: mit ihren Bausteinen, und die persönlichen darunter zeigen, was
 * diesem Menschen gehört.
 *
 * <b>Hinter der Raute, hinter einem `?`.</b> Beides geht nie an einen Server;
 * `parsePath` liest den Pfad nur bis zum `?`. So lässt sich der Schlüssel an
 * jede Adresse hängen, ohne dass sie dadurch eine andere Seite würde.
 */
const PARAM = 'miejsce';

/** Die Adresse einer Seite MIT einem Platz — was verschickt wird. */
export function pageLink(under: string, token: string, keyText: string): string {
  return `#/${under.split('/').map(encodeURIComponent).join('/')}?${PARAM}=${encodeURIComponent(token)}.${encodeURIComponent(keyText)}`;
}

/**
 * Welcher Platz gerade ÜBER EINEN LINK hereinkam — damit die Seite sagen kann,
 * wenn er nicht aufgeht. Ein behaltener Platz, der nicht aufgeht, bleibt still;
 * einer, den jemand gerade angeklickt hat, darf das nicht.
 */
export interface FreshSeat {
  readonly token: string;
  readonly under: string | null;

  /** Der Link trug keinen Schlüssel — etwa ein altes Lesezeichen `…/portal/<token>`. */
  readonly keyless: boolean;
}

let fresh: FreshSeat | null = null;

export const freshSeat = (): FreshSeat | null => fresh;

/**
 * Trägt diese Adresse einen Platzschlüssel? Dann wegräumen — und sagen, wie die
 * Adresse ohne ihn heisst.
 *
 * <b>`null` heisst: hier war keiner</b>, und dann bleibt die Adresse, wie sie
 * ist. Jede andere Antwort ist die aufgeräumte Fassung, die der Aufrufer an
 * die Stelle der alten setzt.
 *
 * <b>Drei Formen, eine Richtung.</b>
 *
 * <code>
 *   #/<seite>?miejsce=<token>.<key>     die Seite, mit dem Platz          (neu)
 *   #/<seite>/portal/<token>[/<key>]    dieselbe Seite — alte Links gelten weiter
 *   #/seat/<token>/<key>                ein Platz ohne Seite — seine eigene Ansicht
 * </code>
 *
 * Die ersten beiden enden auf der SEITE; der Schlüssel liegt danach im
 * Browser und gilt dort wie auf jeder anderen Seite desselben Hauses.
 */
export function keepFromAddress(hash: string): string | null {
  const marker = hash.indexOf('#');
  const after = marker >= 0 ? hash.slice(marker + 1) : hash;

  const cut = after.search(/[?&]/);
  const raw = cut >= 0 ? after.slice(0, cut) : after;
  const params = cut >= 0 ? after.slice(cut + 1).split('&').filter((one) => one !== '') : [];
  const segments = raw.split('/').filter((one) => one.length > 0);

  const decoded = (one: string) => { try { return decodeURIComponent(one); } catch { return one; } };
  const pathOf = (parts: readonly string[]) => parts.map(decoded).join('/');

  /** Behalten, was geht — und merken, dass es gerade über einen Link kam. */
  const keep = (token: string, keyText: string | undefined, under: string | null) => {
    let keyless = true;

    if (keyText !== undefined && keyText !== '') {
      try {
        remember(token, fromBase64Url(decoded(keyText)), under);
        keyless = false;
      } catch {
        /* Kein lesbarer Schlüssel — dann steht er auch nicht in der Adresse herum. */
      }
    }

    fresh = { token, under, keyless };
  };

  /* 1. `?miejsce=<token>.<key>` — an jeder Seite. */
  const carried = params.find((one) => one.startsWith(`${PARAM}=`));

  if (carried !== undefined) {
    const [token, keyText] = decoded(carried.slice(PARAM.length + 1)).split('.');
    const under = pathOf(segments);

    if (token !== undefined && token !== '') keep(token, keyText, under === '' ? null : under);

    const rest = params.filter((one) => one !== carried);
    return `#/${raw.replace(/^\/+/, '')}${rest.length > 0 ? `?${rest.join('&')}` : ''}`;
  }

  const at = segments[0] === 'seat' ? 0 : segments.indexOf('portal');
  if (at < 0) return null;

  const token = segments[at + 1];
  const keyText = segments[at + 2];

  if (token === undefined || token === '') return null;

  /* 3. `#/seat/<token>/<key>` — ohne Seite; seine Ansicht braucht das Token im Pfad. */
  if (at === 0) {
    if (keyText === undefined || keyText === '') return null;
    keep(token, keyText, null);
    return `#/seat/${token}`;
  }

  /*
   * 2. `…/<seite>/portal/<token>[/<key>]` — ein Link von vorher, oder das
   * Lesezeichen, das nach dem Aufräumen stehen blieb. Er öffnet jetzt die
   * Seite selbst, wie jeder neue.
   */
  const page = segments.slice(0, at);
  keep(token, keyText, pathOf(page));
  return `#/${page.join('/')}`;
}

/* -- Und wieder hinein ----------------------------------------------------- */

/**
 * Der GANZE Link zu diesem Platz — mit Schlüssel, zum Weitergeben.
 *
 * <b>Das ist die Kehrseite des Aufräumens, und ohne sie wäre es ein Verlust.</b>
 * Solange der Schlüssel in der Adresszeile stand, WAR die Adresszeile der Link:
 * kopieren, aufs Telefon schicken, als Lesezeichen ablegen. Nimmt man ihn
 * heraus, ohne einen Weg zurück anzubieten, sitzt der Mensch vor einer Adresse,
 * die bei ihm funktioniert und bei niemandem sonst — und merkt es erst, wenn
 * der andere eine leere Seite sieht.
 *
 * <b>Also gibt der Browser ihn auf Verlangen wieder her.</b> Er hat ihn ja; er
 * zeigt ihn nur nicht ungefragt.
 *
 * `null` heisst: dieser Browser hält ihn nicht. Dann gibt es hier keinen Link
 * mehr, und das ist die Wahrheit — der alte gilt weiter, aber er steht woanders.
 */
export function linkTo(token: string, under?: string | null): string | null {
  const key = recall(token);
  if (key === null) return null;

  /* Die mitgegebene Seite gilt; sonst die, die beim Platz steht. */
  const where = under === undefined
    ? read().find((one) => one.token === token)?.under ?? null
    : under;

  /* Dieselbe Form wie `seat.seatPath` — beide bauen auf `pageLink`. */
  return where === null || where === ''
    ? `#/seat/${encodeURIComponent(token)}/${encodeURIComponent(toBase64Url(key))}`
    : pageLink(where, token, toBase64Url(key));
}

/** Die Plätze, die GENAU zu dieser Seite gehören — der Link hat hierher geführt. */
export const seatsExactly = (path: string): readonly string[] =>
  read().filter((one) => one.under === path).map((one) => one.token);
