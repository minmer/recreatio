/**
 * Die Beschreibung neben jedem JSON-Fach (0064): wozu, welche Schlüssel, ein Beispiel — für Seite, Präsentation, Teil, Modul.
 */

import { QUESTION_EXAMPLE, QUESTION_KEYS } from '../forms/formJson';
import { motionDescription } from './motion/motion';
import { liveDescription } from './motion/liveText';
import { MODULE_FORMAT, PAGE_FORMAT } from './pageJson';
import { GATE_KINDS, INPUT_KINDS, PAGE_NODE_LABEL } from './pageLogic';
import { subjectDescription } from './pageSubject';
import type { PartModule } from './part';
import { PARTS, partOf } from './parts/registry';
import { DEFAULT_THEMES } from './slides/slideLook';

/* -- Die Beschreibung ------------------------------------------------------------- */

const keyLines = (keys: Readonly<Record<string, string>>, indent = '  '): string =>
  Object.entries(keys).map(([key, says]) => `${indent}"${key}" — ${says}`).join('\n');

const pretty = (value: unknown): string => JSON.stringify(value, null, 2);

/** Ein Abschnitt je Art: wozu, welche Schlüssel, ein Beispiel. */
export function kindSection(def: PartModule): string {
  const flags = [
    def.takes ? 'przyjmuje zgłoszenia' : null,
    def.fullscreen ? 'można otworzyć na pełnym ekranie' : null,
    def.Editor !== null ? 'w edytorze: własny edytor list' : null
  ].filter((one) => one !== null);
  return [
    `### "${def.kind}" — ${def.label}${def.retired === undefined ? '' : ' (WYCOFANY — nie dodawaj; ' + def.retired + ')'}`,
    def.use + (flags.length === 0 ? '' : ` (${flags.join('; ')})`),
    `Domyślny rozmiar: ${def.box.colSpan}×${def.box.rowSpan}.`,
    '"config":',
    keyLines(def.json.keys),
    'Przykład "config":',
    pretty(def.json.example)
  ].join('\n');
}

const LAYERS = `Warstwy tła ("cover" strony, "slide.layers" modułu) — od tyłu do przodu:
  { "kind": "gradient", "speed": 0.12, "angle": 168, "from": "#12203a", "via": null, "to": "#060a12" }
  { "kind": "image", "speed": 0.34, "url": "https://…/tlo.jpg", "opacity": 0.45, "blend": "normal"|"multiply"|"screen"|"overlay"|"soft-light", "position": "center" }
  { "kind": "bigtext", "speed": 0.95, "lines": ["TRASA"], "opacity": 0.1, "color": null }
  { "kind": "glow", "speed": 0.12, "color": "rgba(120, 170, 220, 0.18)", "x": 58, "y": 42, "size": 60, "opacity": 1, "blend": "normal" } — poświata: miękka plama światła; "x", "y" — środek w %, "size" — gdzie gaśnie (% odległości do najbliższej krawędzi)
  { "kind": "vignette", "speed": 0, "strength": 0.35, "reach": 55, "color": "#000000" } — ciemne rogi: od "reach" % drogi do rogu ciemniej, w rogu "strength"
  { "kind": "haze", "speed": 0.08, "color": "rgba(120, 170, 220, 0.08)", "depth": "rgba(30, 60, 100, 0.1)", "blur": 60, "opacity": 0.35, "motion": { "name": "drift" } } — mgła: dwie ciemne plamy ("depth") i jasna smuga ("color"), mocno rozmyte, dryfują
  { "kind": "mesh", "speed": 0.05, "seed": 7, "count": 4, "color": "rgba(143, 208, 255, 0.25)", "glow": "rgba(167, 224, 255, 0.35)", "center": 0.82, "amplitude": 1, "opacity": 0.9, "dust": true, "motion": { "name": "sway" } } — nici: świecące linie fal nad dolną krawędzią z pyłem; "count" warstw, każda faluje po swojemu ("sway": 180–400 s); "center" — wysokość fali (0 góra, 1 dół)
  { "kind": "waves", "speed": 0.05, "seed": 7, "count": 6, "hue": 188, "spread": 32, "opacity": 1, "blur": 1, "motion": [] } — fale: rozmyte pasma przy dole z jasnymi brzegami (barwa "hue"…"hue"+"spread"); w pokazie Cogita stoją — z "motion": { "name": "wave" } płyną
  "speed" 0–1 — jak wolno warstwa przesuwa się przy przewijaniu; "opacity" 0–1. Obraz może być plikiem strony: "page-image:<id>".
  Kolory warstw mogą być nazwami: "ground", "accent", "ink", "muted" — wtedy idą za kolorami slajdów. "seed" — ta sama liczba daje ten sam obraz za każdym razem; "motion" — ruch warstwy (niżej: Ruch), "[]" — stoi.

Slajd modułu ("slide") — wszystko poza "label" i "layers" jest nieobowiązkowe:
  "transition" — jak ten slajd zastępuje poprzedni: "scroll" (wjeżdża od dołu, zwykłe), "fade" (przenika), "cover" (nakrywa poprzedni, który przygasa), "reveal" (poprzedni odjeżdża i go odsłania), "zoom" (przybliżenie), "side" (z prawej), "dissolve" (rozmycie: poprzedni gaśnie, rozmywa się i opada o 12 px, ten wyostrza się, unosząc — jak pokaz Cogita). Idzie za przewijaniem, nie za zegarem
  "enter" — jak pojawia się treść: "none", "rise", "fade", "zoom", "left", "right"
  "colors" — własne kolory slajdu, przechodzą płynnie między slajdami: { "accent", "ink", "ground", "muted" } ("#rrggbb"; pominięty — jak strona)
  "stage" — moduł NIE ma własnego slajdu: stoi nad wszystkimi i przy zmianie slajdu przesuwa się na swoje miejsce na następnym:
      { "frames": { "<id modułu-slajdu albo "cover">": { "x": 50, "y": 50, "w": 30, "scale": 1, "rotate": 0, "opacity": 1 } }, "bare": false }
      "x", "y" — środek w procentach sceny; "w" — szerokość w procentach; między slajdami z miejscem przesuwa się płynnie, przed pierwszym i po ostatnim stoi; "bare": true — bez ramki (logo, obraz)
      "max" — najwyżej tyle szerokości w rem (logo zostaje logo na dużym ekranie); "tall" — inne wartości na ekranie wyższym niż szeroki (telefon): { "x", "y", "w", "scale", "rotate", "opacity" } — tylko te, które się różnią; z własnym "w" na telefonie liczy się dokładnie ono
  "motion" — ruch modułu na jego slajdzie albo na scenie (niżej: Ruch), np. { "name": "rise", "delay": 220 } — tekst unosi się po dotarciu slajdu
  "layout" — gdzie stoi treść slajdu: { "align": "start"|"center"|"end", "valign": "start"|"center"|"end", "width": 68, "tall": { "align", "valign", "width" } } — "width" w procentach sceny (szerokość sceny — "deck.width"); "tall" — na telefonie; pominięte — na środku, wygodna szerokość tekstu
  "with" — moduł NIE ma własnego slajdu: stoi obok innego na jego slajdzie, w jednym rzędzie: { "slide": "<id modułu>", "side": "end"|"start", "share": 42, "tallSide": "start"|"end" } — "side" po prawej / po lewej, "share" — % szerokości rzędu, "tallSide" — na telefonie nad nim / pod nim (obraz, animacja obok tekstu); "with": "<id>" też wystarczy`;

