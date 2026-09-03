/**
 * Der Eintritt — wann gefragt wird und wann nicht.
 *
 * Die Zusage, die hier nachgewiesen wird, ist eine doppelte:
 *
 *   Wer nie angemeldet war und die Stiftung liest, loest KEINE Anfrage aus.
 *   Wer angemeldet war oder in die Werkstatt will, bekommt die Antwort vor
 *   dem ersten Bild.
 *
 * Beides laesst sich nur zeigen, wenn man mitzaehlt — deshalb ein Zaehler und
 * kein Netz. Und die zweite Zusage: eine Stoerung ist keine Abmeldung.
 */

import { rcEnter, rcEntryCheck, rcShouldCheckAtEntry, type RcMemory } from './rcBoot';
import { rcNeedsIdentity, rcParsePath } from './rcRoute';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

interface Who {
  readonly signedIn: boolean;
  readonly accountId?: string;

  /** Ob dem Dienst bei dieser Anfrage ein Öffnungsstück beilag. */
  readonly canOpen?: boolean | null;
}

/** Ein Merker im Speicher — `localStorage` gibt es hier nicht. */
function memoryOf(seen: boolean): RcMemory & { seen: boolean } {
  const state = {
    seen,
    signedInBefore: () => state.seen,
    remember: () => { state.seen = true; },
    forget: () => { state.seen = false; }
  };
  return state;
}

