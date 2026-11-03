# Ćwiczenia generowane: przewodnik dla KI

Ten przewodnik mówi, jak pisać **ćwiczenia, które przy każdym pokazaniu są nowe**: liczby z zakresów, wpisy wylosowane z listy i połączone ze sobą, wynik policzony, odpowiedź uczącego się sprawdzona z policzonym wynikiem. Nie tylko matematyka: chemia z listy jonów, historia z listy dat, języki z listy słów. Składnię dokumentu podaje format importu `knowledge-base` (MCP Recreatio: `get_import_format`; tam też pełna lista funkcji wyrażeń), wspólne zasady schematów — przewodnik `guide-schemes` (`templates/cogita/schematy-AI.md`).

## 0. Zasady dla KI

1. **Opisujesz ćwiczenie raz** — przepis, nie listę gotowych zadań. Aplikacja losuje z niego nową wersję przy każdym pokazaniu karty (z ziarna, więc każda wersja da się odtworzyć).
2. **Najpierw pytanie z `"params"`** (rodzaj `"question"`, wpis w `"entities"`) — to najprostsza droga. Szablon z węzłem `"generate"` piszesz dopiero wtedy, gdy ćwiczenie ma powstać **dla każdego wpisu jakiegoś rodzaju** (dla każdego przedrostka jednostki, dla każdego jonu).
3. **Wynik liczy aplikacja**, nie Ty: w `"answers"`, `"options"`, `"items"`, `"correct"` stoją wzory w `{…}`, nie liczby.
4. **Każde losowanie ma sens dla każdej wersji**: zakresy i warunki (`"require"`) tak, żeby nie wyszło dzielenie przez zero, ujemna masa, ułamek tam, gdzie miała być liczba całkowita.
5. Odpowiadasz jednym dokumentem `{"format": "recreatio.cogita.course", "version": 1, "name", "kinds"?, "entities", "templates"?}` i krótkim raportem: jakie generatory, z czego losują, jakie warunki i dlaczego.

## 1. Co aplikacja robi sama — tego nie deklarujesz

- **Losuje i liczy w przeglądarce**, przy każdym pokazaniu karty — także w powtórkach bez internetu, w lekcjach i w modułach powtórki na stronach.
- **Losuje od nowa, dopóki warunki nie są spełnione** (`"require"`, najwyżej 60 razy). Gdy w 60 losowaniach nie wyjdzie żadna dobra wersja, karta nie powstaje — aplikacja nigdy nie pokazuje zepsutej — a autor widzi powód: w problemach bazy przy tym pytaniu albo szablonie, w próbkach edytora i w podglądzie importu.
- **Pamięć należy do karty, nie do wersji.** Karta ma stały klucz (pytanie albo `szablon:wpis`); nowa wersja liczb nie zaczyna nauki od nowa — znajomość, pasma, `"tests"` i `"asks"` działają jak przy każdej karcie.
- **Historia zaczyna się od nowa tylko wtedy, gdy zmienisz przepis.** Pytanie z `"params"` ma odcisk z tego, jak je napisano: `form`, `answers`, `options`, `correct`, `items`, `extra`, `alternatives`, `left`, `right`, `value`, `back`, `choices`, `params`, `let`, `require`, `tolerance`, `relative`, `unit`, `precision` — treść (`"prompt"`), `"hints"` i `"explanation"` się nie liczą. Szablon z węzłem `"random"` albo `"generate"` ma odcisk z definicji grafu. Nowe losowanie nigdy nie zaczyna historii od nowa; zmiana generatora — tak.
- **Odpowiedź zapamiętuje ziarno (`seed`) i wylosowane wartości (`params`: liczby, teksty, listy, wpisy jako `@id`).** Lista „Do poćwiczenia” i Postępy pokazują wersję, o którą pytano; „Ćwicz te jeszcze raz” daje nowe wersje.
- **Liczby piszą się z przecinkiem** (3,5), z prostym minusem — tak, jak uczący się je wpisze.

## 2. Pytanie z parametrami