const PRESENTATION = `## Prezentacja ("mode": "presentation")
Sceny to ekrany; moduły stoją na nich w dowolnym miejscu. Scena może mieć kilka kroków — wtedy wyróżnienie przechodzi z modułu na moduł, a scena idzie za wyróżnionym. Moduł z miejscem na kilku scenach wędruje: przy zmianie sceny przechodzi płynnie na swoje następne miejsce. Wszystko idzie za przewijaniem (kółko, palec, strzałki), w „Pokazie” — za klawiaturą i kliknięciem.
Wewnątrz sceny moduł może zmieniać się z jej POSTĘPEM ("frames" miejsca): duże zdjęcie maleje do kadru, przesuwa się, odsłania przez maskę — przewijanie wstecz cofa zmianę, zatrzymanie ją zatrzymuje, a koło, palec, klawiatura i pokaz poruszają ten sam postęp. Im więcej "steps" ma scena, tym dłuższa jej droga.
Sceny nie muszą iść po kolei: każda ma jedno wejście i wyjścia — „dalej” (strzałki, przewijanie: "next") i przyciski (moduły z "go"). Wyjście prowadzi do sceny, do końca ("end") albo na zewnątrz ("link:<id>" z "links"). Kto naciśnie przycisk, idzie dalej tą drogą; wstecz — drogą, którą przyszedł.

"show" strony:
  "format" — "screen" (cały ekran, jak strona startowa; na telefonie pionowo — z miejscami "tall"), "wide" (16:9), "classic" (4:3)
  "fonts" — pismo: "app", "spectral" (Spectral + IBM Plex Sans), "cormorant" (Cormorant Garamond + Source Sans), "plex" (IBM Plex Sans)
  "nav" — pasek scen: "labels" (nazwy u góry), "dots" (kropki z prawej), "none"
  "links" — drogi na zewnątrz: [{ "id": "zapisy", "label": "Zapisz się", "href": "https://…" | "#/strona" | "mailto:…" }] — wyjście sceny albo przycisku prowadzi tam przez "link:<id>"
  "width" — najwyżej tyle rem szerokości sceny: w niej liczą się miejsca modułów (x, y w procentach), tło zostaje na całym ekranie (np. 80 — jak pokaz Cogita); pominięte — całe okno
  "sound" — dźwięk otoczenia (ogień, liście), tylko na życzenie widza: { "url": "page-image:<id>" | "https://…/ogrod.mp3", "label": "Odgłosy ogrodu", "volume": 0.6 } — w pasku na dole jest przycisk z "label"; bez kliknięcia nic nie gra; gra w kółko, cichnie, gdy karta jest ukryta. Plik: MP3, M4A, OGG albo WAV (plik strony do 30 MB). Głośność na scenie — "volume" sceny
  "backdrop" — tło wspólne: warstwy (jak przy slajdach: "gradient", "image", "glow", "vignette", "haze", "mesh", "waves" …), które stoją za wszystkimi scenami; sceny są wtedy przezroczyste, a ich własne tło (kolor "ground", warstwy "layers") leży w nim i przechodzi płynnie w tło następnej
  "map" — gdzie stoją sceny na mapie przejść w edytorze: { "<klucz sceny>" | "link:<id>" | "gate:<klucz>" | "end": { "x", "y" } } — tylko dla edytora
  "story" — PRZEBIEG (jak w Cogicie): pytania, warunki, wartości; prezentacja z modułem "question" ma go zawsze (wtedy odpowiedzi zostają w przeglądarce). { "base": "<id bazy wiedzy>", "storage": "<id obszaru>", "values": [...], "gates": [...] }
    "base" — baza wiedzy (Cogita), w której liczą się odpowiedzi zalogowanych (i osób z formularza); pominięte — przykład: odpowiedzi, wartości i miejsce, w którym ktoś skończył, zostają tylko w przeglądarce
    "storage" — obszar (z przyjmowaniem), do którego trafiają odpowiedzi; pominięte — prywatny obszar osoby
    "values" — [{ "id": "pkt", "label": "Punkty", "start": 0, "min": 0, "max": 10 }] — wartości przebiegu (punkty, bliskość postaci)
    w bazie wiedzy ten sam przebieg to przebieg {"look": "scenes", "presentation": "<adres tej strony>"} (Prezentacja → Przejścia → „Przebieg w Nauce”): w Nauce gra tę prezentację, odpowiedzi i miejsce liczą się w bazie — bez kopii
    "gates" — bramki między scenami; wyjście sceny, przycisku albo pytania prowadzi do bramki przez "gate:<klucz>":
      { "key": "czy-umie", "label": "Umie?", "type": "condition", "when": { "type": "answered", "of": "<id modułu pytania>", "correct": true }, "yes": "<klucz sceny>", "no": "<klucz sceny>" } — warunek (jak w Cogicie: "answered", "value" { "value": "pkt", "op": "ge", "than": 3 }, "visited" { "of": "<klucz sceny>" }, "knowness", "time", "and"/"or"/"not" z "items")
      { "key": "punkt", "type": "set", "actions": [{ "type": "add", "value": "pkt", "by": 1 } | { "type": "set", "value": "pkt", "to": 0 }], "next": "<cel>" } — zmienia wartości, potem prowadzi dalej
  "scenes" — lista scen w kolejności:
    "key" — klucz sceny (krótki, unikalny, np. "start"); miejsca modułów wskazują scenę po kluczu
    "label" — nazwa w pasku; link "#nazwa" w tekście prowadzi do tej sceny
    "steps" — ile kroków (postojów) ma scena; domyślnie 1
    "change" — jak zastępuje poprzednią: "fade" (przenikanie), "build" (scena jest od razu, jej moduły wchodzą każdy po swojemu — "arrive"), "fly" (kamera przelatuje przez POPRZEDNIĄ scenę — jej moduły z głębią i chmurę słów), "rise", "zoom", "cover", "reveal", "side", "cut", "dissolve" (rozmycie: poprzednia gaśnie, rozmywa się i opada o 12 px, ta wyostrza się, unosząc — jak pokaz Cogita)
    "keep" — true: poprzednia scena zostaje pod spodem, aż przejście się skończy (przy "fade", "build", "rise")
    "duration" — ile trwa skok do tej sceny w ms (domyślnie 700, przy "fly" 1700)
    "colors" — { "accent", "ink", "ground" (tło sceny), "muted" } — pominięte: jak cała prezentacja
    "layers" — warstwy tła (jak przy slajdach, bez przesuwania)
    "grow" — { "from": 0.8, "to": 1.08 } — scena rośnie od wejścia do ostatniego kroku
    "follow" — { "wide": 0.45, "tall": 1 } — jak mocno scena przesuwa się, by wyróżniony moduł stał w środku (szeroki / wąski ekran)
    "emphasis" — false: kroki nie wyróżniają modułów (domyślnie true: niewyróżnione bledną i odsuwają się od środka)
    "thread" — nitka przez moduły z krokami, w kolejności kroków: "none", "line", "dots"
    "hint" — mała podpowiedź na dole (np. "Przewiń"); znika, gdy ruszysz dalej
    "words" — chmura słów w głębi: { "list": ["colligere", …], "prefix": "RE", "count": 39, "seed": 7, "color": null }
    "depth" — { "perspective": 1000, "travel": 2200, "linger": true } — głębia sceny i jak daleko przelatuje kamera; "linger" — zwalnia przy najgłębszym module
    "next" — dokąd prowadzi „dalej” (strzałki, przewijanie): klucz sceny, "end" (tu koniec) albo "link:<id>"; pominięte — następna scena na liście
    "volume" — jak głośny jest dźwięk otoczenia ("sound") na tej scenie, 0–1 (pominięte — 1; 0 — cisza); między scenami przechodzi płynnie

"show" modułu:
  "places" — { "<klucz sceny>": miejsce } — jedno miejsce: moduł należy do tej sceny; kilka: wędruje
    miejsce: { "x": 50, "y": 50, "w": 30, "h": null, "max": null, "rotate": 0, "scale": 1, "opacity": 1, "z": 0, "step": null, "tall": null }
      "x", "y" — punkt modułu (zwykle środek — zob. "origin") w procentach sceny; "w" — szerokość w procentach szerokości; "h" — wysokość w procentach wysokości (null — jak treść)
      "max" — najwyżej tyle szerokości w rem (np. 22): na dużym ekranie moduł nie rośnie dalej, na telefonie bierze "w" procent
      "z" — głębia w pikselach (0 płasko, −980 daleko); "step" — w którym kroku sceny jest wyróżniony (od 0)
      "tall" — inne wartości na wąskim ekranie: { "x", "y", "w", "h", "max", "scale", "rotate", "crop", "mask" } (tylko te, które się różnią)
      "crop" — punkt kadru obrazu na tym miejscu: "57% 40%", "center", "left top" — przy kadrze ("fit": "cover" modułu "image", obraz w oprawie "media") ten punkt zostaje w widoku, gdy pole zmienia wymiary (ognisko zostaje ogniskiem, także na telefonie — "crop" w "tall"); pominięty — "at" obrazu; w klatkach przechodzi płynnie
      "mask" — co z modułu widać: koło { "shape": "circle", "r": 40, "x": 50, "y": 50 } ("r" — promień w %; 71 sięga rogów, gdy środek jest w środku), owal { "shape": "ellipse", "rx": 60, "ry": 40, "x": 50, "y": 50 } ("rx" — % szerokości, "ry" — % wysokości), prostokąt { "shape": "inset", "top": 10, "right": 10, "bottom": 10, "left": 10, "round": 1.5 } (wcięcia w %, "round" — rogi w rem); null — cały moduł; w klatkach maski tego samego kształtu przechodzą płynnie, a maska z null rośnie od całości
      "frames" — KLATKI sterowane postępem sceny (nie zegarem), najwyżej 16: [{ "at": 0.4, "x": 30, "w": 40, "h": 55, "crop": "50% 60%" }, …] — "at" 0–1 postępu albo "step": numer kroku sceny (od 0) zamiast "at"; klatka zmienia tylko to, co podaje ("x", "y", "w", "h", "max", "rotate", "scale", "opacity", "z", "crop", "mask"), reszta zostaje jak w klatce przed nią; samo miejsce to stan przy 0; do każdej klatki moduł przechodzi płynnie w jej "ease" ("inOut" — zwykle, "linear", "in", "out"); po ostatniej zostaje; klatka bez zmian trzyma stan (np. { "at": 0.3 } — stoi do 0,3); "tall" w klatce — jej inne wartości na telefonie
      "by" — czym jest postęp klatek: "scene" (zwykle) — wnętrze sceny: 0 na pierwszym kroku, 1 na ostatnim (scena musi mieć co najmniej 2 "steps"; przy 1 kroku stoi na 0); "enter" — wejście sceny: 0, gdy przejście z poprzedniej się zaczyna, 1, gdy scena jest; "leave" — wyjście sceny: 0 na ostatnim kroku, 1, gdy jest już następna
      "still" — przy ustawieniu „mniej ruchu”: na jakim postępie (0–1) stoją klatki — nieruchoma kompozycja z tymi samymi nagłówkami, obrazami i przyciskami; pominięte — na końcu (przy "leave" — na początku), a klatki ze "step" przeskakują wtedy z kroku na krok, bez drogi pomiędzy
  "skin" — oprawa: "plain" (bez tła), "card" (tafla), "bubble" (bańka), "pill" (pigułka), "panel" (pole wypełniające "w"×"h")
  "type" — tylko "text": "auto" (jak na stronie), "display" (wielkie zdanie — nagłówek strony), "title" (wersaliki), "heading" (nagłówek z treścią), "kicker" (nagłówek w kolorze akcentu z treścią), "body" (akapity), "close" (puenta: kursywa w kolorze akcentu, pusta linia dzieli grupy), "note" (mały dopisek)
  "fill", "ink", "accent" — kolor tła, pisma i akcentu (linki, puenta): "#rrggbb", para "jasny|ciemny" albo nazwa: "accent", "ink", "ground", "muted"
  "origin" — który punkt modułu stoi na "x", "y": "center" (domyślnie), "top-left", "top", "top-right", "left", "right", "bottom-left", "bottom", "bottom-right"
  "media" — obraz w oprawie: { "url", "at": "57% 50%", "fit": "cover"|"contain", "size": 60, "max": null, "opacity": 1, "fade": true, "side": "after"|"before"|"behind" } — przy "contain": "size" w procentach miejsca, "max" najwyżej tyle rem
  "align", "valign" — "start", "center", "end"
  "arrive" — jak się pojawia: "none", "fade", "rise", "zoom", "grow", "left", "right", "from-left", "from-right", "from-top", "from-bottom" (z "from-…" wjeżdża zza krawędzi)
  "delay", "span" — kiedy w przejściu zaczyna (0–1) i jaką jego część trwa (0–1)
  "ease" — ruch wędrującego: "inOut", "linear", "in" (przyspiesza), "out"
  "hold" — true: stoi też przed pierwszym i po ostatnim swoim miejscu
  "between" — moduł z miejscami na scenach NIE po kolei: "glide" — sunie przez sceny pomiędzy (zwykle), "leave" — odchodzi ze swoją sceną i wraca z następną, na której ma miejsce (ten sam obraz na początku i na końcu opowieści, a w środku go nie ma); stoi wtedy zawsze w scenie, na której jest — jak jej własny moduł
  "layer" — wyżej z przodu; wędrujący z ujemnym (-1 … -5) stoi przed tłem sceny, ale za jej tekstami (zdjęcie na całą scenę, a na nim napis) — w scenie swojego pierwszego miejsca, z "between": "leave" w scenie, na której właśnie jest; wędrujący od 10 stoi nad wszystkimi scenami
  "go" — moduł jest przyciskiem: { "<klucz sceny>": cel } — na tej scenie kliknięcie prowadzi do celu (klucz sceny, "end", "link:<id>", "step" — do własnego kroku tego modułu na tej scenie: wyróżnia go, scena zostaje, "step:2" — do kroku 3 tej sceny; "" — jeszcze nigdzie); zamiast klucza sceny "*" — na każdej scenie, na której moduł stoi (np. stały przycisk „Kontakt” z "hold": true), klucz sceny ma pierwszeństwo przed "*"; pytanie ("question") ma zamiast tego wyjścia wyniku: { "<klucz sceny>:right": cel, "<klucz sceny>:wrong": cel } — dokąd prowadzi „Dalej” po dobrej i po złej odpowiedzi (pominięte — „dalej” sceny); celem może być też bramka "gate:<klucz>"
  "motion" — ruch według zegara (opis: Ruch): raz, gdy scena zostaje osiągnięta (np. { "name": "rise", "delay": 220 } — tekst unosi się po dotarciu), albo w pętli, dopóki moduł widać; niezależny od "arrive", które idzie za przewijaniem; z "by" ("scene", "enter", "leave") ruch idzie za postępem sceny zamiast zegara — np. { "name": "keys", "by": "enter", "keys": [{ "at": 0, "clip": "circle(0% at 50% 50%)" }, { "at": 1, "clip": "circle(75% at 50% 50%)" }] } — zdjęcie odsłania się przez rosnące koło, gdy scena wchodzi

Tekst ("text") w prezentacji i na stronie: "## " — śródtytuł, "# " — duża linia, "> " — mała, cicha linia, [napis](https://… | #/strona | #scena | mailto:… | tel:…) — link; linia z samych linków to rząd linków.`;

