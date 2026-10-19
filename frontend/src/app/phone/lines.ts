/**
 * Z KTÓREGO NUMERU (2026-10-19) — ein Telefon mit zwei Karten: eine Nummer für alle,
 * die andere nur für eine Gruppe von Menschen. Für ein Gespräch gilt, in dieser Folge:
 *
 * <code>
 *   1. die Wahl im Kopf des Gesprächs              sms.threadLines {Gespräch: Nummer}
 *   2. eine Gruppe (Kontakty) mit eigener Nummer     sms.groupLines  {Gruppe: Nummer}
 *   3. die Karte, über die zuletzt etwas von dort kam
 *   4. die Karte, die das Telefon für SMS nimmt
 * </code>
 *
 * Gemerkt wird die NUMMER, am Konto — auf jedem Telefon dieselbe Regel; welche Karte
 * sie trägt, sagt das Telefon (`Phone.lines`). Eine Karte, deren Nummer niemand kennt,
 * heisst `sim:<Steckplatz>`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRemembered } from '../core/prefs';
import type { Who } from '../core/session';
import { loadContacts, nameIndex, type Contact } from './contactStore';
import { Phone, phoneHere, type Line } from './native';
import { phoneKey, phoneShown } from './numbers';
import { openPhone } from './phoneContext';
import { conversationKey } from './smsArchive';

export const GROUP_LINES = 'sms.groupLines';
export const THREAD_LINES = 'sms.threadLines';

export type LineRules = Readonly<Record<string, string>>;

/** Tolerant gelesen: was keine Zeichenkette ist, fällt weg. */
export function readRules(text: string): LineRules {
  try {
    const o = JSON.parse(text) as unknown;
    if (o === null || typeof o !== 'object' || Array.isArray(o)) return {};
    return Object.fromEntries(Object.entries(o as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && e[0] !== ''));
  } catch {
    return {};
  }
}

/** Wie eine Karte in den Regeln heisst: ihre Nummer, sonst ihr Steckplatz. */
export const lineKeyOf = (l: Pick<Line, 'number' | 'slot'>): string => {
  const k = phoneKey(l.number);
  return k !== '' ? k : `sim:${l.slot}`;
};

export const findLine = (lines: readonly Line[], key: string | null | undefined): Line | null =>
  key === null || key === undefined || key === '' ? null : lines.find((l) => lineKeyOf(l) === key) ?? null;

export const lineName = (l: Pick<Line, 'name' | 'slot'>): string => (l.name.trim() !== '' ? l.name.trim() : `SIM ${l.slot + 1}`);

/** „Alternatywa · +48 505 548 677". */
export const lineText = (l: Pick<Line, 'name' | 'slot' | 'number'>): string =>
  `${lineName(l)} · ${l.number !== null && l.number !== '' ? phoneShown(l.number) : 'numer nieznany'}`;

export type LineWhy = 'thread' | 'group' | 'last' | 'default';

export interface LineChoice {
  readonly line: Line | null;
  readonly why: LineWhy;
  /** Bei `group`: welche Gruppe. */
  readonly group: string | null;
}

/** DIE KARTE FÜR EIN GESPRÄCH — nach der Folge oben. */
export function chooseLine(o: {
  readonly peers: readonly string[];
  readonly lines: readonly Line[];
  /** phoneKey → Kontakt (nur seine Gruppen zählen). */
  readonly contacts: ReadonlyMap<string, { readonly groups: readonly string[] }>;
  readonly groupRules: LineRules;
  readonly threadRules: LineRules;
  readonly lastSub?: number | null;
  readonly defaultSub?: number | null;
}): LineChoice {
  const own = findLine(o.lines, o.threadRules[conversationKey(o.peers)]);
  if (own !== null) return { line: own, why: 'thread', group: null };
  for (const peer of o.peers) {
    for (const group of o.contacts.get(phoneKey(peer))?.groups ?? []) {
      const line = findLine(o.lines, o.groupRules[group]);
      if (line !== null) return { line, why: 'group', group };
    }
  }
  const last = o.lastSub === null || o.lastSub === undefined ? null : o.lines.find((l) => l.subId === o.lastSub) ?? null;
  if (last !== null) return { line: last, why: 'last', group: null };
  return { line: o.lines.find((l) => l.subId === o.defaultSub) ?? o.lines[0] ?? null, why: 'default', group: null };
}

/**
 * IM BROWSER (keine Karten): welche eigene Nummer die Regeln einem Gespräch geben — seine
 * Wahl, sonst die seiner Gruppe. Nur Regeln mit einer Nummer; `sim:…` kennt nur das Telefon.
 */
