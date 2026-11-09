/**
 * 2026-10-24 — WAS EIN DOKUMENT ÜBER EIN MODUL SAGT.
 *
 * Ein Modul-Dokument ("recreatio/module", im Bausteinverwalter) und ein
 * Eintrag in "modules" einer Seite tragen dieselben Schlüssel eines Moduls:
 * Name, Inhalt und — bei einem Formular — Fragen, Aufbau, Wymagania, die
 * Rollen seiner Menschen, Obszary osób, Gruppe, Wiederholung, wer ausfüllt.
 * Gelesen wird das HIER, einmal; ausgeführt in `moduleImport.ts`, für das
 * Modul im Bausteinverwalter und für jedes Formular einer importierten Seite.
 * So kann eine Seite alles, was ein Modul kann, und die Beschreibung steht an
 * einer Stelle (`forms/formFormat.ts`).
 */

import { needOf } from '../forms/needs';
import { readNeeds } from '../forms/needPlan';
import { needWishLines, readNeedWishes, type NeedWish } from '../forms/needsJson';
import { describeVirtualAreas, readVirtualAreas, type VirtualAreaDoc } from '../forms/virtualAreasJson';
import { REPEAT_LABEL, REPEATS, repeatOf, type Repeat } from '../forms/rounds';
import { memberRolesOf } from '../forms/formGroups';
import { asRecord, asText } from '../pages/event/kit';
import { readConfig, type ModuleRow } from './module';
import { t } from '../core/i18n';

const audienceWord = (audience: 'person' | 'office'): string => t(audience === 'office' ? 'modules.wish.officeOnly' : 'modules.wish.personLink');

export interface ModuleWish {
  readonly name?: string;
  /** "config", wie es im Dokument steht — gelesen wird es nach der Art des Moduls (`configFromJson`). */
  readonly config?: unknown;
  readonly questions?: unknown;
  readonly design?: unknown;
  readonly needs?: readonly NeedWish[];
  readonly repeat?: Repeat;
  /** 0091/0120 — die Rollen seiner Menschen (aus "memberRoles", oder dem älteren "memberRole"). */
  readonly memberRoles?: readonly string[];
  readonly virtualAreas?: readonly VirtualAreaDoc[];
  /** 0096 — wer ein Unterformular ausfüllt. */
  readonly audience?: 'person' | 'office';
  /** 0096 — die Gruppe (ein Name, oder `null`: keine). */
  readonly group?: string | null;
  /** Was beim Lesen auffiel. */
  readonly warnings: readonly string[];
}

/** Welche Schlüssel, die nur ein Formular hat, ein Dokument trägt — für die Warnung bei einer anderen Art. */
export function formOnlyKeys(wish: ModuleWish): string[] {
  const said: [string, unknown][] = [
    ['questions', wish.questions], ['design', wish.design], ['needs', wish.needs], ['repeat', wish.repeat], ['memberRoles', wish.memberRoles],
    ['virtualAreas', wish.virtualAreas], ['audience', wish.audience], ['group', wish.group]
  ];
  return said.filter(([, value]) => value !== undefined).map(([key]) => key);
}

/** Die Schlüssel eines Moduls aus einem Dokument oder einem Eintrag — duldsam; was nicht passt, fällt weg (mit Warnung). */
export function readModuleWish(raw: unknown): ModuleWish {
  const root = asRecord(raw);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(root, key);
  const warnings: string[] = [];
  const needs = has('needs') ? readNeedWishes(root.needs, warnings) : undefined;
  const virtual = has('virtualAreas') ? readVirtualAreas(root.virtualAreas, warnings) : undefined;
  return {
    ...(asText(root.name).trim() !== '' ? { name: asText(root.name).trim() } : {}),
    ...(has('config') ? { config: root.config } : {}),
    ...(has('questions') ? { questions: root.questions } : {}),
    ...(has('design') ? { design: root.design } : {}),
    ...(needs === undefined ? {} : { needs }),
    /* 0077 — wie oft eine Erweiterung ausgefüllt wird. Ein unbekanntes Wort ist keines. */
    ...((REPEATS as readonly string[]).includes(asText(root.repeat)) ? { repeat: asText(root.repeat) as Repeat } : {}),
    /* 0091/0120 — eine Liste; älter: eine Kennung, oder null (keine). */
    ...(has('memberRoles') && Array.isArray(root.memberRoles)
      ? { memberRoles: [...new Set(root.memberRoles.map((r) => asText(r).trim()).filter((r) => r !== ''))] }
      : has('memberRole') ? { memberRoles: root.memberRole === null || asText(root.memberRole).trim() === '' ? [] : [asText(root.memberRole).trim()] } : {}),
    ...(virtual === undefined ? {} : { virtualAreas: virtual }),
    ...(asText(root.audience) === 'person' || asText(root.audience) === 'office' ? { audience: asText(root.audience) as 'person' | 'office' } : {}),
    ...(has('group') ? { group: root.group === null ? null : asText(root.group).trim() || null } : {}),
    warnings
  };
}

