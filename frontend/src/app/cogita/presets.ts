/**
 * COGITA — GOTOWE POCZĄTKI: Kartenvorlagen, Wiederholungen und Abläufe, die
 * man mit einem Klick anlegt und dann nach Belieben ändert. Kein eigener
 * Mechanismus: was hier entsteht, ist ein gewöhnliches Dokument der
 * Bibliothek (`template`, `revision`, `flow`), genau wie ein selbst gebautes.
 *
 * Die alten Vorlagen der Bibliotheken (Wörter, Karte des Wissens, Kurs,
 * Forschung, Karteikarten) sind hier Anfänge [F05, F45].
 */

import { t } from '../core/i18n';
import { graphJson, type Graph, type GraphEdge, type GraphNode } from './graph';
import { patternKeys, type FieldDef, type KindDef } from './schema';

let seq = 0;
const node = (type: string, x: number, y: number, config: Record<string, unknown> = {}): GraphNode => ({ id: `n${(seq += 1)}`, type, x, y, config });
const edge = (from: GraphNode, out: string, to: GraphNode, into: string): GraphEdge => ({ id: `e${(seq += 1)}`, from: from.id, out, to: to.id, in: into });
const graphOf = (nodes: GraphNode[], edges: GraphEdge[]): Record<string, unknown> => graphJson({ nodes, edges } satisfies Graph);

/** Ein Feld, wie der Dialog es einem Anfang gibt — mit dem, worauf es verweist. */
export interface PresetField {
  readonly key: string;
  readonly label: string;
  readonly to?: readonly string[];
}

/** Ein Rodzaj mit einem Verweisfeld, das auf diesen zeigt: die Übersetzungen, in denen ein Wort steht. */
export interface BackRef {
  readonly kind: string;
  readonly key: string;
  readonly label: string;
  readonly multi: boolean;
}

/** Was ein Anfang im Dialog erfragt und wie es dort heisst. */
export interface PresetAsks {
  /** `refs`: nur Verweise — die mit vielen (`multi`) oder mit einem Eintrag (`single`) zuerst. */
  readonly field?: { readonly label: string; readonly refs?: 'multi' | 'single' };
  /** `text`: nur Textfelder, das aus dem Etikett zuerst. */
  readonly second?: { readonly label: string; readonly text?: boolean };
  /** Ein Feld des Rodzaj, auf den das erste Feld verweist (die Sprache der Wörter); dahinter steht sein Name. */
  readonly through?: { readonly label: string };
  readonly back?: { readonly label: string };
}

export interface TemplatePreset {
  readonly id: string;
  readonly label: string;
  readonly says: string;
  /**
   * Was er braucht: `field` und `second` sind Felder des Rodzaj, `through` ist
   * ein Feld des Rodzaj, auf den `field` verweist, `back` ein Rodzaj, der auf
   * diesen verweist (mit seinem Feld).
   */
  readonly needs: readonly ('field' | 'second' | 'date' | 'through' | 'back')[];
  readonly asks?: PresetAsks;
  /** 2026-10-22 — nur für diese Rodzaje; fehlt: für jeden. */
  readonly kinds?: readonly string[];
  /** 2026-10-23 — nur für Rodzaje mit einem Feld `blocks` (Aussagen: Teza, Tabelle) — gleich, wie sie heissen. */
  readonly statements?: true;
  readonly make: (kindId: string, field: PresetField, second?: PresetField, more?: { readonly back?: { readonly kind: string; readonly key: string } }) => Record<string, unknown>;
}

export interface PresetChoice {
  readonly fields: readonly FieldDef[];
  readonly field?: FieldDef;
  readonly seconds: readonly FieldDef[];
  readonly second?: FieldDef;
  /** Der Rodzaj, auf den `field` verweist (bei `through`). */
  readonly target?: KindDef;
  readonly backs: readonly BackRef[];
  readonly back?: BackRef;
  /** Warum sich der Anfang nicht bauen lässt — `null`: er lässt sich. */
  readonly missing: string | null;
}

/**
 * WAS DER DIALOG ZUR WAHL STELLT und was er vorwählt: für die Wörter einer
 * Übersetzung das Verweisfeld auf viele, für die Sprache eines Wortes das auf
 * einen, als Text das Feld aus dem Etikett, als Weg zurück der Rodzaj, der auf
 * dieses verweist (die Übersetzung).
 */
