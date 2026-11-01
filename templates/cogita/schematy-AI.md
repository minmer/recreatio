# Schematy wiedzy: przewodnik dla KI

Ten przewodnik dostaje Twoja KI (Claude, ChatGPT…), kiedy ma zbudować albo poprawić **schemat** bazy wiedzy Cogita: rodzaje wpisów, ich pola, szablony kart, widoki i powtórki. Aplikacja nie woła żadnej KI — KI odpowiada jednym dokumentem JSON, który wklejasz w aplikacji (Wiedza → Schematy → „Schemat jako JSON” → Import; import najpierw pokazuje, co zmieni).

Przewodnik mówi, **co aplikacja liczy sama** (tego schemat nie opisuje) i **co opisuje schemat** (tego aplikacja nie zgadnie). Składnię każdego klucza podają formaty importu aplikacji: `knowledge-base` (opis bazy wiedzy z szablonami, widokami i powtórkami) oraz gotowe schematy `scheme-fakty`, `scheme-zbior`, `scheme-wywod`, `scheme-podstawy`, `scheme-pytania` — przez MCP Recreatio (`get_import_format`) albo z plików w `templates/cogita/`.

## 0. Zasady dla KI

1. **Schemat opisuje RODZAJ wiedzy, nigdy jedną książkę.** „Fakt z datą i miejscem”, „pozycja zbioru do rozpoznania”, „pojęcie i to, czego wymaga” — tak; „Rozdziały książki X” — nie. Nowa książka dostaje wpisy i pytania, nie nowy schemat. Zanim zrobisz nowy schemat, sprawdź, czy wystarczy gotowy (tabela w `ksiazka-AI.md`).
2. **Nie opisuj tego, co liczy aplikacja** (rozdział 1). Klucze, których aplikacja nie zna, import pomija i mówi o tym.
3. **Każda deklaracja ma powód** w naturze tej wiedzy, zapisany w `"says"` pola albo w nazwie szablonu. Wagi i fakty bez powodu psują liczenie.
4. **Trwałe nazwy**: `"ref": "@<schemat>/<co>"` (np. `"@fakty/fakt"`, `"@fakty/t-kiedy"`); ten sam dokument zaimportowany drugi raz zmienia te same rodzaje i szablony.
5. **Odpowiadasz jednym dokumentem** `{"format": "recreatio.cogita.schema", "version": 1, "name", "kinds", "templates", "forms", "views", "revisions"}` i krótkim raportem: co który rodzaj opisuje, jakie fakty dzielą szablony, czego wymaga kolejność nauki.

## 1. Co aplikacja liczy sama — tego nie deklarujesz

**Pamięć jednej karty.** Każda odpowiedź zostaje zapisana; karta pamięta kilka wartości i z nich liczy następny odstęp: dobrze (od 90 %) — czas, który naprawdę minął, × 3; częściowo — jedna trzecia; źle (poniżej 25 %) — 5 minut. Znajomość karty: 3,16 zaraz po dobrej odpowiedzi, **dokładnie 1 w chwili, gdy przychodzi pora powtórki**, potem spada coraz wolniej (nigdy do zera; poniżej 10 % dopiero po 111 odstępach).

**Trzy pasma** — te same dla każdego rodzaju wiedzy:

| pasmo | znajomość | znaczy |
|---|---|---|
| znane | od 100 % | umiesz, jeszcze nie pora |
| do powtórki | od 10 % do 100 % | umiesz — i teraz (albo zaraz) trzeba powtórzyć |
| nieznane | poniżej 10 % | nigdy nie pytane, ostatnio źle albo zapomniane (trzy terminy po czasie) |

**Termin powtórki NIE znaczy „nie umiem”.** To, co jest do powtórki, nadal jest poznane — nie zamyka tego, co na nim buduje.

**Stos powtórki** („według tego, co umiem”): kilka kart naraz; karta wychodzi ze stosu dopiero po całkiem dobrej odpowiedzi; wolne miejsce bierze najpierw to, co do powtórki (najsłabiej znane najpierw), potem nieznane (nowe, ostatnio złe, zapomniane — w kolejności powtórki), a gdy obu nie ma — znane, które się zna najsłabiej („na zapas”). Karty jednego wpisu nie przychodzą jedna po drugiej, jeśli czeka coś innego.

**Sprawdzanie odpowiedzi** należy do rodzaju pytania, nie do schematu: tekst znak po znaku; data część po części (rok, miesiąc, dzień — każda osobno: zgodna liczy się w całości, o jeden obok w połowie; rok waży połowę); kolejność i pary z częściowymi punktami.

**Pary** pytania „Połącz w pary” z „Ile par naraz” mniejszym niż lista są faktami same z siebie: każda para ma swoją kartę, a w powtórce każda para pokazana na ekranie liczy się dla karty swojej pary.

**Wnioskowanie po kolejności nauki**: kto zna to, co buduje na wpisie, zna i sam wpis — co najmniej połowę tego, co zna najlepsze z rzeczy zbudowanych na nim (pola `"prerequisite"`); nigdy sumę.

## 2. Co opisuje schemat

### 2.1 Rodzaje i pola

