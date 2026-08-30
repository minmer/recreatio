/**
 * Die Adressen der neuen Plattform.
 *
 * **Die Regel: der Teil steht vor dem einzelnen Ding.** Nicht `#/new/jan`,
 * sondern `#/new/parish/jan`. Nicht `#/new/limanowa`, sondern
 * `#/new/event/limanowa`.
 *
 * Das ist keine Ordnungsliebe, es hat drei handfeste Gründe:
 *
 *   1. **Eine Adresse ohne Teil lässt sich nicht auflösen, ohne zu fragen.**
 *      Ob `jan` eine Pfarrei, eine Bibliothek oder eine Veranstaltung ist,
 *      wüsste der Browser erst nach einer Rückfrage beim Dienst — bei jedem
 *      Aufruf, vor dem ersten Bild. Mit dem Teil davor weiss er es aus der
 *      Adresse selbst.
 *
 *   2. **Ohne Teil teilen sich alle Module EINEN Namensraum.** Eine Pfarrei,
 *      die `chat` heissen möchte, oder eine Bibliothek namens `account`, wäre
 *      dann nicht bloss unglücklich, sondern verschluckte ein Modul. Mit dem
 *      Teil davor hat jedes Modul seine eigenen Namen, und zwei Teile dürfen
 *      beide ein `jan` haben.
 *
 *   3. **Der Teil sagt, ob vor dem ersten Bild jemand bekannt sein muss.**
 *      Der Messplan einer Pfarrei hängt im Schaukasten, die Kandidatenliste
 *      eines Firmjahrgangs nicht. Steht der Teil in der Adresse, ist das ohne
 *      Rückfrage entschieden — davon lebt `rcBoot.ts`.
 *
 * Die Raute ist Pflicht: GitHub Pages liefert für `/new/parish/jan` keine
 * Datei aus, weil es die Route nicht kennt. Hinter der Raute bleibt es für
 * den Server ein Aufruf der Startseite.
 */

/**
 * Wo die Plattform hängt. EINE Stelle — wird aus `#/new` später `#`, ändert
 * sich diese Zeile und sonst nichts.
 */
export const RC_HASH_BASE = '#/new';

interface RcPartDef {
  /**
   * Ob dieser Teil einzelne Dinge benennt.
   *
   * `false` heisst nicht „hat keine Unterseiten", sondern „das nächste Segment
   * ist kein Name eines Dings". `#/new/account/keys` ist eine Ansicht des
   * eigenen Kontos und kein Konto namens `keys`.
   */
  readonly slugged: boolean;

  /**
   * Muss der Browser wissen, WER hier ist, bevor er das erste Bild malt?
   *
   * Beantwortet genau diese eine Frage — nicht, ob innerhalb des Teils alles
   * offen liegt. Der Messplan einer Pfarrei ist öffentlich, ihre Intentionen
   * sind es nicht; `parish` steht trotzdem auf `false`, weil sich seine
   * Eingangsseite ohne Konto malen lässt.
   */
  readonly needsIdentity: boolean;
}

/**
 * Die Teile. Bewusst eine feste Liste und kein freier Text — dieselbe
 * Entscheidung wie bei `RcField` im Kernel: was in einer Adresse stehen darf,
 * steht hier, und ein Tippfehler wird zum Übersetzungsfehler statt zu einer
 * stillschweigend leeren Seite.
 *
 * Die Wörter sind sprachunabhängig festgelegt und werden NICHT übersetzt. Ein
 * Link, der in drei Sprachen drei Adressen hätte, wäre in dem Augenblick
 * kaputt, in dem ihn jemand weitergibt.
 */
export const RC_PARTS = {
  // -- Das Haus: die Stiftung. Ohne Rückfrage zu malen. ---------------------
  home: { slugged: false, needsIdentity: false },
  foundation: { slugged: false, needsIdentity: false },
  work: { slugged: false, needsIdentity: false },
  projects: { slugged: false, needsIdentity: false },
  join: { slugged: false, needsIdentity: false },
  contact: { slugged: false, needsIdentity: false },

  // -- Die öffentlichen Gesichter der Module -------------------------------
  //
  // Beide haben eine Seite, die ohne Konto etwas zeigt: den Messplan und die
  // Ankündigung. Was dahinter versiegelt liegt, entscheidet das Modul.
  parish: { slugged: true, needsIdentity: false },
  event: { slugged: true, needsIdentity: false },

  // -- Der Einladungslink --------------------------------------------------
  //
  // Ansehen geht ohne Konto (`rcPeekInvitation`), einlösen nicht. Wer über
  // einen Link kommt, soll deshalb sofort erfahren, ob er schon angemeldet
  // ist — sonst liest er, wohin es führt, und stösst danach an eine Wand.
  invite: { slugged: true, needsIdentity: true },

  // -- Die Werkstatt: alles, was ohne Schlüssel leer wäre -------------------
  workshop: { slugged: false, needsIdentity: true },
  chat: { slugged: true, needsIdentity: true },
  cogita: { slugged: true, needsIdentity: true },
  calendar: { slugged: true, needsIdentity: true },
  confirmation: { slugged: true, needsIdentity: true },
  account: { slugged: false, needsIdentity: true }
} as const satisfies Readonly<Record<string, RcPartDef>>;