| Klucz | Co znaczy |
|---|---|
| `"params"` | Co losować, po kolei. Liczba: `{"name": "s", "random": [20, 500], "step": 10}` (krok domyślnie 1 przy całkowitych granicach). Jedno z listy: `{"name": "f", "values": ["sin", "cos"]}`. Jeden wpis: `{"name": "kation", "entry": {"kind": "@chemia/jon", "where": "it.ladunek > 0"}}`. Kilka różnych wpisów: `{"name": "cztery", "entries": {"kind": "@historia/wydarzenie", "count": 4, "rule": {…}}}` (bez `"count"` — wszystkie pasujące, jako lista). Wpisy jednej wersji są różne; `"repeat": true` w losowaniu (`"entry": {"kind": …, "repeat": true}`) pozwala wylosować już wylosowany wpis jeszcze raz. |
| `"let"` | Co policzyć z wylosowanego, po kolei: `[{"name": "v", "value": "s / t"}]`. Każde `"let"` widzi parametry i wcześniejsze `"let"`. Wartością może być liczba, tekst, lista albo wpis: `"filter(aniony, it.id != anion.id)"`, `"'(' + sub(anion.symbol) + ')'"`. |
| `"require"` | Warunki, które każda wersja musi spełniać: `["x != 0", "w <= 100000"]`. |
| `{…}` w tekstach | Wartość w treści, odpowiedziach, możliwościach, kolejności, parach, podpowiedziach, wyjaśnieniu — i w `"correct"`, `"value"`, `"tolerance"`, `"unit"` (`"correct": ["{k}"]`, `"value": "{a.data < b.data}"`): `"{s}"`, `"{round(v, 2)}"`, `"{fmt(v * 3.6, 1)}"`, `"{pierwsze.label}"`, `"{lista[0]}"`. Cały `"{…}"` jako element listy, gdy jego wartość jest listą, rozkłada się na jej elementy: `"options": ["{dobra}", "{zle}"]` z trzema wartościami w `zle` daje cztery możliwości. |
| `{…}` we wzorach | W `$…$` wartość wchodzi do LaTeX-a, także jako argument: `$v = \frac{s}{t}$` pokaże `\frac{250}{58}`. Żeby zostały litery, napisz klamry ze spacjami: `\frac{ s }{ t }` (w JSON-ie `\\frac{ s }{ t }`). Klamry z ukośnikiem (`\{1,2\}`) też zostają LaTeX-em. |

**Wpisy w wyrażeniach.** Wylosowany wpis ma `id`, `label` (jego nazwa), `kind` (nazwa rodzaju) i każde swoje pole pod kluczem pola: liczby jako liczby (pole z jednostką — wartość w zapisanej jednostce, `<pole>_si` w SI, `<pole>_unit` — jednostka), teksty jako tekst, wybory jako zapisana wartość (`<pole>_label` — jej nazwa), tak/nie jako 1/0, **daty jako liczby `rrrrmmdd`** (do porównań; `<pole>_text` — słownie), odwołania jako wpisy o jeden poziom głębiej (`it.okres.label`; dalej już tylko nazwy), pola z kilkoma wartościami jako listy. `get(wpis, 'pole')` czyta pole, którego klucz jest wyliczany. W `"where"`, `filter`, `map`, `sortby`, `find`, `count`, `any`, `all`, `minby`, `maxby` element to `it`, jego numer `i`. Późniejsze losowanie może czytać wcześniejsze: `"where": "it.ladunek < 0 && it.id != kation.id"`. `"rule"` to ten sam zapis filtru, co w widokach (`{"op": "and", "items": [{"field": "data", "cmp": "filled"}]}`).

**Wyrażenia** (ten sam język, co „Oblicz” w szablonach, `"require"` i rysunki): `+ - * / % ^`, porównania `< <= > >= == !=`, `&&`, `||`, `!`, `w ? a : b`, `if(w, a, b)` (liczy tylko wybraną stronę). Listy: `[1, 2, 3]` albo `list(1, 2, 3)`, `xs[0]`, `xs[-1]` (ostatni), `xs + ys` (połączone). Teksty porównują się alfabetycznie (`'Ala' < 'Ola'`); `==` porównuje listy element po elemencie, a wpisy po `id`. Funkcje list i wpisów: `len sum min max avg first last at take drop slice reverse sort sortby minby maxby find shuffle choose pick filter map count any all contains index unique range join concat list get` (np. `minby(wydarzenia, it.data)` — najwcześniejsze, `find(jony, it.symbol == 'Na')` — pierwszy pasujący); liczby: `gcd lcm abs floor ceil round(x, cyfry) sig(x, cyfry znaczące) sqrt root(x, n) log(x, podstawa) fact binom isint mod num` (`num('2,5')` — 2,5 z tekstu); tekst: `str fmt(x, cyfry) sub sup plain upper lower`. `shuffle`, `choose`, `pick` losują z ziarna tej wersji. **Granice:** lista do 2000 elementów, jedno wyrażenie do 200 000 kroków po listach — więcej daje NaN i problem („za dużo obliczeń”), a wersja się nie losuje. Pełną listę z opisami podaje format `knowledge-base`.

