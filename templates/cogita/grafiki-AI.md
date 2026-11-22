# Grafiki w tekstach: przewodnik dla KI

Ten przewodnik mówi, jak w tekstach Recreatio — wpisach bazy wiedzy (Cogita), wyjaśnieniach i podpowiedziach pytań, slajdach, krokach przebiegu, tekstach Biblioteki i Skryptorium — **pokazać coś jako strukturę**: tabelę, wykres, wykres funkcji, schemat, drzewo albo oś czasu. Grafika to zwykły tekst w polu z zapisem (`"markup"`, akapit w `"blocks"`, wyjaśnienie `"explanation"`, treść slajdu) — aplikacja rysuje ją sama, w każdym miejscu, gdzie ten tekst się pokazuje. Gdy coś trzeba **narysować** (siły, promienie, obwód, dźwignię) — rysunek z kształtów `"drawing"` (§9) i 12 sprawdzonych propozycji z tym, kiedy ich użyć. Składnię całego dokumentu podaje format importu (`get_import_format knowledge-base`).

## 0. Zasady dla KI

1. **Grafika tam, gdzie coś wyjaśnia.** Wykres, gdy liczby się porównuje albo zmieniają w czasie; schemat, gdy rzeczy wynikają z siebie; drzewo, gdy coś się dzieli; oś czasu, gdy liczy się kolejność dat; tabela, gdy porównuje się cechy. Nie wstawiaj grafiki, która powtarza jedno zdanie.
2. **Dane prawdziwe albo jawnie przykładowe.** Nie wymyślasz liczb; jeśli to przykład, tytuł to mówi. Źródło liczb w `source:`.
3. **Krótko.** Do 8 serii na wykresie (punkty: do 3), do 200 wierszy, do 6 funkcji, do 80 pól w schemacie, do 120 dat. Więcej — podziel na dwie grafiki.
4. **Jedna oś.** Dwie wielkości w różnych jednostkach to dwa wykresy, nigdy jeden z dwiema skalami.
5. Grafika stoi **jako osobny akapit** (pusta linia przed i po). W JSON-ie nowa linia to `\n`, a cudzysłów w środku `\"`.

## 1. Tabela (bez płotu)

```
| Pojęcie | Znaczenie |
|---|---|
| Kataliza | przyspieszenie reakcji |
| Inhibicja | spowolnienie reakcji |
```

- Wiersze zaczynają się od `|`. Druga linia `|---|---|` czyni pierwszą nagłówkiem; `|:--|`, `|:-:|`, `|--:|` — do lewej, środek, do prawej.
- W komórkach działa cały zapis: **pogrubienie**, `$x^2$`, `[[słowo|@wpis]]`, przypisy. Pionowa kreska w komórce: `\|`.

## 2. Wykres z tabeli — ```chart

````
```chart Ludność (mln)
type: line
y: mln
source: GUS
| Rok | Polska | Czechy |
| 1950 | 25,0 | 8,9 |
| 1990 | 38,1 | 10,4 |
| 2020 | 38,3 | 10,7 |
```
````

- Pierwsza linia: ```` ```chart ```` i tytuł. Potem ustawienia `klucz: wartość` (każde opcjonalne), potem dane.
- `type:` — `bar` (kolumny, domyślnie; kilka serii obok siebie), `hbar` (poziome słupki — długie nazwy), `line` (linia — zmiana w czasie), `stacked` (kolumny skumulowane — części sumy), `share` (udziały w całości, każdy wiersz = 100 % — zamiast wykresu kołowego), `scatter` (punkty: pierwsza kolumna i każda seria to liczby; do 3 serii).
- `x:` i `y:` — opisy osi, `unit:` — jednostka przy wartościach (`unit: %`), `source:` — źródło.
- Dane: pierwszy wiersz to nagłówek (pierwsza kolumna — etykiety, kolejne — nazwy serii), potem wiersze wartości. Rozdzielacz: `|` (najlepiej), `;` albo tabulator — wtedy przecinek jest przecinkiem dziesiętnym (`25,0`); przy rozdzielaczu `,` ułamki z kropką. Puste pole albo `-` = brak wartości (linia ma przerwę).
- Gdy pierwsza kolumna to liczby (lata), linia ma prawdziwą skalę — odstępy jak w danych.
- Aplikacja sama dobiera kolory (stała kolejność, sprawdzona dla daltonistów, jasny i ciemny tryb), legendę od dwóch serii, nazwy na końcu linii, podpowiedź pod wskaźnikiem i tabelę „Dane” pod wykresem. Nie podajesz kolorów.

## 3. Wykres funkcji — ```plot

````
```plot Ruch jednostajnie przyspieszony
y = 2*x^2 / 2
y = 4*x
x: 0..5 czas [s]
y: droga [m]
point: 2, 8 tu się zrównują
```
````

- Funkcje: `y = …` albo `f(x) = …` (do 6). Zmienna to `x`. Działania `+ - * / ^`, nawiasy, funkcje `sin cos tan sqrt abs ln log exp floor round min max …`, stałe `pi`, `e`. Kąty w radianach (`sin(rad(30))` dla stopni).
- `x: od..do` — zakres (domyślnie -5..5), po nim może stać opis osi. `y: od..do` — zakres pionowy (domyślnie dobrany do wykresu, bez skoków w nieskończoność).
- `point: x, y opis` — zaznaczony punkt (miejsce zerowe, przecięcie).
- Nieciągłości (np. `1/x`) aplikacja przerywa sama.