export function presetChoice(kinds: readonly KindDef[], kindId: string, preset: TemplatePreset, picked: { readonly field?: string; readonly second?: string; readonly back?: string }): PresetChoice {
  const kind = kinds.find((k) => k.id === kindId);
  const all = kind?.fields ?? [];
  const asks = preset.asks ?? {};
  const prefer = asks.field?.refs;
  const refs = all.filter((f) => f.type === 'ref');
  const fields = prefer === undefined ? all : [...refs.filter((f) => f.multi === (prefer === 'multi')), ...refs.filter((f) => f.multi !== (prefer === 'multi'))];
  const field = fields.find((f) => f.key === picked.field) ?? fields[0];
  let target: KindDef | undefined;
  let seconds: readonly FieldDef[] = [];
  let second: FieldDef | undefined;
  if (preset.needs.includes('through')) {
    target = field?.to !== undefined && field.to.length === 1 ? kinds.find((k) => k.id === field.to![0]) : undefined;
    seconds = target?.fields ?? [];
    second = seconds.find((f) => f.key === picked.second) ?? seconds.find((f) => f.type === 'ref' && !f.multi) ?? seconds[0];
  } else if (preset.needs.includes('second')) {
    const inLabel = new Set(kind === undefined ? [] : patternKeys(kind.label));
    seconds = asks.second?.text === true ? all.filter((f) => f.type === 'line' || f.type === 'text') : all;
    second = seconds.find((f) => f.key === picked.second)
      ?? (asks.second?.text === true ? seconds.find((f) => inLabel.has(f.key)) ?? seconds[0] : seconds[1] ?? seconds[0]);
  }
  const backs: BackRef[] = preset.needs.includes('back')
    ? kinds.flatMap((k) => k.fields.filter((f) => f.type === 'ref' && f.to?.includes(kindId) === true).map((f) => ({ kind: k.id, key: f.key, label: t('cogitaViewsPresets.choice.backRef', { kind: k.name, field: f.label }), multi: f.multi })))
      .sort((a, b) => Number(a.kind === kindId) - Number(b.kind === kindId) || Number(b.multi) - Number(a.multi))
    : [];
  const back = backs.find((b) => `${b.kind}|${b.key}` === picked.back) ?? backs[0];
  const missing = field === undefined
    ? (prefer === undefined ? t('cogitaViewsPresets.choice.noFields') : t('cogitaViewsPresets.choice.noRefField'))
    : preset.needs.includes('through') && second === undefined
      ? t('cogitaViewsPresets.choice.noTarget', { field: field.label })
      : preset.needs.includes('second') && second === undefined
        ? t('cogitaViewsPresets.choice.noText')
        : preset.needs.includes('back') && back === undefined
          ? t('cogitaViewsPresets.choice.noBack')
          : null;
  return { fields, ...(field === undefined ? {} : { field }), seconds, ...(second === undefined ? {} : { second }), ...(target === undefined ? {} : { target }), backs, ...(back === undefined ? {} : { back }), missing };
}

/** Das Feld, wie ein Anfang es bekommt. */
export const presetField = (f: FieldDef): PresetField => ({ key: f.key, label: f.label, ...(f.to === undefined ? {} : { to: f.to }) });

/* Die Słówka-Anfänge fragen dasselbe: die Wörter einer Übersetzung und ihre Sprache — oder, vom Wort aus, seine Sprache, seinen Text und wo seine Übersetzungen stehen. */
/* Die Namen werden beim Lesen übersetzt (Getter). */
const WORDS_ASKS: PresetAsks = { field: { get label() { return t('cogitaViewsPresets.asks.wordsField'); }, refs: 'multi' }, through: { get label() { return t('cogitaViewsPresets.asks.langIn'); } } };
const WORD_ASKS: PresetAsks = {
  field: { get label() { return t('cogitaViewsPresets.asks.langField'); }, refs: 'single' },
  second: { get label() { return t('cogitaViewsPresets.asks.wordText'); }, text: true },
  back: { get label() { return t('cogitaViewsPresets.asks.backField'); } }
};

