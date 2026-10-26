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
import {
  NODE_INFO, SEASON_LABEL,
  type Compare, type DateRule, type FeastsData, type FlowNode, type FlowNodeType, type IfData, type MessageData,
  type RecordData, type SeasonData, type SetData, type SlotRow, type SlotsData, type Test, type Weekday
} from './flowModel';

/* -- Wörter ----------------------------------------------------------------------------- */

export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'pn', 2: 'wt', 3: 'śr', 4: 'czw', 5: 'pt', 6: 'sob', 7: 'nd' };
export const WEEKDAY_NAME: Record<Weekday, string> = {
  1: 'poniedziałek', 2: 'wtorek', 3: 'środa', 4: 'czwartek', 5: 'piątek', 6: 'sobota', 7: 'niedziela'
};
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export const MONTH_NAME = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
export const MONTH_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/**
 * Die Ränge — die Tabelle der liturgischen Tage (Normy roku liturgicznego,
 * nr 59), kurz gefasst. 1 ist der höchste.
 */
export const RANK_LABEL: Record<number, string> = {
  1: 'Triduum Paschalne',
  2: 'Największe dni (Boże Narodzenie, Objawienie, Wniebowstąpienie, Zesłanie; niedziele Adwentu, Postu, Wielkanocy; Popielec; Wielki Tydzień; oktawa Wielkanocy)',
  3: 'Uroczystości z kalendarza ogólnego, Zaduszki',
  4: 'Uroczystości własne (patron, tytuł i rocznica poświęcenia kościoła)',
  5: 'Święta Pańskie',
  6: 'Niedziele zwykłe i okresu Narodzenia',
  7: 'Święta z kalendarza ogólnego',
  8: 'Święta własne (patron diecezji, rocznica poświęcenia katedry)',
  9: 'Dni uprzywilejowane (17–24 XII, oktawa Narodzenia, dni Wielkiego Postu)',
  10: 'Wspomnienia obowiązkowe',
  11: 'Wspomnienia obowiązkowe własne',
  12: 'Wspomnienia dowolne',
  13: 'Dni powszednie'
};

/** Kurz, für eine Zeile: „uroczystość", „święto" … */
export const RANK_SHORT: Record<number, string> = {
  1: 'Triduum', 2: 'najwyższa', 3: 'uroczystość', 4: 'uroczystość własna', 5: 'święto Pańskie', 6: 'niedziela',
  7: 'święto', 8: 'święto własne', 9: 'dzień uprzywilejowany', 10: 'wspomnienie obow.', 11: 'wspomnienie własne',
  12: 'wspomnienie dowolne', 13: 'dzień powszedni'
};

export const SPECIAL_LABEL: Record<'gaudete' | 'laetare' | 'palm' | 'goodFriday' | 'pentecost', string> = {
  gaudete: 'III Niedziela Adwentu (Gaudete)',
  laetare: 'IV Niedziela Wielkiego Postu (Laetare)',
  palm: 'Niedziela Palmowa',
  goodFriday: 'Wielki Piątek',
  pentecost: 'Zesłanie Ducha Świętego'
};

export const COMPARE_LABEL: Record<Compare, string> = { '<': '<', '<=': '≤', '=': '=', '>=': '≥', '>': '>', '!=': '≠' };
export const COMPARES: readonly Compare[] = ['<', '<=', '=', '>=', '>', '!='];

export { PLAN_TESTS, RULE_TESTS } from './flowModel';

export const TEST_LABEL: Record<Test['t'], string> = {
  weekday: 'Dzień tygodnia',
  slot: 'Która msza (klucz godziny)',
  time: 'Godzina mszy między',
  season: 'Okres liturgiczny',
  week: 'Tydzień okresu',
  rank: 'Ranga dnia',
  celebration: 'Obchód dnia',
  festive: 'Niedziela albo święto nakazane',
  sunday: 'Niedziela',
  date: 'Data (reguła)',
  between: 'Między datami w roku',
  var: 'Zmienna',
  mode: 'Rodzaj wpisu',
  count: 'Liczba wpisów',
  actor: 'Kto dodaje',
  field: 'Pole wpisu'
};

/** Was in Texten stehen darf und von selbst ersetzt wird. */
export const PLACEHOLDERS: readonly { readonly token: string; readonly says: string }[] = [
  { token: '{celebration}', says: 'obchód dnia' },
  { token: '{title}', says: 'tytuł mszy (z obchodu)' },
  { token: '{sundayName}', says: 'nazwa niedzieli, np. III Niedziela Adwentu' },
  { token: '{seasonName}', says: 'nazwa okresu' },
  { token: '{season}', says: 'okres (klucz)' },
  { token: '{week}', says: 'tydzień okresu' },
  { token: '{weekRoman}', says: 'tydzień rzymską liczbą' },
  { token: '{colour}', says: 'kolor' },
  { token: '{date}', says: 'data' },
  { token: '{time}', says: 'godzina mszy' },
  { token: '{slot}', says: 'klucz godziny' }
];

