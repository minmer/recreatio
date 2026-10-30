/**
 * COGITA — LERNEN OHNE NETZ (COGITA.md §7, [E9, F21]).
 *
 * <b>Was das Gerät behält</b>: Abschriften der Fragen einer Wiederholung (die Karten, wie sie gerechnet wurden,
 * mit dem Plan), dazu, wer lernt (die Person: ihre Kennung und ihr öffentlicher Schlüssel) und wohin die Antworten
 * gehen. Je KONTO (2026-10-28), versiegelt unter dem Schlüssel dieses Geräts UND dem Schlüssel der Abschriften des
 * Kontos (`core/away.ts`, aus dem Hauptschlüssel): ohne Passwort öffnet sie niemand, auch nicht, wer das Telefon in
 * der Hand hat — ohne Netz nach der Anmeldung auf dem Gerät, mit Netz mit dem Schlüssel dieses Tabs.
 *
 * Antworten ohne Netz brauchen dagegen kein Geheimnis: sie werden für öffentliche Schlüssel versiegelt (`learn.ts`)
 * und warten in der Ablage, bis sie hinaus können. Was ohne Netz beantwortet wurde, kommt zusätzlich in die
 * Abschrift (`keepAnswers`) — sonst finge die nächste Runde ohne Netz wieder bei null an.
 *
 * <b>Der Browser behält von selbst ein paar</b> (die zuletzt geübten), die App so viele, wie man ihr sagt. Im
 * strengen Betrieb (`tab`) behält das Gerät nichts — dort lebt nicht einmal der Schlüssel länger als der Tab.
 */

import { awayKeyOf, copyPrefix, copySlot, dropAwayIfEmpty, keepAway } from '../core/away';
import { aad, derive, Field, fromBase64Url, KEY_SIZE, openText, sealText, toBase64Url } from '../core/crypto';
import { idbDelete, idbGet, idbKeys, idbPut } from '../core/idb';
import { device } from '../core/kept';
import { keepsKey, type Who } from '../core/session';
import type { Card } from './cardBasics';
import { gateFor, type RelSource } from './knowing';
import type { Dependency } from './knowness';
import type { AnswerRecord, Holder } from './learn';
import { readCondition } from './logic';
import { cardEntities, prerequisiteGraph } from './prerequisites';
import { readPlan, type Plan } from './revision';

export interface OfflineRevision {
  readonly libraryId: string;
  readonly revisionId: string;
  readonly name: string;
  /** Der Plan, wie ihn der Graph ergab — ohne die Karten (die stehen daneben); mit den Bedingungen der Karten (`when`, bis 2026-10-29 `gate`). */
  readonly plan: Readonly<Record<string, unknown>>;
  readonly cards: readonly Card[];
  readonly deps: readonly Dependency[];
  /**
   * Wohin die Antworten gehen, wenn das Netz wieder da ist. `intake` (2026-10-27): der öffentliche Schlüssel der
   * Annahme (Base64URL) — ohne ihn versiegelte Antworten liest der Kurs nie.
   */
  readonly target: { readonly areaId: string; readonly intake: string | null } | null;
  /** 2026-10-28 — wer lernt: die Person (Kennung, öffentlicher Schlüssel, Base64URL) — ohne Netz wird für sie versiegelt. */
  readonly holder: { readonly roleId: string; readonly wrapPublicKey: string } | null;
  /**
   * 2026-10-27 — was der Lernende zu diesen Karten schon beantwortet hat: ohne Netz lädt der Dienst nichts, und
   * ohne die Geschichte hielte „Najpierw podstawy" alles zurück, was schon sitzt. Nur zum Rechnen, nie gesendet.
   */
  readonly answers?: readonly AnswerRecord[];
  readonly savedAt: number;
}

/** Womit sich die Abschriften eines Kontos öffnen: das Konto und der Schlüssel seiner Abschriften (`core/away.ts`). */
export interface CopyKey {
  readonly accountId: string;
  readonly key: Uint8Array;
}

/** 2026-10-27 — eine Karte, deren Frage eine Datei zeigt (Bild, Ton): ohne Netz lässt sie sich nicht öffnen. */
export const needsFiles = (card: Card): boolean => card.prompt.some((p) => p.media !== undefined);

