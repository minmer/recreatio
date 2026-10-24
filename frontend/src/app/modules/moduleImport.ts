/**
 * 2026-10-24 — EIN MODUL AUS EINEM DOKUMENT ÄNDERN: im Bausteinverwalter
 * (`ModuleJson.tsx`) und für jedes Formular einer importierten Seite
 * (`PageJsonPanel.tsx`) — dieselben Schritte in derselben Reihenfolge. Was das
 * Dokument sagt, liest `moduleWish.ts`.
 *
 * <b>Die Reihenfolge baut aufeinander auf:</b> Name, Wiederholung, wer
 * ausfüllt, Gruppe, Inhalt, Rollen, Obszary osób, DANN Fragen und Aufbau, und
 * zuletzt die Wymagania — sie übernehmen die eben angelegten Fragen (`ids`)
 * oder legen an, was fehlt.
 */

import { setPartConfig } from '../forms/form';
import { writeFormContent } from '../forms/formJson';
import { memberRolesOf } from '../forms/formGroups';
import { importNeeds } from '../forms/formTemplates';
import { REPEAT_LABEL, repeatOf } from '../forms/rounds';
import { importVirtualAreas } from '../forms/virtualAreasJson';
import { keysFor } from '../core/ringOf';
import { newId } from '../core/ids';
import type { Who } from '../core/session';
import { configFromJson, replacing } from '../pages/pageJson';
import { keepOwn } from '../pages/part';
import { partOf } from '../pages/parts/registry';
import { setMemberRoles } from '../roles/memberRole';
import { createFormGroup, loadModules, readConfig, updateModule, type ModuleRow } from './module';
import type { ModuleWish } from './moduleWish';

export interface ModuleImportOptions {
  /** Fragen und Wymagania, die nicht im Dokument stehen, nehmen („Usuń pozostałe"). */
  readonly replace: boolean;
  /** Wohin die Antworten neuer Fragen gehen — `null`: wie im Dokument, sonst der Bereich des Formulars. */
  readonly answersTo: string | null;
  readonly stage: (what: string) => void;
}

const sameRoles = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Die Tafel aus einem Dokument — die eigenen Schlüssel des Moduls (`needs`) bleiben, wie sie sind. */
export function wantedConfig(kind: string, have: Readonly<Record<string, string>>, value: unknown): Record<string, string> {
  const def = partOf(kind);
  const wanted = configFromJson(kind, value);
  return def === undefined ? wanted : keepOwn(def.json, have, wanted);
}

