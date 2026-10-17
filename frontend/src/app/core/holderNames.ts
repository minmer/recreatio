/**
 * WER EINEN TERMIN HÄLT — NIE OFFEN (0097).
 *
 * <code>
 *   ein Platz            sein Name steht am Platz (versiegelt unter dem Bereich des Platzes)
 *   eine Person          ihr Name für die Kanzlei: unter dem Schlüssel des Bereichs des
 *   (mit Konto)          Dings, wenn sie ihn hat — sonst für die Annahme des Bereichs
 *                        verpackt, wie eine Antwort im Formular
 *   die Kanzlei trägt    unter dem Schlüssel des Bereichs des Dings
 *   jemanden ein
 *   wer um Mitnahme      zusätzlich für den Gastgeber: ECIES auf seinen P-256-Schlüssel,
 *   bittet               dessen private Hälfte unter dem Schlüssel des Halters liegt
 * </code>
 */

import { fromBase64Url, open, seal, toBase64Url } from './crypto';
import { loadIntake, loadPublicIntake, openIntakeKey } from '../forms/intake';
import {
  claimAskAad, claimHolderAad, hostWrapAad, nameText, openForPrivate, openFromIntake, openName, openSeatName,
  ringOrNull, sealForIntake, sealForPublic, sealName, writeKey
} from './names';

/** Was der Dienst über einen Anspruch an Namen schickt. */
export interface HolderNameIn {
  readonly claimId: string;
  readonly seatId?: string | null;
  readonly seatNameSealed?: string | null;
  readonly seatNameEpoch?: number | null;
  readonly seatAreaId?: string | null;
  readonly holderNameSealed?: string | null;
  readonly holderNameEpoch?: number | null;
  readonly holderNameWrapped?: string | null;
}

/**
 * DIE NAMEN AN ANSPRÜCHEN ÖFFNEN — für die Kanzlei. `areaOf`: der Bereich des
 * Dings, unter dem (oder für dessen Annahme) der Name einer Person liegt.
 */
export async function openHolderNames<T extends HolderNameIn>(
  claims: readonly T[], areaOf: (claim: T) => string | null | undefined
): Promise<(T & { readonly name: string | null })[]> {
  const intakes = new Map<string, Promise<Uint8Array | null>>();
  const intakeOf = (areaId: string): Promise<Uint8Array | null> => {
    let found = intakes.get(areaId);
    if (found === undefined) {
      found = (async () => {
        const ring = await ringOrNull();
        return ring === null ? null : openIntakeKey(await loadIntake(areaId), ring);
      })().catch(() => null);
      intakes.set(areaId, found);
    }
    return found;
  };

  return Promise.all(claims.map(async (claim) => {
    let name: string | null = null;

    if (claim.seatNameSealed != null && claim.seatId != null) {
      name = await openSeatName({ seatId: claim.seatId, areaId: claim.seatAreaId, nameSealed: claim.seatNameSealed, nameEpoch: claim.seatNameEpoch });
    } else if (claim.holderNameSealed != null) {
      const areaId = areaOf(claim);
      if (areaId != null && claim.holderNameEpoch != null) {
        name = await openName(areaId, { nameSealed: claim.holderNameSealed, nameEpoch: claim.holderNameEpoch }, claimHolderAad(claim.claimId));
      } else if (areaId != null && claim.holderNameWrapped != null) {
        const intake = await intakeOf(areaId);
        name = intake === null ? null : await openFromIntake(intake, claimHolderAad(claim.claimId), claim.holderNameSealed, claim.holderNameWrapped);
      }
    }

    return { ...claim, name };
  }));
}

/* -- Schreiben ------------------------------------------------------------------------------------- */

/**
 * DER NAME EINER PERSON FÜR DIE KANZLEI — unter dem Schlüssel des Bereichs
 * des Dings, wenn dieser Browser ihn hat; sonst für dessen Annahme. Gibt es
 * beides nicht, geht kein Name mit (die Kanzlei sieht „bez nazwy").
 */
export async function holderNameFor(
  claimId: string, areaId: string | null | undefined, name: string | null | undefined
): Promise<{ holderNameSealed?: string; holderNameEpoch?: number; holderNameWrapped?: string }> {
  const text = nameText(name ?? '');
  if (text === '' || areaId == null) return {};

  try {
    const { epoch, key } = await writeKey(areaId, { person: true });
    return { holderNameSealed: await sealName(key, claimHolderAad(claimId), text), holderNameEpoch: epoch };
  } catch {
    // Kein Schlüssel dieses Bereichs — dann für die Annahme.
  }

  try {
    const intake = await loadPublicIntake(areaId);
    const { sealed, wrapped } = await sealForIntake(fromBase64Url(intake.publicKey), claimHolderAad(claimId), text);
    return { holderNameSealed: sealed, holderNameWrapped: wrapped };
  } catch {
    return {};
  }
}

/** Der Name für den Gastgeber — nur, wenn er einen Schlüssel hat. */
export async function askNameFor(claimId: string, hostWrapPublic: string | null | undefined, name: string | null | undefined): Promise<{ askNameSealed?: string }> {
  const text = nameText(name ?? '');
  if (text === '' || hostWrapPublic == null) return {};
  try {
    return { askNameSealed: await sealForPublic(fromBase64Url(hostWrapPublic), claimAskAad(claimId), text) };
  } catch {
    return {};
  }
}

/**
 * DAS PAAR DES GASTGEBERS (P-256): der öffentliche Teil steht an seinem
 * Anspruch, der private unter dem Schlüssel des Halters — nur er öffnet damit
 * die Namen derer, die um Mitnahme bitten.
 */
export async function hostPair(claimId: string, holderKey: Uint8Array): Promise<{ hostWrapPublic: string; hostWrapPrivateSealed: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const [spki, pkcs8] = await Promise.all([
    crypto.subtle.exportKey('spki', pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey)
  ]);
  return {
    hostWrapPublic: toBase64Url(new Uint8Array(spki)),
    hostWrapPrivateSealed: toBase64Url(await seal(holderKey, hostWrapAad(claimId), new Uint8Array(pkcs8)))
  };
}

/** Die Namen derer, die um Mitnahme bitten — mit dem privaten Schlüssel des Gastgebers. */
export async function openAskNames(
  hostClaimId: string, hostWrapPrivateSealed: string | null | undefined, holderKey: Uint8Array | null,
  asks: readonly { readonly claimId: string; readonly nameSealed?: string | null }[]
): Promise<ReadonlyMap<string, string>> {
  const out = new Map<string, string>();
  let pkcs8: Uint8Array | null = null;
  if (hostWrapPrivateSealed != null && holderKey !== null) {
    try { pkcs8 = await open(holderKey, hostWrapAad(hostClaimId), fromBase64Url(hostWrapPrivateSealed)); } catch { pkcs8 = null; }
  }
  for (const ask of asks) {
    const name = ask.nameSealed != null && pkcs8 !== null ? await openForPrivate(pkcs8, claimAskAad(ask.claimId), ask.nameSealed) : null;
    if (name !== null && name.trim() !== '') out.set(ask.claimId, name.trim());
  }
  return out;
}