## 4. Schemat — ```diagram

````
```diagram Fotosynteza
direction: right
światło -> chlorofil: pochłania
chlorofil -> glukoza
CO2[dwutlenek węgla] -> glukoza
woda -> glukoza
glukoza ..> oddychanie: później
```
````

- Każda linia to połączenie: `A -> B` (strzałka), `A --> B`, `A <- B`, `A <-> B` (w obie strony), `A -- B` (bez strzałki), `A ..> B` (przerywana — słabszy, pośredni związek). Po `:` — opis połączenia. Łańcuch: `A -> B -> C`.
- Pole może mieć krótką nazwę i dłuższy tekst: `CO2[dwutlenek węgla]`; dalej wystarczy `CO2`. W tekście pola działa zapis (`$H_2O$`, **pogrubienie**). Pole bez połączeń — sama nazwa w linii.
- `direction: down` (domyślnie, warstwy z góry na dół) albo `right` (od lewej do prawej). Kolejność warstw aplikacja liczy z połączeń.

## 5. Drzewo — ```tree

````
```tree Części mowy
Części mowy
  Odmienne
    rzeczownik
    czasownik
  Nieodmienne
    przyimek
    spójnik
```
````

- Jedna linia = jedno pole; wcięcie (dwie spacje) mówi, czyje to dziecko. Myślnik `- ` na początku wolno. `direction: right` — drzewo w poziomie (przy długich nazwach).

## 6. Oś czasu — ```timeline

````
```timeline Życie ks. Bosko
1815: narodziny w Becchi
1841: święcenia kapłańskie
1859–1888: Zgromadzenie Salezjańskie
```
````

- Jedna linia = jedna data i to, co się stało, rozdzielone `:` albo ` — `. Data może być dowolnym tekstem (`XIV w.`, `ok. 1200`, `1939–1945`). Kolejność taka, jak napiszesz.

## 6a. Kolor tekstu — `[słowa]{.red}` (2026-11-21)

W każdym tekście z zapisem (akapity slajdu w `"blocks"`, pola `"markup"`, wyjaśnienia i podpowiedzi pytań, teksty kroków, moduły tekstowe stron, teksty Biblioteki i Skryptorium) słowa można pokolorować: **słowa w nawiasie kwadratowym, zaraz za nim kolor jako klasa w klamrach** — tak jak „bracketed span” w Pandocu.

```
Woda paruje [na słońcu]{.orange}, a skrapla się [w chłodzie]{.blue}.
Najważniejsze: [**ciepło zmienia stan, nie skład**]{.mark}.
```

- **Kolory** (stała paleta): `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `purple`, `pink`, `gray` — kolor liter; `mark` — żółty zakreślacz pod tekstem.
- **Jak działa**: zapis zamienia `[…]{.kolor}` na fragment w tym kolorze. Każdy kolor ma własny odcień dla jasnego i ciemnego wyglądu aplikacji, sprawdzony na kontrast (co najmniej 4,5:1 z tłem), więc tekst zawsze da się czytać. **Nie ma wartości hex** (`{.#ff0000}`, `{color=…}` nie działają).
- Wewnątrz koloru wolno używać innego zapisu (`[**ważne**]{.red}`, `[$E = mc^2$]{.blue}`, `[[słowo|@wpis]]`), a kolor może stać w pogrubieniu (`**[czerwone]{.red}**`).
- Kilka klas (`{.big .red}`): liczy się pierwsza znana. **Nieznany kolor**: tekst bez koloru, a podgląd importu ostrzega („używa koloru, którego nie ma”) z listą dozwolonych.
- W druku (eksport do LaTeX) kolor znika — zostają słowa.
- **Z sensem i oszczędnie**: jeden–dwa kolory na slajd, ten sam kolor dla tej samej roli na wszystkich slajdach (np. `blue` — pojęcie, `red` — typowy błąd, `mark` — najważniejsze zdanie). Kolor nigdy nie jest jedynym nośnikiem znaczenia: słowa muszą mówić to samo (czytelnik bez rozróżniania barw, wydruk).
- Sprawdzenie: `preview_knowledge` / `preview_page` (serwer podglądu) rysuje tekst tak jak aplikacja; w HTML pokolorowany fragment ma `data-text-color="red"`.

## 7. Gdzie to działa i co z tego wynika

- Wszędzie, gdzie stoi zapis: pola `"markup"`, akapity `"blocks"`, `"explanation"` i treść pytania, slajdy, kroki przebiegu, teksty Biblioteki i Skryptorium. Podgląd w edytorze pokazuje grafikę od razu; przycisk „Wstaw grafikę” wstawia przykład.
- Wyszukiwanie i streszczenia czytają grafikę jako tekst (tytuł, wiersze danych, połączenia, daty) — także MCP widzi jej źródło.
- Inny płot (```` ```python ````, ```` ``` ````) to kod, pokazany tak, jak napisany.
- Błąd w grafice nie psuje tekstu: rysuje się to, co poprawne, a pod grafiką stoi uwaga (np. „Wiersz 3: „x” to nie liczba”). Bez niczego do narysowania — pokazany jest tekst płotu.

## 8. Typowe błędy

- Brak wiersza nagłówka w ```` ```chart ```` (pierwszy wiersz danych staje się nazwami serii).
- Przecinek dziesiętny przy rozdzielaczu `,` — użyj `|` albo `;`.
- Dwie jednostki na jednym wykresie — zrób dwa.
- `share` z wartościami ujemnymi — udziały są zawsze dodatnie.
- Schemat jako lista zdań zamiast połączeń `A -> B`.
- Grafika sklejona z akapitem (brak pustej linii przed ```` ``` ````).