export type RcPart = keyof typeof RC_PARTS;

/** Der Teil zu einem Wort, oder `null`, wenn das Wort keiner ist. */
export function rcPartOf(word: string): RcPart | null {
  return Object.prototype.hasOwnProperty.call(RC_PARTS, word) ? (word as RcPart) : null;
}

export interface RcAddress {
  readonly part: RcPart;
  /** Das einzelne Ding — `jan`, `kazimierz`. `null`, wenn keines benannt ist. */
  readonly slug: string | null;
  /** Was danach kommt: `#/new/parish/jan/intentions` ergibt `['intentions']`. */
  readonly tail: readonly string[];
  /**
   * Ein erstes Segment, das kein Teil ist — also eine Adresse, der genau das
   * fehlt, was die Regel verlangt: `#/new/jan`.
   *
   * Sie wird NICHT stillschweigend zur Startseite. Wer so einen Link bekommen
   * hat, soll erfahren, dass ihm der Teil fehlt, statt auf einer Seite zu
   * landen, die er nicht gesucht hat.
   */
  readonly stray: string | null;
}

const HOME: RcAddress = { part: 'home', slug: null, tail: [], stray: null };

/**
 * Die Adresse zerlegen.
 *
 * Nimmt die Raute mitsamt allem davor — ein ganzer Link tut es also auch, und
 * genau so kommt er aus `rcInviteLink` zurück.
 */
export function rcParsePath(hash: string): RcAddress {
  const marker = hash.indexOf('#');
  const afterHash = marker >= 0 ? hash.slice(marker + 1) : hash;

  // Alles ab `?` oder `&` gehört nicht mehr zum Pfad. Ein Geheimnis im
  // Fragment darf davon nichts abbekommen.
  const path = afterHash.split(/[?&]/)[0];

  const base = RC_HASH_BASE.slice(1);
  let rest: string;
  if (path === base || path === base + '/') rest = '';
  else if (path.startsWith(base + '/')) rest = path.slice(base.length + 1);
  else return HOME;

  const segments: string[] = [];
  for (const raw of rest.split('/')) {
    if (raw.length === 0) continue;
    try {
      segments.push(decodeURIComponent(raw));
    } catch {
      // Eine kaputte Kodierung (`%zz`) darf nicht die ganze Adresse werfen.
      // Das Segment bleibt dann, wie es dasteht.
      segments.push(raw);
    }
  }

  const first = segments[0];
  if (first === undefined) return HOME;

  const part = rcPartOf(first);
  if (part === null) return { part: 'home', slug: null, tail: [], stray: first };

  const slugged = RC_PARTS[part].slugged;
  return {
    part,
    slug: slugged ? segments[1] ?? null : null,
    tail: slugged ? segments.slice(2) : segments.slice(1),
    stray: null
  };
}

/**
 * Die Adresse bauen. Der EINZIGE Weg, eine zusammenzusetzen — von Hand
 * geschriebene Adressen sind genau die, die beim nächsten Umbau zurückbleiben.
 *
 * Wirft, wenn ein Teil einen Namen bekommt, der keinen benennt. Das ist ein
 * Fehler im Aufruf und keiner des Benutzers, und eine stillschweigend falsche
 * Adresse ist genau das, wogegen die Regel oben steht.
 */
export function rcPath(part: RcPart, slug?: string | null, ...tail: readonly string[]): string {
  if (slug !== undefined && slug !== null && slug !== '' && !RC_PARTS[part].slugged) {
    throw new Error(
      `Der Teil "${part}" benennt keine einzelnen Dinge — "${slug}" gehört nicht dahinter.`
    );
  }

  const words = [part === 'home' ? '' : part, slug ?? '', ...tail]
    .filter((word) => word.length > 0)
    .map(encodeURIComponent);

  return words.length === 0 ? RC_HASH_BASE : `${RC_HASH_BASE}/${words.join('/')}`;
}

/**
 * Muss vor dem ersten Bild bekannt sein, wer hier ist?
 *
 * Die Antwort hängt allein am Teil und steht damit in der Adresse selbst —
 * ohne Rückfrage beim Dienst. Genau davon lebt `rcBoot.ts`.
 */
export function rcNeedsIdentity(address: RcAddress): boolean {
  return RC_PARTS[address.part].needsIdentity;
}