/**
 * 2026-10-27 — der Lauf aus einer Abschrift: der Plan MIT seinen Bedingungen (vorher fiel „Najpierw podstawy" weg).
 * 2026-10-30 — die Bedingungen der Karten liegen mit ihren aufgelösten Beziehungen im Plan (`when`); eine ältere
 * Abschrift mit der Sperre (`gate`) bekommt dieselbe Bedingung „to, co wcześniej" — aus ihren Abhängigkeiten gerechnet.
 */
export function offlineSource(copy: OfflineRevision): { plan: Plan; cards: readonly Card[]; deps: readonly Dependency[]; title: string } {
  const config = copy.plan;
  const condition = typeof config.gate === 'number' && config.when === undefined ? readCondition({ type: 'knowness', rel: 'before', op: 'ge', than: config.gate }) : null;
  if (condition !== null) {
    const graph = prerequisiteGraph(copy.deps);
    const askable = new Set(copy.cards.flatMap(cardEntities));
    const src: RelSource = { entity: () => undefined, look: { kind: () => undefined, entity: () => undefined }, graph, askable: (id) => askable.has(id), cardsOf: () => [] };
    const when = Object.fromEntries(copy.cards.map((c) => [c.key, gateFor(c, [[condition]], src)]));
    return { plan: readPlan(copy.cards, { ...config, order: config.order === 'given' ? 'given' : 'general' }, { when }), cards: copy.cards, deps: copy.deps, title: copy.name };
  }
  return { plan: readPlan(copy.cards, config), cards: copy.cards, deps: copy.deps, title: copy.name };
}

/**
 * 2026-10-28 — DER LERNENDE OHNE NETZ: die Person aus der Abschrift. Versiegelt wird mit ihrem öffentlichen
 * Schlüssel; der private bleibt zu (er liegt nicht auf dem Gerät) — was in der Ablage wartet, öffnet erst der Dienst.
 */
export function holderOfCopy(copy: OfflineRevision): Holder | null {
  if (copy.holder === null) return null;
  return {
    kind: 'role', roleId: copy.holder.roleId, wrapPublicKey: fromBase64Url(copy.holder.wrapPublicKey),
    wrapPrivate: () => Promise.reject(new Error('Bez internetu klucz prywatny osoby jest zamknięty.'))
  };
}

/** Die Antworten, die zu den Karten der Abschrift gehören (`rename`: zusammengeführte Einträge). */
export function answersFor(cards: readonly Card[], answers: Iterable<AnswerRecord>, rename?: (key: string) => string): AnswerRecord[] {
  const keys = new Set(cards.map((c) => c.key));
  return [...answers].filter((a) => keys.has(rename === undefined ? a.key : rename(a.key)));
}

/** Wie viele Wiederholungen der Browser von selbst behält; die App so viele, wie gewählt. */
export const BROWSER_KEEPS = 3;

const copyAad = (accountId: string, libraryId: string, revisionId: string) =>
  aad('cogita', 'offline', `${accountId}.${libraryId}.${revisionId}`, Field.CogitaOffline, 2);

/** Gerät UND Konto: der Schlüssel einer Abschrift folgt aus beiden — keiner allein öffnet sie. */
async function sealingKey(deviceKey: Uint8Array, awayKey: Uint8Array): Promise<Uint8Array> {
  const both = new Uint8Array(deviceKey.length + awayKey.length);
  both.set(deviceKey, 0);
  both.set(awayKey, deviceKey.length);
  return derive(both, 'recreatio:v1:cogita-offline', KEY_SIZE);
}

/** Versiegeln und öffnen — eigens, damit die Prüfung es ohne Ablage nachrechnet. */
export async function sealCopy(deviceKey: Uint8Array, by: CopyKey, copy: OfflineRevision): Promise<string> {
  return toBase64Url(await sealText(await sealingKey(deviceKey, by.key), copyAad(by.accountId, copy.libraryId, copy.revisionId), JSON.stringify(copy)));
}

export async function openCopy(deviceKey: Uint8Array, by: CopyKey, libraryId: string, revisionId: string, sealed: string): Promise<OfflineRevision> {
  return JSON.parse(await openText(await sealingKey(deviceKey, by.key), copyAad(by.accountId, libraryId, revisionId), fromBase64Url(sealed))) as OfflineRevision;
}