const FORM_SECTION = () => `## Pytania formularza (moduł "form")
Wpis modułu "form" — na stronie i w eksporcie modułu — może nieść jego pytania i układ. Pytania są szyfrowane w przeglądarce kluczem obszaru formularza: eksport pokazuje tylko te, które da się otworzyć Twoimi kluczami (inne mają "label": null i przy imporcie zostają nietknięte). Import pieczętuje nowe i zmienione pytania tutaj, zanim trafią do usługi.
- Pytanie z "id" z eksportu jest zmieniane — jego odpowiedzi zostają.
- Pytanie bez "id" albo z własnym (np. "q1") powstaje nowe, na końcu; tej samej nazwy można użyć w "design".
- Pytań, których nie ma w dokumencie, import nie usuwa — chyba że zaznaczysz „usuń pozostałe”. Pytania z odpowiedziami usługa i tak odmówi usunięcia.
- Kolejności istniejących pytań nie da się zmienić — kolejność na formularzu ustala "design.layout".
${keyLines(QUESTION_KEYS)}
Przykład:
${pretty(QUESTION_EXAMPLE)}`;

const ENTRY_KEYS: Readonly<Record<string, string>> = {
  id: 'Miejsce modułu na tej stronie. Z eksportu — moduł jest zmieniany w miejscu (zostają zgłoszenia, linki, mapa logiki). Pominięty albo nieznany — powstaje nowe miejsce',
  module: 'Moduł, który to miejsce pokazuje (ten sam moduł może stać na kilku stronach). Przy nowym miejscu pominięty — powstaje nowy moduł; przy miejscu z "id" — zostaje dotychczasowy',
  name: 'Nazwa modułu na liście modułów (opcjonalnie)',
  kind: 'Rodzaj modułu — lista niżej',
  slide: 'Jak wygląda jako slajd: { "label": nazwa w menu slajdów (z niej kotwica "#nazwa"), "layers": [warstwy tła], "transition", "enter", "colors", "stage" } — szczegóły niżej (Slajd modułu)',
  show: 'Gdzie stoi w prezentacji ("mode": "presentation"): { "places": { "<klucz sceny>": miejsce }, "skin", "type", … } — szczegóły niżej (Prezentacja). null — zdejmuje moduł z prezentacji',
  size: 'Rozmiar, gdy nie podajesz "layout": { "colSpan": 2|3|4|6, "rowSpan": 1|3|5 } — 1 pasek, 3 blok, 5 wysoki. Miejsce: pierwsze wolne',
  layout: 'Dokładne miejsce na siatce dla "desktop" (6 kolumn), "tablet" (4) i "mobile" (2): { "position": { "row", "col" }, "size": { "colSpan", "rowSpan" } }. Pominięty — moduł zostaje, gdzie był (nowy: pierwsze wolne miejsce)',
  config: 'Treść modułu — zależy od rodzaju (niżej). Pominięta — treść zostaje bez zmian',
  questions: 'Tylko "form": pytania (niżej)',
  design: 'Tylko "form": układ i logika (niżej)'
};