## 9. Rysunki z kształtów — `"drawing"` — i propozycje: kiedy czego użyć (2026-11-22)

Gdy coś trzeba **narysować** (siły, promienie, obwód, dźwignię), a nie policzyć z tabeli, służy rysunek z kształtów. Ten sam JSON działa w trzech miejscach:

- krok "show" przebiegu: `{"id": "s4", "type": "show", "config": {"of": "@kurs/s/rownia", "drawing": {…}}}` — rysunek obok tekstu slajdu (na telefonie pod nim);
- pytanie `"form": "interactive"` (pole "drawing", z celem i rozwiązaniem — format „knowledge-base”);
- moduł strony „Animacja” (format „page”): jego `"config"` to ten sam obiekt.

**Układ i kształty**

- `"size": [szerokość, wysokość]` — jednostki rysunku; rysunek rośnie i maleje jako całość, oś y w dół.
- `{"type": "frame", "x", "y", "w", "h", "view": [x0, y0, x1, y1]}` — w prostokącie rysunku pokazuje wycinek „świata” we własnych jednostkach (metry, sekundy) z osią y **w górę**; `"axes": {"x": "t [s]", "y": "v [m/s]"}` rysuje obie osie z podziałką. Kształty w jego `"children"` stoją w jednostkach świata; grubości linii, promienie kropek i wielkość napisów — w jednostkach rysunku. Proporcje `view` i prostokąta niech będą takie same (inaczej koło staje się elipsą).
- Kształty: `line` (x, y → x2, y2), `arrow` (to samo + `"head"`), `rect` (x, y, w, h, `"r"` — zaokrąglenie; w ramce x, y to lewy dolny róg), `circle` (x, y, r), `ellipse` (środek x, y; w, h), `poly` (`"points"`, `"closed": true`), `path` (`"d"` jak w SVG), `text` (x, y, `"text"`, `"size"`, `"anchor": "start" | "middle" | "end"`, `"weight"`), `group` (x, y, `"rotate"` w stopniach, `"scale"`, `"children"`), `plot` (`"fn"` albo `"fx"`/`"fy"` od `"from"` do `"to"`, zmienna `u`), `use` (część z `"symbols"` — narysowana raz, postawiona wiele razy). Wspólne: `"fill"`, `"stroke"`, `"width"`, `"opacity"`, `"cap"`.
- **Kolory** — nazwy motywu: `ink` (tekst), `muted` (szary), `accent`, `ok` (zielony), `danger` (czerwony), `warn` (pomarańczowy — światło), `info` (niebieski), `ground` (tło); przezroczystość: `"muted/20"`. Tak rysunek jest czytelny w jasnym i ciemnym wyglądzie — **nie podawaj kolorów hex**. Kolor zawsze z napisem (strzałka „N”, nie tylko zielona).
- **Opis słowami**: `"alt"` (do 200 znaków) czyta czytnik ekranu; ten sam opis, pełniej, stoi w tekście slajdu — rysunek nigdy nie jest jedynym nośnikiem treści.
- Ruch, suwaki, symulacja (`"vars"`, `"controls"`, `"sim"`, wartości `"=wyrażenie"`, powtórzenia `"repeat"` z `i`) — tylko gdy uczący się ma coś zmieniać albo przewidywać; opis: format „page”, moduł „Animacja”.
- **Sprawdź przed oddaniem**: `preview_page` (serwer podglądu) z modułem `{"kind": "animation", "config": <rysunek>}` rysuje go tak jak aplikacja.

### Propozycje — nie szablony

Poniższe rysunki zbudowane są tylko z istniejących kształtów i płotów; każdy sprawdzono w aplikacji (jasny i ciemny wygląd). To **propozycje**: zmień liczby, napisy i proporcje pod swoją treść, a jeśli rysunek ma pokazać coś innego — narysuj go od nowa. Liczby są przykładowe.

