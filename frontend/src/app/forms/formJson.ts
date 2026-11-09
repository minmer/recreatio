/**
 * 0064 — DIE FRAGEN EINES FORMULARS ALS JSON, hin und zurück.
 *
 * <b>Der Dienst liest keine Frage</b> — sie liegt versiegelt unter dem
 * Schlüssel des Formularbereichs (0042). Ein Export macht sie deshalb HIER auf,
 * mit den Schlüsseln, die dieser Browser hält; ein Import versiegelt jede neue
 * oder geänderte Frage hier, bevor sie hinausgeht. Was sich nicht öffnen lässt,
 * steht im Export mit `"label": null` und wird beim Import nicht angefasst.
 *
 * <b>Kennungen machen das Bearbeiten möglich.</b> Eine Frage mit der Kennung
 * einer vorhandenen wird GEÄNDERT — ihre Antworten bleiben an ihr. Eine ohne
 * (oder mit einer, die es hier nicht gibt, etwa "q1") wird neu angelegt; wo
 * der Aufbau (`design`) oder die Logik der Seite sie nennen, wird die neue
 * Kennung eingesetzt. Gelöscht wird nur auf ausdrücklichen Wunsch — und eine
 * Frage mit Antworten nimmt der Dienst nur vom Formular (0086): ihre Antworten
 * bleiben, und nennt ein Dokument sie wieder, kommt sie zurück.
 *
 * <b>Die Reihenfolge</b> vorhandener Fragen lässt sich nicht umstellen (es gibt
 * dafür keinen Weg im Dienst); neue kommen ans Ende. Wie das Formular sie
 * zeigt, bestimmt der Aufbau (`design.layout`) — und der wird mit importiert.
 */

import { loadAreas, loadPublicKey, myEpochKeys, type AreaRow } from '../areas/area';
import { fromBase64Url } from '../core/crypto';
import {
  addField, asked, editField, FIELD_KINDS, IDENTITY_ROLES, loadFields, openFields, removeField, restoreField,
  type FieldKind, type IdentityRole, type OpenField
} from './form';
import { openDesign, readDesign, saveDesign, sealDesign, type FormDesign, type LayoutItem } from './formDesign';
import { createIntake, loadPublicIntake } from './intake';
import type { Ring } from '../core/keys';
import { loadModules, updateModule } from '../modules/module';
import { keysFor } from '../core/ringOf';
import { selfOf } from '../roles/roles';
import { WorkspaceError, type Who } from '../core/session';
import { t } from '../core/i18n';

const K = 'formsFormat.keys.';

/* -- Die Gestalt ------------------------------------------------------------------ */

export interface QuestionJson {
  readonly id: string;
  readonly kind: FieldKind;
  readonly label: string | null;
  readonly help: string | null;
  readonly options: readonly string[];
  readonly required: boolean;
  readonly halfWidth: boolean;
  readonly identity: IdentityRole;
  readonly selfEdit: boolean;
  /** 0093 — schreibt und berichtigt nur der Mensch; die Kanzlei liest. Fehlt: nein. */
  readonly personOnly?: boolean;
  readonly answersTo: string;
}

export interface FormContent {
  readonly questions: readonly QuestionJson[];

  /** 0086 — die vom Formular genommenen Fragen (nicht im Export; ein Wymaganie holt sie zurück, statt sie neu anzulegen). */
  readonly removed?: readonly QuestionJson[];
  readonly design: FormDesign | null;
  /** Wie viele Fragen sich hier nicht öffnen liessen (kein Schlüssel). */
  readonly unread: number;
}

