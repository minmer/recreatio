/**
 * Anmelden — der Browser-Teil.
 *
 * <b>Das Passwort verlässt diesen Rechner nicht.</b> Aus ihm entsteht hier ein
 * `PasswordKey` (Argon2id, 64 MiB), und nur der geht an den Dienst. Der Dienst
 * kann das Passwort deshalb nicht kennen — und deshalb auch nicht verlieren.
 *
 * <b>Dieselben Zahlen wie im Kernel.</b> 64 MiB, 3 Durchgänge, 32 Byte. Weichen
 * sie ab, entsteht ein anderer Schlüssel, und die Anmeldung scheitert mit einer
 * Meldung, die auf ein falsches Passwort zeigt — obwohl das Passwort stimmt.
 * Deshalb stehen sie hier als benannte Werte und nicht in einem Aufruf.
 */

import { argon2id } from 'hash-wasm';

import { fromBase64Url, toBase64Url } from './crypto';

/**
 * Wo der Dienst liegt.
 *
 * Im Betrieb api.recreatio.pl. In der Entwicklung `/api` auf demselben
 * Ursprung — der Entwicklungsserver leitet es an `backend/Api` weiter
 * (vite.config.ts), und das Sitzungskeks kommt ohne CORS zurück.
 *
 * `VITE_APP_API` überschreibt beides. Nie relativ im Bau: recreatio.pl ist
 * GitHub Pages und antwortet auf jedes POST mit 405.
 */
const API = (
  import.meta.env.VITE_APP_API || (import.meta.env.DEV ? '/api' : 'https://api.recreatio.pl')
).replace(/\/+$/, '');

/** Muss mit `Password` im Kernel übereinstimmen. */
const ARGON = { memoryKiB: 64 * 1024, iterations: 3, parallelism: 1, outputBytes: 32, saltBytes: 16 } as const;

export interface Who {
  readonly accountId: string;
  readonly loginId: string;

  /**
   * Die Hülle des Hauptschlüssels, unter dem PasswordKey versiegelt.
   *
   * Für den Dienst ein Byte-Feld; für diesen Browser der Anfang der Kette, an
   * deren Ende ein lesbarer Rollenname steht. Ohne das Passwort öffnet sie
   * niemand — deshalb darf sie mit der Sitzung mitkommen.
   */
  readonly masterKeySealed: string;
}

/* Base64URL steht in `crypto.ts`: dort wird es am häufigsten gebraucht, und
   zwei Fassungen derselben Kodierung laufen irgendwann auseinander. */

/**
 * Der teure Lauf. Läuft in WebAssembly und ist auf einem Telefon spürbar —
 * das ist beabsichtigt: genau diese Kosten hat auch, wer rät.
 *
 * Wer ihn aufruft, sollte vorher etwas anzeigen. Eine Oberfläche, die eine
 * Sekunde nicht reagiert, sieht kaputt aus, egal wie gut der Grund ist.
 */
async function derivePasswordKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const hex = await argon2id({
    password,
    salt,
    memorySize: ARGON.memoryKiB,
    iterations: ARGON.iterations,
    parallelism: ARGON.parallelism,
    hashLength: ARGON.outputBytes,
    outputType: 'hex'
  });

  const out = new Uint8Array(ARGON.outputBytes);
  for (let i = 0; i < ARGON.outputBytes; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Die Antwort des Dienstes, oder eine Meldung, die man zeigen kann. */
export class WorkspaceError extends Error {}

/** In der Entwicklung ist die Ursache fast immer, dass der Dienst nicht läuft. */
const UNREACHABLE = import.meta.env.DEV
  ? 'Usługa nie odpowiada. Uruchom ją: dotnet run --project backend/Api'
  : 'Nie udało się połączyć z usługą.';

/**
 * Der eine Weg zum Dienst.
 *
 * Auch für alles ausserhalb der Anmeldung: `credentials`, die Fehlerform des
 * Dienstes (`{error}`) und die Unterscheidung „Dienst antwortet nicht" von
 * „Dienst sagt nein" stehen hier EINMAL. Ein zweiter `fetch` daneben hätte
 * seine eigene Meinung zu allen dreien.
 */
export async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      // Die Sitzung reist im Keks — ohne das schickt der Browser ihn bei einer
      // fremden Herkunft nicht mit.
      credentials: 'include',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      ...init
    });
  } catch {
    throw new WorkspaceError(UNREACHABLE);
  }

  if (!response.ok) {
    const said = await response.json().catch(() => null);

    if (said !== null && typeof said === 'object' && 'error' in said) {
      throw new WorkspaceError(String((said as { error: unknown }).error));
    }

    // Keine Antwort des Dienstes, sondern des Weiterleiters: der Dienst läuft
    // nicht. Ein nacktes „Nie udało się." liesse raten, woran es liegt.
    throw new WorkspaceError(response.status >= 500 ? UNREACHABLE : 'Nie udało się.');
  }

  return (await response.json()) as T;
}