## 3. Cztery wzory

### 3.1 Fizyka z jednostkami: prędkość

Odpowiedź w m/s z tolerancją 1 % (względną); odpowiedź w km/h, równoważna, też jest dobra (`"quantity"` przelicza jednostki tej samej wielkości), a odpowiedź w jednostce innej wielkości (np. „8 m”) jest błędna z wyjaśnieniem.

```json
{
  "ref": "@fizyka/q-predkosc", "kinds": ["question"],
  "data": {
    "form": "number",
    "prompt": "Rowerzysta przejechał {s} m w ciągu {t} s. Jaka była jego średnia prędkość?",
    "params": [{"name": "s", "random": [20, 500], "step": 10}, {"name": "t", "random": [2, 60]}],
    "let": [{"name": "v", "value": "s / t"}],
    "answers": ["{v}"],
    "unit": "m/s", "quantity": "Velocity", "tolerance": 0.01, "relative": true,
    "hints": ["Prędkość to droga podzielona przez czas: $v = \\frac{ s }{ t }$."],
    "explanation": "v = {s} m : {t} s ≈ {fmt(v, 2)} m/s, czyli {fmt(v * 3.6, 1)} km/h.",
    "about": ["@fizyka/predkosc"]
  }
}
```

W podpowiedzi klamry mają spacje (`\frac{ s }{ t }`), więc wzór zostaje literami; bez spacji pokazałby liczby tej wersji.

### 3.2 Chemia z list: wzór soli z dwóch jonów

Rodzaj „Jon” (`nazwa`, `w_nazwie` — jak jon brzmi w nazwie związku: „glinu”, „siarczan(VI)”, `symbol` — z cyframi zwykłymi: „SO4”, `ladunek` — liczba ze znakiem, `wieloatomowy` — wybór „tak”/„nie”). Wylosuj kation i anion, policz wzór z NWW ładunków: Al³⁺ i SO₄²⁻ dają Al₂(SO₄)₃. `sub(…)` zamienia cyfry na indeksy dolne. Dwa pytania z tym samym przepisem — w dwie strony. Nazwa → wzór, odpowiedź tekstem:

```json
{
  "ref": "@chemia/q-wzor-z-nazwy", "kinds": ["question"],
  "data": {
    "form": "text",
    "prompt": "Napisz wzór związku: {nazwa}.",
    "params": [
      {"name": "kation", "entry": {"kind": "@chemia/jon", "where": "it.ladunek > 0"}},
      {"name": "anion", "entry": {"kind": "@chemia/jon", "where": "it.ladunek < 0"}}
    ],
    "let": [
      {"name": "n", "value": "lcm(kation.ladunek, -anion.ladunek)"},
      {"name": "nk", "value": "n / kation.ladunek"},
      {"name": "na", "value": "n / -anion.ladunek"},
      {"name": "czK", "value": "nk > 1 && kation.wieloatomowy == 'tak' ? '(' + sub(kation.symbol) + ')' + sub(nk) : sub(kation.symbol) + (nk > 1 ? sub(nk) : '')"},
      {"name": "czA", "value": "na > 1 && anion.wieloatomowy == 'tak' ? '(' + sub(anion.symbol) + ')' + sub(na) : sub(anion.symbol) + (na > 1 ? sub(na) : '')"},
      {"name": "wzor", "value": "czK + czA"},
      {"name": "nazwa", "value": "anion.w_nazwie + ' ' + kation.w_nazwie"}
    ],
    "answers": ["{wzor}"],
    "rule": {"spaces": true, "scripts": true, "caseSensitive": true},
    "explanation": "Ładunki {kation.ladunek} i {anion.ladunek}: NWW = {n}, więc {nk} × {kation.symbol} i {na} × {anion.symbol} — {wzor}."
  }
}
```