async function put(by: CopyKey, copy: OfflineRevision): Promise<boolean> {
  const on = await device().catch(() => null);
  if (on === null) return false;
  return idbPut('offline', copySlot(by.accountId, copy.libraryId, copy.revisionId),
    { sealed: await sealCopy(on.key, by, copy), savedAt: copy.savedAt, libraryId: copy.libraryId, revisionId: copy.revisionId, accountId: by.accountId });
}

/**
 * Eine Wiederholung für die Zeit ohne Netz ablegen — nur, wo das Konto seinen Schlüssel behält (`kept`) und dieser
 * Tab ihn hat. Legt (in der App) auch das Anmelden ohne Netz bereit (`keepAway`): ohne das bliebe die Abschrift
 * dort unerreichbar, wo sie gebraucht wird.
 */
export async function keepOffline(revision: OfflineRevision, who: Who, limit = BROWSER_KEEPS): Promise<boolean> {
  if (!keepsKey(who)) return false;
  const key = await awayKeyOf(who);
  if (key === null) return false;
  const ok = await put({ accountId: who.accountId, key }, revision);
  if (!ok) return false;
  await keepAway(who).catch(() => undefined);
  await trim(who.accountId, limit);
  return true;
}

/** 2026-10-28 — was ohne Netz beantwortet wurde, in die Abschrift: die nächste Runde ohne Netz rechnet damit. */
export async function keepAnswers(by: CopyKey, copy: OfflineRevision, answers: readonly AnswerRecord[]): Promise<boolean> {
  return put(by, { ...copy, answers: answersFor(copy.cards, answers) });
}

/** Die ältesten fallen weg, wenn es mehr sind als erlaubt — je Konto. Abschriften der alten Form (ohne Konto) ebenso. */
async function trim(accountId: string, limit: number): Promise<void> {
  for (const key of await idbKeys('offline')) {
    if (!key.startsWith('copy:') && !key.startsWith('account:')) await idbDelete('offline', key);
  }
  const rows: { key: string; savedAt: number }[] = [];
  for (const key of await idbKeys('offline', copyPrefix(accountId))) {
    const one = await idbGet<{ savedAt: number }>('offline', key);
    if (one !== null) rows.push({ key, savedAt: one.savedAt });
  }
  rows.sort((a, b) => b.savedAt - a.savedAt);
  for (const old of rows.slice(Math.max(1, limit))) await idbDelete('offline', old.key);
}

/** Eine abgelegte Wiederholung öffnen — `null`: keine, oder nicht von diesem Gerät und Konto. */
export async function openOffline(by: CopyKey, libraryId: string, revisionId: string): Promise<OfflineRevision | null> {
  const stored = await idbGet<{ sealed: string }>('offline', copySlot(by.accountId, libraryId, revisionId));
  if (stored === null) return null;
  const on = await device().catch(() => null);
  if (on === null) return null;
  try {
    return await openCopy(on.key, by, libraryId, revisionId, stored.sealed);
  } catch {
    return null;
  }
}

/** Was für ein Konto abgelegt ist — für die Liste „bez internetu" (ohne zu öffnen). */
export async function offlineList(accountId: string): Promise<{ libraryId: string; revisionId: string; savedAt: number }[]> {
  const out: { libraryId: string; revisionId: string; savedAt: number }[] = [];
  for (const key of await idbKeys('offline', copyPrefix(accountId))) {
    const one = await idbGet<{ libraryId: string; revisionId: string; savedAt: number }>('offline', key);
    if (one !== null) out.push({ libraryId: one.libraryId, revisionId: one.revisionId, savedAt: one.savedAt });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/** Eine Abschrift löschen — war es die letzte des Kontos, geht auch das Anmelden ohne Netz. */
export async function dropOffline(accountId: string, libraryId: string, revisionId: string): Promise<void> {
  await idbDelete('offline', copySlot(accountId, libraryId, revisionId));
  await dropAwayIfEmpty(accountId);
}

/** Gibt es gerade Netz? Der Browser weiss es nur ungefähr — ein Fehlschlag beim Laden sagt es genauer. */
export const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;