/**
 * Ist gerade jemand angemeldet?
 *
 * <b>Ein Fehlschlag heisst NEIN.</b> Kein Netz, kein Dienst, keine Sitzung —
 * in jedem dieser Fälle ist die richtige Antwort dieselbe. Ein `catch`, das
 * jemanden zurückgäbe, wäre ein Zugang, der aus einem Netzfehler entsteht.
 */
export async function whoIsThere(): Promise<Who | null> {
  try {
    return await call<Who>('/session');
  } catch {
    return null;
  }
}

/**
 * Anmelden.
 *
 * Zwei Schritte, und der erste ist kein Umweg: das Salz gehört zum Konto und
 * muss geholt werden, BEVOR gerechnet werden kann. Es ist kein Geheimnis — es
 * ist das, was zwei gleiche Passwörter verschieden rechnen lässt.
 */
export async function signIn(loginId: string, password: string): Promise<Who> {
  const key = await keyFor(loginId, password);

  const who = await call<Who>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, passwordKeyBase64Url: toBase64Url(key) })
  });

  held = key;
  return who;
}

/* -- Der PasswordKey bleibt hier -------------------------------------------
 *
 * <b>Im Speicher dieses Tabs und sonst nirgends.</b> Ohne ihn öffnet sich kein
 * Rollenname: er führt zum Hauptschlüssel, der Hauptschlüssel zu den
 * Rollenschlüsseln. Der Altbestand legte ihn dafür in `sessionStorage` und
 * schickte ihn sogar an den Server; beides ist eine Abkürzung, die der Neubau
 * nicht nimmt — was in einem Speicher liegt, überlebt den Tab und liest jedes
 * Skript, das je auf diese Seite gerät.
 *
 * Der Preis steht in `keys.ts`: nach einem Neuladen ist er fort, und wer die
 * Namen sehen will, tippt sein Passwort noch einmal. Die Sitzung selbst bleibt
 * davon unberührt — angemeldet ist man weiterhin.
 */
let held: Uint8Array | null = null;

/** Der PasswordKey dieses Tabs, oder `null` nach einem Neuladen. */
export const heldPasswordKey = (): Uint8Array | null => held;

/** Das Salz holen und rechnen — der teure Teil, an einer Stelle. */
async function keyFor(loginId: string, password: string): Promise<Uint8Array> {
  const { passwordSaltBase64Url } = await call<{ passwordSaltBase64Url: string }>(
    `/auth/salt?loginId=${encodeURIComponent(loginId)}`
  );

  return derivePasswordKey(password, fromBase64Url(passwordSaltBase64Url));
}

/**
 * Nach einem Neuladen die Schlüssel zurückholen, ohne sich neu anzumelden.
 *
 * Es wird NICHT geprüft, ob das Passwort stimmt — das entscheidet sich beim
 * ersten Öffnen einer Hülle (`keys.ts`). Ein zweiter Anmeldeaufruf nur zur
 * Prüfung wäre eine zweite Sitzung für nichts.
 */
export async function unlock(loginId: string, password: string): Promise<Uint8Array> {
  held = await keyFor(loginId, password);
  return held;
}

/**
 * Ein Konto anlegen.
 *
 * Das Salz entsteht HIER, zufällig, und reist mit dem Schlüssel: der Dienst
 * speichert genau das, womit gerechnet wurde. Jedes andere — ein vom Dienst
 * gewürfeltes, das Scheinsalz von `/auth/salt` — ergäbe bei der nächsten
 * Anmeldung einen anderen Schlüssel, und die scheiterte, immer.
 */
export async function register(loginId: string, password: string): Promise<Who> {
  const salt = crypto.getRandomValues(new Uint8Array(ARGON.saltBytes));
  const key = await derivePasswordKey(password, salt);

  const who = await call<Who>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      loginId,
      passwordSaltBase64Url: toBase64Url(salt),
      passwordKeyBase64Url: toBase64Url(key)
    })
  });

  held = key;
  return who;
}

export async function signOut(): Promise<void> {
  // Zuerst der Schlüssel, dann der Dienst: scheitert der Aufruf, soll trotzdem
  // nichts mehr im Speicher liegen.
  held = null;

  try { await call<{ ok: boolean }>('/auth/logout', { method: 'POST' }); }
  catch { /* Abmelden scheitert nicht sichtbar: der Keks ist ohnehin fort. */ }
}
