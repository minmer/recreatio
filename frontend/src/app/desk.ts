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
  readonly kind: 'person' | 'office' | 'member';
  /** Die eine Rolle, die DIESES Konto ist. Sie kann nicht übergeben werden. */
  readonly isPersonal: boolean;
}

/** Eine Adresse, die eine meiner Rollen führt. */
export interface PageCard {
  readonly path: string;
  readonly roleId: string;
  readonly claimedAt: string;
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
export const claimSlug = (path: string, code: string, roleId: string): Promise<PageCard> =>
  call<PageCard>('/workspace/slug/claim', {
    method: 'POST',
    body: JSON.stringify({ path, code, roleId })
  });
