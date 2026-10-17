/**
 * DIE ÜBERTRAGUNG (2026-10-17) — was in der Datenbank noch in einer älteren
 * Form steht, in die heutige bringen. Was ohne Schlüssel geht, tut der Dienst;
 * was Schlüssel braucht, tut dieser Browser nach der Anmeldung — mit den
 * Wegen, die es dafür schon gibt (documentation/TRANSFER.md).
 *
 * <code>
 *   Rozmowy            Zasada `legacy` ausgeschrieben (der Dienst; der Bereich muss mir gehören)
 *   Administrator      vom Formular in den Obszar (wo die Kette keinen hat), der alte Eintrag fällt
 *   Szablony SMS       die eine alte Vorlage (`config.sms`) in die Liste (`config.smsTemplates`)
 *   Konto → Person     was das Konto vor 0040 bekam, an eine Person (`handOver.ts`)
 *   Klucz podpisu      Rollen der alten Form bekommen ihren eigenen Signierschlüssel (0034)
 *   Koperty RSA        Antworten unter dem Schlüssel der Kanzlei statt im RSA-Umschlag (0037)
 * </code>
 *
 * Jeder Schritt lässt stehen, was er nicht kann, und sagt es. Nach der
 * Übertragung geht diese Datei mit dem Rest (Schritt 3).
 */

import type { Ring, SealedRole } from '../core/keys';
import { forgetKeys } from '../core/ringOf';
import { call } from '../core/session';
import { setPartConfig } from '../forms/form';
import { loadAreaController, setController } from '../forms/intake';
import { rewrapForm } from '../forms/rewrap';
import { templatesOf } from '../forms/sms';
import { updateModule, type ModuleRow } from '../modules/module';
import { separateSignKey, type RoleGraphData } from '../roles/roles';

/** Was noch übrig ist — in der ganzen Datenbank (Zahlen), und was davon bei mir liegt. */
export interface TransferStatus {
  readonly chats: number;
  /** Davon in Bereichen, die ich führe: die stellt mein Knopf um. */
  readonly chatsMine: number;
  readonly controllers: number;
  readonly sms: number;
  /** Konten, deren Wurzel noch etwas hält (vor 0040). */
  readonly accounts: number;
  /** Rollen der alten Form, die jemand hält. */
  readonly layouts: number;
  readonly rsa: number;
  /** Namen, die noch offen dastehen (0097) — sollte 0 sein. */
  readonly plainNames: number;
  /** Rollen ohne Halter: niemand öffnet sie mehr. */
  readonly unheld: number;
  /** Formulare mit RSA-Umschlägen, deren Bereich ich lese. */
  readonly rsaForms: readonly { readonly moduleId: string; readonly values: number }[];
  /** Skripte ohne Eintrag in `schema_version` — die Sache des Servers, nicht des Browsers. */
  readonly migrations: readonly string[];
  readonly legacySchemas: readonly string[];
}

export const loadTransfer = (): Promise<TransferStatus> => call<TransferStatus>('/workspace/transfer');

/**
 * Bleibt etwas, das Schritt 3 im Weg steht? RSA-Umschläge zählen nicht mit: neue
 * Einsendungen kommen immer so an und werden beim ersten Öffnen umgestellt (0037).
 */
export const remaining = (s: TransferStatus): number =>
  s.chats + s.controllers + s.sms + s.accounts + s.layouts + s.plainNames;

/* -- Rozmowy ---------------------------------------------------------------- */

export const transferChats = (): Promise<{ converted: number; skipped: number }> =>
  call('/workspace/transfer/chats', { method: 'POST' });

/* -- Administrator danych ---------------------------------------------------- */

type Controller = { readonly name: string; readonly address: string | null; readonly email: string | null };

export interface ControllerMove {
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly forms: readonly ModuleRow[];
  /** Was in den Obszar geht; `null`: dort (oder darüber) steht schon einer, die alten Einträge gelten nicht mehr. */
  readonly lift: Controller | null;
  /** Die Formulare des Obszars nennen verschiedene — das entscheidet ein Mensch, nicht die Übertragung. */
  readonly conflict: boolean;
}

