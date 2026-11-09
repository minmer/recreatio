/**
 * COGITA — FORMULARZE DODAWANIA IN WORTEN UND ALS TEXT (COGITA.md §2.4):
 * eine eingefügte Liste in Zeilen, was am Formular nicht stimmt, und was es
 * tut — die Beschreibung im Editor und beim Ausfüllen. Das Modell steht in
 * `addForm.ts`.
 */

import { order } from './graph';
import {
  choicesOf, COLUMN_SEPARATOR_LABEL, entryConfig, groupsOf, identityOf, isTypeable, KEY_ACTION_LABEL, keyActionIn, KEY_NAMES, nodeLabel, pickConfig, refFields, topOf, typedFields,
  type AddForm, type FormGroup, type Instance, type PasteRule, type RowInput, type TopItem
} from './addForm';
import type { GraphNode } from './graph';
import type { Lookup } from './schema';
import { t } from '../core/i18n';

/* -- Eine eingefügte Liste ------------------------------------------------------------------ */

export interface PastedList {
  readonly rows: readonly RowInput[];
  /** Woran getrennt wurde (erkannt oder gewählt) — `''`: eine Spalte. */
  readonly separator: string;
  /** Zeilen mit mehr Spalten als das Formular hat (der Rest steht in der letzten). */
  readonly wide: number;
}

const SPLIT_CANDIDATES = ['\t', ' – ', ' — ', ' - ', ';', '=', '|', ','];

/** Woran die Spalten getrennt sind: das erste Zeichen, das in den meisten Zeilen steht. */
export function detectSeparator(lines: readonly string[]): string {
  for (const sep of SPLIT_CANDIDATES) {
    if (lines.length > 0 && lines.filter((l) => l.includes(sep)).length >= Math.ceil(lines.length * 0.6)) return sep;
  }
  return '\t';
}

/**
 * EINE LISTE AUS EINEM ARBEITSBLATT ODER TEXT: eine Zeile je Zeile des
 * Formulars, die Spalten in der Reihenfolge seiner getippten Felder. In einer
 * Zelle trennt das Wertzeichen mehrere Werte — nur dort, wo der Knoten
 * mehrere in einer Zeile nimmt.
 */
export function parsePaste(text: string, groups: readonly FormGroup[], rule: PasteRule): PastedList {
  let lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '');
  if (rule.header) lines = lines.slice(1);
  const columns = groups.flatMap((g) => g.fields.map((f) => ({ g, f })));
  const separator = columns.length <= 1 ? '' : rule.columns === 'auto' ? detectSeparator(lines) : rule.columns === 'tab' ? '\t' : rule.columns;
  const splitValues = separator.trim() !== rule.values;
  let wide = 0;
  const rows = lines.map((line): RowInput => {
    let cells = separator === '' ? [line] : line.split(separator);
    if (cells.length > columns.length) {
      wide += 1;
      cells = [...cells.slice(0, columns.length - 1), cells.slice(columns.length - 1).join(separator)];
    }
    const row: Record<string, Instance[]> = {};
    let at = 0;
    for (const g of groups) {
      const parts = g.fields.map(() => {
        const cell = (cells[at++] ?? '').trim();
        if (!g.many || !splitValues) return [cell];
        return cell.split(rule.values).map((x) => x.trim()).filter(Boolean);
      });
      const count = Math.max(1, ...parts.map((p) => p.length));
      row[g.node] = Array.from({ length: count }, (_, k) => {
        const inst: Instance = Object.fromEntries(g.fields.map((f, i) => [f.key, parts[i][k] ?? '']));
        /* Rodzaj zur Wahl: „Pieśń: Ap 19,1-7" — ohne Vorsatz der erste. */
        if (g.choices !== undefined) {
          const text = inst[g.fields[0].key] ?? '';
          const cut = text.indexOf(':');
          const named = cut > 0 ? g.choices.find((ch) => ch.kind.name.toLowerCase() === text.slice(0, cut).trim().toLowerCase()) : undefined;
          if (named !== undefined) return { [g.fields[0].key]: text.slice(cut + 1).trim(), _kind: named.kind.id };
        }
        return inst;
      });
    }
    return row;
  });
  return { rows, separator, wide };
}

/* -- Was das Formular falsch beschreibt --------------------------------------------------------- */

