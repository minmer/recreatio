/**
 * 0130 — MELDEN, ENTSCHEIDEN, WIDERSPRECHEN (`Reports.cs`).
 *
 * <b>Jede Meldung geht an den Betreiber.</b> Offen steht nur, WAS gemeldet ist (Art
 * und Kennung — sonst fände sie niemand). Grund, Kontakt, was der Meldende gesehen
 * hat (`quote`) und das ENTSCHEIDUNGSGEHEIMNIS versiegelt dieser Browser für den
 * öffentlichen Schlüssel der Rolle des Betreibers; der Dienst behält vom Geheimnis
 * nur den Hash. Entscheiden kann so nur, wer die Meldung öffnet, und nur über die
 * gemeldete Sache — mit einem Schritt, den die Rolle des Betreibers unterschreibt und
 * der am Hash des vorigen hängt (`dutyRecords.ts`). Ohne Meldung kein Sperren und
 * kein Löschen; der Dienst bekommt dabei keinen Schlüssel zu irgendeinem Inhalt.
 *
 * <b>Melden kann jeder, was er lesen kann</b> — mit oder ohne Konto. Über den
 * Meldenden bleibt nichts als der Hash seiner Quittung.
 */

import { aad, Field, fromBase64Url, open, seal, sha256Bytes, signCanonical, toBase64Url, unwrapKey, wrapKey } from '../core/crypto';
import { serialize } from '../core/canonical';
import { GENESIS_HASH, nowSeconds, takedownCanon, takedownHash, type TakedownAction, type TakedownFacts } from '../core/dutyRecords';
import type { Ring } from '../core/keys';
import { call } from '../core/session';
import type { ReportKind } from './reportPath';

/* -- Worte ---------------------------------------------------------------------- */

export type ReportReason = 'data' | 'illegal' | 'other';

export const REASONS: readonly { readonly value: ReportReason; readonly label: string; readonly says: string }[] = [
  { value: 'data', label: 'Moje dane osobowe', says: 'Ktoś pokazuje albo zbiera dane o mnie (albo o kimś, za kogo odpowiadam) bez podstawy.' },
  { value: 'illegal', label: 'Treść niezgodna z prawem', says: 'Na przykład naruszenie dóbr osobistych, praw autorskich, groźby.' },
  { value: 'other', label: 'Coś innego', says: 'Opisz, o co chodzi.' }
];

export const KIND_WORDS: Record<ReportKind, string> = {
  page: 'Strona', part: 'Moduł strony', file: 'Plik strony', form: 'Formularz', message: 'Wiadomość',
  entry: 'Wpis biblioteki', item: 'Termin', share: 'Plik przez link', link: 'Link z dostępem', event: 'Wydarzenie'
};

export type ReportState = 'received' | 'blocked' | 'objected' | 'deleted' | 'restored' | 'rejected';

export const STATE_WORDS: Record<ReportState, string> = {
  received: 'Nowe — czeka na decyzję', blocked: 'Zablokowane', objected: 'Autor się odwołał',
  deleted: 'Usunięte na zawsze', restored: 'Przywrócone', rejected: 'Odrzucone — treść zostaje'
};

/** Warum der Betreiber sperrt — das Wort, das der Verfasser liest. */
export type DecisionReason = 'personal-data' | 'illegal' | 'rights' | 'other';

export const DECISION_REASONS: Record<DecisionReason, string> = {
  'personal-data': 'dane osobowe bez podstawy', illegal: 'treść niezgodna z prawem', rights: 'naruszenie cudzych praw', other: 'inny powód'
};

/* -- Was gemeldet werden kann ------------------------------------------------------ */

export interface TargetPart {
  readonly itemKind: 'part' | 'file';
  readonly itemId: string;
  readonly kind: string;
  readonly name?: string | null;
}

export interface ReportTarget {
  readonly itemKind: ReportKind;
  readonly itemId: string;
  readonly path: string | null;
  readonly title: string | null;
  /** Bei einer Seite: ihre Teile und Dateien — zur Auswahl, was genau gemeint ist. */
  readonly parts: readonly TargetPart[];
}

