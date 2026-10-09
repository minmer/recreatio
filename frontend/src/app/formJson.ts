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

import { loadAreas, loadPublicKey, myEpochKeys, type AreaRow } from './area';
import { fromBase64Url } from './crypto';
import {
  addField, asked, editField, FIELD_KINDS, IDENTITY_ROLES, loadFields, openFields, removeField, restoreField,
  type FieldKind, type IdentityRole, type OpenField
} from './form';
import { openDesign, readDesign, saveDesign, sealDesign, type FormDesign, type LayoutItem } from './formDesign';
import { createIntake, loadPublicIntake } from './intake';
import type { Ring } from './keys';
import { updateModule } from './module';
import { keysFor } from './ringOf';
import { selfOf } from './roles';
import { WorkspaceError, type Who } from './session';

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
export const QUESTION_KEYS: Readonly<Record<string, string>> = {
  questions: 'Pytania formularza — lista, w kolejności',
  'questions[].id': 'Identyfikator pytania. Ten z eksportu — pytanie zostanie zmienione (odpowiedzi zostają). Nowy albo własny (np. "q1") — powstanie nowe pytanie; tej samej nazwy można użyć w "design". Pytanie zdjęte z formularza (miało odpowiedzi) nie jest w eksporcie; jego identyfikator w dokumencie przywraca je razem z odpowiedziami',
  'questions[].kind': `Rodzaj: ${FIELD_KINDS.map((k) => `"${k}"`).join(', ')}`,
  'questions[].label': 'Treść pytania',
  'questions[].help': 'Podpowiedź pod pytaniem (albo null). Przy "consent" — pełna treść oświadczenia; zaznaczona zgoda zapisuje się razem z nią ("tak: …"). "pesel" sprawdza cyfrę kontrolną',
  'questions[].options': 'Możliwości wyboru — lista (tylko dla "choice")',
  'questions[].required': 'true — odpowiedź wymagana',
  'questions[].halfWidth': 'true — pole na pół szerokości',
  'questions[].identity': `Której danej osoby dotyczy (formularz wypełnia ją sam z profilu): ${IDENTITY_ROLES.map((r) => `"${r}"`).join(', ')}; zwykłe pytanie: "none"`,
  'questions[].selfEdit': 'true — osoba może później poprawić odpowiedź przez swój link',
  'questions[].answersTo': 'Identyfikator obszaru, do którego trafiają odpowiedzi (kto je czyta). Pominięty: obszar wybrany przy imporcie. Zmiana przy istniejącym pytaniu nie przenosi odpowiedzi — to robi się w module',
  design: 'Układ i logika formularza (albo null — zwykła lista). Wymaga obszaru formularza',
  'design.version': 'Zawsze 1',
  'design.layout': 'Kolejność i grupy — lista elementów; pytania, których tu nie ma, stoją na końcu. Grupa: {"type":"group","id":"g1","kind":"group"|"page"|"tab","title":"…","items":[…]} ("page" — osobny krok formularza, "tab" — zakładka)',
  'design.layout[].type': '"field" — pytanie, "text" — tekst między pytaniami, "group" — grupa (patrz wyżej)',
  'design.layout[].id': 'Przy "field": identyfikator pytania (także własny z "questions", np. "q1"); przy tekście i grupie: dowolny, niepowtarzalny',
  'design.layout[].text': 'Przy "text": treść',
  'design.layout[].print': 'Przy "field": true / false — czy odpowiedź trafia na wydruk do podpisu. Pominięte: imię i nazwisko, dane rodzica (imię, telefon), zgody i oświadczenia tak; reszta (wiek, szkoła…) nie',
  'design.layout[].sign': 'Przy "text": true — oświadczenie do podpisu na wydruku (np. zgoda rodzica): w formularzu do przeczytania, bez pola do zaznaczenia; na wydruku nad linią podpisu',
  'design.nodes': 'Węzły logiki: {"id","kind","x","y", "fieldId"?, "value"?, "op"?, "target"?}; kind: answer, const, age, compare, and, or, not, xor, show, message, label, require. "age" — wiek w pełnych latach z pytania z datą urodzenia albo PESEL-em ("fieldId"), w dniu "value" (RRRR-MM-DD; puste — dziś); porównany z 18 pokazuje pola dla niepełnoletnich',
  'design.edges': 'Połączenia logiki: {"id","from","to","port":"a"|"b"|"in"}'
};