/* -- Was eine Regel für ein Datum sagt ---------------------------------------------------- */

const signed = (n: number) => (n === 0 ? '' : n > 0 ? ` +${n}` : ` −${-n}`);

const EASTER_NAMED: Record<number, string> = {
  [-46]: 'Popielec', [-7]: 'Niedziela Palmowa', [-3]: 'Wielki Czwartek', [-2]: 'Wielki Piątek', [-1]: 'Wielka Sobota',
  0: 'Wielkanoc', 1: 'Poniedziałek Wielkanocny', 7: 'Niedziela Miłosierdzia', 42: 'Wniebowstąpienie (PL)', 49: 'Zesłanie Ducha Świętego',
  50: 'NMP Matki Kościoła', 56: 'Trójcy Przenajświętszej', 60: 'Boże Ciało', 68: 'Najświętsze Serce Pana Jezusa', 69: 'Niepokalane Serce NMP'
};
const ADVENT_NAMED: Record<number, string> = {
  [-7]: 'Chrystusa Króla', 0: 'I Niedziela Adwentu', 7: 'II Niedziela Adwentu', 14: 'III Niedziela Adwentu', 21: 'IV Niedziela Adwentu'
};

/** Die bekannten Tage um Ostern und den Advent — zur Auswahl im Editor. */
export const EASTER_PRESETS: readonly { readonly offset: number; readonly label: string }[] =
  Object.entries(EASTER_NAMED).map(([k, label]) => ({ offset: Number(k), label })).sort((a, b) => a.offset - b.offset);
export const ADVENT_PRESETS: readonly { readonly offset: number; readonly label: string }[] =
  Object.entries(ADVENT_NAMED).map(([k, label]) => ({ offset: Number(k), label })).sort((a, b) => a.offset - b.offset);

export const NTH_LABEL: Record<string, string> = { 1: 'pierwszy', 2: 'drugi', 3: 'trzeci', 4: 'czwarty', 5: 'piąty', [-1]: 'ostatni' };