export function formProblems(form: AddForm, look: Pick<Lookup, 'kind'>): string[] {
  const out: string[] = [];
  const entries = form.graph.nodes.filter((n) => n.type === 'entry');
  if (entries.length === 0) out.push(t('cogitaEditForm.problem.noEntry'));
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  let typed = 0;
  for (const node of entries) {
    const c = entryConfig(node.config);
    const kind = look.kind(c.kind);
    if (kind === undefined) { out.push(t('cogitaEditForm.problem.chooseKind', { node: nodeLabel(node, look, form.graph) })); continue; }
    typed += typedFields(kind, c).length;
    const incoming = form.graph.edges.filter((e) => e.to === node.id);
    if (typedFields(kind, c).length === 0 && !incoming.some((e) => byId.get(e.from)?.type === 'entry')) {
      out.push(t('cogitaEditForm.problem.takesNothing', { node: nodeLabel(node, look, form.graph) }));
    }
    for (const e of incoming) {
      const field = kind.fields.find((f) => f.key === e.in);
      const from = byId.get(e.from);
      if (field === undefined || field.type !== 'ref' || from === undefined) { out.push(t('cogitaEditForm.problem.goneField', { node: nodeLabel(node, look, form.graph) })); continue; }
      const sourceKinds = from.type === 'pick' ? pickConfig(from.config).kinds : [entryConfig(from.config).kind];
      const to = field.to ?? [];
      if (to.length > 0 && sourceKinds.length > 0 && !sourceKinds.some((k) => to.includes(k))) {
        out.push(t('cogitaEditForm.problem.mismatch', { node: nodeLabel(from, look, form.graph), field: field.label, kinds: to.map((k) => look.kind(k)?.name ?? k).join(', ') }));
      }
      if (!field.multi && from.type === 'pick' && pickConfig(from.config).many) {
        out.push(t('cogitaEditForm.problem.manyToOne', { node: nodeLabel(from, look, form.graph), field: field.label }));
      }
    }
    for (const [key, source] of Object.entries(c.fields)) {
      const field = kind.fields.find((f) => f.key === key);
      if (field !== undefined && !isTypeable(field) && field.type !== 'ref') out.push((source.from === 'type' ? t('cogitaEditForm.problem.cantType', { node: nodeLabel(node, look, form.graph), field: field.label }) : t('cogitaEditForm.problem.cantSet', { node: nodeLabel(node, look, form.graph), field: field.label })));
    }
  }
  if (entries.length > 0 && typed === 0) out.push(t('cogitaEditForm.problem.nothingTyped'));
  if (order(form.graph) === null) out.push(t('cogitaEditForm.problem.cycle'));
  return out;
}

/* -- Was das Formular tut, in Worten ------------------------------------------------------------ */

const quote = (text: string) => t('cogitaEditForm.describe.quote', { text });

/**
 * DIE BESCHREIBUNG — im Editor unter dem Graphen, beim Ausfüllen unter
 * „Jak działa ten formularz". Sie entsteht aus dem Formular selbst und ist
 * darum nie veraltet.
 */
