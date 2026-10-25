/**
 * 0129 — ADMINISTRATOR DANYCH als Datensatz mit Geschichte (`Controllers.cs`).
 *
 * Ein Datensatz je Organisation, zu Hause in einem Bereich, dessen Prowadzący ihn
 * ändern; jede Änderung ist eine Fassung. Für einen Bereich gilt er durch einen
 * ANSCHLUSS, den eine Rolle des Heimatbereichs unterschreibt (hier, im Browser —
 * der Dienst prüft nur). Wer einen fremden will, bittet; wer ihn anbietet,
 * unterschreibt gleich, und der andere nimmt an. Wer beide führt, tut es in einem
 * Schritt. Ohne Administrator nimmt ein Bereich nichts an: keine Formulare, keine
 * Reservierungen, keine Rozmowy des Bereichs — und eine öffentliche Seite braucht
 * einen Bereich, der für sie geradesteht.
 */

import { attachmentCanon, nowSeconds, type AttachmentFacts } from '../core/dutyRecords';
import { signCanonical, toBase64Url } from '../core/crypto';
import type { Ring } from '../core/keys';
import { call } from '../core/session';

/** Die heutige Fassung der Bedingungen der Auftragsverarbeitung — dieselbe wie `Controllers.TermsVersion`. */
export const TERMS_VERSION = '2026-10';

export type Authority = 'uodo' | 'kiod';

export const AUTHORITY_NAME: Record<Authority, string> = {
  uodo: 'Prezes Urzędu Ochrony Danych Osobowych',
  kiod: 'Kościelny Inspektor Ochrony Danych'
};

/** „do kogo" — für den Satz über die Beschwerde. */
export const AUTHORITY_TO: Record<Authority, string> = {
  uodo: 'Prezesa Urzędu Ochrony Danych Osobowych',
  kiod: 'Kościelnego Inspektora Ochrony Danych'
};

/** Was für einen Bereich gilt — der Datensatz in seiner Fassung, und aus welchem Bereich. */
export interface ControllerInfo {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly address: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly dpo: { readonly name: string | null; readonly contact: string | null } | null;
  readonly authority: Authority | null;
  readonly homeAreaId: string;
  readonly fromAreaId: string;
  readonly fromAreaName?: string | null;
}

export interface ControllerFields {
  readonly name: string;
  readonly address: string;
  readonly email: string;
  readonly phone: string;
  readonly dpoName: string;
  readonly dpoContact: string;
  readonly authority: Authority | '';
}

export const EMPTY_FIELDS: ControllerFields = { name: '', address: '', email: '', phone: '', dpoName: '', dpoContact: '', authority: '' };

export const fieldsOf = (c: {
  name: string; address: string | null; email: string | null; phone?: string | null;
  dpo?: { name: string | null; contact: string | null } | null; authority?: Authority | null;
}): ControllerFields => ({
  name: c.name, address: c.address ?? '', email: c.email ?? '', phone: c.phone ?? '',
  dpoName: c.dpo?.name ?? '', dpoContact: c.dpo?.contact ?? '', authority: c.authority ?? ''
});

const bodyOf = (f: ControllerFields) => ({
  name: f.name.trim(), address: f.address.trim() || null, email: f.email.trim() || null, phone: f.phone.trim() || null,
  dpoName: f.dpoName.trim() || null, dpoContact: f.dpoContact.trim() || null, authority: f.authority || null
});

/** Ein eigener oder offener Anschluss dieses Bereichs. */
export interface Attachment {
  readonly attachmentId: string;
  readonly controllerId: string;
  readonly state: 'live' | 'asked' | 'offered';
  readonly liveFrom: string | null;
  readonly askedAt: string | null;
  readonly name: string;
  readonly homeAreaId: string;
  readonly signed: boolean;
}

/** Wo ein Datensatz mit Heimat hier gilt oder gelten soll. */
export interface Use {
  readonly attachmentId: string;
  readonly areaId: string;
  readonly areaName: string | null;
  readonly state: 'live' | 'asked' | 'offered';
  readonly liveFrom: string | null;
  readonly askedAt: string | null;
}

/** Ein Datensatz mit Heimat in diesem Bereich (nur für die, die ihn führen). */
export interface HomeRecord {
  readonly id: string;
  readonly version: number;
  readonly closed: boolean;
  readonly name: string;
  readonly address: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly dpo: { readonly name: string | null; readonly contact: string | null } | null;
  readonly authority: Authority | null;
  /** Hat jemand bestätigt, für die Organisation handeln zu dürfen (diese Fassung)? */
  readonly confirmed: boolean;
  /** Sind die heutigen Bedingungen angenommen? */
  readonly terms: boolean;
  readonly uses: readonly Use[];
}

export interface AreaControllerState {
  readonly areaId: string;
  readonly at: string | null;
  readonly controller: ControllerInfo | null;
  readonly own: Attachment | null;
  readonly waiting: readonly Attachment[];
  readonly home: readonly HomeRecord[];
  readonly admin: boolean;
  readonly signerRoleId: string | null;
  readonly signerRoleIds?: readonly string[];
  readonly termsVersion: string;
}

