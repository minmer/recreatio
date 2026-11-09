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
- `"part": "up"` — wpis jest **częścią bloku**, na który wskazuje (mapa świata: większy temat jako płaski dysk, na nim części jako stykające się filary); `"part": "down"` — blok wskazuje swoje części. **Nigdy na tym samym polu co `"prerequisite"`** (takie pole liczy się tylko jako wymaganie i trafia na listę dla autorów); część należy do jednego bloku. Bez pola z `"part"` nie ma bloków. Więcej: **guide-world-map** (templates/cogita/weltkarte-AI.md).

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
- Ćwiczenia generowane — za każdym razem nowe liczby, wylosowane wpisy, wynik liczony (`"params"`, `"let"`, `"require"`, węzeł `"generate"` w szablonie) — osobny przewodnik `guide-generators` (`templates/cogita/generatory-AI.md`).

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
- inne tryby: `"once"` — każda karta stosu dokładnie raz, zła odpowiedź nie wraca w tym przebiegu, na końcu każdy temat jako „umiesz” albo „luka” (z „Uzupełnij luki”); `"random"` — jak `"once"`, ale tylko `"count"` kart (domyślnie 20); `"levels"` — stos `"stackSize"`, dobra odpowiedź podnosi kartę o poziom (do `"levels"`, domyślnie 5), zła na poziom 1; przebieg kończy się sam;
- `"pick": "sample"` z `"perTopic": 2` — z każdego tematu tylko 2 losowe karty (sprawdzian na wyrywki); osobny krok `{"type": "sample", "config": {"perTopic": 1}}` robi to samo w środku grafu (np. „Razem” z kartami luk).

**Sprawdź, co wiesz — pytania kluczowe (2026-11-05).** Na każdy temat jedno–dwa pytania z `"core": true` (tematy w `"about"`). Powtórka „Sprawdź, co wiesz — cała książka”: źródło pytań → `filter.rule` z `{"field": "core", "cmp": "eq", "value": "true"}` → `{"mode": "once", "order": "general"}`; uczący się odpowiada raz na każde, na końcu widzi luki. „Uzupełnij luki”: `{"type": "filter.when", "config": {"when": {"type": "knowness", "rel": "core", "each": "any", "band": "unknown"}}}` (pytanie kluczowe tematu nieznane) razem z `{"type": "sample", "config": {"perTopic": 1}}` → `{"mode": "once"}`. Bez gotowej powtórki krajobraz ma przycisk „Sprawdź, co wiesz” (obszar w obrazie albo cała mapa) i filtr „Luki”. Opowieść, której wszystkie pytania uczący się już umie, liczy się jako zaliczona (pole opada do doliny) — nie trzeba jej przechodzić.

### 2.5 Baza gotowa na krajobraz wiedzy (`"mode": "landscape"`)

Krajobraz (tryb widoku `"landscape"`; na stronie moduł „Widok” z `"mode": "krajobraz"`) pokazuje każdemu uczącemu się JEGO wiedzę jako teren: to, co umie, jest doliną (im pilniej trzeba to powtórzyć, tym wyżej się wynurza), to, czego może nauczyć się teraz — pierścieniem przed nim, a reszta górami. Tryb `"map"` zostaje bez zmian — to mała mapa; krajobraz jest osobnym trybem.

**Wysokość liczy aplikacja** — z kart i odpowiedzi uczącego się, nic jej nie deklarujesz:

- **−1** — wpis znany (znajomość ≥ 1): dno doliny;
- **od −1 do 0** — do powtórki (0,1 ≤ k < 1): −(k − 0,1)/0,9, więc w miarę zapominania wpis wynurza się z doliny;
- **0** — pierścień: wpis jeszcze niepoznany, a wszystko przed nim poznane — do nauki teraz;
- **n ≥ 1** — góra: n to liczba RÓŻNYCH niepoznanych wpisów z kartami w całym łańcuchu wymagań przed nim, gdziekolwiek stoją (poznany = pasmo `learned`, od 10 %: to, co blednie, nie podnosi gór z powrotem).

Koło w wymaganiach liczy się jako jeden krok. Wpis bez kart jest przezroczysty: nie jest polem ani krokiem — łańcuch wymagań przez niego przechodzi, a jego nazwa może się pojawić jako nazwa obszaru.

Krajobraz czyta tylko to, co schemat i tak deklaruje — nic nie dopisujesz specjalnie dla niego — ale schemat musi być dobrze zbudowany:

1. **Tylko bezpośrednie wymagania.** Pole z `"prerequisite": "up"` wskazuje to, co trzeba znać BEZPOŚREDNIO przed tematem (prędkość → droga i czas, proporcjonalność). Dalsze kroki aplikacja liczy sama; dopisane „na zapas” nie zmieniają wysokości gór, ale psują drogę do celu (trasa przechodzi wtedy obok kroków, które naprawdę są po drodze).
2. **Bez kół.** A wymaga B, a B wymaga A — to błąd danych. Import ostrzega o kole, które dotyka importowanych wpisów; poziomy i ścieżka pomijają wtedy jedno połączenie, a krajobraz liczy całe koło jako jeden krok. Popraw dane, zamiast na tym polegać.
3. **Jeden temat = jeden równy krok.** Krajobraz liczy każdy wpis jako jeden krok, bez wag trudności. Temat, który wymaga kilku nowych idei naraz (albo godzin nauki), podziel na kilka tematów z wymaganiami między nimi; temat zbyt drobny (definicja, która nic nie wnosi) połącz z sąsiednim.
4. **Każdy temat ma karty.** Wpis bez kart (np. „Dział”, który tylko porządkuje) nie stoi w krajobrazie jako pole: to, co go wymaga, czeka od razu na to, czego wymaga on. Do każdego tematu dołącz szablon (np. fiszkę „Czym jest…?”) albo pytania z `"about"`.
5. **Kierunek: oś z hierarchią.** Grupowanie widoku wyznacza kierunki na półkolu i poziomy przybliżenia. Najlepsza jest oś — rodzaj „Dziedzina” albo „Tag” — z hierarchią przez pole `"structure": "up"` („Ruch” należy do „Fizyki”, „Algebra” do „Matematyki”): krajobraz dzieli półkole na dziedziny najwyższe, a po wybraniu jednej rozkłada jej części, na dowolną głębokość (wysokości zostają te same). Temat wskazuje dziedziny polem-odwołaniem (to pole wpisujesz w `"via"`). Z `"sort": {"field": "nr"}` obszary stoją od lewej do prawej w tej kolejności (np. etapy życia chronologicznie); bez `"sort"` krajobraz sam stawia obok siebie to, co często występuje razem albo łączy kolejność nauki.
6. **Kilka dziedzin tylko tam, gdzie naprawdę pasują.** Temat z kilkoma dziedzinami stoi między ich obszarami (historia odkrycia fizycznego — między „Historią nauki” a „Ruchem”). Dziedzina dopisana „na wszelki wypadek” rozmywa mapę. Dziedzina ma być najwęższa pasująca („Ruch”, nie „Fizyka”). Temat bez żadnej dziedziny (np. przegląd całości) stoi pośrodku, przy uczącym się — nie jest obszarem.
7. **Dziedzina tylko u góry drzewa — reszta ją dziedziczy.** Gdy tematy tworzą drzewo przez pole struktury w górę (np. `wymaga` z `"structure": "up"`), wystarczy wpisać dziedzinę tematom najwyższego poziomu (etapom) i dodać `"through": "<to pole>"`: w krajobrazie `through` po polu struktury w górę sięga wszystkich poziomów (gdzie indziej: `"depth": "all"`). Temat dostaje dziedzinę najbliższego przodka, który ją ma — na każdej drodze w górę osobno, więc wątek wymagający dwóch etapów stoi między ich obszarami; temat z własną dziedziną ma tylko ją (etap 2, który wymaga etapu 1, zostaje w obszarze 2).
8. **Grupowanie widoku krajobrazu:**
   - `{"by": "axis", "kind": "<rodzaj osi>", "via": ["<pole dziedzin>"]}` — zwykle najlepsze (oś z hierarchią jak wyżej);
   - `{"by": "axis", "kind": "<rodzaj obszarów>", "via": ["<pole obszaru>"], "through": "<pole struktury w górę>", "sort": {"field": "nr"}}` — obszar wpisany tylko tematom najwyższego poziomu;
   - `{"by": "field", "field": "<pole wyboru>"}` — gdy tematy dzieli jedno pole wyboru (epoka, rodzaj tematu);
   - `{"by": "kind"}` — gdy w widoku stoi kilka rodzajów wpisów;
   - bez grupowania obszary to poddrzewa pod najogólniejszymi tematami (po polu struktury w górę, inaczej po wymaganiach; przy jednym korzeniu — niżej, aż drzewo się rozgałęzi), nazwane od swojego najogólniejszego tematu.

   Przykłady z prawdziwych baz: kurs ze skryptu (rodzaj „Lerneinheit”, wymagania w `braucht`, części w `teil` ze `"structure": "up"`) grupuje po osi tego samego rodzaju przez `teil`; przewodnik po biografii (rodzaj „Temat”, pole `wymaga` jako wymaganie i struktura) — po osi rodzaju „Obszar” (`nazwa`, `nr`), wpisanego tylko ośmiu etapom w polu `obszar`: `{"by": "axis", "kind": "@przewodnik/obszar", "via": ["obszar"], "through": "wymaga", "sort": {"field": "nr"}}`.