const sameController = (a: Controller, b: Controller) =>
  a.name.trim() === b.name.trim() && (a.address ?? '').trim() === (b.address ?? '').trim()
  && (a.email ?? '').trim() === (b.email ?? '').trim();

export async function planControllers(modules: readonly ModuleRow[]): Promise<readonly ControllerMove[]> {
  const legacy = modules.filter((m) => m.kind === 'form' && m.controller !== null);
  const byArea = new Map<string | null, ModuleRow[]>();
  for (const m of legacy) byArea.set(m.areaId, [...(byArea.get(m.areaId) ?? []), m]);

  const moves: ControllerMove[] = [];
  for (const [areaId, forms] of byArea) {
    if (areaId === null) {
      moves.push({ areaId, areaName: null, forms, lift: null, conflict: true });
      continue;
    }

    const { controller } = await loadAreaController(areaId);
    const distinct: Controller[] = [];
    for (const form of forms) {
      if (form.controller !== null && !distinct.some((d) => sameController(d, form.controller!))) distinct.push(form.controller);
    }

    moves.push({
      areaId, areaName: forms[0].areaName, forms,
      lift: controller !== null || distinct.length !== 1 ? null : distinct[0],
      conflict: controller === null && distinct.length > 1
    });
  }

  return moves;
}

export async function moveControllers(moves: readonly ControllerMove[]): Promise<{ lifted: number; cleared: number; left: number }> {
  let lifted = 0;
  let cleared = 0;
  let left = 0;

  for (const move of moves) {
    if (move.areaId === null || move.conflict) { left += move.forms.length; continue; }

    if (move.lift !== null) {
      await setController(move.areaId, {
        name: move.lift.name, address: move.lift.address ?? undefined, email: move.lift.email ?? undefined
      });
      lifted += 1;
    }

    for (const form of move.forms) {
      await updateModule(form.moduleId, { controller: { name: '' } });
      cleared += 1;
    }
  }

  return { lifted, cleared, left };
}

/* -- Szablony SMS ------------------------------------------------------------- */

const configOf = (row: ModuleRow): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(row.config ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
};

export const smsToMove = (modules: readonly ModuleRow[]): readonly ModuleRow[] =>
  modules.filter((m) => (configOf(m).sms ?? '').trim() !== '');

export async function moveSms(modules: readonly ModuleRow[]): Promise<number> {
  let moved = 0;
  for (const row of modules) {
    const config = configOf(row);
    if ((config.sms ?? '').trim() === '') continue;
    await setPartConfig(row.moduleId, { smsTemplates: JSON.stringify(templatesOf(config)), sms: '' });
    moved += 1;
  }
  return moved;
}

/* -- Klucz podpisu (0034) ------------------------------------------------------- */

/** Rollen der alten Form, deren Signierschlüssel dieser Bund öffnet — Konten bleiben, wie sie sind. */
export const layoutsToSeparate = (ring: Ring, graph: RoleGraphData): readonly SealedRole[] =>
  graph.roles.filter((r) => r.keyLayout === 0 && r.kind !== 'account' && ring.maySign(r.id));

export async function separateKeys(ring: Ring, roles: readonly SealedRole[]): Promise<{ separated: number; failed: number }> {
  let separated = 0;
  let failed = 0;
  for (const role of roles) {
    try {
      await separateSignKey(ring, role.id);
      separated += 1;
    } catch {
      failed += 1;
    }
  }
  if (separated > 0) forgetKeys();
  return { separated, failed };
}

/* -- Koperty RSA (0037) ----------------------------------------------------------- */

export async function rewrapForms(
  ring: Ring, forms: readonly { readonly moduleId: string }[]
): Promise<{ rewrapped: number; failed: number }> {
  let rewrapped = 0;
  let failed = 0;
  for (const form of forms) {
    try {
      rewrapped += (await rewrapForm(form.moduleId, ring)).rewrapped;
    } catch {
      failed += 1;
    }
  }
  return { rewrapped, failed };
}