Każdy rodzaj: `"name"`, `"label"` (np. `"{haslo}"`), `"tells"` (pole, które odróżnia wpisy o tej samej nazwie), pola z `"says"` — jedno, dwa zdania z przykładami, czym jest wartość pola i czym nie jest. To `"says"` czytają ludzie i KI, które potem wypełniają bazę.

**Kolejność nauki** — na polach-odwołaniach:
- `"prerequisite": "up"` — to, na co pole wskazuje, trzeba znać wcześniej (orbital → atom; fakt → fakty, których wymaga);
- `"prerequisite": "down"` — to, na co wskazuje, buduje na tym wpisie;
- `"structure": "up"` — wpis leży pod tym, na co wskazuje (fakt pod okresem, rok pod etapem życia): od ogółu do szczegółu.

Pole ze strukturą zwykle jest też `"prerequisite": "up"` (ogólne przed szczegółem). Kolejność deklaruj tylko tam, gdzie zrozumienie naprawdę wymaga wcześniejszego — nie z przyzwyczajenia do spisu treści.

### 2.2 Szablony kart: co sprawdzają (`tests`) i o jaki fakt pytają (`asks`)

Graf szablonu kopiuj z gotowych schematów (np. `scheme-fakty`, szablon „Hasło → kiedy (rok)”) i zmieniaj pola. Dwie deklaracje mówią, jak karta współpracuje z resztą wiedzy:

**`"tests"` — dla których WPISÓW karta jest dowodem i jak mocnym** (0–10; bez `"tests"`: jej wpis z wagą 1):
- dokładne pytanie o wpis — waga 1; ogólne albo łatwe (fiszka, wybór) — 0,5 lub mniej;
- karta liczy się też dla wpisów, na które wskazują jej pola, słabiej: karta „Kiedy?” faktu — `[{"of": "this", "weight": 1}, {"of": "okres", "weight": 0.5}]`.

Znajomość wpisu to średnia jego kart z odpowiedzią, ważona `"tests"`. Karta jeszcze nie pytana nie jest dowodem.

**`"asks"` — o jaki FAKT pytają karty szablonu.** Karty, które pytają o ten sam fakt tego samego wpisu, **dzielą każdą odpowiedź**: dobra odpowiedź na jedną liczy się dla wszystkich.

```json
"asks": ["data"]
"asks": [{"of": "this", "facet": "data"}, {"of": "okres", "facet": "ramy"}]
```

- Ten sam fakt w dwóch kierunkach albo w pytaniu i jego odwróceniu: „Kiedy było X?” i „Co było w listopadzie 1829?” — oba z `"asks": ["data"]`.
- **Różne fakty muszą mieć różne nazwy**, także gdy wyglądają podobnie: „Kiedy?” (`data`) i „Gdzie?” (`miejsce`) nie dzielą odpowiedzi. Rozpoznanie i przypomnienie naprawdę różnią się trudnością (wybór z czterech a wpisanie z pamięci)? Nazwij je osobno (`data-wybor`, `data`) — wtedy nie dzielą.
- W pętli „Dla każdej wartości” fakt jest osobny dla każdej wartości (słowo i jego tłumaczenie, pozycja listy).
- Karta, która pyta o kilka faktów, dostaje odpowiedź dopiero wtedy, gdy wszystkie zostały odpowiedziane na jednej karcie.
- Odpowiedzi dzieli powtórka (Nauka, moduły powtórki na stronach); przebiegi i sesje na żywo jeszcze nie.
- Bez `"asks"` karta liczy się tylko dla siebie — tak zostaw szablony, które pytają o coś, o co nie pyta żaden inny.

| co wiadomo o kartach | deklaracja |
|---|---|
| dwie karty pytają o to samo (kierunki, odwrócenie) | ten sam `"asks"` w obu szablonach |
| karta mówi coś o wpisie, którego nie pyta wprost (okres faktu, miejsce) | `"tests"` z polem i małą wagą |
| szczegół ma przyjść dopiero po ogólnym | pole z `"structure": "up"` i `"prerequisite": "up"` |
| coś trzeba umieć wcześniej, choć to nie ogólniejsze | pole z `"prerequisite": "up"` |
| długa lista par do zapamiętania | jedno pytanie „Połącz w pary” z „Ile par naraz” (4–6) — pary są faktami same |

### 2.3 Pytania pisane ręcznie (rodzaj „Pytanie”, `scheme-pytania`)

- `"about"` — wpisy, które pytanie sprawdza (liczy się dla nich i czeka na to, co trzeba znać przed nimi); `"needs"` — co dokładnie musi być poznane przed nim.
- Data: `"precision"` (`year`, `month`, `day`) tak dokładnie, jak naprawdę trzeba to umieć; `"tolerance"` tylko gdy sama wiedza jest przybliżona (±1 rok). Części daty i „blisko” aplikacja liczy sama.
- Długie listy par: `"show"` (Ile par naraz) 4–6.
- Części pytań (pary, zdania, luki, `"fact"`, `"share"`, `"#strona"`) — osobny przewodnik `guide-parts` (`templates/cogita/czesci-AI.md`).

