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

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url, unwrapKey, unwrapKeyP256, wrapKey, wrapKeyP256 } from '../core/crypto';
import { idbDelete, idbGet, idbKeys, idbPut } from '../core/idb';
import { newId } from '../core/ids';
import { call, Unreachable, WorkspaceError } from '../core/session';
import type { Card } from './cardBasics';
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
}

/** Wo jemand in einem Ablauf steht [G14] — über Geräte hinweg. */
export interface FlowPosition {
  readonly flow: string;
  readonly step: string;
  readonly visited: readonly string[];
  readonly chapters?: readonly string[];
  readonly at: number;
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
    ...(typeof raw.via === 'string' ? { via: raw.via } : {})
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
    const had = positions.get(pos.flow);
    if (had === undefined || had.at <= pos.at) positions.set(pos.flow, pos);
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
  for (const one of progress.answers.values()) {
    const k = rename === undefined ? one.key : rename(one.key);
    if (k !== key) continue;
    if (fingerprint !== undefined && one.fingerprint !== '' && one.fingerprint !== fingerprint) continue;
    out.push({ at: one.at, correctness: one.correctness });
  }
  return out.sort((a, b) => a.at - b.at);
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
  | { readonly kind: 'seat'; readonly token: string; readonly seatId: string; readonly wrapPublicKey: Uint8Array; readonly wrapPrivate: Uint8Array }
  | { readonly kind: 'local'; readonly id: string };

export const holderKey = (h: Holder): string => (h.kind === 'role' ? `r:${h.roleId}` : h.kind === 'seat' ? `s:${h.seatId}` : `l:${h.id}`);

/** Wohin die Antworten gehen — der Bereich und der öffentliche Schlüssel seiner Annahme (oder keiner). */
export interface Target {
  readonly areaId: string;
  readonly intake: Uint8Array | null;
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
}

/** Versiegeln — ohne Geheimnis, ohne Netz: beide Schlüssel sind öffentlich. */
export async function sealBatch(libraryId: string, holder: Exclude<Holder, { kind: 'local' }>, target: Target, body: BatchBody): Promise<SealedBatch> {
  const batchId = newId();
  const key = crypto.getRandomValues(new Uint8Array(32));
  const sealed = toBase64Url(await sealText(key, batchAad(batchId), JSON.stringify(body)));
  const forHolder = holder.kind === 'role'
    ? await wrapKey(holder.wrapPublicKey, holderAad(batchId), key)
    : await wrapKeyP256(holder.wrapPublicKey, holderAad(batchId), key);
  const forArea = target.intake === null ? null : await wrapKey(target.intake, areaAad(batchId), key);
  return {
    batchId, libraryId, areaId: target.areaId, kind: body.kind,
    ...(holder.kind === 'role' ? { holderRoleId: holder.roleId } : {}),
    sealed, keyForHolder: toBase64Url(forHolder),
    ...(forArea === null ? {} : { keyForArea: toBase64Url(forArea) })
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

const seatPath = (token: string) => `/seat/${encodeURIComponent(token)}`;

export function postBatches(holder: Exclude<Holder, { kind: 'local' }>, batches: readonly SealedBatch[]): Promise<{ stored: readonly string[] }> {
  const path = holder.kind === 'role' ? '/workspace/learn/batches' : `${seatPath(holder.token)}/learn/batches`;
  return call(path, { method: 'POST', body: JSON.stringify({ batches }) });
}

export function loadOwnBatches(holder: Exclude<Holder, { kind: 'local' }>, libraryId: string, since: string | null): Promise<{ now: string; batches: readonly StoredBatch[] }> {
  const query = `?libraryId=${encodeURIComponent(libraryId)}${since === null ? '' : `&since=${encodeURIComponent(since)}`}`;
  return call(holder.kind === 'role' ? `/workspace/learn/batches${query}` : `${seatPath(holder.token)}/learn/batches${query}`);
}

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

  constructor(readonly libraryId: string, readonly holder: Holder, readonly target: Target | null) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private changed(): void { for (const one of this.listeners) one(); }

  private localKey(): string { return `local:${this.libraryId}:${holderKey(this.holder)}`; }

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
      const { now, batches } = await loadOwnBatches(holder, this.libraryId, this.since);
      let progress = this.progress;
      for (const batch of batches) progress = absorb(progress, await openOwn(holder, batch));
      this.progress = progress;
      this.since = now;
    } catch (e) {
      if (!(e instanceof WorkspaceError)) throw e;
      /* Ohne Netz: es bleibt, was schon da ist. */
    }
    for (const batch of await pending(holder)) {
      const body = await openOwn(holder, { ...batch, holderRoleId: batch.holderRoleId ?? null, holderSeatId: null, key: batch.keyForHolder, createdAt: '' });
      this.progress = absorb(this.progress, body);
    }
    this.waiting = (await pending(holder)).length;
    this.changed();
    void this.flush().catch(() => undefined);
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
    await this.send({ v: 1, kind: 'answers', answers, snapshots: [] });
  }

