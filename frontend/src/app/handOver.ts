/**
 * Was dem Konto vor 0040 gegeben wurde — einer Person übergeben.
 *
 * <b>Seit 0040 hält das Konto nur Personen.</b> Vorher war es die einzige
 * Rolle, die ein neuer Mensch hatte, und alles landete dort. Das Umhängen
 * von Adressen und Kalendereinträgen kann der Dienst selbst; Bereiche und das
 * Postfach liegen aber unter dem Schlüssel des Kontos, und umverpacken kann
 * nur, wer ihn hat — dieser Browser.
 *
 * <b>Jede neue Hülle wird hier geöffnet, bevor sie hinausgeht.</b> Der Dienst
 * kann nicht prüfen, ob darin der richtige Schlüssel liegt; eine falsche
 * Hülle hiesse, dass die Person den Bereich hält und ihn nicht öffnen kann,
 * während das Konto ihn nicht mehr hält. Das darf nicht erst beim nächsten
 * Anmelden auffallen.
 */

import { epochAad, signedCertificate, type Capability } from './area';
import { fromBase64Url, open, seal, toBase64Url, unwrapKey, wrapKey } from './crypto';
import { intakeAad } from './intake';
import type { Ring, SealedRole } from './keys';
import { call, WorkspaceError } from './session';

export interface HeldArea {
  readonly areaId: string;
  readonly name: string;
  readonly parentAreaId: string | null;
  readonly capabilities: readonly string[];
  readonly keys: readonly { readonly epoch: number; readonly sealedBlob: string }[];
}

export interface Held {
  readonly accountRoleId: string;
  readonly areas: readonly HeldArea[];
  readonly intakes: readonly { readonly areaId: string; readonly privateKeySealed: string }[];
  readonly addresses: number;
  readonly calendarItems: number;
}

export interface Handed {
  readonly areas: number;
  readonly intakes: number;
  readonly addresses: number;
  readonly calendarItems: number;
}

export const loadHeld = (): Promise<Held> => call<Held>('/workspace/account/held');

export const holdsAnything = (held: Held): boolean =>
  held.areas.length + held.intakes.length + held.addresses + held.calendarItems > 0;

const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * Alles, was das Konto hält, an `person` — in einem Aufruf.
 *
 * Genau die Stufen, die das Konto hatte, und jeden Schlüssel, den es hatte.
 * Der Dienst lehnt ab, wenn sich inzwischen etwas geändert hat; dann liest
 * man neu und ruft noch einmal.
 */
export async function handOver(ring: Ring, held: Held, person: SealedRole): Promise<Handed> {
  const account = held.accountRoleId;
  const accountPrivate = await ring.wrapPrivate(account);
  const personPublic = fromBase64Url(person.wrapPublicKey);
  const personPrivate = await ring.wrapPrivate(person.id);

  const areas = [];

  for (const area of held.areas) {
    const keys = [];

    for (const envelope of area.keys) {
      const at = epochAad(area.areaId, envelope.epoch);
      const key = await unwrapKey(accountPrivate, at, fromBase64Url(envelope.sealedBlob));
      const wrapped = await wrapKey(personPublic, at, key);

      if (!same(await unwrapKey(personPrivate, at, wrapped), key)) {
        throw new WorkspaceError(`Klucz obszaru „${area.name}" nie dał się przepakować.`);
      }

      keys.push({ epoch: envelope.epoch, wrappedKey: toBase64Url(wrapped) });
    }

    const certificates = [];

    for (const capability of area.capabilities) {
      certificates.push(await signedCertificate(ring, {
        issuerRoleId: account,
        subjectRoleId: person.id,
        areaId: area.areaId,
        capability: capability as Capability
      }));
    }

    areas.push({ areaId: area.areaId, keys, certificates });
  }

  const intakes = [];

  for (const intake of held.intakes) {
    const at = intakeAad(intake.areaId);
    const secret = await open(ring.keyOf(account), at, fromBase64Url(intake.privateKeySealed));
    const sealed = await seal(ring.keyOf(person.id), at, secret);

    if (!same(await open(ring.keyOf(person.id), at, sealed), secret)) {
      throw new WorkspaceError('Klucz skrzynki formularza nie dał się przepakować.');
    }

    intakes.push({ areaId: intake.areaId, privateKeySealed: toBase64Url(sealed) });
  }

  return call<Handed>('/workspace/account/hand-over', {
    method: 'POST',
    body: JSON.stringify({ personRoleId: person.id, areas, intakes })
  });
}
