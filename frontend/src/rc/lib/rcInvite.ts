/**
 * 3.12 / 10.3 — Einladungen, und wer in einen Bereich gehört.
 *
 * **Was eine Einladung nicht ist.** Sie ist kein Anmeldeweg. Anmelden kann sich
 * jeder, ohne Link und ohne Einladung. Ein Zugangslink führt in einen Teil der
 * Plattform, der nicht öffentlich ist, und wird mit einem BESTEHENDEN Konto
 * verbunden.
 *
 * **Der Kern: der Schlüssel reist mit dem Link, nicht mit der Datenbank.** Der
 * Rollenschlüssel liegt unter einer Ableitung aus dem Token-Geheimnis, und das
 * Geheimnis steht nirgends gespeichert — nur sein SHA-256. Wer die Tabelle
 * vollständig besitzt, kann die Einladung nicht einlösen.
 *
 * Daraus folgt etwas, das die Oberfläche sagen MUSS und nicht verschweigen
 * darf: ein verlorener Link ist endgültig verloren. Es gibt keinen Weg, ihn
 * wiederherzustellen — man stellt einen neuen aus. Ein Klient, der das Geheimnis
 * nur einmal zeigt und nicht dazusagt, warum, sieht aus wie ein Ärgernis statt
 * wie eine Zusage.
 */

import { rcFetch, type RcApi } from './rcApi';

export type RcInvitation = RcApi<'InvitationsInvitationView'>;
export type RcInvitationCreated = RcApi<'RcInvitationCreatedResponse'>;
export type RcInvitationPeek = RcApi<'RcInvitationPeekResponse'>;

// `RcMember` und `rcMembers` stehen in `rcChat.ts` und bleiben dort. Sie hier
// ein zweites Mal zu schreiben hiesse, zwei Stellen zu haben, die dasselbe
// meinen — und irgendwann meinen sie es nicht mehr.
export { rcMembers, type RcMember } from './rcChat';

// -- Ausstellen ---------------------------------------------------------------

export interface RcInviteOptions {
  readonly label?: string;
  readonly daysValid?: number;
  readonly maxUses?: number;
  /** 10.4 — der SMS-Weg verlangt mindestens sieben Tage; das prüft der Kernel. */
  readonly forSms?: boolean;
}

export const rcCreateInvitation = (roleId: string, options: RcInviteOptions = {}) =>
  rcFetch<RcInvitationCreated>('/invitations', {
    body: {
      roleId,
      label: options.label ?? null,
      daysValid: options.daysValid ?? null,
      maxUses: options.maxUses ?? null,
      forSms: options.forSms ?? null
    },
    withUnlock: true
  });

export const rcInvitations = () =>
  rcFetch<RcApi<'RcInvitationsResponse'>>('/invitations', { withUnlock: true });

export const rcRevokeInvitation = (invitationId: string) =>
  rcFetch<RcApi<'RcRevokedResponse'>>(`/invitations/${invitationId}/revoke`, {
    method: 'POST',
    withUnlock: true
  });

// -- Ansehen und einlösen -----------------------------------------------------

/**
 * Ansehen, OHNE einzulösen. Kein Konto nötig — wer den Link hat, darf erfahren,
 * wohinein er führt, bevor er zusagt.
 *
 * Das ist keine Nachlässigkeit, sondern die Bedingung dafür, dass „Einlösen"
 * eine Entscheidung ist und kein Sprung ins Dunkle.
 */
export const rcPeekInvitation = (secret: string) =>
  rcFetch<RcInvitationPeek>('/invitations/peek', { body: { secret } });

/**
 * Einlösen. Setzt ein angemeldetes, entsperrtes Konto voraus: der Rollen-
 * schlüssel wird aus dem Link geholt und auf die persönliche Rolle umgepackt —
 * ohne diese Rolle gibt es kein Ziel für das Umpacken.
 *
 * `alreadyRedeemed` ist kein Fehler. Wer denselben Link zweimal öffnet, soll
 * nicht erschrecken; er ist schon drin.
 */