  marks(key: string, fingerprint?: string, rename?: (key: string) => string): Mark[] {
    return marksOf(this.progress, key, fingerprint, rename);
  }

  /** Eine Antwort festhalten — sofort im Fortschritt, hinaus mit dem nächsten Stapel. */
  record(card: Card, correctness: number, extras: { given?: string; ms?: number; via?: string } = {}, at = Date.now()): { answer: AnswerRecord; snapshot: Snapshot } {
    const answer: AnswerRecord = {
      id: newId(), key: card.key, question: card.question, direction: card.direction, fingerprint: card.fingerprint,
      at, correctness: Math.max(0, Math.min(1, correctness)),
      ...(extras.given === undefined ? {} : { given: clip(extras.given, 400) }),
      ...(extras.ms === undefined ? {} : { ms: Math.round(extras.ms) }),
      ...(extras.via === undefined ? {} : { via: extras.via })
    };
    const marks = [...this.marks(card.key, card.fingerprint), { at, correctness: answer.correctness }];
    const snapshot = snapshotOf(card.question, card.direction, marks, at);
    this.progress = absorb(this.progress, { kind: 'answers', answers: [answer], snapshots: [snapshot] });
    this.fresh.push(answer);
    this.freshSnapshots.set(card.key, snapshot);
    this.changed();
    if (this.fresh.length >= 20) void this.flush().catch(() => undefined);
    return { answer, snapshot };
  }

  async suspend(key: string, on: boolean): Promise<void> {
    const next = new Set(this.progress.suspended);
    if (on) next.add(key); else next.delete(key);
    this.progress = { ...this.progress, suspended: next };
    this.changed();
    await this.send({ v: 1, kind: 'suspend', suspended: [...next] });
  }

  async keepPosition(position: FlowPosition): Promise<void> {
    this.progress = absorb(this.progress, { kind: 'position', positions: [position] });
    this.changed();
    await this.send({ v: 1, kind: 'position', positions: [position] });
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
    } catch {
      /* Wartet in der Ablage. */
    }
    this.waiting = (await pending(holder)).length;
    this.changed();
  }

  /** Die gesammelten Antworten als Stapel hinaus (und was noch wartete). */
  async flush(): Promise<void> {
    const answers = this.fresh;
    const snapshots = [...this.freshSnapshots.values()];
    this.fresh = [];
    this.freshSnapshots = new Map();
    if (this.holder.kind === 'local') { await this.keepLocal(); return; }
    if (answers.length > 0) await this.send({ v: 1, kind: 'answers', answers, snapshots });
    else {
      try { await flushOutbox(this.holder); } catch { /* später */ }
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

/** Die Fortschritte im Bereich, je Lernendem — geöffnet mit dem privaten Schlüssel der Annahme. */
export async function areaProgress(areaId: string, libraryId: string | null, intakePrivate: Uint8Array): Promise<LearnerProgress[]> {
  const { batches } = await loadAreaBatches(areaId, libraryId, null);
  const by = new Map<string, { roleId: string | null; seatId: string | null; progress: Progress; lastAt: string }>();
  for (const batch of batches) {
    const holder = batch.holderRoleId !== null ? `r:${batch.holderRoleId}` : `s:${batch.holderSeatId ?? '?'}`;
    const had = by.get(holder) ?? { roleId: batch.holderRoleId, seatId: batch.holderSeatId, progress: EMPTY_PROGRESS, lastAt: batch.createdAt };
    by.set(holder, { ...had, progress: absorb(had.progress, await openForArea(intakePrivate, batch)), lastAt: batch.createdAt > had.lastAt ? batch.createdAt : had.lastAt });
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
