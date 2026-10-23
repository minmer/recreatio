/**
 * GOTOWE SCHEMATY (2026-10-22, Schritt 11; Entscheidungen 11 und 12) — ein
 * Schema mit einem Klick: Rodzaje, Szablony kart und Formularze als EIN
 * Dokument im Format des Schemas (`recreatio.cogita.schema`), angelegt über
 * denselben Import wie eine JSON-Datei (Plan, Rückfrage, dann erst speichern).
 * Danach ist alles gewöhnliche Dokumente der Baza.
 *
 * <code>
 *   Słownik    Język · Słowo (tekst, język) · Tłumaczenie (słowa) · Synonimy · Antonimy —
 *              die Szablony der Słówka passen darauf (z języka na język, jaki to język, w pary,
 *              przetłumacz słowo); eine bestehende Baza mit Słówka bleibt unberührt
 *   Psałterz   Psalm lub pieśń (mit „Miejsce w Piśmie": Biblia + „Ps 110", ein Verweis mit
 *              Stelle) · Miejsce w brewiarzu (tydzień, dzień, godzina, teksty) — mit den
 *              Szablony und Formularze des Brewiarz; der Text der Bibel wird nicht gespeichert
 * </code>
 */

import psalterz from './starts/psalterz.json';
import { TEMPLATE_PRESETS } from './presets';

export interface SchemaStart {
  readonly id: string;
  readonly label: string;
  readonly says: string;
  readonly doc: () => Record<string, unknown>;
}

const template = (id: string, ...args: Parameters<(typeof TEMPLATE_PRESETS)[number]['make']>): Record<string, unknown> => {
  const preset = TEMPLATE_PRESETS.find((p) => p.id === id);
  if (preset === undefined) throw new Error(`brak szablonu ${id}`);
  return preset.make(...args);
};

/** Der Słownik: Wörter mit Sprache, Übersetzungen, Synonyme, Antonyme — und die Słówka-Szablony dazu. */
export function dictionaryDoc(): Record<string, unknown> {
  const words = { key: 'slowa', label: 'Słowa' };
  const lang = { key: 'jezyk', label: 'Język' };
  const text = { key: 'tekst', label: 'Słowo' };
  return {
    format: 'recreatio.cogita.schema',
    version: 1,
    name: 'Słownik',
    kinds: [
      { ref: '@jezyk', name: 'Język', label: '{nazwa}', fields: [
        { key: 'nazwa', label: 'Nazwa', type: 'line' },
        { key: 'kod', label: 'Kod (np. pl, en, la)', type: 'line' }
      ] },
      { ref: '@slowo', name: 'Słowo', label: '{tekst}', tells: 'jezyk', fields: [
        { key: 'tekst', label: 'Słowo', type: 'line' },
        { key: 'jezyk', label: 'Język', type: 'ref', to: ['@jezyk'] },
        { key: 'uwagi', label: 'Uwagi (rodzaj, odmiana, wymowa)', type: 'text' }
      ] },
      { ref: '@tlumaczenie', name: 'Tłumaczenie', label: '{slowa}', fields: [
        { key: 'slowa', label: 'Słowa', type: 'ref', multi: true, to: ['@slowo'], says: 'Słowa w różnych językach, które znaczą to samo' },
        { key: 'kontekst', label: 'W jakim znaczeniu', type: 'line' }
      ] },
      { ref: '@synonimy', name: 'Synonimy', label: '{slowa}', fields: [
        { key: 'slowa', label: 'Słowa', type: 'ref', multi: true, to: ['@slowo'], says: 'Słowa jednego języka o tym samym znaczeniu' }
      ] },
      { ref: '@antonimy', name: 'Antonimy', label: '{slowa}', fields: [
        { key: 'slowa', label: 'Słowa', type: 'ref', multi: true, to: ['@slowo'], says: 'Słowa o przeciwnym znaczeniu' }
      ] }
    ],
    templates: [
      template('languages', '@tlumaczenie', words, lang),
      template('pairs', '@tlumaczenie', words, lang),
      template('which-language', '@slowo', lang, text),
      template('translate-word', '@slowo', lang, text, { back: { kind: '@tlumaczenie', key: 'slowa' } })
    ]
  };
}

export const SCHEMA_STARTS: readonly SchemaStart[] = [
  {
    id: 'slownik', label: 'Słownik: słowo, język, tłumaczenie, synonimy, antonimy',
    says: 'Rodzaje słownika z czterema szablonami kart „Słówka”. Istniejące wpisy i rodzaje zostają, jak są.',
    doc: dictionaryDoc
  },
  {
    id: 'psalterz', label: 'Psałterz: psalmy i pieśni w miejscach brewiarza',
    says: 'Psalm albo pieśń z miejscem w Piśmie (Biblia z biblioteki + „Ps 110”), miejsca brewiarza (tydzień, dzień, godzina) z kolejnymi tekstami, szablony i formularze dodawania. Tekstu Biblii się nie przechowuje.',
    doc: () => psalterz as unknown as Record<string, unknown>
  }
];
