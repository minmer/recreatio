/**
 * WSPÓLNA ROLA (0091) — eine Rolle, die sagt, wozu sie Zugang gibt, und die
 * ein Link oder ein Formular weitergibt.
 *
 * <b>Vorher</b> zählte jeder Link und jedes Formular seine Bereiche selbst
 * auf. Wer „die Rada" anders zuschneiden wollte, musste jeden Link einzeln
 * neu machen. Jetzt hat die Rada EINE Rolle mit ihren Bereichen; Links und
 * Formulare geben diese Rolle, und eine Änderung an ihr gilt überall.
 *
 * Hier: welche Rollen sich geben lassen (meine, keine Person, kein Konto,
 * keine Linkrolle — mit dem, wozu sie führen), und eine neue anlegen, gleich
 * mit ihren Bereichen.
 */

import { joinArea } from './area';
import type { Ring, SealedRole } from './keys';
import { issuerIn, type LinkArea, type LinkLevel } from './linkAccess';
import { forgetKeys } from './ringOf';
import { createRoleWithKeys } from './roles';
import { call, WorkspaceError } from './session';

export interface RoleReach {
  readonly roleId: string;
  /** Die Rolle eines Links — sie bietet niemand zur Wahl an. */
  readonly link: boolean;
  readonly holds: readonly string[];
  /** Wozu sie führt — über sich und alles, was sie hält (die stärkste Stufe je Bereich). */
  readonly areas: readonly LinkArea[];
}

export const loadRoleReach = (): Promise<{ roles: readonly RoleReach[] }> => call('/workspace/roles/reach');

export interface GivableRole {
  readonly roleId: string;
  readonly name: string;
  readonly kind: 'role' | 'group';
  /** Führe ich sie (ihr Signierschlüssel liegt im Bund) — dann kann ich auch das Führen weitergeben. */
  readonly leads: boolean;
  readonly areas: readonly LinkArea[];
}

/** Die Rollen, die ich geben kann — mit Namen, nach Namen geordnet. */
export async function givableRoles(ring: Ring): Promise<GivableRole[]> {
  const { roles } = await loadRoleReach();
  const out: GivableRole[] = [];
  for (const one of roles) {
    const role = ring.roleOf(one.roleId);
    if (one.link || role === undefined || !ring.has(one.roleId) || (role.kind !== 'role' && role.kind !== 'group')) continue;
    const name = await ring.name(one.roleId);
    /* Eine Linkrolle von früher, die der Dienst (noch) nicht als solche kennt, verrät sich am Namen. */
    if (name !== null && name.startsWith('Link: ')) continue;
    out.push({ roleId: one.roleId, name: name ?? 'Rola bez nazwy', kind: role.kind, leads: ring.maySign(one.roleId), areas: one.areas });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}

export const LEVEL_SHORT: Record<string, string> = { read: 'czyta', write: 'pisze', admin: 'prowadzi' };

/** „Rada — pisze · Ogłoszenia — czyta" — oder dass sie (noch) nirgendwohin führt. */
export const reachWords = (areas: readonly LinkArea[]): string =>
  areas.length === 0 ? 'jeszcze bez obszarów' : areas.map((a) => `${a.name} — ${LEVEL_SHORT[a.capability] ?? a.capability}`).join(' · ');

export interface NewRoleDraft {
  readonly name: string;
  readonly areas: readonly { readonly areaId: string; readonly capability: LinkLevel }[];
}

/** Was an einem Entwurf noch fehlt — oder \`null\`. */
export function draftProblem(draft: NewRoleDraft): string | null {
  if (draft.name.trim() === '') return 'Nazwij nową rolę — np. „Uczestnicy Rocket 2026".';
  if (draft.areas.length === 0) return 'Zaznacz co najmniej jeden obszar, do którego rola daje dostęp.';
  return null;
}

/**
 * EINE NEUE WSPÓLNA ROLLE — eine Gruppe, gleich mit ihren Bereichen. Das
 * dauert: zwei RSA-4096-Paare, und je Bereich und Epoche eine Zuteilung.
 * Zurück kommt ein Bund, der sie schon kennt (der alte Bund kennt sie nicht).
 */
export async function createCommonRole(
  ring: Ring, holder: SealedRole, draft: NewRoleDraft, progress: (step: string) => void = () => undefined
): Promise<{ roleId: string; ring: Ring }> {
  const problem = draftProblem(draft);
  if (problem !== null) throw new WorkspaceError(problem);

  const issuers = new Map<string, string>();
  for (const { areaId } of draft.areas) {
    const issuer = await issuerIn(ring, areaId);
    if (issuer === null) throw new WorkspaceError('Do jednego z wybranych obszarów nie możesz nikogo wpuścić.');
    issuers.set(areaId, issuer);
  }

  progress('Liczenie kluczy nowej roli…');
  const made = await createRoleWithKeys(ring, holder, { kind: 'group', name: draft.name.trim() });
  for (const { areaId, capability } of draft.areas) {
    progress('Otwieranie obszarów dla roli…');
    await joinArea(ring, areaId, { id: made.id, kind: 'group', wrapPublicKey: made.wrapPublicKey }, issuers.get(areaId)!, capability);
  }

  forgetKeys();
  return { roleId: made.id, ring: ring.withRole(made.role, made.roleKey, made.signKey) };
}
