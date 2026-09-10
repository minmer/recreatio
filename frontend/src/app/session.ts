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

/**
 * Wo der Dienst liegt.
 *
 * In der Entwicklung `/api` auf demselben Ursprung — der Entwicklungsserver
 * leitet es an `backend/Api` weiter (vite.config.ts), und das Sitzungskeks
 * kommt ohne CORS zurück.
 *
 * Beim Bau MUSS `VITE_APP_API` gesetzt sein. Ein relativer Pfad landete auf
 * recreatio.pl bei GitHub Pages, und das antwortet auf jedes POST mit 405.
 */
const API = (import.meta.env.VITE_APP_API ?? (import.meta.env.DEV ? '/api' : '')).replace(/\/+$/, '');

/** Muss mit `RcPassword` im Kernel übereinstimmen. */
const ARGON = { memoryKiB: 64 * 1024, iterations: 3, parallelism: 1, outputBytes: 32 } as const;

export interface Who {
  readonly accountId: string;
  readonly loginId: string;
}

/* -- Base64URL --------------------------------------------------------------
 *
 * Ohne `+`, `/` und `=`: der Wert reist in JSON und manchmal in einer Adresse,
 * und die drei Zeichen bedeuten dort etwas anderes.
 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));

  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

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

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (API === '') {
    // Nur in einem Produktionsbau erreichbar: dort ist nichts voreingestellt.
    throw new WorkspaceError(
      'Usługa nowej platformy nie jest podłączona — przy budowaniu brakuje VITE_APP_API.');
  }

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
  const { passwordSaltBase64Url } = await call<{ passwordSaltBase64Url: string }>(
    `/auth/salt?loginId=${encodeURIComponent(loginId)}`
  );

  const key = await derivePasswordKey(password, fromBase64Url(passwordSaltBase64Url));

  return call<Who>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ loginId, passwordKeyBase64Url: toBase64Url(key) })
  });
}

/**
 * Ein Konto anlegen.
 *
 * Das Salz entsteht hier NICHT — der Dienst legt es an und versiegelt den
 * Hauptschlüssel damit. Der Browser schickt nur den abgeleiteten Schlüssel.
 */
export async function register(loginId: string, password: string): Promise<Who> {
  /*
   * Beim Anlegen gibt es noch kein Salz am Konto. Geholt wird trotzdem eines:
   * der Dienst gibt für einen unbekannten Namen ein festes, abgeleitetes
   * zurück — sonst wäre diese Adresse eine Liste aller vorhandenen Konten.
   */
  const { passwordSaltBase64Url } = await call<{ passwordSaltBase64Url: string }>(
    `/auth/salt?loginId=${encodeURIComponent(loginId)}`
  );

  const key = await derivePasswordKey(password, fromBase64Url(passwordSaltBase64Url));

  return call<Who>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ loginId, passwordKeyBase64Url: toBase64Url(key) })
  });
}

export async function signOut(): Promise<void> {
  try { await call<{ ok: boolean }>('/auth/logout', { method: 'POST' }); }
  catch { /* Abmelden scheitert nicht sichtbar: der Keks ist ohnehin fort. */ }
}
