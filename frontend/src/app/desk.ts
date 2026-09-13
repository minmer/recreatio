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
  readonly kind: 'person' | 'role' | 'group';
  /** Die eine Rolle, die DIESES Konto ist. Sie kann nicht übergeben werden. */
  readonly isPersonal: boolean;
}

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

/** Eine eigene Domain anhängen — oder sie abnehmen (`host` = `null`). */
export const bindDomain = (path: string, host: string | null): Promise<{ path: string; host: string | null }> =>
  call('/workspace/domain', {
    method: 'POST',
    body: JSON.stringify({ path, host })
  });
