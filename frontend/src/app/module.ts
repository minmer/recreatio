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

  /** Wie viel er trägt. */
  readonly fields: number;
  readonly entries: number;

  /** Geschlossen: ein Formular, das nichts mehr annimmt (0042). */
  readonly closed: boolean;

  /** Wer für die Daten steht — EINE Klausel je Formular (0042). */
  readonly controller: { readonly name: string; readonly address: string | null; readonly email: string | null } | null;

  /** Welches Formular dieses ERWEITERT (0047) — `null` bei einem gewöhnlichen. */
  readonly extendsId: string | null;

  /** Wer es ausfüllt (0047): jeder, der Mensch selbst als Ergänzung, oder nur die Kanzlei. */
  readonly audience: 'public' | 'person' | 'office';
}

/**
 * Was beim Umzug eines Formulars neu versiegelt mitgeht: jede Frage (0042) und
 * sein Aufbau samt Logik (0043), falls es einen hat.
 */
export interface Resealed {
  readonly fields: readonly ResealIn[];
  readonly design?: { readonly sealed: string; readonly epoch: number };
}

/** Eine Frage, unter dem Schlüssel des NEUEN Formularbereichs versiegelt (0042). */
export interface ResealIn {
  readonly fieldId: string;
  readonly labelSealed: string;
  readonly helpSealed: string | null;
  readonly optionsSealed: string | null;
  readonly labelEpoch: number;
}

export const loadModules = (): Promise<{ modules: readonly ModuleRow[] }> =>
  call('/workspace/modules');

export const createModule = (
  moduleId: string, kind: string, name: string, areaId: string | null,
  forKind: Subject = 'none', config?: string,

  /**
   * EINE ERWEITERUNG (0047): welches Formular, und wer sie ausfüllt. Bereich
   * und „wovon" übernimmt der Dienst vom erweiterten Formular.
   */
  extension?: { readonly extendsId: string; readonly audience: 'person' | 'office' }
): Promise<{ moduleId: string }> =>
  call('/workspace/module', {
    method: 'POST',
    body: JSON.stringify({
      moduleId, kind, name, areaId, forKind, config: config ?? '{}',
      extendsId: extension?.extendsId ?? null,
      audience: extension?.audience ?? null
    })
  });

/**
 * Umbenennen, den Bereich setzen, die Einstellung ändern — und beim
 * Formular: öffnen, schliessen, die Klausel.
 *
 * <b>Den Bereich eines Formulars zu wechseln geht, wenn der Browser jede
 * Frage neu versiegelt mitschickt</b> (`reseal`, 0042). Der Dienst selbst
 * kann nichts umschlüsseln; ohne die neuen Hüllen lehnt er ab.
 */
export const updateModule = (
  moduleId: string,
  change: {
    name?: string; areaId?: string; clearArea?: boolean; config?: string;

    /** Nur solange nichts eingegangen ist — sonst lehnt der Dienst ab (409). */
    forKind?: Subject;

    closed?: boolean;
    controller?: { name: string; address?: string; email?: string };
    reseal?: readonly ResealIn[];

    /** Der Aufbau, unter dem Schlüssel des neuen Bereichs (0043) — Pflicht, wenn es einen gibt. */
    designSealed?: string;
    designEpoch?: number;
  }
): Promise<{ moduleId: string; areaId: string | null; name: string }> =>
  call(`/workspace/module/${encodeURIComponent(moduleId)}`, {
    method: 'POST',
    body: JSON.stringify(change)
  });

export const removeModule = (moduleId: string): Promise<{ removed: boolean }> =>
  call(`/workspace/module/${encodeURIComponent(moduleId)}`, { method: 'DELETE' });
