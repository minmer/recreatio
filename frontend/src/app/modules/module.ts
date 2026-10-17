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

import { groupNameAad, moduleNameAad, nameText, openName, sealUnderArea } from '../core/names';
import type { Repeat } from '../forms/rounds';
import { call, WorkspaceError } from '../core/session';

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

  /**
   * Wie er heisst. 0097 — bei einem Formular liegt der Name versiegelt unter
   * dem Schlüssel seines Bereichs; `loadModules` öffnet ihn. Geht er nicht auf
   * (dieser Browser liest den Bereich nicht), steht hier ein Ersatz und
   * `nameLocked` ist gesetzt.
   */
  readonly name: string;
  readonly nameSealed?: string | null;
  readonly nameEpoch?: number | null;
  readonly nameLocked?: boolean;
  /** 0097 — ein Formular ganz ohne Namen (auf einer Seite angelegt): `name` ist nur der Ersatz. */
  readonly nameMissing?: boolean;
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

  /** 0077 — wie oft eine Erweiterung je Mensch ausgefüllt wird (`rounds.ts`). Fehlt es: einmal. */
  readonly repeat?: Repeat;

  /** 0081 — die Formulare, deren Menschen an diesen Baustein schreiben dürfen („Napisz do nas"). */
  readonly formIds?: readonly string[];

  /** 0091 — die Rolle, die jeder bekommt, der dieses Formular einsendet (`null`: keine; fehlt beim alten Dienst). */
  readonly memberRoleId?: string | null;

  /** 0096 — die Gruppe von Formularen (ein Ordner), in der es steht, und an welcher Stelle. */
  readonly groupId?: string | null;
  readonly groupPosition?: number | null;
}

/**
 * GRUPA FORMULARZY (0096) — ein Ordner: Formulare und Unterformulare unter
 * einem Namen, in einer Reihenfolge. Für den Menschen, der ausfüllt, ändert
 * sich nichts.
 */
export interface FormGroup {
  readonly groupId: string;
  /** 0097 — der Bereich der Gruppe: unter seinem Schlüssel liegt ihr Name (`loadModules` öffnet ihn). */
  readonly areaId?: string | null;
  readonly name: string;
  readonly nameSealed?: string | null;
  readonly nameEpoch?: number | null;
  readonly nameLocked?: boolean;
  readonly createdAt: string;
  /** Von mir angelegt. */
  readonly mine: boolean;
  /** Darf ich sie umbenennen, ordnen, auflösen (angelegt oder ein Formular darin geführt)? */
  readonly manages: boolean;
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

type RawRow = Omit<ModuleRow, 'name'> & { readonly name: string | null };
type RawGroup = Omit<FormGroup, 'name'> & { readonly name?: string | null };

/** 0097 — wie ein Formular heisst, das (noch) keinen lesbaren Namen hat: nach seiner Seite. */
export const unnamedForm = (row: Pick<ModuleRow, 'pages'>): string =>
  row.pages.length > 0 ? `Formularz na /${row.pages[0]}` : 'Formularz bez nazwy';

/**
 * Die Bausteine — mit geöffneten Namen (0097). Ein Formularname, der nicht
 * aufgeht, bekommt einen Ersatz und `nameLocked`; ein alter, noch offener
 * steht, wie er ist, bis ein Browser der Kanzlei ihn versiegelt.
 */
export async function loadModules(): Promise<{ modules: readonly ModuleRow[]; groups?: readonly FormGroup[] }> {
  const raw = await call<{ modules: readonly RawRow[]; groups?: readonly RawGroup[] }>('/workspace/modules');

  const modules = await Promise.all(raw.modules.map(async (row): Promise<ModuleRow> => {
    if (row.nameSealed == null) return row.name !== null ? { ...row, name: row.name } : { ...row, name: row.kind === 'form' ? unnamedForm(row) : row.kind, nameMissing: true };
    const opened = await openName(row.areaId, row, moduleNameAad(row.moduleId));
    return opened === null ? { ...row, name: unnamedForm(row), nameLocked: true } : { ...row, name: opened };
  }));

  const groups = raw.groups === undefined ? undefined : await Promise.all(raw.groups.map(async (group): Promise<FormGroup> => {
    const opened = await openName(group.areaId, group, groupNameAad(group.groupId));
    return opened === null ? { ...group, name: group.name ?? 'Grupa formularzy', nameLocked: true } : { ...group, name: opened };
  }));

  return groups === undefined ? { modules } : { modules, groups };
}

/* -- 0096: Gruppen von Formularen ------------------------------------------------------------ */

/** 0097 — eine Gruppe gehört einem Bereich: unter seinem Schlüssel liegt ihr Name. */
export async function createFormGroup(groupId: string, name: string, areaId: string): Promise<{ groupId: string; name: string }> {
  const clean = nameText(name);
  if (clean === '') throw new WorkspaceError('Grupa potrzebuje nazwy.');
  await call('/workspace/form-groups', {
    method: 'POST',
    body: JSON.stringify({ groupId, areaId, ...await sealUnderArea(areaId, groupNameAad(groupId), clean) })
  });
  return { groupId, name: clean };
}

/** Umbenennen (unter dem Schlüssel des Bereichs der Gruppe) und/oder ordnen (`order`: die Formulare der Gruppe in ihrer neuen Folge). */
export async function updateFormGroup(
  groupId: string, change: { name?: string; order?: readonly string[] }, areaId?: string | null
): Promise<{ saved: boolean }> {
  let named = {};
  if (change.name !== undefined) {
    const clean = nameText(change.name);
    if (clean === '') throw new WorkspaceError('Grupa potrzebuje nazwy.');
    if (areaId == null) throw new WorkspaceError('Ta grupa nie ma obszaru — jej nazwy nie ma czym zapieczętować.');
    named = await sealUnderArea(areaId, groupNameAad(groupId), clean);
  }
  return call(`/workspace/form-group/${encodeURIComponent(groupId)}`, {
    method: 'POST',
    body: JSON.stringify({ ...named, ...(change.order === undefined ? {} : { order: change.order }) })
  });
}

/** Die Gruppe auflösen — ihre Formulare bleiben, nur lose. */
export const removeFormGroup = (groupId: string): Promise<{ removed: boolean }> =>
  call(`/workspace/form-group/${encodeURIComponent(groupId)}`, { method: 'DELETE' });

/**
 * Einen Baustein anlegen. 0097 — ein FORMULAR braucht einen Bereich: unter
 * seinem Schlüssel wird der Name versiegelt, offen geht er nicht hinaus. Bei
 * einer Erweiterung ist es der Bereich des erweiterten Formulars.
 */
export async function createModule(
  moduleId: string, kind: string, name: string, areaId: string | null,
  forKind: Subject = 'none', config?: string,

  /**
   * EINE ERWEITERUNG (0047): welches Formular, und wer sie ausfüllt. Bereich
   * und „wovon" übernimmt der Dienst vom erweiterten Formular.
   */
  extension?: {
    readonly extendsId: string; readonly audience: 'person' | 'office';
    /** 0077 — einmal je Mensch, oder je Tag, Woche, Monat, Jahr. */
    readonly repeat?: Repeat;
  }
): Promise<{ moduleId: string }> {
  const clean = nameText(name);
  let named: Record<string, unknown> = { name: clean };

  if (kind === 'form') {
    if (areaId === null) throw new WorkspaceError('Formularz potrzebuje obszaru — pod jego kluczem leży nazwa.');
    named = { ...await sealUnderArea(areaId, moduleNameAad(moduleId), clean) };
  }

  return call('/workspace/module', {
    method: 'POST',
    body: JSON.stringify({
      moduleId, kind, ...named, areaId, forKind, config: config ?? '{}',
      extendsId: extension?.extendsId ?? null,
      audience: extension?.audience ?? null,
      repeat: extension?.repeat ?? null
    })
  });
}

/**
 * Umbenennen, den Bereich setzen, die Einstellung ändern — und beim
 * Formular: öffnen, schliessen, die Klausel.
 *
 * <b>Den Bereich eines Formulars zu wechseln geht, wenn der Browser jede
 * Frage neu versiegelt mitschickt</b> (`reseal`, 0042). Der Dienst selbst
 * kann nichts umschlüsseln; ohne die neuen Hüllen lehnt er ab.
 */
export async function updateModule(
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

    /** 0077 — wie oft eine Erweiterung ausgefüllt wird. Nur, solange sie leer ist (sonst 409). */
    repeat?: Repeat;

    /** 0096 — wer ein Unterformular ausfüllt. Nur, solange es leer ist (sonst 409). */
    audience?: 'person' | 'office';

    /** 0096 — in welche Gruppe von Formularen; `clearGroup`: aus ihr heraus. */
    groupId?: string;
    clearGroup?: boolean;
  },