| Co pokazujesz | Czym | Propozycja |
|---|---|---|
| siły działające na ciało | `drawing`: strzałki z literami | 9.1 |
| prędkość (wektor) w ruchu, składowe | `drawing`: `frame` z osiami, tor `plot`, strzałki | 9.2 |
| jak wielkość zmienia się w czasie według wzoru | ```` ```plot ```` | 9.3 |
| przebieg pomiarów w czasie (ogrzewanie, topnienie) | ```` ```chart ```` `type: line` | 9.4 |
| obwód elektryczny | `drawing` z `"symbols"` | 9.5 |
| bieg promieni | `drawing`: dwie ramki | 9.6 |
| cień, zaćmienie | `drawing` | 9.7 |
| dźwignia, bloczek | `drawing` | 9.8 |
| wynik pomiaru z niepewnością | `drawing`: oś liczbowa | 9.9 |
| dane z pomiarów | tabela + ```` ```chart ```` `type: bar` | 9.10 |
| kolejność wydarzeń | ```` ```timeline ```` | 9.11 |
| podział pojęć (literatura, teologia) | ```` ```tree ```` | 9.12 |

### 9.1 Siły na równi pochyłej

**Kiedy:** siły działające na ciało (ciężar, nacisk, tarcie, naciąg): każda siła to strzałka z punktu przyłożenia, z literą. Długości strzałek mówią coś o wartościach tylko wtedy, gdy tekst to mówi.
**Opis słowami:** Klocek na równi pochyłej o kącie 30°: ciężar mg pionowo w dół, siła nacisku N prostopadle do równi, tarcie T wzdłuż równi w górę.

```json
{"alt": "Klocek na równi pochyłej o kącie 30°: ciężar mg pionowo w dół, siła nacisku N prostopadle do równi, tarcie T wzdłuż równi w górę.",
 "size": [420,270],
 "elements": [
  {"type": "frame", "x": 10, "y": 8, "w": 400, "h": 254, "view": [-0.5,-0.4,5.5,3.41], "children": [
    {"type": "line", "x": -0.5, "y": 0, "x2": 5.5, "y2": 0, "stroke": "muted", "width": 1.5},
    {"type": "poly", "points": [[0,0], [0,2.5], [4.33,0]], "closed": true, "fill": "muted/15", "stroke": "muted", "width": 1.5},
    {"type": "plot", "fx": "4.33 - 0.7*cos(u)", "fy": "0.7*sin(u)", "from": 0, "to": 0.5236, "samples": 12, "stroke": "accent", "width": 1.5},
    {"type": "text", "x": 3.35, "y": 0.2, "text": "30°", "size": 12, "fill": "accent"},
    {"type": "group", "x": 1.39, "y": 1.7, "rotate": -30, "children": [
      {"type": "rect", "x": -0.3, "y": 0, "w": 0.6, "h": 0.42, "r": 3, "fill": "accent/70", "stroke": "accent"}
    ]},
    {"type": "arrow", "x": 1.49, "y": 1.88, "x2": 1.49, "y2": 0.75, "head": 9, "stroke": "ink", "width": 2},
    {"type": "text", "x": 1.72, "y": 0.85, "text": "mg", "size": 13, "fill": "ink"},
    {"type": "arrow", "x": 1.49, "y": 1.88, "x2": 1.96, "y2": 2.7, "head": 9, "stroke": "ok", "width": 2},
    {"type": "text", "x": 2.14, "y": 2.75, "text": "N", "size": 13, "fill": "ok"},
    {"type": "arrow", "x": 1.49, "y": 1.88, "x2": 0.88, "y2": 2.23, "head": 9, "stroke": "danger", "width": 2},
    {"type": "text", "x": 0.7, "y": 2.45, "text": "T", "size": 13, "fill": "danger"}
  ]}
 ]}
```

### 9.2 Wektory prędkości na torze

**Kiedy:** kierunek i wartość prędkości w kilku chwilach ruchu; rozkład na składowe (tu: część pozioma vₓ wszędzie ta sama).
**Opis słowami:** Tor rzuconej piłki i strzałki prędkości v w trzech miejscach: na górze prędkość jest pozioma; pozioma część prędkości (vₓ) jest wszędzie taka sama.

```json
{"alt": "Tor rzuconej piłki i strzałki prędkości v w trzech miejscach: na górze prędkość jest pozioma; pozioma część prędkości (vₓ) jest wszędzie taka sama.",
 "size": [440,220],
 "elements": [
  {"type": "frame", "x": 34, "y": 8, "w": 396, "h": 190, "view": [0,-0.2,10.5,4.84], "axes": {"x": "x [m]", "y": "y [m]"}, "children": [
    {"type": "plot", "fn": "u - 0.1*u^2", "from": 0, "to": 10, "samples": 40, "stroke": "muted", "width": 2},
    {"type": "arrow", "x": 1, "y": 0.9, "x2": 2.2, "y2": 1.86, "head": 9, "stroke": "accent", "width": 2.5},
    {"type": "arrow", "x": 1, "y": 0.9, "x2": 2.2, "y2": 0.9, "head": 7, "stroke": "info/70", "width": 1.5},
    {"type": "text", "x": 1.45, "y": 2.1, "text": "v₁", "size": 13, "fill": "accent"},
    {"type": "text", "x": 2.45, "y": 0.72, "text": "vₓ", "size": 12, "fill": "info"},
    {"type": "arrow", "x": 5, "y": 2.5, "x2": 6.2, "y2": 2.5, "head": 9, "stroke": "accent", "width": 2.5},
    {"type": "text", "x": 5.6, "y": 2.85, "text": "v₂", "size": 13, "fill": "accent"},
    {"type": "arrow", "x": 9, "y": 0.9, "x2": 10, "y2": 0.1, "head": 9, "stroke": "accent", "width": 2.5},
    {"type": "arrow", "x": 9, "y": 0.9, "x2": 10.2, "y2": 0.9, "head": 7, "stroke": "info/70", "width": 1.5},
    {"type": "text", "x": 9.45, "y": 1.3, "text": "v₃", "size": 13, "fill": "accent"},
    {"type": "circle", "x": 1, "y": 0.9, "r": 4, "fill": "ink"},
    {"type": "circle", "x": 5, "y": 2.5, "r": 4, "fill": "ink"},
    {"type": "circle", "x": 9, "y": 0.9, "r": 4, "fill": "ink"}
  ]}
 ]}