Widok krajobrazu (z przykładu `example-world`, `templates/cogita/przyklad-swiat.json`):

```json
{"ref": "@swiat/w-krajobraz", "name": "Krajobraz wiedzy", "mode": "landscape",
 "steps": [{"type": "source.kind", "config": {"kind": "@swiat/temat"}}],
 "group": {"by": "axis", "kind": "@swiat/dziedzina", "via": ["dziedziny"]},
 "landscape": {"budget": 60, "bands": {"ring": 0.5, "due": 0.2, "known": 0.1}}}
```

Każdy temat stoi na mapie we własnym polu — nic nie jest łączone w pola „+N” i nie ma pustych pól. `"landscape.budget"` i `"landscape.bands"` ze starszych baz są czytane, ale nie mają już wpływu. Barwa to obszar, nasycenie to znajomość (głębokie — umiem, najjaśniejsze — nowe), wysokość to odległość; na mapie są tylko dwa znaczniki (powtórka i zamek) i żadnych napisów — nazwa pojawia się po najechaniu i w okienku pola; mała legenda jest zawsze widoczna.

### 2.6 Krajobraz zagnieżdżony: pola mapy z danych (`"landscape": {"nest": …}`)

Przy setkach tematów jedna mapa jest nieczytelna. Wtedy grupy mapy zapisujesz w danych — nigdy nie powstają z obliczeń:

1. **Rodzaj węzła** (np. „Pole mapy”): `nazwa`, `nr` (kolejność wśród rodzeństwa) i pole odwołania do tego samego rodzaju z `"structure": "up"` — węzeł nadrzędny. Puste: węzeł najwyższego poziomu. Gałęzie mogą mieć różną głębokość (jedna 2 poziomy, inna 5).
2. **Pole odwołania na tematach** (np. `pole`) — najwęższy węzeł, w którym temat stoi. Temat bez węzła stoi na najwyższym poziomie.
3. **Widok** z `"landscape": {"nest": "<klucz tego pola>"}`; `"nestSort"` — pole kolejności węzłów (domyślnie `"nr"`). Grupowanie (`"group"`) nie jest potrzebne.

Co widzi uczący się: całość pokazuje **tylko najwyższy poziom**; każde przybliżenie (klik → „Wejdź”) pokazuje **dokładnie jeden poziom** — węzły niżej i tematy stojące w tym węźle, razem; okruszki prowadzą z powrotem. **Węzeł jest prawdziwym polem:** pierścień = znane / wszystkie karty całego poddrzewa; kolor głębszy, im więcej w środku umie; wysokość = odległość do najbliższego tematu w środku, którego można się uczyć (0, gdy coś jest gotowe); zapada się w dolinę, gdy w środku wszystko jest opanowane (ze znacznikiem powtórki, gdy coś jest do powtórzenia); zamek, gdy wszystko, co w środku czeka, wymaga najpierw powtórki. Okienko węzła: nazwa, pierścień, stan słowami, jeden główny przycisk — „Wejdź”, „Powtórz” (karty do powtórki w poddrzewie) albo „Ustaw jako cel” (najbliższy temat w środku) — i lista tego, co w środku. Miejsca są stałe: ciasno w pierścieniach wokół uczącego się, bliżej to, co trzeba poznać wcześniej, nigdy według postępów. Jednostka opowieści może być węzłem albo tematem.

Pełny przykład (z `example-world`, `templates/cogita/przyklad-swiat.json` — gałąź Matematyka ma 5 poziomów, Fizyka 2):

