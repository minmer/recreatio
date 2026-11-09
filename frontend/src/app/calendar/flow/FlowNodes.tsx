/**
 * 2026-10-26 — DIE KNOTEN DER ABLÄUFE: wie sie aussehen (`FlowNodeFace`), was
 * sie in einer Zeile sagen (`nodeSummary`), womit ein neuer anfängt
 * (`defaultData`), und die Wörter, die der Editor überall braucht.
 *
 * Ein Knoten zeigt seine Art und eine Zeile über seine Daten — wer die Karte
 * liest, soll den Ablauf verstehen, ohne jeden Knoten aufzumachen. Eingänge
 * stehen links (ausser an den Anfängen), Ausgänge rechts: einer („dalej") oder
 * zwei („tak" oben, „nie" unten).
 */

import { Handle, Position, type NodeProps } from 'reactflow';

import type { RecordList, SchemeChoice, SchemeField } from '../scheme';
import { fmtDate, t, texts, useT, type Lang } from '../../core/i18n';
import {
  NODE_INFO, SEASON_LABEL,
  type Compare, type DateRule, type FeastsData, type FlowNode, type FlowNodeType, type IfData, type MessageData,
  type RecordData, type SeasonData, type SetData, type SlotRow, type SlotsData, type Test, type Weekday
} from './flowModel';

/* -- Wörter ----------------------------------------------------------------------------- */

