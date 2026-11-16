# Grafiki w tekstach: przewodnik dla KI

Ten przewodnik mówi, jak w tekstach Recreatio — wpisach bazy wiedzy (Cogita), wyjaśnieniach i podpowiedziach pytań, slajdach, krokach przebiegu, tekstach Biblioteki i Skryptorium — **pokazać coś jako strukturę**: tabelę, wykres, wykres funkcji, schemat, drzewo albo oś czasu. Grafika to zwykły tekst w polu z zapisem (`"markup"`, akapit w `"blocks"`, wyjaśnienie `"explanation"`, treść slajdu) — aplikacja rysuje ją sama, w każdym miejscu, gdzie ten tekst się pokazuje. Składnię całego dokumentu podaje format importu (`get_import_format knowledge-base`).

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
