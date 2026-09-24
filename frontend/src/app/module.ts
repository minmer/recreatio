/**
 * Die BAUSTEINE als Dinge, die man verwaltet (0036).
 *
 * <b>Nicht zu verwechseln mit dem, was sie zeigen.</b> Wie eine Art aussieht,
 * was sie trägt und womit man sie füllt, steht bei ihr selbst (`parts/`).
 * Hier steht, wie man einen Baustein anlegt, umbenennt, in einen Bereich legt
 * und wieder entfernt — und wovon er handelt.
 *
 * <b>Diese Datei hiess `moduleKinds` und trug einen Katalog.</b> Der Katalog
 * ist fort: er beschrieb Arten an einer Stelle, während sie an drei anderen
 * gezeichnet wurden. Was blieb, ist der Umgang mit dem Ding.
 */

import { call } from './session';

/**
 * Der Inhalt eines Bausteins, aus seinem gespeicherten `config` gelesen.
 *
 * <b>Duldsam gegenüber allem, was nicht passt.</b> Was hier ankommt, hat den
 * Dienst als Zeichenkette passiert — er liest es nicht und prüft es nicht. Ein
 * kaputter Eintrag darf deshalb die Seite nicht leeren, sondern nur sich
 * selbst: aus Unlesbarem wird ein leerer Baustein, und der Rest steht weiter da.
 */
export function readConfig(text: string | null | undefined): Record<string, string> {
  if (text === null || text === undefined || text.trim() === '') return {};

  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return {}; }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string')
  ) as Record<string, string>;
}

/* -- Die Bausteine selbst (0036) ------------------------------------------- */

/**
 * Ein Baustein ist ein DING, kein Platz auf einer Seite.
 *
 * <b>Er gehört in einen Bereich</b> — dort liegen seine Daten. Die Seite zeigt
 * ihn; sie besitzt ihn nicht. Deshalb ist „derselbe Bogen auf zwei Seiten" kein
 * Sonderfall mehr, sondern zwei Verwendungen eines Bausteins, mit EINEM Satz
 * Fragen und EINEM Satz Antworten.
 *
 * <b>`areaId` darf fehlen.</b> Ein Text trägt nichts Versiegeltes; sein Inhalt
 * steht offen, weil er auf einem Aushang steht. Für ihn entscheidet die Seite.
 */
/**
 * WOVON ein Baustein handelt (0038).
 *
 * <b>Daran hängt, woran der Platz hängt, den eine Einsendung erzeugt.</b> Ein
 * Link muss zu etwas gehören — zu einem Menschen, zu einer Gruppe, zu einem
 * Amt. „Zu irgendetwas" ist keine Antwort, und genau deshalb steht es am
 * Baustein und nicht im Kopf dessen, der ihn gebaut hat.
 */
export const SUBJECTS = ['none', 'person', 'group', 'role'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_LABEL: Record<Subject, string> = {
  none: 'Niczyj — zwykły formularz',
  person: 'Osoby',
  group: 'Grupy',
  role: 'Roli'
};

export interface ModuleRow {
  readonly moduleId: string;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly kind: string;
  readonly name: string;
  readonly config: string | null;
  readonly createdAt: string;

  /** Wovon er handelt — `'none'` heisst: von nichts Benanntem. */
  readonly forKind: Subject;

  /** Auf wie vielen Seiten er steht. `0` ist ein echter Zustand. */
  readonly usedOnPages: number;

  /**
   * UND AUF WELCHEN.
   *
   * <b>Daran hängt, welche Seite sein Portal tragen darf</b> — die Regel des
   * Dienstes geht von der Seite aus, auf der der Bogen steht. Die Oberfläche
   * las das bisher aus dem WEG, über den jemand hereinkam; wer denselben
   * Baustein über die Bausteinliste aufschlug, bekam gar keine Auswahl.
   */
  readonly pages: readonly string[];

  /** Wie viel er trägt — ein Bogen mit Antworten lässt sich nicht mehr umziehen. */
  readonly fields: number;
  readonly entries: number;
}

export const loadModules = (): Promise<{ modules: readonly ModuleRow[] }> =>
  call('/workspace/modules');

export const createModule = (
  moduleId: string, kind: string, name: string, areaId: string | null,
  forKind: Subject = 'none', config?: string
): Promise<{ moduleId: string }> =>
  call('/workspace/module', {
    method: 'POST',
    body: JSON.stringify({ moduleId, kind, name, areaId, forKind, config: config ?? '{}' })
  });

/**
 * Umbenennen, den Bereich setzen, die Einstellung ändern.
 *
 * <b>Den Bereich zu WECHSELN geht nur, solange er leer ist.</b> Was unter dem
 * alten Schlüssel liegt, bleibt darunter — der Dienst kann es nicht
 * umschlüsseln, er hat keinen Schlüssel. Der Dienst lehnt das ab; hier steht
 * es, damit die Oberfläche es vorher sagen kann.
 */
export const updateModule = (
  moduleId: string,
  change: {
    name?: string; areaId?: string; clearArea?: boolean; config?: string;

    /** Nur solange nichts eingegangen ist — sonst lehnt der Dienst ab (409). */
    forKind?: Subject;
  }
): Promise<{ moduleId: string; areaId: string | null; name: string }> =>
  call(`/workspace/module/${encodeURIComponent(moduleId)}`, {
    method: 'POST',
    body: JSON.stringify(change)
  });

export const removeModule = (moduleId: string): Promise<{ removed: boolean }> =>
  call(`/workspace/module/${encodeURIComponent(moduleId)}`, { method: 'DELETE' });