/** Ein vollständiges Beispiel einer Seite — aus den Beispielen der Bausteine. */
export function pageExample(): Record<string, unknown> {
  const sample = ['hero', 'plan', 'text', 'form'].map((kind) => partOf(kind)).filter((def): def is PartModule => def !== undefined);
  return {
    format: PAGE_FORMAT,
    version: 1,
    path: 'parafia/pielgrzymka',
    title: 'Pielgrzymka rowerowa',
    lead: 'Dwa dni, 140 km, jedna wspólnota.',
    mode: 'slides',
    theme: DEFAULT_THEMES.dark,
    cover: [],
    /* 0107 — ein gemeinsames Tuch mit Schein und Nici, Punkte statt Namen, die Bühne höchstens 80 rem. */
    deck: {
      backdrop: [
        { kind: 'glow', speed: 0.12, color: 'accent', x: 58, y: 42, size: 60, opacity: 0.3, blend: 'normal' },
        { kind: 'mesh', speed: 0.05, seed: 7, count: 4, color: 'rgba(143, 208, 255, 0.25)', glow: 'rgba(167, 224, 255, 0.35)', center: 0.82, amplitude: 1, opacity: 0.9, dust: true, motion: { name: 'sway' } }
      ],
      nav: 'dots',
      width: 80
    },
    menu: [{ label: 'Parafia', kind: 'abs', target: 'parafia', children: [] }, { label: 'Zapisy', kind: 'rel', target: 'zapisy', children: [] }],
    logic: null,
    modules: [
      ...sample.map((def, i) => ({
        ...(i === 0 ? { id: 'start' } : {}),
        kind: def.kind,
        ...(def.kind === 'form' ? { name: 'Zapisy 2026' } : {}),
        slide: i === 0 ? { label: def.label, layers: [], layout: { align: 'start', width: 56, tall: { valign: 'end', width: 100 } } }
          : i === 1 ? { label: def.label, layers: [], transition: 'dissolve', enter: 'rise', motion: { name: 'rise', delay: 220 } }
          : i === 2 ? { label: def.label, layers: [], colors: { accent: '#d3a25e' }, stage: { frames: { start: { x: 80, y: 18, w: 22, scale: 1, rotate: 0, opacity: 1, max: 20, tall: { x: 50, y: 12, w: 40 } } }, bare: true } }
          : { label: def.label, layers: [] },
        size: def.box,
        config: def.json.example,
        ...(def.kind === 'form' ? QUESTION_EXAMPLE : {})
      })),
      /* 0107 — eine Animacja neben dem Hasło, auf dessen Slajd; auf dem Telefon darüber. */
      { kind: 'animation', slide: { label: 'Mapa', layers: [], with: { slide: 'start', side: 'end', share: 42, tallSide: 'start' } }, size: { colSpan: 3, rowSpan: 3 }, config: { scene: 'map' } }
    ]
  };
}