/** Was jeder Schlüssel bedeutet — für die Beschreibung neben dem Import. */
/* Je Schlüssel des Dokuments sein Satz in `formsFormat.json` (`keys.<name>`, Punkte und Klammern daraus entfernt). */
const KEY_NAMES: Readonly<Record<string, string>> = {
  questions: 'questions', 'questions[].id': 'qId', 'questions[].kind': 'qKind', 'questions[].label': 'qLabel',
  'questions[].help': 'qHelp', 'questions[].options': 'qOptions', 'questions[].required': 'qRequired',
  'questions[].halfWidth': 'qHalfWidth', 'questions[].identity': 'qIdentity', 'questions[].selfEdit': 'qSelfEdit',
  'questions[].personOnly': 'qPersonOnly', 'questions[].answersTo': 'qAnswersTo', design: 'design',
  'design.version': 'designVersion', 'design.layout': 'designLayout', 'design.layout[].type': 'layoutType',
  'design.layout[].id': 'layoutId', 'design.layout[].text': 'layoutText', 'design.layout[].print': 'layoutPrint',
  'design.layout[].sign': 'layoutSign', 'design.nodes': 'designNodes', 'design.edges': 'designEdges'
};

/** Was jeder Schlüssel bedeutet — gelesen in der Sprache der App, wenn die Beschreibung entsteht. */
export const QUESTION_KEYS: Readonly<Record<string, string>> = (() => {
  const out: Record<string, string> = {};
  const params = (name: string): Record<string, string> | undefined => (name === 'qKind' ? { kinds: FIELD_KINDS.map((k) => `"${k}"`).join(', ') }
    : name === 'qIdentity' ? { roles: IDENTITY_ROLES.map((r) => `"${r}"`).join(', ') } : undefined);
  for (const [key, name] of Object.entries(KEY_NAMES)) {
    Object.defineProperty(out, key, { get: () => t(K + name, params(name)), enumerable: true });
  }
  return out;
})();

const X = 'formsFormat.qExample.';

/** Ein ausgefülltes Beispiel — dieselben Schlüssel wie oben. */
export const QUESTION_EXAMPLE = {
  questions: [
    { id: 'q1', kind: 'line', get label() { return t(`${X}given`); }, help: null, options: [], required: true, halfWidth: true, identity: 'given_name', selfEdit: true, answersTo: '<id-obszaru>' },
    { id: 'q2', kind: 'choice', get label() { return t(`${X}stay`); }, get help() { return t(`${X}stayHelp`); }, get options() { return [t(`${X}tent`), t(`${X}school`)]; }, required: false, halfWidth: false, identity: 'none', selfEdit: true, answersTo: '<id-obszaru>' }
  ],
  design: {
    version: 1,
    layout: [{ type: 'field', id: 'q1' }, { type: 'text', id: 't1', get text() { return t(`${X}lodging`); } }, { type: 'field', id: 'q2', print: true },
      { type: 'text', id: 't2', get text() { return t(`${X}consent`); }, sign: true }],
    nodes: [],
    edges: []
  }
} as const;

/* -- Die Schlüssel ------------------------------------------------------------------ */

interface Keys {
  readonly ring: Ring | null;
  readonly personId: string | null;
  readonly areas: readonly AreaRow[];
  /** Zum Öffnen: was ich halte, sonst der veröffentlichte Schlüssel. */
  readonly open: Map<string, Uint8Array>;
}

/** Wie in `FormOffice`: erst die Zuteilung, dann der veröffentlichte Schlüssel. */
async function keysOf(who: Who, sealedUnder: readonly string[]): Promise<Keys> {
  let ring: Ring | null = null;
  let personId: string | null = null;
  try {
    const keys = await keysFor(who);
    ring = keys.ring;
    personId = selfOf(keys.graph)?.id ?? null;
  } catch {
    ring = null;
  }

  const areas = await loadAreas().then((r) => r.areas, () => [] as readonly AreaRow[]);
  const open = new Map<string, Uint8Array>();

  if (ring !== null) {
    for (const area of areas) {
      try {
        const key = (await myEpochKeys(ring, area.areaId)).get(area.currentEpoch);
        if (key !== undefined) open.set(area.areaId, key);
      } catch { /* keine Zuteilung — eine Auskunft, kein Fehler */ }
    }
  }

  for (const areaId of new Set(sealedUnder)) {
    if (open.has(areaId)) continue;
    try { open.set(areaId, fromBase64Url((await loadPublicKey(areaId)).key)); } catch { /* bleibt zu */ }
  }

  return { ring, personId, areas, open };
}

