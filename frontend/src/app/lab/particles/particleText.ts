/**
 * PARTIKEL-LABOR — das Polecenie dla AI neben dem Editor: die KI schreibt im
 * eigenen Chat einen Anfangsaufbau, den man hier einfügt (keine KI in der App).
 */

import { SPECIES } from './engine/species';
import { BOILING_SCENE } from './particlePresets';

export function particleDescription(): string {
  const fluids = SPECIES.filter((s) => s.kind === 'substance').map((s) => `${s.id} (${s.name.pl})`).join(', ');
  const solids = SPECIES.filter((s) => s.kind === 'material').map((s) => `${s.id} (${s.name.pl})`).join(', ');
  return [
    'Scena laboratorium cząstek (moduł „Laboratorium cząstek”) — JSON. Silnik liczy wszystko z lokalnych reguł i bazy substancji; scena mówi tylko, co i gdzie stoi na początku (to układ startowy, nie przebieg).',
    'Jednostki: metry (początek układu w lewym dolnym rogu wnętrza skrzynki, y w górę), temperatury w °C, ciśnienie w kPa, moc w W (na grubość warstwy).',
    '',
    '{ "format": "recreatio/particles", "version": 1, "seed": liczba (losowość powtarzalna),',
    '  "box": { "w": szerokość, "h": wysokość, "depth": grubość warstwy 2D (zwykle 0.01) },',
    '  "ambient": { "p": kPa (101.325), "T": °C, "g": m/s² (0 — nieważkość), "air": { "N2": 0.7676, "O2": 0.2324 } },',
    '  "sides": { "left" | "right" | "bottom" | "top": "wall" albo "open" (otwarta strona to pokój) },',
    '  "quality": "low" | "medium" | "high" (rozmiar cząstki 4 / 3 / 2,5 mm),',
    '  "ops": [ kroki budowy po kolei ] }',
    '',
    'Kroki ("op"):',
    '  { "op": "fill", "region": obszar, "composition": { substancja: udział masowy }, "phase": "liquid" | "gas", "T": °C } — wypełnia obszar cieczą albo gazem (to, co było, ustępuje)',
    '  { "op": "erase", "region": obszar } — usuwa wszystko w obszarze; wraca powietrze',
    '  { "op": "solid", "region": obszar, "material": materiał, "T": °C } — nieruchome ciało stałe (ściana, kamyczki wrzenne)',
    '  { "op": "beaker", "x": środek, "y": dół, "w": szerokość, "h": wysokość, "wall": grubość ścianki, "material": "glass" } — zlewka (przekrój)',
    '  { "op": "hotplate", "x": środek, "y": dół, "w", "h", "material": "steel", "mode": "power" | "thermostat", "power": W, "target": °C, "on": true } — płyta grzejna',
    'Obszar: { "rect": [x0, y0, x1, y1] } | { "circle": [x, y, r] } | { "poly": [[x, y], …] } | { "line": [x0, y0, x1, y1], "width": grubość }',
    `Substancje (ciecze i gazy): ${fluids}. Materiały ciał stałych: ${solids}.`
  ].join('\n');
}

export function particlePrompt(): string {
  return [
    'Przygotuj układ startowy JSON dla modułu „Laboratorium cząstek” w REcreatio (szkolna piaskownica 2D z cząstek).',
    'Temat: [opisz, co ma stać w skrzynce, np. „zlewka z wodą na płycie grzejnej i kamyczki wrzenne na dnie”].',
    'Zasady: realne rozmiary (zlewka 7 cm szerokości, płyta 16 cm), rzeczy nie nachodzą na siebie, aparatura stoi na dnie (y = 0) albo na innej rzeczy. Zwróć JEDEN obiekt JSON, bez komentarzy.',
    '',
    particleDescription(),
    '',
    'Przykład:',
    JSON.stringify(BOILING_SCENE, null, 2)
  ].join('\n');
}
