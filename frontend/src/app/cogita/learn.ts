/**
 * COGITA — WAS EIN LERNENDER HINTERLÄSST (COGITA.md §7).
 *
 * <b>Jede Antwort wird gespeichert, versiegelt</b> [F16, F22] — mit der Kennung
 * der Frage, der Richtung, wie richtig sie war, wann, und dem Fingerabdruck
 * dessen, was damals als richtig galt [D7]. Dazu je Karte eine
 * Momentaufnahme der Kenntnis (Frage + Richtung). Aus den Antworten lässt sich
 * alles neu rechnen; die Momentaufnahmen sparen das der Kanzlei.
 *
 * <b>Wohin</b> [E10]: in den Speicherbereich, den der Kurs nennt (sonst den
 * eigenen privaten), so wie ein Formular sein Amt erreicht: ein Stapel unter
 * einem Zufallsschlüssel, der zweimal verpackt daliegt — für den Lernenden
 * (seine Person RSA, oder sein Platz P-256) und für die Annahme des Bereichs.
 * Beide Schlüssel sind öffentlich: versiegelt wird auch ohne Netz, und der
 * Stapel wartet in der Ablage, bis er hinaus kann [E9].
 *
 * <b>Wer ohne Konto lernt</b> (ein Link, eine öffentliche Wiederholung),
 * behält seine Antworten in diesem Browser und nimmt sie nach der Anmeldung
 * ins Konto mit [L6, I13].
 */

import { aad, Field, fromBase64Url, open, openText, seal, sealText, toBase64Url, unwrapKey, unwrapKeyP256, wrapKey, wrapKeyP256 } from '../core/crypto';
import { idbDelete, idbGet, idbKeys, idbPut } from '../core/idb';
import { newId } from '../core/ids';
import { call, Unreachable, WorkspaceError } from '../core/session';
import { readParams, readSeed, type Card, type ParamValue } from './cardBasics';
import { dueAt, snapshotOf, type Mark, type Snapshot } from './knowness';

/* -- Was gespeichert wird ---------------------------------------------------------------- */

export interface AnswerRecord {
  readonly id: string;
  /** Unter diesem Schlüssel liegt die Kenntnis: Frage und Richtung (`cardKey`). */
  readonly key: string;
  readonly question: string;
  readonly direction: string;
  readonly fingerprint: string;
  readonly at: number;
  /** 0–1, die Teilrichtigkeit eingeschlossen. */
  readonly correctness: number;
  /** Was gegeben wurde, kurz — für die Lehrerin; nie mehr als 400 Zeichen. */
  readonly given?: string;
  /** Wie lange es dauerte, in Millisekunden. */
  readonly ms?: number;
  /** Woher: eine Wiederholung, eine Sitzung, ein Ablauf. */
  readonly via?: string;
  /** 2026-11-01 — wie viele Podpowiedzi vor der Antwort aufgedeckt waren (die Lehrerin sieht es). */
  readonly hints?: number;
  /** 2026-11-01 — eine Frage mit `params`: welche Werte gezogen waren (welche Fassung gefragt wurde). */
  readonly params?: Readonly<Record<string, ParamValue>>;
  /** 2026-11-03 — der Same der Fassung (eine Aufgabe aus einem Generator): mit ihm entsteht genau diese Aufgabe wieder. */
  readonly seed?: string;
  /**
   * 2026-11-02 — MITGEZÄHLT: diese Antwort kam mit einer anderen (ein Paar einer langen Liste, `answerEvidence`) — ihre
   * Kennung. Für die Kenntnis zählt sie wie jede; Punkte für „eine Antwort" gibt es nur einmal (`rewards.ts`).
   */
  readonly lead?: string;
  /**
   * 2026-11-03 (G) — WOFÜR DIE ANTWORT AUSSERDEM ZÄHLT: die Einträge der Baza, über die eine Frage auf einer Seite ist
   * (ein Baustein „Pytanie" mit „about", ein Labor mit Ziel) — ihre Karte gehört keiner Baza, die Kenntnis dieser
   * Einträge rechnet sie mit (`answeredCards`).
   */
  readonly about?: readonly string[];
}

/**
 * 2026-11-03 (G) — KARTEN AUS ANTWORTEN: was auf einer Seite beantwortet wurde und für Einträge der Baza zählt (`about`),
 * aber keine Karte der Baza ist — damit die Kenntnis jener Einträge es mitrechnet (Widoki, Krajobraz, Ścieżka, Tore).
 * Gefragt werden sie nie (`template: '~page'`: sie machen nichts „fragbar").
 */
export function answeredCards(progress: Pick<Progress, 'answers'>, have: ReadonlySet<string>): Card[] {
  const out = new Map<string, Card>();
  for (const a of progress.answers.values()) {
    if (a.about === undefined || a.about.length === 0 || have.has(a.key) || out.has(a.key)) continue;
    out.set(a.key, {
      question: a.question, direction: a.direction, key: a.key, template: '~page', prompt: [], answer: { form: 'flash', back: [] },
      explain: [], fingerprint: a.fingerprint, varies: false, requires: [], about: [...a.about]
    });
  }
  return [...out.values()];
}


/** Wo jemand in einem Ablauf steht [G14] — über Geräte hinweg. */
export interface FlowPosition {
  readonly flow: string;
  readonly step: string;
  readonly visited: readonly string[];
  /** Kapitel, die durch sind: `<auswahl>:<index>` (2026-11-03: gemerkt und beim Wiederkommen zurückgeholt). */
  readonly chapters?: readonly string[];
  readonly at: number;
  /** 2026-11-03 (G) — ein Ende erreicht (bleibt, auch wenn er von vorn beginnt). */
  readonly done?: boolean;
  /** 2026-11-03 (G) — die erreichten Ziele (einmal erreicht bleibt erreicht). */
  readonly goals?: readonly string[];
  /** 2026-11-03 (G) — eine Präsentation (`page:<seite>`): ihr Pfad — so findet der Ablauf der Baza, der auf sie zeigt, ihre Stelle. */
  readonly path?: string;
  /** 2026-11-04 (Prompt 13) — der Lernende setzt die Erzählung ausdrücklich zurück: erst dann fallen „ukończona", Ziele und Kapitel weg. */
  readonly reset?: boolean;
  /** 2026-11-04 (Prompt 13) — der bleibende Name des Ablaufs: bekommt er beim Neu-Einspielen eine neue Kennung, findet er die Stelle hierüber. */
  readonly ref?: string;
  /**
   * 2026-11-04 (Prompt 13, Abstecher) — offene Abstecher dieser Erzählung: ihr `step` ist der Abstecher, und hier steht, in
   * welchen Erzählungen der Lernende darunter war (die äusserste zuerst, `{flow, step}`); deren eigene Stellen stehen unter
   * ihrer Kennung. Wie Schritt und Besuchtes: die jüngere Stelle gilt (fehlt es dort, ist kein Abstecher mehr offen).
   */
  readonly inside?: readonly { readonly flow: string; readonly step: string }[];
}

