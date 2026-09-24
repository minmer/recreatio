/**
 * Was der Arbeitsplatz vom Dienst holt.
 *
 * EINE Adresse für alle Kacheln (`GET /workspace`). Vier Abfragen wären vier
 * Ladezustände auf einem Bild, und drei davon sähen nach Fehlern aus, solange
 * die vierte läuft.
 */

import { call } from './session';

/** Eine Rolle dieses Kontos. Der Anzeigename ist versiegelt — hier steht die Art. */
export interface RoleCard {
  readonly id: string;
  readonly kind: 'account' | 'person' | 'role' | 'group';

  /** Das KONTO selbst (0040). Es hält nur Personen und bekommt nichts. */
  readonly isPersonal: boolean;

  /** Wie weit unter dem Konto: 1 sind die Personen, die es selbst hält. */
  readonly depth: number;
}

/**
 * Wer etwas übernehmen kann — eine Adresse, eine Seite. Alle meine Rollen
 * AUSSER dem Konto: der Dienst lehnt es ohnehin ab, und eine Auswahl, die
 * mit einer Absage endet, ist eine Falle.
 */
export const takers = (roles: readonly RoleCard[]): readonly RoleCard[] =>
  roles.filter((role) => !role.isPersonal);

/**
 * Die Art, solange der Name versiegelt ist. EINE Stelle — vorher stand
 * dieselbe Liste dreimal, und „Twoja rola osobista" hiess dort, was jetzt
 * das Konto ist.
 */
export const kindName = (role: RoleCard): string =>
  role.isPersonal ? 'Konto'
  : role.kind === 'role' ? 'Rola'
  : role.kind === 'group' ? 'Grupa'
  : role.depth === 1 ? 'Ty'
  : 'Osoba';

/**
 * Eine Adresse, die eine meiner Rollen führt.
 *
 * `aliasOf` und `host` sind die zweiten Wege hierher. Der Dienst schickt sie
 * als `null`, wenn es keinen gibt — dieser Dienst lässt Nullen stehen, anders
 * als der Altbestand, wo ein leeres Feld schlicht fehlt.
 */
export interface PageCard {
  readonly path: string;
  readonly roleId: string;
  readonly claimedAt: string;

  /** Worauf dieser Eintrag zeigt — `null`, wenn er selbst die Seite ist. */
  readonly aliasOf: string | null;

  /** Eine eigene Domain, die hierher zeigt, oder `null`. */
  readonly host: string | null;

  /**
   * WESSEN Seite das ist — `null` heisst öffentlich.
   *
   * Steht hier eine Rolle, liefert der Dienst die Seite nur an den aus, der sie
   * hält, an das Amt, das die Adresse führt, und an einen Platz, dem sie
   * zugeteilt wurde. Für alle anderen gibt es sie nicht — nicht „verboten",
   * sondern nicht.
   */
  readonly internalForRoleId: string | null;
}

export interface Desk {
  readonly roles: readonly RoleCard[];
  readonly pages: readonly PageCard[];
}

export const loadDesk = (): Promise<Desk> => call<Desk>('/workspace');

/**
 * Eine Adresse übernehmen.
 *
 * Drei Angaben, und die dritte ist die, die man leicht vergisst: NICHT ich
 * werde verantwortlich, sondern eine meiner Rollen. Ein Mensch geht, ein Amt
 * bleibt — und die Adresse wandert mit dem Amt.
 */
/**
 * Was der Dienst auf ein Übernehmen antwortet — und das ist NICHT die ganze
 * Karte.
 *
 * `host` steht hier absichtlich nicht, denn die Antwort enthält es nicht. Sie
 * als <see cref="PageCard"/> auszugeben hiesse, ein Feld zu versprechen, das
 * zur Laufzeit `undefined` ist: der Übersetzer liesse `page.host` durch, und
 * gefunden würde es erst auf dem Bild. Wer die ganze Zeile braucht, lädt den
 * Arbeitsplatz neu — dort kommt sie vollständig.
 */
export interface Claimed {
  readonly path: string;
  readonly roleId: string;
  readonly claimedAt: string;
}

export const claimSlug = (path: string, code: string, roleId: string): Promise<Claimed> =>
  call<Claimed>('/workspace/slug/claim', {
    method: 'POST',
    body: JSON.stringify({ path, code, roleId })
  });

/**
 * Einen Alias erklären — einen zweiten Weg auf eine Seite, die ich führe.
 *
 * Kein Code, weil nichts zu vergeben ist: die Zeile ist von Anfang an vergeben,
 * an eine Rolle, die das Ziel schon führt.
 */
export const declareAlias = (
  path: string, target: string, roleId: string
): Promise<Claimed & { readonly aliasOf: string }> =>
  call<Claimed & { readonly aliasOf: string }>('/workspace/alias', {
    method: 'POST',
    body: JSON.stringify({ path, target, roleId })
  });

/**
 * Eine Unteradresse umhängen — mitsamt allem darunter.
 *
 * <b>Der Inhalt zieht nicht um.</b> Text, Bausteine und Formularfelder hängen
 * an der Kennung, nicht am Pfad; was sich ändert, ist die Adresse. Verweise
 * (`alias_of`) ziehen mit, sonst zeigten sie danach ins Leere.
 */
export const moveSlug = (
  path: string, newPath: string
): Promise<{ path: string; moved: number | false }> =>
  call('/workspace/slug/move', {
    method: 'POST',
    body: JSON.stringify({ path, newPath })
  });

/**
 * Eine Unteradresse einer Rolle zuordnen — oder wieder freigeben (`roleId = null`).
 *
 * Die genannte Rolle muss nicht die eigene sein: eine Lehrerin richtet `lo13/anna`
 * für Anna ein, ohne Annas Rolle zu halten. Es ist auch keine Preisgabe — die
 * Zuordnung NIMMT Sichtbarkeit weg, sie gibt keine.
 */
export const setInternal = (
  path: string, roleId: string | null
): Promise<{ path: string; internalForRoleId: string | null }> =>
  call('/workspace/slug/internal', {
    method: 'POST',
    body: JSON.stringify({ path, roleId })
  });

/** Eine eigene Domain anhängen — oder sie abnehmen (`host` = `null`). */
export const bindDomain = (path: string, host: string | null): Promise<{ path: string; host: string | null }> =>
  call('/workspace/domain', {
    method: 'POST',
    body: JSON.stringify({ path, host })
  });
