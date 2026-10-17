/**
 * Die Wörter der Bereiche: Stufen (über mich und über andere), Arten der Mitglieder, die Reiter eines Bereichs.
 */

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
export const LEVEL_NAME: Record<'read' | 'write' | 'admin', string> = {
  read: 'czytasz',
  write: 'piszesz',
  admin: 'prowadzisz'
};

/** Dieselben Wörter, aber über jemand anderen gesagt. */
export const OTHER_LEVEL: Record<string, string> = {
  read: 'czyta',
  write: 'pisze',
  admin: 'prowadzi',
  certify: 'wpuszcza'
};

export const KIND_NAME: Record<Member['kind'], string> = {
  account: 'Konto',
  person: 'Osoba',
  group: 'Grupa',
  role: 'Rola'
};

/** 2026-10-16 — die Reiter eines Bereichs, als Adresse: `areas/<kennung>/osoby`. */
export type AreaTab = 'przeglad' | 'osoby' | 'dostep' | 'ustawienia';

export const AREA_TABS: readonly { readonly id: AreaTab; readonly label: string }[] = [
  { id: 'przeglad', label: 'Przegląd' },
  { id: 'osoby', label: 'Osoby' },
  { id: 'dostep', label: 'Dostęp' },
  { id: 'ustawienia', label: 'Ustawienia' }
];