export const WEEKDAY_SHORT: Record<Weekday, string> = texts({
  1: 'calendarApp.flow.dayShort.d1', 2: 'calendarApp.flow.dayShort.d2', 3: 'calendarApp.flow.dayShort.d3', 4: 'calendarApp.flow.dayShort.d4',
  5: 'calendarApp.flow.dayShort.d5', 6: 'calendarApp.flow.dayShort.d6', 7: 'calendarApp.flow.dayShort.d7'
}) as unknown as Record<Weekday, string>;
export const WEEKDAY_NAME: Record<Weekday, string> = texts({
  1: 'calendarApp.flowUi.day.d1', 2: 'calendarApp.flowUi.day.d2', 3: 'calendarApp.flowUi.day.d3', 4: 'calendarApp.flowUi.day.d4',
  5: 'calendarApp.flowUi.day.d5', 6: 'calendarApp.flowUi.day.d6', 7: 'calendarApp.flowUi.day.d7'
}) as unknown as Record<Weekday, string>;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Die Monate im Nominativ („styczeń") — aus `Intl`, in der Sprache des Editors. */
export const monthNames = (lang?: Lang): string[] =>
  Array.from({ length: 12 }, (_, i) => fmtDate(new Date(2000, i, 15), { month: 'long' }, lang));
export const MONTH_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Die Ränge — die Tabelle der liturgischen Tage (Normy roku liturgicznego,
 * nr 59), kurz gefasst. 1 ist der höchste.
 */
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
const byRank = (group: string): Record<number, string> =>
  texts(Object.fromEntries(RANKS.map((n) => [String(n), `calendarApp.flowUi.${group}.r${n}`]))) as unknown as Record<number, string>;

export const RANK_LABEL: Record<number, string> = byRank('rank');

/** Kurz, für eine Zeile: „uroczystość", „święto" … */
export const RANK_SHORT: Record<number, string> = byRank('rankShort');

export const SPECIAL_LABEL: Record<'gaudete' | 'laetare' | 'palm' | 'goodFriday' | 'pentecost', string> = texts({
  gaudete: 'calendarApp.flowUi.special.gaudete',
  laetare: 'calendarApp.flowUi.special.laetare',
  palm: 'calendarApp.flowUi.special.palm',
  goodFriday: 'calendarApp.flowUi.special.goodFriday',
  pentecost: 'calendarApp.flowUi.special.pentecost'
});

export const COMPARE_LABEL: Record<Compare, string> = { '<': '<', '<=': '≤', '=': '=', '>=': '≥', '>': '>', '!=': '≠' };
export const COMPARES: readonly Compare[] = ['<', '<=', '=', '>=', '>', '!='];

export { PLAN_TESTS, RULE_TESTS } from './flowModel';

const TESTS: readonly Test['t'][] = ['weekday', 'slot', 'time', 'season', 'week', 'rank', 'celebration', 'festive', 'sunday', 'date', 'between', 'var', 'mode', 'count', 'actor', 'field'];
export const TEST_LABEL: Record<Test['t'], string> =
  texts(Object.fromEntries(TESTS.map((k) => [k, `calendarApp.flowUi.testLabel.${k}`]))) as unknown as Record<Test['t'], string>;

/** Was in Texten stehen darf und von selbst ersetzt wird (`says`: `calendarApp.flowUi.placeholder.<name>`). */
export const PLACEHOLDERS: readonly { readonly token: string; readonly says: string }[] =
  ['celebration', 'title', 'sundayName', 'seasonName', 'season', 'week', 'weekRoman', 'colour', 'date', 'time', 'slot']
    .map((name) => ({ token: `{${name}}`, get says() { return t(`calendarApp.flowUi.placeholder.${name}`); } }));

/* -- Was eine Regel für ein Datum sagt ---------------------------------------------------- */

const signed = (n: number) => (n === 0 ? '' : n > 0 ? ` +${n}` : ` −${-n}`);

/* Benannte Tage um Ostern und den Advent: `calendarApp.flowUi.easter.o<offset>` (m statt Minus). */
const EASTER_OFFSETS = [-46, -7, -3, -2, -1, 0, 1, 7, 42, 49, 50, 56, 60, 68, 69];
const ADVENT_OFFSETS = [-7, 0, 7, 14, 21];
const offsetKey = (group: string, n: number) => `calendarApp.flowUi.${group}.o${n < 0 ? `m${-n}` : n}`;
const named = (group: string, offsets: readonly number[], n: number): string | undefined =>
  offsets.includes(n) ? t(offsetKey(group, n)) : undefined;

/** Die bekannten Tage um Ostern und den Advent — zur Auswahl im Editor. */
export const EASTER_PRESETS: readonly { readonly offset: number; readonly label: string }[] =
  EASTER_OFFSETS.map((offset) => ({ offset, get label() { return t(offsetKey('easter', offset)); } }));
export const ADVENT_PRESETS: readonly { readonly offset: number; readonly label: string }[] =
  ADVENT_OFFSETS.map((offset) => ({ offset, get label() { return t(offsetKey('advent', offset)); } }));

export const NTH_LABEL: Record<string, string> = texts({
  1: 'calendarApp.flowUi.nth.n1', 2: 'calendarApp.flowUi.nth.n2', 3: 'calendarApp.flowUi.nth.n3', 4: 'calendarApp.flowUi.nth.n4',
  5: 'calendarApp.flowUi.nth.n5', [-1]: 'calendarApp.flowUi.nth.last'
});

export function ruleSummary(rule: DateRule): string {
  switch (rule.r) {
    case 'fixed': return `${rule.day} ${MONTH_ROMAN[rule.month - 1] ?? '?'}`;
    case 'easter': return named('easter', EASTER_OFFSETS, rule.offset) ?? t('calendarApp.flowUi.summary.easterShift', { shift: signed(rule.offset) });
    case 'advent': return named('advent', ADVENT_OFFSETS, rule.offset) ?? t('calendarApp.flowUi.summary.adventShift', { shift: signed(rule.offset) });
    case 'christmas-sunday': return t('calendarApp.flowUi.summary.holyFamily');
    case 'baptism': return t('calendarApp.flowUi.summary.baptism');
    case 'nth-weekday': return rule.month === undefined
      ? t('calendarApp.flowUi.summary.nthEvery', { which: NTH_LABEL[String(rule.n)] ?? rule.n, weekday: WEEKDAY_SHORT[rule.weekday] })
      : t('calendarApp.flowUi.summary.nthOf', { which: NTH_LABEL[String(rule.n)] ?? rule.n, weekday: WEEKDAY_SHORT[rule.weekday], month: MONTH_ROMAN[rule.month - 1] ?? '' });
    case 'sunday-after': return t('calendarApp.flowUi.summary.sundayAfter', { day: rule.day, month: MONTH_ROMAN[rule.month - 1] ?? '?' });
  }
}

/** „MM-DD" → „17 XII". */
export function monthDay(text: string): string {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(text.trim());
  if (m === null) return text || '?';
  return `${Number(m[2])} ${MONTH_ROMAN[Number(m[1]) - 1] ?? '?'}`;
}

const listOf = (items: readonly string[], max = 4) =>
  items.length <= max ? items.join(', ') : `${items.slice(0, max).join(', ')} … (+${items.length - max})`;

export function testSummary(test: Test, modes?: readonly SchemeChoice[]): string {
  const S = 'calendarApp.flowUi.summary.';
  const pick = t(`${S}pick`);
  const modeWord = (m?: string) => (m === undefined || m === '' ? t(`${S}anyMode`) : modes?.find((x) => x.value === m)?.label ?? m);
  switch (test.t) {
    case 'weekday': return t(`${S}weekday`, { list: test.days.length === 0 ? pick : test.days.map((d) => WEEKDAY_SHORT[d]).join(', ') });
    case 'slot': return t(`${S}slot`, { list: test.keys.length === 0 ? pick : listOf(test.keys) });
    case 'time': return t(`${S}time`, { from: test.from ?? '00:00', to: test.to ?? '24:00' });
    case 'season': return t(`${S}season`, { list: test.seasons.length === 0 ? pick : listOf(test.seasons.map((s) => SEASON_LABEL[s]), 2) });
    case 'week': return t(`${S}week`, { op: COMPARE_LABEL[test.op], n: test.n });
    case 'rank': return t(`${S}rank`, { op: COMPARE_LABEL[test.op], n: test.n, rank: RANK_SHORT[test.n] ?? '?' });
    case 'celebration': return test.is === 'any' ? t(`${S}celebrationAny`) : test.is === 'none' ? t(`${S}celebrationNone`) : t(`${S}celebrationName`, { name: test.name ?? '' });
    case 'festive': return t(`${S}festive`);
    case 'sunday': return t('calendarApp.flow.test.sunday');
    case 'date': return t(`${S}date`, { rule: ruleSummary(test.rule) });
    case 'between': return t(`${S}between`, { from: monthDay(test.from), to: monthDay(test.to) });
    case 'var': return test.op === 'contains' ? t(`${S}varContains`, { name: test.name || '?', value: test.value })
      : `${test.name || '?'} ${test.op === '=' ? '=' : '≠'} „${test.value}”`;
    case 'mode': return t(`${S}mode`, { list: test.modes.length === 0 ? pick : test.modes.map((m) => modeWord(m)).join(', ') });
    case 'count': {
      const where = t(test.scope === 'occurrence' ? `${S}countHere` : test.per === 'occurrence' ? `${S}countOthers` : `${S}countWeek`);
      return `${where}: ${modeWord(test.mode)}${test.status === 'all' ? ` ${t(`${S}countAll`)}` : ''} ${COMPARE_LABEL[test.op]} ${test.n}`;
    }
    case 'actor': return test.is === 'office' ? t('calendarApp.flow.test.actorOffice') : t('calendarApp.flow.test.actorOutside');
    case 'field': return test.op === 'set' ? t(`${S}fieldSet`, { key: test.key || '?' }) : test.op === 'empty' ? t(`${S}fieldEmpty`, { key: test.key || '?' })
      : `${t(`${S}field`, { key: test.key || '?' })} = „${test.value ?? ''}”`;
  }
}

const times = (rows: readonly SlotRow[]) => rows.map((r) => r.time).join(', ') || '—';

/** Was ein Knoten in einer Zeile sagt. */
export function nodeSummary(node: FlowNode, ctx: { fields?: readonly SchemeField[]; lists?: readonly RecordList[]; modes?: readonly SchemeChoice[] }): string {
  const d = node.data;
  switch (node.type) {
    case 'season': {
      const c = (d as unknown as SeasonData).colours ?? {};
      const filled = Object.values(c).filter((v) => (v ?? '') !== '').length;
      return filled === 0 ? t('calendarApp.flowUi.node.seasonEmpty') : t('calendarApp.flowUi.node.seasonFilled', { count: filled });
    }
    case 'feasts': {
      const rows = (d as unknown as FeastsData).rows ?? [];
      return rows.length === 0 ? t('calendarApp.flowUi.node.feastsEmpty')
        : `${t('calendarApp.flowUi.node.feasts', { count: rows.length })}: ${listOf(rows.slice(0, 2).map((r) => r.name || t('calendarApp.flowUi.node.noName')), 2)}${rows.length > 2 ? ' …' : ''}`;
    }
    case 'if': return (d as unknown as IfData).test === undefined ? t('calendarApp.flowUi.node.noTest') : testSummary((d as unknown as IfData).test, ctx.modes);
    case 'set': {
      const s = d as unknown as SetData;
      const field = s.target === 'field' ? ctx.fields?.find((f) => f.key === s.key)?.label ?? s.key ?? '?' : '';
      const what = s.target === 'title' ? t('calendarApp.flow.trace.title') : s.target === 'field' ? t('calendarApp.flowUi.node.field', { field }) : t('calendarApp.flowUi.node.variable', { name: s.key || '?' });
      return `${what} = ${s.value || '…'}`;
    }
    case 'slots': {
      const s = d as unknown as SlotsData;
      return t('calendarApp.flowUi.node.slots', { festive: times(s.festive ?? []), weekdays: times(s.weekdays ?? []) });
    }
    case 'record': {
      const r = d as unknown as RecordData;
      const list = ctx.lists?.find((l) => l.key === r.list);
      const mode = r.mode === undefined || r.mode === '' ? '' : ` (${list?.modes?.find((m) => m.value === r.mode)?.label ?? r.mode})`;
      return `${list?.label ?? r.list ?? '?'}: „${r.text || '…'}”${mode}`;
    }
    case 'allow':
    case 'wait':
    case 'refuse': return ((d as unknown as MessageData).message ?? '').trim() || (node.type === 'refuse' ? t('calendarApp.flowUi.node.message') : '');
    default: return '';
  }
}

/** Womit ein neuer Knoten anfängt. */
export function defaultData(type: FlowNodeType, kind: 'plan' | 'rule', lists?: readonly RecordList[]): Record<string, unknown> {
  switch (type) {
    case 'season': return {
      colours: { adwent: 'fioletowy', narodzenie: 'biały', zwykly: 'zielony', post: 'fioletowy', triduum: 'biały', wielkanoc: 'biały' }, // i18n-ignore — Werte der Wahl „kolor“ (Daten)
      special: { gaudete: 'różowy', laetare: 'różowy', palm: 'czerwony', goodFriday: 'czerwony', pentecost: 'czerwony' } // i18n-ignore — Werte der Wahl „kolor“ (Daten)
    } satisfies SeasonData;
    case 'feasts': return { rows: [] };
    case 'if': return { test: kind === 'plan' ? { t: 'weekday', days: [7] } : { t: 'mode', modes: [] } };
    case 'set': return { target: 'title', value: '{title}' };
    case 'slots': return { festive: [], weekdays: [] };
    case 'record': return { list: lists?.[0]?.key ?? 'intencje', text: '' };
    case 'wait': return { message: t('calendarApp.flowUi.node.waitDefault') };
    case 'refuse': return { message: '' };
    default: return {};
  }
}

/** Die Rolle eines Knotens — für Form und Farbe auf der Karte. */
export function roleOf(type: FlowNodeType): 'entry' | 'test' | 'act' | 'end' {
  if (NODE_INFO[type].entry === true) return 'entry';
  if (type === 'if') return 'test';
  return NODE_INFO[type].outs.length === 0 ? 'end' : 'act';
}

/* -- Ein Knoten auf der Karte ------------------------------------------------------------- */

export interface FaceData {
  readonly node: FlowNode;
  readonly summary: string;
  /** Was an ihm nicht stimmt (ein fehlender Ausgang …). */
  readonly problem: string | null;
}

export function FlowNodeFace({ data, selected }: NodeProps<FaceData>) {
  const t = useT();
  const { node, summary, problem } = data;
  const info = NODE_INFO[node.type];
  const role = roleOf(node.type);
  const two = info.outs.includes('yes');

  return (
    <div className={`wk-fnode is-${role}${selected ? ' is-on' : ''}${problem !== null ? ' has-problem' : ''}`} title={problem ?? info.says}>
      {role !== 'entry' && <Handle id="in" type="target" position={Position.Left} className="wk-fhandle" />}
      <span className="wk-fnode-kind">{info.label}</span>
      {summary !== '' && <span className="wk-fnode-sum">{summary}</span>}
      {problem !== null && <span className="wk-fnode-problem">{problem}</span>}
      {two ? (
        <>
          <Handle id="yes" type="source" position={Position.Right} className="wk-fhandle wk-fhandle-yes" />
          <span className="wk-fhandle-tag wk-fhandle-tag-yes" aria-hidden="true">{t('calendarApp.flow.out.yes')}</span>
          <Handle id="no" type="source" position={Position.Right} className="wk-fhandle wk-fhandle-no" />
          <span className="wk-fhandle-tag wk-fhandle-tag-no" aria-hidden="true">{t('calendarApp.flow.out.no')}</span>
        </>
      ) : info.outs.includes('out') && (
        <Handle id="out" type="source" position={Position.Right} className="wk-fhandle" />
      )}
    </div>
  );
}

export const FLOW_NODE_TYPES = { flow: FlowNodeFace };