`"spaces": true` — spacje nie mają znaczenia; `"scripts": true` — indeksy wpisane zwykłymi cyframi („Al2(SO4)3”) liczą się jak indeksy („Al₂(SO₄)₃”); `"caseSensitive": true`, bo we wzorze wielkość liter coś znaczy (Co i CO).

Wzór → nazwa, wybór; dystraktory to nazwy **innych połączeń z tej samej listy** — prawdopodobne, ale błędne:

```json
{
  "ref": "@chemia/q-nazwa-ze-wzoru", "kinds": ["question"],
  "data": {
    "form": "one",
    "prompt": "Jak nazywa się związek {wzor}?",
    "params": [
      {"name": "kation", "entry": {"kind": "@chemia/jon", "where": "it.ladunek > 0"}},
      {"name": "anion", "entry": {"kind": "@chemia/jon", "where": "it.ladunek < 0"}},
      {"name": "kationy", "entries": {"kind": "@chemia/jon", "where": "it.ladunek > 0"}},
      {"name": "aniony", "entries": {"kind": "@chemia/jon", "where": "it.ladunek < 0"}}
    ],
    "let": [
      {"name": "n", "value": "lcm(kation.ladunek, -anion.ladunek)"},
      {"name": "nk", "value": "n / kation.ladunek"},
      {"name": "na", "value": "n / -anion.ladunek"},
      {"name": "czK", "value": "nk > 1 && kation.wieloatomowy == 'tak' ? '(' + sub(kation.symbol) + ')' + sub(nk) : sub(kation.symbol) + (nk > 1 ? sub(nk) : '')"},
      {"name": "czA", "value": "na > 1 && anion.wieloatomowy == 'tak' ? '(' + sub(anion.symbol) + ')' + sub(na) : sub(anion.symbol) + (na > 1 ? sub(na) : '')"},
      {"name": "wzor", "value": "czK + czA"},
      {"name": "inneA", "value": "choose(filter(aniony, it.id != anion.id), 2)"},
      {"name": "innyK", "value": "pick(filter(kationy, it.id != kation.id))"}
    ],
    "require": ["len(kationy) >= 2", "len(aniony) >= 3"],
    "options": ["{anion.w_nazwie} {kation.w_nazwie}", "{inneA[0].w_nazwie} {kation.w_nazwie}", "{inneA[1].w_nazwie} {kation.w_nazwie}", "{anion.w_nazwie} {innyK.w_nazwie}"],
    "correct": [0]
  }
}
```

Możliwości aplikacja i tak miesza przy pokazaniu; poprawna stoi w `"options"` na miejscu z `"correct"`. Oba pytania dostają `"about"` z wpisami, których dotyczą (np. temat „Wzory soli”), i — jeśli są dwiema stronami tego samego faktu — wspólny `"fact"` (przewodnik `guide-parts`).

### 3.3 Matematyka od końca: równanie z wylosowanego rozwiązania

Losuj **rozwiązanie**, a z niego licz to, co w treści — wtedy odpowiedź jest zawsze całkowita.

```json
{
  "form": "number",
  "prompt": "Rozwiąż równanie: ${a}x {znak} {bb} = {c}$",
  "params": [{"name": "x", "random": [-9, 9]}, {"name": "a", "random": [2, 9]}, {"name": "b", "random": [-20, 20]}],
  "let": [{"name": "c", "value": "a * x + b"}, {"name": "znak", "value": "b < 0 ? '-' : '+'"}, {"name": "bb", "value": "abs(b)"}],
  "require": ["x != 0", "b != 0"],
  "answers": ["{x}"],
  "explanation": "${a}x = {c - b}$, więc $x = {x}$."
}
```

Logarytm z wylosowanej podstawy i wykładnika:

```json
{
  "form": "number",
  "prompt": "Oblicz: $\\log_{ {p} } {w}$",
  "params": [{"name": "p", "values": [2, 3, 5, 10]}, {"name": "k", "random": [2, 5]}],
  "let": [{"name": "w", "value": "p^k"}],
  "require": ["w <= 100000"],
  "answers": ["{k}"],
  "hints": ["Do jakiej potęgi trzeba podnieść {p}, żeby dostać {w}?"]
}
```

### 3.4 Logika na datach: co było wcześniej, ułóż po kolei