  /**
   * 0097 — was der Browser über den Baustein weiss: ob er ein Formular ist, in
   * welchem Bereich er steht, wie er (geöffnet) heisst. Fehlt es und ändert sich
   * der Name oder der Bereich, wird nachgesehen.
   */
  known?: Pick<ModuleRow, 'kind' | 'areaId' | 'name' | 'nameLocked' | 'nameMissing'>
): Promise<{ moduleId: string; areaId: string | null; name: string | null }> {
  const { name, ...rest } = change;
  let named: Record<string, unknown> = name === undefined ? {} : { name: nameText(name) };

  const moving = change.clearArea === true || change.areaId !== undefined;
  if (name !== undefined || moving) {
    const row = known ?? (await loadModules()).modules.find((one) => one.moduleId === moduleId);
    if (row === undefined) throw new WorkspaceError('Takiego modułu nie ma.');

    if (row.kind === 'form') {
      const target = change.clearArea === true ? null : change.areaId ?? row.areaId;
      const reallyMoving = target !== row.areaId;

      /* Der Name geht neu versiegelt mit — der neue, oder beim Umzug der alte unter dem neuen Schlüssel. */
      const text = name !== undefined ? nameText(name) : reallyMoving && row.nameLocked !== true && row.nameMissing !== true ? row.name : null;
      named = {};
      if (text !== null) {
        if (text === '') throw new WorkspaceError('Formularz potrzebuje nazwy.');
        if (target === null) throw new WorkspaceError('Formularz potrzebuje obszaru — pod jego kluczem leży nazwa.');
        named = { ...await sealUnderArea(target, moduleNameAad(moduleId), text) };
      } else if (reallyMoving && row.nameLocked === true) {
        throw new WorkspaceError('Nazwy tego formularza nie da się otworzyć — bez niej nie przeniesiesz go do innego obszaru.');
      }
    }
  }

  return call(`/workspace/module/${encodeURIComponent(moduleId)}`, {
    method: 'POST',
    body: JSON.stringify({ ...rest, ...named })
  });
}

/** `fromPages` (0099) — nur für ein Unterformular: auch von den Seiten nehmen, auf denen es steht. */
export const removeModule = (moduleId: string, options: { readonly fromPages?: boolean } = {}): Promise<{ removed: boolean }> =>
  call(`/workspace/module/${encodeURIComponent(moduleId)}${options.fromPages === true ? '?fromPages=true' : ''}`, { method: 'DELETE' });
