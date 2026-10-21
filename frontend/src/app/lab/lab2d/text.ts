/**
 * LABOR 2D (v2) — das Polecenie dla AI neben dem Editor: die KI schreibt im
 * eigenen Chat einen Anfangsaufbau, den man hier einfügt (keine KI in der App).
 */

import { BOILING_SCENE } from './presets';

export function lab2dDescription(): string {
  return [
    'Scena „Laboratorium 2D” — JSON. Silnik liczy wszystko z praw fizyki i bazy materiałów; scena mówi tylko, co i gdzie stoi na początku (układ startowy, nie przebieg).',
    'Jednostki: metry (początek układu w lewym dolnym rogu wnętrza skrzynki, y w górę), temperatury w °C, ciśnienie w kPa, moc w W (na grubość warstwy).',
    '',
    '{ "format": "recreatio/lab2d", "version": 1, "seed": liczba (losowość powtarzalna),',
    '  "box": { "w": szerokość (0.2), "h": wysokość (0.15), "depth": grubość warstwy 2D (0.01) },',
    '  "ambient": { "p": kPa (101.325), "T": °C, "rh": wilgotność 0–1, "g": m/s² (od 2.45 do 19.6), "air": { "N2": 0.7676, "O2": 0.2324 } },',
    '  "sides": { "left" | "right" | "bottom" | "top": "wall" albo "open" (otwarta strona to pokój) },',
    '  "quality": "high" (komórki 2 mm, zwykle) | "very-high" (1 mm) | "medium" (3 mm),',
    '  "ops": [ kroki budowy po kolei ] }',
    '',
    'Kroki ("op"):',
    '  { "op": "fill", "region": obszar, "composition": { "H2O": 1 }, "phase": "liquid", "T": °C } — ciecz w obszarze: "H2O" (woda) albo "oil-rapeseed" (olej rzepakowy; nie paruje, lżejszy od wody, gęstszy w ruchu); kilka cieczy naraz (udziały masowe) rozkłada się równo i rozdziela się pod wpływem grawitacji; "phase": "gas" z { "N2": 0.7676, "O2": 0.2324 } — powietrze',
    '  { "op": "erase", "region": obszar } — usuwa wodę, pęcherze i ciała stałe; wraca powietrze z pokoju',
    '  { "op": "move", "region": obszar, "dx": m, "dy": m } — przesuwa ciała stałe z obszaru razem z wodą i pęcherzami w nim (o całe komórki); tak zapisuje się narzędzie „Przesuń”',
    '  { "op": "solid", "region": obszar, "material": "glass" | "steel" | "ceramic", "T": °C } — nieruchome ciało stałe (ceramic = kamyczki wrzenne)',
    '  { "op": "beaker", "x": środek, "y": dół, "w": szerokość, "h": wysokość, "wall": grubość ścianki, "material": "glass", "T": °C, "lid": true (opcjonalnie, szczelna pokrywka) } — zlewka (przekrój)',
    '  { "op": "hotplate", "x": środek, "y": dół, "w", "h", "material": "steel", "mode": "power" | "thermostat", "power": W, "target": °C, "on": true, "T": °C } — płyta grzejna',
    'Obszar: { "rect": [x0, y0, x1, y1] } | { "circle": [x, y, r] } | { "poly": [[x, y], …] } | { "line": [x0, y0, x1, y1], "width": grubość }',
    'Ciecz musi mieć swobodną powierzchnię (gaz nad sobą) — całkiem zalany zamknięty obszar zostanie odrzucony.'
  ].join('\n');
}

export function lab2dPrompt(): string {
  return [
    'Przygotuj układ startowy JSON dla modułu „Laboratorium 2D” w REcreatio (szkolna piaskownica: ciepło, wrzenie, parowanie, mgła, woda i olej).',
    'Temat: [opisz, co ma stać w skrzynce, np. „zlewka z gorącą wodą na płycie grzejnej, kamyczki wrzenne na dnie”].',
    'Zasady: realne rozmiary (zlewka 7 cm szerokości, płyta 12 cm), rzeczy nie nachodzą na siebie, aparatura stoi na dnie (y = 0) albo na innej rzeczy, woda wewnątrz zlewki nad jej dnem. Zwróć JEDEN obiekt JSON, bez komentarzy.',
    '',
    lab2dDescription(),
    '',
    'Przykład:',
    JSON.stringify(BOILING_SCENE, null, 2)
  ].join('\n');
}