/** Eine Auskunft, die mitzaehlt, wie oft sie geholt wurde. */
function counted(answer: Who | Error) {
  const calls = { n: 0 };
  const fetchWho = async (): Promise<Who> => {
    calls.n++;
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { calls, fetchWho };
}

const hints = (over: Partial<Parameters<typeof rcShouldCheckAtEntry>[0]> = {}) => ({
  needsIdentity: false,
  signedInBefore: false,
  hasUnlockPiece: false,
  ...over
});

// -- Die Regel, rein ----------------------------------------------------------

ok('Ein Fremder auf der oeffentlichen Seite wird nicht gefragt',
  rcShouldCheckAtEntry(hints()), false);

ok('Eine Werkstattadresse fragt immer',
  rcShouldCheckAtEntry(hints({ needsIdentity: true })), true);

ok('Ein Wiederkehrender wird gefragt',
  rcShouldCheckAtEntry(hints({ signedInBefore: true })), true);

// Ein Oeffnungsstueck im Tab ueberlebt das Neuladen. Wer neu laedt, hat eine
// Sitzung, nach der zu fragen sich lohnt — auch ohne Merker.
ok('Ein Oeffnungsstueck im Tab genuegt',
  rcShouldCheckAtEntry(hints({ hasUnlockPiece: true })), true);

// -- Die Regel an echten Adressen ---------------------------------------------

for (const [address, expected] of [
  ['#/new', false],
  ['#/new/foundation', false],
  ['#/new/parish/jan', false],
  ['#/new/event/limanowa', false],
  ['#/new/confirmation/2027', true],
  ['#/new/cogita/jan', true],
  ['#/new/account', true],
  ['#/new/invite/abc123', true]
] as const) {
  ok(`Adresse ${address}`,
    rcShouldCheckAtEntry(hints({ needsIdentity: rcNeedsIdentity(rcParsePath(address)) })),
    expected);
}

// -- Weg 1: beim Eintritt -----------------------------------------------------

await (async () => {
  const { calls, fetchWho } = counted({ signedIn: true, accountId: 'a1' });
  const store = memoryOf(true);

  const entry = await rcEnter(hints({ signedInBefore: true }), fetchWho, store);

  ok('Der Wiederkehrende wird beim Eintritt erkannt', entry.kind, 'signed-in');
  ok('Und dafuer genau einmal gefragt', calls.n, 1);
})();

// -- Weg 2: gar nicht, bis jemand den Anmeldeknopf anfasst --------------------

await (async () => {
  const { calls, fetchWho } = counted({ signedIn: false });
  const store = memoryOf(false);

  const entry = await rcEnter(hints(), fetchWho, store);

  ok('Der Fremde bekommt keine Frage', entry.kind, 'unasked');
  ok('Und es geht KEINE Anfrage hinaus', calls.n, 0);

  // Und jetzt fasst er den Anmeldeknopf an. Dann sofort und von selbst — der
  // Rueckfall laeuft durch dieselbe Auskunft, nur spaeter.
  const later = await rcEntryCheck(fetchWho, store);
  ok('Am Knopf wird dann doch gefragt', later.kind, 'signed-out');
  ok('Und zwar genau einmal', calls.n, 1);
})();

// -- Der Merker ---------------------------------------------------------------

await (async () => {
  const { fetchWho } = counted({ signedIn: true });
  const store = memoryOf(false);

  await rcEntryCheck(fetchWho, store);
  ok('Wer sich anmeldet, wird beim naechsten Mal beim Eintritt gefragt', store.seen, true);
})();

await (async () => {
  const { calls, fetchWho } = counted({ signedIn: false });
  const store = memoryOf(true);

  await rcEntryCheck(fetchWho, store);
  ok('Ein Merker ohne Sitzung wird geloescht', store.seen, false);

  // Sonst kostete er bei JEDEM weiteren Aufruf eine Anfrage, deren Antwort
  // feststeht.
  const again = await rcEnter(hints({ signedInBefore: store.signedInBefore() }), fetchWho, store);
  ok('Und der naechste Aufruf fragt nicht mehr', again.kind, 'unasked');
  ok('Es blieb bei der einen Anfrage', calls.n, 1);
})();

// -- Eine Stoerung ist keine Abmeldung ----------------------------------------

await (async () => {
  const { fetchWho } = counted(new Error('Dienst nicht erreichbar'));
  const store = memoryOf(true);

  const entry = await rcEntryCheck(fetchWho, store);

  ok('Ein stummer Dienst heisst nicht abgemeldet', entry.kind, 'unreachable');

  // Waere hier `signed-out` herausgekommen, waere der Merker weg — und beim
  // naechsten Versuch wuerde nicht mehr gefragt. Eine Stoerung haette den
  // Menschen dauerhaft ausgesperrt.
  ok('Und der Merker bleibt stehen', store.seen, true);
  ok('Beim naechsten Aufruf wird wieder gefragt',
    rcShouldCheckAtEntry(hints({ signedInBefore: store.signedInBefore() })), true);
})();

// -- Eine Sitzung ohne Weg zum Schlüssel -------------------------------------

/*
 * Der Fall, den es vorher nicht gab: angemeldet, aber nichts zu öffnen.
 *
 * Er entsteht ganz gewöhnlich — Tab geschlossen, `sessionStorage` fort, kein
 * Keks, weil niemand „angemeldet bleiben" gewählt hat. Der Sitzungskeks gilt
 * dann noch dreissig Tage, und die Werkstatt meldete an jeder Stelle
 * „gesperrt", während die Kopfleiste behauptete, man sei angemeldet.
 */

await (async () => {
  const { fetchWho } = counted({ signedIn: true, canOpen: false });
  const store = memoryOf(true);
  let signedOut = 0;

  const entry = await rcEntryCheck(
    fetchWho, store, () => false, async () => { signedOut++; }
  );

  ok('Ohne beide Wege wird abgemeldet', entry.kind, 'signed-out');
  ok('Und der Dienst erfaehrt es', signedOut, 1);
  ok('Der Merker faellt mit', store.seen, false);
})();

/* Der Keks allein genügt — der eigene Speicher darf leer sein. */
await (async () => {
  const { fetchWho } = counted({ signedIn: true, canOpen: true });
  const store = memoryOf(true);
  let signedOut = 0;

  const entry = await rcEntryCheck(
    fetchWho, store, () => false, async () => { signedOut++; }
  );

  ok('Mit Keks bleibt die Sitzung', entry.kind, 'signed-in');
  ok('Und niemand wird abgemeldet', signedOut, 0);
})();

/* Und der eigene Speicher allein auch — dann fehlt nur der Keks. */
await (async () => {
  const { fetchWho } = counted({ signedIn: true, canOpen: false });
  const store = memoryOf(true);
  let signedOut = 0;

  const entry = await rcEntryCheck(
    fetchWho, store, () => true, async () => { signedOut++; }
  );

  ok('Mit eigenem Stueck bleibt die Sitzung', entry.kind, 'signed-in');
  ok('Und niemand wird abgemeldet', signedOut, 0);
})();

/*
 * Ein Fehlschlag beim Abmelden ändert den Zustand nicht: der Weg zum
 * Schlüssel fehlt so oder so, und eine Ausnahme, die hier nach oben ginge,
 * hinge den ganzen Eintritt auf.
 */
await (async () => {
  const { fetchWho } = counted({ signedIn: true, canOpen: false });
  const store = memoryOf(true);

  const entry = await rcEntryCheck(
    fetchWho, store, () => false,
    async () => { throw new Error('Dienst nicht erreichbar'); }
  );

  ok('Auch ein misslungenes Abmelden endet abgemeldet', entry.kind, 'signed-out');
})();

/*
 * Sagt der Dienst nichts über `canOpen`, wird NICHT abgemeldet. Ein
 * fehlendes Feld ist keine Aussage — und eine ältere Fassung des Dienstes,
 * die es nicht kennt, würde sonst jeden hinauswerfen.
 */
await (async () => {
  const { fetchWho } = counted({ signedIn: true });
  const store = memoryOf(true);

  const entry = await rcEntryCheck(fetchWho, store, () => false, async () => {});
  ok('Ohne Auskunft bleibt die Sitzung', entry.kind, 'signed-in');
})();

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