/** Die Sache hinter Art und Kennung — nur, wenn dieser Browser (mit seinem Konto oder Link) sie lesen kann. */
export const targetOf = (kind: string, id: string): Promise<ReportTarget> =>
  call(`/report/target?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);

/** Eine Seite aus einer Adresse (recreatio.pl/#/pfad, #/pfad oder pfad). */
export const targetOfAddress = (address: string): Promise<ReportTarget> =>
  call(`/report/target?address=${encodeURIComponent(address)}`);

/* -- Versiegeln für den Betreiber -------------------------------------------------- */

export interface OperatorKey {
  readonly roleId: string;
  readonly wrapPublicKey: string;
  readonly signPublicKey: string;
}

export const operatorKey = (): Promise<OperatorKey> => call('/report/operator');

export const reportTextAad = (reportId: string) => aad('report', 'report', reportId, Field.ReportText, 1);
export const reportKeyAad = (reportId: string) => aad('report', 'report', reportId, Field.ReportKey, 1);
export const objectionTextAad = (reportId: string) => aad('report', 'report', reportId, Field.ReportObjection, 1);
export const objectionKeyAad = (reportId: string) => aad('report', 'report', reportId, Field.ReportObjectionKey, 1);

const utf8 = new TextEncoder();
const random = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/** Was versiegelt wird: die Meldung selbst, oder der Widerspruch des Verfassers — jedes mit eigenen Etiketten. */
export type SealedKind = 'report' | 'objection';

const aadsOf = (kind: SealedKind, reportId: string) => kind === 'report'
  ? { text: reportTextAad(reportId), key: reportKeyAad(reportId) }
  : { text: objectionTextAad(reportId), key: objectionKeyAad(reportId) };

/**
 * Ein Zufallsschlüssel versiegelt den Text; ihn selbst verpackt der öffentliche
 * Schlüssel der Rolle des Betreibers. Der Dienst legt beides ab und öffnet nichts.
 */
export async function sealForOperator(wrapPublicKey: string, kind: SealedKind, reportId: string, value: unknown): Promise<{ sealed: string; sealedKey: string }> {
  const a = aadsOf(kind, reportId);
  const key = random(32);
  try {
    const sealed = await seal(key, a.text, utf8.encode(JSON.stringify(value)));
    const sealedKey = await wrapKey(fromBase64Url(wrapPublicKey), a.key, key);
    return { sealed: toBase64Url(sealed), sealedKey: toBase64Url(sealedKey) };
  } finally {
    key.fill(0);
  }
}

/** Die Gegenrichtung — mit dem privaten Verpackungsschlüssel der Rolle des Betreibers. */
export async function openForOperator(wrapPrivate: Uint8Array, kind: SealedKind, reportId: string, sealed: string, sealedKey: string): Promise<unknown> {
  const a = aadsOf(kind, reportId);
  const key = await unwrapKey(wrapPrivate, a.key, fromBase64Url(sealedKey));
  try {
    return JSON.parse(new TextDecoder().decode(await open(key, a.text, fromBase64Url(sealed)))) as unknown;
  } finally {
    key.fill(0);
  }
}

/** Was versiegelt an den Betreiber geht — nur er öffnet es. */
export interface ReportLetter {
  readonly v: 1;
  readonly reportId: string;
  readonly itemKind: ReportKind;
  readonly itemId: string;
  readonly itemAt: number | null;
  readonly path: string | null;
  readonly title: string | null;
  readonly reason: ReportReason;
  readonly text: string;
  /** Wie der Betreiber antworten kann — freiwillig. */
  readonly contact: string | null;
  /** Was der Meldende gesehen hat (eine Nachricht, ein Eintrag): der Betreiber hat dazu keinen Schlüssel. */
  readonly quote: string | null;
  /** Das Entscheidungsgeheimnis: der Dienst kennt nur seinen Hash. */
  readonly secret: string;
  readonly sentAt: string;
}

export interface ReportInput {
  readonly itemKind: ReportKind;
  readonly itemId: string;
  readonly itemAt?: number | null;
  readonly path?: string | null;
  readonly title?: string | null;
  readonly reason: ReportReason;
  readonly text: string;
  readonly contact?: string | null;
  readonly quote?: string | null;
}

export interface Sent {
  readonly id: string;
  /** Die Quittung — wer sie hat, sieht, was aus der Meldung wurde. Sie steht nirgends sonst. */
  readonly receipt: string;
  readonly receivedAt: string;
}

export async function sendReport(input: ReportInput): Promise<Sent> {
  const op = await operatorKey();
  const id = crypto.randomUUID();
  const secret = random(32);
  const receipt = random(32);

  const letter: ReportLetter = {
    v: 1, reportId: id, itemKind: input.itemKind, itemId: input.itemId, itemAt: input.itemAt ?? null,
    path: input.path ?? null, title: input.title ?? null, reason: input.reason, text: input.text.trim(),
    contact: input.contact?.trim() || null, quote: input.quote?.trim() || null,
    secret: toBase64Url(secret), sentAt: new Date().toISOString()
  };
  const { sealed, sealedKey } = await sealForOperator(op.wrapPublicKey, 'report', id, letter);

  const out = await call<{ id: string; receivedAt: string }>('/report', {
    method: 'POST',
    body: JSON.stringify({
      id, itemKind: input.itemKind, itemId: input.itemId, itemAt: input.itemAt ?? null, path: input.path ?? null,
      reason: input.reason, operatorRoleId: op.roleId, sealed, sealedKey,
      decisionSha256: toBase64Url(await sha256Bytes(secret)),
      receiptSha256: toBase64Url(await sha256Bytes(receipt))
    })
  });
  secret.fill(0);
  return { id: out.id, receipt: toBase64Url(receipt), receivedAt: out.receivedAt };
}

export interface ReportStatus {
  readonly id: string;
  readonly itemKind: ReportKind;
  readonly state: ReportState;
  readonly receivedAt: string;
  readonly decidedAt: string | null;
}

export const reportStatus = (receipt: string): Promise<ReportStatus> =>
  call('/report/status', { method: 'POST', body: JSON.stringify({ receipt: receipt.trim() }) });

/* -- Der Betreiber ------------------------------------------------------------------ */

export interface QueueRow {
  readonly id: string;
  readonly itemKind: ReportKind;
  readonly itemId: string;
  readonly itemAt: number | null;
  readonly path: string | null;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly controllerId: string | null;
  readonly controllerName: string | null;
  readonly reason: ReportReason;
  readonly state: ReportState;
  readonly receivedAt: string;
  readonly decidedAt: string | null;
  readonly sealed: string | null;
  readonly sealedKey: string | null;
  readonly objection: string | null;
  readonly objectionKey: string | null;
  readonly objectedAt: string | null;
  readonly takedown: 'blocked' | 'deleted' | null;
  readonly blockedSince: string | null;
  /** Ab wann endgültig gelöscht werden darf (14 Tage nach dem Sperren; nach einem Widerspruch sofort). */
  readonly deleteFrom: string | null;
}

export interface ChainHead { readonly sequence: number; readonly hash: string }

export const loadQueue = (): Promise<{ reports: readonly QueueRow[]; head: ChainHead }> => call('/workspace/reports');

/** Die Meldung öffnen — mit dem Verpackungsschlüssel der Rolle des Betreibers. `null`: ihr Text ist nach einem halben Jahr fort. */
export async function openLetter(ring: Ring, operatorRoleId: string, row: QueueRow): Promise<ReportLetter | null> {
  if (row.sealed === null || row.sealedKey === null) return null;
  const letter = await openForOperator(await ring.wrapPrivate(operatorRoleId), 'report', row.id, row.sealed, row.sealedKey) as ReportLetter;
  /* Die offene Zeile und der versiegelte Brief nennen dieselbe Sache — sonst wäre über etwas anderes zu entscheiden, als gemeldet ist. */
  if (letter.reportId !== row.id || letter.itemId !== row.itemId || letter.itemKind !== row.itemKind) {
    throw new Error('Treść zgłoszenia nie pasuje do jego numeru.');
  }
  return letter;
}

/** Der Widerspruch des Verfassers — ebenso versiegelt. */
export async function openObjection(ring: Ring, operatorRoleId: string, row: QueueRow): Promise<string | null> {
  if (row.objection === null || row.objectionKey === null) return null;
  const value = await openForOperator(await ring.wrapPrivate(operatorRoleId), 'objection', row.id, row.objection, row.objectionKey) as { text?: unknown };
  return typeof value.text === 'string' ? value.text : null;
}

/** Welche Schritte ein Fall jetzt zulässt — dieselben Regeln wie der Dienst. */
export function actionsFor(row: QueueRow, now: Date = new Date()): readonly TakedownAction[] {
  if (row.state === 'received') return ['block', 'reject'];
  if (row.state === 'restored') return ['block'];
  if (row.state === 'objected') return ['restore', 'delete'];
  if (row.state === 'blocked') {
    const deletable = row.deleteFrom !== null && new Date(row.deleteFrom) <= now;
    return deletable ? ['restore', 'delete'] : ['restore'];
  }
  return [];
}

export const ACTION_WORDS: Record<TakedownAction, string> = {
  block: 'Zablokuj', restore: 'Przywróć', delete: 'Usuń na zawsze', reject: 'Odrzuć zgłoszenie'
};

/**
 * Entscheiden: mit dem Geheimnis aus der versiegelten Meldung und einem Schritt
 * der Kette, den die Rolle des Betreibers hier unterschreibt.
 */
export async function decideReport(ring: Ring, operatorRoleId: string, row: QueueRow, letter: ReportLetter, action: TakedownAction,
  reasonCode: DecisionReason, head: ChainHead): Promise<{ state: ReportState; head: ChainHead }> {
  const facts: TakedownFacts = {
    sequence: head.sequence + 1,
    previousHash: head.sequence === 0 ? GENESIS_HASH : head.hash,
    entryId: crypto.randomUUID(),
    reportId: row.id,
    itemKind: row.itemKind,
    itemId: row.itemId,
    itemAt: row.itemAt,
    action,
    signerRoleId: operatorRoleId,
    signedAt: nowSeconds()
  };
  const signature = await signCanonical(await ring.signKey(operatorRoleId), takedownCanon(facts));
  return call(`/workspace/report/${encodeURIComponent(row.id)}/decide`, {
    method: 'POST',
    body: JSON.stringify({
      action, secret: letter.secret, reasonCode,
      entry: { entryId: facts.entryId, sequence: facts.sequence, previousHash: facts.previousHash, signedAt: facts.signedAt, signature: toBase64Url(signature) }
    })
  });
}

/* -- Die Kette nachprüfen ------------------------------------------------------------ */

export interface LedgerRow {
  readonly sequence: number;
  readonly entryId: string;
  readonly previousHash: string;
  readonly entryHash: string;
  readonly reportId: string;
  readonly itemKind: string;
  readonly itemId: string;
  readonly itemAt: number | null;
  readonly action: TakedownAction;
  readonly signerRoleId: string;
  readonly signedAt: number;
  readonly signature: string;
  readonly recordedAt: string;
}

export const loadLedger = (): Promise<{ entries: readonly LedgerRow[]; head: ChainHead }> => call('/workspace/reports/ledger');

export interface LedgerCheck {
  readonly checked: number;
  /** `null`: alles hält. Sonst die erste Stelle, an der es bricht, in Worten. */
  readonly broken: string | null;
}

const factsOf = (row: LedgerRow): TakedownFacts => ({
  sequence: row.sequence, previousHash: row.previousHash, entryId: row.entryId, reportId: row.reportId,
  itemKind: row.itemKind, itemId: row.itemId, itemAt: row.itemAt, action: row.action, signerRoleId: row.signerRoleId, signedAt: row.signedAt
});

/**
 * Jedes Glied nachrechnen (Hash), jede Verbindung (hängt am vorigen) und jede
 * Unterschrift (öffentlicher Schlüssel der Rolle des Betreibers) — im Browser,
 * ohne dem Dienst zu glauben.
 */
export async function checkLedger(entries: readonly LedgerRow[], signPublicKey: string): Promise<LedgerCheck> {
  const rows = [...entries].sort((a, b) => a.sequence - b.sequence);
  const key = await crypto.subtle.importKey('spki', fromBase64Url(signPublicKey) as BufferSource, { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['verify']);
  let before: LedgerRow | null = null;
  for (const row of rows) {
    const facts = factsOf(row);
    if (await takedownHash(facts) !== row.entryHash) return { checked: rows.indexOf(row), broken: `Wpis ${row.sequence}: skrót się nie zgadza.` };
    if (before !== null && (row.sequence !== before.sequence + 1 || row.previousHash !== before.entryHash)) {
      return { checked: rows.indexOf(row), broken: `Wpis ${row.sequence} nie wisi na wpisie ${before.sequence}.` };
    }
    if (before === null && row.sequence === 1 && row.previousHash !== GENESIS_HASH) {
      return { checked: 0, broken: 'Pierwszy wpis nie zaczyna łańcucha.' };
    }
    const ok = await crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, key,
      fromBase64Url(row.signature) as BufferSource, new TextEncoder().encode(serialize(takedownCanon(facts))) as BufferSource);
    if (!ok) return { checked: rows.indexOf(row), broken: `Wpis ${row.sequence}: podpis się nie zgadza.` };
    before = row;
  }
  return { checked: rows.length, broken: null };
}

/* -- Der Verfasser ------------------------------------------------------------------- */

export interface MyTakedown {
  readonly id: string;
  readonly itemKind: ReportKind;
  readonly itemId: string;
  readonly state: 'blocked' | 'deleted';
  readonly reason: DecisionReason;
  readonly since: string;
  readonly path: string | null;
  readonly objectedAt: string | null;
  readonly objectUntil: string;
  readonly reportId: string;
}

export const loadMyTakedowns = (): Promise<{ takedowns: readonly MyTakedown[] }> => call('/workspace/takedowns');

/** Widersprechen — versiegelt für den Betreiber wie die Meldung, unter der Kennung der Meldung. */
export async function sendObjection(t: MyTakedown, text: string): Promise<{ objected: boolean }> {
  const op = await operatorKey();
  const { sealed, sealedKey } = await sealForOperator(op.wrapPublicKey, 'objection', t.reportId, { v: 1, text: text.trim(), sentAt: new Date().toISOString() });
  return call(`/workspace/takedown/${encodeURIComponent(t.id)}/objection`, { method: 'POST', body: JSON.stringify({ sealed, sealedKey }) });
}
