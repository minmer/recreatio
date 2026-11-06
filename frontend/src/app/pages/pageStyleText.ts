/* i18n-ignore-file — die Beschreibung eines JSON-Formats (für Sprachmodelle und den Import), polnisch wie alle anderen. */
/**
 * 2026-11-06 — DER ENTWURF DER SEITE IM JSON ("style", `pageStyle.ts`): die Beschreibung neben dem Import der Seite,
 * im Werkzeug `page_format` der Vorschau, und ein Beispiel, das ohne Warnung importiert (`app-page-style-check`).
 */

import { textNode, type JsonNode } from '../core/jsonTree';
import { SCHEMES } from '../core/theme';
import { ALIGNS, CARD_LOOKS, COLOR_KEYS, FONTS } from './pageStyle';

const list = (values: readonly (string | number)[]): string => values.map((v) => `"${v}"`).join(', ');

/** Ein Entwurf, der alles zeigt. */
export const pageStyleExample = () => ({
  scheme: 'forest',
  mode: 'light',
  colors: { ground: '#f4f1ea', accent: '#2f6b4f' },
  font: 'humanist',
  text: 1.05,
  title: { size: 3.5, weight: 800, align: 'center', font: 'serif', spacing: -0.02 },
  band: { height: 22, color: '#1d3b2f', to: '#4f8a6b', angle: 160, image: 'page-image:@las', shade: 0.35, ink: '#ffffff', valign: 'end' },
  width: 72,
  cards: 'shadow',
  corners: 14,
  gap: 1.5,
  moduleTitle: { size: 1.25, color: '#2f6b4f' }
});

const STYLE = (): string => `"style" — projekt strony jako siatki modułów ("mode": "page"): kolory, czcionki, tytuł i tło za nim, szerokość, wygląd modułów. Pominięty — bez zmian; null — strona wraca do wyglądu aplikacji. Każdy klucz jest opcjonalny: czego nie ma, wygląda jak dotąd.

  Kolory (dotyczą całej strony, także nagłówka z menu i stopki):
  "scheme" — rodzina kolorów: ${list(SCHEMES)}; "own" z "hue" (odcień 0–360). Pominięty — kolory, które wybrał odwiedzający.
  "mode" — "light" (zawsze jasna), "dark" (zawsze ciemna), "auto" (jak urządzenie); pominięty — jak wybrał odwiedzający
  "colors" — własne kolory "#rrggbb": ${list(COLOR_KEYS)} (ground — tło strony, surface — tło modułów, ink — tekst, muted — drugi tekst, accent — przyciski i odnośniki, line — linie). Czego brak, wynika z rodziny i z pozostałych kolorów (linie i tła pośrednie są mieszane). Obowiązują w trybie jasnym — a przy "mode": "dark" w ciemnym.
  "night" — te same klucze dla trybu ciemnego, gdy strona idzie za urządzeniem albo odwiedzającym

  Tekst i szerokość:
  "font" — czcionka tekstu: ${list(FONTS)} (tylko czcionki urządzenia, nic nie jest pobierane)
  "text" — mnożnik wielkości tekstu, 0.85–1.4
  "width" — najwyżej tyle rem szerokości (30–160); pominięty — cała szerokość
  "groundImage" — obraz za całą stroną: "page-image:@klucz", "page-image:<id>", "https://…" albo "/…"

  Tytuł strony:
  "title": { "size" (rem, 1–7; zwykle 1.75), "weight" (300–900), "align" (${list(ALIGNS)}), "upper": true (wielkie litery), "spacing" (odstęp liter w em, −0.05–0.4), "color" ("#rrggbb"), "font" (jak "font" — także nagłówki modułów) }

  Tło za tytułem (pas z tytułem i tekstem pod nim):
  "band": { "height" (najmniejsza wysokość w rem, 0–48; 0 — bez pasa), "color", "to" (drugi kolor — gradient), "angle" (kierunek gradientu w stopniach), "image" (obraz jak w "groundImage"), "shade" (przyciemnienie obrazu 0–0.8), "ink" (kolor tekstu na pasie; przy obrazie domyślnie biały), "valign" (${list(ALIGNS)} — tytuł u góry / w środku / na dole pasa), "full": false (w szerokości treści, z zaokrąglonymi rogami; zwykle na całą szerokość okna) }
  Pas pojawia się, gdy jest "height" > 0, "color" albo "image".

  Moduły:
  "cards" — ${list(CARD_LOOKS)} (karty z ramką / płaskie bez tła / sam obrys / z cieniem)
  "corners" — zaokrąglenie rogów modułów (i pasa) w px, 0–40
  "gap" — odstęp między modułami w rem, 0–4 (zwykle 1)
  "moduleTitle": { "size" (rem, 0.7–3), "color" } — nagłówki modułów

Niepoprawne wartości są pomijane z ostrzeżeniem. Przykład:
${JSON.stringify(pageStyleExample(), null, 2)}`;

export const PAGE_STYLE_NODE: JsonNode = textNode('page.style', 'Projekt strony ("style")', STYLE);