/** Die Stelle eines Ablaufs: unter seiner Kennung — sonst unter seinem bleibenden Namen (ein neu eingespielter Ablauf). */
export function positionFor(positions: ReadonlyMap<string, FlowPosition> | undefined, flow: { readonly id: string; readonly ref?: string }): FlowPosition | undefined {
  if (positions === undefined) return undefined;
  const own = positions.get(flow.id);
  if (own !== undefined || flow.ref === undefined || flow.ref === '') return own;
  let best: FlowPosition | undefined;
  for (const p of positions.values()) if (p.ref === flow.ref) best = best === undefined ? p : mergePosition(best, p);
  return best === undefined ? undefined : { ...best, flow: flow.id };
}

/**
 * 2026-11-04 (Prompt 13) — ZWEI STELLEN EINER ERZÄHLUNG ZUSAMMEN: die jüngere sagt, wo er steht (Schritt, Besuchtes,
 * Pfad); was er erreicht hat, bleibt — ein Ende („ukończona"), die Ziele und die durchlaufenen Kapitel wachsen nur. Nur
 * ein ausdrückliches Zurücksetzen (`reset`) nimmt sie weg.
 */
export function mergePosition(had: FlowPosition | undefined, pos: FlowPosition): FlowPosition {
  if (had === undefined) return pos;
  const [older, newer] = had.at <= pos.at ? [had, pos] : [pos, had];
  if (newer.reset === true) return newer;
  const done = older.done === true || newer.done === true;
  const goals = [...new Set([...(older.goals ?? []), ...(newer.goals ?? [])])];
  const chapters = [...new Set([...(older.chapters ?? []), ...(newer.chapters ?? [])])];
  const { reset: _r, ...rest } = newer;
  return { ...rest, ...(done ? { done: true } : {}), ...(goals.length > 0 ? { goals } : {}), ...(chapters.length > 0 ? { chapters } : {}) };
}

export interface Progress {
  readonly answers: ReadonlyMap<string, AnswerRecord>;
  readonly snapshots: ReadonlyMap<string, Snapshot>;
  readonly suspended: ReadonlySet<string>;
  readonly positions: ReadonlyMap<string, FlowPosition>;
  /** Die Werte des Lernenden im Kurs (Gestalten, Punkte, Nähe) [H1, H4, H7]. */
  readonly values: Readonly<Record<string, number>>;
}

export const EMPTY_PROGRESS: Progress = { answers: new Map(), snapshots: new Map(), suspended: new Set(), positions: new Map(), values: {} };

type BatchKind = 'answers' | 'snapshots' | 'position' | 'values' | 'suspend';

interface BatchBody {
  readonly v: 1;
  readonly kind: BatchKind;
  readonly answers?: readonly AnswerRecord[];
  readonly snapshots?: readonly Snapshot[];
  readonly positions?: readonly FlowPosition[];
  readonly values?: Readonly<Record<string, number>>;
  readonly suspended?: readonly string[];
}

const batchAad = (batchId: string) => aad('cogita', 'learn_batch', batchId, Field.LearnBatch, 1);
const holderAad = (batchId: string) => aad('cogita', 'learn_key', `${batchId}.holder`, Field.LearnKey, 1);
const areaAad = (batchId: string) => aad('cogita', 'learn_key', `${batchId}.area`, Field.LearnKey, 1);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clip = (text: string, n: number) => (text.length <= n ? text : `${text.slice(0, n - 1)}…`);

function readAnswer(raw: unknown): AnswerRecord | null {
  if (!isObject(raw)) return null;
  const { id, key, question, direction, fingerprint, at, correctness } = raw;
  if (typeof id !== 'string' || typeof key !== 'string' || typeof at !== 'number' || typeof correctness !== 'number') return null;
  return {
    id, key,
    question: typeof question === 'string' ? question : key,
    direction: typeof direction === 'string' ? direction : '',
    fingerprint: typeof fingerprint === 'string' ? fingerprint : '',
    at, correctness: Math.max(0, Math.min(1, correctness)),
    ...(typeof raw.given === 'string' ? { given: clip(raw.given, 400) } : {}),
    ...(typeof raw.ms === 'number' ? { ms: raw.ms } : {}),
    ...(typeof raw.via === 'string' ? { via: raw.via } : {}),
    ...(typeof raw.hints === 'number' && raw.hints > 0 ? { hints: Math.min(20, Math.floor(raw.hints)) } : {}),
    ...(readParams(raw.params) === undefined ? {} : { params: readParams(raw.params)! }),
    ...(readSeed(raw.seed) === undefined ? {} : { seed: readSeed(raw.seed)! }),
    ...(typeof raw.lead === 'string' && raw.lead !== '' ? { lead: raw.lead } : {}),
    /* 2026-11-03 (G) — wofür eine Antwort auf einer Seite ausserdem zählt. */
    ...(Array.isArray(raw.about) && raw.about.some((x) => typeof x === 'string' && x !== '') ? { about: raw.about.filter((x): x is string => typeof x === 'string' && x !== '').slice(0, 24) } : {})
  };
}

/** Ein geöffneter Stapel in den Fortschritt — doppelte Antworten zählen einmal, die jüngere Momentaufnahme gilt. */
export function absorb(into: Progress, body: unknown): Progress {
  if (!isObject(body)) return into;
  const answers = new Map(into.answers);
  const snapshots = new Map(into.snapshots);
  let suspended = into.suspended;
  const positions = new Map(into.positions);
  let values = into.values;
  for (const raw of Array.isArray(body.answers) ? body.answers : []) {
    const one = readAnswer(raw);
    if (one !== null) answers.set(one.id, one);
  }
  for (const raw of Array.isArray(body.snapshots) ? body.snapshots : []) {
    if (!isObject(raw) || typeof raw.question !== 'string' || typeof raw.at !== 'number') continue;
    const snap = raw as unknown as Snapshot;
    const key = snap.direction === '' ? snap.question : `${snap.question}|${snap.direction}`;
    const had = snapshots.get(key);
    if (had === undefined || had.at <= snap.at) snapshots.set(key, snap);
  }
  if (body.kind === 'suspend' && Array.isArray(body.suspended)) suspended = new Set(body.suspended.filter((s): s is string => typeof s === 'string'));
  for (const raw of Array.isArray(body.positions) ? body.positions : []) {
    if (!isObject(raw) || typeof raw.flow !== 'string' || typeof raw.step !== 'string') continue;
    const pos = raw as unknown as FlowPosition;
    positions.set(pos.flow, mergePosition(positions.get(pos.flow), pos));
  }
  if (body.kind === 'values' && isObject(body.values)) {
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(body.values)) if (typeof v === 'number' && Number.isFinite(v)) next[k] = v;
    values = next;
  }
  return { answers, snapshots, suspended, positions, values };
}

/**
 * DIE ANTWORTEN EINER KARTE als Marken für die Formel — nur die, deren
 * Fingerabdruck noch gilt [D7]: ändert sich, was als richtig gilt, beginnt
 * die Geschichte der Karte neu. `rename`: zusammengeführte Einträge [B16].
 */