```

### 9.3 Wykres v(t) z wzoru

**Kiedy:** wielkość zmienia się według wzoru (ruch jednostajnie przyspieszony, potem jednostajny); funkcję łamaną daje `min`/`max`.
**Opis słowami:** Przez pierwsze 5 s prędkość rośnie równomiernie od 0 do 10 m/s, potem jest stała.

````
```plot Prędkość samochodu (przykład)
y = min(2*x, 10)
x: 0..10 czas [s]
y: 0..12 prędkość [m/s]
point: 5, 10 koniec przyspieszania
```
````

### 9.4 Ogrzewanie i topnienie: temperatura w czasie

**Kiedy:** wyniki pomiarów zmieniające się w czasie, z odcinkami, na których nic się nie zmienia (przemiany fazowe). Pierwsza kolumna to liczby — odstępy są takie jak w czasie.
**Opis słowami:** Temperatura rośnie do 0 °C, stoi, póki lód się topi (od 2. do 8. minuty), rośnie do 100 °C i znów stoi, póki woda wrze.

````
```chart Ogrzewanie lodu (przykład)
type: line
x: czas [min]
y: temperatura [°C]
| czas | temperatura |
| 0 | -20 |
| 2 | 0 |
| 8 | 0 |
| 13 | 100 |
| 20 | 100 |
```
````

### 9.5 Obwód szeregowy

**Kiedy:** obwody elektryczne — powtarzalne części (żarówka, opornik) raz w `"symbols"`, potem `use` w wielu miejscach; strzałka I pokazuje kierunek prądu.
**Opis słowami:** Obwód szeregowy: bateria, zamknięty wyłącznik i dwie żarówki jedna za drugą. Strzałka I pokazuje kierunek prądu: od plusa baterii przez wyłącznik i żarówki do minusa.

```json
{"alt": "Obwód szeregowy: bateria, zamknięty wyłącznik i dwie żarówki jedna za drugą. Strzałka I pokazuje kierunek prądu: od plusa baterii przez wyłącznik i żarówki do minusa.",
 "size": [420,230],
 "symbols": [
  {"name": "zarowka", "shapes": [
   {"type": "circle", "x": 0, "y": 0, "r": 18, "fill": "ground", "stroke": "ink", "width": 2},
   {"type": "line", "x": -12, "y": -12, "x2": 12, "y2": 12, "stroke": "ink", "width": 2},
   {"type": "line", "x": 12, "y": -12, "x2": -12, "y2": 12, "stroke": "ink", "width": 2}
  ]}
 ],
 "elements": [
  {"type": "line", "x": 50, "y": 40, "x2": 50, "y2": 95, "stroke": "ink", "width": 2},
  {"type": "line", "x": 32, "y": 95, "x2": 68, "y2": 95, "stroke": "ink", "width": 3},
  {"type": "line", "x": 41, "y": 107, "x2": 59, "y2": 107, "stroke": "ink", "width": 6, "cap": "butt"},
  {"type": "line", "x": 50, "y": 107, "x2": 50, "y2": 190, "stroke": "ink", "width": 2},
  {"type": "text", "x": 80, "y": 92, "text": "+", "size": 16, "weight": 700, "fill": "ink"},
  {"type": "text", "x": 80, "y": 110, "text": "−", "size": 16, "weight": 700, "fill": "ink"},
  {"type": "text", "x": 22, "y": 101, "text": "U", "size": 14, "anchor": "end", "fill": "muted"},
  {"type": "line", "x": 50, "y": 40, "x2": 160, "y2": 40, "stroke": "ink", "width": 2},
  {"type": "circle", "x": 160, "y": 40, "r": 4, "fill": "ink"},
  {"type": "line", "x": 160, "y": 40, "x2": 220, "y2": 40, "stroke": "ink", "width": 2},
  {"type": "circle", "x": 220, "y": 40, "r": 4, "fill": "ink"},
  {"type": "text", "x": 190, "y": 18, "text": "wyłącznik", "size": 12, "fill": "muted"},
  {"type": "line", "x": 220, "y": 40, "x2": 340, "y2": 40, "stroke": "ink", "width": 2},
  {"type": "line", "x": 340, "y": 40, "x2": 340, "y2": 92, "stroke": "ink", "width": 2},
  {"type": "use", "use": "zarowka", "x": 340, "y": 110},
  {"type": "text", "x": 366, "y": 110, "text": "żarówka 1", "size": 12, "anchor": "start", "fill": "muted"},
  {"type": "line", "x": 340, "y": 128, "x2": 340, "y2": 190, "stroke": "ink", "width": 2},
  {"type": "line", "x": 340, "y": 190, "x2": 218, "y2": 190, "stroke": "ink", "width": 2},
  {"type": "use", "use": "zarowka", "x": 200, "y": 190},
  {"type": "text", "x": 200, "y": 222, "text": "żarówka 2", "size": 12, "fill": "muted"},
  {"type": "line", "x": 182, "y": 190, "x2": 50, "y2": 190, "stroke": "ink", "width": 2},
  {"type": "arrow", "x": 140, "y": 190, "x2": 90, "y2": 190, "head": 10, "stroke": "danger", "width": 2.5},
  {"type": "text", "x": 115, "y": 176, "text": "I", "size": 14, "weight": 700, "fill": "danger"}
 ]}