/** Trägt es etwas, das nur ein Formular hat (mehr als Name und Inhalt)? */
export const carriesForm = (wish: ModuleWish): boolean => formOnlyKeys(wish).length > 0;

/** Ohne Name und Inhalt — die übernimmt eine Seite selbst (an ihrer Stelle). */
export const formPartOf = (wish: ModuleWish): ModuleWish => {
  const { name: _name, config: _config, ...rest } = wish;
  return rest;
};

/** Was ein Formular aus einer Seite bekommt — eine Zeile, ohne zu wissen, was es schon hat. */
export function formWishLine(wish: ModuleWish, label: string): string | null {
  const parts: string[] = [];
  if (wish.questions !== undefined) parts.push(t('modules.wish.part.questions', { count: Array.isArray(wish.questions) ? wish.questions.length : 0 }));
  if (wish.design !== undefined) parts.push(wish.design === null ? t('modules.wish.part.plainList') : t('modules.wish.part.design'));
  if (wish.needs !== undefined) parts.push(wish.needs.length === 0 ? t('modules.wish.part.noNeeds') : t('modules.wish.part.needs', { list: wish.needs.map((w) => `„${needOf(w.id)?.label ?? w.id}”`).join(', ') }));
  if (wish.memberRoles !== undefined) parts.push(wish.memberRoles.length === 0 ? t('modules.wish.part.noRoles') : t('modules.wish.part.roles'));
  if (wish.virtualAreas !== undefined) parts.push(t('modules.wish.part.areas', { count: wish.virtualAreas.length }));
  if (wish.group !== undefined) parts.push(wish.group === null ? t('modules.wish.part.noGroup') : t('modules.wish.part.group', { name: wish.group }));
  if (wish.repeat !== undefined) parts.push(t('modules.wish.part.repeat', { repeat: REPEAT_LABEL[wish.repeat] }));
  if (wish.audience !== undefined) parts.push(t('modules.wish.part.audience', { who: audienceWord(wish.audience) }));
  return parts.length === 0 ? null : t('modules.wish.line', { label, parts: parts.join('; ') });
}

const sameRoles = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * WAS DER IMPORT AN DIESEM MODUL TÄTE — die Formular-Schlüssel (Name und
 * Inhalt sagt der Aufrufer, der weiss, wie er sie liest).
 */
export function formWishPreview(row: ModuleRow, wish: ModuleWish, options: { readonly replace: boolean }): { lines: string[]; warnings: string[] } {
  const form = row.kind === 'form';
  const lines: string[] = [];
  const warnings: string[] = [...wish.warnings];
  if (!form) {
    const said = formOnlyKeys(wish);
    if (said.length > 0) warnings.push(t('modules.wish.formOnly', { keys: said.map((k) => `"${k}"`).join(', ') }));
    return { lines, warnings };
  }
  if (wish.questions !== undefined) lines.push(t('modules.wish.questionsInDoc', { count: Array.isArray(wish.questions) ? wish.questions.length : 0 }));
  if (wish.design !== undefined) lines.push(wish.design === null ? t('modules.wish.plainList') : t('modules.wish.designFromDoc'));
  if (wish.needs !== undefined) {
    const said = needWishLines(wish.needs, readNeeds(readConfig(row.config).needs), options.replace);
    lines.push(...(said.length === 0 ? [t('modules.wish.needsSame')] : said));
  }
  if (wish.repeat !== undefined && wish.repeat !== repeatOf(row.repeat)) {
    if (row.extendsId === null) warnings.push(t('modules.wish.repeatOnlyExt'));
    else if (row.entries > 0) warnings.push(t('modules.wish.repeatHasEntries'));
    else lines.push(t('modules.wish.repeatLine', { repeat: REPEAT_LABEL[wish.repeat] }));
  }
  if (wish.memberRoles !== undefined && !sameRoles(wish.memberRoles, memberRolesOf(row))) {
    if (row.extendsId !== null) warnings.push(t('modules.wish.rolesOnlyForms'));
    else lines.push(wish.memberRoles.length === 0 ? t('modules.wish.rolesNone') : t('modules.wish.rolesFromDoc'));
  }
  if (wish.virtualAreas !== undefined) {
    if (row.extendsId !== null) warnings.push(t('modules.wish.areasOnlyForms'));
    else lines.push(describeVirtualAreas(wish.virtualAreas));
  }
  if (wish.audience !== undefined && row.extendsId !== null && wish.audience !== row.audience) {
    if (row.entries > 0) warnings.push(t('modules.wish.audienceHasEntries'));
    else lines.push(t('modules.wish.audienceLine', { who: audienceWord(wish.audience) }));
  }
  if (wish.group !== undefined) lines.push(wish.group === null ? t('modules.wish.groupNone') : t('modules.wish.groupWill', { name: wish.group }));
  return { lines, warnings };
}
