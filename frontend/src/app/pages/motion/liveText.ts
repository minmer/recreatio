/**
 * 2026-10-17 — DAS BILD ZUM ANFASSEN IN WORTEN: die Beschreibung neben dem
 * Import (`pageJsonText.ts`) und das Polecenie dla AI im Editor der Animacja.
 * Eigene Datei, damit die langen Sätze nur dort geladen werden, wo jemand
 * baut — nie auf einer öffentlichen Seite.
 */

import { exprDescription } from './expr';
import { ACTION_LABEL, BUILTINS, CONTROL_TYPES, LIVE_LIMITS } from './liveModel';

/** Die Beschreibung des Bildes zum Anfassen — aus den Wörterbüchern, damit sie nicht hinter ihnen zurückbleibt. */
export function liveDescription(): string {
  return [
    'Rysunek do poruszania ("animation" z kluczami poniżej) — osoba coś ustawia (suwak, przeciągnięcie, przycisk) i od razu widzi skutek; może też być symulacja (ruch z równań) i cel do osiągnięcia. Tak samo jak lekcje Brilliant: najpierw działanie, potem wyjaśnienie.',
    '',
    'Klucze (obok "size", "symbols", "elements"):',
    `  "vars" — wartości do ustawiania (do ${LIVE_LIMITS.vars}): [{ "name": "kat", "value": 45, "min": 0, "max": 90, "step": 1, "unit": "°", "label": "Kąt", "random": [od, do] }] — "random": przy każdym otwarciu inna wartość z przedziału (w Cogita: przy każdej próbie)`,
    '  "let" — wartości liczone z innych, w tej kolejności, w każdej klatce od nowa: [{ "name": "zasieg", "value": "v0^2*sin(rad(2*kat))/g" }]',
    '  "sim" — symulacja: { "state": [{ "name": "y", "value": "h0" (start), "rate": "vy" (tempo zmiany = pochodna po czasie) }, …],',
    '      "events": [{ "when": "y < 0 && vy < 0", "set": { "y": "-y", "vy": "-e*vy" }, "stop": false, "say": "Odbicie!", "mood": "info" }] — gdy warunek STAJE SIĘ prawdziwy (zderzenie, odbicie, koniec); "set" liczy wszystkie wartości naraz i dopiero wtedy przypisuje,',
    '      "until": "t > 5" (koniec), "dt": 0.002 (krok w s), "speed": 1 (tempo), "auto": true (rusza sama, gdy rysunek widać; inaczej przycisk "run"), "loop": true (od nowa po końcu), "max": 600 (najdłużej, s), "sleep": true (zasypia, gdy nic się już nie rusza, i budzi się przy zmianie) }',
    '      Liczone metodą Runge-Kutta 4. rzędu w stałych krokach — na wolnym telefonie wynik jest ten sam. Zmiana wartości, od której zależy start, zaczyna symulację od nowa; zmiana wartości w "rate" (np. grawitacji) działa od razu.',
    `  "controls" — sterowanie pod rysunkiem (do ${LIVE_LIMITS.controls}), "type": ${CONTROL_TYPES.map((t) => `"${t}"`).join(', ')}:`,
    '      { "type": "slider", "var": "kat", "label": "Kąt", "unit": "°", "digits": 0 } — suwak (zakres i krok z "vars"); "number" — pole liczby;',
    '      { "type": "toggle", "var": "sily", "label": "Pokaż siły" } — przełącznik 0/1; { "type": "choice", "var": "g", "label": "Planeta", "options": [{ "value": 9.81, "label": "Ziemia" }, { "value": 1.62, "label": "Księżyc" }] };',
    `      { "type": "button", "label": "Rzuć!", "do": ${Object.keys(ACTION_LABEL).map((a) => `"${a}"`).join('|')}, "set": { "kat": 45 }, "go": "next" } — przycisk; { "type": "readout", "label": "Zasięg", "value": "zasieg", "unit": "m", "digits": 1 } — odczyt`,
    `  "rules" — reguły (do ${LIVE_LIMITS.rules}): [{ "when": "abs(x - cel) < 0.5 && y <= 0", "say": "Trafione z {fmt(kat,0)}°!", "mood": "ok"|"miss"|"info", "goal": true, "once": true, "set": {…}, "do": "pause", "go": "next" }]`,
    '      działa, gdy warunek STAJE SIĘ prawdziwy (sprawdzany po każdym kroku symulacji — przelot przez obręcz też się liczy); "say" pojawia się pod rysunkiem ({…} — liczone);',
    '      "goal": true — to jest cel: osiągnięty = zadanie rozwiązane (w Cogita: dobra odpowiedź); "go" — w prezentacji: "next" (dalej), "back", klucz sceny albo "link:<id>"; "for": 1 — warunek musi trwać tyle sekund bez przerwy („stabilnie”)',
    '  każdy element sterowania może mieć "show": "solved" — widać go tylko, gdy wyrażenie jest prawdziwe (np. przycisk „Dalej” po rozwiązaniu)',
    '  "panel" — "below" (sterowanie pod rysunkiem, zwykle) albo "side" (obok, gdy rysunek jest szeroki; na telefonie zawsze pod)',
    '',
    'W elementach rysunku:',
    '  każda liczba (x, y, w, h, r, x2, y2, rotate, scale, opacity, width, size) i kolor (fill, stroke) może być wyrażeniem: "x": "=x0 + v*t", "fill": "=trafione ? \'ok\' : \'accent\'"',
    '  "text": "Kąt: {fmt(kat, 0)}°" — napis z wartościami w {…} (albo "=wyrażenie")',
    '  "show": "step >= 1" — widoczny tylko, gdy warunek jest prawdziwy',
    '  "drag": { "x": "cel" } — przeciąganie ustawia wartość na położenie palca (x, y); albo { "set": { "kat": "deg(atan2(py, px))" }, "label": "Kierunek" } — z położenia palca (px, py); "label" dla czytników ekranu. Uchwyt łapie się z 44 px, działa strzałkami z klawiatury',
    '  "tap": "run" albo { "set": { "widac": "1 - widac" }, "do": "toggle", "go": "next", "label": "Odwróć" } — kliknięcie w element (też Enter/spacja)',
    `  "repeat": 20 — tyle kopii elementu; w każdej "i" (0, 1, …) i "n" (ile) — np. cząstki gazu, podziałka (do ${LIVE_LIMITS.repeat})`,
    '  nowe rodzaje: "arrow" (wektor od x, y do x2, y2; "head" — wielkość grotu), "poly" ("points": [[x, y], …] — liczby albo "=…"; "closed": true — wielokąt),',
    `    "plot" (krzywa: "fn": "A*sin(k*u)" — y od u, albo "fx", "fy" — droga; "var" (zwykle "u"), "from", "to", "samples" (do ${LIVE_LIMITS.samples})),`,
    '    "trace" (ślad: "fx": "x", "fy": "y" — co "every" s symulacji punkt, ostatnie "keep" punktów; czyszczony od nowa),',
    '    "frame" (rama ze światem: prostokąt x, y, w, h pokazuje fragment świata "view": [x0, y0, x1, y1] — y rośnie W GÓRĘ, jednostki to np. metry; "axes": { "x": "x [m]", "y": "y [m]", "grid": true }, "clip": true — co wychodzi poza ramę, znika;',
    '      w ramie położenia są w jednostkach świata, a wielkości (r, width, size, head) w jednostkach rysunku; "rect" stoi lewym dolnym rogiem na (x, y); grupa w ramie przesuwa o x, y świata i obraca przeciwnie do wskazówek zegara)',
    '',
    'Świat rzeczy ("world") — gdy rysunek to układ rzeczy, które się dokłada, przesuwa, zawiesza i usuwa (waga z belek i ciężarków, mobil, koła zębate). Nie piszesz gry, tylko opisujesz rodzaje rzeczy, rzeczy na start i reguły:',
    `  "kinds" — rodzaje (do ${LIVE_LIMITS.kinds}): { "name": "belka", "label": "Belka",`,
    '      "props": [{ "name": "pos", "value": 1, "min": 0, "max": "=parent.length", "step": 0.25, "unit": "m", "label": "Miejsce", "apart": 0.25, "new": "parent.pivot + 1", "when": "!isroot" }] — własności z granicami (granice mogą być wyrażeniami; "apart" — odstęp od rodzeństwa; "new" — gdzie stoi nowa rzecz; "when" — kiedy własność dotyczy rzeczy),',
    '      "let": [{ "name": "total", "value": "bm + sum(children, total)" }] — wartości liczone w każdej rzeczy (kolejność wynika sama z tego, co czytają),',
    '      "state": [{ "name": "angle", "value": 0, "rate": "omega" }] i "events" — ruch każdej rzeczy (ten sam Runge-Kutta; "sim" podaje wtedy tylko "dt", "speed", "auto", "sleep"),',
    '      "shapes": [elementy jak w "elements"] — wygląd jednej rzeczy, liczony w niej ("=x" to JEJ x; w ramie — współrzędne świata),',
    '      "drag": { "pos": "parent.pivot + (px - parent.x)*cos(parent.angle)" } — co ustawia przeciąganie (palec w świecie: px, py; uchwyt leży w jej "x", "y", promień "hit"),',
    '      "can": { "edit": ["m", "pos"], "add": ["ciezarek"], "remove": true, "copy": true }, "readouts": [{ "label", "value", "unit", "digits" }] (panel wybranej rzeczy), "children": 8 }',
    '  "things" — rzeczy na start: [{ "id": "w1", "kind": "ciezarek", "parent": "b1", "m": 4, "pos": 1.5, "lock": ["m"] }] — własności wprost; { "random": [od, do] } — losowo (w Cogita przy każdej próbie); "lock": true — nic nie wolno, lista — tych własności nie wolno',
    '  "allow" — co wolno w tym świecie: { "add", "remove", "copy", "edit", "drag" (true/false), "roots": ["belka"] (co wolno postawić na górze) }; "limits": { "things": 40, "depth": 6 }',
    '  "keep": [{ "when": "edits <= 2", "say": "Tylko dwa ruchy!" }] — musi zawsze obowiązywać: zmiana, po której nie obowiązuje, jest cofana; "save": true — warsztat (zapisz, wczytaj, JSON); "hint" — podpowiedź, gdy nic nie wybrano',
    '  W elementach: { "type": "world" } w ramie — tu stoją rzeczy; ramie "camera": true — przybliżanie (Ctrl+kółko, dwa palce, dwuklik) i przesuwanie; "view" liczony z rzeczy, np. "=min(things, bx0)".',
    '  W wyrażeniach rzeczy: parent.x, root.x, w1.x (rzecz po id), outer.x (ta, która podsumowuje); podsumowania sum/avg/min/max/count/all/any po zbiorze: children, descendants, siblings, others, things albo nazwa rodzaju; wbudowane w rzeczy: isroot, depth, index, selected, nchildren; w całym rysunku: edits (ile zmian od „Od nowa”), nthings.',
    '  Każda zmiana (przeciągnięcie, panel, dodanie) idzie przez reguły świata i ma „Cofnij” (Ctrl+Z); w Cogita odpowiedzią jest ułożony świat — odtwarzany według tych samych reguł i sprawdzany symulacją do końca; rozwiązanie: "w2.pos = 5". Wzorzec: przykład „Waga — warsztat”.',
    '',
    `Nazwy wbudowane: ${BUILTINS.map((b) => `"${b}"`).join(', ')} — t: czas symulacji (s), time: czas od pokazania rysunku (s; ruch bez symulacji, np. "y": "=sin(2*time)"), step: miejsce w scenie prezentacji (0 na jej początku, 1 po pierwszym kroku, płynnie pomiędzy — do odsłaniania), i/n: numer kopii i ile kopii, u: bieg krzywej, px/py: palec przy przeciąganiu.`,
    '',
    exprDescription(),
    '',
    'Żeby rysunek był lekki (telefon): do ok. 300 elementów, bez "blur"/"glow" na wielu elementach, "dt" 0.001–0.005, zawsze "until" albo zdarzenie ze "stop", najwyżej 4–6 elementów sterowania. Rysunek liczy się tylko wtedy, gdy coś się zmienia, i staje, gdy go nie widać.',
    'Fizyka — wzorce: rzut (x, y, vx, vy; "rate" vy: "-g"), wahadło (th, om; om: "-g/L*sin(th)"), sprężyna (x, v; v: "-k/m*x - c*v"), równia (a = g*(sin − μ·cos)), zderzenie (zdarzenie, "set" obu prędkości naraz), załamanie (let: kąt z asin(n1/n2*sin)), fala ("plot" z "fn" od u i time).'
  ].join('\n');
}

/** Das Polecenie dla AI — kopiert neben den Import: der Kontext, die Regeln, das Format, ein Beispiel. */
export function livePrompt(example: unknown): string {
  return [
    'Przygotuj JSON rysunku do poruszania dla modułu „Animacja" w REcreatio (strona albo prezentacja; ten sam rysunek może być pytaniem w Cogita).',
    'Temat: [opisz zjawisko, np. „rzut ukośny — uczeń ustawia kąt i trafia w cel”].',
    'Zasady: najpierw osoba coś robi (suwak, przeciągnięcie, przycisk), potem widzi skutek; jedna myśl na rysunek; podpisy po polsku; cel ("goal") tylko gdy to zadanie.',
    'Zwróć JEDEN obiekt JSON z kluczami "alt", "size", "elements" i — według potrzeby — "vars", "let", "sim", "controls", "rules", "panel", "symbols", "world". Bez komentarzy.',
    '',
    liveDescription(),
    '',
    'Przykład:',
    JSON.stringify(example, null, 2)
  ].join('\n');
}