export const loadAreaControllerState = (areaId: string, at?: string): Promise<AreaControllerState> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/controller${at === undefined ? '' : `?at=${encodeURIComponent(at)}`}`);

/** Was dieses Konto wählen kann: Datensätze aus seinen Bereichen und die, die in deren Ketten gelten. */
export interface ControllerChoice {
  readonly id: string;
  readonly homeAreaId: string;
  readonly homeAreaName: string | null;
  readonly name: string;
  readonly address: string | null;
  readonly email: string | null;
  readonly authority: Authority | null;
  readonly usedIn: number;
  /** Führe ich seinen Heimatbereich? Dann gilt er nach meiner Wahl sofort. */
  readonly homeAdmin: boolean;
}

export const listControllers = (): Promise<{ records: readonly ControllerChoice[] }> => call('/workspace/controllers');

/* -- Unterschreiben ------------------------------------------------------------ */

/** Die erste Rolle, die hier unterschreiben darf UND deren Signierschlüssel dieser Bund hält. */
export function signerOf(state: Pick<AreaControllerState, 'signerRoleId' | 'signerRoleIds'>, ring: Ring | null): string | null {
  const all = state.signerRoleIds ?? (state.signerRoleId === null ? [] : [state.signerRoleId]);
  if (ring === null) return null;
  return all.find((one) => ring.maySign(one)) ?? null;
}

export interface Signed { readonly signerRoleId: string; readonly signedAt: number; readonly signature: string }

/** Die Zusage unterschreiben — mit dem Signierschlüssel einer Rolle, die den Heimatbereich führt. */
export async function signAttachment(ring: Ring, facts: Omit<AttachmentFacts, 'signedAt'>): Promise<Signed> {
  const signedAt = nowSeconds();
  const signature = await signCanonical(await ring.signKey(facts.signerRoleId), attachmentCanon({ ...facts, signedAt }));
  return { signerRoleId: facts.signerRoleId, signedAt, signature: toBase64Url(signature) };
}

/* -- Anlegen und ändern ------------------------------------------------------- */

/**
 * Ein neuer Datensatz, zu Hause in `homeAreaId` — mit der Bestätigung, für die
 * Organisation handeln zu dürfen, und der Annahme der Bedingungen. Er gilt sofort
 * für seine Heimat (die Zusage unterschreibt der Anlegende selbst).
 */
export async function createController(ring: Ring, input: {
  homeAreaId: string; signerRoleId: string; fields: ControllerFields; authorityConfirmed: boolean;
}): Promise<{ id: string; attachmentId: string }> {
  const id = crypto.randomUUID();
  const attachmentId = crypto.randomUUID();
  const signed = await signAttachment(ring, {
    attachmentId, controllerId: id, areaId: input.homeAreaId, homeAreaId: input.homeAreaId, signerRoleId: input.signerRoleId
  });
  return call('/workspace/controllers', {
    method: 'POST',
    body: JSON.stringify({
      id, homeAreaId: input.homeAreaId, fields: bodyOf(input.fields),
      authorityConfirmed: input.authorityConfirmed, termsVersion: TERMS_VERSION, attachmentId, signed
    })
  });
}

/** Eine neue Fassung (Anschrift, Kontakt, Organ …). Eine neue Nazwa braucht die Bestätigung. */
export const writeVersion = (id: string, fields: ControllerFields, authorityConfirmed: boolean): Promise<{ id: string; version: number }> =>
  call(`/workspace/controller/${encodeURIComponent(id)}`, {
    method: 'POST', body: JSON.stringify({ fields: bodyOf(fields), authorityConfirmed })
  });

/** Schliessen: er gilt nirgends mehr und bleibt als Geschichte. */
export const closeController = (id: string): Promise<{ closed: boolean }> =>
  call(`/workspace/controller/${encodeURIComponent(id)}/close`, { method: 'POST' });

/** Die heutigen Bedingungen annehmen (und, falls nötig, die Bestätigung nachholen). */
export const acceptTerms = (id: string, authorityConfirmed: boolean): Promise<{ termsVersion: string }> =>
  call(`/workspace/controller/${encodeURIComponent(id)}/terms`, {
    method: 'POST', body: JSON.stringify({ termsVersion: TERMS_VERSION, authorityConfirmed })
  });

/* -- Anschliessen ------------------------------------------------------------- */

/**
 * Für einen Bereich einen Datensatz wählen. Führt `signerRoleId` (meine Rolle)
 * auch dessen Heimat, gilt er sofort (unterschrieben); sonst ist es eine Bitte an
 * die Heimat.
 */
export async function chooseController(ring: Ring | null, input: {
  areaId: string; controllerId: string; homeAreaId: string; homeSignerRoleId: string | null;
}): Promise<{ attachmentId: string; state: 'asked' | 'live' }> {
  const attachmentId = crypto.randomUUID();
  const signed = ring !== null && input.homeSignerRoleId !== null
    ? await signAttachment(ring, {
      attachmentId, controllerId: input.controllerId, areaId: input.areaId, homeAreaId: input.homeAreaId, signerRoleId: input.homeSignerRoleId
    })
    : null;
  return call(`/workspace/area/${encodeURIComponent(input.areaId)}/controller`, {
    method: 'POST', body: JSON.stringify({ controllerId: input.controllerId, attachmentId, signed })
  });
}

/** Den eigenen Anschluss beenden: der Bereich erbt wieder von oben. */
export const inheritController = (areaId: string): Promise<{ state: 'inherit' }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/controller`, { method: 'POST', body: JSON.stringify({ inherit: true }) });