```

### 9.6 Soczewka skupiająca i lustro płaskie

**Kiedy:** bieg promieni (konstrukcja obrazu, odbicie, załamanie); osobne zjawiska w osobnych ramkach jednego rysunku.
**Opis słowami:** Po lewej soczewka skupiająca z ogniskami F: trzy promienie z wierzchołka przedmiotu spotykają się w odwróconym obrazie. Po prawej lustro płaskie: kąt odbicia β równa się kątowi padania α.

```json
{"alt": "Po lewej soczewka skupiająca z ogniskami F: trzy promienie z wierzchołka przedmiotu spotykają się w odwróconym obrazie. Po prawej lustro płaskie: kąt odbicia β równa się kątowi padania α.",
 "size": [560,250],
 "elements": [
  {"type": "frame", "x": 8, "y": 10, "w": 330, "h": 230, "view": [-6,-4.18,6,4.18], "children": [
    {"type": "line", "x": -6, "y": 0, "x2": 6, "y2": 0, "stroke": "muted", "width": 1},
    {"type": "ellipse", "x": 0, "y": 0, "w": 0.7, "h": 7, "fill": "info/15", "stroke": "info", "width": 1.5},
    {"type": "circle", "x": -2, "y": 0, "r": 3, "fill": "ink"},
    {"type": "circle", "x": 2, "y": 0, "r": 3, "fill": "ink"},
    {"type": "text", "x": -2, "y": -0.55, "text": "F", "size": 12, "fill": "ink"},
    {"type": "text", "x": 2, "y": -0.55, "text": "F", "size": 12, "fill": "ink"},
    {"type": "arrow", "x": -4, "y": 0, "x2": -4, "y2": 2, "head": 8, "stroke": "ink", "width": 2.5},
    {"type": "text", "x": -4, "y": 2.55, "text": "przedmiot", "size": 11, "fill": "ink"},
    {"type": "arrow", "x": 4, "y": 0, "x2": 4, "y2": -2, "head": 8, "stroke": "accent", "width": 2.5},
    {"type": "text", "x": 4, "y": -2.55, "text": "obraz", "size": 11, "fill": "accent"},
    {"type": "line", "x": -4, "y": 2, "x2": 0, "y2": 2, "stroke": "warn", "width": 1.5},
    {"type": "line", "x": 0, "y": 2, "x2": 4, "y2": -2, "stroke": "warn", "width": 1.5},
    {"type": "line", "x": -4, "y": 2, "x2": 4, "y2": -2, "stroke": "warn", "width": 1.5},
    {"type": "line", "x": -4, "y": 2, "x2": 0, "y2": -2, "stroke": "warn", "width": 1.5},
    {"type": "line", "x": 0, "y": -2, "x2": 4, "y2": -2, "stroke": "warn", "width": 1.5}
  ]},
  {"type": "frame", "x": 358, "y": 10, "w": 194, "h": 230, "view": [-3,-0.6,3,6.51], "children": [
    {"type": "rect", "x": -2.6, "y": -0.35, "w": 5.2, "h": 0.35, "fill": "muted/35"},
    {"type": "line", "x": -2.6, "y": 0, "x2": 2.6, "y2": 0, "stroke": "ink", "width": 3},
    {"type": "line", "x": 0, "y": 0, "x2": 0, "y2": 5.2, "stroke": "muted", "width": 1},
    {"type": "arrow", "x": -2.6, "y": 4.5, "x2": 0, "y2": 0, "head": 9, "stroke": "warn", "width": 2},
    {"type": "arrow", "x": 0, "y": 0, "x2": 2.6, "y2": 4.5, "head": 9, "stroke": "warn", "width": 2},
    {"type": "text", "x": -0.45, "y": 1.9, "text": "α", "size": 14, "fill": "ink"},
    {"type": "text", "x": 0.45, "y": 1.9, "text": "β", "size": 14, "fill": "ink"},
    {"type": "text", "x": 0, "y": 5.85, "text": "α = β", "size": 13, "fill": "ink"}
  ]}
 ]}