export const rcRedeemInvitation = (secret: string) =>
  rcFetch<RcApi<'RcInvitationRedeemedResponse'>>('/invitations/redeem', {
    body: { secret },
    withUnlock: true
  });

/**
 * Der Link, wie er verschickt wird.
 *
 * Der Hash gehört dazu (GitHub Pages), und das Geheimnis steht IM Fragment —
 * nach dem `#`. Das ist Absicht: was hinter der Raute steht, schickt der
 * Browser nicht an den Server. Stünde es im Pfad oder in der Abfrage, läge das
 * Geheimnis in jedem Zugriffsprotokoll auf dem Weg.
 */
export function rcInviteLink(secret: string, origin = window.location.origin + window.location.pathname): string {
  return `${origin}#/new/invite/${encodeURIComponent(secret)}`;
}

/** Das Geheimnis aus der Adresse holen, wenn jemand über einen Link kommt. */
export function rcSecretFromHash(hash: string): string | null {
  const match = /#\/new\/invite\/([^/?&]+)/.exec(hash);
  return match === null ? null : decodeURIComponent(match[1]);
}

// -- Mitglieder ---------------------------------------------------------------

export const RC_CAPABILITIES = ['read', 'write', 'admin', 'certify'] as const;
export type RcCapabilityName = (typeof RC_CAPABILITIES)[number];


/**
 * **Die Entscheidung, die hier fällt: darf der Neue die Vergangenheit lesen?**
 *
 * `grantHistory = false` ist die Vorgabe, und das ist keine Sparsamkeit. Wer
 * heute dazukommt, war gestern nicht dabei — das ist der Normalfall in jedem
 * Gremium, und das Epochenmodell bildet ihn ab. Die Vergangenheit
 * mitzugeben ist die AUSSERGEWÖHNLICHE Handlung und muss deshalb bewusst
 * geschehen, mit dem Wissen, dass sie sich nicht zurücknehmen lässt: einmal
 * ausgehändigte Epochenschlüssel sind ausgehändigt.
 */
export const rcAddMember = (
  areaId: string,
  roleId: string,
  capability: RcCapabilityName = 'write',
  grantHistory = false
) =>
  rcFetch<RcApi<'RcMemberAddedResponse'>>(`/areas/${areaId}/members`, {
    body: { roleId, capability, grantHistory },
    withUnlock: true
  });

/**
 * Entfernen schneidet eine neue Epoche. Was danach geschrieben wird, kann der
 * Gegangene nicht mehr lesen — was davor steht, sehr wohl. Rückwirkend
 * auszusperren ginge nur, indem man alles neu verschlüsselt, und dann wäre die
 * alte Fassung trotzdem in der Welt.
 */
export const rcRemoveMember = (areaId: string, roleId: string) =>
  rcFetch<RcApi<'RcMemberRemovedResponse'>>(`/areas/${areaId}/members/${roleId}/remove`, {
    method: 'POST',
    withUnlock: true
  });

/**
 * Ist die Einladung noch brauchbar?
 *
 * Der Dienst weist eine verbrauchte oder abgelaufene ohnehin ab. Die Oberfläche
 * rechnet es trotzdem selbst aus, damit sie es SAGEN kann, statt einen Knopf
 * anzubieten, der dann mit einer Absage endet.
 */
export function rcInviteSpent(invitation: RcInvitation, now = new Date()): boolean {
  if (new Date(invitation.expiresUtc).getTime() <= now.getTime()) return true;
  if (invitation.maxUses === null || invitation.maxUses === undefined) return false;
  return invitation.useCount >= invitation.maxUses;
}

/**
 * 10.3 — Wurde der Link schon einmal geöffnet?
 *
 * `firstOpenedUtc` ist die einzige Spur, die eine SMS hinterlässt, und sie ist
 * wichtig: ein Link, der beim Empfänger nie ankam, aber schon geöffnet wurde,
 * ist unterwegs gelesen worden. Der Aussteller soll das sehen können, ohne
 * danach suchen zu müssen.
 */
export function rcInviteOpened(invitation: RcInvitation): boolean {
  return invitation.firstOpenedUtc !== null && invitation.firstOpenedUtc !== undefined;
}
