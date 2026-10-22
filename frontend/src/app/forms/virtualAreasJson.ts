/**
 * 0120 — DIE OBSZARY OSÓB EINES FORMULARS ALS JSON (im JSON des Moduls).
 *
 * <code>
 *   "virtualAreas": [
 *     { "name": "Kandydat i prowadzący", "submitter": "write",
 *       "roles": [ { "role": "<Kennung>", "level": "admin" } ] }
 *   ]
 * </code>
 *
 * <b>Import legt an und ergänzt, er nimmt nichts weg</b> — wie bei Listen von
 * Einsendungen: eine Regel, die im Dokument fehlt, bleibt; eine Rolle, die in
 * einer Regel fehlt, bleibt darin. Angelegt wird eine Regel, deren Name es noch
 * nicht gibt; eine Rolle kommt nur hinein, wenn der Importierende sie hält.
 */

import { joinArea, loadMembers, type Member } from '../areas/area';
import { keysFor } from '../core/ringOf';
import type { Ring, SealedRole } from '../core/keys';
import type { Who } from '../core/session';
import {
  applyVirtualArea, changeVirtualArea, createVirtualArea, loadVirtualAreas, loadVirtualPlan, SUBMITTER_LEVELS, type SubmitterLevel
} from './virtualAreas';

export type VirtualRoleLevel = 'read' | 'write' | 'admin';

export interface VirtualAreaDoc {
  readonly name: string;
  readonly submitter: SubmitterLevel;
  readonly roles: readonly { readonly role: string; readonly level: VirtualRoleLevel }[];
}

const ROLE_LEVELS: readonly VirtualRoleLevel[] = ['read', 'write', 'admin'];

/** Die stärkste Stufe eines Mitglieds (`certify` allein ist keine: es lässt hinein, sieht nicht hinein). */
export function levelOf(capabilities: readonly string[]): VirtualRoleLevel | null {
  if (capabilities.includes('admin')) return 'admin';
  if (capabilities.includes('write')) return 'write';
  if (capabilities.includes('read')) return 'read';
  return null;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Duldsam lesen: was keine Regel ist, fällt weg (mit Warnung). `undefined`:
 * das Dokument sagt nichts über Obszary osób (der Schlüssel fehlt).
 */
export function readVirtualAreas(value: unknown, warnings: string[]): readonly VirtualAreaDoc[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    warnings.push('"virtualAreas" to nie lista — pominięte.');
    return [];
  }
  const out: VirtualAreaDoc[] = [];
  const seen = new Set<string>();
  for (const [at, one] of value.entries()) {
    const row = record(one);
    const name = text(row.name);
    if (name === '') { warnings.push(`"virtualAreas"[${at}] bez nazwy — pominięte.`); continue; }
    const key = name.toLocaleLowerCase('pl');
    if (seen.has(key)) { warnings.push(`Obszar osoby „${name}” powtarza się — liczy się pierwszy.`); continue; }
    seen.add(key);
    const submitter = (SUBMITTER_LEVELS as readonly string[]).includes(text(row.submitter)) ? text(row.submitter) as SubmitterLevel : 'write';
    if (row.submitter !== undefined && submitter !== text(row.submitter)) warnings.push(`„${name}”: nieznane "submitter" — przyjęto "write".`);
    const roles: { role: string; level: VirtualRoleLevel }[] = [];
    for (const r of Array.isArray(row.roles) ? row.roles : []) {
      const entry = record(r);
      const role = text(entry.role);
      const level = text(entry.level) as VirtualRoleLevel;
      if (role === '' || !ROLE_LEVELS.includes(level)) { warnings.push(`„${name}”: rola bez kennungi albo stopnia — pominięta.`); continue; }
      if (!roles.some((x) => x.role === role)) roles.push({ role, level });
    }
    out.push({ name, submitter, roles });
  }
  return out;
}

/** Was das Formular jetzt hat, als Dokument (Reihenfolge der Regeln, je Regel ihre Rollen). */
export async function exportVirtualAreas(partId: string): Promise<readonly VirtualAreaDoc[]> {
  const now = await loadVirtualAreas(partId).catch(() => null);
  if (now === null || !now.ready) return [];
  const out: VirtualAreaDoc[] = [];
  for (const va of now.virtualAreas) {
    const members: readonly Member[] = (await loadMembers(va.areaId).catch(() => ({ members: [] as readonly Member[] }))).members;
    out.push({
      name: va.name,
      submitter: va.submitterLevel,
      roles: members.flatMap((m) => {
        const level = levelOf(m.capabilities);
        return level === null ? [] : [{ role: m.roleId, level }];
      })
    });
  }
  return out;
}