export async function applyModuleWish(who: Who, row: ModuleRow, wish: ModuleWish, options: ModuleImportOptions): Promise<{ lines: string[]; warnings: string[] }> {
  const form = row.kind === 'form';
  const { stage } = options;
  const lines: string[] = [];
  const warnings: string[] = [];

  if (wish.name !== undefined && wish.name !== row.name) {
    stage('Zmiana nazwy…');
    await updateModule(row.moduleId, { name: wish.name }, row);
    lines.push(`Nazwa: „${wish.name}”.`);
  }
  if (wish.repeat !== undefined && wish.repeat !== repeatOf(row.repeat) && row.extendsId !== null && row.entries === 0) {
    stage('Zmiana powtarzania…');
    await updateModule(row.moduleId, { repeat: wish.repeat });
    lines.push(`Powtarzanie: ${REPEAT_LABEL[wish.repeat]}.`);
  }
  if (wish.audience !== undefined && row.extendsId !== null && wish.audience !== row.audience && row.entries === 0) {
    stage('Zmiana: kto wypełnia…');
    await updateModule(row.moduleId, { audience: wish.audience });
    lines.push(`Kto wypełnia: ${wish.audience === 'office' ? 'tylko koordynator' : 'osoba przez swój link'}.`);
  }
  if (form && wish.group !== undefined) {
    stage('Grupa formularzy…');
    if (wish.group === null) {
      await updateModule(row.moduleId, { clearGroup: true });
      lines.push('Grupa: żadna.');
    } else {
      const wanted = wish.group;
      const known = ((await loadModules()).groups ?? []).find((g) => g.name.toLocaleLowerCase('pl') === wanted.toLocaleLowerCase('pl'));
      /* 0097 — eine neue Gruppe gehört dem Bereich des Formulars: unter seinem Schlüssel liegt ihr Name. */
      if (known === undefined && row.areaId === null) {
        warnings.push(`Grupa „${wanted}”: formularz nie ma jeszcze obszaru — grupy nie da się założyć.`);
      } else {
        const groupId = known?.groupId ?? (await createFormGroup(newId(), wanted, row.areaId!)).groupId;
        await updateModule(row.moduleId, { groupId });
        lines.push(known === undefined ? `Grupa „${wanted}" założona, formularz w niej.` : `Grupa: „${known.name}".`);
      }
    }
  }
  if (wish.config !== undefined) {
    const have = readConfig(row.config);
    const patch = replacing(have, wantedConfig(row.kind, have, wish.config));
    if (Object.keys(patch).length > 0) {
      stage('Zapisywanie treści…');
      await setPartConfig(row.moduleId, patch);
      lines.push('Treść zapisana.');
    }
  }
  if (form && row.extendsId === null && wish.memberRoles !== undefined && !sameRoles(wish.memberRoles, memberRolesOf(row))) {
    stage('Ustawianie ról uczestników…');
    try {
      /* Nur Rollen, die der Importierende hält — eine fremde Kennung nähme sonst der ganzen Liste die Wirkung. */
      const { ring } = await keysFor(who);
      const held = wish.memberRoles.filter((roleId) => ring?.has(roleId) === true);
      for (const roleId of wish.memberRoles) {
        if (!held.includes(roleId)) warnings.push(`Roli ${roleId.slice(0, 8)}… nie masz — pominięta.`);
      }
      await setMemberRoles(row.moduleId, held);
      lines.push(held.length === 0 ? 'Role uczestników: żadne.' : 'Role uczestników ustawione.');
    } catch (e) {
      warnings.push(`Role uczestników nie zostały ustawione: ${e instanceof Error ? e.message : 'nie udało się'}`);
    }
  }
  if (form && row.extendsId === null && wish.virtualAreas !== undefined) {
    try {
      const done = await importVirtualAreas(who, row.moduleId, wish.virtualAreas, stage);
      lines.push(...done.lines);
      warnings.push(...done.warnings);
    } catch (e) {
      warnings.push(`Obszary osób: ${e instanceof Error ? e.message : 'nie udało się'}`);
    }
  }

  let ids: ReadonlyMap<string, string> = new Map();
  if (form && (wish.questions !== undefined || wish.design !== undefined)) {
    const written = await writeFormContent(who, { moduleId: row.moduleId, areaId: row.areaId }, { questions: wish.questions, design: wish.design },
      { replace: options.replace, answersTo: options.answersTo, onStage: stage });
    ids = written.ids;
    lines.push(`Pytania: nowe — ${written.added}, zmienione — ${written.changed}, bez zmian — ${written.unchanged}${written.removed > 0 ? `, usunięte — ${written.removed}` : ''}${written.designSaved ? '; układ zapisany' : ''}.`);
    warnings.push(...written.warnings);
  }

  /* Die Wymagania zuletzt — mit dem Bereich und der Tafel, die das Formular JETZT hat. */
  if (form && wish.needs !== undefined) {
    const now = (await loadModules()).modules.find((m) => m.moduleId === row.moduleId) ?? row;
    const done = await importNeeds(who, now, wish.needs, {
      ids, config: readConfig(now.config), replace: options.replace, answersTo: options.answersTo, onStage: stage
    });
    lines.push(...done.lines);
    warnings.push(...done.warnings);
  }

  return { lines, warnings };
}