### 2.4 Widoki i powtórki w schemacie: warunki pasmami

Warunek „Znajomość” w widoku albo w powtórce nazywa pasmo zamiast liczby:

```json
{"type": "knowness", "rel": "before", "band": "learned"}
```

- `"learned"` (poznane: do powtórki albo znane) — **domyślne dla kolejności nauki**: to, co wcześniej (`"rel": "before"`) albo wyżej w strukturze (`"rel": "up"`), zostało poznane;
- `"known"` (znane, od 100 %) — tylko gdy naprawdę ma być „świeżo umiane”, np. sprawdzian przed czymś;
- `"due"`, `"unknown"` — do widoków typu „co do powtórki”, „czego jeszcze nie znam”.

**Nie pisz `"op": "ge", "than": 1` dla „to, co wcześniej”** — to mylenie terminu powtórki z niewiedzą (aplikacja czyta taki stary zapis jako `"learned"`).

**Sposób pytania** (`"strategy"`) w powtórce schematu:
- `"mode": "temporal"`, `"stackSize"`: 10–20, `"minCorrectness"`: 1 (karta wychodzi ze stosu po całkiem dobrej odpowiedzi);
- `"order"`: `"general"` (od podstaw — przy kolejności nauki), `"text"` (jak w tekście), `"date"` (oś czasu);
- `"pick"`: `"weighted"` (domyślnie);
- `"endWhenDone": true` tylko w powtórkach „tylko zaległe” — zwykła codzienna powtórka uczy dalej na zapas i kończy się przyciskiem.

## 3. Czego nie robić

- Schemat pod jedną książkę albo jeden kurs.
- Ten sam fakt pod dwiema nazwami w dwóch szablonach (odpowiedzi się nie dzielą) albo dwa różne fakty pod jedną nazwą (karta „umie” to, czego nie pytano).
- Wysokie wagi `"tests"` na ogólnych, łatwych kartach (fiszka „co wiadomo?” z wagą 1 obok dokładnego pytania).
- Kolejność nauki na każdym polu-odwołaniu.
- Warunki „≥ 1” albo „znane” tam, gdzie chodzi o poznanie.
- `"endWhenDone": true` w codziennej powtórce.
- Deklarowanie tego, czego aplikacja jeszcze nie czyta: reguł przenoszenia znajomości innych niż kolejność nauki (np. „wpis zna się przez średnią jego części”, „przykłady dają najwyżej 60 %”) i częściowego dzielenia odpowiedzi między różnymi faktami. Takie potrzeby opisz w raporcie, nie w JSON-ie.

## 4. Przykład: dwa szablony o tym samym fakcie

Rodzaj „Wydarzenie” z polami `haslo`, `kiedy` (data), `okres` (odwołanie z `"structure": "up"` i `"prerequisite": "up"`). Dwa szablony pytają o datę — w dwóch kierunkach — więc dzielą odpowiedzi; oba są dowodem dla wydarzenia i, słabiej, dla jego okresu:

```json
{
  "ref": "@wydarzenia/t-kiedy",
  "name": "Hasło → kiedy (miesiąc)",
  "kinds": ["@wydarzenia/wydarzenie"],
  "direction": "hasło→kiedy",
  "graph": { "…": "jak w scheme-fakty „Hasło → kiedy (rok)”, odpowiedź answer.date z precision month" },
  "tests": [{"of": "this", "weight": 1}, {"of": "okres", "weight": 0.5}],
  "asks": ["data"]
},
{
  "ref": "@wydarzenia/t-co-wtedy",
  "name": "Kiedy → co się stało (wybór)",
  "kinds": ["@wydarzenia/wydarzenie"],
  "direction": "kiedy→hasło",
  "graph": { "…": "data jako pytanie, hasło jako odpowiedź z dystraktorami z tego samego okresu" },
  "tests": [{"of": "this", "weight": 0.5}],
  "asks": ["data"]
}
```

Powtórka schematu: źródło „widok” od ogółu do szczegółu, filtr `{"type": "knowness", "rel": "up", "band": "learned"}`, sposób `{"mode": "temporal", "stackSize": 15, "minCorrectness": 1, "order": "general"}`.

## 5. Zanim odpowiesz — sprawdź

- [ ] Schemat opisuje rodzaj wiedzy i da się go użyć w dwóch zupełnie różnych książkach.
- [ ] Każde pole ma `"says"` z przykładem.
- [ ] Kolejność nauki (`"prerequisite"`, `"structure"`) tylko tam, gdzie zrozumienie jej wymaga.
- [ ] Każdy szablon: `"tests"` z wagami z powodem; `"asks"` — wspólna nazwa dokładnie dla kart pytających o to samo.
- [ ] Warunki w widokach i powtórkach pasmami (`"band": "learned"` dla tego, co wcześniej i wyżej).
- [ ] Powtórka: `"temporal"`, stos 10–20, `"minCorrectness": 1`, bez `"endWhenDone"` (chyba że „tylko zaległe”).
- [ ] Raport: co który rodzaj opisuje, które szablony dzielą fakty i dlaczego, czego nie dało się zadeklarować.
