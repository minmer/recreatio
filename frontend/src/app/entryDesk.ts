/**
 * 0082 — DIE MENSCHEN EINES FORMULARS, wie die Kanzlei sie sieht: wer, mit
 * welchen Nummern, woran er gerade ist — und in welcher Reihenfolge.
 *
 * <b>Es stand nur in `FormOffice`</b> (die Liste „Osoby"). Jetzt braucht es
 * dasselbe an zwei weiteren Stellen, auf zwei Seiten, die zusammengehören:
 *
 * <code>
 *   Lista osób      alle Menschen eines Formulars, gefiltert   (Baustein entry-list)
 *   Panel osoby     EIN Mensch, mit ◀ ▶ durch dieselbe Liste    (Wybór na stronie + entry-panel)
 * </code>
 *
 * <b>Die beiden Seiten verbindet die ADRESSE, nicht ein Zustand.</b> Wer in
 * der Liste filtert und einen Namen antippt, kommt mit `?wpis=…&filtr=…&q=…&z=<liste>`
 * auf der Seite des Menschen an. Dort gilt derselbe Filter in derselben
 * Reihenfolge — also führen ◀ ▶ durch genau die Liste, aus der man kam, und
 * „← lista" zurück an dieselbe Stelle. Ein Link lässt sich weitergeben, ein
 * Neuladen verliert nichts, und ohne Liste davor geht die Seite auch.
 *
 * <b>Einmal gelesen, kurz behalten.</b> Alle Antworten eines Formulars
 * aufzumachen kostet einen Moment; zwischen der Liste und der Seite eines
 * Menschen (und zurück) wird dasselbe nicht noch einmal geöffnet. Was sich an
 * einem Menschen ändert, sagt `deskChanged` — dann lesen alle neu.
 */

import { loadAreas, loadPublicKey, myEpochKeys, type AreaRow } from './area';
import { fromBase64Url } from './crypto';
import { fullNameOf, type IdentityRole, type OpenField, type Submission } from './form';
import { readForm, type ReadForm } from './formRead';
import type { Ring } from './keys';
import { loadModules, type ModuleRow } from './module';
import { dialable, normalisePhone, splitPhones } from './phone';
import { repeatOf, roundOf } from './rounds';
import { filledNow, loadSteps, openSteps, stepsFor, type ExtensionInfo, type OpenStep, type StepState } from './steps';

/** Die Schritte eines Formulars (aufgemacht) und die Erweiterungen, aus denen sich die übrigen ergeben (0047). */
export interface StepInfo {
  readonly steps: readonly OpenStep[];
  readonly extensions: readonly ExtensionInfo[];
}

/* -- Wer ein Mensch ist ------------------------------------------------------ */

/** Eine Nummer dieser Einsendung — und woher wir wissen, dass es eine ist. */
export type Numbered = {
  readonly fieldId: string;

  /** Wählbar, ohne Leerzeichen — das Ziel von `sms:` und `tel:`. */
  readonly dial: string;

  /** Lesbar, wie sie in der Liste steht. */
  readonly shown: string;

  /**
   * Die Frage dazu gibt es nicht mehr. Dass dies eine Nummer ist, schliessen
   * wir aus ihrer GESTALT — und deshalb entscheidet der Mensch, nicht wir.
   */
  readonly orphan: boolean;
};

/**
 * Die Nummern einer Einsendung.
 *
 * <b>Eine bekannte Frage sagt es selbst.</b> Steht dort „Telefon", sind es
 * Nummern; steht dort etwas anderes, sind es keine — auch dann nicht, wenn
 * neun Ziffern dastehen. `1993-07-16` ergibt `+4819930716`, und ein
 * Geburtsdatum als Handynummer zu führen ist schlimmer als gar nichts zu
 * erkennen.
 *
 * <b>Eine Frage, die es nicht mehr gibt, ist der andere Fall.</b> Dort steht
 * niemand mehr, der sagen könnte, was der Wert ist — aber die Kanzlei SIEHT
 * ihn. Sie bekommt den Knopf angeboten und entscheidet; geraten wird nur, wem
 * er angeboten wird, nie was damit geschieht.
 */
export function numbersOf(
  values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]
): readonly Numbered[] {
  if (values === undefined) return [];

  const out: Numbered[] = [];

  for (const [fieldId, text] of values) {
    const field = fields.find((f) => f.fieldId === fieldId);
    if (field !== undefined && field.kind !== 'phone') continue;

    for (const one of splitPhones(text)) {
      const dial = dialable(one);
      if (dial === null) continue;

      out.push({ fieldId, dial, shown: normalisePhone(one) ?? one, orphan: field === undefined });
    }
  }

  return out;
}