Bez rachunków — tylko porównanie. Daty wpisów są liczbami `rrrrmmdd`, więc `sortby`, `minby` i `<` porządkują je w czasie.

```json
{
  "form": "one",
  "prompt": "Co było wcześniej?",
  "params": [{"name": "dwa", "entries": {"kind": "@historia/wydarzenie", "count": 2, "rule": {"op": "and", "items": [{"field": "data", "cmp": "filled"}]}}}],
  "let": [{"name": "po", "value": "sortby(dwa, it.data)"}],
  "require": ["po[0].data != po[1].data"],
  "options": ["{po[0].label}", "{po[1].label}"],
  "correct": [0],
  "explanation": "{po[0].label}: {po[0].data_text}; {po[1].label}: {po[1].data_text}."
}
```

```json
{
  "form": "order",
  "prompt": "Ułóż od najwcześniejszego.",
  "params": [{"name": "cztery", "entries": {"kind": "@historia/wydarzenie", "count": 4, "rule": {"op": "and", "items": [{"field": "data", "cmp": "filled"}]}}}],
  "let": [{"name": "po", "value": "sortby(cztery, it.data)"}],
  "require": ["len(unique(map(cztery, it.data))) == 4"],
  "items": ["{po[0].label}", "{po[1].label}", "{po[2].label}", "{po[3].label}"]
}
```

## 4. Szablon z węzłem `"generate"` — ćwiczenie dla każdego wpisu rodzaju

Gdy ćwiczenie ma powstać **dla każdego wpisu** (każdy przedrostek jednostki, każdy pierwiastek), napisz szablon kart. Węzeł `"generate"` ma ten sam przepis co pytanie (`"params"`, `"let"`, `"require"`), a wpis, dla którego powstaje karta, to `this` (`this.wykladnik`). Do tego:

- `"texts"` — teksty z wartościami tej wersji: `[{"name": "pytanie", "value": "Jaki wzór ma {nazwa}?"}]`;
- `"only"` — które wpisy rodzaju dostają kartę: `"only": "this.ladunek > 0"` (pozostałe — bez karty i bez ostrzeżenia).

Każda nazwa z przepisu (`"params"`, `"let"`, `"texts"`) jest osobnym wyjściem węzła — łączysz je krawędziami z `"pattern"` (treść), z odpowiedzią (`"answer.number"`, `"answer.text"`, `"answer.one"`, `"answer.order"`, `"answer.match"`; dystraktory dalej przez `"distractors"`) i z wejściami karty `"hints"` (podpowiedzi) i `"solution"` (rozwiązanie, pokazywane po odpowiedzi).

Z przykładu `example-world` (`templates/cogita/przyklad-swiat.json`): rodzaj „Przedrostek jednostki” (`nazwa`, `symbol`, `wykladnik`), dla każdego karta „Zamień na metry: 45 km” z rozwiązaniem „45 km = 45 · 1000 m = 45000 m”:

```json
{
  "ref": "@swiat/t-zamiana", "name": "Zamiana jednostek z przedrostkiem (generator)",
  "kinds": ["@swiat/przedrostek"], "direction": "przedrostek→metry",
  "graph": {
    "nodes": [
      {"id": "g", "type": "generate", "x": 0, "y": 0, "config": {
        "params": [{"name": "x", "random": [2, 90]}],
        "let": [{"name": "metry", "value": "x * 10^this.wykladnik"}],
        "texts": [{"name": "rozwiazanie", "value": "{x} {this.symbol}m = {x} · {10^this.wykladnik} m = {metry} m"}]}},
      {"id": "f", "type": "field", "x": 0, "y": 160, "config": {"key": "symbol"}},
      {"id": "p", "type": "pattern", "x": 260, "y": 40, "config": {"text": "Zamień na metry: {0} {1}m", "inputs": 2}},
      {"id": "q", "type": "prompt", "x": 500, "y": 40, "config": {}},
      {"id": "a", "type": "answer.number", "x": 500, "y": 180, "config": {"unit": "m", "quantity": "Length", "tolerance": 0.001, "relative": true}},
      {"id": "c", "type": "card", "x": 740, "y": 100, "config": {}}
    ],
    "edges": [
      {"id": "e1", "from": "g", "out": "x", "to": "p", "in": "p0"},
      {"id": "e2", "from": "f", "out": "values", "to": "p", "in": "p1"},
      {"id": "e3", "from": "p", "out": "text", "to": "q", "in": "parts"},
      {"id": "e4", "from": "g", "out": "metry", "to": "a", "in": "expected"},
      {"id": "e5", "from": "q", "out": "prompt", "to": "c", "in": "prompt"},
      {"id": "e6", "from": "a", "out": "answer", "to": "c", "in": "answer"},
      {"id": "e7", "from": "g", "out": "rozwiazanie", "to": "c", "in": "solution"}
    ]
  },
  "tests": [{"of": "this", "weight": 1}, {"of": "temat", "weight": 0.5}]
}
```