/** Die Beschreibung der Seite — neben dem Import der Seite, und zum Kopieren für ein Sprachmodell. */
export function pageDescription(): string {
  return `# Strona jako JSON ("${PAGE_FORMAT}", wersja 1)

Co robi import:
- Dokument opisuje całą stronę: tytuł, tekst, wygląd (strona z modułami albo slajdy), kolory, menu, mapę logiki i moduły — każdy z treścią. Klucz, którego nie ma w dokumencie, zostaje na stronie bez zmian.
- Eksport → zmiana → import zmienia stronę W MIEJSCU: moduł z "id" z eksportu zostaje tym samym modułem (z jego zgłoszeniami, linkami osób i miejscem w mapie logiki). Moduł bez "id" powstaje nowy.
- „Zastąp moduły strony”: moduły strony stają się dokładnie tymi z dokumentu, pozostałe znikają ze strony. Bez tego moduły z dokumentu są zmieniane albo dopisywane, a reszta zostaje.
- Import zapisuje od razu. Eksport przed importem to kopia zapasowa.
- Przyjmowany jest też dokument wydarzenia ze starego systemu ({ "title", "pages": [{ "parts": [...] }] }) oraz pojedynczy moduł ("${MODULE_FORMAT}") — dopisywany do strony.
Zwróć JEDEN obiekt JSON, bez komentarzy.

## Strona
  "format" — "${PAGE_FORMAT}"
  "version" — 1
  "path" — tylko informacja; import zawsze trafia na otwartą stronę
  "title" — tytuł strony
  "lead" — tekst pod tytułem (albo null)
  "mode" — "page": moduły na siatce; "slides": każdy moduł to osobny slajd; "presentation": sceny z modułami w dowolnym miejscu (niżej: Prezentacja)
  "theme" — kolory: null (automatyczne — jak w aplikacji) albo { "mode": "dark"|"light", "accent", "ink", "ground", "muted" } (kolory "#rrggbb"); z "night": { "accent", "ink", "ground", "muted" } strona idzie za urządzeniem — jasne kolory w dzień, te w nocy
  "cover" — tło slajdu tytułowego: lista warstw (niżej)
  "show" — sceny prezentacji (niżej: Prezentacja)
  "deck" — całość pokazu slajdów (tylko "mode": "slides"): { "backdrop": [warstwy], "nav": "labels"|"dots"|"none", "titleSlide": true|false, "width": 80 }
      "backdrop" — tło wspólne: warstwy (jak niżej), które stoją za wszystkimi slajdami; slajdy przesuwają się nad nim przezroczyste, a ich własne warstwy leżą w nim i przechodzą płynnie jedna w drugą
      "nav" — pasek: nazwy slajdów u góry (zwykły), kropki z prawej, bez paska; "titleSlide": false — bez slajdu tytułowego (pierwszy moduł jest pierwszym ekranem)
      "width" — najwyżej tyle rem szerokości sceny: w niej liczą się miejsca modułów przechodzących i "layout" slajdów (null — całe okno)
  "menu" — null (bez menu), lista pozycji albo { "from": "ścieżka" } (to samo menu co na innej Twojej stronie)
      pozycja: { "label", "kind": "abs" (ścieżka od korzenia, np. "parafia/zapisy") | "rel" (względem tej strony) | "url" (pełny adres) | "none" (sam nagłówek), "target", "children": [pozycje], "image" }
      "image" — obraz zamiast nazwy (logo): "page-image:<id>" (obraz tej strony), "https://…" albo "/logo.svg"; "label" zostaje — czyta go czytnik ekranu i pokazuje się, gdy obrazu brak
  "subject" — wybór na stronie: u góry strony wybiera się jedną rzecz, a moduły (np. "entry-panel") ją pokazują. ${subjectDescription()}
  "logic" — mapa logiki strony (kiedy który moduł jest widoczny, kroki osoby) albo null. Najprościej układać ją w edytorze; w JSON: { "version": 1, "nodes": [...], "edges": [...] }
      węzeł: { "id", "kind", "x", "y", ... } — kind: ${([...INPUT_KINDS, ...GATE_KINDS, 'part', 'step'] as const).map((k) => `"${k}" (${PAGE_NODE_LABEL[k]})`).join(', ')}
      "part" ma "partId" (= "id" modułu) i "message"; "step" ma "label", "help", "dueAt" (RRRR-MM-DD), "goto" (= "id" modułu);
      "registered"/"confirmed"/"answer"/"mark" mają "formId"; "answer" — "fieldId", "op" ("filled"|"empty"|"eq"|"ne"), "valueHash"; "mark" — "stepId", "markBy" ("office"|"person"); "date" — "when" ("after"|"before"), "date"
      krawędź: { "id", "from", "to", "port": "show"|"done"|"applies"|"in" }
  "modules" — moduły w kolejności czytania

## Moduł (wpis w "modules")
${keyLines(ENTRY_KEYS)}

${LAYERS}

## Ruch
${motionDescription()}

## Rysunek do poruszania
${liveDescription()}

${PRESENTATION}

## Rodzaje modułów
${PARTS.map(kindSection).join('\n\n')}

${FORM_SECTION()}

## Przykład całej strony
${pretty(pageExample())}

## Przykład prezentacji
${pretty(presentationExample())}
`;
}