export function describeForm(form: AddForm, look: Pick<Lookup, 'kind'>): string[] {
  const out: string[] = [];
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  const top = topOf(form, look);
  const picks = top.filter((x): x is Extract<TopItem, { type: 'pick' }> => x.type === 'pick');
  const asks = top.filter((x): x is Extract<TopItem, { type: 'ask' }> => x.type === 'ask');
  if (picks.length > 0) {
    out.push(t('cogitaEditForm.describe.picks', { list: picks.map((p) => {
      const kinds = p.config.kinds.map((k) => look.kind(k)?.name ?? k).join(' / ');
      const more = [kinds, p.config.many ? t('cogitaEditForm.describe.several') : '', p.config.optional ? t('cogitaEditForm.describe.skippable') : ''].filter(Boolean).join('; ');
      return `${quote(p.label)}${more === '' ? '' : ` (${more})`}`;
    }).join(', ') }));
  }
  if (asks.length > 0) out.push(t('cogitaEditForm.describe.asks', { list: asks.map((a) => `${a.label}${a.value === '' ? '' : t('cogitaEditForm.describe.default', { value: a.value })}`).join(', ') }));
  const groups = groupsOf(form, look, true);
  if (groups.length > 0) {
    out.push(t('cogitaEditForm.describe.rows', { list: groups.map((g) => `${quote(g.label)} — ${g.fields.map((f) => f.label).join(', ')}${g.many ? t('cogitaEditForm.describe.severalMark') : ''}`).join('; ') }));
  }
  const sequence = order(form.graph) ?? form.graph.nodes.map((n) => n.id);
  for (const id of sequence) {
    const node = byId.get(id);
    if (node === undefined || node.type !== 'entry') continue;
    const c = entryConfig(node.config);
    const kind = look.kind(c.kind);
    if (kind === undefined) continue;
    const parts: string[] = [];
    for (const f of kind.fields) {
      const source = c.fields[f.key];
      if (f.type === 'ref') {
        const from = form.graph.edges.filter((e) => e.to === id && e.in === f.key).map((e) => byId.get(e.from)).filter((n): n is GraphNode => n !== undefined);
        if (from.length > 0) parts.push(`${f.label} ← ${from.map((n) => quote(nodeLabel(n, look, form.graph))).join(' + ')}${f.locator === true && source?.from === 'type' ? t('cogitaEditForm.describe.withPlace') : ''}`);
      } else if (source !== undefined && isTypeable(f)) {
        parts.push(source.from === 'type' ? t('cogitaEditForm.describe.typed', { field: f.label }) : source.from === 'ask' ? t('cogitaEditForm.describe.fromStart', { field: f.label }) : `${f.label} = ${source.value ?? ''}`);
      }
    }
    const pairs = refFields(kind).filter((f) => !f.multi && form.graph.edges.some((e) => e.to === id && e.in === f.key && entryConfig(byId.get(e.from)?.config).many && byId.get(e.from)?.type === 'entry'));
    const needs = [...new Set(form.graph.edges.filter((e) => e.to === id && byId.get(e.from)?.type === 'entry' && entryConfig(byId.get(e.from)!.config).optional !== true).map((e) => quote(nodeLabel(byId.get(e.from)!, look, form.graph))))];
    const identity = c.reuse === 'never' ? [] : identityOf(form, node, kind);
    const sentence = [
      t('cogitaEditForm.describe.node', { node: quote(nodeLabel(node, look, form.graph)), kind: kind.name, parts: parts.join('; ') || t('cogitaEditForm.describe.noFields') }),
      c.many ? t('cogitaEditForm.describe.many') : '',
      c.optional === true ? t('cogitaEditForm.describe.optional') : '',
      choicesOf(c, look).length > 1 ? t('cogitaEditForm.describe.choices', { list: choicesOf(c, look).map((ch) => `${ch.kind.name} (${ch.field.label})`).join(t('cogitaEditForm.describe.or')), example: choicesOf(c, look)[1].kind.name }) : '',
      pairs.length > 0 ? t('cogitaEditForm.describe.pairs', { fields: pairs.map((f) => f.label).join(', ') }) : '',
      needs.length > 0 ? t('cogitaEditForm.describe.needs', { list: needs.join(t('cogitaEditForm.describe.and')) }) : '',
      identity.length > 0 ? t('cogitaEditForm.describe.reuse', { fields: identity.map((f) => f.label).join(', ') }) : t('cogitaEditForm.describe.alwaysNew')
    ].filter(Boolean).join(' ');
    out.push(sentence);
  }
  out.push(t('cogitaEditForm.describe.keys', { list: KEY_NAMES.map(([key, name]) => `${name} — ${KEY_ACTION_LABEL[keyActionIn(form.keys[key], groups)]}`).join('; ') }));
  const columns = groups.flatMap((g) => g.fields.map((f) => (g.fields.length > 1 ? `${g.label}: ${f.label}` : g.label)));
  if (columns.length > 0) {
    const sep = columns.length > 1 ? t('cogitaEditForm.describe.columns', { columns: columns.join(' | '), sep: COLUMN_SEPARATOR_LABEL[form.paste.columns] }) : '';
    const many = groups.some((g) => g.many) ? t('cogitaEditForm.describe.values', { sep: quote(form.paste.values) }) : '';
    out.push(t('cogitaEditForm.describe.paste', { sep, many }));
  }
  return out;
}