Prostsze węzły zostają i liczą tym samym językiem: `"random"` (jedna wartość z zakresu albo z listy; `"count"` — tyle różnych naraz: `{"list": ["a", "b", "c"], "count": 2}`), `"calc"` (wyrażenia z `p0…p7` — pierwsza liczba z wejścia, `n0…n7` — ile wartości przyszło, `l0…l7` — całe wejście jako lista, wpisy jako wpisy: `sum(l0, it.masa)`, `map(l0, it.label)`; wynik-lista daje kilka wartości), `"aggregate"` (suma, średnia…), `"entries"` (wpisy rodzaju). `"generate"` łączy je w jeden przepis.

## 5. Warunki i ponowne losowanie

- Warunek to wyrażenie, które ma dać prawdę (nie 0, nie pusty tekst). Kilka warunków — wszystkie muszą być spełnione.
- Losowanie powtarza się, aż warunki są spełnione — najwyżej 60 razy (potem karty nie ma, rozdział 1). Jeśli warunek odrzuca większość wersji (np. „wynik jest liczbą pierwszą” przy dużym zakresie), lepiej **policz od końca** (3.3) niż losuj i odrzucaj.
- Podgląd (rozdział 10) podaje, ile losowań średnio trzeba na jedną wersję. Więcej niż 1,5 — zawęź zakresy albo przepisz ćwiczenie od końca.
- Za mało wpisów do wylosowania (`"count": 4`, a pasują trzy) — warunek niespełniony, karta nie powstaje; sprawdź `len(…)` w `"require"`.
- W szablonie: przepis, który pasuje tylko do części wpisów (tylko kationy, tylko przedrostki większe od 1), ogranicz przez `"only"` — pozostałe wpisy nie dostaną karty ani ostrzeżenia.

## 6. Dystraktory

- **Wyliczone błędy**: `"options": ["{x}", "{x + 1}", "{-x}", "{2 * x}"]` — typowe pomyłki (znak, o jeden, podwojenie). Gdy dwa mogą się pokryć z poprawną, wyklucz to w `"require"` (`"x != 0"`).
- **Inne wylosowane elementy**: nazwy innych jonów, inne wydarzenia — `choose(filter(lista, it.id != wylosowany.id), 3)`.
- **Lista naraz**: `"let": [{"name": "zle", "value": "map(choose(filter(aniony, it.id != anion.id), 3), it.w_nazwie + ' ' + kation.w_nazwie)"}]` i `"options": ["{anion.w_nazwie} {kation.w_nazwie}", "{zle}"]`, `"correct": [0]` — `"{zle}"` rozkłada się na trzy możliwości.
- W szablonach dystraktory z innych wpisów daje dalej węzeł `"distractors"` (`"from"`, `"count"`).

## 7. Jednostki i tolerancja

- `"unit"` — jednostka odpowiedzi (stoi obok pola), `"quantity"` — wielkość (`"Velocity"`, `"Length"`, `"Mass"`, `"Force"`, `"Torque"` …): odpowiedź w innej jednostce tej samej wielkości jest przeliczana (km/h ↔ m/s), w jednostce innej wielkości — błędna, z wyjaśnieniem.
- `"tolerance"` + `"relative": true` — tolerancja względna (0.01 = 1 %); bez `"relative"` — bezwzględna w jednostce odpowiedzi. Tolerancja i jednostka też mogą być wyliczone (`"tolerance": "{tol}"`, `"unit": "{jednostka}"`).
- W `"answers"` dawaj **dokładny wynik** (`"{v}"`), a tolerancją decyduj, co jeszcze jest dobre — nie zaokrąglaj w odpowiedzi, chyba że zadanie każe zaokrąglić (`"{round(v, 1)}"` i `"tolerance": 0`).