/** Ein ausgefülltes Beispiel — dieselben Schlüssel wie oben. */
export const QUESTION_EXAMPLE = {
  questions: [
    { id: 'q1', kind: 'line', label: 'Imię', help: null, options: [], required: true, halfWidth: true, identity: 'given_name', selfEdit: true, answersTo: '<id-obszaru>' },
    { id: 'q2', kind: 'choice', label: 'Nocleg', help: 'Wybierz jedną możliwość', options: ['Namiot', 'Szkoła'], required: false, halfWidth: false, identity: 'none', selfEdit: true, answersTo: '<id-obszaru>' }
  ],
  design: {
    version: 1,
    layout: [{ type: 'field', id: 'q1' }, { type: 'text', id: 't1', text: 'Zakwaterowanie' }, { type: 'field', id: 'q2', print: true },
      { type: 'text', id: 't2', text: 'Wyrażam zgodę na udział mojego dziecka.', sign: true }],
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
  if (keys.ring === null) throw new WorkspaceError('Bez hasła nie da się zapieczętować pytań — odblokuj klucze.');
  const area = keys.areas.find((a) => a.areaId === areaId);
  const key = area === undefined ? undefined : (await myEpochKeys(keys.ring, areaId)).get(area.currentEpoch);
  if (area === undefined || key === undefined) throw new WorkspaceError(`Nie masz klucza obszaru ${area?.name ?? areaId}.`);
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
      if (q.label !== null) warnings.push(`Pytanie ${index + 1} nie ma treści — pominięte.`);
      return;
    }
    const kind = (FIELD_KINDS as readonly string[]).includes(str(q.kind)) ? q.kind as FieldKind : 'line';
    if (kind !== q.kind && q.kind !== undefined) warnings.push(`Pytanie „${label}”: nieznany rodzaj „${str(q.kind)}” — będzie „line”.`);
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
      selfEdit: bool(q.selfEdit, true),
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
  form: { readonly moduleId: string; readonly areaId: string | null },
  doc: { readonly questions?: unknown; readonly design?: unknown },
  options: { readonly replace: boolean; readonly answersTo: string | null; readonly onStage?: (what: string) => void }
): Promise<FormWrite> {
  const warnings: string[] = [];
  const wanted = readQuestions(doc.questions, warnings);
  const loaded = await loadFields(form.moduleId);
  const keys = await keysOf(who, loaded.fields.map((f) => f.labelAreaId ?? f.areaId));
  const every = [...await openFields(loaded.fields, keys.open)].sort((a, b) => a.position - b.position);

  /*
   * 0086 — EINE VOM FORMULAR GENOMMENE FRAGE, die das Dokument wieder nennt,
   * kommt zurück (mit ihren Antworten) und wird wie jede vorhandene behandelt.
   */
  const named = new Set(wanted.map((q) => q.id));
  for (const f of every) {
    if (f.removedAt == null || !named.has(f.fieldId)) continue;
    options.onStage?.(`Przywracanie pytania „${f.label ?? f.fieldId}”…`);
    await restoreField(f.fieldId);
    warnings.push(`„${f.label ?? f.fieldId}” wraca do formularza — razem z dotychczasowymi odpowiedziami.`);
  }
  const now = every.filter((f) => f.removedAt == null || named.has(f.fieldId));
  const byId = new Map(now.map((f) => [f.fieldId, f]));

  let formArea = form.areaId;
  const fresh = wanted.filter((q) => !byId.has(q.id));

  if (formArea === null && now.length === 0 && options.answersTo !== null && (fresh.length > 0 || doc.design != null)) {
    options.onStage?.('Ustawianie obszaru formularza…');
    await updateModule(form.moduleId, { areaId: options.answersTo });
    formArea = options.answersTo;
  }

  const ids = new Map<string, string>();
  let added = 0;
  let changed = 0;
  let unchanged = 0;

  /* Erst die vorhandenen: geändert, wo etwas anders ist. */
  for (const q of wanted) {
    const f = byId.get(q.id);
    if (f === undefined) continue;
    ids.set(q.id, f.fieldId);
    if (f.label === null) { warnings.push(`Pytanie ${q.id} jest zapieczętowane kluczem, którego nie masz — pominięte.`); continue; }
    if (q.answersTo !== null && q.answersTo !== f.areaId) {
      warnings.push(`„${q.label}”: odpowiedzi zostają w dotychczasowym obszarze — przeniesienie robi się w module.`);
    }
    const differs = f.kind !== q.kind || f.label !== q.label || (f.help ?? null) !== q.help || !same(f.options, q.options)
      || f.isRequired !== q.required || f.isHalfWidth !== q.halfWidth || f.identityRole !== q.identity || f.selfEdit !== q.selfEdit;
    if (!differs) { unchanged += 1; continue; }

    options.onStage?.(`Pieczętowanie pytania „${q.label}”…`);
    const { key, epoch } = await sealingKey(keys, formArea ?? f.areaId);
    await editField(f.fieldId, {
      key,
      labelArea: formArea === null ? null : { areaId: formArea, epoch },
      label: q.label, help: q.help, options: q.kind === 'choice' ? q.options : [],
      kind: q.kind, isRequired: q.required, isHalfWidth: q.halfWidth, identityRole: q.identity, selfEdit: q.selfEdit
    });
    changed += 1;
  }

  /* Dann die neuen — ans Ende (hinter allen, auch den vom Formular genommenen). */
  let position = every.length;
  const intakes = new Set<string>();
  for (const q of fresh) {
    const target = q.answersTo ?? options.answersTo ?? formArea ?? now[0]?.areaId ?? null;
    if (target === null) {
      warnings.push(`„${q.label}”: nie wybrano obszaru odpowiedzi — pytanie pominięte.`);
      continue;
    }
    if (keys.ring === null) throw new WorkspaceError('Bez hasła nie da się zapieczętować pytań — odblokuj klucze.');

    if (!intakes.has(target)) {
      const takes = await loadPublicIntake(target).then(() => true, () => false);
      if (!takes) {
        if (keys.personId === null) throw new WorkspaceError('Konto nie prowadzi jeszcze żadnej osoby — załóż ją w Rolach.');
        options.onStage?.('Tworzenie klucza przyjmowania — kilka sekund…');
        await createIntake(keys.ring, target, keys.personId);
      }
      intakes.add(target);
    }

    options.onStage?.(`Pieczętowanie pytania „${q.label}”…`);
    const answers = await sealingKey(keys, target);
    const labelArea = formArea === null ? undefined : { areaId: formArea, ...(await sealingKey(keys, formArea)) };
    const done = await addField(form.moduleId, {
      areaId: target, areaKey: answers.key, epoch: answers.epoch,
      labelArea,
      kind: q.kind, position, label: q.label, help: q.help ?? undefined,
      options: q.kind === 'choice' ? q.options : undefined,
      isRequired: q.required, isHalfWidth: q.halfWidth, identityRole: q.identity, selfEdit: q.selfEdit
    });
    if (q.id !== '') ids.set(q.id, done.fieldId);
    position += 1;
    added += 1;
  }

  /* Gelöscht wird nur auf Wunsch — eine Frage mit Antworten nimmt der Dienst nur vom Formular (0086). */
  let removed = 0;
  if (options.replace) {
    const keep = new Set(wanted.map((q) => q.id));
    for (const f of now) {
      if (keep.has(f.fieldId)) continue;
      try {
        await removeField(f.fieldId);
        removed += 1;
      } catch (e) {
        warnings.push(`„${f.label ?? f.fieldId}” zostaje: ${e instanceof WorkspaceError ? e.message : 'nie udało się usunąć'}.`);
      }
    }
  }

  /* Der Aufbau — mit den Kennungen der eben entstandenen Fragen. */
  let designSaved = false;
  if (doc.design !== undefined) {
    if (formArea === null) {
      warnings.push('Układ i logika wymagają obszaru formularza — ustaw go w module i zaimportuj jeszcze raz.');
    } else {
      options.onStage?.('Zapisywanie układu…');
      const { key, epoch } = await sealingKey(keys, formArea);
      await saveDesign(form.moduleId, formArea, epoch, doc.design === null ? null : await sealDesign(remapDesign(doc.design, ids), key, form.moduleId));
      designSaved = true;
    }
  }

  return { added, changed, removed, unchanged, designSaved, warnings, ids };
}