```

### 9.7 Cień

**Kiedy:** prostoliniowe rozchodzenie się światła — cień, półcień, zaćmienie; promień, który muska przeszkodę, wyznacza granicę cienia.
**Opis słowami:** Lampa świeci na słupek. Promień, który muska wierzch słupka, wyznacza koniec cienia na ziemi; za słupkiem, gdzie światło nie dociera, leży cień.

```json
{"alt": "Lampa świeci na słupek. Promień, który muska wierzch słupka, wyznacza koniec cienia na ziemi; za słupkiem, gdzie światło nie dociera, leży cień.",
 "size": [420,260],
 "elements": [
  {"type": "frame", "x": 10, "y": 8, "w": 400, "h": 244, "view": [-0.3,-0.6,10,5.68], "children": [
    {"type": "line", "x": -0.3, "y": 0, "x2": 10, "y2": 0, "stroke": "muted", "width": 1.5},
    {"type": "circle", "x": 1, "y": 5, "r": 11, "fill": "warn"},
    {"type": "text", "x": 1.45, "y": 5, "text": "źródło światła", "size": 12, "anchor": "start", "fill": "ink"},
    {"type": "line", "x": 1, "y": 5, "x2": 3.6, "y2": 0, "stroke": "warn", "width": 1.5},
    {"type": "line", "x": 1, "y": 5, "x2": 7, "y2": 0, "stroke": "warn", "width": 1.5},
    {"type": "poly", "points": [[4,0], [4.6,0], [4.6,2], [4,2]], "closed": true, "fill": "accent/70", "stroke": "accent"},
    {"type": "text", "x": 4.3, "y": 2.35, "text": "słupek", "size": 12, "fill": "ink"},
    {"type": "line", "x": 4.6, "y": 0, "x2": 7, "y2": 0, "stroke": "ink/75", "width": 7, "cap": "butt"},
    {"type": "text", "x": 5.8, "y": -0.35, "text": "cień", "size": 12, "fill": "ink"}
  ]}
 ]}
```

### 9.8 Dźwignia i bloczek

**Kiedy:** maszyny proste — ramiona sił i równowaga momentów, zmiana kierunku siły.
**Opis słowami:** Po lewej dźwignia na podporze: mniejsza siła F₂ na dłuższym ramieniu r₂ równoważy większą siłę F₁ na krótszym ramieniu r₁. Po prawej bloczek nieruchomy: zmienia tylko kierunek siły, F = mg.

```json
{"alt": "Po lewej dźwignia na podporze: mniejsza siła F₂ na dłuższym ramieniu r₂ równoważy większą siłę F₁ na krótszym ramieniu r₁. Po prawej bloczek nieruchomy: zmienia tylko kierunek siły, F = mg.",
 "size": [540,250],
 "elements": [
  {"type": "text", "x": 160, "y": 22, "text": "F₁ · r₁ = F₂ · r₂", "size": 14, "weight": 600, "fill": "ink"},
  {"type": "rect", "x": 30, "y": 112, "w": 260, "h": 8, "r": 2, "fill": "muted/60"},
  {"type": "poly", "points": [[110,120], [94,152], [126,152]], "closed": true, "fill": "ink/70"},
  {"type": "line", "x": 70, "y": 152, "x2": 150, "y2": 152, "stroke": "ink", "width": 2},
  {"type": "arrow", "x": 40, "y": 44, "x2": 40, "y2": 110, "head": 10, "stroke": "danger", "width": 2.5},
  {"type": "text", "x": 56, "y": 60, "text": "F₁", "size": 14, "fill": "danger"},
  {"type": "arrow", "x": 280, "y": 82, "x2": 280, "y2": 110, "head": 10, "stroke": "danger", "width": 2.5},
  {"type": "text", "x": 262, "y": 88, "text": "F₂", "size": 14, "fill": "danger"},
  {"type": "line", "x": 40, "y": 172, "x2": 110, "y2": 172, "stroke": "muted", "width": 1.5},
  {"type": "line", "x": 110, "y": 172, "x2": 280, "y2": 172, "stroke": "muted", "width": 1.5},
  {"type": "line", "x": 40, "y": 166, "x2": 40, "y2": 178, "stroke": "muted", "width": 1.5},
  {"type": "line", "x": 110, "y": 166, "x2": 110, "y2": 178, "stroke": "muted", "width": 1.5},
  {"type": "line", "x": 280, "y": 166, "x2": 280, "y2": 178, "stroke": "muted", "width": 1.5},
  {"type": "text", "x": 75, "y": 188, "text": "r₁", "size": 13, "fill": "muted"},
  {"type": "text", "x": 195, "y": 188, "text": "r₂", "size": 13, "fill": "muted"},
  {"type": "line", "x": 370, "y": 24, "x2": 490, "y2": 24, "stroke": "ink", "width": 3},
  {"type": "line", "x": 430, "y": 24, "x2": 430, "y2": 58, "stroke": "ink", "width": 2},
  {"type": "circle", "x": 430, "y": 74, "r": 16, "fill": "ground", "stroke": "ink", "width": 2},
  {"type": "circle", "x": 430, "y": 74, "r": 3, "fill": "ink"},
  {"type": "line", "x": 414, "y": 74, "x2": 414, "y2": 172, "stroke": "ink", "width": 1.5},
  {"type": "line", "x": 446, "y": 74, "x2": 446, "y2": 140, "stroke": "ink", "width": 1.5},
  {"type": "rect", "x": 398, "y": 172, "w": 32, "h": 30, "r": 3, "fill": "accent/70", "stroke": "accent"},
  {"type": "text", "x": 414, "y": 187, "text": "m", "size": 13, "fill": "ink"},
  {"type": "arrow", "x": 446, "y": 140, "x2": 446, "y2": 196, "head": 10, "stroke": "danger", "width": 2.5},
  {"type": "text", "x": 460, "y": 170, "text": "F", "size": 14, "fill": "danger"},
  {"type": "arrow", "x": 414, "y": 204, "x2": 414, "y2": 238, "head": 9, "stroke": "ink", "width": 2},
  {"type": "text", "x": 392, "y": 226, "text": "mg", "size": 13, "anchor": "end", "fill": "ink"}
 ]}