```json
{"kinds": [
  {"ref": "@swiat/pole", "name": "Pole mapy", "label": "{nazwa}", "fields": [
    {"key": "nazwa", "label": "Nazwa", "type": "line"},
    {"key": "nr", "label": "Kolejność", "type": "number"},
    {"key": "nad", "label": "Leży w", "type": "ref", "to": ["@swiat/pole"], "structure": "up"}]},
  {"ref": "@swiat/temat", "name": "Temat", "label": "{nazwa}", "fields": [
    {"key": "nazwa", "label": "Nazwa", "type": "line"},
    {"key": "wymaga", "label": "Wymaga", "type": "ref", "to": ["@swiat/temat"], "multi": true, "prerequisite": "up"},
    {"key": "pole", "label": "Pole mapy", "type": "ref", "to": ["@swiat/pole"]}]}],
 "entities": [
  {"ref": "@swiat/m-matematyka", "kinds": ["@swiat/pole"], "data": {"nazwa": "Matematyka", "nr": 1}},
  {"ref": "@swiat/m-liczby", "kinds": ["@swiat/pole"], "data": {"nazwa": "Liczby", "nr": 1, "nad": "@swiat/m-matematyka"}},
  {"ref": "@swiat/m-dzialania", "kinds": ["@swiat/pole"], "data": {"nazwa": "Działania", "nr": 1, "nad": "@swiat/m-liczby"}},
  {"ref": "@swiat/m-ulamki", "kinds": ["@swiat/pole"], "data": {"nazwa": "Ułamki", "nr": 1, "nad": "@swiat/m-dzialania"}},
  {"ref": "@swiat/m-dziesietne", "kinds": ["@swiat/pole"], "data": {"nazwa": "Dziesiętne i procenty", "nr": 1, "nad": "@swiat/m-ulamki"}},
  {"ref": "@swiat/m-fizyka", "kinds": ["@swiat/pole"], "data": {"nazwa": "Fizyka", "nr": 2}},
  {"ref": "@swiat/m-ruch", "kinds": ["@swiat/pole"], "data": {"nazwa": "Ruch", "nr": 1, "nad": "@swiat/m-fizyka"}},
  {"ref": "@swiat/t-procenty", "kinds": ["@swiat/temat"], "data": {"nazwa": "Procenty", "wymaga": ["@swiat/t-dziesietne"], "pole": "@swiat/m-dziesietne"}},
  {"ref": "@swiat/t-predkosc", "kinds": ["@swiat/temat"], "data": {"nazwa": "Prędkość", "wymaga": ["@swiat/t-droga"], "pole": "@swiat/m-ruch"}},
  {"ref": "@swiat/t-jednostki", "kinds": ["@swiat/temat"], "data": {"nazwa": "Wielkości i jednostki", "pole": "@swiat/m-fizyka"}}],
 "views": [
  {"ref": "@swiat/w-pola", "name": "Krajobraz pól", "mode": "landscape",
   "steps": [{"type": "source.kind", "config": {"kind": "@swiat/temat"}}],
   "landscape": {"nest": "pole"}}]}
```

Zasady: węzłów nie wpisuje się do `"steps"` widoku (widok pokazuje tematy, węzły przychodzą przez pole `nest`); węzeł bez żadnego tematu z kartami w poddrzewie nie stoi na mapie; jeden temat — jeden węzeł (pierwsza wartość, gdy pole ma kilka); bez kół w `"structure": "up"` (koło: węzeł, który by je zamknął, staje na górze).

**Cel.** Uczący się wybiera górę i „Ustaw jako cel”: krajobraz pokazuje drogę od podstaw i następny krok. Cel zapamiętuje się dla uczącego się i widoku, w jego pozycjach (`landscape:<id widoku>`) razem z postępami; kto uczy się bez konta, ma go tylko w tej przeglądarce. W schemacie nic o celu nie piszesz.

**Zamek: najpierw powtórz.** Temat z pierścienia jest zamknięty, gdy w jego łańcuchu wymagań są karty już odpowiadane, które teraz są poniżej 1 (do powtórki, zapomniane, ostatnio źle) — krajobraz proponuje „Powtórz (n), potem ucz się tego”: najpierw dokładnie te karty, od podstaw, a potem nauka idzie dalej tym tematem. Nigdy nie pytane karty nie zamykają. Ten sam warunek działa w każdym widoku i każdej powtórce:

```json
{"type": "knowness", "rel": "chain", "band": "known"}
```

**Na stronie** — moduł „Widok” z `"mode": "krajobraz"`, `"answers"` (obszar kursu, do którego idą odpowiedzi; puste — jak w bazie wiedzy) i `"rewards"` (nagrody kursu w trakcie nauki; puste — jak moduł „Punkty i seria” na tej stronie). Wzór: `example-world-page` (`templates/cogita/przyklad-swiat-strona.json`).