/**
 * Die Heimat bietet ihren Datensatz einem Bereich an — schon unterschrieben.
 * `accept`: wer auch diesen Bereich führt, nimmt gleich an.
 */
export async function offerController(ring: Ring, input: {
  controllerId: string; homeAreaId: string; areaId: string; signerRoleId: string; accept: boolean;
}): Promise<{ attachmentId: string; state: 'offered' | 'live' }> {
  const attachmentId = crypto.randomUUID();
  const signed = await signAttachment(ring, {
    attachmentId, controllerId: input.controllerId, areaId: input.areaId, homeAreaId: input.homeAreaId, signerRoleId: input.signerRoleId
  });
  return call(`/workspace/controller/${encodeURIComponent(input.controllerId)}/offer`, {
    method: 'POST', body: JSON.stringify({ areaId: input.areaId, attachmentId, signed, accept: input.accept })
  });
}

/**
 * Über eine Bitte (die Heimat unterschreibt) oder ein Angebot (der Bereich nimmt
 * an) entscheiden. `sign`: bei einer Bitte die Tatsachen der Zusage und wer
 * unterschreibt.
 */
export async function decideAttachment(ring: Ring | null, input: {
  attachmentId: string; accept: boolean;
  sign?: { controllerId: string; areaId: string; homeAreaId: string; signerRoleId: string };
}): Promise<{ state: 'live' | 'refused' }> {
  const signed = input.accept && input.sign !== undefined && ring !== null
    ? await signAttachment(ring, { attachmentId: input.attachmentId, ...input.sign })
    : null;
  return call(`/workspace/attachment/${encodeURIComponent(input.attachmentId)}/decide`, {
    method: 'POST', body: JSON.stringify({ accept: input.accept, signed })
  });
}

/** Einen gültigen Anschluss beenden, oder eine offene Bitte / ein offenes Angebot zurücknehmen. */
export const endAttachment = (attachmentId: string): Promise<{ ended: boolean }> =>
  call(`/workspace/attachment/${encodeURIComponent(attachmentId)}/end`, { method: 'POST' });

/* -- Seiten ------------------------------------------------------------------- */

export interface PageResponsible {
  readonly areaId: string;
  readonly fromPath: string;
  readonly controller: ControllerInfo | null;
}

/** Welcher Bereich für eine Seite (und die darunter) geradesteht. `null`: keiner mehr. */
export const setPageController = (path: string, areaId: string | null): Promise<{ path: string; responsible: PageResponsible | null }> =>
  call('/workspace/slug/controller', { method: 'POST', body: JSON.stringify({ path, areaId }) });

/* -- Öffentlich ----------------------------------------------------------------- */

export const publicAreaController = (areaId: string): Promise<{ areaId: string; controller: ControllerInfo | null }> =>
  call(`/area/${encodeURIComponent(areaId)}/controller`);

export interface ControllerProof {
  readonly id: string;
  readonly homeAreaId: string;
  readonly homeAreaName: string | null;
  readonly closedAt: string | null;
  readonly closedReason: string | null;
  readonly versions: readonly {
    readonly version: number; readonly name: string; readonly address: string | null; readonly email: string | null;
    readonly phone: string | null; readonly dpo: { name: string | null; contact: string | null } | null;
    readonly authority: Authority | null; readonly writtenAt: string;
  }[];
  readonly proof: null | {
    readonly attachmentId: string; readonly areaId: string; readonly areaName: string | null; readonly controllerId: string;
    readonly homeAreaId: string; readonly liveFrom: string | null;
    readonly signed: null | {
      readonly signerRoleId: string; readonly signedAt: number | null; readonly signature: string | null; readonly signerPublicKey: string | null;
      readonly certificate: null | {
        readonly id: string; readonly subjectRoleId: string; readonly scopeKind: string; readonly scopeId: string; readonly capability: string;
        readonly issuedByRoleId: string; readonly issuedAt: number; readonly expiresAt: number; readonly signature: string | null;
        readonly issuerPublicKey: string | null;
      };
    };
  };
}

/** Der Datensatz mit allen Fassungen — und für einen Bereich die Unterschrift, die ihn dort gelten lässt. */
export const controllerProof = (id: string, areaId?: string): Promise<ControllerProof> =>
  call(`/controller/${encodeURIComponent(id)}${areaId === undefined ? '' : `?area=${encodeURIComponent(areaId)}`}`);
