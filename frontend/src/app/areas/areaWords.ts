/**
 * Die Wörter der Bereiche: Stufen (über mich und über andere), Arten der Mitglieder, die Reiter eines Bereichs.
 */

import { texts, t } from '../core/i18n';
import type { Member } from './area';

/**
 * Die Stufen in der Sprache, die im Haus gesprochen wird.
 *
 * <b>Kein `certify` darunter.</b> Es steht neben der Leiter (3.5) und heisst
 * etwas ganz anderes — „darf hineinlassen", nicht „darf mehr". In dieselbe
 * Liste gesetzt läse es sich als vierte Stufe, und genau der Fall, für den es
 * gedacht ist, ginge verloren. `admin` schliesst es ein: wer „prowadzi",
 * lässt auch hinein — und muss es deshalb nicht eigens dastehen haben.
 */
export const LEVEL_NAME: Readonly<Record<'read' | 'write' | 'admin', string>> = texts({
  read: 'areas.level.read',
  write: 'areas.level.write',
  admin: 'areas.level.admin'
});

/** Dieselben Wörter, aber über jemand anderen gesagt. */
export const OTHER_LEVEL: Readonly<Record<string, string>> = texts({
  read: 'areas.otherLevel.read',
  write: 'areas.otherLevel.write',
  admin: 'areas.otherLevel.admin',
  certify: 'areas.otherLevel.certify'
});

export const KIND_NAME: Readonly<Record<Member['kind'], string>> = texts({
  account: 'areas.memberKind.account',
  person: 'areas.memberKind.person',
  group: 'areas.memberKind.group',
  role: 'areas.memberKind.role'
});

/**
 * 2026-10-16 — die Reiter eines Bereichs, als Adresse: `areas/<kennung>/osoby`.
 * 0133 — `profil`: der Reiter der Art (Wydarzenie, Grupa …), nur mit einem
 * Profil; er heisst wie die Art (`AreaPage`).
 */
export type AreaTab = 'profil' | 'przeglad' | 'osoby' | 'dostep' | 'ustawienia';

export const AREA_TABS: readonly { readonly id: AreaTab; readonly label: string }[] = [
  { id: 'profil', get label() { return t('areas.tab.profil'); } },
  { id: 'przeglad', get label() { return t('areas.tab.przeglad'); } },
  { id: 'osoby', get label() { return t('areas.tab.osoby'); } },
  { id: 'dostep', get label() { return t('areas.tab.dostep'); } },
  { id: 'ustawienia', get label() { return t('areas.tab.ustawienia'); } }
];
