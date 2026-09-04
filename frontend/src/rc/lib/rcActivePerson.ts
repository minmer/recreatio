/**
 * Als WEN die Seite gerade geöffnet ist.
 *
 * <b>Warum es das braucht.</b> Ein Konto trägt nicht zwingend eine Person. Eine
 * Mutter mit zwei Kindern im selben Firmjahrgang ist kein Sonderfall, sondern
 * der Normalfall — und dann meint „meine Anmeldung" zwei verschiedene Dinge.
 * Ohne eine Wahl müsste die Oberfläche raten, und sie hat bisher geraten: die
 * älteste Rolle gewann, das zweite Kind war unsichtbar.
 *
 * <b>Was hier NICHT liegt.</b> Kein Schlüssel und kein Geheimnis — nur die
 * Kennung einer Rolle. Die steht ohnehin in Adressen (`#/new/person/<id>`) und
 * sagt für sich genommen nichts: wer den Namen sehen will, braucht den
 * Schlüssel, und den gibt eine Kennung nicht her.
 *
 * <b>Warum `localStorage` und nicht der Sitzungsspeicher.</b> Die Wahl soll
 * einen Neustart des Browsers überleben — wer für sein Kind eingetragen ist,
 * ist es morgen noch. Sie stirbt mit dem Gerät, nicht mit dem Tab.
 *
 * <b>Warum je Konto.</b> Zwei Menschen an einem Rechner sollen nicht die Wahl
 * des anderen erben. Der Schlüssel im Speicher trägt deshalb die Kontokennung.
 */

const PREFIX = 'rc.person.';

/** Wer zuhört, wenn die Wahl sich ändert. */
type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Lesen und Schreiben können werfen — ein privates Fenster, gesperrte
 * Website-Daten, ein voller Speicher. Nichts davon darf die Seite kosten:
 * ohne gespeicherte Wahl gilt einfach die erste Person.
 */
function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* Die Wahl gilt dann nur für dieses Fenster. */ }
}

/** Die gewählte Person eines Kontos — oder `null`, wenn nie eine gewählt wurde. */
export function rcActivePerson(accountId: string): string | null {
  if (accountId === '') return null;
  return read(PREFIX + accountId);
}

/**
 * Eine Person wählen.
 *
 * `null` löscht die Wahl — dann gilt wieder die erste. Das ist kein Fehlerfall,
 * sondern der Zustand eines Kontos mit genau einer Person.
 */
export function rcSetActivePerson(accountId: string, roleId: string | null): void {
  if (accountId === '') return;
  write(PREFIX + accountId, roleId);
  for (const listener of listeners) listener();
}

/**
 * Auf Änderungen hören.
 *
 * Auch auf die aus einem ANDEREN Tab: wer dort umschaltet, soll hier nicht eine
 * andere Person sehen als dort. Das `storage`-Ereignis feuert nur in den
 * jeweils anderen Tabs, deshalb ruft `rcSetActivePerson` die Zuhörer im eigenen
 * Tab selbst.
 */
export function rcOnActivePerson(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Die Wahl auf das anwenden, was es wirklich gibt.
 *
 * Eine gespeicherte Kennung kann ins Leere zeigen — die Rolle wurde entzogen,
 * das Konto ist ein anderes, der Speicher stammt aus einer früheren Fassung.
 * Dann gilt die erste vorhandene Person statt einer Auswahl, die niemanden
 * meint.
 */
export function rcResolvePerson(
  accountId: string,
  persons: readonly { readonly roleId: string }[]
): string | null {
  if (persons.length === 0) return null;

  const chosen = rcActivePerson(accountId);
  if (chosen !== null && persons.some((p) => p.roleId === chosen)) return chosen;

  return persons[0].roleId;
}
