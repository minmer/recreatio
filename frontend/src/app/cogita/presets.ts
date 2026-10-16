/**
 * COGITA — GOTOWE POCZĄTKI: Kartenvorlagen, Wiederholungen und Abläufe, die
 * man mit einem Klick anlegt und dann nach Belieben ändert. Kein eigener
 * Mechanismus: was hier entsteht, ist ein gewöhnliches Dokument der
 * Bibliothek (`template`, `revision`, `flow`), genau wie ein selbst gebautes.
 *
 * Die alten Vorlagen der Bibliotheken (Wörter, Karte des Wissens, Kurs,
 * Forschung, Karteikarten) sind hier Anfänge [F05, F45].
 */

import { graphJson, type Graph, type GraphEdge, type GraphNode } from './graph';

let seq = 0;
const node = (type: string, x: number, y: number, config: Record<string, unknown> = {}): GraphNode => ({ id: `n${(seq += 1)}`, type, x, y, config });
const edge = (from: GraphNode, out: string, to: GraphNode, into: string): GraphEdge => ({ id: `e${(seq += 1)}`, from: from.id, out, to: to.id, in: into });
const graphOf = (nodes: GraphNode[], edges: GraphEdge[]): Record<string, unknown> => graphJson({ nodes, edges } satisfies Graph);

export interface TemplatePreset {
  readonly id: string;
  readonly label: string;
  readonly says: string;
  /** Wie viele Felder er braucht und welche (für die Auswahl im Editor). */
  readonly needs: readonly ('field' | 'second' | 'date')[];
  readonly make: (kindId: string, field: { key: string; label: string }, second?: { key: string; label: string }) => Record<string, unknown>;
}