export function ruledNumber(o: {
  readonly peers: readonly string[];
  readonly contacts: ReadonlyMap<string, { readonly groups: readonly string[] }>;
  readonly groupRules: LineRules;
  readonly threadRules: LineRules;
}): { readonly number: string; readonly why: 'thread' | 'group'; readonly group: string | null } | null {
  const numbered = (key: string | undefined): string | null => (key !== undefined && key !== '' && !key.startsWith('sim:') ? key : null);
  const own = numbered(o.threadRules[conversationKey(o.peers)]);
  if (own !== null) return { number: own, why: 'thread', group: null };
  for (const peer of o.peers) {
    for (const group of o.contacts.get(phoneKey(peer))?.groups ?? []) {
      const number = numbered(o.groupRules[group]);
      if (number !== null) return { number, why: 'group', group };
    }
  }
  return null;
}

/** Warum diese Karte — für den Kopf des Gesprächs. */
export const whyText = (c: LineChoice): string =>
  c.why === 'thread' ? 'wybrany dla tej rozmowy'
    : c.why === 'group' ? `grupa „${c.group ?? ''}”`
    : c.why === 'last' ? 'stąd przyszła ostatnia wiadomość'
    : 'domyślny numer SMS';

/* -- Woher die Teile kommen ------------------------------------------------------------------------ */

/**
 * Über welche Karte zuletzt etwas von dieser einen Nummer kam (Folge 3) — für ein Blatt
 * ausserhalb des Gesprächs. Sucht das Gespräch nur, legt keines an.
 */
export async function lastSubOf(number: string): Promise<number | null> {
  const key = phoneKey(number);
  if (key === '') return null;
  const { threads } = await Phone.threads({ limit: 500 });
  const thread = threads.find((t) => t.addresses.length === 1 && phoneKey(t.addresses[0]) === key);
  if (thread === undefined) return null;
  const { messages } = await Phone.messages({ threadId: thread.threadId, limit: 30 });
  return [...messages].reverse().find((m) => m.box === 'in' && m.subId !== null)?.subId ?? null;
}

let linesSeen: readonly Line[] | null = null;

/** Die eigenen Karten dieses Telefons (im Browser keine). */
export function usePhoneLines(): readonly Line[] {
  const [lines, setLines] = useState<readonly Line[]>(linesSeen ?? []);
  useEffect(() => {
    if (!phoneHere()) return undefined;
    let alive = true;
    void Phone.lines().then((r) => { linesSeen = r.lines; if (alive) setLines(r.lines); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return lines;
}

const contactsSeen = new Map<string, { readonly at: number; readonly list: Promise<readonly Contact[]> }>();

/** Die Kontakte — zwei Minuten aus dem Speicher; `forgetContacts` nach einer Änderung. */
export function contactsOf(who: Who): Promise<readonly Contact[]> {
  const had = contactsSeen.get(who.accountId);
  if (had !== undefined && Date.now() - had.at < 120_000) return had.list;
  const list = openPhone(who).then(loadContacts);
  contactsSeen.set(who.accountId, { at: Date.now(), list });
  list.catch(() => contactsSeen.delete(who.accountId));
  return list;
}

export const forgetContacts = (): void => { contactsSeen.clear(); };

/** phoneKey → Kontakt — für Namen und Gruppen. */
export function useContactIndex(who: Who): ReadonlyMap<string, Contact> {
  const [index, setIndex] = useState<ReadonlyMap<string, Contact>>(new Map());
  useEffect(() => {
    let alive = true;
    void contactsOf(who).then((list) => { if (alive) setIndex(nameIndex([...list])); }).catch(() => undefined);
    return () => { alive = false; };
  }, [who]);
  return index;
}

/** Die Regeln (am Konto) — lesen und ändern. */
export function useLineRules() {
  const [groupText, setGroupText] = useRemembered(GROUP_LINES, '{}');
  const [threadText, setThreadText] = useRemembered(THREAD_LINES, '{}');
  const groupRules = useMemo(() => readRules(groupText), [groupText]);
  const threadRules = useMemo(() => readRules(threadText), [threadText]);
  /** Die Nummer einer Gruppe — `renamedFrom`: so hiess sie vorher (deren Regel fällt weg). */
  const setGroupRule = useCallback((group: string, key: string | null, renamedFrom?: string) => {
    const next = { ...readRules(groupText) };
    if (renamedFrom !== undefined && renamedFrom !== group) delete next[renamedFrom];
    if (key === null) delete next[group]; else next[group] = key;
    setGroupText(JSON.stringify(next));
  }, [groupText, setGroupText]);
  const setThreadRule = useCallback((peers: readonly string[], key: string | null) => {
    const next = { ...readRules(threadText) };
    const conversation = conversationKey(peers);
    if (key === null) delete next[conversation]; else next[conversation] = key;
    setThreadText(JSON.stringify(next));
  }, [threadText, setThreadText]);
  return { groupRules, threadRules, setGroupRule, setThreadRule };
}