export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  /* 2026-10-22 — Aussagen: die Teza zu ihrem Gegenstand, die Paare einer Tabelle. 2026-10-23: jeder Rodzaj mit Feld blocks (z. B. Komentarz). */
  {
    id: 'thesis', get label() { return t('cogitaViewsPresets.tpl.thesis.label'); }, get says() { return t('cogitaViewsPresets.tpl.thesis.says'); }, needs: [], statements: true,
    make: (kind) => {
      const subjects = node('statement.subjects', 0, 0);
      const when = node('when', 230, 0, { test: 'filled' });
      const pattern = node('pattern', 460, 0, { text: t('cogitaViewsPresets.tpl.thesis.pattern'), inputs: 1, joiner: '; ' });
      const prompt = node('prompt', 690, 0);
      const thesis = node('statement.thesis', 0, 160);
      const answer = node('answer.flash', 690, 160);
      const self = node('entity', 460, 280);
      const card = node('card', 920, 80);
      return {
        name: t('cogitaViewsPresets.tpl.thesis.name'), kinds: [kind], direction: 'o czym→teza', // i18n-ignore
        graph: graphOf([subjects, when, pattern, prompt, thesis, answer, self, card], [
          edge(subjects, 'entities', when, 'items'), edge(when, 'items', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'),
          edge(thesis, 'text', answer, 'back'), edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer'),
          edge(self, 'entities', card, 'explain')
        ])
      };
    }
  },
  {
    id: 'statement-table', get label() { return t('cogitaViewsPresets.tpl.table.label'); }, get says() { return t('cogitaViewsPresets.tpl.table.says'); }, needs: [], statements: true,
    make: (kind) => {
      const thesis = node('statement.thesis', 0, 0);
      const prompt = node('prompt', 230, 0);
      const table = node('statement.table', 0, 160, { table: 1, left: 1, right: 2 });
      const answer = node('answer.match', 230, 160);
      const self = node('entity', 230, 300);
      const card = node('card', 460, 80);
      return {
        name: t('cogitaViewsPresets.tpl.table.name'), kinds: [kind], direction: 'pary',
        graph: graphOf([thesis, prompt, table, answer, self, card], [
          edge(thesis, 'text', prompt, 'parts'), edge(table, 'left', answer, 'left'), edge(table, 'right', answer, 'right'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer'), edge(self, 'entities', card, 'explain')
        ])
      };
    }
  },
  {
    id: 'ask', get label() { return t('cogitaViewsPresets.tpl.ask.label'); }, get says() { return t('cogitaViewsPresets.tpl.ask.says'); }, needs: ['field'],
    make: (kind, field) => {
      const self = node('entity', 0, 0);
      const value = node('field', 0, 140, { key: field.key });
      const pattern = node('pattern', 230, 0, { text: t('cogitaViewsPresets.tpl.ask.pattern', { field: field.label }), inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.text', 460, 140);
      const card = node('card', 690, 60);
      return {
        name: t('cogitaViewsPresets.tpl.ask.name', { field: field.label }), kinds: [kind], direction: `${field.key}`,
        graph: graphOf([self, value, pattern, prompt, answer, card], [
          edge(self, 'entities', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'), edge(value, 'values', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'reverse', get label() { return t('cogitaViewsPresets.tpl.reverse.label'); }, get says() { return t('cogitaViewsPresets.tpl.reverse.says'); }, needs: ['field'],
    make: (kind, field) => {
      const self = node('entity', 0, 140);
      const value = node('field', 0, 0, { key: field.key });
      const pattern = node('pattern', 230, 0, { text: t('cogitaViewsPresets.tpl.reverse.pattern', { field: field.label.toLowerCase() }), inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.text', 460, 140);
      const card = node('card', 690, 60);
      return {
        name: t('cogitaViewsPresets.tpl.reverse.name', { field: field.label }), kinds: [kind], direction: `${field.key}→`,
        graph: graphOf([self, value, pattern, prompt, answer, card], [
          edge(value, 'values', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'), edge(self, 'entities', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'choose', get label() { return t('cogitaViewsPresets.tpl.choose.label'); }, get says() { return t('cogitaViewsPresets.tpl.choose.says'); }, needs: ['field'],
    make: (kind, field) => {
      const self = node('entity', 0, 0);
      const value = node('field', 0, 140, { key: field.key });
      const wrong = node('distractors', 230, 200, { key: field.key, count: 3, from: ['field'] });
      const pattern = node('pattern', 230, 0, { text: t('cogitaViewsPresets.tpl.ask.pattern', { field: field.label }), inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.one', 460, 160);
      const card = node('card', 690, 60);
      return {
        name: t('cogitaViewsPresets.tpl.choose.name', { field: field.label }), kinds: [kind], direction: `${field.key}:wybor`,
        graph: graphOf([self, value, wrong, pattern, prompt, answer, card], [
          edge(self, 'entities', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'),
          edge(value, 'values', answer, 'expected'), edge(value, 'values', wrong, 'expected'), edge(wrong, 'distractors', answer, 'distractors'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'date', get label() { return t('cogitaViewsPresets.tpl.date.label'); }, get says() { return t('cogitaViewsPresets.tpl.date.says'); }, needs: ['date'],
    make: (kind, field) => {
      const self = node('entity', 0, 0);
      const value = node('field', 0, 140, { key: field.key });
      const pattern = node('pattern', 230, 0, { text: t('cogitaViewsPresets.tpl.date.pattern', { field: field.label }), inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.date', 460, 140, { precision: 'year', tolerance: 0 });
      const card = node('card', 690, 60);
      return {
        name: t('cogitaViewsPresets.tpl.date.name', { field: field.label }), kinds: [kind], direction: `${field.key}:data`,
        graph: graphOf([self, value, pattern, prompt, answer, card], [
          edge(self, 'entities', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'), edge(value, 'values', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'flash', get label() { return t('cogitaViewsPresets.tpl.flash.label'); }, get says() { return t('cogitaViewsPresets.tpl.flash.says'); }, needs: ['field', 'second'],
    make: (kind, field, second) => {
      const front = node('field', 0, 0, { key: field.key });
      const back = node('field', 0, 140, { key: second?.key ?? field.key });
      const prompt = node('prompt', 230, 0);
      const answer = node('answer.flash', 230, 140);
      const card = node('card', 460, 60);
      return {
        name: t('cogitaViewsPresets.tpl.flash.name', { front: field.label, back: second?.label ?? field.label }), kinds: [kind], direction: `${field.key}→${second?.key ?? field.key}`,
        graph: graphOf([front, back, prompt, answer, card], [
          edge(front, 'values', prompt, 'parts'), edge(back, 'values', answer, 'back'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'vocabulary', get label() { return t('cogitaViewsPresets.tpl.vocabulary.label'); }, get says() { return t('cogitaViewsPresets.tpl.vocabulary.says'); }, needs: ['field', 'second'],
    make: (kind, field, second) => {
      const word = node('field', 0, 0, { key: field.key });
      const translations = node('field', 0, 140, { key: second?.key ?? field.key });
      const each = node('each', 230, 140);
      const pattern = node('pattern', 230, 0, { text: t('cogitaViewsPresets.tpl.vocabulary.pattern'), inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.text', 460, 140);
      const card = node('card', 690, 60);
      return {
        name: t('cogitaViewsPresets.tpl.vocabulary.name', { front: field.label, back: second?.label ?? '' }), kinds: [kind], direction: `${field.key}→${second?.key ?? ''}`,
        graph: graphOf([word, translations, each, pattern, prompt, answer, card], [
          edge(word, 'values', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'),
          edge(translations, 'values', each, 'items'), edge(each, 'item', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    /*
      2026-10-18 — EIN EINTRAG, DER WÖRTER MEHRERER SPRACHEN VERBINDET (eine
      Übersetzung mit einem Feld „Słowa", jedes Wort mit seiner Sprache): je
      Sprache eine Karte — vorn die Wörter dieser Sprache mit der Richtung
      („angielski → polski: house"), als Antwort die Wörter der anderen.
      Zwei Sprachen geben so beide Richtungen.
    */
    id: 'languages', get label() { return t('cogitaViewsPresets.tpl.languages.label'); },
    get says() { return t('cogitaViewsPresets.tpl.languages.says'); },
    needs: ['field', 'through'], asks: WORDS_ASKS,
    make: (kind, field, lang) => {
      const key = lang?.key ?? 'language';
      const words = node('field', 0, 0, { key: field.key });
      const langs = node('field', 230, 200, { key });
      const once = node('unique', 460, 200);
      const each = node('each', 690, 200);
      const split = node('filter', 690, 0, { key });
      const others = node('field', 920, 260, { key });
      const othersOnce = node('unique', 1150, 260);
      const pattern = node('pattern', 1150, 0, { text: '{0} → {1}: {2}', inputs: 3 });
      const prompt = node('prompt', 1380, 0);
      const answer = node('answer.text', 1380, 160);
      const card = node('card', 1610, 60);
      return {
        name: t('cogitaViewsPresets.tpl.languages.name', { field: field.label }), kinds: [kind], direction: `${field.key}:jezyki`,
        graph: graphOf([words, langs, once, each, split, others, othersOnce, pattern, prompt, answer, card], [
          edge(words, 'values', langs, 'of'), edge(langs, 'values', once, 'items'), edge(once, 'items', each, 'items'),
          edge(words, 'values', split, 'items'), edge(each, 'item', split, 'like'),
          edge(split, 'rest', others, 'of'), edge(others, 'values', othersOnce, 'items'),
          edge(each, 'item', pattern, 'p0'), edge(othersOnce, 'items', pattern, 'p1'), edge(split, 'kept', pattern, 'p2'),
          edge(pattern, 'text', prompt, 'parts'), edge(split, 'rest', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    /*
      2026-10-18 — WELCHE SPRACHE? Ein Wort, und man kreuzt jede Sprache an, in
      der es ein Wort dieser Schreibung gibt („hotel": angielski, polski,
      niemiecki). Wörter gleicher Schreibung geben EINE Karte — die am ersten
      von ihnen; die anderen hält ein Warunek zurück.
    */
    id: 'which-language', get label() { return t('cogitaViewsPresets.tpl.whichLanguage.label'); },
    get says() { return t('cogitaViewsPresets.tpl.whichLanguage.says'); },
    needs: ['field', 'second'], asks: WORD_ASKS,
    make: (kind, lang, text) => {
      const tk = text?.key ?? 'text';
      const self = node('entity', 0, 0);
      const word = node('field', 0, 150, { key: tk });
      const same = node('entries', 230, 150, { kind, key: tk });
      const first = node('pick', 460, 300, { position: 'first' });
      const only = node('filter', 690, 300);
      const gate = node('when', 920, 300, { test: 'filled' });
      const langs = node('field', 460, 150, { key: lang.key });
      const once = node('unique', 690, 150);
      const pattern = node('pattern', 230, 0, { text: t('cogitaViewsPresets.tpl.whichLanguage.pattern'), inputs: 1 });
      const prompt = node('prompt', 920, 0);
      const answer = node('answer.many', 920, 150);
      const card = node('card', 1150, 75);
      /* Zur Wahl alle Sprachen — die Einträge des Rodzaj, auf den das Sprachfeld zeigt; sonst die Sprachen aller Wörter. */
      const target = lang.to !== undefined && lang.to.length === 1 ? lang.to[0] : null;
      const options = target === null
        ? [node('entries', 230, 450, { kind }), node('field', 460, 450, { key: lang.key }), node('unique', 690, 450)]
        : [node('entries', 690, 0, { kind: target })];
      const choices = options[options.length - 1];
      return {
        name: t('cogitaViewsPresets.tpl.whichLanguage.name'), kinds: [kind], direction: `${lang.key}:jaki-jezyk`,
        graph: graphOf([self, word, same, first, only, gate, langs, once, ...options, pattern, prompt, answer, card], [
          edge(self, 'entities', only, 'items'), edge(word, 'values', same, 'like'), edge(same, 'entities', first, 'items'),
          edge(first, 'chosen', only, 'like'), edge(only, 'kept', gate, 'items'),
          edge(same, 'entities', langs, 'of'), edge(langs, 'values', once, 'items'), edge(once, 'items', answer, 'expected'),
          ...(options.length === 3 ? [edge(options[0], 'entities', options[1], 'of'), edge(options[1], 'values', options[2], 'items')] : []),
          edge(choices, options.length === 3 ? 'items' : 'entities', answer, 'distractors'),
          edge(word, 'values', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer'), edge(same, 'entities', card, 'explain')
        ])
      };
    }
  },
  {
    /*
      2026-10-18 — PAARE VERBINDEN: diese Übersetzung und bis zu zwölf andere
      zufällig, daraus fünf Paare in den zwei Sprachen dieser Übersetzung (die
      der ersten Sprache links, die übrigen rechts). Eine Übersetzung in nur
      einer Sprache macht keine Karte.
    */
    id: 'pairs', get label() { return t('cogitaViewsPresets.tpl.pairs.label'); },
    get says() { return t('cogitaViewsPresets.tpl.pairs.says'); },
    needs: ['field', 'through'], asks: WORDS_ASKS,
    make: (kind, field, lang) => {
      const key = lang?.key ?? 'language';
      const self = node('entity', 0, 0);
      const words = node('field', 230, 0, { key: field.key });
      const langs = node('field', 460, 0, { key });
      const once = node('unique', 690, 0);
      const first = node('pick', 920, 0, { position: 'first' });
      const gate = node('when', 1150, 150, { test: 'filled' });
      const others = node('entries', 0, 300, { kind, self: true, count: 12 });
      const pairs = node('pairs', 1150, 300, { key: field.key, by: key, count: 5 });
      const pattern = node('pattern', 1150, 0, { text: t('cogitaViewsPresets.tpl.pairs.pattern'), inputs: 2 });
      const prompt = node('prompt', 1380, 0);
      const answer = node('answer.match', 1380, 300);
      const card = node('card', 1610, 150);
      return {
        name: t('cogitaViewsPresets.tpl.pairs.name'), kinds: [kind], direction: `${field.key}:pary`,
        graph: graphOf([self, words, langs, once, first, gate, others, pairs, pattern, prompt, answer, card], [
          edge(self, 'entities', words, 'of'), edge(words, 'values', langs, 'of'), edge(langs, 'values', once, 'items'), edge(once, 'items', first, 'items'),
          edge(first, 'rest', gate, 'items'),
          edge(self, 'entities', pairs, 'items'), edge(others, 'entities', pairs, 'items'), edge(first, 'chosen', pairs, 'left'), edge(first, 'rest', pairs, 'right'),
          edge(pairs, 'left', answer, 'left'), edge(pairs, 'right', answer, 'right'),
          edge(first, 'chosen', pattern, 'p0'), edge(first, 'rest', pattern, 'p1'), edge(pattern, 'text', prompt, 'parts'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    /*
      2026-10-18 — DIE ÜBERSETZUNGEN FINDEN: vom Wort aus zurück zu den
      Übersetzungen, in denen es steht; deren Wörter in anderen Sprachen sind
      richtig (Synonyme derselben Sprache nicht), dazu vier Wörter derselben
      Zielsprachen als Ablenkung. Man kreuzt alle richtigen an — in einer
      oder mehreren Sprachen.
    */
    id: 'choose-translations', get label() { return t('cogitaViewsPresets.tpl.chooseTranslations.label'); },
    get says() { return t('cogitaViewsPresets.tpl.chooseTranslations.says'); },
    needs: ['field', 'second', 'back'], asks: WORD_ASKS,
    make: (kind, lang, text, more) => {
      const tk = text?.key ?? 'text';
      const back = more?.back ?? { kind: '', key: '' };
      const self = node('entity', 0, 0);
      const word = node('field', 0, 150, { key: tk });
      const source = node('field', 0, 300, { key: lang.key });
      const trans = node('entries', 230, 0, { kind: back.kind, key: back.key });
      const words = node('field', 460, 0, { key: back.key });
      const other = node('filter', 690, 0, { key: lang.key });
      const right = node('unique', 920, 0);
      const targets = node('field', 920, 150, { key: lang.key });
      const targetsOnce = node('unique', 1150, 150);
      const pool = node('entries', 1150, 300, { kind, key: lang.key, count: 12 });
      const wrong = node('distractors', 1380, 300, { from: ['list'], count: 4 });
      const pattern = node('pattern', 230, 300, { text: t('cogitaViewsPresets.tpl.chooseTranslations.pattern'), inputs: 2 });
      const prompt = node('prompt', 1610, 0);
      const answer = node('answer.many', 1610, 150);
      const card = node('card', 1840, 75);
      return {
        name: t('cogitaViewsPresets.tpl.chooseTranslations.name'), kinds: [kind], direction: `${back.key}:wybor`,
        graph: graphOf([self, word, source, trans, words, other, right, targets, targetsOnce, pool, wrong, pattern, prompt, answer, card], [
          edge(self, 'entities', trans, 'like'), edge(trans, 'entities', words, 'of'), edge(words, 'values', other, 'items'), edge(source, 'values', other, 'like'),
          edge(other, 'rest', right, 'items'), edge(other, 'rest', targets, 'of'), edge(targets, 'values', targetsOnce, 'items'), edge(targetsOnce, 'items', pool, 'like'),
          edge(right, 'items', wrong, 'expected'), edge(pool, 'entities', wrong, 'list'),
          edge(right, 'items', answer, 'expected'), edge(wrong, 'distractors', answer, 'distractors'),
          edge(word, 'values', pattern, 'p0'), edge(source, 'values', pattern, 'p1'), edge(pattern, 'text', prompt, 'parts'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer'), edge(trans, 'entities', card, 'explain')
        ])
      };
    }
  },
  {
    /*
      2026-10-18 — DAS WORT ÜBERSETZEN: je Zielsprache eine Karte („house
      (angielski) → polski"), richtig ist jede Übersetzung in diese Sprache —
      aus allen Übersetzungen, in denen das Wort steht.
    */
    id: 'translate-word', get label() { return t('cogitaViewsPresets.tpl.translateWord.label'); },
    get says() { return t('cogitaViewsPresets.tpl.translateWord.says'); },
    needs: ['field', 'second', 'back'], asks: WORD_ASKS,
    make: (kind, lang, text, more) => {
      const tk = text?.key ?? 'text';
      const back = more?.back ?? { kind: '', key: '' };
      const self = node('entity', 0, 0);
      const word = node('field', 0, 150, { key: tk });
      const source = node('field', 0, 300, { key: lang.key });
      const trans = node('entries', 230, 0, { kind: back.kind, key: back.key });
      const words = node('field', 460, 0, { key: back.key });
      const other = node('filter', 690, 0, { key: lang.key });
      const targets = node('field', 920, 150, { key: lang.key });
      const targetsOnce = node('unique', 1150, 150);
      const each = node('each', 1380, 150);
      const inTarget = node('filter', 1610, 150, { key: lang.key });
      const pattern = node('pattern', 1610, 0, { text: '{0} ({1}) → {2}', inputs: 3 });
      const prompt = node('prompt', 1840, 0);
      const answer = node('answer.text', 1840, 150);
      const card = node('card', 2070, 75);
      return {
        name: t('cogitaViewsPresets.tpl.translateWord.name'), kinds: [kind], direction: `${back.key}:wpisz`,
        graph: graphOf([self, word, source, trans, words, other, targets, targetsOnce, each, inTarget, pattern, prompt, answer, card], [
          edge(self, 'entities', trans, 'like'), edge(trans, 'entities', words, 'of'), edge(words, 'values', other, 'items'), edge(source, 'values', other, 'like'),
          edge(other, 'rest', targets, 'of'), edge(targets, 'values', targetsOnce, 'items'), edge(targetsOnce, 'items', each, 'items'),
          edge(other, 'rest', inTarget, 'items'), edge(each, 'item', inTarget, 'like'), edge(inTarget, 'kept', answer, 'expected'),
          edge(word, 'values', pattern, 'p0'), edge(source, 'values', pattern, 'p1'), edge(each, 'item', pattern, 'p2'), edge(pattern, 'text', prompt, 'parts'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer'), edge(trans, 'entities', card, 'explain')
        ])
      };
    }
  },
  {
    id: 'gaps', get label() { return t('cogitaViewsPresets.tpl.gaps.label'); }, get says() { return t('cogitaViewsPresets.tpl.gaps.says'); }, needs: ['field'],
    make: (kind, field) => {
      const text = node('field', 0, 0, { key: field.key });
      const fragments = node('fragments', 230, 0, { min: 7, max: 13 });
      const each = node('each', 460, 0);
      const answer = node('answer.gap', 690, 0);
      const card = node('card', 920, 0);
      return {
        name: t('cogitaViewsPresets.tpl.gaps.name', { field: field.label }), kinds: [kind], direction: `${field.key}:luki`,
        graph: graphOf([text, fragments, each, answer, card], [
          edge(text, 'values', fragments, 'text'), edge(fragments, 'fragments', each, 'items'), edge(each, 'item', answer, 'fragment'),
          edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  }
];

export interface RevisionPreset {
  readonly id: string;
  readonly label: string;
  readonly says: string;
  /** `library` (2026-10-22): nur Einträge dieser Bibliothek oder Baza wiedzy (mit `kind`); `view` (2026-10-30): ein gespeicherter Widok. */
  readonly make: (from?: RevisionFrom) => Record<string, unknown>;
}

export interface RevisionFrom {
  readonly kind?: string;
  readonly library?: string;
  readonly collection?: string;
  readonly view?: string;
}

const revisionGraph = (source: GraphNode, strategy: Record<string, unknown>) => {
  const s = node('strategy', 260, 0, strategy);
  return graphOf([source, s], [edge(source, 'cards', s, 'cards')]);
};

const sourceOf = (from?: RevisionFrom) =>
  from?.kind !== undefined ? node('source.kind', 0, 0, { kind: from.kind, ...(from.library === undefined || from.library === '' ? {} : { from: from.library }) })
    : from?.collection !== undefined ? node('source.collection', 0, 0, { collection: from.collection })
    : from?.view !== undefined ? node('source.view', 0, 0, { view: from.view })
    : node('source.all', 0, 0);

/** Eine Kette: jeder Knoten an den nächsten, von links nach rechts. */
const chain = (nodes: GraphNode[]): Record<string, unknown> => graphOf(nodes, nodes.slice(1).map((n, i) => edge(nodes[i], 'cards', n, 'cards')));

/**
 * 2026-10-30 — „NAJPIERW PODSTAWY" ALS ZUSAMMENSTELLUNG, ohne eigenen Code: „Idź po kolejności nauki" holt, was vorher
 * zu können ist (die Grundlagen der gewählten Karten), „Filtr znajomości" lässt eine Karte erst zu, wenn das, was vor
 * ihr kommt, sitzt — im Lauf, Karte für Karte —, und der „Sposób pytania" nimmt das Allgemeine zuerst. Wo die Baza
 * keine Reihenfolge des Lernens hat, ändert das nichts.
 */
const basicsFirst = (source: GraphNode, strategy: Record<string, unknown>) => chain([
  source,
  node('learning', 230, 0, { dir: 'before', keep: true }),
  node('filter.when', 460, 0, { when: { type: 'knowness', rel: 'before', band: 'learned' } }),
  node('strategy', 690, 0, { order: 'general', ...strategy })
]);

/** 2026-10-30 — „Ucz się od podstaw" (Ścieżka): dieselbe Zusammenstellung über genannte Einträge (oder alles). */
export const basicsRevision = (ids: readonly string[] | null, name: string): Record<string, unknown> => ({
  name, graph: basicsFirst(ids === null ? node('source.all', 0, 0) : node('source.list', 0, 0, { ids: [...ids] }), { mode: 'temporal', stackSize: 20, minCorrectness: 1 })
});

/**
 * 2026-10-30 — „OD OGÓLNEGO DO SZCZEGÓŁU" nach der Struktur: ein Eintrag kommt erst, wenn das, worunter er liegt (ein
 * Abschnitt unter dem Leben, ein Jahr unter dem Abschnitt), sitzt; das Allgemeine zuerst.
 */
const generalToDetail = (source: GraphNode) => chain([
  source,
  node('filter.when', 230, 0, { when: { type: 'knowness', rel: 'up', band: 'learned' } }),
  node('strategy', 460, 0, { mode: 'temporal', stackSize: 20, minCorrectness: 1, order: 'general', pick: 'weighted' })
]);

export const REVISION_PRESETS: readonly RevisionPreset[] = [
  { id: 'temporal', get label() { return t('cogitaViewsPresets.rev.temporal.label'); }, get says() { return t('cogitaViewsPresets.rev.temporal.says'); }, make: (from) => ({ name: t('cogitaViewsPresets.rev.temporal.name'), graph: basicsFirst(sourceOf(from), { mode: 'temporal', stackSize: 20, minCorrectness: 1 }) }) },
  { id: 'random', get label() { return t('cogitaViewsPresets.rev.random.label'); }, get says() { return t('cogitaViewsPresets.rev.random.says'); }, make: (from) => ({ name: t('cogitaViewsPresets.rev.random.name'), graph: revisionGraph(sourceOf(from), { mode: 'random', count: 20, order: 'random' }) }) },
  { id: 'once', get label() { return t('cogitaViewsPresets.rev.once.label'); }, get says() { return t('cogitaViewsPresets.rev.once.says'); }, make: (from) => ({ name: t('cogitaViewsPresets.rev.once.name'), graph: revisionGraph(sourceOf(from), { mode: 'once', order: 'random' }) }) },
  { id: 'levels', get label() { return t('cogitaViewsPresets.rev.levels.label'); }, get says() { return t('cogitaViewsPresets.rev.levels.says'); }, make: (from) => ({ name: t('cogitaViewsPresets.rev.levels.name'), graph: revisionGraph(sourceOf(from), { mode: 'levels', levels: 5, stackSize: 10, minCorrectness: 1 }) }) },
  {
    id: 'due', get label() { return t('cogitaViewsPresets.rev.due.label'); }, get says() { return t('cogitaViewsPresets.rev.due.says'); },
    make: (from) => {
      const source = sourceOf(from);
      const filter = node('filter', 230, 0, { dueOnly: true });
      /* Nur das Fällige — danach ist Schluss, nicht „na zapas". */
      const s = node('strategy', 460, 0, { mode: 'temporal', stackSize: 30, endWhenDone: true });
      return { name: t('cogitaViewsPresets.rev.due.name'), graph: graphOf([source, filter, s], [edge(source, 'cards', filter, 'cards'), edge(filter, 'cards', s, 'cards')]) };
    }
  },
  {
    id: 'gated', get label() { return t('cogitaViewsPresets.rev.gated.label'); }, get says() { return t('cogitaViewsPresets.rev.gated.says'); },
    make: (from) => ({ name: t('cogitaViewsPresets.rev.gated.name'), graph: basicsFirst(sourceOf(from), { mode: 'temporal', stackSize: 20 }) })
  },
  {
    id: 'general', get label() { return t('cogitaViewsPresets.rev.general.label'); }, get says() { return t('cogitaViewsPresets.rev.general.says'); },
    make: (from) => ({ name: t('cogitaViewsPresets.rev.general.name'), graph: generalToDetail(sourceOf(from)) })
  }
];

export interface FlowPreset {
  readonly id: string;
  readonly label: string;
  readonly says: string;
  readonly make: () => Record<string, unknown>;
}

export const FLOW_PRESETS: readonly FlowPreset[] = [
  {
    id: 'story', get label() { return t('cogitaViewsPresets.flow.story.label'); }, get says() { return t('cogitaViewsPresets.flow.story.says'); },
    make: () => {
      const open = node('opening', 0, 0, { title: t('cogitaViewsPresets.flow.story.opening'), mode: 'recall' });
      const show = node('show', 230, 0, { title: t('cogitaViewsPresets.flow.story.show'), of: { slot: 'osoba' } });
      const ask = node('question', 460, 0, { title: t('cogitaViewsPresets.flow.story.ask') });
      const end = node('end', 690, 0);
      return {
        name: t('cogitaViewsPresets.flow.story.name'), look: 'reading', start: open.id, slots: [{ id: 'osoba', label: t('cogitaViewsPresets.flow.story.slot'), kind: 'person' }],
        graph: graphOf([open, show, ask, end], [edge(open, 'next', show, 'in'), edge(show, 'next', ask, 'in'), edge(ask, 'right', end, 'in'), edge(ask, 'wrong', show, 'in')])
      };
    }
  },
  {
    id: 'chapters', get label() { return t('cogitaViewsPresets.flow.chapters.label'); }, get says() { return t('cogitaViewsPresets.flow.chapters.says'); },
    make: () => {
      const hub = node('chapters', 0, 120, { title: t('cogitaViewsPresets.flow.chapters.pick'), chapters: [{ title: t('cogitaViewsPresets.flow.chapters.chapter', { n: 1 }) }, { title: t('cogitaViewsPresets.flow.chapters.chapter', { n: 2 }) }] });
      const a = node('show', 260, 0, { title: t('cogitaViewsPresets.flow.chapters.chapter', { n: 1 }) });
      const aEnd = node('chapterEnd', 490, 0);
      const b = node('show', 260, 240, { title: t('cogitaViewsPresets.flow.chapters.chapter', { n: 2 }) });
      const bEnd = node('chapterEnd', 490, 240);
      const end = node('end', 260, 400);
      return {
        name: t('cogitaViewsPresets.flow.chapters.name'), look: 'slides', start: hub.id,
        graph: graphOf([hub, a, aEnd, b, bEnd, end], [
          edge(hub, 'c0', a, 'in'), edge(a, 'next', aEnd, 'in'), edge(hub, 'c1', b, 'in'), edge(b, 'next', bEnd, 'in'), edge(hub, 'done', end, 'in')
        ])
      };
    }
  },
  {
    id: 'dialogue', get label() { return t('cogitaViewsPresets.flow.dialogue.label'); }, get says() { return t('cogitaViewsPresets.flow.dialogue.says'); },
    make: () => {
      const line = node('line', 0, 0, {});
      const choice = node('choice', 230, 0, { title: t('cogitaViewsPresets.flow.dialogue.question'), options: [{ label: t('cogitaViewsPresets.flow.dialogue.agree'), actions: [{ type: 'add', value: t('cogitaViewsPresets.flow.dialogue.closeness'), by: 1 }] }, { label: t('cogitaViewsPresets.flow.dialogue.dontKnow'), actions: [] }] });
      const yes = node('line', 460, -60, {});
      const no = node('line', 460, 80, {});
      const end = node('end', 690, 0);
      return {
        name: t('cogitaViewsPresets.flow.dialogue.name'), look: 'dialogue', start: line.id,
        graph: graphOf([line, choice, yes, no, end], [edge(line, 'next', choice, 'in'), edge(choice, 'o0', yes, 'in'), edge(choice, 'o1', no, 'in'), edge(yes, 'next', end, 'in'), edge(no, 'next', end, 'in')])
      };
    }
  }
];