**Import ostrzega**, gdy kolejność nauki zamyka koło dotykające importowanych wpisów, gdy oś krajobrazu (`"by": "axis"`) wskazuje rodzaj, którego nie ma (kierunek przyjdzie wtedy z sąsiedztwa w kolejności nauki), i gdy baza z widokiem krajobrazu nie ma żadnej kolejności nauki (wszystko, czego się nie umie, leży wtedy na pierścieniu, bez gór).

Sprawdź przed importem: narzędzie `preview_knowledge` serwera podglądu (`recreatio-preview`) rysuje krajobraz dla nowego uczącego się i dla kogoś w połowie drogi oraz wypisuje koła w wymaganiach.

### Inne światy: pole „W innych światach” (2026-11-05)

Pole-odwołanie z `"external": true` może wskazywać także wpisy i opowieści **innej bazy wiedzy** — odwołaniem `"@@<nazwa bazy>:<@trwała/nazwa>"`:

```json
{"key": "swiaty", "label": "W innych światach", "type": "ref", "multi": true, "external": true}
```
we wpisie: `"swiaty": ["@@historia:@historia/rewolucja-1688", "@@historia:@historia/f/rewolucja"]`. Nazwa bazy to `"handle"` z jej Ustawień; ta baza zna ją w `"settings": {"worlds": [{"id", "handle", "name"}]}` (import dopisuje świat sam, gdy znajdzie bazę o tej nazwie wśród czytanych).

- Takie pole **nigdy nie ma** `"prerequisite"` ani `"structure"` (aplikacja je pomija) — inny świat to oferta, nie wymaganie.
- Schemat pod rodzaj wiedzy dostaje to pole tylko wtedy, gdy wpisy tego rodzaju naprawdę mają odpowiedniki gdzie indziej (temat fizyki ↔ wydarzenie historyczne) — nie „na zapas”.

**Jak aplikacja używa tych danych:** przy temacie stoi „W innych światach” — karty z nazwą bazy, jednym zdaniem i stanem uczącego się tam; tylko dla tych, którzy mogą czytać tamtą bazę (właściciel widzi „niedostępne”). Postęp zostaje w bazie, w której powstaje; odwołania nie liczą się do znajomości, krajobrazu, celów ani powtórek tej bazy. Zerwane są dla uczących się ukryte i stoją w „Do zrobienia”; edytor ma przy polu „Link do innego świata”.

## 3. Czego nie robić

- Schemat pod jedną książkę albo jeden kurs.
- Ten sam fakt pod dwiema nazwami w dwóch szablonach (odpowiedzi się nie dzielą) albo dwa różne fakty pod jedną nazwą (karta „umie” to, czego nie pytano).
- Wysokie wagi `"tests"` na ogólnych, łatwych kartach (fiszka „co wiadomo?” z wagą 1 obok dokładnego pytania).
- Kolejność nauki na każdym polu-odwołaniu.
- Wymagania pośrednie dopisane obok bezpośrednich („na zapas”) i koła w wymaganiach.
- Jeden ogromny temat zamiast kilku kroków — krajobraz liczy każdy wpis jako jeden krok.
- Dziedziny (tagi) przypięte „na wszelki wypadek”, zamiast najwęższej pasującej.
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
- [ ] Poprawki do istniejącej bazy: `{"ref": "<id>", "data": {…}}` (tylko wymienione pola) i `{"ref": "<id>", "remove": true}` — jeden dokument, jeden zapis; podgląd wymienia każde usunięcie.
- [ ] Przy wielu tematach (ponad ~60): węzły „Pole mapy” z hierarchią i `"landscape": {"nest": "pole"}` (§2.6).
- [ ] Pod krajobraz: wymagania tylko bezpośrednie i bez kół; każdy temat jednym krokiem i z kartami; oś dziedzin z hierarchią (`"structure": "up"`); kilka dziedzin tylko tam, gdzie naprawdę pasują.
- [ ] Każdy szablon: `"tests"` z wagami z powodem; `"asks"` — wspólna nazwa dokładnie dla kart pytających o to samo.
- [ ] Warunki w widokach i powtórkach pasmami (`"band": "learned"` dla tego, co wcześniej i wyżej).
- [ ] Powtórka: `"temporal"`, stos 10–20, `"minCorrectness": 1`, bez `"endWhenDone"` (chyba że „tylko zaległe”).
- [ ] Raport: co który rodzaj opisuje, które szablony dzielą fakty i dlaczego, czego nie dało się zadeklarować.