/** Der Schlüssel der laufenden Epoche eines Bereichs — zum Versiegeln. */
async function sealingKey(keys: Keys, areaId: string): Promise<{ key: Uint8Array; epoch: number }> {
  if (keys.ring === null) throw new WorkspaceError(t('formsFormat.msg.noPassword'));
  const area = keys.areas.find((a) => a.areaId === areaId);
  const key = area === undefined ? undefined : (await myEpochKeys(keys.ring, areaId)).get(area.currentEpoch);
  if (area === undefined || key === undefined) throw new WorkspaceError(t('formsFormat.msg.noAreaKey', { area: area?.name ?? areaId }));
  return { key, epoch: area.currentEpoch };
}

const asQuestion = (f: OpenField): QuestionJson => ({
  id: f.fieldId,
  kind: f.kind,
  label: f.label,
  help: f.help,
  options: f.options,
  required: f.isRequired,
  halfWidth: f.isHalfWidth,
  identity: f.identityRole,
  selfEdit: f.selfEdit,
  ...(f.personOnly === true ? { personOnly: true } : {}),
  answersTo: f.areaId
});

/* -- Lesen ------------------------------------------------------------------------ */

export async function readFormContent(who: Who, moduleId: string): Promise<FormContent> {
  const loaded = await loadFields(moduleId);
  /* 0086 — was vom Formular genommen ist, gehört nicht mehr zu seinem Inhalt (es steht daneben, in `removed`). */
  const under = loaded.fields.flatMap((f) => [f.labelAreaId ?? f.areaId]);
  const keys = await keysOf(who, [...under, ...(loaded.design === null ? [] : [loaded.design.areaId])]);
  const every = [...await openFields(loaded.fields, keys.open)].sort((a, b) => a.position - b.position);
  const fields = asked(every);
  const gone = every.filter((f) => f.removedAt != null);

  let design: FormDesign | null = null;
  if (loaded.design !== null) {
    let key: Uint8Array | undefined;
    if (keys.ring !== null) {
      try { key = (await myEpochKeys(keys.ring, loaded.design.areaId)).get(loaded.design.epoch); } catch { key = undefined; }
    }
    if (key === undefined) {
      try {
        const open = await loadPublicKey(loaded.design.areaId);
        if (open.epoch === loaded.design.epoch) key = fromBase64Url(open.key);
      } catch { key = undefined; }
    }
    design = await openDesign(loaded.design, key, moduleId);
  }

  return { questions: fields.map(asQuestion), removed: gone.map(asQuestion), design, unread: fields.filter((f) => f.label === null).length };
}

/* -- Schreiben -------------------------------------------------------------------- */