```

### 9.9 Oś liczbowa z niepewnością pomiaru

**Kiedy:** wynik pomiaru z niepewnością (przedział), porównanie dwóch wyników (zgodne, gdy przedziały się nakładają), zaokrąglanie. Podziałka powstaje z `"repeat"` (i = 0, 1, 2 …), napisy z `{fmt(…)}`.
**Opis słowami:** Oś liczbowa od 11,5 do 13,5 cm. Wynik pomiaru 12,4 cm to kropka, a odcinek od 12,1 do 12,7 cm pokazuje niepewność ± 0,3 cm.

```json
{"alt": "Oś liczbowa od 11,5 do 13,5 cm. Wynik pomiaru 12,4 cm to kropka, a odcinek od 12,1 do 12,7 cm pokazuje niepewność ± 0,3 cm.",
 "size": [440,150],
 "elements": [
  {"type": "line", "x": 20, "y": 80, "x2": 420, "y2": 80, "stroke": "ink", "width": 1.5},
  {"type": "line", "x": "=20 + i*20", "y": 80, "x2": "=20 + i*20", "y2": 86, "stroke": "muted", "width": 1, "repeat": 21},
  {"type": "line", "x": "=20 + i*100", "y": 72, "x2": "=20 + i*100", "y2": 92, "stroke": "ink", "width": 1.5, "repeat": 5},
  {"type": "text", "x": "=20 + i*100", "y": 106, "text": "{fmt(11.5 + i*0.5, 1)}", "size": 12, "fill": "ink", "repeat": 5},
  {"type": "line", "x": 140, "y": 62, "x2": 260, "y2": 62, "stroke": "accent", "width": 6, "cap": "butt"},
  {"type": "line", "x": 140, "y": 54, "x2": 140, "y2": 70, "stroke": "accent", "width": 2},
  {"type": "line", "x": 260, "y": 54, "x2": 260, "y2": 70, "stroke": "accent", "width": 2},
  {"type": "circle", "x": 200, "y": 62, "r": 6, "fill": "ink"},
  {"type": "text", "x": 200, "y": 36, "text": "12,4 ± 0,3 cm", "size": 15, "weight": 600, "fill": "ink"},
  {"type": "text", "x": 140, "y": 130, "text": "12,1", "size": 11, "fill": "accent"},
  {"type": "text", "x": 260, "y": 130, "text": "12,7", "size": 11, "fill": "accent"},
  {"type": "text", "x": 420, "y": 36, "text": "długość [cm]", "size": 12, "anchor": "end", "fill": "muted"}
 ]}
```

### 9.10 Dane z pomiarów: tabela i słupki

**Kiedy:** kilka pomiarów tej samej wielkości — tabela daje liczby, słupki pokazują rozrzut. Tabela i wykres to dwa osobne akapity.
**Opis słowami:** Cztery pomiary czasu spadku kulki z 2 m: od 0,61 do 0,66 s, średnio ok. 0,64 s.

```
| Pomiar | Czas spadku [s] |
|---|--:|
| 1 | 0,64 |
| 2 | 0,61 |
| 3 | 0,66 |
| 4 | 0,63 |
```

````
```chart Czas spadku kulki z 2 m (pomiary, przykład)
type: bar
y: czas [s]
| Pomiar | czas |
| 1. pomiar | 0,64 |
| 2. pomiar | 0,61 |
| 3. pomiar | 0,66 |
| 4. pomiar | 0,63 |
```
````

### 9.11 Oś czasu

**Kiedy:** kolejność wydarzeń (epoka, życie autora, dzieje); daty jako tekst, także przedziały.
**Opis słowami:** Polski romantyzm od „Ballad i romansów” (1822) przez powstanie listopadowe, „Dziady” cz. III i „Pana Tadeusza” do powstania styczniowego (1863).

````
```timeline Romantyzm w Polsce (przykład)
1822: „Ballady i romanse” Mickiewicza
1830–1831: powstanie listopadowe
1832: „Dziady” cz. III
1834: „Pan Tadeusz”
1863: powstanie styczniowe — koniec epoki
```
````

### 9.12 Drzewo pojęć

**Kiedy:** podział (rodzaje literackie, części mowy, sakramenty); wcięcie mówi, co do czego należy.
**Opis słowami:** Siedem sakramentów w trzech grupach: wtajemniczenia chrześcijańskiego (chrzest, bierzmowanie, Eucharystia), uzdrowienia (pokuta i pojednanie, namaszczenie chorych) i w służbie komunii (święcenia, małżeństwo).

````
```tree Sakramenty Kościoła
Sakramenty
  Wtajemniczenia chrześcijańskiego
    chrzest
    bierzmowanie
    Eucharystia
  Uzdrowienia
    pokuta i pojednanie
    namaszczenie chorych
  W służbie komunii
    święcenia
    małżeństwo
```
````
