/**
 * Der PasswordKey, geteilt zwischen den TABS dieser Herkunft — und sonst nirgends.
 *
 * <b>Warum nicht `sessionStorage`.</b> Weil es nicht tut, wonach es klingt: jeder
 * Tab hat seinen eigenen. Zwei nebeneinander geöffnete Tabs sehen einander dort
 * nie — das Problem wäre also gar nicht gelöst, nur der Schlüssel läge auf der
 * Platte.
 *
 * <b>Warum nicht `localStorage`.</b> Weil es zu viel tut: was dort liegt,
 * überlebt den Tab, überlebt den Browser, und jedes Skript, das je auf diese
 * Seite gerät, liest es. Genau das nahm der Altbestand als Abkürzung, und genau
 * die nimmt dieser Bau nicht.
 *
 * <b>Was hier stattdessen geschieht.</b> Der Schlüssel bleibt IM SPEICHER —
 * jeweils in dem des Tabs, der ihn hat. Ein Tab, der keinen hat, fragt die
 * anderen; wer einen hat, reicht ihn herüber. Nichts wird geschrieben, nichts
 * bleibt liegen: schliesst der letzte Tab, ist der Schlüssel fort, wie zuvor.
 *
 * <code>
 *   neuer Tab ──ask(loginId)──►  offener Tab
 *             ◄──give(key)────   (nur wenn derselbe Name)
 * </code>
 *
 * <b>Zwei Sperren, und beide sind nötig.</b>
 *
 * Der Name wird VERGLICHEN, bevor etwas herausgeht. Ohne das bekäme ein Tab,
 * in dem gerade jemand anderes angemeldet ist, den fremden Schlüssel — und
 * würde damit Hüllen öffnen, die ihm nicht gehören.
 *
 * Beim Abmelden geht ein `forget` hinaus. Ohne das bliebe der Schlüssel in den
 * übrigen Tabs liegen, obwohl die Sitzung — der Keks gilt für alle — längst
 * beendet ist.
 *
 * <b>Was es kostet, ehrlich gesagt.</b> Ein eingeschleustes Skript in IRGENDEINEM
 * Tab kann den Schlüssel jetzt von einem anderen erfragen; vorher kam es nur an
 * den des eigenen Tabs. Da es den eigenen ohnehin lesen konnte, ist der
 * Unterschied klein — aber er ist nicht null, und er steht deshalb hier.
 *
 * `BroadcastChannel` trägt nur innerhalb EINER Herkunft. Eine fremde Seite kann
 * nicht mithören, auch nicht in einem Rahmen.
 */

const CHANNEL = 'recreatio:keyring:v1';

/**
 * Wie lange auf eine Antwort gewartet wird.
 *
 * Im selben Browser ist die Runde deutlich unter einer Millisekunde; diese
 * Spanne ist Nachsicht mit einem beschäftigten Tab, nicht die erwartete Dauer.
 * Sie wird ausserdem nur dann überhaupt abgewartet, wenn NIEMAND antwortet —
 * also genau dann, wenn ohnehin gleich nach dem Passwort gefragt wird.
 */
const WAIT_MS = 250;

interface Ask { readonly kind: 'ask'; readonly loginId: string; readonly nonce: string }
interface Give {
  readonly kind: 'give';
  readonly loginId: string;
  readonly nonce: string;
  readonly key: Uint8Array;
}
interface Forget { readonly kind: 'forget'; readonly loginId: string }

type Message = Ask | Give | Forget;

/** Gross und klein sind derselbe Name — wie `Normalise` im Dienst. */
const tag = (loginId: string): string => (loginId ?? '').trim().toLowerCase();

export interface Held {
  readonly loginId: string;
  readonly key: Uint8Array;
}

let bus: BroadcastChannel | null = null;
let provide: (() => Held | null) | null = null;
let drop: (() => void) | null = null;

/**
 * Ein Kanal, der auch dort nicht stört, wo es ihn nicht gibt.
 *
 * Ohne `BroadcastChannel` (alte Browser, serverseitiges Rendern) bleibt alles
 * beim Alten: der Schlüssel gilt dann eben nur im eigenen Tab. Das ist das
 * bisherige Verhalten und kein Fehler.
 */
function open(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (bus !== null) return bus;

  bus = new BroadcastChannel(CHANNEL);
  bus.addEventListener('message', answer);
  return bus;
}

/** Ein eigener Beitrag kommt nie zurück — `BroadcastChannel` stellt dem Absender nicht zu. */
function answer(event: MessageEvent<Message>): void {
  const message = event.data;
  if (message === null || typeof message !== 'object') return;

  if (message.kind === 'ask') {
    const mine = provide?.() ?? null;

    // NUR bei gleichem Namen. Sonst reicht ein Tab den Schlüssel an eine
    // Anmeldung weiter, die einem anderen Menschen gehört.
    if (mine === null || tag(mine.loginId) !== tag(message.loginId)) return;

    bus?.postMessage({
      kind: 'give', loginId: tag(mine.loginId), nonce: message.nonce, key: mine.key
    } satisfies Give);
    return;
  }

  if (message.kind === 'forget') drop?.();
}

/**
 * Diesen Tab zum Geber machen.
 *
 * Der Schlüssel bleibt dabei, wo er ist — `session.ts` hält ihn weiter allein.
 * Hier liegt nur die Auskunft, wie man an ihn kommt, und die läuft über eine
 * Rückfrage statt über eine zweite Kopie.
 */
export function serve(current: () => Held | null, onForget: () => void): void {
  provide = current;
  drop = onForget;
  open();
}

/**
 * Die anderen Tabs fragen. `null` heisst: keiner hat einen — dann wird nach dem
 * Passwort gefragt, wie bisher.
 */
export function borrow(loginId: string, waitMs: number = WAIT_MS): Promise<Uint8Array | null> {
  const channel = open();
  if (channel === null) return Promise.resolve(null);

  const wanted = tag(loginId);
  const nonce = crypto.randomUUID();

  return new Promise((resolve) => {
    let settled = false;

    const finish = (key: Uint8Array | null) => {
      if (settled) return;
      settled = true;

      channel.removeEventListener('message', listen);
      clearTimeout(timer);
      resolve(key);
    };

    const listen = (event: MessageEvent<Message>) => {
      const message = event.data;
      if (message === null || typeof message !== 'object' || message.kind !== 'give') return;

      // Die Nonce gehört zu DIESER Frage: sonst nähme ein Tab die Antwort auf
      // die Frage eines anderen entgegen.
      if (message.nonce !== nonce || tag(message.loginId) !== wanted) return;
      if (!(message.key instanceof Uint8Array) || message.key.length === 0) return;

      // Eine eigene Kopie: das übertragene Feld gehört dem Ereignis.
      finish(new Uint8Array(message.key));
    };

    channel.addEventListener('message', listen);
    const timer = setTimeout(() => finish(null), waitMs);

    channel.postMessage({ kind: 'ask', loginId: wanted, nonce } satisfies Ask);
  });
}

/** Beim Abmelden: die übrigen Tabs sollen ihn auch fallen lassen. */
export function announceForget(loginId: string): void {
  open()?.postMessage({ kind: 'forget', loginId: tag(loginId) } satisfies Forget);
}
