/**
 * 2026-10-18 — DIE CHEMIA IN WORTEN: das Polecenie dla AI neben dem Editor
 * (die KI schreibt im eigenen Chat eine Szene, die man hier einfügt). Eigene
 * Datei: die langen Sätze lädt nur, wer baut.
 */

import { REAGENTS } from './chemData';
import { CHEM_PRESETS } from './chemPresets';
import { KINDS, TOOLS } from './chemSetup';
import { THING_NAME } from './chemThings';

export function chemDescription(): string {
  return [
    'Scena laboratorium chemicznego 2D (moduł „Laboratorium chemiczne”) — JSON. Silnik jest prawdziwą piaskownicą: stół w siatce komórek 4 mm, w każdej komórce temperatura, ciecz (roztwór z prawdziwym pH, rozpuszczalnością i osadami albo stopiony metal), ciała stałe, gazy. Ciepło przepływa (przewodzenie, konwekcja, płomień), metale się topią i krzepną, woda wrze i paruje, gazy unoszą się albo opadają, płomień powstaje tam, gdzie spotyka się gaz palny z tlenem, reakcje zachodzą tam, gdzie spotykają się substancje — każda z prawdziwą szybkością (stężenie, temperatura, katalizator, powierzchnia), niektóre odwracalne (2NO₂ ⇄ N₂O₄, chromian ⇄ dichromian). Kryształy rozpuszczają się szybciej w ciepłej wodzie, przy mieszaniu i rozdrobnione; dyfuzja jest powolna — do takich doświadczeń "speed" 10–300. Scena mówi tylko, CO i GDZIE stoi.',
    'Jednostki: cm (położenie: x — środek, y — dół rzeczy; stół na y = 0), °C, kPa; ilości odczynników: g (ciała stałe), cm³ (roztwory, ciecze, gazy z butli), krople (wskaźniki). Liczby mogą być wyrażeniami "=…" z wartości w "vars"; teksty mogą mieć "{nazwa}".',
    '',
    '"room": { "T": 20, "p": 101.3 } · "world": { "width", "height" } (cm, zwykle niepotrzebne)',
    '"vars": [{ "name": "sol", "pick": ["NaCl-aq", "KI"] }] albo { "name": "m", "from": 1, "to": 3, "step": 0.5 }',
    `"things": [{ "id", "kind": ${KINDS.map((k) => `"${k}"`).join(' | ')}, "x", "y" (bez — stoi na tym, co pod spodem), "on": idTrójnoguStatywuPłyty, "in": idNaczynia (kawałek, termometr, pręt, probówka w łaźni wodnej), "size" (cm³ naczynia; cm pręta/termometru/wysokość świecy; g kawałka), "of" (pręt: "Cu" | "Al" | "Fe" | "glass" | "steel" | "wood"; kawałek: substancja, np. "Sn", "Na", "Field", "ice"), "angle" (stopnie, 180 — odwrócone), "label", "hidden": true (zawartość ukryta), "held": true (trzymane w powietrzu), "fill": [{ "reagent", "amount" }], "T" (°C zawartości — w stanie, jaki ma w tej temperaturze: cyna z \"T\": 260 jest ciekła), "gas": { "CO2": 1 } albo mieszanina { "NO2": 0.4, "N2": 0.6 } (gaz zamiast powietrza, wymieszany i w równowadze), "closed": true (korek; wyskakuje przy ok. 40 kPa nadciśnienia), "lit": true (palnik/płyta włączone, świeca zapalona), "air" (palnik 0–1), "gas" (palnik 0–1), "power" (płyta, W), "stir": true (płyta: mieszadło magnetyczne — miesza ciecz w naczyniu na płycie, także gdy płyta nie grzeje), "height" (trójnóg/statyw) }]`,
    `  rodzaje: ${KINDS.map((k) => `${k} — ${THING_NAME[k]}`).join('; ')}`,
    '"shelf": [id albo grupa] — co jest na półce (bez — wszystko); grupy: metale, kwasy, zasady, sole, tlenki, wskazniki, gazy, inne',
    `"tools": [${TOOLS.map((t) => `"${t}"`).join(', ')}]`,
    '"allow": { "shelf": true, "things": false (dodawanie sprzętu), "move": true (przesuwanie i przelewanie) }',
    '"show": { "values": true (temperatura, pH, ciśnienie pod naczyniami), "composition": true, "micro": true (lupa), "equations": true, "heat": false (widok ciepła od początku) }',
    '"graph": { "things": [idTermometru albo idNaczynia], "of": ["T", "pH", "p"] }',
    '"before": [akcje] — już wykonane przy budowie stołu (bez animacji); "warm": sekundy, które już upłynęły (najwyżej kilkanaście — dłuższy stan lepiej wpisać wprost: temperatury, zawartość) — tak każdy slajd zaczyna się tam, gdzie skończył poprzedni',
    '"steps": [{ "say": "…", "do": akcja albo lista akcji, "wait": sekundy (do 600), "ask": { "q": "…", "options": ["…"], "answer": "tekst opcji", "why": "…" } }]',
    '  akcje: { "add": idOdczynnika, "to": idNaczynia, "amount" } (albo "at": [x, y]) · { "pour": id, "to": id, "ml" } · { "move": id, "to": [x, y] } (albo "on": id, "into": id) · { "burner": id, "on": true, "air": 1, "gas": 0.6 } · { "heat": idPłyty, "on": true, "power": 400, "stir": true } · { "ignite": id } · { "use": narzędzie, "at": id } · { "flame": idPalnika } (drucik do płomienia) · { "tap": idBiurety, "rate": 0.5 } · { "tilt": id, "angle": 90 } · { "speed": 10 }',
    '"speed": 1 — tempo czasu na starcie (do 300); "view": [x0, y0, x1, y1] — co widać (cm)',
    '',
    'Odczynniki (id — nazwa, ilości):',
    ...REAGENTS.map((r) => `  ${r.id} — ${r.name} (${r.amounts.join(', ')} ${r.form === 'indicator' ? 'kropli' : r.solid !== undefined && r.form !== 'gas' ? 'g' : 'cm³'})`)
  ].join('\n');
}

export function chemPrompt(): string {
  const example = CHEM_PRESETS.find((p) => p.key === 'topienie-cyny') ?? CHEM_PRESETS[0];
  return [
    'Przygotuj scenę JSON dla modułu „Laboratorium chemiczne” w REcreatio (szkolne doświadczenie chemiczne w 2D).',
    'Temat: [opisz doświadczenie, np. „topnienie lodu z solą”].',
    'Zasady: realne ilości i sprzęt jak w szkolnej pracowni; rzeczy nie mogą na siebie nachodzić (naczynia stoją obok siebie, zlewka 250 cm³ ma ok. 7 cm szerokości, probówka ok. 2,5 cm, trójnóg 11 cm); jedno zjawisko na scenę; kroki z krótkimi poleceniami po polsku; gdzie ma sens — pytanie z przewidywaniem przed krokiem ("ask"); tylko odczynniki z listy.',
    'Zwróć JEDEN obiekt JSON (sama scena). Bez komentarzy.',
    '',
    chemDescription(),
    '',
    'Przykład:',
    JSON.stringify(example.scene, null, 2)
  ].join('\n');
}