export interface FormWrite {
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly designSaved: boolean;
  readonly warnings: readonly string[];
  /** Kennung im Dokument → Kennung der Frage. */
  readonly ids: ReadonlyMap<string, string>;
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

interface Wanted {
  readonly id: string;
  readonly kind: FieldKind;
  readonly label: string;
  readonly help: string | null;
  readonly options: readonly string[];
  readonly required: boolean;
  readonly halfWidth: boolean;
  readonly identity: IdentityRole;
  readonly selfEdit: boolean;
  readonly personOnly: boolean;
  readonly answersTo: string | null;
}

/** Die Fragen eines Dokuments, duldsam gelesen. Eine ohne Text fällt weg — mit Warnung. */
export function readQuestions(value: unknown, warnings: string[]): Wanted[] {
  if (!Array.isArray(value)) return [];
  const out: Wanted[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return;
    const q = entry as Record<string, unknown>;
    const label = str(q.label).trim();
    if (label === '') {
      if (q.label !== null) warnings.push(t('formsFormat.msg.noLabel', { n: index + 1 }));
      return;
    }
    const kind = (FIELD_KINDS as readonly string[]).includes(str(q.kind)) ? q.kind as FieldKind : 'line';
    if (kind !== q.kind && q.kind !== undefined) warnings.push(t('formsFormat.msg.unknownKind', { label, kind: str(q.kind) }));
    const identity = (IDENTITY_ROLES as readonly string[]).includes(str(q.identity)) ? q.identity as IdentityRole : 'none';
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === 'string').map((o) => o.trim()).filter((o) => o !== '')
      : str(q.options).split('\n').map((o) => o.trim()).filter((o) => o !== '');
    out.push({
      id: str(q.id).trim(),
      kind,
      label,
      help: str(q.help).trim() === '' ? null : str(q.help).trim(),
      options,
      required: bool(q.required, false),
      halfWidth: bool(q.halfWidth, false),
      identity,
      selfEdit: bool(q.selfEdit, true) || bool(q.personOnly, false),
      personOnly: bool(q.personOnly, false),
      answersTo: str(q.answersTo).trim() === '' ? null : str(q.answersTo).trim()
    });
  });
  return out;
}