export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  {
    id: 'ask', label: 'Pytanie o pole', says: '„Rok urodzenia: Mickiewicz?" — wpisz wartość pola.', needs: ['field'],
    make: (kind, field) => {
      const self = node('entity', 0, 0);
      const value = node('field', 0, 140, { key: field.key });
      const pattern = node('pattern', 230, 0, { text: `${field.label}: {0}?`, inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.text', 460, 140);
      const card = node('card', 690, 60);
      return {
        name: `${field.label} (wpisz)`, kinds: [kind], direction: `${field.key}`,
        graph: graphOf([self, value, pattern, prompt, answer, card], [
          edge(self, 'entities', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'), edge(value, 'values', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'reverse', label: 'Odwrotnie: kto to?', says: 'Pokazuje wartość pola, pyta o wpis („Kto urodził się w 1798?").', needs: ['field'],
    make: (kind, field) => {
      const self = node('entity', 0, 140);
      const value = node('field', 0, 0, { key: field.key });
      const pattern = node('pattern', 230, 0, { text: `Kto lub co — ${field.label.toLowerCase()}: {0}?`, inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.text', 460, 140);
      const card = node('card', 690, 60);
      return {
        name: `Kto: ${field.label}`, kinds: [kind], direction: `${field.key}→`,
        graph: graphOf([self, value, pattern, prompt, answer, card], [
          edge(value, 'values', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'), edge(self, 'entities', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'choose', label: 'Wybór z czterech', says: 'Poprawna wartość pola i trzy wartości tego pola z innych wpisów.', needs: ['field'],
    make: (kind, field) => {
      const self = node('entity', 0, 0);
      const value = node('field', 0, 140, { key: field.key });
      const wrong = node('distractors', 230, 200, { key: field.key, count: 3, from: ['field'] });
      const pattern = node('pattern', 230, 0, { text: `${field.label}: {0}?`, inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.one', 460, 160);
      const card = node('card', 690, 60);
      return {
        name: `${field.label} (wybór)`, kinds: [kind], direction: `${field.key}:wybor`,
        graph: graphOf([self, value, wrong, pattern, prompt, answer, card], [
          edge(self, 'entities', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'),
          edge(value, 'values', answer, 'expected'), edge(value, 'values', wrong, 'expected'), edge(wrong, 'distractors', answer, 'distractors'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'date', label: 'Data', says: 'Kiedy? — z dokładnością do roku, miesiąca albo dnia.', needs: ['date'],
    make: (kind, field) => {
      const self = node('entity', 0, 0);
      const value = node('field', 0, 140, { key: field.key });
      const pattern = node('pattern', 230, 0, { text: `${field.label}: {0} — kiedy?`, inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.date', 460, 140, { precision: 'year', tolerance: 0 });
      const card = node('card', 690, 60);
      return {
        name: `${field.label} (data)`, kinds: [kind], direction: `${field.key}:data`,
        graph: graphOf([self, value, pattern, prompt, answer, card], [
          edge(self, 'entities', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'), edge(value, 'values', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'flash', label: 'Fiszka', says: 'Na przodzie pole pierwsze, z tyłu drugie — oceniasz się sam.', needs: ['field', 'second'],
    make: (kind, field, second) => {
      const front = node('field', 0, 0, { key: field.key });
      const back = node('field', 0, 140, { key: second?.key ?? field.key });
      const prompt = node('prompt', 230, 0);
      const answer = node('answer.flash', 230, 140);
      const card = node('card', 460, 60);
      return {
        name: `Fiszka: ${field.label} → ${second?.label ?? field.label}`, kinds: [kind], direction: `${field.key}→${second?.key ?? field.key}`,
        graph: graphOf([front, back, prompt, answer, card], [
          edge(front, 'values', prompt, 'parts'), edge(back, 'values', answer, 'back'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'vocabulary', label: 'Słówko (każde tłumaczenie osobno)', says: 'Jedna karta dla każdej wartości drugiego pola — każde tłumaczenie.', needs: ['field', 'second'],
    make: (kind, field, second) => {
      const word = node('field', 0, 0, { key: field.key });
      const translations = node('field', 0, 140, { key: second?.key ?? field.key });
      const each = node('each', 230, 140);
      const pattern = node('pattern', 230, 0, { text: 'Przetłumacz: {0}', inputs: 1 });
      const prompt = node('prompt', 460, 0);
      const answer = node('answer.text', 460, 140);
      const card = node('card', 690, 60);
      return {
        name: `Słówko: ${field.label} → ${second?.label ?? ''}`, kinds: [kind], direction: `${field.key}→${second?.key ?? ''}`,
        graph: graphOf([word, translations, each, pattern, prompt, answer, card], [
          edge(word, 'values', pattern, 'p0'), edge(pattern, 'text', prompt, 'parts'),
          edge(translations, 'values', each, 'items'), edge(each, 'item', answer, 'expected'),
          edge(prompt, 'prompt', card, 'prompt'), edge(answer, 'answer', card, 'answer')
        ])
      };
    }
  },
  {
    id: 'gaps', label: 'Luki w cytacie', says: 'Dzieli tekst na kawałki i pyta o każdy — najpierw kawałki, potem całość.', needs: ['field'],
    make: (kind, field) => {
      const text = node('field', 0, 0, { key: field.key });
      const fragments = node('fragments', 230, 0, { min: 7, max: 13 });
      const each = node('each', 460, 0);
      const answer = node('answer.gap', 690, 0);
      const card = node('card', 920, 0);
      return {
        name: `Luki: ${field.label}`, kinds: [kind], direction: `${field.key}:luki`,
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
  readonly make: (from?: { kind?: string; topic?: string; collection?: string }) => Record<string, unknown>;
}

const revisionGraph = (source: GraphNode, strategy: Record<string, unknown>) => {
  const s = node('strategy', 260, 0, strategy);
  return graphOf([source, s], [edge(source, 'cards', s, 'cards')]);
};

const sourceOf = (from?: { kind?: string; topic?: string; collection?: string }) =>
  from?.kind !== undefined ? node('source.kind', 0, 0, { kind: from.kind })
    : from?.topic !== undefined ? node('source.topic', 0, 0, { topic: from.topic, depth: 9 })
    : from?.collection !== undefined ? node('source.collection', 0, 0, { collection: from.collection })
    : node('source.all', 0, 0);

export const REVISION_PRESETS: readonly RevisionPreset[] = [
  { id: 'temporal', label: 'Według tego, co umiem', says: 'Najpierw to, co się zaciera, potem nowe — stos po 20.', make: (from) => ({ name: 'Powtórka codzienna', graph: revisionGraph(sourceOf(from), { mode: 'temporal', stackSize: 20, minCorrectness: 1 }) }) },
  { id: 'random', label: '20 losowych', says: 'Dwadzieścia kart, każda raz.', make: (from) => ({ name: '20 losowych', graph: revisionGraph(sourceOf(from), { mode: 'random', count: 20, order: 'random' }) }) },
  { id: 'once', label: 'Wszystko raz', says: 'Cały zbiór, każda karta raz — sprawdzian.', make: (from) => ({ name: 'Wszystko raz', graph: revisionGraph(sourceOf(from), { mode: 'once', order: 'random' }) }) },
  { id: 'levels', label: 'Poziomy', says: 'Dobra odpowiedź podnosi kartę o poziom, zła wraca na pierwszy; koniec, gdy wszystko na górze.', make: (from) => ({ name: 'Poziomy', graph: revisionGraph(sourceOf(from), { mode: 'levels', levels: 5, stackSize: 10, minCorrectness: 1 }) }) },
  {
    id: 'due', label: 'Tylko zaległe', says: 'Tylko karty, na które przyszła pora, według znajomości.',
    make: (from) => {
      const source = sourceOf(from);
      const filter = node('filter', 230, 0, { dueOnly: true });
      const s = node('strategy', 460, 0, { mode: 'temporal', stackSize: 30 });
      return { name: 'Zaległe', graph: graphOf([source, filter, s], [edge(source, 'cards', filter, 'cards'), edge(filter, 'cards', s, 'cards')]) };
    }
  },
  {
    id: 'gated', label: 'Najpierw podstawy', says: 'Karta wchodzi dopiero, gdy to, czego wymaga, jest opanowane.',
    make: (from) => {
      const source = sourceOf(from);
      const gate = node('gate', 230, 0, { threshold: 1 });
      const s = node('strategy', 460, 0, { mode: 'temporal', stackSize: 20 });
      return { name: 'Od podstaw', graph: graphOf([source, gate, s], [edge(source, 'cards', gate, 'cards'), edge(gate, 'cards', s, 'cards')]) };
    }
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
    id: 'story', label: 'Opowieść o osobie (szablon)', says: 'Przypomnienie, wpis osoby z miejsca {osoba}, pytanie, koniec — do użycia z różnymi osobami.',
    make: () => {
      const open = node('opening', 0, 0, { title: 'Na początek', mode: 'recall' });
      const show = node('show', 230, 0, { title: 'Kim był?', of: { slot: 'osoba' } });
      const ask = node('question', 460, 0, { title: 'Sprawdź się' });
      const end = node('end', 690, 0);
      return {
        name: 'Opowieść o osobie', look: 'reading', start: open.id, slots: [{ id: 'osoba', label: 'Osoba', kind: 'person' }],
        graph: graphOf([open, show, ask, end], [edge(open, 'next', show, 'in'), edge(show, 'next', ask, 'in'), edge(ask, 'right', end, 'in'), edge(ask, 'wrong', show, 'in')])
      };
    }
  },
  {
    id: 'chapters', label: 'Kurs z rozdziałami', says: 'Wybór rozdziału, w każdym treść i pytanie; kończy się, gdy wszystkie przerobione.',
    make: () => {
      const hub = node('chapters', 0, 120, { title: 'Wybierz rozdział', chapters: [{ title: 'Rozdział 1' }, { title: 'Rozdział 2' }] });
      const a = node('show', 260, 0, { title: 'Rozdział 1' });
      const aEnd = node('chapterEnd', 490, 0);
      const b = node('show', 260, 240, { title: 'Rozdział 2' });
      const bEnd = node('chapterEnd', 490, 240);
      const end = node('end', 260, 400);
      return {
        name: 'Kurs', look: 'slides', start: hub.id,
        graph: graphOf([hub, a, aEnd, b, bEnd, end], [
          edge(hub, 'c0', a, 'in'), edge(a, 'next', aEnd, 'in'), edge(hub, 'c1', b, 'in'), edge(b, 'next', bEnd, 'in'), edge(hub, 'done', end, 'in')
        ])
      };
    }
  },
  {
    id: 'dialogue', label: 'Rozmowa z postacią', says: 'Postać mówi, uczący się wybiera odpowiedź; wybór zmienia bliskość.',
    make: () => {
      const line = node('line', 0, 0, {});
      const choice = node('choice', 230, 0, { title: 'Co odpowiesz?', options: [{ label: 'Zgadzam się', actions: [{ type: 'add', value: 'bliskość', by: 1 }] }, { label: 'Nie wiem', actions: [] }] });
      const yes = node('line', 460, -60, {});
      const no = node('line', 460, 80, {});
      const end = node('end', 690, 0);
      return {
        name: 'Rozmowa', look: 'dialogue', start: line.id,
        graph: graphOf([line, choice, yes, no, end], [edge(line, 'next', choice, 'in'), edge(choice, 'o0', yes, 'in'), edge(choice, 'o1', no, 'in'), edge(yes, 'next', end, 'in'), edge(no, 'next', end, 'in')])
      };
    }
  }
];
