/**
 * Die Annahme — wie etwas von aussen hereinkommt, ohne dass der Dienst es liest.
 *
 * <code>
 *   1. Der Bereich hat ein RSA-Paar. Die öffentliche Hälfte geht MIT dem
 *      Formular hinaus — damit lässt sich verschliessen und nichts öffnen.
 *   2. Der Browser würfelt je Feld einen Schlüssel, versiegelt damit den Wert
 *      und verpackt den Schlüssel unter der öffentlichen Hälfte.
 *   3. Der Dienst legt beides hin und kann nichts davon öffnen.
 *   4. Wer den Schlüssel des AMTES hat, packt die private Hälfte aus, damit den
 *      Feldschlüssel, damit den Wert.
 * </code>
 *
 * <b>Die private Hälfte liegt unter dem AMTSSCHLÜSSEL, nicht unter einer
 * Epoche.</b> Läge sie unter dem Epochenschlüssel, könnte jeder Helfer sämtliche
 * Anmeldungen lesen, ohne dass ihm jemand etwas gegeben hätte — es folgte aus
 * der Mitgliedschaft, und Mitgliedschaft ist keine Befugnis.
 */

import { aad, Field, fromBase64Url, newWrapPair, open, seal, toBase64Url } from './crypto';
import type { Ring } from './keys';
import { call } from './session';

const intakeAad = (areaId: string) => aad('intake', 'area', areaId, Field.EventIntakeKey, 1);

export interface Controller {
  readonly name: string;
  readonly address: string | null;
  readonly email: string | null;
}

/* -- Anlegen ---------------------------------------------------------------- */

/**
 * Das Annahmepaar anlegen — einmal je Bereich.
 *
 * <b>Es lässt sich nicht ersetzen.</b> Ein zweites Paar machte jede bisherige
 * Einsendung unlesbar: ihre Feldschlüssel sind unter der ALTEN öffentlichen
 * Hälfte verpackt. Der Dienst weist ein zweites deshalb ab.
 *
 * Dauert ein paar Sekunden — RSA-4096. Wer das aufruft, sagt es vorher an.
 */
export async function createIntake(
  ring: Ring, areaId: string, officeRoleId: string
): Promise<void> {
  const pair = await newWrapPair();

  // Unter dem Schlüssel DES AMTES. Genau das ist der Unterschied.
  const sealedPrivate = await seal(
    ring.keyOf(officeRoleId), intakeAad(areaId), pair.privateKey);

  await call(`/workspace/area/${encodeURIComponent(areaId)}/intake`, {
    method: 'POST',
    body: JSON.stringify({
      publicKey: toBase64Url(pair.publicKey),
      privateKeySealed: toBase64Url(sealedPrivate),
      roleId: officeRoleId
    })
  });
}

/* -- Für das Amt ------------------------------------------------------------ */

export interface OfficeIntake {
  readonly areaId: string;
  readonly publicKey: string;
  readonly privateKeySealed: string;
  readonly sealedForRoleId: string;
}

export const loadIntake = (areaId: string): Promise<OfficeIntake> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/intake`);

/**
 * Die private Hälfte aufmachen.
 *
 * Wirft, wenn dieser Bund den Schlüssel der genannten Rolle nicht hält — das
 * ist der Unterschied zwischen „darf" und „kann", und er ist beabsichtigt: der
 * Dienst gibt die Hülle heraus, das Öffnen entscheidet sich hier.
 */
export const openIntakeKey = (intake: OfficeIntake, ring: Ring): Promise<Uint8Array> =>
  open(ring.keyOf(intake.sealedForRoleId), intakeAad(intake.areaId),
    fromBase64Url(intake.privateKeySealed));

/* -- Die Klausel ------------------------------------------------------------ */

/**
 * Wer für die Daten geradesteht.
 *
 * Klartext, notwendigerweise: die Klausel steht unter dem Formular, BEVOR
 * jemand etwas eingegeben hat. Sie zu verschlüsseln hiesse, sie dem
 * vorzuenthalten, für den sie da ist.
 */
export const setController = (
  areaId: string, what: { name: string; address?: string; email?: string }
): Promise<{ name: string }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/controller`, {
    method: 'POST',
    body: JSON.stringify({
      name: what.name.trim(),
      address: what.address?.trim() ?? null,
      email: what.email?.trim() ?? null
    })
  });

/* -- Für das Formular ------------------------------------------------------- */

export interface PublicIntake {
  readonly areaId: string;
  readonly publicKey: string;

  /** `null` heisst: niemand ist benannt — dann darf das Formular nichts sammeln. */
  readonly controller: Controller | null;
}

export const loadPublicIntake = (areaId: string): Promise<PublicIntake> =>
  call(`/intake/${encodeURIComponent(areaId)}`);