/** Kennungen im Aufbau ersetzen — Fragen, die gerade neu entstanden sind. */
function remapDesign(raw: unknown, ids: ReadonlyMap<string, string>): FormDesign {
  const swap = (id: string | undefined) => (id === undefined ? undefined : ids.get(id) ?? id);
  const design = readDesign(raw);
  const item = (one: LayoutItem): LayoutItem =>
    one.type === 'field' ? { ...one, id: swap(one.id)! }
    : one.type === 'group' ? { ...one, items: one.items.map(item) }
    : one;
  return {
    ...design,
    layout: design.layout.map(item),
    nodes: design.nodes.map((n) => ({ ...n, fieldId: swap(n.fieldId), target: swap(n.target) }))
  };
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * DIE FRAGEN EINES DOKUMENTS AN EIN FORMULAR.
 *
 * `answersTo` — wohin die Antworten NEUER Fragen gehen, die selbst keinen
 * Bereich nennen. Hat das Formular noch keinen eigenen Bereich und keine
 * Frage, wird es dieser Bereich (so richtet man ein neues Formular auch von
 * Hand ein): dann lassen sich die Fragen und der Aufbau unter seinem Schlüssel
 * versiegeln.
 */
export async function writeFormContent(
  who: Who,
  form: {
    readonly moduleId: string; readonly areaId: string | null;
    /** 0133 — unter welchem Bereich die Fragen liegen, wenn nicht unter dem eigenen; fehlt: aus der Liste der Module. */
    readonly labelAreaId?: string | null;
  },
  doc: { readonly questions?: unknown; readonly design?: unknown },
  options: {
    readonly replace: boolean; readonly answersTo: string | null; readonly onStage?: (what: string) => void;
    /** 0133 — Kennung im Dokument → Frage, wie ein früherer Import sie anlegte (der Import eines Bereichs merkt es sich). */
    readonly known?: ReadonlyMap<string, string>;
    /** 0133 — eine Frage ohne bekannte Kennung ist die vorhandene gleicher Art mit demselben Wortlaut (statt einer zweiten). */
    readonly byLabel?: boolean;
  }
): Promise<FormWrite> {
  const warnings: string[] = [];
  const wanted = readQuestions(doc.questions, warnings);
  const loaded = await loadFields(form.moduleId);
  const keys = await keysOf(who, loaded.fields.map((f) => f.labelAreaId ?? f.areaId));
  const every = [...await openFields(loaded.fields, keys.open)].sort((a, b) => a.position - b.position);

  /*
   * 0133 — WELCHE VORHANDENE FRAGE eine Frage des Dokuments ist: die mit ihrer Kennung, sonst
   * die, unter der ein früherer Import sie anlegte (`known`), sonst — auf Wunsch — die gleicher
   * Art mit demselben Wortlaut. Jede vorhandene höchstens einmal.
   */
  const allById = new Map(every.map((f) => [f.fieldId, f]));
  const matchOf = new Map<string, string>();
  const claimed = new Set<string>();
  for (const q of wanted) {
    const via = options.known?.get(q.id);
    const hit = allById.has(q.id) ? q.id : via !== undefined && allById.has(via) ? via : undefined;
    if (hit !== undefined && !claimed.has(hit)) { matchOf.set(q.id, hit); claimed.add(hit); }
  }
  if (options.byLabel === true) {
    const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
    for (const q of wanted) {
      if (matchOf.has(q.id)) continue;
      const same = every.find((f) => !claimed.has(f.fieldId) && f.removedAt == null && f.label !== null && f.kind === q.kind && norm(f.label) === norm(q.label));
      if (same !== undefined) { matchOf.set(q.id, same.fieldId); claimed.add(same.fieldId); }
    }
  }

  /*
   * 0086 — EINE VOM FORMULAR GENOMMENE FRAGE, die das Dokument wieder nennt,
   * kommt zurück (mit ihren Antworten) und wird wie jede vorhandene behandelt.
   */
  const named = new Set(matchOf.values());
  for (const f of every) {
    if (f.removedAt == null || !named.has(f.fieldId)) continue;
    options.onStage?.(t('formsFormat.msg.restoring', { label: f.label ?? f.fieldId }));
    await restoreField(f.fieldId);
    warnings.push(t('formsFormat.msg.restored', { label: f.label ?? f.fieldId }));
  }
  const now = every.filter((f) => f.removedAt == null || named.has(f.fieldId));
  const byId = new Map(now.map((f) => [f.fieldId, f]));

  let formArea = form.areaId;
  const fieldOf = (q: { readonly id: string }) => { const id = matchOf.get(q.id); return id === undefined ? undefined : byId.get(id); };
  const fresh = wanted.filter((q) => fieldOf(q) === undefined);

  if (formArea === null && now.length === 0 && options.answersTo !== null && (fresh.length > 0 || doc.design != null)) {
    options.onStage?.(t('formsFormat.msg.settingArea'));
    await updateModule(form.moduleId, { areaId: options.answersTo });
    formArea = options.answersTo;
  }

  /*
   * 0133 — DIE FRAGEN UNTER DEM BEREICH, IN DEM SIE VERÖFFENTLICHT SIND (`labelAreaId`), wenn das
   * Formular einen hat — sonst unter seinem eigenen. Die Antworten gehen in den eigenen.
   */
  const labelAreaId = form.labelAreaId !== undefined ? form.labelAreaId
    : (await loadModules().then((r) => r.modules.find((m) => m.moduleId === form.moduleId)?.labelAreaId ?? null, () => null));
  const questionsArea = formArea === null ? null : labelAreaId ?? formArea;

  const ids = new Map<string, string>();
  let added = 0;
  let changed = 0;
  let unchanged = 0;

  /* Erst die vorhandenen: geändert, wo etwas anders ist. */
  for (const q of wanted) {
    const f = fieldOf(q);
    if (f === undefined) continue;
    ids.set(q.id, f.fieldId);
    if (f.label === null) { warnings.push(t('formsFormat.msg.sealedSkip', { id: q.id })); continue; }
    if (q.answersTo !== null && q.answersTo !== f.areaId) {
      warnings.push(t('formsFormat.msg.answersStay', { label: q.label }));
    }
    const differs = f.kind !== q.kind || f.label !== q.label || (f.help ?? null) !== q.help || !same(f.options, q.options)
      || f.isRequired !== q.required || f.isHalfWidth !== q.halfWidth || f.identityRole !== q.identity || f.selfEdit !== q.selfEdit
      || (f.personOnly === true) !== q.personOnly;
    if (!differs) { unchanged += 1; continue; }

    options.onStage?.(t('formsFormat.msg.sealing', { label: q.label }));
    const { key, epoch } = await sealingKey(keys, questionsArea ?? f.areaId);
    await editField(f.fieldId, {
      key,
      labelArea: questionsArea === null ? null : { areaId: questionsArea, epoch },
      label: q.label, help: q.help, options: q.kind === 'choice' ? q.options : [],
      kind: q.kind, isRequired: q.required, isHalfWidth: q.halfWidth, identityRole: q.identity, selfEdit: q.selfEdit,
      personOnly: q.personOnly
    });
    changed += 1;
  }

  /* Dann die neuen — ans Ende (hinter allen, auch den vom Formular genommenen). */
  let position = every.length;
  const intakes = new Set<string>();
  for (const q of fresh) {
    const target = q.answersTo ?? options.answersTo ?? formArea ?? now[0]?.areaId ?? null;
    if (target === null) {
      warnings.push(t('formsFormat.msg.noAnswerArea', { label: q.label }));
      continue;
    }
    if (keys.ring === null) throw new WorkspaceError(t('formsFormat.msg.noPassword'));

    if (!intakes.has(target)) {
      const takes = await loadPublicIntake(target).then(() => true, () => false);
      if (!takes) {
        if (keys.personId === null) throw new WorkspaceError(t('formsFormat.msg.noPerson'));
        options.onStage?.(t('forms.settings.intakeCreating'));
        await createIntake(keys.ring, target, keys.personId);
      }
      intakes.add(target);
    }

    options.onStage?.(t('formsFormat.msg.sealing', { label: q.label }));
    const answers = await sealingKey(keys, target);
    const labelArea = questionsArea === null ? undefined : { areaId: questionsArea, ...(await sealingKey(keys, questionsArea)) };
    const done = await addField(form.moduleId, {
      areaId: target, areaKey: answers.key, epoch: answers.epoch,
      labelArea,
      kind: q.kind, position, label: q.label, help: q.help ?? undefined,
      options: q.kind === 'choice' ? q.options : undefined,
      isRequired: q.required, isHalfWidth: q.halfWidth, identityRole: q.identity, selfEdit: q.selfEdit,
      personOnly: q.personOnly
    });
    if (q.id !== '') ids.set(q.id, done.fieldId);
    position += 1;
    added += 1;
  }

  /* Gelöscht wird nur auf Wunsch — eine Frage mit Antworten nimmt der Dienst nur vom Formular (0086). */
  let removed = 0;
  if (options.replace) {
    const keep = new Set(matchOf.values());
    for (const f of now) {
      if (keep.has(f.fieldId)) continue;
      try {
        await removeField(f.fieldId);
        removed += 1;
      } catch (e) {
        warnings.push(t('formsFormat.msg.stays', { label: f.label ?? f.fieldId, why: e instanceof WorkspaceError ? e.message : t('formsFormat.msg.deleteFailed') }));
      }
    }
  }

  /* Der Aufbau — mit den Kennungen der eben entstandenen Fragen. */
  let designSaved = false;
  if (doc.design !== undefined) {
    if (formArea === null || questionsArea === null) {
      warnings.push(t('formsFormat.msg.designNeedsArea'));
    } else {
      options.onStage?.(t('formsFormat.msg.savingLayout'));
      const { key, epoch } = await sealingKey(keys, questionsArea);
      await saveDesign(form.moduleId, questionsArea, epoch, doc.design === null ? null : await sealDesign(remapDesign(doc.design, ids), key, form.moduleId));
      designSaved = true;
    }
  }

  return { added, changed, removed, unchanged, designSaved, warnings, ids };
}