export function ruleSummary(rule: DateRule): string {
  switch (rule.r) {
    case 'fixed': return `${rule.day} ${MONTH_ROMAN[rule.month - 1] ?? '?'}`;
    case 'easter': return EASTER_NAMED[rule.offset] ?? `Wielkanoc${signed(rule.offset)} dni`;
    case 'advent': return ADVENT_NAMED[rule.offset] ?? `I Niedz. Adwentu${signed(rule.offset)} dni`;
    case 'christmas-sunday': return 'Święta Rodzina';
    case 'baptism': return 'Chrzest Pański';
    case 'nth-weekday': return `${NTH_LABEL[String(rule.n)] ?? rule.n} ${WEEKDAY_SHORT[rule.weekday]} ${rule.month === undefined ? 'miesiąca' : MONTH_ROMAN[rule.month - 1] ?? ''}`;
    case 'sunday-after': return `niedziela po ${rule.day} ${MONTH_ROMAN[rule.month - 1] ?? '?'}`;
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
  const modeWord = (m?: string) => (m === undefined || m === '' ? 'każdy' : modes?.find((x) => x.value === m)?.label ?? m);
  switch (test.t) {
    case 'weekday': return test.days.length === 0 ? 'dzień: — wybierz —' : `dzień: ${test.days.map((d) => WEEKDAY_SHORT[d]).join(', ')}`;
    case 'slot': return test.keys.length === 0 ? 'msza: — wybierz —' : `msza: ${listOf(test.keys)}`;
    case 'time': return `godzina ${test.from ?? '00:00'}–${test.to ?? '24:00'}`;
    case 'season': return test.seasons.length === 0 ? 'okres: — wybierz —' : `okres: ${listOf(test.seasons.map((s) => SEASON_LABEL[s]), 2)}`;
    case 'week': return `tydzień ${COMPARE_LABEL[test.op]} ${test.n}`;
    case 'rank': return `ranga ${COMPARE_LABEL[test.op]} ${test.n} (${RANK_SHORT[test.n] ?? '?'})`;
    case 'celebration': return test.is === 'any' ? 'jest obchód' : test.is === 'none' ? 'nie ma obchodu' : `obchód: „${test.name ?? ''}”`;
    case 'festive': return 'niedziela albo święto';
    case 'sunday': return 'niedziela';
    case 'date': return `dzień: ${ruleSummary(test.rule)}`;
    case 'between': return `od ${monthDay(test.from)} do ${monthDay(test.to)}`;
    case 'var': return `${test.name || '?'} ${test.op === 'contains' ? 'zawiera' : test.op === '=' ? '=' : '≠'} „${test.value}”`;
    case 'mode': return test.modes.length === 0 ? 'rodzaj: — wybierz —' : `rodzaj: ${test.modes.map((m) => modeWord(m)).join(', ')}`;
    case 'count': {
      const where = test.scope === 'occurrence' ? 'na terminie' : test.per === 'occurrence' ? 'innych terminów w tygodniu z' : 'w tygodniu';
      return `${where}: ${modeWord(test.mode)}${test.status === 'all' ? ' (wszystkie)' : ''} ${COMPARE_LABEL[test.op]} ${test.n}`;
    }
    case 'actor': return test.is === 'office' ? 'dodaje kancelaria' : 'dodaje ktoś z zewnątrz';
    case 'field': return `pole ${test.key || '?'}: ${test.op === 'set' ? 'wypełnione' : test.op === 'empty' ? 'puste' : `= „${test.value ?? ''}”`}`;
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
      return filled === 0 ? 'okres, tydzień — kolory do ustawienia' : `okres, tydzień, kolor (${filled} okresów)`;
    }
    case 'feasts': {
      const rows = (d as unknown as FeastsData).rows ?? [];
      return rows.length === 0 ? 'pusta tabela' : `${rows.length} ${rows.length === 1 ? 'obchód' : rows.length < 5 ? 'obchody' : 'obchodów'}: ${listOf(rows.slice(0, 2).map((r) => r.name || '(bez nazwy)'), 2)}${rows.length > 2 ? ' …' : ''}`;
    }
    case 'if': return (d as unknown as IfData).test === undefined ? '— warunek —' : testSummary((d as unknown as IfData).test, ctx.modes);
    case 'set': {
      const s = d as unknown as SetData;
      const field = s.target === 'field' ? ctx.fields?.find((f) => f.key === s.key)?.label ?? s.key ?? '?' : '';
      const what = s.target === 'title' ? 'tytuł' : s.target === 'field' ? `pole „${field}”` : `zmienna ${s.key || '?'}`;
      return `${what} = ${s.value || '…'}`;
    }
    case 'slots': {
      const s = d as unknown as SlotsData;
      return `niedz. i święta: ${times(s.festive ?? [])} · powszednie: ${times(s.weekdays ?? [])}`;
    }
    case 'record': {
      const r = d as unknown as RecordData;
      const list = ctx.lists?.find((l) => l.key === r.list);
      const mode = r.mode === undefined || r.mode === '' ? '' : ` (${list?.modes?.find((m) => m.value === r.mode)?.label ?? r.mode})`;
      return `${list?.label ?? r.list ?? '?'}: „${r.text || '…'}”${mode}`;
    }
    case 'allow':
    case 'wait':
    case 'refuse': return ((d as unknown as MessageData).message ?? '').trim() || (node.type === 'refuse' ? '— komunikat —' : '');
    default: return '';
  }
}

/** Womit ein neuer Knoten anfängt. */
export function defaultData(type: FlowNodeType, kind: 'plan' | 'rule', lists?: readonly RecordList[]): Record<string, unknown> {
  switch (type) {
    case 'season': return {
      colours: { adwent: 'fioletowy', narodzenie: 'biały', zwykly: 'zielony', post: 'fioletowy', triduum: 'biały', wielkanoc: 'biały' },
      special: { gaudete: 'różowy', laetare: 'różowy', palm: 'czerwony', goodFriday: 'czerwony', pentecost: 'czerwony' }
    } satisfies SeasonData;
    case 'feasts': return { rows: [] };
    case 'if': return { test: kind === 'plan' ? { t: 'weekday', days: [7] } : { t: 'mode', modes: [] } };
    case 'set': return { target: 'title', value: '{title}' };
    case 'slots': return { festive: [], weekdays: [] };
    case 'record': return { list: lists?.[0]?.key ?? 'intencje', text: '' };
    case 'wait': return { message: 'Kancelaria potwierdzi wpis.' };
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
          <span className="wk-fhandle-tag wk-fhandle-tag-yes" aria-hidden="true">tak</span>
          <Handle id="no" type="source" position={Position.Right} className="wk-fhandle wk-fhandle-no" />
          <span className="wk-fhandle-tag wk-fhandle-tag-no" aria-hidden="true">nie</span>
        </>
      ) : info.outs.includes('out') && (
        <Handle id="out" type="source" position={Position.Right} className="wk-fhandle" />
      )}
    </div>
  );
}

export const FLOW_NODE_TYPES = { flow: FlowNodeFace };