/**
 * 0085 — EINE KLEINE PRÄSENTATION: der Flug durch den Raum, eine Szene mit
 * Schritten am Faden, ein Kreis, der zum Grund wächst. Steht in der
 * Beschreibung und lässt sich ohne Warnung importieren (`app-json-check`).
 */
export function presentationExample(): Record<string, unknown> {
  return {
    format: PAGE_FORMAT,
    version: 1,
    path: 'parafia/rekolekcje',
    title: 'Rekolekcje',
    lead: null,
    mode: 'presentation',
    theme: { mode: 'light', accent: '#2f5d46', ink: '#171a16', ground: '#f7f8f5', muted: '#7c8479', night: { accent: '#8fc4a8', ink: '#eceee8', ground: '#141713', muted: '#838b7e' } },
    cover: [],
    show: {
      format: 'screen',
      fonts: 'spectral',
      nav: 'dots',
      scenes: [
        { key: 'start', label: 'Start', steps: 3, colors: { ground: '#14180f', ink: '#f2f4ef' }, hint: 'Przewiń', words: { list: ['colligere', 'novatio', 'quies'], prefix: 'RE', count: 15, seed: 7 } },
        { key: 'dni', label: 'Trzy dni', steps: 3, change: 'fly', grow: { from: 0.8, to: 1.08 }, thread: 'dots' },
        { key: 'zapisy', label: 'Zapisy', colors: { ink: '#f2f4ef', accent: '#9ed3b4' }, next: 'link:parafia' }
      ],
      links: [{ id: 'parafia', label: 'Strona parafii', href: '#/parafia' }],
      sound: { url: 'https://example.org/ognisko.mp3', label: 'Ognisko', volume: 0.5 }
    },
    modules: [
      { id: 'haslo', kind: 'text', size: { colSpan: 6, rowSpan: 3 }, show: { places: { start: { x: 50, y: 56, w: 40, z: -980 } }, skin: 'plain', type: 'display', align: 'center' }, config: { title: 'Trzy dni, jedna wspólnota' } },
      ...['Piątek — przyjazd', 'Sobota — droga', 'Niedziela — powrót'].map((title, step) => ({
        id: `dzien${step + 1}`, kind: 'text', size: { colSpan: 3, rowSpan: 3 },
        show: { places: { dni: { x: [30, 70, 50][step], y: [32, 40, 72][step], w: 24, step } }, skin: 'bubble', type: 'title', arrive: 'zoom', delay: step * 0.12, span: 0.55 },
        config: { title }
      })),
      { id: 'kolo', kind: 'shape', size: { colSpan: 2, rowSpan: 2 }, show: { places: { dni: { x: 50, y: 50, w: 12, opacity: 0 }, zapisy: { x: 50, y: 50, w: 12, scale: 22 } }, skin: 'plain', ease: 'in', layer: -2 }, config: { shape: 'circle', fill: '#14180f' } },
      { id: 'zapis', kind: 'text', size: { colSpan: 3, rowSpan: 3 }, show: { places: { zapisy: { x: 34, y: 52, w: 40 } }, skin: 'plain', type: 'heading', arrive: 'fade', delay: 0.45, span: 0.55 }, config: { title: 'Zapisy', body: ['# [zapisy@example.pl](mailto:zapisy@example.pl)', '> Zapisy do 15 maja.'] } },
      { id: 'skrot', kind: 'text', size: { colSpan: 2, rowSpan: 1 }, show: { places: { start: { x: 50, y: 84, w: 22 } }, skin: 'pill', type: 'note', align: 'center', go: { start: 'zapisy' } }, config: { title: 'Od razu do zapisów' } },
      /* 2026-10-19 — ein Bild: erst der ganze Grund, dann ein Kadr rechts (der Ausschnitt bleibt beim Feuer); auf den Zapisy kommt es wieder. */
      {
        id: 'ognisko', kind: 'image', size: { colSpan: 3, rowSpan: 3 },
        show: {
          places: {
            start: {
              x: 50, y: 50, w: 100, h: 100, opacity: 0.55, crop: '57% 60%',
              frames: [{ at: 0.3 }, { at: 1, x: 74, y: 50, w: 40, h: 62, opacity: 1, crop: '50% 70%', mask: { shape: 'inset', round: 1.5 }, tall: { x: 50, y: 30, w: 86, h: 34 } }]
            },
            zapisy: { x: 74, y: 52, w: 34, h: 46, crop: '50% 70%', mask: { shape: 'circle', r: 60 } }
          },
          skin: 'plain', layer: -3, between: 'leave', arrive: 'fade'
        },
        config: { url: '/Hortus.jpg', alt: 'Ognisko w ogrodzie', fit: 'cover', at: '57% 50%' }
      }
    ]
  };
}