/** Ein Satz für die Vorschau. */
export function describeVirtualAreas(docs: readonly VirtualAreaDoc[]): string {
  return docs.length === 0
    ? 'Obszary osób: w dokumencie żadnych (istniejące zostają).'
    : `Obszary osób: ${docs.map((d) => `„${d.name}”`).join(', ')} — brakujące zostaną założone, role dodane, jeśli je masz.`;
}

/**
 * Importieren: fehlende Regeln anlegen, die Stufe der Person angleichen,
 * fehlende Rollen hineinnehmen — und danach die Regel gleich anwenden.
 */
export async function importVirtualAreas(
  who: Who, partId: string, docs: readonly VirtualAreaDoc[], stage: (what: string) => void,
  /** Schon geöffnet (ein Aufrufer, der ihn hat) — sonst aus dem Konto dieses Tabs. */
  given?: { readonly ring: Ring; readonly person: SealedRole }
): Promise<{ lines: string[]; warnings: string[] }> {
  const lines: string[] = [];
  const warnings: string[] = [];
  if (docs.length === 0) return { lines, warnings };

  let ring: Ring | null;
  let person: SealedRole | null;
  if (given !== undefined) {
    ({ ring, person } = given);
  } else {
    const opened = await keysFor(who);
    ring = opened.ring;
    person = opened.graph.roles.find((r) => r.kind === 'person') ?? null;
  }
  if (ring === null || person === null) {
    warnings.push('Obszary osób pominięte: najpierw podaj hasło.');
    return { lines, warnings };
  }

  let now = await loadVirtualAreas(partId);
  if (!now.ready) {
    warnings.push('Obszary osób pominięte: będą dostępne po migracji 0120.');
    return { lines, warnings };
  }
  const formAreaId = now.formAreaId;
  if (formAreaId === null) {
    warnings.push('Obszary osób pominięte: formularz nie ma obszaru.');
    return { lines, warnings };
  }

  for (const doc of docs) {
    let va = now.virtualAreas.find((v) => v.name.toLocaleLowerCase('pl') === doc.name.toLocaleLowerCase('pl'));
    if (va === undefined) {
      stage(`Zakładanie obszaru osoby „${doc.name}”…`);
      await createVirtualArea(ring, person, partId, formAreaId, doc.name, doc.submitter);
      now = await loadVirtualAreas(partId);
      va = now.virtualAreas.find((v) => v.name === doc.name);
      lines.push(`Obszar osoby „${doc.name}” założony.`);
      if (va === undefined) continue;
    } else if (va.submitterLevel !== doc.submitter) {
      if (va.myLevel !== 'admin') {
        warnings.push(`„${doc.name}”: regułę zmienia ten, kto ją prowadzi — "submitter" zostaje.`);
      } else {
        await changeVirtualArea(va.areaId, { submitterLevel: doc.submitter });
        lines.push(`„${doc.name}”: osoba — ${doc.submitter}.`);
      }
    }

    const members = (await loadMembers(va.areaId)).members;
    const issuer = members.find((m) =>
      (m.capabilities.includes('admin') || m.capabilities.includes('certify')) && ring.maySign(m.roleId))?.roleId ?? null;
    let added = 0;
    for (const want of doc.roles) {
      if (members.some((m) => m.roleId === want.role)) continue;
      const role = ring.roleOf(want.role);
      if (role === undefined) { warnings.push(`„${doc.name}”: roli ${want.role.slice(0, 8)}… nie masz — pominięta.`); continue; }
      if (issuer === null) { warnings.push(`„${doc.name}”: nie prowadzisz tej reguły — rola ${want.role.slice(0, 8)}… pominięta.`); continue; }
      stage(`„${doc.name}”: dodawanie roli…`);
      await joinArea(ring, va.areaId, role, issuer, want.level);
      added++;
    }
    if (added > 0) lines.push(`„${doc.name}”: dodano role — ${added}.`);

    if (va.mayCertify) {
      stage(`„${doc.name}”: zakładanie obszarów osób…`);
      const done = await applyVirtualArea(ring, await loadVirtualPlan(va.areaId)).catch(() => null);
      if (done !== null && done.created + done.mirrored > 0) lines.push(`„${doc.name}”: obszary osób — założone ${done.created}, uzupełnione ${done.mirrored}.`);
    }
  }

  return { lines, warnings };
}