## 8. Tekst w odpowiedzi

`"rule"` pytania `"text"`: `"spaces"` (spacje bez znaczenia), `"scripts"` (₂ = 2, ³ = 3), `"caseSensitive"`, `"similar"` (ą = a), `"ignorePunctuation"`, `"threshold"` (ile musi się zgadzać, 0–1). Tekst budujesz z wartości: `'(' + sub(anion.symbol) + ')' + sub(na)`, `upper(…)`, `fmt(x, 2)` (liczba z przecinkiem).

## 9. Rozwiązanie krok po kroku

`"hints"` i `"explanation"` mogą pokazywać wylosowane wartości i wyniki pośrednie: `"explanation": "${a}x = {c - b}$, więc $x = {x}$."`. Podpowiedź ma prowadzić (co policzyć), wyjaśnienie — pokazać rachunek z TĄ wersją liczb. W szablonie to samo dają teksty z `"texts"` węzła `"generate"`, połączone z wejściami karty `"hints"` i `"solution"` (rozdział 4).

## 10. Sprawdź, zanim użytkownik zaimportuje

Serwer podglądu `recreatio-preview`, narzędzie `preview_knowledge` (dokument w formacie `knowledge-base`): dla każdego pytania z `"params"` i każdego szablonu z `"generate"` albo `"random"` pokazuje ~10 wersji z poprawną odpowiedzią, wylosowanymi wartościami i możliwościami, średnią liczbę losowań na wersję i generatory, które nie działają (z powodem). Import w aplikacji też ostrzega o generatorach, które nie dają żadnej wersji, a edytor pytania i szablonu pokazuje próbki.

## 11. Czego nie robić

- Lista dziesięciu gotowych zadań zamiast jednego przepisu.
- Wynik wpisany liczbą (`"answers": ["8,11"]`) obok losowanych danych — zawsze wzór (`"{v}"`).
- Losowanie z odrzucaniem prawie wszystkiego (`"require": ["isint(c / a)"]` przy dużych zakresach) — licz od końca.
- Zaokrąglona odpowiedź z tolerancją 0, gdy uczący się może zaokrąglić inaczej.
- Daty jako tekst w porównaniach („12 marca 1815” < …) — porównuj pole daty wpisu (liczba `rrrrmmdd`).
- Dystraktor, który bywa równy poprawnej odpowiedzi (bez warunku, który to wyklucza).
- `\frac{s}{t}` we wzorze, który ma zostać literami — aplikacja wstawi liczby; pisz `\frac{ s }{ t }`.
- Przepis zmieniany „kosmetycznie” (`"params"`, `"let"`, odpowiedzi, graf szablonu) po rozpoczęciu nauki — każda zmiana przepisu zaczyna historię karty od nowa. Treść, podpowiedzi i wyjaśnienie możesz poprawiać.
- Szablon z `"generate"` tam, gdzie wystarczy jedno pytanie z `"params"`; szablon bez `"only"`, gdy przepis pasuje tylko do części wpisów.

## 12. Zanim odpowiesz — sprawdź

- [ ] Każde ćwiczenie to jeden przepis; wyniki w `{…}`, nie liczbami.
- [ ] Zakresy i `"require"` wykluczają wersje bez sensu (zero, ujemne, powtórzone możliwości, za mało wpisów).
- [ ] Gdzie wynik ma być całkowity — losujesz rozwiązanie i liczysz od końca.
- [ ] Liczby z jednostką: `"unit"`, `"quantity"`, tolerancja (zwykle względna).
- [ ] Tekst: `"rule"` z `"spaces"`, `"scripts"` (i `"caseSensitive"` we wzorach).
- [ ] Dystraktory prawdopodobne i nigdy równe poprawnej.
- [ ] Wzory w `$…$`: litery w klamrach ze spacjami (`\frac{ s }{ t }`), wartości — bez spacji (`\frac{s}{t}`).
- [ ] Wyjaśnienie (w szablonie: `"texts"` → `"solution"`) pokazuje rachunek z wylosowanymi wartościami.
- [ ] Szablon z `"generate"`: `"only"`, gdy przepis pasuje tylko do części wpisów.
- [ ] `preview_knowledge`: każda próbka poprawna, ≈1 losowanie na wersję, brak generatorów, które zawodzą.
