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
  if (entries.length === 0) out.push('Dodaj co najmniej jeden wpis „w każdym wierszu".');
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  let typed = 0;
  for (const node of entries) {
    const c = entryConfig(node.config);
    const kind = look.kind(c.kind);
    if (kind === undefined) { out.push(`„${nodeLabel(node, look, form.graph)}": wybierz rodzaj.`); continue; }
    typed += typedFields(kind, c).length;
    const incoming = form.graph.edges.filter((e) => e.to === node.id);
    if (typedFields(kind, c).length === 0 && !incoming.some((e) => byId.get(e.from)?.type === 'entry')) {
      out.push(`„${nodeLabel(node, look, form.graph)}" nie bierze niczego z wiersza — powstałby jeden taki sam wpis dla każdego wiersza.`);
    }
    for (const e of incoming) {
      const field = kind.fields.find((f) => f.key === e.in);
      const from = byId.get(e.from);
      if (field === undefined || field.type !== 'ref' || from === undefined) { out.push(`„${nodeLabel(node, look, form.graph)}": połączenie prowadzi do pola, którego już nie ma.`); continue; }
      const sourceKinds = from.type === 'pick' ? pickConfig(from.config).kinds : [entryConfig(from.config).kind];
      const to = field.to ?? [];
      if (to.length > 0 && sourceKinds.length > 0 && !sourceKinds.some((k) => to.includes(k))) {
        out.push(`„${nodeLabel(from, look, form.graph)}" nie pasuje do pola „${field.label}" (przyjmuje: ${to.map((k) => look.kind(k)?.name ?? k).join(', ')}).`);
      }
      if (!field.multi && from.type === 'pick' && pickConfig(from.config).many) {
        out.push(`„${nodeLabel(from, look, form.graph)}" może mieć kilka wpisów, a pole „${field.label}" przyjmuje jeden — powstanie osobny wpis dla każdego.`);
      }
    }
    for (const [key, source] of Object.entries(c.fields)) {
      const field = kind.fields.find((f) => f.key === key);
      if (field !== undefined && !isTypeable(field) && field.type !== 'ref') out.push(`„${nodeLabel(node, look, form.graph)}": pola „${field.label}" nie da się ${source.from === 'type' ? 'wpisywać' : 'ustawić'} w formularzu.`);
    }
  }
  if (entries.length > 0 && typed === 0) out.push('Żadne pole nie jest wpisywane w wierszu — nie byłoby czego dodawać.');
  if (order(form.graph) === null) out.push('Formularz ma koło.');
  return out;
}

/* -- Was das Formular tut, in Worten ------------------------------------------------------------ */

const quote = (text: string) => `„${text}"`;

/**
 * DIE BESCHREIBUNG — im Editor unter dem Graphen, beim Ausfüllen unter
 * „Jak działa ten formularz". Sie entsteht aus dem Formular selbst und ist
 * darum nie veraltet.
 */
export function describeForm(form: AddForm, look: Pick<Lookup, 'kind'>): string[] {
  const out: string[] = [];
  const byId = new Map(form.graph.nodes.map((n) => [n.id, n]));
  const top = topOf(form, look);
  const picks = top.filter((t): t is Extract<TopItem, { type: 'pick' }> => t.type === 'pick');
  const asks = top.filter((t): t is Extract<TopItem, { type: 'ask' }> => t.type === 'ask');
  if (picks.length > 0) {
    out.push(`Na początek wybierasz: ${picks.map((p) => {
      const kinds = p.config.kinds.map((k) => look.kind(k)?.name ?? k).join(' / ');
      const more = [kinds, p.config.many ? 'kilka' : '', p.config.optional ? 'można pominąć' : ''].filter(Boolean).join('; ');
      return `${quote(p.label)}${more === '' ? '' : ` (${more})`}`;
    }).join(', ')}. Wybór zostaje dla wszystkich wierszy, dopóki go nie zmienisz.`);
  }
  if (asks.length > 0) out.push(`Na początek ustawiasz: ${asks.map((a) => `${a.label}${a.value === '' ? '' : ` (domyślnie: ${a.value})`}`).join(', ')}.`);
  const groups = groupsOf(form, look);
  if (groups.length > 0) {
    out.push(`W każdym wierszu wpisujesz: ${groups.map((g) => `${quote(g.label)} — ${g.fields.map((f) => f.label).join(', ')}${g.many ? ' (kilka)' : ''}`).join('; ')}.`);
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
        if (from.length > 0) parts.push(`${f.label} ← ${from.map((n) => quote(nodeLabel(n, look, form.graph))).join(' + ')}`);
      } else if (source !== undefined && isTypeable(f)) {
        parts.push(source.from === 'type' ? `${f.label} — wpisane` : source.from === 'ask' ? `${f.label} — z początku` : `${f.label} = ${source.value ?? ''}`);
      }
    }
    const pairs = refFields(kind).filter((f) => !f.multi && form.graph.edges.some((e) => e.to === id && e.in === f.key && entryConfig(byId.get(e.from)?.config).many && byId.get(e.from)?.type === 'entry'));
    const needs = [...new Set(form.graph.edges.filter((e) => e.to === id && byId.get(e.from)?.type === 'entry').map((e) => quote(nodeLabel(byId.get(e.from)!, look, form.graph))))];
    const identity = c.reuse === 'never' ? [] : identityOf(form, node, kind);
    const sentence = [
      `${quote(nodeLabel(node, look, form.graph))} (${kind.name}): ${parts.join('; ') || 'bez pól'}.`,
      c.many ? 'Kilka w jednym wierszu.' : '',
      choicesOf(c, look).length > 1 ? `Przy każdej wartości wybiera się rodzaj: ${choicesOf(c, look).map((ch) => `${ch.kind.name} (${ch.field.label})`).join(' albo ')}; na liście — przedrostek, np. „${choicesOf(c, look)[1].kind.name}: …”.` : '',
      pairs.length > 0 ? `Po jednym dla każdej pary (${pairs.map((f) => f.label).join(', ')} przyjmuje jeden wpis).` : '',
      needs.length > 0 ? `Powstaje tylko, gdy w wierszu jest ${needs.join(' i ')}.` : '',
      identity.length > 0 ? `Jeśli taki już jest (to samo: ${identity.map((f) => f.label).join(', ')}), zostaje użyty, a brakujące wartości są dopisane.` : 'Zawsze powstaje nowy.'
    ].filter(Boolean).join(' ');
    out.push(sentence);
  }
  out.push(`Klawisze: ${KEY_NAMES.map(([key, name]) => `${name} — ${KEY_ACTION_LABEL[keyActionIn(form.keys[key], groups)]}`).join('; ')}.`);
  const columns = groups.flatMap((g) => g.fields.map((f) => (g.fields.length > 1 ? `${g.label}: ${f.label}` : g.label)));
  if (columns.length > 0) {
    const sep = columns.length > 1 ? ` — kolumny: ${columns.join(' | ')}, oddzielone: ${COLUMN_SEPARATOR_LABEL[form.paste.columns]}` : '';
    const many = groups.some((g) => g.many) ? `; kilka wartości w komórce oddziel znakiem ${quote(form.paste.values)}` : '';
    out.push(`Wklejanie listy: jedna linia to jeden wiersz${sep}${many}.`);
  }
  return out;
}
