/**
 * LINKI DOSTĘPU IN DIESEM BROWSER (0073) — behalten wie die persönlichen
 * Links der Formulare (`seatKeep.ts`): im `localStorage`, mehrere, der
 * zuletzt gebrauchte vorn, nie in einem Cookie. Die Abmeldung vergisst sie
 * nicht: ein Link gehört dem Browser, nicht dem Konto (wie die Plätze).
 *
 * <code>
 *   https://recreatio.pl/#/&lt;ziel&gt;?dostep=&lt;T&gt;     der Link mit Ziel
 *   https://recreatio.pl/#/dolacz/&lt;T&gt;             der Link ohne Ziel (wie bisher)
 * </code>
 *
 * <b>Das Ziel öffnet sich MIT dem Zugang.</b> Beim ersten Bild wird T aus der
 * Adresse genommen und behalten; die Adresse heisst danach nur noch
 * `#/<ziel>`. Jede Seite, jeder Kalender schickt die Beweise aller behaltenen
 * Links mit (`linkAccess.heldProofs`) — die Zugänge addieren sich.
 *
 * <b>Ohne Abhängigkeiten.</b> `main.tsx` nimmt den Link aus der Adresse, bevor
 * es entscheidet, ob Neubau oder Altbestand lädt — ein Ziel im Altbestand
 * soll T nicht in der Adresszeile stehen lassen. Deshalb importiert diese
 * Datei nichts.
 */

const SLOT = 'recreatio:link:v1';

/** Wie viele Links ein Browser behält — wie `HeldLinks.Max` im Dienst. */
export const KEEP_LINKS = 20;

/** Das Wort in der Adresse. */
export const LINK_PARAM = 'dostep';

/** Ein Geheimnis: 32 Bytes in Base64URL. */
const TOKEN = /^[A-Za-z0-9_-]{42,44}$/;

export interface HeldLink {
  readonly token: string;
  /** Wo er aufging (der Weg hinter `#/`) — `null`: über `#/dolacz`. */
  readonly aim: string | null;
  /** Sein Name, sobald bekannt — damit die Liste ihn auch ohne Netz nennt. */
  readonly label: string | null;
  readonly at: number;
}

function read(): HeldLink[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SLOT) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((one): one is HeldLink =>
      typeof one === 'object' && one !== null && typeof (one as HeldLink).token === 'string' && TOKEN.test((one as HeldLink).token));
  } catch {
    return [];
  }
}

function write(held: readonly HeldLink[]): void {
  try {
    window.localStorage.setItem(SLOT, JSON.stringify([...held].sort((a, b) => b.at - a.at).slice(0, KEEP_LINKS)));
  } catch {
    /* Privates Fenster, abgeschalteter Speicher: dann gilt der Link nur für dieses Bild. */
  }
  try { window.dispatchEvent(new Event('recreatio:links-changed')); } catch { /* kein Fenster */ }
}

/** Behalten — oder auffrischen. Ein bekanntes Ziel oder ein bekannter Name wird nicht mit `null` überschrieben. */
export function rememberLink(token: string, aim: string | null, label?: string | null): void {
  if (!TOKEN.test(token)) return;
  const held = read();
  const was = held.find((one) => one.token === token);
  write([
    { token, aim: aim ?? was?.aim ?? null, label: label ?? was?.label ?? null, at: Date.now() },
    ...held.filter((one) => one.token !== token)
  ]);
}

/** Den Namen nachtragen, sobald der Dienst ihn nannte. */
export function nameLink(token: string, label: string | null): void {
  const held = read();
  if (!held.some((one) => one.token === token && one.label !== label)) return;
  try {
    window.localStorage.setItem(SLOT, JSON.stringify(held.map((one) => (one.token === token ? { ...one, label } : one))));
  } catch { /* nichts */ }
}

export const heldLinks = (): readonly HeldLink[] => [...read()].sort((a, b) => b.at - a.at);

export function forgetLink(token: string): void {
  write(read().filter((one) => one.token !== token));
}

/* -- Aus der Adresse ------------------------------------------------------------------ */

let fresh: { token: string; aim: string | null } | null = null;

/** Der Link, der in DIESEM Tab gerade hereinkam — für die Leiste „Otwarto z linku". */
export const freshLink = (): { token: string; aim: string | null } | null => fresh;
export const dismissFresh = (): void => { fresh = null; };

/**
 * Trägt die Adresse einen Link mit Zugang? Dann behalten und die Adresse ohne
 * ihn zurückgeben. `null`: nichts zu tun (auch bei `#/dolacz/<T>` — dort
 * braucht die Ansicht das Geheimnis im Pfad; behalten wird es trotzdem).
 */
export function keepLinkFromAddress(hash: string): string | null {
  const marker = hash.indexOf('#');
  const after = (marker >= 0 ? hash.slice(marker + 1) : hash).replace(/^\/+/, '');

  const dolacz = /^dolacz\/([A-Za-z0-9_-]{42,44})(?:[/?].*)?$/.exec(after);
  if (dolacz !== null) {
    rememberLink(dolacz[1]!, null);
    return null;
  }

  const cut = after.indexOf('?');
  if (cut < 0) return null;
  const path = after.slice(0, cut);
  const params = after.slice(cut + 1).split('&').filter((one) => one !== '');
  const carried = params.find((one) => one.startsWith(`${LINK_PARAM}=`));
  if (carried === undefined) return null;

  let token = carried.slice(LINK_PARAM.length + 1);
  try { token = decodeURIComponent(token); } catch { /* wie es steht */ }
  const rest = params.filter((one) => one !== carried);
  const aim = `${path}${rest.length > 0 ? `?${rest.join('&')}` : ''}`;

  if (TOKEN.test(token)) {
    rememberLink(token, aim === '' ? null : aim);
    fresh = { token, aim: aim === '' ? null : aim };
  }
  return `#/${aim}`;
}

/** Die Adresse, die verschickt wird. */
export function linkHref(base: string, token: string, aim: string | null): string {
  if (aim === null || aim === '') return `${base}#/dolacz/${token}`;
  return `${base}#/${aim}${aim.includes('?') ? '&' : '?'}${LINK_PARAM}=${token}`;
}