export function marksOf(progress: Progress, key: string, fingerprint?: string, rename?: (key: string) => string): Mark[] {
  const out: Mark[] = [];
  for (const one of answerIndex(progress.answers, rename).get(key) ?? []) {
    if (fingerprint !== undefined && one.fingerprint !== '' && one.fingerprint !== fingerprint) continue;
    out.push({ at: one.at, correctness: one.correctness });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * 2026-10-30 — DIE ANTWORTEN JE KARTE, einmal je Stand gesammelt: Widoki und Powtórki fragen nach der Kenntnis aller
 * Karten. Ein neuer Stand ist eine neue Map (`absorb`), also gilt der Index, solange sie gilt.
 */
const NO_RENAME = {};
const answerIndexes = new WeakMap<object, WeakMap<object, Map<string, AnswerRecord[]>>>();
function answerIndex(answers: ReadonlyMap<string, AnswerRecord>, rename?: (key: string) => string): Map<string, AnswerRecord[]> {
  let byRename = answerIndexes.get(answers);
  if (byRename === undefined) { byRename = new WeakMap(); answerIndexes.set(answers, byRename); }
  const which = rename ?? NO_RENAME;
  let index = byRename.get(which);
  if (index === undefined) {
    index = new Map();
    for (const one of answers.values()) {
      const k = rename === undefined ? one.key : rename(one.key);
      const list = index.get(k);
      if (list === undefined) index.set(k, [one]); else list.push(one);
    }
    byRename.set(which, index);
  }
  return index;
}

/** Ein Zusammenführen in den Kennungen der Karten: `vorlage:alt[:wert]` wird `vorlage:neu[:wert]`. */
export function renamer(merges: ReadonlyMap<string, string>): ((key: string) => string) | undefined {
  if (merges.size === 0) return undefined;
  return (key) => {
    let out = key;
    for (const [from, to] of merges) if (out.includes(from)) out = out.split(from).join(to);
    return out;
  };
}

/* -- Wer lernt ------------------------------------------------------------------------------- */

export type Holder =
  | { readonly kind: 'role'; readonly roleId: string; readonly wrapPublicKey: Uint8Array; readonly wrapPrivate: () => Promise<Uint8Array> }
  /* `seatKey` (2026-11-01): öffnet die Schlüssel der eigenen Bereiche (Kleinbereiche seines Formulars) — siehe `Target.areaKey`. */
  | { readonly kind: 'seat'; readonly token: string; readonly seatId: string; readonly wrapPublicKey: Uint8Array; readonly wrapPrivate: Uint8Array; readonly seatKey?: Uint8Array }
  | { readonly kind: 'local'; readonly id: string };

export const holderKey = (h: Holder): string => (h.kind === 'role' ? `r:${h.roleId}` : h.kind === 'seat' ? `s:${h.seatId}` : `l:${h.id}`);

/** Wohin die Antworten gehen — der Bereich und der öffentliche Schlüssel seiner Annahme (oder keiner). */
export interface Target {
  readonly areaId: string;
  readonly intake: Uint8Array | null;
  /** 2026-11-01 — der eigene private Bereich (`answersTo.ts`): die Antworten liest niemand sonst. */
  readonly own?: boolean;
  /**
   * 2026-11-01 (0136) — STATT DER PRZYJĘCIA DER SCHLÜSSEL DES BEREICHS: die Antworten einer Person in ihrem eigenen
   * Bereich eines Formulars (0120). Öffnen kann sie jeder, der den Bereich liest — die Person selbst und die Rollen,
   * die die Regel des virtuellen Bereichs nennt.
   */
  readonly areaKey?: { readonly epoch: number; readonly key: Uint8Array };
}

const intakes = new Map<string, Promise<Uint8Array | null>>();

/** Die öffentliche Hälfte der Annahme eines Bereichs — ohne Konto, wie ein Formular sie holt. */
export function intakeOf(areaId: string): Promise<Uint8Array | null> {
  let found = intakes.get(areaId);
  if (found === undefined) {
    /* 2026-10-28 — ohne Netz nicht gemerkt: sonst bliebe es für diesen Tab bei „keine Annahme", auch wenn das Netz zurückkommt. */
    found = call<{ publicKey: string }>(`/intake/${encodeURIComponent(areaId)}`)
      .then((r) => fromBase64Url(r.publicKey), (e: unknown) => { if (e instanceof Unreachable) intakes.delete(areaId); return null; });
    intakes.set(areaId, found);
  }
  return found;
}

export async function targetOf(areaId: string): Promise<Target> {
  return { areaId, intake: await intakeOf(areaId) };
}

/* -- Stapel -------------------------------------------------------------------------------------- */

export interface SealedBatch {
  readonly batchId: string;
  readonly libraryId: string;
  readonly areaId: string;
  readonly kind: BatchKind;
  readonly holderRoleId?: string;
  readonly sealed: string;
  readonly keyForHolder: string;
  readonly keyForArea?: string;
  /** 0136 — `keyForArea` unter dem Schlüssel dieser Epoche des Bereichs (sonst für seine Przyjęcia). */
  readonly areaEpoch?: number;
}

/** Versiegeln — ohne Geheimnis, ohne Netz: beide Schlüssel sind öffentlich. */
export async function sealBatch(libraryId: string, holder: Exclude<Holder, { kind: 'local' }>, target: Target, body: BatchBody): Promise<SealedBatch> {
  const batchId = newId();
  const key = crypto.getRandomValues(new Uint8Array(32));
  const sealed = toBase64Url(await sealText(key, batchAad(batchId), JSON.stringify(body)));
  const forHolder = holder.kind === 'role'
    ? await wrapKey(holder.wrapPublicKey, holderAad(batchId), key)
    : await wrapKeyP256(holder.wrapPublicKey, holderAad(batchId), key);
  const forArea = target.areaKey !== undefined ? await seal(target.areaKey.key, areaAad(batchId), key)
    : target.intake === null ? null : await wrapKey(target.intake, areaAad(batchId), key);
  return {
    batchId, libraryId, areaId: target.areaId, kind: body.kind,
    ...(holder.kind === 'role' ? { holderRoleId: holder.roleId } : {}),
    sealed, keyForHolder: toBase64Url(forHolder),
    ...(forArea === null ? {} : { keyForArea: toBase64Url(forArea) }),
    ...(target.areaKey === undefined || forArea === null ? {} : { areaEpoch: target.areaKey.epoch })
  };
}

export interface StoredBatch {
  readonly batchId: string;
  readonly libraryId: string;
  readonly areaId: string;
  readonly holderRoleId: string | null;
  readonly holderSeatId: string | null;
  readonly kind: string;
  readonly sealed: string;
  readonly key: string | null;
  readonly createdAt: string;
  /** 0136 — `key` liegt unter dem Schlüssel dieser Epoche des Bereichs (nur in Stapeln für die Kanzlei von Belang). */
  readonly areaEpoch?: number | null;
}

/** Einen eigenen Stapel öffnen — mit dem privaten Schlüssel des Halters. `null`: geht nicht auf. */
export async function openOwn(holder: Exclude<Holder, { kind: 'local' }>, batch: StoredBatch): Promise<unknown> {
  if (batch.key === null) return null;
  try {
    const pkcs8 = holder.kind === 'role' ? await holder.wrapPrivate() : holder.wrapPrivate;
    const key = holder.kind === 'role'
      ? await unwrapKey(pkcs8, holderAad(batch.batchId), fromBase64Url(batch.key))
      : await unwrapKeyP256(pkcs8, holderAad(batch.batchId), fromBase64Url(batch.key));
    return JSON.parse(await openText(key, batchAad(batch.batchId), fromBase64Url(batch.sealed))) as unknown;
  } catch {
    return null;
  }
}

/** 2026-11-01 (0136) — ein Stapel im eigenen Bereich einer Person, mit dem Schlüssel des Bereichs (wer ihn liest). */
export async function openWithAreaKey(areaKey: Uint8Array, batch: StoredBatch): Promise<unknown> {
  if (batch.key === null) return null;
  try {
    const key = await open(areaKey, areaAad(batch.batchId), fromBase64Url(batch.key));
    return JSON.parse(await openText(key, batchAad(batch.batchId), fromBase64Url(batch.sealed))) as unknown;
  } catch {
    return null;
  }
}

/** Für die Kanzlei: ein Stapel ihres Bereichs, mit dem privaten Schlüssel der Annahme. */
export async function openForArea(intakePrivate: Uint8Array, batch: StoredBatch): Promise<unknown> {
  if (batch.key === null) return null;
  try {
    const key = await unwrapKey(intakePrivate, areaAad(batch.batchId), fromBase64Url(batch.key));
    return JSON.parse(await openText(key, batchAad(batch.batchId), fromBase64Url(batch.sealed))) as unknown;
  } catch {
    return null;
  }
}

/* -- Der Weg zum Dienst ------------------------------------------------------------------------ */

/** 2026-11-01 — der Dienst nimmt den Bereich für diesen Lernenden nicht (er gehört nicht dazu): das Wort `area`. */
export const refusedArea = (e: unknown): boolean => e instanceof Error && (e as Partial<WorkspaceError>).verdict === 'area';

const seatPath = (token: string) => `/seat/${encodeURIComponent(token)}`;

export function postBatches(holder: Exclude<Holder, { kind: 'local' }>, batches: readonly SealedBatch[]): Promise<{ stored: readonly string[] }> {
  const path = holder.kind === 'role' ? '/workspace/learn/batches' : `${seatPath(holder.token)}/learn/batches`;
  return call(path, { method: 'POST', body: JSON.stringify({ batches }) });
}

export function loadOwnBatches(holder: Exclude<Holder, { kind: 'local' }>, libraryId: string, since: string | null): Promise<{ now: string; batches: readonly StoredBatch[] }> {
  const query = `?libraryId=${encodeURIComponent(libraryId)}${since === null ? '' : `&since=${encodeURIComponent(since)}`}`;
  return call(holder.kind === 'role' ? `/workspace/learn/batches${query}` : `${seatPath(holder.token)}/learn/batches${query}`);
}

/** 2026-11-01 — ein Bereich, in den Antworten zu einer Baza gingen (nur Zahlen; nur Bereiche, die ich lese). */
export interface AnswerArea {
  readonly areaId: string;
  readonly learners: number;
  readonly batches: number;
  readonly lastAt: string;
}

/** Wohin die Antworten zu dieser Baza gingen — eine Baza steht in vielen Kursen, jeder hat seine Uczący się. */
export const loadAnswerAreas = (libraryId: string): Promise<{ areas: readonly AnswerArea[] }> =>
  call(`/workspace/learn/library/${encodeURIComponent(libraryId)}/areas`);

export const loadAreaBatches = (areaId: string, libraryId: string | null, since: string | null): Promise<{ now: string; batches: readonly StoredBatch[] }> =>
  call(`/workspace/learn/area/${encodeURIComponent(areaId)}/batches?${libraryId === null ? '' : `libraryId=${encodeURIComponent(libraryId)}&`}${since === null ? '' : `since=${encodeURIComponent(since)}`}`);

export function postDue(holder: Exclude<Holder, { kind: 'local' }>, libraryId: string, due: number | null, count: number): Promise<unknown> {
  const body = JSON.stringify({ libraryId, ...(holder.kind === 'role' ? { holderRoleId: holder.roleId } : {}), dueAt: due === null ? null : new Date(due).toISOString(), dueCount: count });
  return call(holder.kind === 'role' ? '/workspace/learn/due' : `${seatPath(holder.token)}/learn/due`, { method: 'POST', body });
}

export interface DueRow {
  readonly libraryId: string;
  readonly holderRoleId: string;
  readonly dueAt: string | null;
  readonly dueCount: number;
  readonly updatedAt: string;
  readonly areaId: string;
  readonly epoch: number;
  readonly nameSealed: string;
}

export const loadDue = (): Promise<{ now: string; due: readonly DueRow[] }> => call('/workspace/learn/due');

/* -- Die Ablage ohne Netz ------------------------------------------------------------------------- */

const outboxKey = (holder: Holder, batchId: string) => `${holderKey(holder)}:${batchId}`;

/** Was noch hinaus muss — versiegelte Stapel, sicher abgelegt. */
export async function pending(holder: Holder): Promise<SealedBatch[]> {
  const out: SealedBatch[] = [];
  for (const key of await idbKeys('outbox', `${holderKey(holder)}:`)) {
    const one = await idbGet<SealedBatch>('outbox', key);
    if (one !== null) out.push(one);
  }
  return out;
}

/** Hinausschicken, was wartet — was der Dienst angenommen hat, verlässt die Ablage. */
export async function flushOutbox(holder: Exclude<Holder, { kind: 'local' }>): Promise<number> {
  const waiting = await pending(holder);
  let sent = 0;
  for (let at = 0; at < waiting.length; at += 40) {
    const chunk = waiting.slice(at, at + 40);
    const done = await postBatches(holder, chunk);
    for (const id of done.stored) await idbDelete('outbox', outboxKey(holder, id));
    sent += done.stored.length;
  }
  return sent;
}

/**
 * 2026-10-28 — NACH DER ZEIT OHNE NETZ: was für Personen in der Ablage wartet, hinaus — gleich, ob dafür noch eine
 * Bibliothek offen ist. Der Dienst nimmt nur, was einer Person dieses Kontos gehört (sonst 403, und es wartet weiter).
 */
export async function flushWaiting(): Promise<number> {
  const roles = new Set<string>();
  for (const key of await idbKeys('outbox', 'r:')) {
    const roleId = key.split(':')[1];
    if (roleId !== undefined && roleId !== '') roles.add(roleId);
  }
  let sent = 0;
  for (const roleId of roles) {
    const holder: Holder = { kind: 'role', roleId, wrapPublicKey: new Uint8Array(0), wrapPrivate: () => Promise.reject(new Error('Nie jest potrzebny do wysłania.')) };
    try { sent += await flushOutbox(holder); } catch { /* später */ }
  }
  return sent;
}

/* -- 2026-11-02: dieselbe Person, mehrere Bausteine — live ----------------------------------------- */

/*
 * AUF EINER SEITE HAT JEDER BAUSTEIN SEINEN EIGENEN LERNENDEN (`useLearner`): die Powtórka, die Punkte, die Statystyki.
 * Was einer festhält, hören die anderen derselben Person in derselben Baza sofort — in diesem Fenster direkt, in anderen
 * Tabs dieses Browsers über einen BroadcastChannel. Sie nehmen es nur in ihren Fortschritt auf (nie noch einmal
 * gesendet). Ohne das hätten zwei Bausteine ohne Konto einander beim Ablegen auch die Antworten überschrieben.
 */
const LIVE = new Map<string, Set<Learner>>();
const LIVE_CHANNEL = 'recreatio-cogita-learn';

/*
 * 2026-11-03 (G) — WAS IN DIESEM FENSTER FESTGEHALTEN WURDE, je Person und Baza (Antworten, Momentaufnahmen, Stellen):
 * ein Lernender, der erst später entsteht — Nauka nach einer Erzählung auf einer Seite —, sieht es beim Laden sofort,
 * auch wenn es noch nicht hinaus ist (der Lernende der Seite schickt beim Gehen, der neue lädt vielleicht schon).
 */
const SESSION = new Map<string, { answers: AnswerRecord[]; snapshots: Snapshot[]; positions: FlowPosition[] }>();
function remember(key: string, add: { answers?: readonly AnswerRecord[]; snapshots?: readonly Snapshot[]; positions?: readonly FlowPosition[] }): void {
  const s = SESSION.get(key) ?? { answers: [], snapshots: [], positions: [] };
  s.answers.push(...(add.answers ?? []));
  s.snapshots.push(...(add.snapshots ?? []));
  s.positions.push(...(add.positions ?? []));
  if (s.answers.length > 4000) s.answers.splice(0, s.answers.length - 4000);
  if (s.snapshots.length > 4000) s.snapshots.splice(0, s.snapshots.length - 4000);
  if (s.positions.length > 400) s.positions.splice(0, s.positions.length - 400);
  SESSION.set(key, s);
}
let channel: BroadcastChannel | null | undefined;

function liveChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  try {
    channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(LIVE_CHANNEL) : null;
  } catch {
    channel = null;
  }
  channel?.addEventListener('message', (e: MessageEvent) => {
    const d: unknown = e.data;
    if (!isObject(d) || typeof d.who !== 'string' || !Array.isArray(d.answers)) return;
    for (const one of LIVE.get(d.who) ?? []) one.hear(d.answers, Array.isArray(d.snapshots) ? d.snapshots : [], Array.isArray(d.positions) ? d.positions : []);
  });
  return channel;
}

/** Wie lange frische Antworten höchstens warten, bis sie hinausgehen (die Lehrerin, ein anderes Gerät sehen sie dann). */
const IDLE_FLUSH = 20_000;

/* -- Ein Lernender in einer Bibliothek ------------------------------------------------------------ */

/**
 * DER LERNENDE — sein Fortschritt in einer Bibliothek, wie er im Browser
 * offen liegt, und was noch hinaus muss. Antworten werden gesammelt und in
 * Stapeln versiegelt (`flush`); geht das Netz nicht, warten sie in der Ablage.
 */
export class Learner {
  progress: Progress = EMPTY_PROGRESS;
  private since: string | null = null;
  private fresh: AnswerRecord[] = [];
  private freshSnapshots = new Map<string, Snapshot>();
  private readonly listeners = new Set<() => void>();
  /** Wie viele Antworten nicht hinaus konnten und in der Ablage warten. */
  waiting = 0;

  /**
   * `target`: wohin die Antworten gehen. 2026-11-01 — `fallback`: wohin, wenn der Dienst den Bereich nicht nimmt
   * (`answersTo.ts`) — dann wechselt `target` dorthin, und was schon für den alten Bereich wartete, wird neu
   * versiegelt (`retarget`).
   */
  constructor(readonly libraryId: string, readonly holder: Holder, public target: Target | null, private fallback: Target | null = null) {}

  /**
   * 2026-11-01 — DER DIENST NIMMT DEN BEREICH NICHT („area"): der Lernende gehört nicht dazu. Die Antworten gehen
   * an den Ausweichort, auch die schon wartenden — der Halter öffnet seine eigenen Stapel und versiegelt sie neu.
   */
  private async retarget(): Promise<boolean> {
    const fallback = this.fallback;
    if (this.holder.kind === 'local' || this.target === null || fallback === null) return false;
    const holder = this.holder;
    const from = this.target.areaId;
    this.target = fallback;
    this.fallback = null;
    for (const batch of await pending(holder)) {
      if (batch.areaId !== from) continue;
      const body = await openOwn(holder, { ...batch, holderRoleId: batch.holderRoleId ?? null, holderSeatId: null, key: batch.keyForHolder, createdAt: '' });
      if (body !== null) {
        const again = await sealBatch(batch.libraryId, holder, fallback, body as BatchBody);
        await idbPut('outbox', outboxKey(holder, again.batchId), again);
      }
      await idbDelete('outbox', outboxKey(holder, batch.batchId));
    }
    try { await flushOutbox(holder); } catch { /* später */ }
    this.waiting = (await pending(holder)).length;
    this.changed();
    return true;
  }

  /** Wer zuhört, gehört zu den Lernenden dieser Person in dieser Baza, die einander live hören. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      const key = this.liveKey();
      const set = LIVE.get(key) ?? new Set<Learner>();
      set.add(this);
      LIVE.set(key, set);
      liveChannel();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size > 0) return;
      const set = LIVE.get(this.liveKey());
      set?.delete(this);
      if (set !== undefined && set.size === 0) LIVE.delete(this.liveKey());
    };
  }

  private changed(): void { for (const one of this.listeners) one(); }

  private liveKey(): string { return `${this.libraryId}|${holderKey(this.holder)}`; }

  /** 2026-11-02 — den anderen Lernenden derselben Person sagen, was eben dazukam (2026-11-03: auch eine neue Stelle). */
  private tell(answers: readonly AnswerRecord[], snapshots: readonly Snapshot[], positions: readonly FlowPosition[] = []): void {
    if (answers.length === 0 && positions.length === 0) return;
    remember(this.liveKey(), { answers, snapshots, positions });
    for (const other of LIVE.get(this.liveKey()) ?? []) if (other !== this) other.hear(answers, snapshots, positions);
    try { liveChannel()?.postMessage({ who: this.liveKey(), answers, snapshots, positions }); } catch { /* ein anderer Tab hört es beim nächsten Laden */ }
  }

  /** 2026-11-02 — was ein anderer Lernender derselben Person festhielt: nur aufnehmen, nicht senden. */
  hear(answers: readonly unknown[], snapshots: readonly unknown[], positions: readonly unknown[] = []): void {
    const fresh = answers.filter((a) => isObject(a) && typeof a.id === 'string' && !this.progress.answers.has(a.id));
    const moved = positions.filter((p) => isObject(p) && typeof p.flow === 'string' && typeof p.at === 'number' && (this.progress.positions.get(p.flow)?.at ?? -1) < p.at);
    if (fresh.length === 0 && moved.length === 0) return;
    this.progress = absorb(this.progress, { kind: 'answers', answers: fresh, snapshots, positions: moved });
    this.changed();
  }

  private idle: ReturnType<typeof setTimeout> | null = null;

  /** 2026-11-02 — frische Antworten gehen spätestens nach `IDLE_FLUSH` hinaus, nicht erst nach zwanzig. */
  private flushSoon(): void {
    if (this.idle !== null) return;
    const timer = setTimeout(() => { this.idle = null; void this.flush().catch(() => undefined); }, IDLE_FLUSH);
    (timer as unknown as { unref?: () => void }).unref?.();
    this.idle = timer;
  }

  private localKey(): string { return `local:${this.libraryId}:${holderKey(this.holder)}`; }

  /** Was der Dienst seit dem letzten Holen hat (alle Arten), in den Fortschritt. */
  private async pull(): Promise<void> {
    if (this.holder.kind === 'local') return;
    const holder = this.holder;
    const { now, batches } = await loadOwnBatches(holder, this.libraryId, this.since);
    let progress = this.progress;
    for (const batch of batches) progress = absorb(progress, await openOwn(holder, batch));
    this.progress = progress;
    this.since = now;
  }

  /** Laden: was dieser Browser hat, dann was der Dienst seither hat, dann was noch wartet. */
  async load(): Promise<void> {
    if (this.holder.kind === 'local') {
      const kept = await idbGet<{ answers: AnswerRecord[]; snapshots: Snapshot[]; positions?: FlowPosition[]; values?: Record<string, number>; suspended?: string[] }>('progress', this.localKey());
      if (kept !== null) {
        this.progress = absorb(absorb(absorb(EMPTY_PROGRESS, { kind: 'answers', answers: kept.answers, snapshots: kept.snapshots, positions: kept.positions }),
          { kind: 'values', values: kept.values ?? {} }), { kind: 'suspend', suspended: kept.suspended ?? [] });
      }
      this.changed();
      return;
    }
    const holder = this.holder;
    try {
      await this.pull();
    } catch (e) {
      if (!(e instanceof WorkspaceError)) throw e;
      /* Ohne Netz: es bleibt, was schon da ist. */
    }
    for (const batch of await pending(holder)) {
      const body = await openOwn(holder, { ...batch, holderRoleId: batch.holderRoleId ?? null, holderSeatId: null, key: batch.keyForHolder, createdAt: '' });
      this.progress = absorb(this.progress, body);
    }
    /* 2026-11-04 (Prompt 13) — Stellen, die dieser Browser festhielt, aber vielleicht noch nicht hinausgingen (Neuladen, Tab zu). */
    const kept = this.pendingPositions();
    if (kept.length > 0) { this.progress = absorb(this.progress, { kind: 'position', positions: kept }); this.positionsDirty = true; }
    /* 2026-11-03 (G) — was in diesem Fenster schon festgehalten wurde (auch noch nicht hinaus). */
    const here = SESSION.get(this.liveKey());
    if (here !== undefined) this.progress = absorb(this.progress, { kind: 'answers', answers: here.answers, snapshots: here.snapshots, positions: here.positions });
    this.waiting = (await pending(holder)).length;
    this.changed();
    void this.flush().catch(() => undefined);
  }

  /**
   * 2026-11-02 — WAS ANDERE GERÄTE INZWISCHEN SANDTEN (eine Anzeige auf dem Fernseher, gelernt wird am Telefon): nur
   * mit Konto oder Platz — im Browser ohne Konto gibt es nichts anderswo, und `load` ersetzte dort den Stand.
   */
  async refresh(): Promise<void> {
    if (this.holder.kind === 'local') return;
    await this.load();
  }

  /**
   * 2026-10-27 — OHNE NETZ: die Antworten, die eine Abschrift für die Zeit ohne Netz mitbrachte (`offline.ts`). Sie
   * liegen schon beim Dienst — hier nur zum Rechnen (Sperre, Kenntnis), nie noch einmal gesendet; dieselbe Kennung
   * aus dem Dienst ersetzt sie später.
   */
  remember(answers: readonly AnswerRecord[]): void {
    if (answers.length === 0) return;
    this.progress = absorb(this.progress, { kind: 'answers', answers, snapshots: [] });
    this.changed();
  }

  /**
   * 2026-10-29 — ANTWORTEN AUS DEM EIGENEN JSON (`progressJson.ts`): ein Stapel wie jeder andere — versiegelt
   * für diesen Halter (und die Annahme des Kurses), über die Ablage, wenn das Netz fehlt. Nur in den eigenen
   * Fortschritt: der Lernende ist der, der importiert; was schon da war, hat der Plan vorher ausgelassen.
   */
  async adopt(answers: readonly AnswerRecord[]): Promise<void> {
    if (answers.length === 0) return;
    this.progress = absorb(this.progress, { kind: 'answers', answers, snapshots: [] });
    this.changed();
    this.tell(answers, []);
    await this.send({ v: 1, kind: 'answers', answers, snapshots: [] });
  }

  marks(key: string, fingerprint?: string, rename?: (key: string) => string): Mark[] {
    return marksOf(this.progress, key, fingerprint, rename);
  }

  /** Eine Antwort festhalten — sofort im Fortschritt, hinaus mit dem nächsten Stapel. */
  record(card: Card, correctness: number, extras: { given?: string; ms?: number; via?: string; hints?: number; params?: Readonly<Record<string, ParamValue>>; lead?: string; seed?: string; about?: readonly string[] } = {}, at = Date.now()): { answer: AnswerRecord; snapshot: Snapshot } {
    const params = readParams(extras.params);
    const answer: AnswerRecord = {
      id: newId(), key: card.key, question: card.question, direction: card.direction, fingerprint: card.fingerprint,
      at, correctness: Math.max(0, Math.min(1, correctness)),
      ...(extras.given === undefined ? {} : { given: clip(extras.given, 400) }),
      ...(extras.ms === undefined ? {} : { ms: Math.round(extras.ms) }),
      ...(extras.via === undefined ? {} : { via: extras.via }),
      ...(extras.hints === undefined || extras.hints <= 0 ? {} : { hints: Math.floor(extras.hints) }),
      ...(params === undefined ? {} : { params }),
      ...(extras.lead === undefined || extras.lead === '' ? {} : { lead: extras.lead }),
      ...(readSeed(extras.seed) === undefined ? {} : { seed: readSeed(extras.seed)! }),
      ...(extras.about === undefined || extras.about.length === 0 ? {} : { about: [...new Set(extras.about)].slice(0, 24) })
    };
    const marks = [...this.marks(card.key, card.fingerprint), { at, correctness: answer.correctness }];
    const snapshot = snapshotOf(card.question, card.direction, marks, at);
    this.progress = absorb(this.progress, { kind: 'answers', answers: [answer], snapshots: [snapshot] });
    this.fresh.push(answer);
    this.freshSnapshots.set(card.key, snapshot);
    this.changed();
    this.tell([answer], [snapshot]);
    if (this.fresh.length >= 20) void this.flush().catch(() => undefined);
    else this.flushSoon();
    return { answer, snapshot };
  }

  async suspend(key: string, on: boolean): Promise<void> {
    const next = new Set(this.progress.suspended);
    if (on) next.add(key); else next.delete(key);
    this.progress = { ...this.progress, suspended: next };
    this.changed();
    await this.send({ v: 1, kind: 'suspend', suspended: [...next] });
  }

  /*
    2026-11-04 (Prompt 13) — DIE STELLEN IN DEN ERZÄHLUNGEN: der Dienst behält je Halter, Baza und Bereich nur den JÜNGSTEN
    Stapel „position" — früher ging je Schritt ein Stapel mit EINER Stelle hinaus, und die vorige Erzählung (auch eine
    „ukończona") war beim nächsten Laden weg; dazu fielen nach 400 Stapeln am Tag die übrigen Schritte aus. Jetzt: jede
    Stelle sofort in diesen Browser (überlebt Neuladen und Schliessen), und hinaus geht EIN Stapel mit ALLEN Stellen —
    nachdem geholt ist, was andere Geräte seither schrieben (zusammengeführt mit `mergePosition`): höchstens einmal je
    Minute, gleich bei einem Ende oder einem Ziel, und wenn der Tab verschwindet (`flush`).
  */
  private positionsDirty = false;
  private positionTimer: ReturnType<typeof setTimeout> | null = null;
  private positionKey(): string { return `cg-pos:${this.libraryId}:${holderKey(this.holder)}`; }
  private pendingPositions(): FlowPosition[] {
    try {
      const raw = localStorage.getItem(this.positionKey());
      const list = raw === null ? [] : JSON.parse(raw) as unknown;
      return Array.isArray(list) ? list.filter((p): p is FlowPosition => isObject(p) && typeof p.flow === 'string' && typeof p.step === 'string' && typeof p.at === 'number') : [];
    } catch { return []; }
  }
  private keepPending(position: FlowPosition): void {
    try {
      const list = this.pendingPositions().filter((p) => p.flow !== position.flow);
      const merged = mergePosition(this.pendingPositions().find((p) => p.flow === position.flow), position);
      localStorage.setItem(this.positionKey(), JSON.stringify([...list, merged].slice(-300)));
    } catch { /* ohne Speicher: dann nur aus dem Gedächtnis */ }
  }

  async keepPosition(position: FlowPosition): Promise<void> {
    const had = this.progress.positions.get(position.flow);
    this.progress = absorb(this.progress, { kind: 'position', positions: [position] });
    this.changed();
    /* 2026-11-03 (G) — die anderen Lernenden derselben Person hören die neue Stelle gleich (eine Erzählung „ukończona"). */
    this.tell([], [], [position]);
    this.keepPending(position);
    this.positionsDirty = true;
    const now = this.progress.positions.get(position.flow);
    const won = (now?.done === true && had?.done !== true) || (now?.goals?.length ?? 0) > (had?.goals?.length ?? 0) || position.reset === true;
    this.positionsSoon(won ? 0 : 60_000);
  }

  private positionsSoon(ms: number): void {
    if (this.positionTimer !== null) { if (ms > 0) return; clearTimeout(this.positionTimer); }
    const timer = setTimeout(() => { this.positionTimer = null; void this.sendPositions().catch(() => undefined); }, ms);
    (timer as unknown as { unref?: () => void }).unref?.();
    this.positionTimer = timer;
  }

  /** Alle Stellen in einem Stapel hinaus — erst holen, was andere Geräte schrieben (der Stapel ersetzt den vorigen beim Dienst). */
  async sendPositions(): Promise<void> {
    if (this.positionTimer !== null) { clearTimeout(this.positionTimer); this.positionTimer = null; }
    if (!this.positionsDirty) return;
    this.positionsDirty = false;
    if (this.holder.kind === 'local') { await this.keepLocal(); this.clearPending(); return; }
    try { await this.pull(); } catch { /* ohne Netz: was wir haben — die Ablage wartet */ }
    const sentAt = Date.now();
    const all = [...this.progress.positions.values()].map((p) => (p.visited.length > 400 ? { ...p, visited: p.visited.slice(-400) } : p));
    await this.send({ v: 1, kind: 'position', positions: all });
    this.clearPending(sentAt);
  }

  private clearPending(upTo = Number.POSITIVE_INFINITY): void {
    try {
      const left = this.pendingPositions().filter((p) => p.at > upTo);
      if (left.length === 0) localStorage.removeItem(this.positionKey()); else localStorage.setItem(this.positionKey(), JSON.stringify(left));
    } catch { /* ohne Speicher */ }
  }

  async keepValues(values: Readonly<Record<string, number>>): Promise<void> {
    this.progress = { ...this.progress, values: { ...values } };
    this.changed();
    await this.send({ v: 1, kind: 'values', values });
  }

  private async keepLocal(): Promise<void> {
    await idbPut('progress', this.localKey(), {
      answers: [...this.progress.answers.values()], snapshots: [...this.progress.snapshots.values()],
      positions: [...this.progress.positions.values()], values: this.progress.values, suspended: [...this.progress.suspended]
    });
  }

  /** Einen Stapel versiegeln und hinaus — sonst in die Ablage. */
  private async send(body: BatchBody): Promise<void> {
    if (this.holder.kind === 'local') { await this.keepLocal(); return; }
    if (this.target === null) return;
    const holder = this.holder;
    const batch = await sealBatch(this.libraryId, holder, this.target, body);
    await idbPut('outbox', outboxKey(holder, batch.batchId), batch);
    try {
      const done = await postBatches(holder, [batch]);
      for (const id of done.stored) await idbDelete('outbox', outboxKey(holder, id));
    } catch (e) {
      /* Wartet in der Ablage — ausser der Dienst nimmt den Bereich nicht: dann zum Ausweichort. */
      if (refusedArea(e) && await this.retarget()) return;
    }
    this.waiting = (await pending(holder)).length;
    this.changed();
  }

  /** Die gesammelten Antworten als Stapel hinaus (und was noch wartete). */
  async flush(): Promise<void> {
    if (this.idle !== null) { clearTimeout(this.idle); this.idle = null; }
    if (this.positionsDirty) void this.sendPositions().catch(() => undefined);
    const answers = this.fresh;
    const snapshots = [...this.freshSnapshots.values()];
    this.fresh = [];
    this.freshSnapshots = new Map();
    if (this.holder.kind === 'local') { await this.keepLocal(); return; }
    if (answers.length > 0) await this.send({ v: 1, kind: 'answers', answers, snapshots });
    else {
      try { await flushOutbox(this.holder); } catch (e) { if (refusedArea(e) && await this.retarget()) return; /* sonst später */ }
      this.waiting = (await pending(this.holder)).length;
      this.changed();
    }
  }

  /** Wann wieder dran — die eine offene Zeit [E8]; dazu, wie viele Karten jetzt dran sind. */
  async reportDue(cards: readonly Card[], rename?: (key: string) => string, now = Date.now()): Promise<{ next: number | null; count: number }> {
    let next: number | null = null;
    let count = 0;
    for (const card of cards) {
      if (this.progress.suspended.has(card.key)) continue;
      const marks = this.marks(card.key, card.fingerprint, rename);
      if (marks.length === 0) continue;
      const due = dueAt(marks);
      if (due === null) continue;
      if (due <= now) count += 1;
      if (next === null || due < next) next = due;
    }
    if (this.holder.kind !== 'local') await postDue(this.holder, this.libraryId, next, count).catch(() => undefined);
    return { next, count };
  }
}

/** Was in diesem Browser ohne Konto gelernt wurde — zum Mitnehmen nach der Anmeldung. */
export async function localProgress(libraryId: string): Promise<{ key: string; answers: number }[]> {
  const out: { key: string; answers: number }[] = [];
  for (const key of await idbKeys('progress', `local:${libraryId}:l:`)) {
    const kept = await idbGet<{ answers: unknown[] }>('progress', key);
    if (kept !== null && Array.isArray(kept.answers) && kept.answers.length > 0) out.push({ key, answers: kept.answers.length });
  }
  return out;
}

/** Den Fortschritt ohne Konto in den des Kontos übernehmen — als ein Stapel, dann aus diesem Browser weg. */
export async function adoptLocal(key: string, into: Learner): Promise<number> {
  const kept = await idbGet<{ answers: AnswerRecord[]; snapshots: Snapshot[] }>('progress', key);
  if (kept === null || into.holder.kind === 'local') return 0;
  const answers = (kept.answers ?? []).map(readAnswer).filter((a): a is AnswerRecord => a !== null);
  if (answers.length === 0) return 0;
  if (into.target === null) return 0;
  const batch = await sealBatch(into.libraryId, into.holder, into.target, { v: 1, kind: 'answers', answers, snapshots: kept.snapshots ?? [] });
  await postBatches(into.holder, [batch]);
  into.progress = absorb(into.progress, { kind: 'answers', answers, snapshots: kept.snapshots ?? [] });
  await idbDelete('progress', key);
  return answers.length;
}

/* -- Für die Kanzlei: alle Lernenden eines Bereichs [E10] ------------------------------------------ */

export interface LearnerProgress {
  /** `r:<rolle>` oder `s:<platz>`. */
  readonly holder: string;
  readonly roleId: string | null;
  readonly seatId: string | null;
  readonly progress: Progress;
  readonly lastAt: string;
}

/**
 * Die Fortschritte im Bereich, je Lernendem — geöffnet mit dem privaten Schlüssel der Annahme. 2026-11-01: dazu, bei
 * einem virtuellen Bereich eines Formulars, die Stapel in den Bereichen der Personen (`areaEpoch`) — geöffnet mit dem
 * Schlüssel jenes Bereichs (`keyOf`: wer ihn liest, hat ihn). Ohne Przyjęcia (`intakePrivate` null) nur diese.
 */
export async function areaProgress(
  areaId: string, libraryId: string | null, intakePrivate: Uint8Array | null,
  keyOf: (areaId: string, epoch: number) => Promise<Uint8Array | undefined> = () => Promise.resolve(undefined)
): Promise<LearnerProgress[]> {
  const { batches } = await loadAreaBatches(areaId, libraryId, null);
  const by = new Map<string, { roleId: string | null; seatId: string | null; progress: Progress; lastAt: string }>();
  for (const batch of batches) {
    const epoch = batch.areaEpoch ?? null;
    let body: unknown = null;
    if (epoch !== null) {
      const key = await keyOf(batch.areaId, epoch).catch(() => undefined);
      body = key === undefined ? null : await openWithAreaKey(key, batch);
    } else if (intakePrivate !== null) {
      body = await openForArea(intakePrivate, batch);
    }
    if (body === null) continue;
    const holder = batch.holderRoleId !== null ? `r:${batch.holderRoleId}` : `s:${batch.holderSeatId ?? '?'}`;
    const had = by.get(holder) ?? { roleId: batch.holderRoleId, seatId: batch.holderSeatId, progress: EMPTY_PROGRESS, lastAt: batch.createdAt };
    by.set(holder, { ...had, progress: absorb(had.progress, body), lastAt: batch.createdAt > had.lastAt ? batch.createdAt : had.lastAt });
  }
  return [...by.entries()].map(([holder, one]) => ({ holder, ...one }));
}

/* -- Hinweise an die Autoren, ohne Namen [K4, D12] ------------------------------------------------ */

export interface Report {
  readonly kind: 'flags' | 'counts';
  readonly body: unknown;
  readonly createdAt: string;
}

/**
 * EINE KARTE MELDEN oder ZAHLEN schicken — versiegelt für die Annahme des
 * Bereichs der Bibliothek, ohne Halter. Ohne Annahme dort geht nichts hinaus.
 */
export async function sendReport(libraryId: string, libraryAreaId: string, kind: 'flags' | 'counts', body: unknown, seat?: string): Promise<boolean> {
  const intake = await intakeOf(libraryAreaId);
  if (intake === null) return false;
  const batchId = newId();
  const key = crypto.getRandomValues(new Uint8Array(32));
  const sealed = toBase64Url(await sealText(key, batchAad(batchId), JSON.stringify({ v: 1, kind, body })));
  const keyForArea = toBase64Url(await wrapKey(intake, areaAad(batchId), key));
  const path = seat === undefined
    ? `/workspace/learn/library/${encodeURIComponent(libraryId)}/report`
    : `${seatPath(seat)}/learn/library/${encodeURIComponent(libraryId)}/report`;
  await call(path, { method: 'POST', body: JSON.stringify({ batchId, kind, sealed, keyForArea }) });
  return true;
}

/** Die Hinweise einer Bibliothek — für die Autoren, mit dem privaten Schlüssel der Annahme. */
export async function loadReports(libraryId: string, intakePrivate: Uint8Array): Promise<Report[]> {
  const { batches } = await call<{ batches: readonly StoredBatch[] }>(`/workspace/learn/library/${encodeURIComponent(libraryId)}/reports`);
  const out: Report[] = [];
  for (const batch of batches) {
    const opened = await openForArea(intakePrivate, batch);
    if (isObject(opened) && (opened.kind === 'flags' || opened.kind === 'counts')) out.push({ kind: opened.kind, body: opened.body, createdAt: batch.createdAt });
  }
  return out;
}