/** Die Beschreibung eines einzelnen Bausteins — neben seinem Import im Editor. */
export function partDescription(kind: string): string {
  const def = partOf(kind);
  if (def === undefined) return `Rodzaj „${kind}” nie jest znany tej wersji.`;
  return `# Treść modułu „${def.label}” jako JSON

Co robi import tutaj: treść ("config") zastępuje obecną treść tego modułu w szkicu strony — zapisuje ją dopiero „Zapisz moduły”. Przyjmowany jest sam obiekt "config", wpis { "kind", "config" } albo cały wpis z eksportu strony (liczy się z niego "config"). Klucze, których nie podasz, zostają puste.

${kindSection(def)}
`;
}

/** Die Beschreibung eines Moduls — neben seinem Import im Bausteinverwalter. */
export function moduleDescription(kind: string): string {
  const def = partOf(kind);
  const form = kind === 'form';
  return `# Moduł jako JSON ("${MODULE_FORMAT}", wersja 1)

Co robi import tutaj: zmienia TEN moduł — jego nazwę i treść — na wszystkich stronach, na których stoi.${form ? ' Do tego pytania formularza i jego układ (niżej).' : ''} Klucz, którego nie ma w dokumencie, zostaje bez zmian. Import zapisuje od razu.

  "format" — "${MODULE_FORMAT}"
  "version" — 1
  "id" — identyfikator modułu (tylko informacja — import zmienia zawsze otwarty moduł)
  "kind" — rodzaj; musi się zgadzać z otwartym modułem
  "name" — nazwa na liście modułów
  "config" — treść, zależna od rodzaju (niżej)${form ? `
  "questions", "design" — pytania i układ formularza (niżej)
  "extends", "audience" — tylko w rozszerzeniu (podformularzu): który formularz rozszerza i kto je wypełnia ("person" — osoba przez swój link, "office" — tylko koordynator). "extends" to tylko informacja; "audience" import zmienia, dopóki podformularz nie ma żadnego wpisu
  "group" — grupa formularzy (folder), w której stoi: jej nazwa; null — bez grupy. Import przenosi formularz do grupy o tej nazwie (jeśli jej nie ma — zakłada ją). Dla wypełniających nic się nie zmienia
  "repeat" — tylko w rozszerzeniu: jak często każda osoba z listy dostaje wpis — "once" (raz), "day", "week", "month", "year". Import zmienia to, dopóki rozszerzenie nie ma żadnego wpisu
  "memberRoles" — role uczestników: lista identyfikatorów ról, które dostaje każdy, kto wyśle formularz (dostęp do ich obszarów, stron, kalendarzy, rozmów); pusta lista — żadna. Import ustawia je tylko, jeśli masz te role; kto już do roli należy, zostaje. Obecne zgłoszenia przenosi się w module („Przenieś obecne zgłoszenia"). Starszy zapis "memberRole" (jedna rola albo null) też jest czytany
  "virtualAreas" — obszary osób: lista reguł; każda osoba, która wyśle formularz, dostaje według każdej reguły własny obszar (rozmowa, terminy, zadania tylko dla niej). Reguła: { "name": nazwa, "submitter": co robi osoba — "write" (pisze), "read" (czyta), "none" (nie widzi: obszar tylko dla prowadzących), "roles": [{ "role": identyfikator roli, "level": "read" | "write" | "admin" (prowadzi) }] } — każda z tych ról widzi taki obszar każdej osoby. Import zakłada reguły, których nazwy jeszcze nie ma, zmienia "submitter" i dodaje role, które masz; niczego nie usuwa` : ''}

${def === undefined ? `Rodzaj „${kind}” nie jest znany tej wersji — "config" przechodzi bez zmian.` : kindSection(def)}
${form ? `\n${FORM_SECTION()}\n` : ''}`;
}
