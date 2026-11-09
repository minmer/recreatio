/**
 * ENTWÜRFE (2026-11-09) — was jemand in ein Schreibfeld getippt und nicht gesendet hat,
 * bleibt, wenn er die Ansicht wechselt: zurück im Gespräch steht es wieder im Feld, und
 * die Liste zeigt „Szkic: …".
 *
 * <code>
 *   thread:<id>               ein Gespräch auf dem Telefon — auch über das Schliessen der App hinaus
 *   new                       „Nowa wiadomość" (mit den Empfängern) — nur, solange die App offen ist
 *   archive:<bereich>:<key>   die Antwort aus dem Browser — nur, solange die Seite offen ist
 * </code>
 *
 * Nur `thread:` geht in den Speicher des Geräts: der Name trägt keine Telefonnummer
 * (wie `sms.places`). Die anderen Namen tragen Nummern — die bleiben im Speicher der Seite.
 */

const STORE = 'sms.drafts';
const MAX = 100;

interface Draft {
  readonly text: string;
  /** Bei „Nowa wiadomość": an wen. */
  readonly to?: readonly string[];
}

const drafts = new Map<string, Draft>();
let read = false;

const lasting = (name: string): boolean => name.startsWith('thread:');

function load(): void {
  if (read) return;
  read = true;
  try {
    const stored = JSON.parse(localStorage.getItem(STORE) ?? '{}') as unknown;
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) return;
    for (const [name, text] of Object.entries(stored)) {
      if (lasting(name) && typeof text === 'string' && text !== '' && !drafts.has(name)) drafts.set(name, { text });
    }
  } catch {
    // ohne gemerkte Entwürfe
  }
}

function persist(): void {
  try {
    const out: Record<string, string> = {};
    for (const [name, d] of drafts) if (lasting(name)) out[name] = d.text;
    if (Object.keys(out).length === 0) localStorage.removeItem(STORE);
    else localStorage.setItem(STORE, JSON.stringify(out));
  } catch {
    // voll oder gesperrt: dann nur, bis die App schliesst
  }
}

/** Der Entwurf unter diesem Namen — `null`: keiner. */
export function draftOf(name: string): Draft | null {
  load();
  return drafts.get(name) ?? null;
}

/** Merken — ein leeres Feld: vergessen (auch die Empfänger; gesendet ist gesendet). */
export function keepDraft(name: string, text: string, to?: readonly string[]): void {
  load();
  const had = drafts.get(name);
  if (text.trim() === '') {
    if (had === undefined) return;
    drafts.delete(name);
  } else {
    if (had !== undefined && had.text === text && (had.to ?? []).join('|') === (to ?? []).join('|')) return;
    drafts.delete(name);
    drafts.set(name, to === undefined ? { text } : { text, to: [...to] });
    for (const old of drafts.keys()) {
      if (drafts.size <= MAX) break;
      drafts.delete(old);
    }
  }
  if (lasting(name)) persist();
}

/**
 * Was beim Öffnen im Feld steht: der Entwurf — kam Text mit (`?tekst=`, Przekaż), der dazu,
 * unter den Entwurf (ausser er steht schon darin: dieselbe Adresse noch einmal geöffnet).
 */
export function startText(name: string | undefined, initial: string): string {
  const had = name === undefined ? '' : draftOf(name)?.text ?? '';
  if (initial === '') return had;
  if (had === '' || had.includes(initial)) return had === '' ? initial : had;
  return `${had.trimEnd()}\n${initial}`;
}
