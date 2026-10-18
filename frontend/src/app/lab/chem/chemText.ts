/**
 * 2026-10-18 — DIE CHEMIA IN WORTEN: das Polecenie dla AI neben dem Editor
 * (die KI schreibt im eigenen Chat eine Szene, die man hier einfügt). Eigene
 * Datei: die langen Sätze lädt nur, wer baut.
 */

import { REAGENTS, VESSELS } from './chemData';
import { CHEM_PRESETS } from './chemPresets';
import { TOOLS } from './chemScene';

export function chemDescription(): string {
  return [
    'Scena laboratorium chemicznego 2D (moduł „Laboratorium chemiczne”) — JSON. Silnik jest gotowy: pH i równowagi (kwasy, zasady, bufory, kompleksy), rozpuszczalność i osady (Ksp zależne od temperatury), metale (z wodą, kwasami, wypieranie), rozkład termiczny, spalanie, gazy (rozpuszczanie, pęcherzyki, wymiana z powietrzem), ciepło reakcji, wrzenie, ciśnienie, piana, płomień. Scena mówi tylko, CO stoi na stole.',
    'Jednostki: cm (położenie), °C, kPa; ilości odczynników: g (ciała stałe), cm³ (roztwory, ciecze, gazy z butli), krople (wskaźniki). Liczby mogą być wyrażeniami "=…" z wartości w "vars"; teksty mogą mieć "{nazwa}".',
    '',
    '"room": { "T": 20, "p": 101.3 }',
    '"vars": [{ "name": "sol", "pick": ["NaCl-aq", "KI"] }] albo { "name": "m", "from": 1, "to": 3, "step": 0.5 } — losowane przy każdym otwarciu',
    `"vessels": [{ "id", "type": ${Object.keys(VESSELS).map((k) => `"${k}"`).join(' | ')}, "size" (cm³), "x" (cm, środek), "label", "hidden": true (zawartość ukryta), "on": idPalnika (stoi na trójnogu), "closed": true (korek), "gauge": true (korek z manometrem), "T" (°C), "fill": [{ "reagent": id, "amount" }], "gas": { "CO2": 1 } (zamiast powietrza), "over": idNaczynia (biureta nad kolbą), "drip" (cm³/s) }]`,
    '"burners": [{ "id", "x", "on": false, "air": true (płomień nieświecący) }]',
    '"links": [{ "from", "to" }] — rurka z korka pierwszego naczynia do drugiego (gaz płynie, gdy ciśnienie pokona słup cieczy; do strzykawki gazowej — mierzy objętość)',
    `"shelf": [id albo grupa] — co jest na półce (bez — wszystko); grupy: metale, kwasy, zasady, sole, tlenki, wskazniki, gazy, inne`,
    `"tools": [${TOOLS.map((t) => `"${t}"`).join(', ')}]`,
    '"allow": { "shelf": true, "vessels": false (dodawanie naczyń), "move": true, "burner": true }',
    '"show": { "values": true (temperatura, pH, ciśnienie pod naczyniami), "composition": true (skład gazu i roztworu), "micro": true (lupa z cząsteczkami), "equations": true } — w zagadkach ustaw composition i micro na false',
    '"graph": { "vessels": [id], "of": ["T", "pH", "p", "gas"] }',
    '"steps": [{ "say": "…", "do": akcja albo lista akcji, "wait": sekundy, "ask": { "q": "…", "options": ["…"], "answer": "tekst opcji" albo "=nazwaLosowana" (numer), "why": "…" } }]',
    '  akcje: { "add": idOdczynnika, "to": idNaczynia, "amount" } · { "pour": id, "to": id, "ml" } · { "burner": id, "on": true } · { "use": narzędzie, "at": id } · { "flame": idPalnika, "with": "loop"|"spoon" } · { "link": [id, id] } · { "seat": id, "on": idPalnika } (bez "on" — zdejmij z palnika) · { "drip": idBiurety, "rate": 0.5 } · { "speed": 10 }',
    '"speed": 1 — tempo czasu na starcie; "view": [x0, y0, x1, y1] — co widać (cm; stół na y = 0)',
    '',
    'Odczynniki (id — nazwa, ilości):',
    ...REAGENTS.map((r) => `  ${r.id} — ${r.name} (${r.amounts.join(', ')} ${r.form === 'indicator' ? 'kropli' : r.solid !== undefined && r.form !== 'gas' ? 'g' : 'cm³'})`)
  ].join('\n');
}

export function chemPrompt(): string {
  const example = CHEM_PRESETS.find((p) => p.key === 'woda-wapienna') ?? CHEM_PRESETS[0];
  return [
    'Przygotuj scenę JSON dla modułu „Laboratorium chemiczne” w REcreatio (szkolne doświadczenie chemiczne w 2D).',
    'Temat: [opisz doświadczenie, np. „otrzymywanie tlenu z nadmanganianu potasu”].',
    'Zasady: realne ilości jak w szkolnej pracowni; jedno zjawisko na scenę; kroki z krótkimi poleceniami po polsku; gdzie ma sens — pytanie z przewidywaniem przed krokiem ("ask"); tylko odczynniki z listy.',
    'Zwróć JEDEN obiekt JSON (sama scena). Bez komentarzy.',
    '',
    chemDescription(),
    '',
    'Przykład:',
    JSON.stringify(example.scene, null, 2)
  ].join('\n');
}