/**
 * Wer ein Mensch in dieser Liste ist: sein Name und ALLE seine Nummern.
 *
 * <b>Aus den GENORMTEN Fragen zuerst</b> (0038): Imię und Nazwisko, sonst
 * das alte „name". Fehlt beides, die erste ausgefüllte einzeilige Antwort —
 * irgendetwas muss in der Zeile stehen, woran man den Menschen erkennt.
 *
 * <b>Alle Nummern, nicht die erste.</b> Ein Bogen fragt oft nach Mutter UND
 * Vater; wer nur die erste sah, rief immer dieselbe an. Dieselbe Nummer in
 * zwei Fragen steht einmal da.
 */
export function whoIn(
  values: ReadonlyMap<string, string> | undefined, fields: readonly OpenField[]
): { name: string; phones: readonly Numbered[] } {
  if (values === undefined) return { name: '— zapieczętowane —', phones: [] };

  const of = (role: IdentityRole) => {
    const field = fields.find((f) => f.identityRole === role);
    return field === undefined ? null : values.get(field.fieldId)?.trim() || null;
  };

  const nick = of('nickname');
  /* Derselbe volle Name wie am Platz und im Kalender (`fullNameOf`) — ohne den Spitznamen, der steht daneben. */
  const full = fullNameOf(fields.filter((f) => f.identityRole !== 'nickname'), (fieldId) => values.get(fieldId));
  const first = fields.find((f) => f.kind === 'line' && (values.get(f.fieldId)?.trim() ?? '') !== '');

  const name = full !== null
    ? (nick !== null ? `${full} („${nick}")` : full)
    : nick ?? (first === undefined ? null : values.get(first.fieldId)!.trim()) ?? '— bez imienia —';

  const seen = new Set<string>();
  const phones = numbersOf(values, fields).filter((one) => {
    if (seen.has(one.dial)) return false;
    seen.add(one.dial);
    return true;
  });

  return { name, phones };
}

/* -- Woran ein Mensch ist (0047) ---------------------------------------------- */

/** Die Schritte eines Menschen — aus den Schritten des Formulars, seinen Häkchen und dem, was er ergänzt hat. */
export const entryStates = (info: StepInfo | null, s: Submission): readonly StepState[] => info === null ? [] : stepsFor({
  hasSeat: s.seatId !== null,
  confirmedAt: s.confirmedAt,
  extensions: info.extensions,
  /* 0077 — eine wiederkehrende Erweiterung gilt als ausgefüllt, wenn sie es für den LAUFENDEN Zeitraum ist. */
  filled: new Map(s.extensions
    .filter((e) => filledNow(info.extensions.find((x) => x.moduleId === e.moduleId)?.repeat, e))
    .map((e) => [e.moduleId, e.submittedAt])),
  steps: info.steps,
  marks: s.marks
});

/**
 * Die Schritte laden und aufmachen — mit dem Epochenschlüssel, mit dem jeder
 * versiegelt wurde (aus der Zuteilung, sonst dem veröffentlichten).
 */
export async function openStepInfo(formId: string, ring: Ring): Promise<StepInfo> {
  const { steps, extensions } = await loadSteps(formId);
  const held = new Map<string, Map<number, Uint8Array>>();

  for (const areaId of new Set(steps.map((one) => one.areaId))) {
    const keys = await myEpochKeys(ring, areaId).catch(() => new Map<number, Uint8Array>());
    try {
      const open = await loadPublicKey(areaId);
      if (!keys.has(open.epoch)) keys.set(open.epoch, fromBase64Url(open.key));
    } catch {
      // Nicht offengelegt.
    }
    held.set(areaId, keys);
  }

  return { steps: await openSteps(steps, (areaId, epoch) => held.get(areaId)?.get(epoch)), extensions };
}

/**
 * WAS DIE ERWEITERUNGEN ÜBER DIESE MENSCHEN WISSEN (0047) — jede in ihrem
 * eigenen Versuch: eine, deren Bereich dieser Browser nicht liest, fehlt nur
 * selbst. 0077 — von einer WIEDERKEHRENDEN der laufende Zeitraum; alle
 * Zeiträume zeigt die Liste der Erweiterung selbst.
 */
export async function readExtensions(extensions: readonly ExtensionInfo[], ring: Ring): Promise<ReadonlyMap<string, ReadForm>> {
  const out = new Map<string, ReadForm>();
  for (const ext of extensions) {
    try {
      const repeat = repeatOf(ext.repeat);
      const now = roundOf(repeat);
      out.set(ext.moduleId, await readForm(ext.moduleId, ring, repeat === 'once' ? {} : { range: { from: now, to: now } }));
    } catch {
      // Nicht lesbar — die Zeile sagt es.
    }
  }
  return out;
}

/* -- Eine Zeile je Mensch, in fester Reihenfolge -------------------------------- */

export interface DeskRow {
  /** Die Einsendung — ihre Kennung ist das, was in der Adresse steht (`?wpis=`). */
  readonly s: Submission;
  readonly values: ReadonlyMap<string, string> | undefined;
  readonly name: string;
  readonly phones: readonly Numbered[];
  readonly states: readonly StepState[];
}

/**
 * Alle Menschen, nach Namen — und bei gleichem Namen nach dem Zeitpunkt der
 * Anmeldung, damit die Reihenfolge auf beiden Seiten DIESELBE ist (◀ ▶ folgen ihr).
 */
export function deskRows(
  form: { readonly registrations: readonly Submission[]; readonly opened: ReadonlyMap<string, ReadonlyMap<string, string>>; readonly fields: readonly OpenField[] },
  info: StepInfo | null
): readonly DeskRow[] {
  return form.registrations
    .map((s): DeskRow => {
      const values = form.opened.get(s.registrationId);
      return { s, values, states: entryStates(info, s), ...whoIn(values, form.fields) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pl') || a.s.submittedAt.localeCompare(b.s.submittedAt)
      || a.s.registrationId.localeCompare(b.s.registrationId));
}

/* -- Der Filter -------------------------------------------------------------------- */

/**
 * WAS DIE LISTE ZEIGT — dieselben drei Dinge auf beiden Seiten.
 *
 * <code>
 *   q       ein Stück Text: im Namen, in einer Nummer, in irgendeiner Antwort
 *   step    '' alle · open · overdue · done · todo:<schritt> — wie in „Osoby"
 *   hidden  auch die ausgeblendeten
 * </code>
 */
export interface EntryFilter {
  readonly q: string;
  readonly step: string;
  readonly hidden: boolean;
}

export const NO_FILTER: EntryFilter = { q: '', step: '', hidden: false };

export const isFiltered = (filter: EntryFilter): boolean => filter.q.trim() !== '' || filter.step !== '' || filter.hidden;

/** Die festen Wahlen des Schrittfilters; dazu je Schritt „brakuje: …" (`stepKindsOf`). */
export const STEP_CHOICES: readonly (readonly [string, string])[] = [
  ['', 'wszystkie osoby'],
  ['open', 'komuś czegoś brakuje'],
  ['overdue', 'coś po terminie'],
  ['done', 'wszystko zrobione']
];

/** Welche Schritte es gibt — Schlüssel und Name, in der Reihenfolge, in der sie zuerst vorkommen. */
export const stepKindsOf = (rows: readonly DeskRow[]): readonly (readonly [string, string])[] =>
  [...new Map(rows.flatMap((r) => r.states).map((st) => [st.key, st.label])).entries()];

export function stepMatches(step: string, states: readonly StepState[]): boolean {
  return step === '' ? true
    : step === 'open' ? states.some((st) => st.status !== 'done')
    : step === 'done' ? states.length > 0 && states.every((st) => st.status === 'done')
    : step === 'overdue' ? states.some((st) => st.status === 'overdue')
    : step.startsWith('todo:') ? states.some((st) => `todo:${st.key}` === step && st.status !== 'done')
    : true;
}

/** Klein, ohne Zeichen über den Buchstaben — „Łukasz" findet sich unter „lukasz". */
export const folded = (text: string): string =>
  text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Sucht in Name, Nummern und Antworten; Ziffern auch ohne Leerzeichen („600700" findet „+48 600 700 800"). */
export function textMatches(q: string, row: DeskRow): boolean {
  const words = folded(q).split(/\s+/).filter((one) => one !== '');
  if (words.length === 0) return true;

  const hay = folded([row.name, ...row.phones.map((p) => `${p.shown} ${p.dial}`), ...(row.values?.values() ?? [])].join(' \n '));
  const digits = hay.replace(/[^\d\n]/g, '');
  return words.every((word) => hay.includes(word) || (/^\+?\d[\d ]*$/.test(word) && digits.includes(word.replace(/\D/g, ''))));
}

/** Die Menschen, die der Filter zeigt — in derselben Reihenfolge. */
export const pickRows = (rows: readonly DeskRow[], filter: EntryFilter): readonly DeskRow[] =>
  rows.filter((r) => (filter.hidden || !r.s.hidden) && stepMatches(filter.step, r.states) && textMatches(filter.q, r));

/** Der Filter in Worten — für den Hinweis oben auf der Seite eines Menschen. */
export function filterWords(filter: EntryFilter, kinds: readonly (readonly [string, string])[]): string {
  const step = filter.step === '' ? null
    : STEP_CHOICES.find(([key]) => key === filter.step)?.[1]
      ?? `brakuje: ${kinds.find(([key]) => `todo:${key}` === filter.step)?.[1] ?? filter.step.slice(5)}`;
  return [step, filter.q.trim() === '' ? null : `„${filter.q.trim()}"`, filter.hidden ? 'z ukrytymi' : null]
    .filter((one) => one !== null).join(' · ');
}

/**
 * DER VORIGE UND DER NÄCHSTE — in der gefilterten Liste, gemessen an der
 * vollen Reihenfolge. Steht der Gewählte selbst nicht (mehr) im Filter, sind
 * es die beiden, zwischen denen er stünde: ◀ ▶ führen dann zurück in die Liste.
 */
export function neighbours(
  all: readonly DeskRow[], shown: readonly DeskRow[], id: string | null
): { prev: DeskRow | null; next: DeskRow | null; at: number } {
  if (id === null) return { prev: null, next: shown[0] ?? null, at: 0 };

  const order = new Map(all.map((r, i) => [r.s.registrationId, i]));
  const here = order.get(id);
  if (here === undefined) return { prev: null, next: shown[0] ?? null, at: 0 };

  const at = shown.findIndex((r) => r.s.registrationId === id);
  let prev: DeskRow | null = null;
  let next: DeskRow | null = null;
  for (const r of shown) {
    const i = order.get(r.s.registrationId) ?? -1;
    if (i < here) prev = r;
    else if (i > here && next === null) next = r;
  }
  return { prev, next, at: at + 1 };
}

/* -- Die Adresse -------------------------------------------------------------------- */

/** Was in der Adresse steht: wer gewählt ist, der Filter, und von welcher Liste man kam. */
export interface EntryQuery {
  readonly id: string | null;
  readonly filter: EntryFilter;
  readonly from: string | null;
}

const KEYS = ['wpis', 'filtr', 'q', 'ukryte', 'z'] as const;

/** Der Teil nach `?` in der Raute — andere Schlüssel (`?part=` …) bleiben unberührt. */
const paramsOf = (hash: string): URLSearchParams => {
  const at = hash.indexOf('?');
  return new URLSearchParams(at < 0 ? '' : hash.slice(at + 1));
};

export function readEntryQuery(hash: string): EntryQuery {
  const p = paramsOf(hash);
  const text = (key: string) => (p.get(key) ?? '').trim();
  return {
    id: text('wpis') === '' ? null : text('wpis'),
    filter: { q: p.get('q') ?? '', step: text('filtr'), hidden: text('ukryte') === '1' },
    from: text('z') === '' ? null : text('z').replace(/^#?\/*/, '')
  };
}

/** Die Schlüssel dieser Liste als `?…` — leer, wenn nichts zu sagen ist. Andere Schlüssel der Raute bleiben. */
export function entryQueryString(query: EntryQuery, keep: string = ''): string {
  const p = paramsOf(keep);
  for (const key of KEYS) p.delete(key);
  if (query.id !== null) p.set('wpis', query.id);
  if (query.filter.step !== '') p.set('filtr', query.filter.step);
  if (query.filter.q.trim() !== '') p.set('q', query.filter.q);
  if (query.filter.hidden) p.set('ukryte', '1');
  if (query.from !== null) p.set('z', query.from);
  const text = p.toString();
  return text === '' ? '' : `?${text}`;
}

/** Dieselbe Raute mit anderen Schlüsseln dieser Liste — der Pfad bleibt, wie er ist. */
export function withEntryQuery(hash: string, query: EntryQuery): string {
  const at = hash.indexOf('?');
  const base = at < 0 ? hash : hash.slice(0, at);
  return `${base}${entryQueryString(query, hash)}`;
}

/* -- Was das Panel eines Menschen zeigt ----------------------------------------------- */

/** Die Stücke des Panels — alle, oder einzelne in eigenen Kacheln. */
export const PANEL_SECTIONS = ['answers', 'steps', 'extensions', 'link', 'actions'] as const;
export type PanelSection = (typeof PANEL_SECTIONS)[number];

export const PANEL_SECTION_LABEL: Record<PanelSection, string> = {
  answers: 'Odpowiedzi',
  steps: 'Kroki',
  extensions: 'Rozszerzenia',
  link: 'Link osoby',
  actions: 'Napisz, ukryj, usuń'
};

/** Gespeichert als Kommaliste; leer oder unlesbar heisst: alles. */
export function readSections(text: string): readonly PanelSection[] {
  const wanted = new Set(text.split(',').map((one) => one.trim()));
  const out = PANEL_SECTIONS.filter((one) => wanted.has(one));
  return out.length === 0 ? PANEL_SECTIONS : out;
}

/* -- Einmal gelesen, kurz behalten ---------------------------------------------------- */

export interface EntryDesk {
  readonly formId: string;

  /** Der Baustein des Formulars — sein Name, sein Bereich. `null`: diese Rolle sieht ihn nicht in ihrer Liste. */
  readonly module: ModuleRow | null;
  readonly form: ReadForm;
  readonly info: StepInfo | null;
  readonly extData: ReadonlyMap<string, ReadForm>;
  readonly areas: readonly AreaRow[];

  /** Alle Menschen, in fester Reihenfolge — auch die ausgeblendeten (der Filter entscheidet, ob sie dastehen). */
  readonly rows: readonly DeskRow[];
}

/** Die Bereiche, in denen die Plätze dieses Formulars liegen — die seiner Fragen. */
export const seatAreasOf = (desk: EntryDesk): readonly string[] => [...new Set(desk.form.fields.map((f) => f.areaId))];

/** Die Bereiche des Formulars selbst — sein eigener, dann die seiner Fragen (0080, für die Rozmowa). */
export const formAreasOf = (desk: EntryDesk): readonly (string | null)[] => [desk.module?.areaId ?? null, ...seatAreasOf(desk)];

const KEEP_MS = 3 * 60_000;
const kept = new Map<string, { ring: Ring; at: number; desk: Promise<EntryDesk> }>();
const listeners = new Map<string, Set<() => void>>();

async function readDesk(formId: string, ring: Ring): Promise<EntryDesk> {
  const [form, info, modules, areas] = await Promise.all([
    /* Auch die ausgeblendeten: wer auf der Seite eines Menschen „Ukryj" drückt, soll ihn nicht aus den Augen verlieren. */
    readForm(formId, ring, { hidden: true }),
    openStepInfo(formId, ring).catch(() => null),
    loadModules().then((r) => r.modules).catch(() => [] as readonly ModuleRow[]),
    loadAreas().then((r) => r.areas).catch(() => [] as readonly AreaRow[])
  ]);
  const extData = info === null ? new Map<string, ReadForm>() : await readExtensions(info.extensions, ring);

  return {
    formId,
    module: modules.find((m) => m.moduleId === formId) ?? null,
    form, info, extData, areas,
    rows: deskRows(form, info)
  };
}

/**
 * Die Menschen eines Formulars — aus dem Behälter, wenn sie eben erst gelesen
 * wurden (mit demselben Bund); sonst frisch.
 */
export function loadEntryDesk(formId: string, ring: Ring): Promise<EntryDesk> {
  const key = formId;
  const was = kept.get(key);
  if (was !== undefined && was.ring === ring && Date.now() - was.at < KEEP_MS) return was.desk;

  const desk = readDesk(formId, ring);
  kept.set(key, { ring, at: Date.now(), desk });
  desk.catch(() => { if (kept.get(key)?.desk === desk) kept.delete(key); });
  return desk;
}

/** An einem Menschen dieses Formulars hat sich etwas geändert — vergessen, und wer zusieht, liest neu. */
export function deskChanged(formId: string): void {
  kept.delete(formId);
  for (const fn of listeners.get(formId) ?? []) fn();
}

/** Zusehen, ob sich an diesem Formular etwas ändert. Gibt das Abmelden zurück. */
export function onDeskChange(formId: string, fn: () => void): () => void {
  const set = listeners.get(formId) ?? new Set<() => void>();
  set.add(fn);
  listeners.set(formId, set);
  return () => { set.delete(fn); };
}
